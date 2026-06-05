/**
 * Sigma Operator — Storage centralizado
 *
 * Wrapper sobre chrome.storage.sync e chrome.storage.local com chaves
 * tipadas, defaults e helpers para reduzir boilerplate.
 *
 * chrome.storage.sync:
 *   - Sincroniza entre dispositivos do mesmo usuário Chrome (até 100KB total)
 *   - Usado para configurações que devem viajar com o usuário (licença,
 *     toggles de comportamento)
 *
 * chrome.storage.local:
 *   - Fica só na máquina local (até 10MB)
 *   - Usado para dados volumosos ou efêmeros (lista de IDs ocultos,
 *     logs de debug)
 */

/**
 * Chaves usadas em chrome.storage.sync
 * (sincroniza entre dispositivos do mesmo usuário)
 */
export const SYNC_KEYS = {
  // Licença e cliente vinculado
  CHAVE_ATIVACAO: 'chaveAtivacao',
  ID_MONITORAMENTO: 'idMonitoramento',
  NOME_CLIENTE: 'nomeCliente',
  ATIVADO_EM: 'ativadoEm',

  // Toggles de comportamento
  OCULTAR_CARDS: 'ocultarCards',
  MOSTRAR_CONTADORES: 'mostrarContadores',
  INICIAR_ATIVO: 'iniciarAtivo'
};

/**
 * Chaves usadas em chrome.storage.local
 * (fica só na máquina local — dados volumosos ou efêmeros)
 */
export const LOCAL_KEYS = {
  IDS_OCULTOS: 'idsOcultos',        // Array de occurrence_ids a ocultar
  DETALHES_OCULTOS: 'detalhesOcultos', // Mapa {idOccurrence: {nomeCliente, idEmpresa}} — cache para popup
  LOGS_DEBUG: 'logsDebug',          // Array de eventos para exportar
  ULTIMA_CONEXAO: 'ultimaConexao',  // Timestamp da última conexão Realtime
  CONTADOR_EVENTOS: 'contadorEventos'  // Quantos eventos a extensão processou
};

/**
 * Valores default para as configurações.
 */
export const DEFAULTS = {
  [SYNC_KEYS.OCULTAR_CARDS]: true,
  [SYNC_KEYS.MOSTRAR_CONTADORES]: true,
  [SYNC_KEYS.INICIAR_ATIVO]: true
};

/**
 * Lê uma ou várias chaves do storage.sync.
 * Aplica os defaults para chaves não definidas.
 *
 * @param {string|string[]|object} keys - Chave única, array de chaves ou objeto {key: default}
 * @returns {Promise<object>}
 */
export async function lerSync(keys) {
  const result = await chrome.storage.sync.get(keys);

  // Aplica defaults para chaves do array DEFAULTS que vieram undefined
  if (Array.isArray(keys)) {
    for (const k of keys) {
      if (result[k] === undefined && DEFAULTS[k] !== undefined) {
        result[k] = DEFAULTS[k];
      }
    }
  } else if (typeof keys === 'string') {
    if (result[keys] === undefined && DEFAULTS[keys] !== undefined) {
      result[keys] = DEFAULTS[keys];
    }
  }

  return result;
}

/**
 * Salva pares chave/valor no storage.sync.
 * @param {object} items
 */
export async function salvarSync(items) {
  return chrome.storage.sync.set(items);
}

/**
 * Remove chaves do storage.sync.
 * @param {string|string[]} keys
 */
export async function removerSync(keys) {
  return chrome.storage.sync.remove(keys);
}

/**
 * Lê do storage.local.
 * @param {string|string[]|object} keys
 */
export async function lerLocal(keys) {
  return chrome.storage.local.get(keys);
}

/**
 * Salva no storage.local.
 * @param {object} items
 */
export async function salvarLocal(items) {
  return chrome.storage.local.set(items);
}

/**
 * Helper: a extensão está ativada (licença válida salva)?
 * @returns {Promise<boolean>}
 */
export async function estaAtivada() {
  const { chaveAtivacao, idMonitoramento } = await lerSync([
    SYNC_KEYS.CHAVE_ATIVACAO,
    SYNC_KEYS.ID_MONITORAMENTO
  ]);
  return Boolean(chaveAtivacao && idMonitoramento);
}

/**
 * Helper: registra um evento no log de debug (até 500 entradas).
 * @param {string} categoria - Ex: 'auth', 'realtime', 'storage'
 * @param {string} mensagem
 * @param {object} [dados]
 */
export async function registrarLog(categoria, mensagem, dados = null) {
  const { logsDebug = [] } = await lerLocal(LOCAL_KEYS.LOGS_DEBUG);

  const entrada = {
    timestamp: new Date().toISOString(),
    categoria,
    mensagem,
    dados
  };

  logsDebug.push(entrada);

  // Mantém só os últimos 500
  const recortado = logsDebug.slice(-500);
  await salvarLocal({ [LOCAL_KEYS.LOGS_DEBUG]: recortado });

  return entrada;
}
