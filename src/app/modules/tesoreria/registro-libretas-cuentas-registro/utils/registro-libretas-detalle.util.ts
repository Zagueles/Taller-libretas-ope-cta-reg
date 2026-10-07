import {
  CODIGO_ENTIDAD,
  CUENTAS_BANCARIAS_INFO,
  CuentaBancariaRegistroInfo,
  TIPO_CAMBIO,
  MovimientoLibretaRegistro,
  nombreBeneficiario,
  nombreTipoOperacion,
} from '../models/registro-libretas.model';

const formatoMonto = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monto = (valor: number): string => formatoMonto.format(valor);

const fechaVisible = (iso: string): string => iso.slice(0, 10).split('-').reverse().join('/');

/** Movimiento interno por tipo de operación (código, descripción y sigla). */
const MOVIMIENTO_INTERNO: Record<string, { codigo: string; descripcion: string; sigla: string }> = {
  '1': { codigo: 'SI0001', descripcion: 'Saldos iniciales', sigla: 'SI' },
  '2': { codigo: 'RR0002', descripcion: 'Reporte de recaudación SUNAT', sigla: 'RR' },
  '3': { codigo: 'DV0003', descripcion: 'Devolución', sigla: 'DV' },
};

const SIN_DATO = '-';

export interface DetalleRegistroCampo {
  caption: string;
  value: string;
  ancho?: 1 | 2;
}

export interface DetalleRegistroSeccion {
  titulo: string;
  campos: DetalleRegistroCampo[];
}

export interface DetalleRegistro {
  sec: string;
  numeroDocumento: string;
  cuenta: CuentaBancariaRegistroInfo;
  tipoOperacion: string;
  fechaRegistro: string;
  numeroOperacion: string;
  secciones: DetalleRegistroSeccion[];
  importes: DetalleRegistroCampo[];
  /** Solo en cuentas en dólares: los mismos cuatro importes convertidos a soles con el tipo de cambio de compra; vacío en soles. */
  importesNacional: DetalleRegistroCampo[];
  descripcionDetallada: string;
  /** Registro de un documento rechazado: sin estado de registro y «No conciliado». */
  rechazado: boolean;
}

/**
 * Arma el detalle de un registro de la libreta (Figma nodo 241:20830) a partir del movimiento que entrega el backend:
 * lo usan tanto la pantalla de detalle (`siaf-registro-libretas-registro`) como el PDF de «Ver documento PDF» y los
 * Excel de Registros, así quedan siempre iguales. `rechazado` es de los movimientos de un documento rechazado, que también
 * se pueden abrir desde la vista de su documento.
 */
export function construirDetalleRegistro(m: MovimientoLibretaRegistro, rechazado = false): DetalleRegistro {
  const cuenta = CUENTAS_BANCARIAS_INFO.find((c) => c.id === m.cuentaBancariaId) ?? CUENTAS_BANCARIAS_INFO[0];
  const interno = MOVIMIENTO_INTERNO[m.tipoOperacionCodigo] ?? { codigo: SIN_DATO, descripcion: SIN_DATO, sigla: SIN_DATO };
  const tipo = nombreTipoOperacion(m.tipoOperacionCodigo);
  const enDolares = cuenta.moneda === 'USD';
  const { compra, venta } = TIPO_CAMBIO;
  const codigoUe = m.entidad === 'MINCETUR' ? '11111107004  - ' : '';
  return {
    rechazado,
    sec: m.sec,
    numeroDocumento: m.numeroDocumento,
    cuenta,
    tipoOperacion: tipo,
    fechaRegistro: `${fechaVisible(m.fecha)}  18:01:00`,
    numeroOperacion: `1234${m.sec.slice(-4)}`,
    secciones: [
      {
        titulo: 'Acreditación',
        campos: [
          { caption: 'Secuencia', value: m.sec },
          { caption: 'Fecha', value: `${fechaVisible(m.fecha)}  ${m.fecha.slice(11, 19)}` },
        ],
      },
      {
        titulo: 'Beneficiario',
        campos: [
          { caption: 'Código', value: m.beneficiarioCodigo },
          { caption: 'Tipo', value: 'Concepto' },
          { caption: 'Descripción', value: nombreBeneficiario(m.beneficiarioCodigo).toUpperCase() },
        ],
      },
      {
        titulo: 'Cuenta de registro',
        campos: [
          { caption: 'Número', value: m.numeroCuentaRegistro },
          { caption: 'Descripción', value: m.descripcionCuentaRegistro, ancho: 2 },
        ],
      },
      {
        titulo: 'Ámbito institucional',
        campos: [
          { caption: 'Entidad', value: `${CODIGO_ENTIDAD[m.entidad] ?? ''} - ${m.entidad}` },
          { caption: 'Unidad ejecutora', value: m.entidad === 'MEF' ? SIN_DATO : `${codigoUe}${m.unidadEjecutora}` },
          { caption: 'Grupo', value: m.grupo },
        ],
      },
      { titulo: 'Entidad administradora', campos: [{ caption: 'Código', value: SIN_DATO }, { caption: 'Sigla', value: SIN_DATO }] },
      {
        titulo: 'Movimiento interno',
        campos: [
          { caption: 'Código', value: interno.codigo },
          { caption: 'Descripción', value: interno.descripcion },
          { caption: 'Sigla', value: interno.sigla },
        ],
      },
      { titulo: 'Movimiento externo', campos: [{ caption: 'Código', value: SIN_DATO }, { caption: 'Descripción', value: SIN_DATO }] },
      {
        titulo: 'Documento CUT',
        campos: [
          { caption: 'Número', value: SIN_DATO },
          { caption: 'Archivo', value: SIN_DATO },
          { caption: 'Sigla', value: SIN_DATO },
        ],
      },
      ...(enDolares
        ? [
            {
              titulo: 'Tipo de cambio',
              campos: [
                { caption: 'Tipo de cotización', value: '01 - Compra / Venta' },
                { caption: 'Compra', value: compra.toFixed(2) },
                { caption: 'Venta', value: venta.toFixed(2) },
              ],
            },
          ]
        : []),
    ],
    importes: [
      { caption: 'Saldo inicial', value: monto(m.saldoInicial) },
      { caption: 'Débito', value: monto(m.debito) },
      { caption: 'Crédito', value: monto(m.credito) },
      { caption: 'Saldo final', value: monto(m.saldoFinal) },
    ],
    importesNacional: enDolares
      ? [
          { caption: 'Saldo inicial', value: monto(m.saldoInicial * compra) },
          { caption: 'Débito', value: monto(m.debito * compra) },
          { caption: 'Crédito', value: monto(m.credito * compra) },
          { caption: 'Saldo final', value: monto(m.saldoFinal * compra) },
        ]
      : [],
    descripcionDetallada: `Registro de ${tipo.split(' - ')[1]?.toLowerCase() ?? tipo.toLowerCase()}`,
  };
}
