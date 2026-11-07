export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function toPlainText(value: string | null | undefined, maxLength = 160): string {
  if (!value) return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\\[([^\\]]*)\\]\\([^)]*\\)/g, '$1')
    .replace(/\\[([^\\]]+)\\]\\([^)]*\\)/g, '$1')
    .replace(/\\[[^\\]]+\\]\\([^)]*\\)/g, ' ')
    .replace(/(^|\\s)[#>*_~`]+/g, '$1')
    .replace(/\\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}
