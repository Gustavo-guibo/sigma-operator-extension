/**
 * Sigma Operator — Service Worker (background)
 *
 * Sub-etapa 3.3 (PATCH FINAL) — Conexão WebSocket Realtime robusta.
 *
 * O segredo para manter MV3 conectado:
 *   1. iniciarKeepalive() ANTES de conectar() — mantém o worker vivo
 *      durante o handshake do WebSocket
 *   2. Logs explícitos em cada heartbeat (verificarSaude)
 *   3. Tratamento defensivo: se acordar e tiver licença, tenta conectar
 */

import { conectar, desconectar, verificarSaude, getEstadoAtual } from '../lib/realtime-manager.js';
import { SYNC_KEYS, LOCAL_KEYS, estaAtivada, lerLocal, registrarLog } from '../lib/storage.js';

console.log('[Sigma Operator] Service worker iniciado');

const HEARTBEAT_NOME = 'sigma-heartbeat';
const HEARTBEAT_PERIODO_MIN = 15 / 60;  // 15s
const KEEPALIVE_INTERVAL_MS = 20000;    // 20s

let keepaliveTimer = null;

// =====================================================
// CICLO DE VIDA DA EXTENSÃO
// =====================================================

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Sigma Operator] onInstalled:', details.reason);
  await registrarLog('lifecycle', `Evento: ${details.reason}`, { previousVersion: details.previousVersion });

  await iniciarHeartbeat();

  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
  } else if (details.reason === 'update') {
    const ativada = await estaAtivada();
    if (!ativada) {
      chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
    }
  }

  if (await estaAtivada()) {
    console.log('[Sigma Operator] Licença detectada — iniciando keepalive e conectando');
    iniciarKeepalive();   // ANTES de conectar
    await conectar();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[Sigma Operator] onStartup');
  await iniciarHeartbeat();

  if (await estaAtivada()) {
    iniciarKeepalive();
    await conectar();
  }
});

// =====================================================
// HEARTBEAT (chrome.alarms) — 15s
// =====================================================

async function iniciarHeartbeat() {
  await chrome.alarms.clear(HEARTBEAT_NOME);
  await chrome.alarms.create(HEARTBEAT_NOME, {
    periodInMinutes: HEARTBEAT_PERIODO_MIN,
    delayInMinutes: HEARTBEAT_PERIODO_MIN
  });
  console.log(`[Sigma Operator] Heartbeat configurado: cada ${Math.round(HEARTBEAT_PERIODO_MIN * 60)}s`);
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === HEARTBEAT_NOME) {
    const estado = getEstadoAtual();
    console.log(`[Sigma Operator] Heartbeat tick — status: ${estado.status}`);

    // Garante que o keepalive está rodando se há licença
    if (await estaAtivada() && !keepaliveTimer) {
      console.log('[Sigma Operator] Heartbeat: reativando keepalive');
      iniciarKeepalive();
    }

    await verificarSaude();
  }
});

// =====================================================
// KEEPALIVE INTERNO
// =====================================================

function iniciarKeepalive() {
  if (keepaliveTimer) return;
  console.log('[Sigma Operator] Keepalive iniciado (intervalo: 20s)');
  keepaliveTimer = setInterval(async () => {
    try {
      await chrome.storage.local.get('keepalive');
    } catch (e) { /* ignora */ }
  }, KEEPALIVE_INTERVAL_MS);
}

function pararKeepalive() {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
    console.log('[Sigma Operator] Keepalive parado');
  }
}

// =====================================================
// DETECÇÃO DE MUDANÇAS NA LICENÇA
// =====================================================

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'sync') return;

  if (changes[SYNC_KEYS.ID_MONITORAMENTO]) {
    const novoId = changes[SYNC_KEYS.ID_MONITORAMENTO].newValue;
    const idAntigo = changes[SYNC_KEYS.ID_MONITORAMENTO].oldValue;

    if (novoId && !idAntigo) {
      await registrarLog('lifecycle', 'Licença ativada — iniciando conexão Realtime');
      iniciarKeepalive();
      await conectar();
    } else if (!novoId && idAntigo) {
      await registrarLog('lifecycle', 'Licença desativada — encerrando conexão');
      await desconectar();
      pararKeepalive();
    } else if (novoId && idAntigo && novoId !== idAntigo) {
      await registrarLog('lifecycle', 'idMonitoramento mudou — reconectando');
      await conectar();
    }
  }
});

// =====================================================
// MENSAGERIA ENTRE CAMADAS
// =====================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.tipo) {
    sendResponse({ ok: false, erro: 'mensagem sem tipo' });
    return;
  }

  (async () => {
    try {
      switch (message.tipo) {
        case 'get-estado':
          sendResponse({ ok: true, estado: getEstadoAtual() });
          break;

        case 'reconectar':
          await registrarLog('lifecycle', 'Reconexão solicitada pela UI');
          iniciarKeepalive();
          await conectar();
          sendResponse({ ok: true, estado: getEstadoAtual() });
          break;

        case 'desconectar':
          await desconectar();
          pararKeepalive();
          sendResponse({ ok: true, estado: getEstadoAtual() });
          break;

        case 'estado-mudou':
        case 'lista-ocultos-atualizada':
          sendResponse({ ok: true });
          break;

        case 'get-detalhes-ocultos': {
          // Retorna detalhes (nomeCliente + idEmpresa) dos IDs solicitados
          // Usado pelo popup para renderizar a lista de eventos ocultos
          const idsSolicitados = message.ids || [];
          const { detalhesOcultos = {} } = await lerLocal([LOCAL_KEYS.DETALHES_OCULTOS]);
          const detalhes = idsSolicitados.map(id => {
            const det = detalhesOcultos[id] || {};
            return {
              idOccurrence: id,
              nomeCliente: det.nomeCliente || '—',
              idEmpresa: det.idEmpresa || '—'
            };
          });
          sendResponse({ ok: true, detalhes });
          break;
        }

        default:
          sendResponse({ ok: false, erro: 'tipo desconhecido', tipo: message.tipo });
      }
    } catch (err) {
      sendResponse({ ok: false, erro: err.message });
    }
  })();

  return true;
});

// =====================================================
// INICIALIZAÇÃO IMEDIATA (cold start)
// =====================================================

(async () => {
  await iniciarHeartbeat();
  if (await estaAtivada()) {
    console.log('[Sigma Operator] Cold start com licença ativa — conectando');
    iniciarKeepalive();
    await conectar();
  }
})();
