/** Sentido del orden de una columna. */
export type SortDirection = 'asc' | 'desc';

/** Columna por la que está ordenada una tabla y en qué sentido; `null` es sin orden. */
export interface TableSort {
  key: string;
  direction: SortDirection;
}

/**
 * Siguiente orden al pulsar el título de una columna: sin orden → ascendente → descendente → sin orden. Pulsar otra
 * columna empieza siempre por ascendente.
 */
export function siguienteOrden(actual: TableSort | null, key: string): TableSort | null {
  if (!actual || actual.key !== key) return { key, direction: 'asc' };
  return actual.direction === 'asc' ? { key, direction: 'desc' } : null;
}

/** Valor de `aria-sort` de una cabecera según el orden actual. */
export function ariaSortDe(orden: TableSort | null, key: string): 'ascending' | 'descending' | 'none' {
  if (!orden || orden.key !== key) return 'none';
  return orden.direction === 'asc' ? 'ascending' : 'descending';
}

const comparador = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

/**
 * Copia de `filas` ordenada por `orden` (estable, con orden natural en español: «2» antes que «10»; los vacíos van
 * al final en cualquier sentido). Sin orden devuelve las filas tal cual.
 */
export function ordenarFilas<T>(filas: readonly T[], orden: TableSort | null, valorDe: (fila: T, key: string) => string | number | null | undefined): T[] {
  if (!orden) return [...filas];
  const signo = orden.direction === 'asc' ? 1 : -1;
  const vacio = (v: unknown): boolean => v === null || v === undefined || v === '';
  return filas
    .map((fila, indice) => ({ fila, indice, valor: valorDe(fila, orden.key) }))
    .sort((a, b) => {
      if (vacio(a.valor) || vacio(b.valor)) return vacio(a.valor) && vacio(b.valor) ? a.indice - b.indice : vacio(a.valor) ? 1 : -1;
      const ambosNumeros = typeof a.valor === 'number' && typeof b.valor === 'number';
      const orden2 = ambosNumeros ? (a.valor as number) - (b.valor as number) : comparador.compare(String(a.valor), String(b.valor));
      return orden2 * signo || a.indice - b.indice;
    })
    .map((x) => x.fila);
}

/** Cómo comparar los valores de una columna: texto (orden natural), número (acepta miles con coma) o fecha (dd/mm/aaaa hh:mm:ss). */
export type SortType = 'text' | 'number' | 'date';

/** El valor de una celda ya listo para compararse según el tipo de su columna; lo que no se reconoce queda vacío (va al final). */
export function valorOrdenable(valor: unknown, tipo: SortType = 'text'): string | number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (tipo === 'number') {
    const numero = Number(String(valor).replace(/,/g, ''));
    return Number.isFinite(numero) ? numero : null;
  }
  if (tipo === 'date') {
    const m = String(valor).match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    return m ? `${m[3]}${m[2]}${m[1]}${m[4] ?? '00'}${m[5] ?? '00'}${m[6] ?? '00'}` : String(valor);
  }
  return String(valor);
}
