/**
 * Sigma Operator — Content Script
 * Sub-etapa 3.4 — Ocultação real de cards + recálculo de contadores
 *
 * Toggle ON  → cards do bot ocultos via display:none (sem espaço vazio)
 * Toggle OFF → cards do bot visíveis com design original do Sigma Cloud
 *              (sem nenhuma modificação visual — simples e confiável)
 */

(() => {
  'use strict';

  const STYLE_TAG_ID    = 'sigma-operator-style';
  const DEV_INDICATOR_ID = 'sigma-operator-dev-indicator';
  const DEBOUNCE_MS     = 250;
  const FORMATO_REGEX   = /^(\d+)\s*\(\d+\)$/;
  const NUMERO_REGEX    = /^\d+$/;

  let idsOcultos      = [];
  let ocultarLigado   = true;
  let mostrarContadores = true;
  let conexaoStatus   = 'desconectado';
  let debugMode       = false;

  try { debugMode = !!window.__sigmaDebug; } catch (e) { /* ignora */ }

  console.log('[Sigma Operator] Content script carregado');

  // =====================================================
  // ESTILO DE OCULTAÇÃO
  // =====================================================

  function aplicarEstilo() {
    let styleTag = document.getElementById(STYLE_TAG_ID);
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = STYLE_TAG_ID;
      styleTag.type = 'text/css';
      (document.head || document.documentElement).appendChild(styleTag);
    }

    // Toggle OFF ou lista vazia → remove qualquer CSS que tenhamos injetado
    // Os cards aparecem exatamente como o Sigma Cloud os renderiza
    if (!ocultarLigado || idsOcultos.length === 0) {
      styleTag.textContent = '';
      return;
    }

    // Toggle ON → oculta o container externo de cada card do bot
    // Usar .occurrence-card-main-container:has([data-rbd-draggable-id="X"])
    // garante que o container some completamente (sem espaço de 64px sobrando)
    const seletores = idsOcultos
      .map(id => `.occurrence-card-main-container:has([data-rbd-draggable-id="${cssEscape(id)}"])`)
      .join(',\n');

    styleTag.textContent = `${seletores} { display: none !important; }`;
  }

  function cssEscape(s) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(s);
    }
    return String(s).replace(/[^a-zA-Z0-9_-]/g, c =>
      '\\' + c.charCodeAt(0).toString(16) + ' '
    );
  }

  // =====================================================
  // BADGE Σ — modo override (toggle ocultarCards desligado)
  // =====================================================

  function injetarBadge(idOccurrence) {
    const draggable = document.querySelector(
      `[data-rbd-draggable-id="${idOccurrence}"]`
    );
    if (!draggable) return;

    const container = draggable.querySelector('.occurrence-card-container');
    if (!container) return;
    if (container.querySelector('.sigma-badge')) return;

    const badge = document.createElement('div');
    badge.className = 'sigma-badge';
    badge.textContent = 'Σ';
    badge.setAttribute('aria-label', 'Evento sendo tratado pelo Sigma Operator');
    badge.setAttribute('title', 'Evento sendo tratado pelo Sigma Operator');

    container.classList.add('sigma-badged');
    container.appendChild(badge);
  }

  function removerBadge(idOccurrence) {
    const draggable = document.querySelector(
      `[data-rbd-draggable-id="${idOccurrence}"]`
    );
    if (!draggable) return;

    const badge = draggable.querySelector('.sigma-badge');
    if (badge) badge.remove();

    const container = draggable.querySelector(
      '.occurrence-card-container.sigma-badged'
    );
    if (container) container.classList.remove('sigma-badged');
  }

  function removerTodosBadges() {
    document.querySelectorAll('.sigma-badge').forEach(b => b.remove());
    document.querySelectorAll('.occurrence-card-container.sigma-badged')
      .forEach(c => c.classList.remove('sigma-badged'));
  }

  function aplicarBadges(ids) {
    if (!Array.isArray(ids)) return;
    ids.forEach(id => injetarBadge(id));
  }

  function removerBadgesOrfaos(ids) {
    const set = new Set(Array.isArray(ids) ? ids : []);
    document.querySelectorAll('.sigma-badge').forEach(badge => {
      const draggable = badge.closest('[data-rbd-draggable-id]');
      if (!draggable) return badge.remove();
      const id = draggable.getAttribute('data-rbd-draggable-id');
      if (!set.has(id)) {
        badge.remove();
        const container = draggable.querySelector(
          '.occurrence-card-container.sigma-badged'
        );
        if (container) container.classList.remove('sigma-badged');
      }
    });
  }

  function aplicarBadgesComEstado() {
    if (ocultarLigado) {
      removerTodosBadges();
    } else {
      removerBadgesOrfaos(idsOcultos);
      aplicarBadges(idsOcultos);
    }
  }

  // =====================================================
  // CONTADORES DAS COLUNAS
  // =====================================================

  function recalcularContadores() {
    if (!mostrarContadores) return;

    document.querySelectorAll('[data-rbd-droppable-id]').forEach(coluna => {
      const header = encontrarHeaderDaColuna(coluna);
      if (!header) return;

      const cardsDoDom = coluna.querySelectorAll('[data-rbd-draggable-id]');
      let ocultosNaColuna = 0;
      cardsDoDom.forEach(card => {
        if (idsOcultos.includes(card.getAttribute('data-rbd-draggable-id'))) {
          ocultosNaColuna++;
        }
      });

      const span = header.querySelector('span:last-child');
      if (!span) return;

      const texto = (span.textContent || '').trim();
      let totalReal;

      const matchFormato = texto.match(FORMATO_REGEX);
      if (matchFormato) {
        totalReal = matchFormato[1];
        // Se capturamos "0" mas há cards no DOM: estado transitório, ignora
        if (totalReal === '0' && cardsDoDom.length > 0) {
          delete span.dataset.sigmaOriginal;
          return;
        }
      } else if (NUMERO_REGEX.test(texto)) {
        // Número puro vindo do Sigma Cloud — atualiza referência
        totalReal = texto;
        span.dataset.sigmaOriginal = totalReal;
      } else {
        return; // estado intermediário
      }

      if (totalReal === '0' && cardsDoDom.length > 0) return;

      const novoTexto = `${totalReal} (${ocultosNaColuna})`;
      if (span.textContent !== novoTexto) span.textContent = novoTexto;
    });
  }

  function restaurarContadores() {
    document.querySelectorAll('.kanban-column-header').forEach(header => {
      const span = header.querySelector('span:last-child');
      if (!span) return;
      const match = (span.textContent || '').trim().match(FORMATO_REGEX);
      if (match) span.textContent = match[1];
    });
  }

  function encontrarHeaderDaColuna(droppableEl) {
    let el = droppableEl;
    for (let i = 0; i < 6; i++) {
      const pai = el.parentElement;
      if (!pai) break;
      const h = pai.querySelector(':scope > .kanban-column-header, :scope > * > .kanban-column-header');
      if (h) return h;
      el = pai;
    }
    // Fallback por posição
    const drops   = Array.from(document.querySelectorAll('[data-rbd-droppable-id]'));
    const headers = Array.from(document.querySelectorAll('.kanban-column-header'));
    const idx = drops.indexOf(droppableEl);
    return (idx >= 0 && idx < headers.length) ? headers[idx] : null;
  }

  // =====================================================
  // INDICADOR DE DEV (escondido — ativar via window.__sigmaDebug = true)
  // =====================================================

  function atualizarIndicadorDev() {
    let el = document.getElementById(DEV_INDICATOR_ID);
    if (!debugMode) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = DEV_INDICATOR_ID;
      document.body.appendChild(el);
    }
    const cor = conexaoStatus === 'conectado' ? '#22C55E'
              : conexaoStatus === 'conectando' ? '#F0B400'
              : conexaoStatus === 'erro'       ? '#F54927'
              : '#888888';
    el.textContent = conexaoStatus === 'conectado'
      ? `Σ Conectado · ${idsOcultos.length} oculto${idsOcultos.length !== 1 ? 's' : ''}`
      : `Σ ${conexaoStatus}`;
    el.style.color = cor;
  }

  // =====================================================
  // SINCRONIZAÇÃO COM O STORAGE
  // =====================================================

  async function carregarEstado() {
    try {
      // BUG 5 FIX: verifica licença ANTES de aplicar qualquer ocultação
      // Sem isso, ao desativar a licença os cards continuavam ocultos
      const dadosSync = await chrome.storage.sync.get(['chaveAtivacao', 'ocultarCards', 'mostrarContadores']);
      const licencaAtiva = !!(dadosSync.chaveAtivacao);

      if (!licencaAtiva) {
        // Sem licença: limpa tudo imediatamente
        idsOcultos = [];
        ocultarLigado = false;
        aplicarEstilo();
        restaurarContadores();
        removerTodosBadges();
        return;
      }

      const local = await chrome.storage.local.get(['idsOcultos']);

      idsOcultos      = local.idsOcultos || [];
      ocultarLigado   = dadosSync.ocultarCards      !== false;
      mostrarContadores = dadosSync.mostrarContadores !== false;

      try {
        const r = await chrome.runtime.sendMessage({ tipo: 'get-estado' });
        if (r?.estado?.status) conexaoStatus = r.estado.status;
      } catch (e) { conexaoStatus = 'desconectado'; }

      aplicarTudo();
    } catch (err) {
      console.warn('[Sigma Operator] Erro ao carregar estado:', err);
    }
  }

  function aplicarTudo() {
    aplicarEstilo();
    mostrarContadores ? recalcularContadores() : restaurarContadores();
    atualizarIndicadorDev();
    aplicarBadgesComEstado();
  }

  // =====================================================
  // MUTATIONOBSERVER
  // =====================================================

  let debounce = null;
  function agendarReaplicacao() {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = null;
      if (!document.getElementById(STYLE_TAG_ID)) aplicarEstilo();
      if (mostrarContadores) recalcularContadores();
      aplicarBadgesComEstado();
    }, DEBOUNCE_MS);
  }

  function iniciarObserver() {
    if (!document.body) { setTimeout(iniciarObserver, 100); return; }

    new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'childList' && (m.addedNodes.length || m.removedNodes.length)) {
          agendarReaplicacao(); return;
        }
        if (m.type === 'characterData') {
          agendarReaplicacao(); return;
        }
      }
    }).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    console.log('[Sigma Operator] MutationObserver iniciado');
  }

  // =====================================================
  // LISTENERS
  // =====================================================

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.idsOcultos) {
      idsOcultos = changes.idsOcultos.newValue || [];
      aplicarTudo();
    }
    if (area === 'sync') {
      // Se a chave de ativação foi removida, limpa tudo imediatamente
      if (changes.chaveAtivacao && !changes.chaveAtivacao.newValue) {
        idsOcultos = [];
        ocultarLigado = false;
        aplicarEstilo();
        restaurarContadores();
        removerTodosBadges();
        return;
      }
      if (changes.ocultarCards)      ocultarLigado     = changes.ocultarCards.newValue !== false;
      if (changes.mostrarContadores) mostrarContadores = changes.mostrarContadores.newValue !== false;
      if (changes.ocultarCards || changes.mostrarContadores) aplicarTudo();
    }
  });

  chrome.runtime.onMessage.addListener(msg => {
    if (msg?.tipo === 'lista-ocultos-atualizada' || msg?.tipo === 'estado-mudou') {
      carregarEstado();
    }
  });

  // Tick periódico de segurança
  setInterval(() => {
    if (mostrarContadores) recalcularContadores();
  }, 5000);

  // Verificar modo debug a cada 3s
  setInterval(() => {
    try {
      const nd = !!window.__sigmaDebug;
      if (nd !== debugMode) { debugMode = nd; atualizarIndicadorDev(); }
    } catch (e) { /* ignora */ }
  }, 3000);

  // =====================================================
  // INICIALIZAÇÃO
  // =====================================================

  aplicarEstilo();
  carregarEstado();
  iniciarObserver();

})();
