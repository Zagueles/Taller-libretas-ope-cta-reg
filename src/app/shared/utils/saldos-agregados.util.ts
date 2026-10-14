import type { QueryReportGroupAggregation } from '../types/query-report.types';

type Fila = Readonly<Record<string, string | undefined>>;

/** Un monto con miles («10,000.00») a número; lo que no es un monto vale 0. */
export const montoANumero = (valor: string | undefined): number => {
  const numero = parseFloat((valor ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numero) ? numero : 0;
};

/**
 * Saldo inicial y final de un grupo de filas según `runningBalance` (un saldo que se arrastra, no se suma). Con
 * `accountColumn`, cada cuenta de registro cuenta una sola vez: el saldo inicial de su primera fila y el saldo final de su
 * última, sumadas entre cuentas (RN-069). Con `openingCreditColumn`, el crédito del movimiento interno «Saldo inicial» se
 * suma al saldo inicial de su cuenta. Sin filas, devuelve `null`.
 */
export function totalizarSaldos(filas: readonly Fila[], balance: QueryReportGroupAggregation['runningBalance'] | undefined, aggregation?: QueryReportGroupAggregation | null): { inicio: number; fin: number } | null {
  if (!balance || !filas.length) return null;
  const cuentas = new Map<string, Fila[]>();
  filas.forEach((f) => {
    const clave = aggregation?.accountColumn ? (f[aggregation.accountColumn] ?? '') : '';
    cuentas.set(clave, [...(cuentas.get(clave) ?? []), f]);
  });
  let inicio = 0;
  let fin = 0;
  cuentas.forEach((lista) => {
    inicio += montoANumero(lista[0][balance.startColumn]);
    if (aggregation?.openingCreditColumn) inicio += lista.reduce((suma, f) => suma + montoANumero(f[aggregation.openingCreditColumn!]), 0);
    fin += montoANumero(lista[lista.length - 1][balance.endColumn]);
  });
  return { inicio, fin };
}
