import {
  SO_DEMO_TEAM_URL,
  SO_TEAM_EXPORT_PATH,
  SO_TEAM_VALIDATION_PROMPT,
} from './utils.mjs';

export function printSoDemoManualGuide({ demoReachable }) {
  console.log('');
  console.log('=== Próximo passo: time SO · Clínica Gold ===');
  console.log('');
  if (demoReachable === false) {
    console.log('  Aviso: o site demo parece indisponível.');
    console.log(`  Alternativa: importe ${SO_TEAM_EXPORT_PATH} em Times → Importar JSON.`);
    console.log('  Ou execute o wizard de novo e escolha «JSON incluído no assistente».');
    console.log('');
  }
  console.log('1. Abra o demo (login se necessário):');
  console.log(`   ${SO_DEMO_TEAM_URL}`);
  console.log('');
  console.log('2. Na página do time, clique em «Exportar JSON» (export v2).');
  console.log('');
  console.log('3. Na instalação local (http://localhost:3002):');
  console.log('   - Login: admin@whitebeard.dev / Admin123!');
  console.log('   - Menu Times → «Importar JSON»');
  console.log('');
  console.log('4. Abra o time «SO Clínica Conversacional» → aba Debug.');
  console.log('');
  console.log('5. Prompt de validação:');
  console.log(`   ${SO_TEAM_VALIDATION_PROMPT}`);
  console.log('');
}

export function printSoBundledSuccess({ teamId, warnings = [] }) {
  console.log('');
  console.log('=== Time SO · Clínica Gold importado ===');
  console.log('');
  console.log(`  Time:    http://localhost:3002/teams/${teamId}`);
  console.log(`  Origem:  ${SO_TEAM_EXPORT_PATH}`);
  if (warnings.length > 0) {
    console.log('  Avisos:');
    for (const w of warnings) console.log(`    - ${w}`);
  }
  console.log('');
  console.log('  Abra a aba Debug e envie:');
  console.log(`  ${SO_TEAM_VALIDATION_PROMPT}`);
  console.log('');
}
