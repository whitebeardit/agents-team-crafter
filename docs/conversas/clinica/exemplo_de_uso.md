# Exemplo de uso — SO Clínica Conversacional (roteiro de diálogo)

**Meta:** Roteiro para teste manual no Debug Console do MyTeams.  
**Ambiente alvo:** produção — `https://myteams.whitebeard.dev`  
**Time:** SO Clínica Conversacional (`69f25e827342cb4bd0dc7ba3`)  
**Data do roteiro:** 2026-05-09  
**Persona:** Psicóloga dona da clínica, usuária casual, fala com o agente como se fosse a secretária (sem termos técnicos nem IDs internos).

**Paciente fictícia:** Helena Moura — telefone **(11) 97777-8899** (formato humano; o sistema normaliza).  
**Pacote:** 3 sessões no “pacote padrão” (quantidade explícita para o teste fechar o ciclo mais rápido).

---

## Diálogo (turnos)

### Abertura

**Usuária:** Oi, bom dia. Sou a dona da clínica e nunca usei vocês pelo Telegram. Preciso de ajuda pra organizar uma paciente nova do começo ao fim, tá?

**Agente (esperado):** Saudação; explicar que pode ajudar com cadastro, pacotes, agenda, prontuário e financeiro; pedir dados ou oferecer menu guiado (“Posso seguir com: …”).

---

### Cadastro

**Usuária:** Então, cadastra pra mim a Helena Moura. O telefone dela é onze nove sete sete sete sete oito oito nove nove.

**Agente (esperado):** Confirmar nome e telefone normalizado; usar tool de paciente (`clinic_create_patient` ou equivalente); não pedir `partyId` / IDs internos; confirmar persistência com verificação.

---

### Venda de pacote

**Usuária:** Perfeito. Agora eu quero vender pra ela um pacote com **três sessões**, pode ser o pacote padrão mesmo.

**Agente (esperado):** Vender pacote com `unitsTotal: 3`; confirmar nome do pacote e saldo restante (3).

---

### Primeiro agendamento

**Usuária:** Marca a primeira sessão **amanhã às 15h** pra ela, por favor.

**Agente (esperado):** Resolver “amanhã” em `America/Sao_Paulo`; agendar com telefone da Helena; confirmar horário local e que há pacote com saldo.

---

### Após a primeira sessão — registro + evolução / anamnese

**Usuária:** A consulta de amanhã às 15h já rolou. Registra o atendimento: ela chegou com ansiedade forte e dor no peito. Na evolução coloca que a gente trabalhou respiração e ela saiu mais calma.

**Agente (esperado):** Registrar atendimento pelo telefone + data/hora (`clinic_register_attendance_by_phone_and_time` ou fluxo equivalente); consumir 1 sessão do pacote; confirmar saldo (2 restantes). Se o fluxo separar anamnese, pode pedir texto da anamnese ou registrar junto conforme regra da tool.

**Usuária (opcional, se o agente pedir anamnese à parte):** Pode colocar na anamnese que não tem alergia a remédio, histórico familiar de ansiedade, e que ela faz uso eventual de calmante com receita.

---

### Segunda sessão — agendar

**Usuária:** Agenda a próxima sessão dela pra **daqui a três dias às 16h**.

**Agente (esperado):** Agendar com data relativa; saldo após agendar ainda refletindo consumo anterior (2 usadas no fim do ciclo só após novo registro — aqui ainda 1 usada, 2 restantes até registrar a 2ª).

---

### Segunda sessão — registro

**Usuária:** A de três dias às 16h já aconteceu. Fecha o atendimento: queixa de insônia, evolução dizendo que iniciamos diário do sono.

**Agente (esperado):** Registrar; saldo 1 restante.

---

### Terceira sessão — agendar e registrar (esgotar pacote)

**Usuária:** Última sessão do pacote: marca **sexta que vem às 9 da manhã**.

**Agente (esperado):** Agendar; confirmar que é a última sessão planejada com saldo 1.

**Usuária:** Já fizemos a de sexta às 9h. Registra: evolução final com alta planejada e encaminhamento pra grupo.

**Agente (esperado):** Registrar atendimento; **saldo zero** no pacote; não permitir novo agendamento sem novo pacote ou avisar explicitamente.

---

### Financeiro — conferência ao longo do ciclo e fechamento

**Usuária:** Me tira uma dúvida financeira: quanto eu tenho **a receber** dessa paciente no total desse pacote de três sessões?

**Agente (esperado):** Resposta coerente com modelo financeiro (recebíveis / preço do pacote se cadastrado). Se o sistema não tiver preço no pacote “padrão”, deve explicar ou orientar lançamento (`clinic_create_receivable_for_session` / conferência em resumo).

**Usuária:** E quanto já **entrou de fato**? Tem algum pagamento pendente pra eu confirmar?

**Agente (esperado):** Resumo (`clinic_get_patient_financial_summary` ou snapshot); listar pendências; se houver recebível em aberto, orientar confirmação de pagamento pelas tools financeiras disponíveis.

**Usuária:** Me confirma o **total de sessões já usadas** dela nesse pacote e quantos **pacotes ativos** ela tem agora.

**Agente (esperado):** 3 sessões usadas; pacotes ativos = 0 com saldo ou lista explícita dos pacotes e `remaining`.

**Usuária:** Quero ver se **fecha tudo**: sessões, agenda e dinheiro batem. Me dá um resumo geral dela.

**Agente (esperado):** `clinic_get_patient_full_snapshot` ou equivalente; warnings se houver inconsistência; menu próximo passo (novo pacote, alta, etc.).

---

## Notas para quem testa

- Não informar IDs internos ao agente; só nome e telefone quando precisar relembrar qual paciente.
- Se o Console usar **outra data “hoje”** que a do mundo real, ajustar as expressões (“amanhã”, “daqui a três dias”) para o equivalente no calendário de teste.
- Evitar conflito de horário na agenda do workspace (outros agendamentos no mesmo slot).
