/**
 * Sigma Operator — Realtime Manager
 *
 * Gerencia a conexão WebSocket persistente com o Supabase Realtime.
 *
 * Responsabilidades:
 *   - Conectar/desconectar do Supabase
 *   - Subscription na tabela sigmaOccurrences filtrada por idMonitoringCenter
 *   - Processar eventos INSERT/UPDATE/DELETE
 *   - Manter chrome.storage.local.idsOcultos sincronizado
 *   - Notificar popup e content scripts sobre mudanças
 *   - Reconexão automática com backoff exponencial
 *
 * MAPEAMENTO DE CAMPOS (atualizado):
 *   ocultarOcorrencias.idOccurrence   → sigmaOccurrences.idOccurrence
 *   ocultarOcorrencias.nomeCliente    → sigmaOccurrences.nameClient
 *   ocultarOcorrencias.idEmpresa      → sigmaOccurrences.idEnterprise
 *   ocultarOcorrencias.visualizar     → sigmaOccurrences.viewEvent
 *   ocultarOcorrencias.idMonitoramento → sigmaOccurrences.idMonitoringCenter
 *   (novo) sigmaOccurrences.eventClose → filtra eventos já fechados
 */

import { createClient } from './supabase.min.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import {
  SYNC_KEYS,
  LOCAL_KEYS,
  lerSync,
  lerLocal,
  salvarLocal,
  registrarLog
} from './storage.js';

// =====================================================
// ESTADO GLOBAL DO MANAGER
// =====================================================

let cliente = null;
let channel = null;
let status = 'desconectado';
let ultimoErro = null;
let tentativasReconexao = 0;
let timerReconexao = null;
let idMonitoramentoAtivo = null;

const BACKOFFS_SEGUNDOS = [2, 4, 8, 16, 30];

// =====================================================
// GETTERS DE ESTADO
// =====================================================

export function getEstadoAtual() {
  return { status, idMonitoramento: idMonitoramentoAtivo, ultimoErro, tentativasReconexao };
}

// =====================================================
// HELPERS — VERIFICAÇÃO DE OCULTAÇÃO
// =====================================================

/**
 * Um registro deve ser ocultado se:
 *   viewEvent === false  (extensão deve esconder o card)
 *   eventClose === false (evento ainda não foi fechado pelo Playwright)
 *
 * NULL em qualquer campo → não oculta (registro antigo ou incompleto)
 */
function deveOcultar(row) {
  return row.viewEvent === false && row.eventClose === false;
}

// =====================================================
// PROCESSAMENTO DE EVENTOS REALTIME
// =====================================================

async function carregarEstadoInicial() {
  if (!cliente || !idMonitoramentoAtivo) return;

  try {
    const { data, error } = await cliente
      .from('sigmaOccurrences')
      .select('idOccurrence,nameClient,accountClient,viewEvent,eventClose')
      .eq('idMonitoringCenter', idMonitoramentoAtivo);

    if (error) {
      await registrarLog('realtime', 'Erro ao carregar estado inicial', { error: error.message });
      return;
    }

    // Filtra só os que devem ser ocultados
    const linhasOcultas = (data || []).filter(deveOcultar);
    const ocultos = linhasOcultas.map(r => r.idOccurrence);

    // Monta cache de detalhes para o popup
    const detalhes = {};
    linhasOcultas.forEach(r => {
      detalhes[r.idOccurrence] = {
        nomeCliente: r.nameClient,
        accountClient: r.accountClient
      };
    });

    await salvarLocal({
      [LOCAL_KEYS.IDS_OCULTOS]: ocultos,
      [LOCAL_KEYS.DETALHES_OCULTOS]: detalhes
    });
    await registrarLog('realtime', `Estado inicial carregado: ${ocultos.length} eventos ocultos`);
    await notificarContentScripts();
  } catch (err) {
    await registrarLog('realtime', 'Exceção ao carregar estado inicial', { message: err.message });
  }
}

/**
 * INSERT em sigmaOccurrences — oculta se viewEvent=false e eventClose=false
 */
async function onInsert(payload) {
  const row = payload.new;
  if (!row || !row.idOccurrence) return;

  await registrarLog('realtime', 'INSERT recebido', {
    idOccurrence: row.idOccurrence,
    nameClient: row.nameClient,
    viewEvent: row.viewEvent,
    eventClose: row.eventClose
  });

  if (deveOcultar(row)) {
    const { idsOcultos = [], detalhesOcultos = {} } = await lerLocal([
      LOCAL_KEYS.IDS_OCULTOS,
      LOCAL_KEYS.DETALHES_OCULTOS
    ]);
    if (!idsOcultos.includes(row.idOccurrence)) {
      idsOcultos.push(row.idOccurrence);
      detalhesOcultos[row.idOccurrence] = {
        nomeCliente: row.nameClient,
        accountClient: row.accountClient
      };
      await salvarLocal({
        [LOCAL_KEYS.IDS_OCULTOS]: idsOcultos,
        [LOCAL_KEYS.DETALHES_OCULTOS]: detalhesOcultos
      });
      await notificarContentScripts();
    }
  }

  await incrementarContador();
}

/**
 * UPDATE em sigmaOccurrences.
 * Revela o card quando viewEvent=true OU eventClose=true.
 * Oculta quando viewEvent=false e eventClose=false.
 */
async function onUpdate(payload) {
  const row = payload.new;
  if (!row || !row.idOccurrence) return;

  await registrarLog('realtime', 'UPDATE recebido', {
    idOccurrence: row.idOccurrence,
    viewEvent: row.viewEvent,
    eventClose: row.eventClose
  });

  const { idsOcultos = [], detalhesOcultos = {} } = await lerLocal([
    LOCAL_KEYS.IDS_OCULTOS,
    LOCAL_KEYS.DETALHES_OCULTOS
  ]);
  const indice = idsOcultos.indexOf(row.idOccurrence);
  let mudou = false;

  if (!deveOcultar(row) && indice !== -1) {
    // Revela: tira da lista (viewEvent=true OU eventClose=true)
    idsOcultos.splice(indice, 1);
    delete detalhesOcultos[row.idOccurrence];
    mudou = true;
  } else if (deveOcultar(row) && indice === -1) {
    // Oculta: adiciona à lista
    idsOcultos.push(row.idOccurrence);
    detalhesOcultos[row.idOccurrence] = {
      nomeCliente: row.nameClient,
      accountClient: row.accountClient
    };
    mudou = true;
  }

  if (mudou) {
    await salvarLocal({
      [LOCAL_KEYS.IDS_OCULTOS]: idsOcultos,
      [LOCAL_KEYS.DETALHES_OCULTOS]: detalhesOcultos
    });
    await notificarContentScripts();
  }

  await incrementarContador();
}

/**
 * DELETE em sigmaOccurrences — remove da lista de ocultos.
 */
async function onDelete(payload) {
  const row = payload.old;
  if (!row || !row.idOccurrence) return;

  await registrarLog('realtime', 'DELETE recebido', { idOccurrence: row.idOccurrence });

  const { idsOcultos = [], detalhesOcultos = {} } = await lerLocal([
    LOCAL_KEYS.IDS_OCULTOS,
    LOCAL_KEYS.DETALHES_OCULTOS
  ]);
  const indice = idsOcultos.indexOf(row.idOccurrence);
  if (indice !== -1) {
    idsOcultos.splice(indice, 1);
    delete detalhesOcultos[row.idOccurrence];
    await salvarLocal({
      [LOCAL_KEYS.IDS_OCULTOS]: idsOcultos,
      [LOCAL_KEYS.DETALHES_OCULTOS]: detalhesOcultos
    });
    await notificarContentScripts();
  }

  await incrementarContador();
}

async function incrementarContador() {
  const { contadorEventos = 0 } = await lerLocal(LOCAL_KEYS.CONTADOR_EVENTOS);
  await salvarLocal({ [LOCAL_KEYS.CONTADOR_EVENTOS]: contadorEventos + 1 });
}

async function notificarContentScripts() {
  try {
    const tabs = await chrome.tabs.query({ url: 'https://cloud.segware.com.br/*' });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { tipo: 'lista-ocultos-atualizada' }).catch(() => {});
    }
    chrome.runtime.sendMessage({ tipo: 'estado-mudou' }).catch(() => {});
  } catch (err) { /* silencia */ }
}

// =====================================================
// CONEXÃO E RECONEXÃO
// =====================================================

let conectandoAgora = false;

export async function conectar() {
  if (conectandoAgora) return;
  conectandoAgora = true;

  try {
    if (timerReconexao) { clearTimeout(timerReconexao); timerReconexao = null; }

    const dados = await lerSync([SYNC_KEYS.ID_MONITORAMENTO]);
    if (!dados.idMonitoramento) {
      await registrarLog('realtime', 'Conexão abortada: sem licença ativa');
      status = 'desconectado';
      ultimoErro = 'Sem licença ativa';
      return;
    }

    if (status === 'conectado' && idMonitoramentoAtivo === dados.idMonitoramento) return;

    await desconectar(true);

    idMonitoramentoAtivo = dados.idMonitoramento;
    status = 'conectando';
    ultimoErro = null;
    await broadcastEstado();

    cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 10 } }
    });

    // Filtro por idMonitoringCenter (campo novo da sigmaOccurrences)
    const filtro = `idMonitoringCenter=eq.${idMonitoramentoAtivo}`;
    channel = cliente
      .channel(`sigma-occurrences-${idMonitoramentoAtivo}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sigmaOccurrences', filter: filtro },
        onInsert
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sigmaOccurrences', filter: filtro },
        onUpdate
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'sigmaOccurrences', filter: filtro },
        onDelete
      )
      .subscribe(async (subStatus, err) => {
        await registrarLog('realtime', `Subscription status: ${subStatus}`, err ? { error: err.message } : null);

        if (subStatus === 'SUBSCRIBED') {
          status = 'conectado';
          ultimoErro = null;
          tentativasReconexao = 0;
          await salvarLocal({
            [LOCAL_KEYS.ULTIMA_CONEXAO]: {
              timestamp: new Date().toISOString(),
              ok: true,
              modo: 'realtime',
              idMonitoramento: idMonitoramentoAtivo
            }
          });
          await carregarEstadoInicial();
          await broadcastEstado();

        } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT') {
          status = 'erro';
          ultimoErro = err ? err.message : `Subscription ${subStatus}`;
          await broadcastEstado();
          await agendarReconexao();

        } else if (subStatus === 'CLOSED') {
          if (status !== 'desconectado') {
            status = 'erro';
            ultimoErro = 'Conexão fechada inesperadamente';
            await broadcastEstado();
            await agendarReconexao();
          }
        }
      });

  } catch (err) {
    await registrarLog('realtime', 'Exceção ao conectar', { message: err.message });
    status = 'erro';
    ultimoErro = err.message;
    await broadcastEstado();
    await agendarReconexao();
  } finally {
    conectandoAgora = false;
  }
}

/**
 * Desconecta e LIMPA o storage (Bug 5).
 * Quando a licença é desativada, não deve sobrar IDs ocultos no storage.
 */
export async function desconectar(silencioso = false) {
  if (timerReconexao) { clearTimeout(timerReconexao); timerReconexao = null; }

  if (channel) {
    try { await channel.unsubscribe(); } catch { /* ignora */ }
    channel = null;
  }

  if (cliente) {
    try { await cliente.removeAllChannels(); } catch { /* ignora */ }
    cliente = null;
  }

  const estavaConectado = status === 'conectado' || status === 'conectando';
  status = 'desconectado';
  idMonitoramentoAtivo = null;

  // BUG 5 FIX: limpa IDs ocultos do storage ao desconectar
  // Sem isso, ao desativar a licença os cards continuavam ocultos
  // porque o content script lia os IDs do storage mesmo sem licença
  if (!silencioso) {
    try {
      await salvarLocal({
        [LOCAL_KEYS.IDS_OCULTOS]: [],
        [LOCAL_KEYS.DETALHES_OCULTOS]: {}
      });
      await notificarContentScripts();
    } catch { /* silencia */ }
  }

  if (!silencioso && estavaConectado) {
    await registrarLog('realtime', 'Desconectado do Supabase Realtime');
    await broadcastEstado();
  }
}

async function agendarReconexao() {
  if (timerReconexao) return;

  const dados = await lerSync([SYNC_KEYS.ID_MONITORAMENTO]);
  if (!dados.idMonitoramento) return;

  const indice = Math.min(tentativasReconexao, BACKOFFS_SEGUNDOS.length - 1);
  const segundos = BACKOFFS_SEGUNDOS[indice];
  tentativasReconexao++;

  await registrarLog('realtime', `Reconexão agendada em ${segundos}s (tentativa ${tentativasReconexao})`);
  timerReconexao = setTimeout(async () => { timerReconexao = null; await conectar(); }, segundos * 1000);
}

export async function verificarSaude() {
  const ativada = await lerSync([SYNC_KEYS.ID_MONITORAMENTO]);
  if (ativada.idMonitoramento && status !== 'conectado' && status !== 'conectando') {
    await registrarLog('realtime', 'Heartbeat: licença ativa mas desconectado — reconectando');
    await conectar();
  } else if (!ativada.idMonitoramento && status !== 'desconectado') {
    await registrarLog('realtime', 'Heartbeat: licença removida — desconectando');
    await desconectar();
  }
}

async function broadcastEstado() {
  chrome.runtime.sendMessage({ tipo: 'estado-mudou', estado: getEstadoAtual() }).catch(() => {});
}
