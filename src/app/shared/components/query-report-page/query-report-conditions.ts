import type { QueryReportCondition, QueryReportRow } from '../../types/query-report.types';

/** Un monto con miles, una fecha o un texto: si ambos lados parecen números, compara numérico; si no, como texto. */
const comparar = (a: string, b: string): number => {
  const numA = parseFloat(a.replace(/[^\d.-]/g, ''));
  const numB = parseFloat(b.replace(/[^\d.-]/g, ''));
  if (a.trim() !== '' && b.trim() !== '' && Number.isFinite(numA) && Number.isFinite(numB)) {
    return numA - numB;
  }
  return a.localeCompare(b, 'es', { sensitivity: 'base' });
};

/** ¿La fila cumple esta condición de «Filtros avanzados» (Figma nodo 4663:59398)? */
export function cumpleCondicion(fila: QueryReportRow, condicion: QueryReportCondition): boolean {
  const valorFila = fila[condicion.field] ?? '';

  if (condicion.operator === 'empty') return valorFila.trim() === '';
  if (condicion.operator === 'notEmpty') return valorFila.trim() !== '';

  if (condicion.operator === 'between') {
    if (!condicion.value || !condicion.valueTo) return true;
    return comparar(valorFila, condicion.value) >= 0 && comparar(valorFila, condicion.valueTo) <= 0;
  }

  if (!condicion.value) return true;
  const resultado = comparar(valorFila, condicion.value);
  switch (condicion.operator) {
    case '=':
      return resultado === 0;
    case '!=':
      return resultado !== 0;
    case '>':
      return resultado > 0;
    case '>=':
      return resultado >= 0;
    case '<':
      return resultado < 0;
    case '<=':
      return resultado <= 0;
    default:
      return true;
  }
}
