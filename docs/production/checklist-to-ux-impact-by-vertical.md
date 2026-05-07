# Mapa checklist -> impacto de UX por vertical

Objetivo: mostrar como cada item de gate operacional melhora a experiencia real de quem usa a plataforma/agentes.

## CRM

- Deduplicacao assistida ativa -> evita contatos duplicados e respostas conflitantes na busca de cliente.
- Auditoria de alteracao critica -> reduz perda silenciosa de dados e aumenta confianca em edicoes.
- Smoke CRM aprovado no ciclo -> diminui falhas em cadastro/consulta/atualizacao durante uso diario.
- Owner aprova promocao -> acelera resposta quando ha incidente percebido pelo usuario.

## Agenda/Scheduling

- Rotina diaria completa validada -> reduz erro em confirmar/reagendar/no-show/concluir.
- Evidencia por turno registrada -> acelera diagnostico de falha sem pedir repeticao ao usuario.
- Smoke da agenda aprovado no ciclo -> aumenta taxa de sucesso em operacoes de agenda.
- Owner aprova promocao -> garante resposta rapida para instabilidade de agenda.

## Atendimento

- Escopo de atendimento validado -> evita fluxo confuso sobre onde comeca e termina a sessao.
- Fechamento consistente `appointment`/`encounter` -> reduz atendimento "incompleto" na visao do usuario.
- Smoke de atendimento aprovado -> menos erros no registro final da sessao.
- Owner aprova promocao -> correcoes mais rapidas em problemas de fechamento.

## Pacotes

- Elegibilidade e saldo validados -> evita vender/agendar com pacote invalido.
- Consumo idempotente comprovado -> impede consumo duplicado de sessao.
- Smoke de pacotes aprovado -> reduz divergencia entre saldo mostrado e saldo real.
- Owner aprova promocao -> tratamento mais rapido de divergencia de consumo.

## Financeiros

- Confirmacao obrigatoria em risco -> evita baixas indevidas por clique acidental.
- Baixa/conciliacao com evidencia -> aumenta confianca no historico financeiro exibido.
- Smoke financeiro aprovado -> reduz erro em cobranca e pagamento.
- Owner aprova promocao -> reduz tempo de resolucao de falha financeira.

## Care

- Fronteira Care vs CRM validada -> evita misturar contato com sujeito de cuidado no fluxo.
- Integridade `partyId`/`careSubjectId` aprovada -> reduz troca de paciente/sujeito por engano.
- Smoke de care aprovado -> melhora consistencia das informacoes de cuidado.
- Owner aprova promocao -> acelera correcao de vinculo incorreto.

## Clinical

- Clinic-first aplicado -> reduz friccao de pedir IDs tecnicos ao usuario humano.
- Continuidade de contexto validada -> evita repetir dados do paciente a cada passo.
- Regressao S1-S5 aprovada -> aumenta estabilidade da jornada clinica ponta a ponta.
- Owner aprova promocao -> resposta mais rapida em incidente clinico.

## Lembretes

- Fluxo criar/listar/concluir/cancelar validado -> reduz lembrete "sumido" ou com estado incorreto.
- Sem conflito com agenda/atendimento -> evita duplicidade e contradicao de compromisso.
- Smoke de lembretes aprovado -> melhora confiabilidade da rotina diaria.
- Owner aprova promocao -> correcao rapida em falhas de notificacao/estado.

## Leitura executiva

- Checklist operacional robusto melhora UX porque reduz erro visivel, retrabalho e incerteza.
- Owner definido melhora UX porque reduz tempo de resposta em incidentes que o usuario percebe.
- `hold -> go` com criterio objetivo protege o usuario de regressao em producao.

