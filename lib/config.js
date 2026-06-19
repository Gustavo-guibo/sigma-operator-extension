/**
 * Sigma Operator — Configuração central
 *
 * IMPORTANTE: Antes de carregar a extensão no Chrome, substitua os valores
 * abaixo pela URL e Anon Key reais do seu projeto Supabase.
 *
 * Onde encontrar:
 *   1. Acesse o painel do Supabase: https://supabase.com/dashboard
 *   2. Selecione seu projeto
 *   3. Vá em Settings > API
 *   4. Copie "Project URL" e "anon public" key
 *
 * Por que está em arquivo separado:
 *   - Permite trocar credenciais sem mexer no código da lógica
 *   - Facilita atualizações futuras da extensão (basta preservar este arquivo)
 *
 * SEGURANÇA:
 *   A anon key é desenhada para ficar em código de front-end (browser).
 *   Ela respeita as políticas RLS da tabela. Quem extrair essa key da
 *   extensão só conseguirá ler dados do próprio idMonitoramento configurado
 *   (graças ao header x-monitoramento-id + RLS).
 *
 *   A service_role key NUNCA deve ir aqui — ela ignora RLS.
 */

export const SUPABASE_URL = 'https://uhwqgvyycvqtlmqmyxcy.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVod3Fndnl5Y3ZxdGxtcW15eGN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkxMzgzMjgsImV4cCI6MjA2NDcxNDMyOH0.bu3Rf_TvI9-nWiFAGhjDCAgeR5O3PaT2ZUdgsk7Uu8Q';

/**
 * Versão da extensão (sincronizada com o manifest.json).
 * Usado em headers de request e nos logs exportados.
 */
export const EXTENSION_VERSION = '1.2.0';

/**
 * Nome do produto e do fornecedor.
 * Aparece em vários lugares na UI.
 */
export const PRODUCT_NAME = 'Sigma Operator';
export const VENDOR_NAME = 'Team Everest';
export const VENDOR_URL = 'teameverest.com.br';
