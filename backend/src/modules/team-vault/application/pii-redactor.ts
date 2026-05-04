/** Redact common PII patterns before persisting vault notes. */
export function redactPii(text: string): string {
  let s = text;
  s = s.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]');
  s = s.replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[CNPJ]');
  s = s.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/gi, '[EMAIL]');
  s = s.replace(/\+?\d[\d\s().-]{8,}\d/g, '[PHONE]');
  s = s.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]');
  return s;
}
