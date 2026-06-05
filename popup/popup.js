/**
 * Sigma Operator — Popup Script
 * Sub-etapa 3.4 — Lista de eventos ocultos em tempo real
 */

import {
  SYNC_KEYS,
  LOCAL_KEYS,
  DEFAULTS,
  lerSync,
  lerLocal,
  salvarSync,
  estaAtivada,
  registrarLog
} from '../lib/storage.js';

console.log('[Sigma Operator] Popup carregado');

const $ = (id) => document.getElementById(id);

const els = {
  brandSubtitle: $('brand-subtitle'),

  semLicenca: $('sem-licenca'),
  btnConfigurar: $('btn-configurar'),

  comLicenca: $('com-licenca'),
  statusDot: $('status-dot'),
  statusTitle: $('status-title'),
  statusSubtitle: $('status-subtitle'),
  toggleOcultar: $('toggle-ocultar'),
  toggleSubtitle: $('toggle-subtitle'),

  // Lista de ocultos
  ocultosSection: $('ocultos-section'),
  ocultosCount: $('ocultos-count'),
  ocultosList: $('ocultos-list'),
  ocultosMais: $('ocultos-mais'),
  ocultosEmpty: $('ocultos-empty'),

  infoCliente: $('info-cliente'),
  infoMonitoramento: $('info-monitoramento'),

  btnOptions: $('btn-options'),
  btnOpenOptions: $('btn-open-options')
};

const MAX_OCULTOS_VISIVEIS = 5;

// =====================================================
// RENDER PRINCIPAL
// =====================================================

async function renderizar() {
  const ativada = await estaAtivada();

  if (!ativada) {
    els.semLicenca.hidden = false;
    els.comLicenca.hidden = true;
    els.brandSubtitle.textContent = 'Não ativada';
    return;
  }

  const dados = await lerSync([
    SYNC_KEYS.NOME_CLIENTE,
    SYNC_KEYS.ID_MONITORAMENTO,
    SYNC_KEYS.OCULTAR_CARDS
  ]);

  els.semLicenca.hidden = true;
  els.comLicenca.hidden = false;

  els.brandSubtitle.textContent = dados.nomeCliente || 'Sem nome';
  els.infoCliente.textContent = dados.nomeCliente || '—';
  els.infoMonitoramento.textContent = dados.idMonitoramento || '—';
  els.toggleOcultar.checked = dados.ocultarCards ?? DEFAULTS.ocultarCards;

  await atualizarStatusConexao();
  await atualizarListaOcultos();
}

/**
 * Atualiza o status badge (conectado/desconectado/erro).
 */
async function atualizarStatusConexao() {
  try {
    const resposta = await chrome.runtime.sendMessage({ tipo: 'get-estado' });
    const estado = resposta?.estado;

    if (!estado) {
      atualizarBadge('error', 'Sem resposta', 'Service worker não respondeu');
      return;
    }

    switch (estado.status) {
      case 'conectado':
        atualizarBadge('active', 'Conectado e protegendo', 'Recebendo eventos em tempo real');
        break;
      case 'conectando':
        atualizarBadge('pending', 'Conectando...', 'Estabelecendo conexão Realtime');
        break;
      case 'erro':
        atualizarBadge('error', 'Erro de conexão', estado.ultimoErro || 'Tentando reconectar');
        break;
      case 'desconectado':
      default:
        atualizarBadge('pending', 'Desconectado', 'Aguardando conexão');
        break;
    }
  } catch (err) {
    atualizarBadge('error', 'Erro', err.message);
  }
}

function atualizarBadge(tipo, titulo, subtitulo) {
  els.statusDot.className = 'status-dot is-' + tipo;
  els.statusTitle.textContent = titulo;
  els.statusSubtitle.textContent = subtitulo;
}

/**
 * Busca a lista de eventos ocultos no momento e renderiza
 * usando nome do cliente + idEmpresa vindos do cache do service worker.
 */
async function atualizarListaOcultos() {
  const local = await lerLocal([LOCAL_KEYS.IDS_OCULTOS]);
  const ids = local.idsOcultos || [];
  const total = ids.length;

  // Atualiza o badge de contagem
  els.ocultosCount.textContent = String(total);

  // Limpa lista atual
  els.ocultosList.innerHTML = '';

  if (total === 0) {
    els.ocultosList.hidden = true;
    els.ocultosMais.hidden = true;
    els.ocultosEmpty.hidden = false;
    return;
  }

  els.ocultosList.hidden = false;
  els.ocultosEmpty.hidden = true;

  // Pede os detalhes (nomeCliente + idEmpresa) ao service worker
  // para os primeiros N IDs
  const idsVisiveis = ids.slice(0, MAX_OCULTOS_VISIVEIS);
  let detalhes = [];
  try {
    const resp = await chrome.runtime.sendMessage({
      tipo: 'get-detalhes-ocultos',
      ids: idsVisiveis
    });
    if (resp?.ok && resp.detalhes) {
      detalhes = resp.detalhes;
    }
  } catch (e) {
    // Fallback: mostra só os IDs se o service worker não responder
    detalhes = idsVisiveis.map(id => ({ idOccurrence: id, nomeCliente: id.slice(0, 12) + '...', idEmpresa: '—' }));
  }

  // Renderiza cada item
  detalhes.forEach(item => {
    const li = document.createElement('li');

    const nome = document.createElement('span');
    nome.className = 'ocultos-nome';
    nome.textContent = item.nomeCliente || '—';
    nome.title = item.nomeCliente || '';

    const empresa = document.createElement('span');
    empresa.className = 'ocultos-empresa';
    empresa.textContent = item.idEmpresa || '—';

    li.appendChild(nome);
    li.appendChild(empresa);
    els.ocultosList.appendChild(li);
  });

  // Indica quantos a mais existem além dos visíveis
  const restante = total - idsVisiveis.length;
  if (restante > 0) {
    els.ocultosMais.hidden = false;
    els.ocultosMais.textContent = `E mais ${restante} ${restante === 1 ? 'oculto' : 'ocultos'}…`;
  } else {
    els.ocultosMais.hidden = true;
  }
}

// =====================================================
// LISTENERS
// =====================================================

els.toggleOcultar.addEventListener('change', async (evt) => {
  const valor = evt.target.checked;
  await salvarSync({ [SYNC_KEYS.OCULTAR_CARDS]: valor });
  await registrarLog('config', `Toggle ocultar alterado via popup: ${valor}`);
});

function abrirOpcoes() {
  chrome.runtime.openOptionsPage();
  window.close();
}

els.btnConfigurar.addEventListener('click', abrirOpcoes);
els.btnOptions.addEventListener('click', abrirOpcoes);
els.btnOpenOptions.addEventListener('click', abrirOpcoes);

// Recebe atualizações do service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message?.tipo === 'estado-mudou' || message?.tipo === 'lista-ocultos-atualizada') {
    atualizarStatusConexao();
    atualizarListaOcultos();
  }
});

// Atualiza periodicamente enquanto o popup está aberto (a cada 2s)
let intervalo = null;
function iniciarAtualizacaoPeriodica() {
  if (intervalo) return;
  intervalo = setInterval(async () => {
    await atualizarStatusConexao();
    await atualizarListaOcultos();
  }, 2000);
}
function pararAtualizacaoPeriodica() {
  if (intervalo) {
    clearInterval(intervalo);
    intervalo = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pararAtualizacaoPeriodica();
  else iniciarAtualizacaoPeriodica();
});

renderizar();
iniciarAtualizacaoPeriodica();
