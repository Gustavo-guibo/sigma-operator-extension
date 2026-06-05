/**
 * Sigma Operator — Options Script
 * Sub-etapa 3.2 — Página de opções funcional
 *
 * Lógica completa de:
 *   - Ativação por chave de licença (consulta clientesLicencas no Supabase)
 *   - Persistência de configurações em chrome.storage.sync
 *   - Toggles de comportamento
 *   - Teste de conexão com Supabase
 *   - Exportação de logs completos
 */

import {
  SUPABASE_URL,
  EXTENSION_VERSION,
  PRODUCT_NAME,
  VENDOR_NAME,
  VENDOR_URL
} from '../lib/config.js';

import {
  credenciaisConfiguradas,
  selecionar,
  testarConexao
} from '../lib/supabase-client.js';

import {
  SYNC_KEYS,
  LOCAL_KEYS,
  DEFAULTS,
  lerSync,
  salvarSync,
  removerSync,
  lerLocal,
  salvarLocal,
  registrarLog
} from '../lib/storage.js';

console.log('[Sigma Operator] Página de configurações carregada');

// =====================================================
// REFERÊNCIAS AOS ELEMENTOS DO DOM
// =====================================================
const $ = (id) => document.getElementById(id);

const els = {
  brandSubtitle: $('brand-subtitle'),
  cardCredenciais: $('card-credenciais'),

  // Licença
  badgeLicenca: $('badge-licenca'),
  licencaForm: $('licenca-form'),
  licencaAtiva: $('licenca-ativa'),
  inputChave: $('input-chave'),
  btnAtivar: $('btn-ativar'),
  mensagemLicenca: $('mensagem-licenca'),
  btnDesativar: $('btn-desativar'),
  infoCliente: $('info-cliente'),
  infoMonitoramento: $('info-monitoramento'),
  infoChave: $('info-chave'),
  infoAtivadaEm: $('info-ativada-em'),

  // Comportamento
  toggleOcultar: $('toggle-ocultar'),
  toggleContadores: $('toggle-contadores'),
  toggleIniciar: $('toggle-iniciar'),

  // Conexão
  badgeConexao: $('badge-conexao'),
  infoUrl: $('info-url'),
  infoLatencia: $('info-latencia'),
  infoUltimaVerificacao: $('info-ultima-verificacao'),
  infoRealtimeStatus: $('info-realtime-status'),
  infoEventosProcessados: $('info-eventos-processados'),
  infoIdsOcultos: $('info-ids-ocultos'),
  btnTestarConexao: $('btn-testar-conexao'),
  btnReconectar: $('btn-reconectar'),

  // Diagnóstico
  infoExtensionId: $('info-extension-id'),
  infoEventosLog: $('info-eventos-log'),
  infoLogAtualizado: $('info-log-atualizado'),
  btnLimparLogs: $('btn-limpar-logs'),
  btnExportar: $('btn-exportar'),

  // Toast
  toast: $('toast'),
  toastIcon: $('toast-icon'),
  toastMessage: $('toast-message')
};


// =====================================================
// HELPERS
// =====================================================

/**
 * Exibe um toast (notificação) no rodapé.
 * @param {string} mensagem
 * @param {'success'|'error'|'info'} tipo
 */
function mostrarToast(mensagem, tipo = 'info') {
  els.toast.className = 'toast is-' + tipo;
  els.toastMessage.textContent = mensagem;
  els.toastIcon.textContent = tipo === 'success' ? '✓' : tipo === 'error' ? '!' : 'i';
  els.toast.hidden = false;

  // Forçar reflow para a transição funcionar
  void els.toast.offsetWidth;
  els.toast.classList.add('is-visible');

  setTimeout(() => {
    els.toast.classList.remove('is-visible');
    setTimeout(() => { els.toast.hidden = true; }, 250);
  }, 3000);
}

/**
 * Exibe uma mensagem inline no formulário de licença.
 */
function mostrarMensagemLicenca(texto, tipo) {
  els.mensagemLicenca.textContent = texto;
  els.mensagemLicenca.className = 'form-message is-' + tipo;
  els.mensagemLicenca.hidden = false;
}

function esconderMensagemLicenca() {
  els.mensagemLicenca.hidden = true;
  els.mensagemLicenca.textContent = '';
}

/**
 * Formata uma data ISO em formato pt-BR.
 */
function formatarData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Normaliza a chave: maiúsculas + tira espaços extras.
 */
function normalizarChave(chave) {
  return (chave || '').trim().toUpperCase();
}


// =====================================================
// RENDER: ESTADO DA LICENÇA
// =====================================================

async function atualizarEstadoLicenca() {
  const dados = await lerSync([
    SYNC_KEYS.CHAVE_ATIVACAO,
    SYNC_KEYS.ID_MONITORAMENTO,
    SYNC_KEYS.NOME_CLIENTE,
    SYNC_KEYS.ATIVADO_EM
  ]);

  if (dados.chaveAtivacao && dados.idMonitoramento) {
    // Estado: ATIVADA
    els.licencaForm.hidden = true;
    els.licencaAtiva.hidden = false;

    els.badgeLicenca.textContent = 'Ativa';
    els.badgeLicenca.className = 'badge badge-status is-active';

    els.infoCliente.textContent = dados.nomeCliente || '—';
    els.infoMonitoramento.textContent = dados.idMonitoramento || '—';
    els.infoChave.textContent = dados.chaveAtivacao || '—';
    els.infoAtivadaEm.textContent = formatarData(dados.ativadoEm);

    // Atualiza o subtítulo do header (co-branding)
    if (dados.nomeCliente) {
      els.brandSubtitle.textContent = `Configurações da extensão · ${dados.nomeCliente}`;
    }
  } else {
    // Estado: NÃO ATIVADA
    els.licencaForm.hidden = false;
    els.licencaAtiva.hidden = true;

    els.badgeLicenca.textContent = 'Não ativada';
    els.badgeLicenca.className = 'badge badge-status';

    els.brandSubtitle.textContent = 'Configurações da extensão';
  }
}


// =====================================================
// AÇÃO: VALIDAR E ATIVAR LICENÇA
// =====================================================

async function ativarLicenca() {
  esconderMensagemLicenca();

  const chave = normalizarChave(els.inputChave.value);

  if (!chave) {
    mostrarMensagemLicenca('Cole a chave de ativação no campo acima antes de validar.', 'error');
    return;
  }

  // Mínima validação visual de formato (não estrita — Supabase é a verdade)
  if (chave.length < 8) {
    mostrarMensagemLicenca('A chave parece muito curta. Confira se copiou completa.', 'error');
    return;
  }

  if (!credenciaisConfiguradas()) {
    mostrarMensagemLicenca(
      'Credenciais do Supabase não configuradas em lib/config.js. ' +
      'Veja o aviso vermelho no topo desta página.',
      'error'
    );
    return;
  }

  // Bloqueia o botão durante a validação
  els.btnAtivar.disabled = true;
  els.btnAtivar.textContent = 'Validando...';

  await registrarLog('auth', 'Tentativa de ativação iniciada', { chaveParcial: chave.slice(0, 4) + '...' });

  try {
    // Busca a chave na tabela clientesLicencas
    // A política RLS já garante que só licenças com ativo=true são retornadas
    const resultado = await selecionar(
      'clientesLicencas',
      { chaveAtivacao: chave },
      { colunas: ['chaveAtivacao', 'idMonitoramento', 'nomeCliente', 'ativo', 'expiraEm'] }
    );

    if (!resultado.ok) {
      await registrarLog('auth', 'Erro na consulta de licença', { error: resultado.error, status: resultado.status });
      mostrarMensagemLicenca(
        `Erro ao consultar o servidor: ${resultado.error}`,
        'error'
      );
      return;
    }

    if (!resultado.data || resultado.data.length === 0) {
      await registrarLog('auth', 'Chave não encontrada ou inativa');
      mostrarMensagemLicenca(
        'Chave inválida, inativa ou desconhecida. Verifique com a Team Everest.',
        'error'
      );
      return;
    }

    const licenca = resultado.data[0];

    // Validação extra: a chave está realmente ativa?
    if (licenca.ativo === false) {
      await registrarLog('auth', 'Chave encontrada mas inativa');
      mostrarMensagemLicenca('Esta chave foi desativada. Entre em contato com a Team Everest.', 'error');
      return;
    }

    // Validação extra: a chave está dentro da validade?
    if (licenca.expiraEm) {
      const expira = new Date(licenca.expiraEm);
      if (expira < new Date()) {
        await registrarLog('auth', 'Chave expirada', { expiraEm: licenca.expiraEm });
        mostrarMensagemLicenca(
          `Esta chave expirou em ${formatarData(licenca.expiraEm)}. Renove com a Team Everest.`,
          'error'
        );
        return;
      }
    }

    // Salva a licença no storage
    await salvarSync({
      [SYNC_KEYS.CHAVE_ATIVACAO]: licenca.chaveAtivacao,
      [SYNC_KEYS.ID_MONITORAMENTO]: licenca.idMonitoramento,
      [SYNC_KEYS.NOME_CLIENTE]: licenca.nomeCliente,
      [SYNC_KEYS.ATIVADO_EM]: new Date().toISOString()
    });

    await registrarLog('auth', 'Licença ativada com sucesso', {
      idMonitoramento: licenca.idMonitoramento,
      nomeCliente: licenca.nomeCliente
    });

    els.inputChave.value = '';
    mostrarToast(`Licença ativada para ${licenca.nomeCliente}`, 'success');

    await atualizarEstadoLicenca();

  } catch (err) {
    await registrarLog('auth', 'Exceção na ativação', { message: err.message });
    mostrarMensagemLicenca(`Erro inesperado: ${err.message}`, 'error');
  } finally {
    els.btnAtivar.disabled = false;
    els.btnAtivar.textContent = 'Validar e ativar';
  }
}


// =====================================================
// AÇÃO: DESATIVAR LICENÇA
// =====================================================

async function desativarLicenca() {
  const confirma = confirm(
    'Tem certeza que deseja desativar a licença?\n\n' +
    'A extensão deixará de ocultar cards até que uma nova licença seja inserida.\n\n' +
    'Suas preferências de comportamento (toggles) serão mantidas.'
  );

  if (!confirma) return;

  await removerSync([
    SYNC_KEYS.CHAVE_ATIVACAO,
    SYNC_KEYS.ID_MONITORAMENTO,
    SYNC_KEYS.NOME_CLIENTE,
    SYNC_KEYS.ATIVADO_EM
  ]);

  await registrarLog('auth', 'Licença desativada pelo usuário');

  mostrarToast('Licença desativada', 'info');
  await atualizarEstadoLicenca();
}


// =====================================================
// AÇÃO: TOGGLES DE COMPORTAMENTO
// =====================================================

async function carregarToggles() {
  const valores = await lerSync([
    SYNC_KEYS.OCULTAR_CARDS,
    SYNC_KEYS.MOSTRAR_CONTADORES,
    SYNC_KEYS.INICIAR_ATIVO
  ]);

  els.toggleOcultar.checked = valores.ocultarCards ?? DEFAULTS.ocultarCards;
  els.toggleContadores.checked = valores.mostrarContadores ?? DEFAULTS.mostrarContadores;
  els.toggleIniciar.checked = valores.iniciarAtivo ?? DEFAULTS.iniciarAtivo;
}

async function onToggleMudar(evt) {
  const input = evt.target;
  const key = input.dataset.key;
  const valor = input.checked;

  await salvarSync({ [key]: valor });
  await registrarLog('config', `Toggle alterado: ${key} = ${valor}`);

  mostrarToast(
    valor ? 'Configuração ativada' : 'Configuração desativada',
    'success'
  );
}


// =====================================================
// AÇÃO: TESTAR CONEXÃO
// =====================================================

async function testarConexaoSupabase() {
  if (!credenciaisConfiguradas()) {
    mostrarToast('Credenciais não configuradas em lib/config.js', 'error');
    return;
  }

  els.btnTestarConexao.disabled = true;
  els.btnTestarConexao.textContent = 'Testando...';

  els.badgeConexao.textContent = 'Testando...';
  els.badgeConexao.className = 'badge badge-conexao is-pending';

  const resultado = await testarConexao();
  const agora = new Date().toISOString();

  els.infoUltimaVerificacao.textContent = formatarData(agora);
  els.infoLatencia.textContent = resultado.latencia_ms + 'ms';

  if (resultado.ok) {
    els.badgeConexao.textContent = 'Conectado';
    els.badgeConexao.className = 'badge badge-conexao is-active';
    mostrarToast(`Conectado ao Supabase em ${resultado.latencia_ms}ms`, 'success');
    await registrarLog('connection', 'Teste de conexão bem-sucedido', { latencia_ms: resultado.latencia_ms });
  } else {
    els.badgeConexao.textContent = 'Falha';
    els.badgeConexao.className = 'badge badge-conexao is-error';
    mostrarToast(`Falha na conexão: ${resultado.error}`, 'error');
    await registrarLog('connection', 'Teste de conexão falhou', { error: resultado.error });
  }

  // Salva o último teste de conexão
  await salvarLocal({
    [LOCAL_KEYS.ULTIMA_CONEXAO]: { timestamp: agora, ...resultado }
  });

  els.btnTestarConexao.disabled = false;
  els.btnTestarConexao.textContent = 'Testar conexão';
}


// =====================================================
// AÇÃO: EXPORTAR LOGS
// =====================================================

async function exportarLogs() {
  await registrarLog('diagnostic', 'Exportação de logs solicitada');

  const sync = await lerSync([
    SYNC_KEYS.CHAVE_ATIVACAO,
    SYNC_KEYS.ID_MONITORAMENTO,
    SYNC_KEYS.NOME_CLIENTE,
    SYNC_KEYS.ATIVADO_EM,
    SYNC_KEYS.OCULTAR_CARDS,
    SYNC_KEYS.MOSTRAR_CONTADORES,
    SYNC_KEYS.INICIAR_ATIVO
  ]);

  const local = await lerLocal([
    LOCAL_KEYS.IDS_OCULTOS,
    LOCAL_KEYS.LOGS_DEBUG,
    LOCAL_KEYS.ULTIMA_CONEXAO,
    LOCAL_KEYS.CONTADOR_EVENTOS
  ]);

  // Mascara a chave de ativação (mostra só os 4 primeiros caracteres)
  const chaveMascarada = sync.chaveAtivacao
    ? sync.chaveAtivacao.slice(0, 4) + '-****-****-****'
    : null;

  const relatorio = {
    extensao: {
      produto: PRODUCT_NAME,
      versao: EXTENSION_VERSION,
      fornecedor: VENDOR_NAME,
      url_fornecedor: VENDOR_URL,
      extension_id: chrome.runtime.id,
      sub_etapa: '3.4'
    },
    geradoEm: new Date().toISOString(),
    licenca: {
      ativada: Boolean(sync.chaveAtivacao && sync.idMonitoramento),
      chaveAtivacao: chaveMascarada,
      idMonitoramento: sync.idMonitoramento || null,
      nomeCliente: sync.nomeCliente || null,
      ativadoEm: sync.ativadoEm || null
    },
    comportamento: {
      ocultarCards: sync.ocultarCards ?? DEFAULTS.ocultarCards,
      mostrarContadores: sync.mostrarContadores ?? DEFAULTS.mostrarContadores,
      iniciarAtivo: sync.iniciarAtivo ?? DEFAULTS.iniciarAtivo
    },
    conexao: {
      supabaseUrl: SUPABASE_URL,
      credenciaisConfiguradas: credenciaisConfiguradas(),
      ultimaConexao: local.ultimaConexao || null
    },
    estado: {
      idsOcultosAtualmente: (local.idsOcultos || []).length,
      contadorEventosProcessados: local.contadorEventos || 0
    },
    logsDebug: local.logsDebug || []
  };

  const json = JSON.stringify(relatorio, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sigma-operator-logs-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);

  mostrarToast('Logs exportados com sucesso', 'success');
}

async function limparLogs() {
  const confirma = confirm('Deseja apagar todos os logs de debug?\nEsta ação é irreversível.');
  if (!confirma) return;

  await salvarLocal({ [LOCAL_KEYS.LOGS_DEBUG]: [] });
  await atualizarInfoDiagnostico();
  mostrarToast('Logs apagados', 'info');
}


// =====================================================
// RENDER: INFO DE DIAGNÓSTICO
// =====================================================

async function atualizarInfoDiagnostico() {
  els.infoExtensionId.textContent = chrome.runtime.id;

  const local = await lerLocal([LOCAL_KEYS.LOGS_DEBUG]);
  const logs = local.logsDebug || [];

  els.infoEventosLog.textContent = String(logs.length);

  if (logs.length > 0) {
    const ultimo = logs[logs.length - 1];
    els.infoLogAtualizado.textContent = formatarData(ultimo.timestamp);
  } else {
    els.infoLogAtualizado.textContent = '—';
  }
}


// =====================================================
// RENDER: INFO DE CONEXÃO (REST + Realtime)
// =====================================================

async function atualizarInfoConexao() {
  els.infoUrl.textContent = SUPABASE_URL && SUPABASE_URL !== 'COLE_AQUI_SUA_URL_DO_SUPABASE'
    ? SUPABASE_URL
    : '— (não configurada)';

  // Estado do último teste REST (botão "Testar conexão")
  const local = await lerLocal([
    LOCAL_KEYS.ULTIMA_CONEXAO,
    LOCAL_KEYS.CONTADOR_EVENTOS,
    LOCAL_KEYS.IDS_OCULTOS
  ]);

  if (local.ultimaConexao) {
    if (local.ultimaConexao.latencia_ms !== undefined) {
      els.infoLatencia.textContent = local.ultimaConexao.latencia_ms + 'ms';
    }
    els.infoUltimaVerificacao.textContent = formatarData(local.ultimaConexao.timestamp);
  }

  els.infoEventosProcessados.textContent = String(local.contadorEventos || 0);
  els.infoIdsOcultos.textContent = String((local.idsOcultos || []).length);

  // Estado da conexão Realtime (vem do service worker)
  try {
    const resposta = await chrome.runtime.sendMessage({ tipo: 'get-estado' });
    const estado = resposta?.estado;

    if (!estado) {
      els.infoRealtimeStatus.textContent = 'Service worker inativo';
      els.badgeConexao.textContent = 'Inativo';
      els.badgeConexao.className = 'badge badge-conexao is-pending';
      return;
    }

    switch (estado.status) {
      case 'conectado':
        els.infoRealtimeStatus.textContent = 'Conectado (WebSocket ativo)';
        els.badgeConexao.textContent = 'Conectado';
        els.badgeConexao.className = 'badge badge-conexao is-active';
        break;
      case 'conectando':
        els.infoRealtimeStatus.textContent = 'Conectando...';
        els.badgeConexao.textContent = 'Conectando';
        els.badgeConexao.className = 'badge badge-conexao is-pending';
        break;
      case 'erro':
        els.infoRealtimeStatus.textContent = estado.ultimoErro || 'Erro de conexão';
        els.badgeConexao.textContent = 'Erro';
        els.badgeConexao.className = 'badge badge-conexao is-error';
        break;
      case 'desconectado':
      default:
        els.infoRealtimeStatus.textContent = 'Desconectado';
        els.badgeConexao.textContent = 'Desconectado';
        els.badgeConexao.className = 'badge badge-conexao is-pending';
        break;
    }
  } catch (err) {
    els.infoRealtimeStatus.textContent = 'Erro: ' + err.message;
  }
}

async function reconectarRealtime() {
  els.btnReconectar.disabled = true;
  els.btnReconectar.textContent = 'Reconectando...';

  try {
    await chrome.runtime.sendMessage({ tipo: 'reconectar' });
    await registrarLog('connection', 'Reconexão manual solicitada via UI');
    mostrarToast('Reconexão iniciada', 'info');

    // Aguarda 1.5s e atualiza UI
    setTimeout(async () => {
      await atualizarInfoConexao();
      els.btnReconectar.disabled = false;
      els.btnReconectar.textContent = 'Reconectar Realtime';
    }, 1500);
  } catch (err) {
    mostrarToast('Erro ao reconectar: ' + err.message, 'error');
    els.btnReconectar.disabled = false;
    els.btnReconectar.textContent = 'Reconectar Realtime';
  }
}


// =====================================================
// INIT
// =====================================================

async function init() {
  // 1. Mostra aviso se credenciais não configuradas
  if (!credenciaisConfiguradas()) {
    els.cardCredenciais.hidden = false;
  }

  // 2. Atualiza estado da licença
  await atualizarEstadoLicenca();

  // 3. Carrega valores dos toggles
  await carregarToggles();

  // 4. Atualiza info de conexão e diagnóstico
  await atualizarInfoConexao();
  await atualizarInfoDiagnostico();

  // 5. Registra abertura da página
  await registrarLog('lifecycle', 'Página de opções aberta');

  // 6. Inicia atualização periódica do status Realtime
  iniciarAtualizacaoPeriodica();
}


// =====================================================
// EVENT LISTENERS
// =====================================================

els.btnAtivar.addEventListener('click', ativarLicenca);
els.inputChave.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') ativarLicenca();
});
els.btnDesativar.addEventListener('click', desativarLicenca);

els.toggleOcultar.addEventListener('change', onToggleMudar);
els.toggleContadores.addEventListener('change', onToggleMudar);
els.toggleIniciar.addEventListener('change', onToggleMudar);

els.btnTestarConexao.addEventListener('click', testarConexaoSupabase);
els.btnReconectar.addEventListener('click', reconectarRealtime);
els.btnExportar.addEventListener('click', exportarLogs);
els.btnLimparLogs.addEventListener('click', limparLogs);

// Atualização periódica do status Realtime enquanto a página está aberta
let intervaloAtualizacao = null;
function iniciarAtualizacaoPeriodica() {
  if (intervaloAtualizacao) return;
  intervaloAtualizacao = setInterval(atualizarInfoConexao, 3000);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (intervaloAtualizacao) { clearInterval(intervaloAtualizacao); intervaloAtualizacao = null; }
  } else {
    iniciarAtualizacaoPeriodica();
  }
});

// Escuta mensagens do service worker (mudança de estado)
chrome.runtime.onMessage.addListener((message) => {
  if (message?.tipo === 'estado-mudou' || message?.tipo === 'lista-ocultos-atualizada') {
    atualizarInfoConexao();
    atualizarInfoDiagnostico();
  }
});


// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
