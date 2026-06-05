# Pasta lib/

Módulos compartilhados entre as camadas da extensão.

## Arquivos

### `config.js`
Configurações centrais da extensão. **Você precisa editar este arquivo**
para preencher a URL e Anon Key do Supabase antes de carregar a extensão.

### `storage.js`
Wrapper centralizado de `chrome.storage.sync` e `chrome.storage.local`
com chaves tipadas, defaults e helpers.

### `supabase-client.js`
Cliente REST minimalista para Supabase. Implementa apenas o que é
necessário nesta sub-etapa (SELECT na tabela `clientesLicencas` e
GET de teste de conexão).

A SDK completa do Supabase será adicionada na Sub-etapa 3.3, quando
precisarmos de WebSocket Realtime persistente.

## Por que arquitetar assim

- **Manutenibilidade:** trocar credenciais não exige mexer em lógica
- **Performance:** REST simples é mais leve que SDK completa (~50KB)
- **Testabilidade:** módulos isolados podem ser testados sem mock do Chrome
