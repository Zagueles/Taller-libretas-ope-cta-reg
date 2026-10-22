import {
  CUENTAS_BANCARIAS_INFO,
  MovimientoLibretaRegistro,
  TIPO_CAMBIO,
  nombreBeneficiario,
  nombreTipoOperacion,
  nombreTipoOperacionCorto,
} from '../models/registro-libretas.model';
import { campoDetalleRegistro, construirDetalleRegistro } from './registro-libretas-detalle.util';
import { importesMN, TIPO_OPERACION_SALDO_INICIAL } from './registro-libretas-saldos.util';

const formatoMonto = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monto = (valor: number): string => formatoMonto.format(valor);

/** aaaa-mm-ddThh:mm:ss → dd/mm/aaaa hh:mm:ss (Figma «Acreditación»: fecha y hora en dos líneas). */
export const fechaHoraVisible = (iso: string): string => {
  const [fecha, hora] = iso.split('T');
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio} ${hora}`;
};

/**
 * La fila de un movimiento con todos los valores que muestran las tablas de los registros (Consultas y reportes y la vista
 * de un documento), ya formateados. `saldosMN` trae el saldo inicial y final en moneda nacional encadenados por libreta
 * (RN-044/045); sin ellos, se convierten con el tipo de compra.
 */
export function filaMovimiento(m: MovimientoLibretaRegistro, saldosMN?: { saldoInicialMN: number; saldoFinalMN: number }): Record<string, string> {
  // Cuentas en dólares: el importe en moneda nacional es el importe por el tipo de cambio (dato de ejemplo).
  // Tipo de cambio SUNAT del día (Compra/Venta), solo relevante para la cuenta en dólares; el sol se convierte 1 a 1.
  const enDolares = CUENTAS_BANCARIAS_INFO.find((c) => c.id === m.cuentaBancariaId)?.moneda === 'USD';
  const tipoCambioCompra = enDolares ? TIPO_CAMBIO.compra : 1;
  const tipoCambioVenta = enDolares ? TIPO_CAMBIO.venta : 1;
  const mn = importesMN(m);
  return {
    id: m.id,
    sec: m.sec,
    // Las tablas solo traen movimientos de la libreta: los de documentos rechazados o pendientes no están en ella.
    estadoConciliacion: 'Conciliado',
    fecha: fechaHoraVisible(m.fecha),
    /** Solo para «Filtros avanzados» (Fecha de acreditación): comparable como aaaa-mm-dd, a diferencia de `fecha`, que ya viene formateada para mostrarse. */
    fechaAcreditacion: m.fecha.slice(0, 10),
    beneficiarioCodigo: m.beneficiarioCodigo,
    beneficiario: nombreBeneficiario(m.beneficiarioCodigo),
    numeroCuentaRegistro: m.numeroCuentaRegistro,
    descripcionCuentaRegistro: m.descripcionCuentaRegistro,
    /** Solo para el subtítulo del grupo «Benef.» en Agrupado/Agregado (Figma nodo 5960:44051). */
    cuentaRegistroResumen: `CR: ${m.numeroCuentaRegistro} - ${m.descripcionCuentaRegistro}`,
    ffSubFf: m.ffSubFf,
    tipoOperacion: nombreTipoOperacion(m.tipoOperacionCodigo),
    tipoOperacionCorto: nombreTipoOperacionCorto(m.tipoOperacionCodigo),
    entidad: m.entidad,
    unidadEjecutora: m.unidadEjecutora,
    grupo: m.grupo,
    saldoInicial: monto(m.saldoInicial),
    debito: monto(m.debito),
    credito: monto(m.credito),
    /** Saldo disponible del movimiento: crédito menos débito (se deriva, no se guarda). */
    saldoDisponible: monto(m.credito - m.debito),
    /** Solo para los totales: el crédito del movimiento interno «Saldo inicial» forma parte del saldo inicial. */
    creditoSaldoInicial: monto(m.tipoOperacionCodigo === TIPO_OPERACION_SALDO_INICIAL ? m.credito : 0),
    creditoSaldoInicialMN: monto(m.tipoOperacionCodigo === TIPO_OPERACION_SALDO_INICIAL ? m.credito * tipoCambioCompra : 0),
    fechaRegistro: construirDetalleRegistro(m).fechaRegistro,
    numeroOperacion: construirDetalleRegistro(m).numeroOperacion,
    tipoBeneficiario: campoDetalleRegistro(m, 'Beneficiario', 'Tipo'),
    entidadAdministradoraCodigo: campoDetalleRegistro(m, 'Entidad administradora', 'Código'),
    entidadAdministradoraSigla: campoDetalleRegistro(m, 'Entidad administradora', 'Sigla'),
    movimientoInternoCodigo: campoDetalleRegistro(m, 'Movimiento interno', 'Código'),
    movimientoInternoDescripcion: campoDetalleRegistro(m, 'Movimiento interno', 'Descripción'),
    movimientoInternoSigla: campoDetalleRegistro(m, 'Movimiento interno', 'Sigla'),
    movimientoExternoCodigo: campoDetalleRegistro(m, 'Movimiento externo', 'Código'),
    movimientoExternoDescripcion: campoDetalleRegistro(m, 'Movimiento externo', 'Descripción'),
    documentoCutNumero: campoDetalleRegistro(m, 'Documento CUT', 'Número'),
    documentoCutArchivo: campoDetalleRegistro(m, 'Documento CUT', 'Archivo'),
    documentoCutSigla: campoDetalleRegistro(m, 'Documento CUT', 'Sigla'),
    descripcionDetallada: construirDetalleRegistro(m).descripcionDetallada,
    numeroDocumento: m.numeroDocumento,
    documentoId: m.documentoId,
    descripcionDocumento: m.descripcionDocumento,
    saldoFinal: monto(m.saldoFinal),
    tipoCotizacion: '1. Compra / Venta',
    tipoCambioCompra: tipoCambioCompra.toFixed(2),
    tipoCambioVenta: tipoCambioVenta.toFixed(2),
    // Moneda nacional (RN-032/033): crédito a tipo de compra, débito a tipo de venta; los saldos van encadenados.
    saldoInicialMN: monto(saldosMN?.saldoInicialMN ?? m.saldoInicial * tipoCambioCompra),
    debitoMN: monto(mn.debito),
    creditoMN: monto(mn.credito),
    saldoDisponibleMN: monto(mn.disponible),
    saldoFinalMN: monto(saldosMN?.saldoFinalMN ?? m.saldoFinal * tipoCambioCompra),
  };
}
