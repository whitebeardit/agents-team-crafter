# ADR: Tours contextuais — modo spotlight (ancoragem DOM)

## Status

Aceite — Loop 72.

## Contexto

Os tours por ecrã (Loops 67–71) usavam apenas `Dialog` centrado. O produto pede passos opcionalmente **ancorados** a elementos estáveis da UI, com realce (spotlight) e fallback para o modo dialog quando o alvo não existe.

## Decisão

1. **Contrato de passo:** `ContextualTourStep` ganha `anchor?: { kind: "dataAttr" | "selector"; value: string }`. Preferir `dataAttr` mapeado a `[data-tour-anchor="…"]` na UI.
2. **Modo spotlight:** overlay em portal com máscara escura em quatro faixas, buraco alinhado ao `getBoundingClientRect` do alvo (com padding), anel `ring` no perímetro e painel fixo inferior (desktop: canto inferior direito) com copy e mesmos botões de navegação.
3. **Não-modal:** `aria-modal="false"`. O buraco não tem máscara por cima — o utilizador pode interagir com o alvo; a navegação do tour continua explícita pelos botões (e `Escape` faz snooze como «Mais tarde»).
4. **Fallback:** se o alvo não for encontrado após resolução + polling curto, o passo volta ao **modo dialog** existente, sem alterar `contextualTours.byWorkspace`.
5. **Versionamento:** ao introduzir anchor num ecrã, subir `version` do tour naquele `screenKey` para reexibir o auto-tour.

## Consequências

- Elementos condicionais ou layouts muito variáveis exigem `data-tour-anchor` em contentores estáveis (ex.: cartão da lista, grelha de métricas).
- Spotlight amplifica o risco de apontar para DOM errado — mitigação: fallback obrigatório e `tourVersion`.
