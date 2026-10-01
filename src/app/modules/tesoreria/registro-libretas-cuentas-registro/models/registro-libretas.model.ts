/**
 * «Registro de operaciones en las libretas de las cuentas de registro» (Conciliación bancaria, Figma nodo
 * 5953:39984). Por ahora solo está armada la consulta: cada movimiento es un cargo o abono contra una cuenta
 * bancaria, agrupado por cuenta de registro (FF/SUB FF) y ligado al documento que lo originó.
 */

export interface OpcionCatalogo {
  value: string;
  label: string;
}

export const TIPOS_OPERACION: OpcionCatalogo[] = [
  { value: '1', label: '1 - Saldos Iniciales' },
  { value: '2', label: '2 - Reporte de Recaudación SUNAT' },
  { value: '3', label: '3 - Devolución' },
];

export const CUENTAS_BANCARIAS_REGISTRO: OpcionCatalogo[] = [
  { value: 'mef-dgtp-cut', label: 'MEF - DGTP - CUT' },
  { value: 'mef-dgtp', label: 'MEF - DGTP' },
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
  { id: 'mef-dgtp-cut', nombre: 'MEF - DGTP - CUT', numeroCuenta: '1104010357020000000', moneda: 'PEN', saldoInicial: 1_028_000, saldoFinal: 1_170_753 },
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

const DOC_REGISTRO = 'Registro de operaciones en las libretas de las cuentas de registro';

/** Datos de ejemplo (Figma nodo 5953:39984): movimientos de junio y septiembre de 2026 de las dos cuentas bancarias del ejemplo. */
export const MOVIMIENTOS_LIBRETA_REGISTRO: MovimientoLibretaRegistro[] = [
  { sec: '000001', fecha: '2026-06-28T18:02:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000360', numeroCuentaRegistro: '111111070000 2.09 000000 000000 01', descripcionCuentaRegistro: 'Recaudación Impuesto a los Juegos y Apuestas Deportivas a Distancia – MINCETUR', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '1', entidad: 'MINCETUR', unidadEjecutora: 'COMERCIO EXTERIOR TURISMO', grupo: '3 - Gobierno nacional', saldoInicial: 0, debito: 0, credito: 10_000, saldoFinal: 10_000, numeroDocumento: '000001-2026', documentoId: 'doc-000001-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000002', fecha: '2026-06-28T14:22:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000360', numeroCuentaRegistro: '111111070000 2.09 000000 000000 01', descripcionCuentaRegistro: 'Recaudación Impuesto a los Juegos y Apuestas Deportivas a Distancia – MINCETUR', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '2', entidad: 'MINCETUR', unidadEjecutora: 'COMERCIO EXTERIOR TURISMO', grupo: '3 - Gobierno nacional', saldoInicial: 10_000, debito: 0, credito: 9_000, saldoFinal: 19_000, numeroDocumento: '000005-2026', documentoId: 'doc-000005-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000003', fecha: '2026-06-28T14:22:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000360', numeroCuentaRegistro: '111111070000 2.09 000000 000000 01', descripcionCuentaRegistro: 'Recaudación Impuesto a los Juegos y Apuestas Deportivas a Distancia – MINCETUR', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '2', entidad: 'MINCETUR', unidadEjecutora: 'COMERCIO EXTERIOR TURISMO', grupo: '3 - Gobierno nacional', saldoInicial: 19_000, debito: 0, credito: 3_000, saldoFinal: 22_000, numeroDocumento: '000005-2026', documentoId: 'doc-000005-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000004', fecha: '2026-06-28T18:02:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000366', numeroCuentaRegistro: '111111070000 2.09 000000 000000 02', descripcionCuentaRegistro: 'Impuesto a los Juegos de Casino y Máquinas Tragamonedas – MINCETUR', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '1', entidad: 'MINCETUR', unidadEjecutora: 'COMERCIO EXTERIOR TURISMO', grupo: '3 - Gobierno nacional', saldoInicial: 0, debito: 0, credito: 0, saldoFinal: 0, numeroDocumento: '000001-2026', documentoId: 'doc-000001-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000005', fecha: '2026-06-28T18:02:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000366', numeroCuentaRegistro: '111111070000 2.09 000000 000000 02', descripcionCuentaRegistro: 'Impuesto a los Juegos de Casino y Máquinas Tragamonedas – MINCETUR', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '2', entidad: 'MINCETUR', unidadEjecutora: 'COMERCIO EXTERIOR TURISMO', grupo: '3 - Gobierno nacional', saldoInicial: 0, debito: 0, credito: 5_600, saldoFinal: 5_600, numeroDocumento: '000005-2026', documentoId: 'doc-000005-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000006', fecha: '2026-06-28T15:46:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000360', numeroCuentaRegistro: '111111070000 2.09 000000 000000 01', descripcionCuentaRegistro: 'Recaudación Impuesto a los Juegos y Apuestas Deportivas a Distancia – MINCETUR', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '2', entidad: 'MINCETUR', unidadEjecutora: 'COMERCIO EXTERIOR TURISMO', grupo: '3 - Gobierno nacional', saldoInicial: 22_000, debito: 0, credito: 5_000, saldoFinal: 27_000, numeroDocumento: '000006-2026', documentoId: 'doc-000006-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000007', fecha: '2026-06-28T18:02:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000193', numeroCuentaRegistro: '111110193994 2.09 000000 000000 01', descripcionCuentaRegistro: 'Cuenta juegos y casinos IPD', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '1', entidad: 'IPD', unidadEjecutora: 'IPD', grupo: '3 - Gobierno nacional', saldoInicial: 0, debito: 0, credito: 3_000, saldoFinal: 3_000, numeroDocumento: '000001-2026', documentoId: 'doc-000001-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000008', fecha: '2026-06-28T15:46:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000193', numeroCuentaRegistro: '111110193994 2.09 000000 000000 01', descripcionCuentaRegistro: 'Cuenta juegos y casinos IPD', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '2', entidad: 'IPD', unidadEjecutora: 'IPD', grupo: '3 - Gobierno nacional', saldoInicial: 3_000, debito: 0, credito: 35_000, saldoFinal: 38_000, numeroDocumento: '000006-2026', documentoId: 'doc-000006-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000009', fecha: '2026-06-28T18:02:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000120', numeroCuentaRegistro: '111110009000 1.00 000000 000000 02', descripcionCuentaRegistro: 'FONCOMUN', ffSubFf: '1.00 Recursos Ordinarios', tipoOperacionCodigo: '1', entidad: 'MEF', unidadEjecutora: 'ADMIN CENTRAL - OGA', grupo: '3 - Gobierno nacional', saldoInicial: 0, debito: 0, credito: 15_000, saldoFinal: 15_000, numeroDocumento: '000001-2026', documentoId: 'doc-000001-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000010', fecha: '2026-06-28T15:46:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000120', numeroCuentaRegistro: '111110009000 1.00 000000 000000 02', descripcionCuentaRegistro: 'FONCOMUN', ffSubFf: '1.00 Recursos Ordinarios', tipoOperacionCodigo: '2', entidad: 'MEF', unidadEjecutora: 'ADMIN CENTRAL - OGA', grupo: '3 - Gobierno nacional', saldoInicial: 15_000, debito: 0, credito: 16_200, saldoFinal: 31_200, numeroDocumento: '000006-2026', documentoId: 'doc-000006-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000011', fecha: '2026-06-28T18:02:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000009', numeroCuentaRegistro: '111110009000 1.00 000000 000000 01', descripcionCuentaRegistro: 'Cuenta Principal Tesoro Público', ffSubFf: '1.00 Recursos Ordinarios', tipoOperacionCodigo: '1', entidad: 'MEF', unidadEjecutora: 'ADMIN CENTRAL - OGA', grupo: '3 - Gobierno nacional', saldoInicial: 0, debito: 0, credito: 1_000_000, saldoFinal: 1_000_000, numeroDocumento: '000001-2026', documentoId: 'doc-000001-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000012', fecha: '2026-06-28T18:02:00', cuentaBancariaId: 'mef-dgtp', beneficiarioCodigo: '000009', numeroCuentaRegistro: '111110009000 1.00 000000 000000 99', descripcionCuentaRegistro: 'Cuenta Principal Tesoro Público Dolares', ffSubFf: '1.00 Recursos Ordinarios', tipoOperacionCodigo: '1', entidad: 'MEF', unidadEjecutora: 'ADMIN CENTRAL - OGA', grupo: '3 - Gobierno nacional', saldoInicial: 0, debito: 0, credito: 3_500_000, saldoFinal: 3_500_000, numeroDocumento: '000001-2026', documentoId: 'doc-000001-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000013', fecha: '2026-06-29T14:26:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000366', numeroCuentaRegistro: '111111070000 2.09 000000 000000 02', descripcionCuentaRegistro: 'Impuesto a los Juegos de Casino y Máquinas Tragamonedas – MINCETUR', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '2', entidad: 'MINCETUR', unidadEjecutora: 'COMERCIO EXTERIOR TURISMO', grupo: '3 - Gobierno nacional', saldoInicial: 5_600, debito: 0, credito: 9_753, saldoFinal: 15_353, numeroDocumento: '000007-2026', documentoId: 'doc-000007-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000014', fecha: '2026-06-29T14:26:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000360', numeroCuentaRegistro: '111111070000 2.09 000000 000000 01', descripcionCuentaRegistro: 'Recaudación Impuesto a los Juegos y Apuestas Deportivas a Distancia – MINCETUR', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '2', entidad: 'MINCETUR', unidadEjecutora: 'COMERCIO EXTERIOR TURISMO', grupo: '3 - Gobierno nacional', saldoInicial: 27_000, debito: 0, credito: 6_000, saldoFinal: 33_000, numeroDocumento: '000007-2026', documentoId: 'doc-000007-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000015', fecha: '2026-06-29T14:26:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000360', numeroCuentaRegistro: '111111070000 2.09 000000 000000 01', descripcionCuentaRegistro: 'Recaudación Impuesto a los Juegos y Apuestas Deportivas a Distancia – MINCETUR', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '2', entidad: 'MINCETUR', unidadEjecutora: 'COMERCIO EXTERIOR TURISMO', grupo: '3 - Gobierno nacional', saldoInicial: 33_000, debito: 0, credito: 7_500, saldoFinal: 40_500, numeroDocumento: '000007-2026', documentoId: 'doc-000007-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000016', fecha: '2026-06-29T10:26:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000009', numeroCuentaRegistro: '111110009000 1.00 000000 000000 01', descripcionCuentaRegistro: 'Cuenta Principal Tesoro Público', ffSubFf: '1.00 Recursos Ordinarios', tipoOperacionCodigo: '3', entidad: 'MEF', unidadEjecutora: 'ADMIN CENTRAL - OGA', grupo: '3 - Gobierno nacional', saldoInicial: 1_000_000, debito: 5_000, credito: 0, saldoFinal: 995_000, numeroDocumento: '000002-2026', documentoId: 'doc-000002-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000017', fecha: '2026-06-29T10:26:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000120', numeroCuentaRegistro: '111110009000 1.00 000000 000000 02', descripcionCuentaRegistro: 'FONCOMUN', ffSubFf: '1.00 Recursos Ordinarios', tipoOperacionCodigo: '3', entidad: 'MEF', unidadEjecutora: 'ADMIN CENTRAL - OGA', grupo: '3 - Gobierno nacional', saldoInicial: 31_200, debito: 5_000, credito: 0, saldoFinal: 36_200, numeroDocumento: '000002-2026', documentoId: 'doc-000002-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000018', fecha: '2026-06-28T18:02:00', cuentaBancariaId: 'mef-dgtp', beneficiarioCodigo: '000193', numeroCuentaRegistro: '111110193994 2.09 000000 000000 01', descripcionCuentaRegistro: 'Cuenta juegos y casinos IPD', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '1', entidad: 'IPD', unidadEjecutora: 'IPD', grupo: '3 - Gobierno nacional', saldoInicial: 500_000, debito: 0, credito: 12_400, saldoFinal: 512_400, numeroDocumento: '000003-2026', documentoId: 'doc-000003-2026', descripcionDocumento: DOC_REGISTRO },
  // Septiembre 2026: más movimientos y días para consultar un período con variedad de tipos de operación y saldos.
  { sec: '000019', fecha: '2026-09-05T09:15:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000360', numeroCuentaRegistro: '111111070000 2.09 000000 000000 01', descripcionCuentaRegistro: 'Recaudación Impuesto a los Juegos y Apuestas Deportivas a Distancia – MINCETUR', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '2', entidad: 'MINCETUR', unidadEjecutora: 'COMERCIO EXTERIOR TURISMO', grupo: '3 - Gobierno nacional', saldoInicial: 40_500, debito: 0, credito: 8_000, saldoFinal: 48_500, numeroDocumento: '000008-2026', documentoId: 'doc-000008-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000020', fecha: '2026-09-05T09:15:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000366', numeroCuentaRegistro: '111111070000 2.09 000000 000000 02', descripcionCuentaRegistro: 'Impuesto a los Juegos de Casino y Máquinas Tragamonedas – MINCETUR', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '2', entidad: 'MINCETUR', unidadEjecutora: 'COMERCIO EXTERIOR TURISMO', grupo: '3 - Gobierno nacional', saldoInicial: 15_353, debito: 0, credito: 4_200, saldoFinal: 19_553, numeroDocumento: '000008-2026', documentoId: 'doc-000008-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000021', fecha: '2026-09-05T09:15:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000193', numeroCuentaRegistro: '111110193994 2.09 000000 000000 01', descripcionCuentaRegistro: 'Cuenta juegos y casinos IPD', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '2', entidad: 'IPD', unidadEjecutora: 'IPD', grupo: '3 - Gobierno nacional', saldoInicial: 38_000, debito: 0, credito: 6_000, saldoFinal: 44_000, numeroDocumento: '000008-2026', documentoId: 'doc-000008-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000022', fecha: '2026-09-05T09:15:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000120', numeroCuentaRegistro: '111110009000 1.00 000000 000000 02', descripcionCuentaRegistro: 'FONCOMUN', ffSubFf: '1.00 Recursos Ordinarios', tipoOperacionCodigo: '2', entidad: 'MEF', unidadEjecutora: 'ADMIN CENTRAL - OGA', grupo: '3 - Gobierno nacional', saldoInicial: 36_200, debito: 0, credito: 9_800, saldoFinal: 46_000, numeroDocumento: '000008-2026', documentoId: 'doc-000008-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000023', fecha: '2026-09-05T16:40:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000009', numeroCuentaRegistro: '111110009000 1.00 000000 000000 01', descripcionCuentaRegistro: 'Cuenta Principal Tesoro Público', ffSubFf: '1.00 Recursos Ordinarios', tipoOperacionCodigo: '3', entidad: 'MEF', unidadEjecutora: 'ADMIN CENTRAL - OGA', grupo: '3 - Gobierno nacional', saldoInicial: 995_000, debito: 45_000, credito: 0, saldoFinal: 950_000, numeroDocumento: '000008-2026', documentoId: 'doc-000008-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000024', fecha: '2026-09-05T16:40:00', cuentaBancariaId: 'mef-dgtp', beneficiarioCodigo: '000009', numeroCuentaRegistro: '111110009000 1.00 000000 000000 99', descripcionCuentaRegistro: 'Cuenta Principal Tesoro Público Dolares', ffSubFf: '1.00 Recursos Ordinarios', tipoOperacionCodigo: '2', entidad: 'MEF', unidadEjecutora: 'ADMIN CENTRAL - OGA', grupo: '3 - Gobierno nacional', saldoInicial: 3_500_000, debito: 0, credito: 250_000, saldoFinal: 3_750_000, numeroDocumento: '000008-2026', documentoId: 'doc-000008-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000025', fecha: '2026-09-05T16:40:00', cuentaBancariaId: 'mef-dgtp', beneficiarioCodigo: '000193', numeroCuentaRegistro: '111110193994 2.09 000000 000000 01', descripcionCuentaRegistro: 'Cuenta juegos y casinos IPD', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '2', entidad: 'IPD', unidadEjecutora: 'IPD', grupo: '3 - Gobierno nacional', saldoInicial: 512_400, debito: 0, credito: 37_600, saldoFinal: 550_000, numeroDocumento: '000008-2026', documentoId: 'doc-000008-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000026', fecha: '2026-09-15T11:05:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000360', numeroCuentaRegistro: '111111070000 2.09 000000 000000 01', descripcionCuentaRegistro: 'Recaudación Impuesto a los Juegos y Apuestas Deportivas a Distancia – MINCETUR', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '2', entidad: 'MINCETUR', unidadEjecutora: 'COMERCIO EXTERIOR TURISMO', grupo: '3 - Gobierno nacional', saldoInicial: 48_500, debito: 0, credito: 5_500, saldoFinal: 54_000, numeroDocumento: '000009-2026', documentoId: 'doc-000009-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000027', fecha: '2026-09-15T11:05:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000366', numeroCuentaRegistro: '111111070000 2.09 000000 000000 02', descripcionCuentaRegistro: 'Impuesto a los Juegos de Casino y Máquinas Tragamonedas – MINCETUR', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '3', entidad: 'MINCETUR', unidadEjecutora: 'COMERCIO EXTERIOR TURISMO', grupo: '3 - Gobierno nacional', saldoInicial: 19_553, debito: 2_000, credito: 0, saldoFinal: 17_553, numeroDocumento: '000009-2026', documentoId: 'doc-000009-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000028', fecha: '2026-09-15T11:05:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000120', numeroCuentaRegistro: '111110009000 1.00 000000 000000 02', descripcionCuentaRegistro: 'FONCOMUN', ffSubFf: '1.00 Recursos Ordinarios', tipoOperacionCodigo: '2', entidad: 'MEF', unidadEjecutora: 'ADMIN CENTRAL - OGA', grupo: '3 - Gobierno nacional', saldoInicial: 46_000, debito: 0, credito: 3_200, saldoFinal: 49_200, numeroDocumento: '000009-2026', documentoId: 'doc-000009-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000029', fecha: '2026-09-15T11:05:00', cuentaBancariaId: 'mef-dgtp', beneficiarioCodigo: '000009', numeroCuentaRegistro: '111110009000 1.00 000000 000000 99', descripcionCuentaRegistro: 'Cuenta Principal Tesoro Público Dolares', ffSubFf: '1.00 Recursos Ordinarios', tipoOperacionCodigo: '3', entidad: 'MEF', unidadEjecutora: 'ADMIN CENTRAL - OGA', grupo: '3 - Gobierno nacional', saldoInicial: 3_750_000, debito: 100_000, credito: 0, saldoFinal: 3_650_000, numeroDocumento: '000009-2026', documentoId: 'doc-000009-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000030', fecha: '2026-09-28T17:50:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000009', numeroCuentaRegistro: '111110009000 1.00 000000 000000 01', descripcionCuentaRegistro: 'Cuenta Principal Tesoro Público', ffSubFf: '1.00 Recursos Ordinarios', tipoOperacionCodigo: '2', entidad: 'MEF', unidadEjecutora: 'ADMIN CENTRAL - OGA', grupo: '3 - Gobierno nacional', saldoInicial: 950_000, debito: 0, credito: 60_000, saldoFinal: 1_010_000, numeroDocumento: '000010-2026', documentoId: 'doc-000010-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000031', fecha: '2026-09-28T17:50:00', cuentaBancariaId: 'mef-dgtp-cut', beneficiarioCodigo: '000193', numeroCuentaRegistro: '111110193994 2.09 000000 000000 01', descripcionCuentaRegistro: 'Cuenta juegos y casinos IPD', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '3', entidad: 'IPD', unidadEjecutora: 'IPD', grupo: '3 - Gobierno nacional', saldoInicial: 44_000, debito: 4_000, credito: 0, saldoFinal: 40_000, numeroDocumento: '000010-2026', documentoId: 'doc-000010-2026', descripcionDocumento: DOC_REGISTRO },
  { sec: '000032', fecha: '2026-09-28T17:50:00', cuentaBancariaId: 'mef-dgtp', beneficiarioCodigo: '000193', numeroCuentaRegistro: '111110193994 2.09 000000 000000 01', descripcionCuentaRegistro: 'Cuenta juegos y casinos IPD', ffSubFf: '2.09 Recursos directamente recaudados', tipoOperacionCodigo: '3', entidad: 'IPD', unidadEjecutora: 'IPD', grupo: '3 - Gobierno nacional', saldoInicial: 550_000, debito: 15_000, credito: 0, saldoFinal: 535_000, numeroDocumento: '000010-2026', documentoId: 'doc-000010-2026', descripcionDocumento: DOC_REGISTRO },
];
