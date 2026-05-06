# Second-brain UX harmonization — QA e rollout

## Critérios de aceite (regressão)

- Lista em `/agents/:id` (aba Second-brain) carrega sem depender de «Memória persistente» ligada.
- Estados vazios distinguem: sem permissão (403), falha de rede/outros erros, e lista vazia após carregamento com sucesso.
- Copy explica escopo **local (agente)** vs **workspace** e liga à Memória do time com `vaultAgent` / `vaultParty` preservados.
- `/settings` com `vaultNote`, `vaultParty` ou `vaultAgent` na query abre a aba **Workspace** (Memória do time visível).
- «Ver no agente» na Memória do time abre `/agents/:id?vaultTab=vault&vaultNote=…` (e `vaultParty` quando existir).

## Cenários manuais sugeridos

1. **Workspace sem notas**  
   Abrir Second-brain no agente e Memória do time em Settings; confirmar mensagens de vazio coerentes e CTA para a outra tela.

2. **Notas `proposed` e `active`**  
   Confirmar listagem, aprovar/rejeitar em Settings, editar no agente; deep links com scroll quando `vaultNote` presente.

3. **Navegação cruzada**  
   Desde o agente: «Abrir Memória do time (mesmos filtros)» → URL com `tab=workspace&vaultAgent=…`.  
   Desde Settings: «Ver no agente» → URL com `vaultTab=vault` e nota.

## Rollout (2 PRs lógicos)

- **PR1 (feito neste conjunto):** contrato `lib/vault/ui-state.ts`, copy, empty states, deep links, `vaultAgent` em Settings, aba forçada com deep link.
- **PR2 (opcional):** filtros avançados (ex.: cruzar `party` + `agentId` no backend se necessário), mais testes de componente React.

## Testes automatizados

```bash
cd v0-team-ai-crafter && npm test
```

Inclui `lib/vault/ui-state.test.ts` (URLs e copy de empty state).
