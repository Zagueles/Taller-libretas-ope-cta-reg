import type {
  CuentaRegistroCatalogo,
  DetalleDocumentoLibreta,
  DetalleMovimientoLibreta,
  DocumentoLibreta,
  EstadoDocumentoLibreta,
  FiltrosMovimientos,
  MovimientoLibretaRegistro,
  SaldosCuentaBancaria,
} from '../modules/tesoreria/registro-libretas-cuentas-registro/models/registro-libretas.model';
import { saldosPorCuentaRegistro } from '../modules/tesoreria/registro-libretas-cuentas-registro/utils/registro-libretas-saldos.util';
import { DOCUMENTOS_NO_PROCESADOS, DocumentoNoProcesado, MOVIMIENTOS_LIBRETA_REGISTRO, MOVIMIENTOS_RECHAZADOS } from './libretas-seed';

/**
 * Reglas del backend simulado de «Registro de operaciones en las libretas de las cuentas de registro»: funciones puras
 * sobre los datos que guarda `mock-db.ts`. El interceptor (`mock-backend.interceptor.ts`) solo las expone en `/libretas`.
 */

export interface DatosLibretas {
  /** Los movimientos de la libreta (los que se consultan y se listan en Registros). */
  movimientos: MovimientoLibretaRegistro[];
  /** Los movimientos que traían los documentos rechazados: no están en la libreta y solo se ven en su documento. */
  rechazados: MovimientoLibretaRegistro[];
  /** Motivo del rechazo de cada documento rechazado, por número. */
  noProcesados: Record<string, DocumentoNoProcesado>;
}

export function datosLibretasIniciales(): DatosLibretas {
  return {
    movimientos: MOVIMIENTOS_LIBRETA_REGISTRO.map((m) => ({ ...m })),
    rechazados: MOVIMIENTOS_RECHAZADOS.map((m) => ({ ...m })),
    noProcesados: { ...DOCUMENTOS_NO_PROCESADOS },
  };
}

const coincide = (seleccion: string[] | undefined, valor: string): boolean => !seleccion?.length || seleccion.includes(valor);

/** La consulta: período, cuentas bancarias, tipo de operación, entidad, unidad ejecutora y beneficiario (en el servidor). */
export function filtrarMovimientos(libretas: DatosLibretas, f: FiltrosMovimientos): MovimientoLibretaRegistro[] {
  return libretas.movimientos.filter((m) => {
    const dia = m.fecha.slice(0, 10);
    return (
      (!f.desde || dia >= f.desde) &&
      (!f.hasta || dia <= f.hasta) &&
      coincide(f.cuentasBancarias, m.cuentaBancariaId) &&
      coincide(f.tiposOperacion, m.tipoOperacionCodigo) &&
      coincide(f.entidades, m.entidad) &&
      coincide(f.unidadesEjecutoras, m.unidadEjecutora) &&
      coincide(f.beneficiarios, m.beneficiarioCodigo)
    );
  });
}

function todosLosMovimientos(libretas: DatosLibretas): MovimientoLibretaRegistro[] {
  return [...libretas.movimientos, ...libretas.rechazados];
}

function documentoDe(libretas: DatosLibretas, m: MovimientoLibretaRegistro): DocumentoLibreta {
  const error = libretas.noProcesados[m.numeroDocumento];
  const estado: EstadoDocumentoLibreta = error?.estado ?? 'Procesado';
  return {
    numero: m.numeroDocumento,
    documentoId: m.documentoId,
    fecha: m.fecha,
    estado,
    codigoError: error?.codigoError ?? null,
    descripcionError: error?.descripcionError ?? null,
  };
}

/** Un documento por número que los movimientos referencian, ordenados por número. Filtra por estado y por texto. */
export function listarDocumentos(libretas: DatosLibretas, filtros: { estado?: string; search?: string } = {}): DocumentoLibreta[] {
  const porNumero = new Map(todosLosMovimientos(libretas).map((m) => [m.numeroDocumento, documentoDe(libretas, m)]));
  const texto = (filtros.search ?? '').trim().toLowerCase();
  return [...porNumero.values()]
    .filter((d) => (!filtros.estado || d.estado === filtros.estado) && (!texto || d.numero.toLowerCase().includes(texto)))
    .sort((a, b) => a.numero.localeCompare(b.numero));
}

export function detalleDocumento(libretas: DatosLibretas, numero: string): DetalleDocumentoLibreta | null {
  const movimientos = todosLosMovimientos(libretas).filter((m) => m.numeroDocumento === numero);
  return movimientos.length ? { documento: documentoDe(libretas, movimientos[movimientos.length - 1]), movimientos } : null;
}

export function detalleMovimiento(libretas: DatosLibretas, id: string): DetalleMovimientoLibreta | null {
  const movimiento = todosLosMovimientos(libretas).find((m) => m.id === id);
  if (!movimiento) return null;
  return { movimiento, rechazado: libretas.rechazados.some((m) => m.id === id), documento: documentoDe(libretas, movimiento) };
}

/** Las cuentas de registro distintas de la libreta (número, descripción y FF/SUB FF), por número. */
export function cuentasRegistro(libretas: DatosLibretas): CuentaRegistroCatalogo[] {
  const porNumero = new Map<string, CuentaRegistroCatalogo>();
  for (const m of libretas.movimientos) {
    if (!porNumero.has(m.numeroCuentaRegistro)) {
      porNumero.set(m.numeroCuentaRegistro, { numero: m.numeroCuentaRegistro, descripcion: m.descripcionCuentaRegistro, ffSubFf: m.ffSubFf });
    }
  }
  return [...porNumero.values()];
}

/**
 * Saldos de cada cuenta bancaria: el total de todas sus libretas (una sola vez el saldo de cada cuenta de registro, con el
 * crédito de «Saldo inicial» en el inicial), sin importar el período ni los demás filtros de la consulta.
 */
export function saldosCuentasBancarias(libretas: DatosLibretas): SaldosCuentaBancaria[] {
  const ids = [...new Set(libretas.movimientos.map((m) => m.cuentaBancariaId))];
  return ids.map((cuentaBancariaId) => {
    const { saldoInicial, saldoFinal } = saldosPorCuentaRegistro(libretas.movimientos.filter((m) => m.cuentaBancariaId === cuentaBancariaId));
    return { cuentaBancariaId, saldoInicial, saldoFinal };
  });
}
