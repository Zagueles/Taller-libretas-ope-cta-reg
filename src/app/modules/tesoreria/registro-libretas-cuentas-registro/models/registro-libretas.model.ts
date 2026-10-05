/**
 * «Registro de operaciones en las libretas de las cuentas de registro» (Conciliación bancaria, Figma nodo
 * 5953:39984). Por ahora solo está armada la consulta: cada movimiento es un cargo o abono contra una cuenta
 * bancaria, agrupado por cuenta de registro (FF/SUB FF) y ligado al documento que lo originó.
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

const DOC_REGISTRO = 'Registro de operaciones en las libretas de las cuentas de registro';

/** Movimientos de junio (Figma nodo 5953:39984) y de septiembre de 2026; los de julio, agosto y octubre se suman abajo. */
const MOVIMIENTOS_BASE: MovimientoLibretaRegistro[] = [
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

/** Un movimiento nuevo: lo demás (cuenta de registro, entidad, FF…) sale del beneficiario en esa cuenta bancaria. */
interface MovimientoNuevo {
  sec: string;
  fecha: string;
  cuentaBancariaId: string;
  beneficiarioCodigo: string;
  tipoOperacionCodigo: '2' | '3';
  debito: number;
  credito: number;
  numeroDocumento: string;
}

const CUT = 'mef-dgtp-cut';
const USD = 'mef-dgtp';
let secNueva = 32;
/** Un abono (reporte de recaudación SUNAT) o un cargo (devolución) del documento `doc` en esa fecha. */
const abono = (fecha: string, doc: string, cuentaBancariaId: string, beneficiarioCodigo: string, credito: number): MovimientoNuevo => ({
  sec: String(++secNueva).padStart(6, '0'), fecha, cuentaBancariaId, beneficiarioCodigo, tipoOperacionCodigo: '2', debito: 0, credito, numeroDocumento: `${doc}-2026`,
});
const cargo = (fecha: string, doc: string, cuentaBancariaId: string, beneficiarioCodigo: string, debito: number): MovimientoNuevo => ({
  sec: String(++secNueva).padStart(6, '0'), fecha, cuentaBancariaId, beneficiarioCodigo, tipoOperacionCodigo: '3', debito, credito: 0, numeroDocumento: `${doc}-2026`,
});

/** Movimientos de los meses que faltaban hasta octubre de 2026, con correlativos de documento nuevos (000011 a 000015). */
const MOVIMIENTOS_NUEVOS: MovimientoNuevo[] = [
  // Julio
  abono('2026-07-08T11:20:00', '000011', CUT, '000360', 12_500),
  abono('2026-07-08T11:20:00', '000011', CUT, '000366', 7_300),
  abono('2026-07-08T11:20:00', '000011', CUT, '000193', 9_000),
  abono('2026-07-08T11:20:00', '000011', CUT, '000120', 14_000),
  abono('2026-07-08T11:20:00', '000011', USD, '000009', 180_000),
  cargo('2026-07-22T15:35:00', '000012', CUT, '000360', 3_000),
  cargo('2026-07-22T15:35:00', '000012', CUT, '000009', 20_000),
  abono('2026-07-22T15:35:00', '000012', USD, '000193', 22_000),
  // Agosto
  abono('2026-08-06T09:40:00', '000013', CUT, '000360', 10_800),
  abono('2026-08-06T09:40:00', '000013', CUT, '000366', 6_450),
  abono('2026-08-06T09:40:00', '000013', CUT, '000193', 5_200),
  cargo('2026-08-06T09:40:00', '000013', CUT, '000120', 4_000),
  cargo('2026-08-06T09:40:00', '000013', USD, '000009', 50_000),
  abono('2026-08-19T16:10:00', '000014', CUT, '000009', 85_000),
  cargo('2026-08-19T16:10:00', '000014', CUT, '000193', 2_500),
  abono('2026-08-19T16:10:00', '000014', USD, '000193', 17_800),
  abono('2026-08-19T16:10:00', '000014', USD, '000009', 120_000),
  // Octubre
  abono('2026-10-01T10:15:00', '000015', CUT, '000360', 9_400),
  abono('2026-10-01T10:15:00', '000015', CUT, '000366', 5_100),
  abono('2026-10-01T10:15:00', '000015', CUT, '000120', 8_700),
  cargo('2026-10-01T10:15:00', '000015', CUT, '000009', 15_000),
  abono('2026-10-01T10:15:00', '000015', USD, '000009', 95_000),
  cargo('2026-10-01T10:15:00', '000015', USD, '000193', 6_000),
];

/**
 * Datos de ejemplo de la libreta: junio tal cual del Figma y, de ahí en adelante (septiembre más los meses nuevos),
 * movimientos ordenados por fecha con el saldo encadenado por cuenta bancaria y cuenta de registro: cada saldo inicial
 * es el saldo final del movimiento anterior, y el saldo final suma el abono o resta el cargo.
 */
export const MOVIMIENTOS_LIBRETA_REGISTRO: MovimientoLibretaRegistro[] = (() => {
  const junio = MOVIMIENTOS_BASE.filter((m) => m.sec <= '000018');
  const claveSaldo = (m: MovimientoLibretaRegistro): string => `${m.cuentaBancariaId}|${m.beneficiarioCodigo}|${m.numeroCuentaRegistro}`;
  const molde = (n: MovimientoNuevo): MovimientoLibretaRegistro =>
    MOVIMIENTOS_BASE.find((m) => m.cuentaBancariaId === n.cuentaBancariaId && m.beneficiarioCodigo === n.beneficiarioCodigo)!;
  const nuevos: MovimientoLibretaRegistro[] = [
    ...MOVIMIENTOS_BASE.filter((m) => m.sec > '000018').map((m) => ({ ...m })),
    ...MOVIMIENTOS_NUEVOS.map((n) => ({
      ...molde(n),
      ...n,
      saldoInicial: 0,
      saldoFinal: 0,
      documentoId: `doc-${n.numeroDocumento}`,
      descripcionDocumento: DOC_REGISTRO,
    })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.sec.localeCompare(b.sec));

  const saldos = new Map<string, number>();
  junio.forEach((m) => saldos.set(claveSaldo(m), m.saldoFinal));
  nuevos.forEach((m) => {
    const inicial = saldos.get(claveSaldo(m)) ?? 0;
    m.saldoInicial = inicial;
    m.saldoFinal = inicial + m.credito - m.debito;
    saldos.set(claveSaldo(m), m.saldoFinal);
  });
  return [...junio, ...nuevos];
})();

/** Motivo de rechazo de cada documento que el sistema rechazó por traer datos incorrectos (no llegan a la libreta). */
export const DOCUMENTOS_RECHAZADOS: Record<string, string> = {
  '000016-2026': 'El documento no cumple con las validaciones del procedimiento.',
  '000017-2026': 'El saldo final de los registros no coincide con el saldo inicial más abonos y menos cargos.',
  '000018-2026': 'El débito supera el saldo disponible de la cuenta de registro.',
};

const incorrecto = (
  sec: string,
  fecha: string,
  cuentaBancariaId: string,
  beneficiarioCodigo: string,
  tipoOperacionCodigo: string,
  numeroDocumento: string,
  saldos: { saldoInicial: number; debito: number; credito: number; saldoFinal: number },
): MovimientoLibretaRegistro => ({
  ...MOVIMIENTOS_BASE.find((m) => m.cuentaBancariaId === cuentaBancariaId && m.beneficiarioCodigo === beneficiarioCodigo)!,
  sec,
  fecha,
  cuentaBancariaId,
  beneficiarioCodigo,
  tipoOperacionCodigo,
  numeroDocumento,
  documentoId: `doc-${numeroDocumento}`,
  descripcionDocumento: DOC_REGISTRO,
  ...saldos,
});

/**
 * Movimientos de los documentos rechazados, con datos mock incorrectos a propósito (saldos que no cuadran, cargos que
 * dejan la cuenta en negativo). No forman parte de la libreta (`MOVIMIENTOS_LIBRETA_REGISTRO`): solo se ven en la
 * vista del propio documento y en su descarga.
 */
export const MOVIMIENTOS_RECHAZADOS: MovimientoLibretaRegistro[] = [
  incorrecto('000056', '2026-07-15T16:20:00', 'mef-dgtp-cut', '000360', '2', '000016-2026', { saldoInicial: 999_999, debito: 0, credito: 8_000, saldoFinal: 7_500 }),
  incorrecto('000057', '2026-07-15T16:20:00', 'mef-dgtp-cut', '000193', '3', '000016-2026', { saldoInicial: 10_000, debito: 90_000, credito: 0, saldoFinal: -80_000 }),
  incorrecto('000058', '2026-08-27T11:45:00', 'mef-dgtp', '000009', '2', '000017-2026', { saldoInicial: 3_630_000, debito: 0, credito: 150_000, saldoFinal: 3_700_000 }),
  incorrecto('000059', '2026-08-27T11:45:00', 'mef-dgtp-cut', '000120', '2', '000017-2026', { saldoInicial: 46_000, debito: 0, credito: 12_000, saldoFinal: 50_000 }),
  incorrecto('000060', '2026-09-22T09:30:00', 'mef-dgtp-cut', '000366', '3', '000018-2026', { saldoInicial: 19_553, debito: 500_000, credito: 0, saldoFinal: -480_447 }),
];

/** Todos los movimientos que un documento referencia: los de la libreta y, si fue rechazado, los que traía. */
export const movimientosDeDocumento = (numero: string): MovimientoLibretaRegistro[] =>
  [...MOVIMIENTOS_LIBRETA_REGISTRO, ...MOVIMIENTOS_RECHAZADOS].filter((m) => m.numeroDocumento === numero);
