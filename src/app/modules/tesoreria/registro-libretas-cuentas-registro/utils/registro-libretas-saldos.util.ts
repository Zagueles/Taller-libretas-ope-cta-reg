import { MovimientoLibretaRegistro } from '../models/registro-libretas.model';

/**
 * Saldos de las libretas según el Anexo 14 (RN-036 a RN-047, RN-069 y RN-071). La libreta de una cuenta de registro se
 * ordena cronológicamente (fecha y, a igual fecha, secuencia): el saldo inicial de cada registro es el final del anterior y el saldo final de la libreta es el
 * del último registro; los saldos de las secuencias de una misma libreta nunca se suman.
 */

/** Saldos de un conjunto de libretas (cuentas de registro) en la moneda de la cuenta y en moneda nacional. */
export interface SaldosLibretas {
  saldoInicial: number;
  saldoFinal: number;
  saldoInicialMN: number;
  saldoFinalMN: number;
}

/** Código del tipo de operación «Saldos iniciales» (movimiento interno «Saldo inicial»): su crédito forma parte del saldo inicial. */
export const TIPO_OPERACION_SALDO_INICIAL = '1';

const redondear = (valor: number): number => Math.round(valor * 100) / 100;
const claveLibreta = (m: MovimientoLibretaRegistro): string => `${m.cuentaBancariaId}|${m.numeroCuentaRegistro}`;
/** Clave de un movimiento dentro del resultado: la secuencia se repite entre cuentas bancarias. */
export const claveMovimiento = (m: MovimientoLibretaRegistro): string => `${m.cuentaBancariaId}|${m.sec}`;

/** Las libretas del resultado, cada una con sus movimientos en el orden de su secuencia. */
function libretas(movimientos: readonly MovimientoLibretaRegistro[]): MovimientoLibretaRegistro[][] {
  const porLibreta = new Map<string, MovimientoLibretaRegistro[]>();
  movimientos.forEach((m) => porLibreta.set(claveLibreta(m), [...(porLibreta.get(claveLibreta(m)) ?? []), m]));
  return [...porLibreta.values()].map((l) => [...l].sort((a, b) => (a.fecha ?? '').localeCompare(b.fecha ?? '') || a.sec.localeCompare(b.sec)));
}

/**
 * Saldo inicial y final en moneda nacional de cada movimiento, encadenados (RN-044/045): el primero parte de su saldo
 * inicial convertido y los siguientes toman como inicial el final MN del registro anterior; el final MN es el inicial MN
 * más (crédito − débito) × tipo de cambio. Con un tipo de cambio único da lo mismo que convertir el saldo, pero con tipos
 * distintos por operación el saldo en MN no se puede reconstruir convirtiendo el saldo de la cuenta.
 */
export function saldosMNPorMovimiento(
  movimientos: readonly MovimientoLibretaRegistro[],
  tipoCambioDe: (m: MovimientoLibretaRegistro) => number,
): Map<string, { saldoInicialMN: number; saldoFinalMN: number }> {
  const resultado = new Map<string, { saldoInicialMN: number; saldoFinalMN: number }>();
  libretas(movimientos).forEach((libreta) => {
    let anterior: number | null = null;
    libreta.forEach((m) => {
      const tc = tipoCambioDe(m);
      const saldoInicialMN = anterior ?? redondear(m.saldoInicial * tc);
      const saldoFinalMN = redondear(saldoInicialMN + (m.credito - m.debito) * tc);
      resultado.set(claveMovimiento(m), { saldoInicialMN, saldoFinalMN });
      anterior = saldoFinalMN;
    });
  });
  return resultado;
}

/**
 * Saldos de un grupo o de una cuenta bancaria (RN-069): por cada cuenta de registro se toma una sola vez el saldo inicial
 * de su primer registro (más el crédito del movimiento interno «Saldo inicial», que forma parte del saldo inicial) y el saldo
 * final de su último registro, y se suman entre cuentas de registro. No se suman los
 * saldos de las secuencias de una misma libreta.
 */
export function saldosPorCuentaRegistro(
  movimientos: readonly MovimientoLibretaRegistro[],
  tipoCambioDe: (m: MovimientoLibretaRegistro) => number = () => 1,
): SaldosLibretas {
  const mn = saldosMNPorMovimiento(movimientos, tipoCambioDe);
  const total: SaldosLibretas = { saldoInicial: 0, saldoFinal: 0, saldoInicialMN: 0, saldoFinalMN: 0 };
  libretas(movimientos).forEach((libreta) => {
    const primero = libreta[0];
    const ultimo = libreta[libreta.length - 1];
    // El crédito del movimiento interno «Saldo inicial» no es un abono del periodo: se suma al saldo inicial de la cuenta de registro.
    const apertura = libreta.filter((m) => m.tipoOperacionCodigo === TIPO_OPERACION_SALDO_INICIAL);
    total.saldoInicial += primero.saldoInicial + apertura.reduce((suma, m) => suma + m.credito, 0);
    total.saldoFinal += ultimo.saldoFinal;
    total.saldoInicialMN += mn.get(claveMovimiento(primero))!.saldoInicialMN + apertura.reduce((suma, m) => suma + m.credito * tipoCambioDe(m), 0);
    total.saldoFinalMN += mn.get(claveMovimiento(ultimo))!.saldoFinalMN;
  });
  return {
    saldoInicial: redondear(total.saldoInicial),
    saldoFinal: redondear(total.saldoFinal),
    saldoInicialMN: redondear(total.saldoInicialMN),
    saldoFinalMN: redondear(total.saldoFinalMN),
  };
}
