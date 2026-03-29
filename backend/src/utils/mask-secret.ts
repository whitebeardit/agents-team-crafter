/** Mascara segredo para respostas de API (últimos 4 caracteres). */
export function maskSecretValue(value: string, visible = 4): string {
  const v = value.trim();
  if (v.length <= visible) return '****';
  return `${'*'.repeat(Math.min(12, v.length - visible))}…${v.slice(-visible)}`;
}
