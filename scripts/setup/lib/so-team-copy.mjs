/** Copy partilhado sobre importação do time SO · Clínica Gold (wizard, pós-setup, docs). */

export const SO_TEAM_NAME = 'SO Clínica Conversacional';

/** Alinhado com assertSoTeamExportShape em utils.mjs */
export const SO_TEAM_AGENT_COUNT = 7;

export function printSoTeamIntro() {
  console.log('');
  console.log(
    `  Recomendamos importar um time de demonstração com ${SO_TEAM_AGENT_COUNT} agentes (coordenadora + especialistas).`,
  );
  console.log(
    `  O time «${SO_TEAM_NAME}» usa internal actions (clinic_*) — ferramentas de negócio que mostram`,
  );
  console.log(
    '  orquestração, contexto clínico e delegação entre especialistas.',
  );
  console.log(
    '  É a forma mais rápida de ver a plataforma a funcionar com tools reais',
  );
  console.log('  (ex.: cadastro de paciente, agenda, CRM clínico).');
}

export function printSoTeamSharingHint() {
  console.log('');
  console.log(
    '  Depois pode criar o seu próprio time na UI, exportar JSON (detalhe do time → «Exportar JSON»)',
  );
  console.log('  e importar noutro workspace ou noutra instalação TeamAgents.');
}

/** Versão curta para mensagem final / pós-setup (sem repetir o bloco completo). */
export function printSoTeamSharingHintBrief() {
  console.log(
    '  Tip: exporte/importe JSON para partilhar times entre workspaces ou instalações.',
  );
}

/** Resumo para guias pós-setup (bundled / demo-manual). */
export function printSoTeamValueBrief() {
  console.log(
    `  Time demo com ${SO_TEAM_AGENT_COUNT} agentes e internal actions clinic_* activas.`,
  );
}

export function soTeamConfirmPrompt() {
  return `Importar o time demo recomendado (${SO_TEAM_AGENT_COUNT} agentes) após a instalação?`;
}
