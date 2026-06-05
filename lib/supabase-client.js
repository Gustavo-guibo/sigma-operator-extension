/**
 * Sigma Operator — Cliente REST minimalista para Supabase
 *
 * Esta sub-etapa (3.2) não precisa de WebSocket Realtime ainda — só de
 * chamadas REST simples para validar licença. Por isso, em vez de carregar
 * a SDK completa do Supabase (~50KB), implementamos só o que precisamos.
 *
 * A SDK completa entra na Sub-etapa 3.3, quando o service worker precisar
 * de conexão Realtime persistente.
 *
 * Endpoints REST do Supabase seguem o padrão PostgREST:
 *   GET    /rest/v1/{tabela}?coluna=eq.{valor}
 *   POST   /rest/v1/{tabela}
 *   PATCH  /rest/v1/{tabela}?coluna=eq.{valor}
 *   DELETE /rest/v1/{tabela}?coluna=eq.{valor}
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

/**
 * Verifica se as credenciais foram configuradas.
 * @returns {boolean}
 */
export function credenciaisConfiguradas() {
  return (
    SUPABASE_URL &&
    SUPABASE_URL !== 'COLE_AQUI_SUA_URL_DO_SUPABASE' &&
    SUPABASE_ANON_KEY &&
    SUPABASE_ANON_KEY !== 'COLE_AQUI_SUA_ANON_KEY'
  );
}

/**
 * Headers padrão para todas as requests ao Supabase.
 * @param {object} extras - Headers adicionais (ex: x-monitoramento-id)
 */
function headersPadrao(extras = {}) {
  return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...extras
  };
}

/**
 * Faz uma query SELECT em uma tabela do Supabase.
 *
 * @param {string} tabela - Nome da tabela (ex: 'clientesLicencas')
 * @param {object} filtros - Pares coluna/valor para filtrar (ex: { ativo: true })
 * @param {object} opcoes - Opções extras
 * @param {string[]} opcoes.colunas - Colunas a retornar (default: todas com '*')
 * @param {string} opcoes.idMonitoramento - Se informado, envia o header x-monitoramento-id (usado pela política RLS)
 * @returns {Promise<{ok: boolean, data: any[]|null, error: string|null, status: number}>}
 */
export async function selecionar(tabela, filtros = {}, opcoes = {}) {
  if (!credenciaisConfiguradas()) {
    return {
      ok: false,
      data: null,
      error: 'Credenciais do Supabase não configuradas em lib/config.js',
      status: 0
    };
  }

  const colunas = opcoes.colunas ? opcoes.colunas.join(',') : '*';
  const params = new URLSearchParams();
  params.set('select', colunas);

  for (const [coluna, valor] of Object.entries(filtros)) {
    params.set(coluna, `eq.${valor}`);
  }

  const url = `${SUPABASE_URL}/rest/v1/${tabela}?${params.toString()}`;
  const extras = {};
  if (opcoes.idMonitoramento) {
    extras['x-monitoramento-id'] = opcoes.idMonitoramento;
  }

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: headersPadrao(extras)
    });

    const status = resp.status;
    if (!resp.ok) {
      const texto = await resp.text();
      return {
        ok: false,
        data: null,
        error: `Erro HTTP ${status}: ${texto}`,
        status
      };
    }

    const data = await resp.json();
    return { ok: true, data, error: null, status };

  } catch (err) {
    return {
      ok: false,
      data: null,
      error: `Falha de rede: ${err.message}`,
      status: 0
    };
  }
}

/**
 * Testa a conexão com o Supabase fazendo uma query inofensiva na tabela
 * clientesLicencas com um filtro impossível (limit=0).
 *
 * Por que não bater na raiz (/rest/v1/)?
 *   Alguns projetos Supabase rejeitam GET na raiz com 401 mesmo com
 *   anon key válida (depende da configuração). Usar uma tabela real
 *   é mais confiável e ainda valida que o RLS está respondendo corretamente.
 *
 * @returns {Promise<{ok: boolean, latencia_ms: number, error: string|null}>}
 */
export async function testarConexao() {
  if (!credenciaisConfiguradas()) {
    return {
      ok: false,
      latencia_ms: 0,
      error: 'Credenciais não configuradas'
    };
  }

  const inicio = Date.now();
  try {
    // Query inofensiva: pede 0 linhas da clientesLicencas
    // Se o anon key estiver correto e a tabela existir, retorna 200 com []
    const url = `${SUPABASE_URL}/rest/v1/clientesLicencas?select=chaveAtivacao&limit=0`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: headersPadrao()
    });
    const latencia_ms = Date.now() - inicio;

    if (!resp.ok) {
      const texto = await resp.text();
      return {
        ok: false,
        latencia_ms,
        error: `HTTP ${resp.status}: ${texto.slice(0, 120)}`
      };
    }

    return { ok: true, latencia_ms, error: null };

  } catch (err) {
    return {
      ok: false,
      latencia_ms: Date.now() - inicio,
      error: err.message
    };
  }
}
