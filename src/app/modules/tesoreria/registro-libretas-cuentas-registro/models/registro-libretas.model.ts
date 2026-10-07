/**
 * «Registro de operaciones en las libretas de las cuentas de registro» (Conciliación bancaria, Figma nodo
 * 5953:39984): cada movimiento es un cargo o abono contra una cuenta bancaria, agrupado por cuenta de registro
 * (FF/SUB FF) y ligado al documento que lo originó. Aquí van los tipos, los catálogos y los nombres; los movimientos y
 * los documentos viven en el backend simulado (`mock/libretas-seed.ts`) y se piden por `RegistroLibretasApiService`.
 */

export interface OpcionCatalogo {
  value: string;
  label: string;
  /** Texto descriptivo bajo la etiqueta al elegir la opción. */
  description?: string;
}

export const TIPOS_OPERACION: OpcionCatalogo[] = [
  { value: '1', label: '1 - Saldos Iniciales' },
  { value: '2', label: '2 - Reporte de Recaudación SUNAT' },
  { value: '3', label: '3 - Devolución' },
];

export const CUENTAS_BANCARIAS_REGISTRO: OpcionCatalogo[] = [
  { value: 'mef-dgtp-cut', label: '11040103570200000000', description: 'PEN - MEF - DGTP - CUT' },
  { value: 'mef-dgtp', label: '12073303572000000003', description: 'USD - MEF - DGTP' },
];

export const ENTIDADES: OpcionCatalogo[] = [
  { value: 'MEF', label: 'MEF' },
  { value: 'IPD', label: 'IPD' },
  { value: 'MINCETUR', label: 'MINCETUR' },
];

export const UNIDADES_EJECUTORAS: OpcionCatalogo[] = [
  { value: 'COMERCIO EXTERIOR TURISMO', label: 'COMERCIO EXTERIOR TURISMO' },
  { value: 'IPD', label: 'IPD' },
  { value: 'ADMIN CENTRAL - OGA', label: 'ADMIN CENTRAL - OGA' },
];

export const BENEFICIARIOS: OpcionCatalogo[] = [
  { value: '000360', label: 'MINCETUR - Juegos y Apuestas' },
  { value: '000366', label: 'MINCETUR - Casinos y Tragamonedas' },
  { value: '000193', label: 'IPD' },
  { value: '000120', label: 'Fondo de Compensación Municipal' },
  { value: '000009', label: 'Tesoro Público' },
];

/** Cuenta bancaria en soles/dólares que agrupa los movimientos (pestañas del resultado). */
export interface CuentaBancariaRegistroInfo {
  id: string;
  nombre: string;
  numeroCuenta: string;
  moneda: string;
  saldoInicial: number;
  saldoFinal: number;
}

export const CUENTAS_BANCARIAS_INFO: CuentaBancariaRegistroInfo[] = [
  { id: 'mef-dgtp-cut', nombre: 'MEF - DGTP - CUT', numeroCuenta: '11040103570200000000', moneda: 'PEN', saldoInicial: 1_028_000, saldoFinal: 1_170_753 },
  { id: 'mef-dgtp', nombre: 'MEF - DGTP', numeroCuenta: '12073303572000000003', moneda: 'USD', saldoInicial: 3_500_000, saldoFinal: 3_560_000 },
];

/** Un movimiento (cargo o abono) en la libreta de una cuenta de registro. */
export interface MovimientoLibretaRegistro {
  sec: string;
  /** Fecha y hora de acreditación, ISO (aaaa-mm-ddThh:mm:ss). */
  fecha: string;
  cuentaBancariaId: string;
  beneficiarioCodigo: string;
  numeroCuentaRegistro: string;
  descripcionCuentaRegistro: string;
  ffSubFf: string;
  tipoOperacionCodigo: string;
  entidad: string;
  unidadEjecutora: string;
  grupo: string;
  saldoInicial: number;
  debito: number;
  credito: number;
  saldoFinal: number;
  numeroDocumento: string;
  documentoId: string;
  descripcionDocumento: string;
}

/** Código de entidad consolidada (clasificador institucional). */
export const CODIGO_ENTIDAD: Record<string, string> = { MEF: '111110009000', IPD: '111110193994', MINCETUR: '111111070000' };

export function nombreBeneficiario(codigo: string): string {
  return BENEFICIARIOS.find((b) => b.value === codigo)?.label ?? codigo;
}

export function nombreTipoOperacion(codigo: string): string {
  return TIPOS_OPERACION.find((t) => t.value === codigo)?.label ?? codigo;
}

/** Igual que `nombreTipoOperacion`, pero con «R.R. SUNAT» en vez de «Reporte de Recaudación SUNAT»: para leyendas cortas (gráficos). */
export function nombreTipoOperacionCorto(codigo: string): string {
  return nombreTipoOperacion(codigo).replace('Reporte de Recaudación SUNAT', 'R.R. SUNAT');
}

export function nombreCuentaBancaria(id: string): string {
  return CUENTAS_BANCARIAS_INFO.find((c) => c.id === id)?.nombre ?? id;
}

/** Estado de un documento del proceso: lo genera el sistema al registrar las operaciones, ya procesado o rechazado. */
export type EstadoDocumentoLibreta = 'Procesado' | 'Rechazado';

/** Un documento que generó el sistema, con la fecha de su primer movimiento. */
export interface DocumentoLibreta {
  numero: string;
  documentoId: string;
  /** Fecha y hora del documento (la de su último movimiento), ISO. */
  fecha: string;
  estado: EstadoDocumentoLibreta;
  /** Solo en los rechazados: por qué el sistema no lo procesó. */
  motivoRechazo: string | null;
}

/** El documento con todos los movimientos que referencia (los de la libreta y, si fue rechazado, los que traía). */
export interface DetalleDocumentoLibreta {
  documento: DocumentoLibreta;
  movimientos: MovimientoLibretaRegistro[];
}

/** Un movimiento con el documento que lo originó (la vista de detalle del registro). */
export interface DetalleMovimientoLibreta {
  movimiento: MovimientoLibretaRegistro;
  /** Pertenece a un documento rechazado: no está en la libreta. */
  rechazado: boolean;
  documento: DocumentoLibreta;
}

/** Una cuenta de registro (FF/SUB FF) de la libreta: catálogo de los filtros y de las cards del agregado. */
export interface CuentaRegistroCatalogo {
  numero: string;
  descripcion: string;
  ffSubFf: string;
}

/** Filtros de la consulta de movimientos; los resuelve el backend. Las listas vacías no filtran. */
export interface FiltrosMovimientos {
  desde?: string;
  hasta?: string;
  cuentasBancarias?: string[];
  tiposOperacion?: string[];
  entidades?: string[];
  unidadesEjecutoras?: string[];
  beneficiarios?: string[];
}
