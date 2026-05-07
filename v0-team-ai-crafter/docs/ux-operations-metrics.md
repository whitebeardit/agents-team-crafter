# UX operacional em produção

Este guia define métricas objetivas para acompanhar UX de operadores não técnicos em produção, com foco em eficiência operacional.

## Funis críticos

### 1) Colocar time em produção
- Início: acesso a `teams/create`.
- Etapas esperadas: criar time, associar canal, validar integração, publicar.
- Conversão alvo: >= 80% das tentativas finalizam em publicação.

### 2) Configurar canal com sucesso
- Início: ação `Criar canal`.
- Sucesso: teste de canal retorna status OK.
- Conversão alvo: >= 85% sem suporte humano.

### 3) Operar e resolver pendência
- Início: clique em pendência no dashboard.
- Sucesso: pendência muda de estado (resolvida/sem alerta) em até 10 minutos.

## Indicadores de UX (KPI)

- `time_to_first_team_live_minutes`: tempo entre abrir criação e primeiro time publicado.
- `channel_setup_success_rate`: taxa de canal criado + testado com sucesso.
- `wizard_abandon_rate`: abandono no fluxo de criação de time.
- `double_action_rate`: cliques repetidos em ações críticas em menos de 3s.
- `navigation_backtrack_rate`: sequências com ida/volta repetida entre páginas de configuração.
- `support_trigger_rate`: erros que levam usuário a abrir suporte.

## Eventos recomendados no frontend

- `teams_create_started`
- `teams_create_step_completed`
- `teams_create_published`
- `channels_create_started`
- `channels_config_opened`
- `channels_test_succeeded`
- `channels_test_failed`
- `dashboard_alert_opened`
- `dashboard_alert_resolved`

## Segmentação mínima

- Workspace.
- Perfil de usuário (operador, analista, admin).
- Canal/plataforma.
- Tipo de fluxo (assistido, template, guiado).
- Ambiente (staging, produção).

## Roadmap de instrumentação

### Onda A (1 sprint)
- Medir funis de criação de time e configuração de canais.
- Publicar painel com conversão e abandono por etapa.

### Onda B (1 sprint)
- Medir retrabalho (cliques repetidos, erros recorrentes, retorno à mesma etapa).
- Alertas de regressão quando KPI cair abaixo do baseline.

### Onda C (contínuo)
- Relatório quinzenal de UX operacional com top 5 fricções reais.
- Priorizar backlog com base em impacto por workspace e frequência.
