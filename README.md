# Sigma Operator — Extensão Chrome

> Extensão para o Chrome que oculta cards do Sigma Cloud que estão sendo
> tratados pelo Sigma Operator, evitando que operadores humanos atendam
> eventos já em processamento pelo bot.

**Versão atual: 1.0.0 — Sub-etapa 3.4 (Ocultação real de cards) 🎉**

---

## ⚠️ ANTES DE INSTALAR — Configure as credenciais

Edite `lib/config.js` substituindo URL e Anon Key pelos valores reais do
seu projeto Supabase (Settings → API).

> Se você já tinha a 3.3 instalada, basta manter o mesmo `lib/config.js`.

---

## O que esta versão entrega

### ✅ Sub-etapas 3.1, 3.2 e 3.3 (concluídas anteriormente)
Toda a fundação visual, página de opções funcional e conexão Realtime
persistente já estavam funcionando.

### ✅ Sub-etapa 3.4 (esta versão) — A joia da coroa

**Ocultação real dos cards no Sigma Cloud:**
- Cards somem do DOM via tag `<style>` injetada dinamicamente
- Seletor `:has()` esconde o `.occurrence-card-main-container` inteiro
  (não deixa espaço vazio no ReactVirtualized)
- Fade out/in suave de 0.15s ao ocultar/revelar
- Reage em tempo real ao Realtime (~100ms entre INSERT no Supabase e
  card sumindo da tela)

**MutationObserver resistente:**
- Sigma Cloud usa React virtualizado — cards são montados sob demanda
- Observer detecta novos cards no DOM e reaplica a ocultação
- Debounce de 250ms para evitar travamento

**Recálculo dos contadores das colunas:**
- Formato `X (Y)` — X total da coluna, Y ocultos
- Atualiza headers das colunas Novos, Iniciado, Deslocamento, Observação
- Toggle "Mostrar contador" controla aparição
- Recalcula automaticamente via MutationObserver

**Toggle "Ocultar eventos do bot" funcional:**
- ON: cards ocultos (modo produção normal)
- OFF: cards visíveis com marca visual — borda esquerda coral + ícone
  Σ no canto + hover salmão suave. Operador identifica visualmente
  quais cards são do bot sem confundir com eventos reais.

**Popup com lista de eventos ocultos:**
- Mostra os primeiros 5 eventos sendo tratados pelo bot
- Cada item: nome do cliente + idEmpresa em mono
- Badge coral com contagem total
- "E mais N ocultos…" quando há mais que 5
- Atualização em tempo real conforme recebe eventos

**Indicador de desenvolvimento escondido por default:**
- Não polui mais a tela do operador em produção
- Pode ser reativado via console: `window.__sigmaDebug = true`
- Útil para suporte diagnosticar problemas remotamente

**Bug fixes da 3.3:**
- Subscriptions duplicadas: proteção contra chamadas concorrentes
  via flag `conectandoAgora`
- `sub_etapa` no JSON exportado agora reflete "3.4"

---

## Testando a Sub-etapa 3.4

### Teste 1 — Ocultação visual no Sigma Cloud
1. Com licença ativa e conexão Realtime aberta, abra `https://cloud.segware.com.br/`
2. **Esperado:** os cards correspondentes aos `idsOcultos` (em `chrome.storage.local`)
   já estão **invisíveis** quando você abre a tela.
3. Veja os contadores das colunas no formato `X (Y)` — exemplo: `Observação 20 (16)`

### Teste 2 — Ocultação em tempo real
1. Deixe o Sigma Cloud aberto numa coluna que tenha cards visíveis
2. No SQL Editor do Supabase, execute:
   ```sql
   INSERT INTO public."ocultarOcorrencias" (
     "idOccurrence", "nomeCliente", "idEmpresa",
     "idMonitoramento", "visualizar"
   ) VALUES (
     '6a16ced4303c4f1195453c4e', 'TESTE OCULTAR', '9999',
     '0000', false
   );
   ```
   (use um `idOccurrence` que **existe** no DOM atualmente — pode pegar de qualquer card visível)
3. **Esperado em ~100ms:**
   - Card faz fade out
   - Some da coluna
   - Contador da coluna ajusta de `X (Y)` para `X (Y+1)`

### Teste 3 — Revelação em tempo real
1. Com o card ainda na tabela `ocultarOcorrencias`, execute:
   ```sql
   UPDATE public."ocultarOcorrencias"
     SET "visualizar" = true
     WHERE "idOccurrence" = '6a16ced4303c4f1195453c4e';
   ```
2. **Esperado em ~100ms:**
   - Card reaparece com fade in
   - Contador ajusta de `(Y+1)` para `(Y)`

### Teste 4 — Modo override (toggle OFF)
1. Abra o popup da extensão
2. Desligue o toggle "Ocultar eventos do bot"
3. **Esperado:**
   - Todos os cards ocultos **reaparecem**
   - Cards do bot têm **borda esquerda coral** + **ícone Σ no canto direito**
   - Ao passar mouse: background salmão suave (#FEEBE7)
   - Tooltip nativo do Sigma continua funcionando

### Teste 5 — Popup mostra lista
1. Com vários cards ocultos, abra o popup
2. **Esperado:**
   - Seção "EVENTOS SENDO TRATADOS PELO BOT"
   - Badge coral com a contagem total
   - Lista com 5 itens: nome do cliente à esquerda, idEmpresa à direita
   - "E mais N ocultos…" se houver mais

### Teste 6 — Contador desligado
1. Na página de opções, desligue "Mostrar contador de ocultos"
2. **Esperado:** os contadores das colunas voltam ao valor original
   (sem o "(Y)")

### Teste 7 — Indicador de debug
1. No Sigma Cloud, abra DevTools (F12)
2. Console: `window.__sigmaDebug = true`
3. **Esperado em até 3s:** indicador "Σ Conectado · X ocultos" aparece
   no canto inferior direito
4. Para desligar: `window.__sigmaDebug = false`

### Teste 8 — JSON exportado
1. Página de opções → Exportar logs
2. Abra o JSON
3. **Esperado:** `"sub_etapa": "3.4"`

---

## Como inspecionar logs

| Camada | Como inspecionar |
|---|---|
| Service worker | `chrome://extensions/` → "Inspecionar service worker" |
| Popup | Clique direito no popup → "Inspecionar" |
| Content script | F12 na aba do Sigma Cloud |
| Options page | F12 na aba de opções |

---

## Arquitetura técnica da 3.4

### Por que `.occurrence-card-main-container`?
Esse é o container externo que o ReactVirtualized usa para posicionar
absolutamente cada card. Se ocultássemos só o `[data-rbd-draggable-id]`,
o container externo deixaria 64px de espaço em branco entre os cards.

### Por que `:has()`?
O seletor `.occurrence-card-main-container:has([data-rbd-draggable-id="X"])`
permite ocultar o container externo baseado no ID do card interno —
sem precisar adicionar classes via JS. Suportado em Chrome 105+ (todos os
Chromes modernos).

### Por que tag `<style>` injetada (em vez de inline styles via JS)?
- Performance: o browser aplica a regra CSS uma vez para todos os elementos
- Resiliência: nova tela vinda do ReactVirtualized já aparece oculta sem
  precisar JS rodar
- Manutenção: alterar a ocultação é só atualizar `textContent` da tag

### Por que MutationObserver com debounce?
- React virtualizado faz dezenas de mutações por segundo
- Sem debounce, recalcularíamos contadores 60+ vezes/segundo
- Debounce de 250ms agrupa mudanças e recalcula uma vez

---

## Próximos passos sugeridos (pós-3.4)

Com a 3.4 entregue, a extensão está **completa para uso em produção**. Sugestões para versões futuras:

- **3.5** — Empacotamento como `.crx` assinado para distribuição privada
- **3.6** — Dashboard administrativo para gerenciar licenças
- **3.7** — Histórico de cards ocultados (auditoria)
- **3.8** — Suporte a múltiplos `idMonitoramento` (operador com acesso a vários clientes)

---

*Team Everest · teameverest.com.br · Maio 2026*
