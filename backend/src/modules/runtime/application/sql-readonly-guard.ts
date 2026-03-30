/** Valida SQL de leitura simples (sem parser SQL completo). */
export function assertReadOnlySelectSql(sqlRaw: string): string {
  const sql = sqlRaw.trim().replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (!sql) throw new Error('SQL vazio');
  const lower = sql.toLowerCase();
  if (!lower.startsWith('select') && !lower.startsWith('with')) {
    throw new Error('Apenas SELECT ou WITH sao permitidos');
  }
  const forbidden =
    /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|execute|call)\b/i;
  if (forbidden.test(sql)) {
    throw new Error('Palavra-chave proibida no SQL');
  }
  const parts = sql.split(';').map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    throw new Error('Apenas uma instrucao SQL por chamada');
  }
  return parts[0] ?? sql;
}
