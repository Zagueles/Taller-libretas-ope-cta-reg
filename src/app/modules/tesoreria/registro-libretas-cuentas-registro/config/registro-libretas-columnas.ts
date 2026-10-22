import type { ReportTableColumn } from '../../../../shared/ui/report-table/report-table.component';

/**
 * Columnas de los registros de las libretas, las mismas en «Consultas y reportes» y en la vista de un documento: las de
 * siempre visibles y las que solo se activan en «Columnas visibles» (`hiddenByDefault`).
 */
export const COLUMNAS_REGISTRO_LIBRETAS: ReportTableColumn[] = [
      { key: 'sec', label: 'Sec.', panelLabel: 'Secuencia', group: 'Acreditación', width: 90 },
      { key: 'fecha', label: 'Fecha', group: 'Acreditación', width: 130 },
      { key: 'beneficiarioCodigo', label: 'Código', group: 'Beneficiario', width: 90 },
      { key: 'beneficiario', label: 'Descripción', group: 'Beneficiario', width: 230 },
      { key: 'tipoBeneficiario', label: 'Tipo', group: 'Beneficiario', hiddenByDefault: true, width: 130 },
      { key: 'numeroCuentaRegistro', label: 'Número', group: 'Cuenta de registro', width: 300 },
      { key: 'descripcionCuentaRegistro', label: 'Descripción', group: 'Cuenta de registro', width: 320 },
      { key: 'ffSubFf', label: 'Fuente de financiamiento', group: 'Cuenta de registro', width: 260, ungroupWhenGroupHidden: true },
      { key: 'tipoOperacion', label: 'Tipo de operación', width: 190 },
      { key: 'entidad', label: 'Entidad', group: 'Ámbito institucional', width: 110 },
      { key: 'unidadEjecutora', label: 'Unidad ejecutora', group: 'Ámbito institucional', width: 190 },
      { key: 'grupo', label: 'Grupo', group: 'Ámbito institucional', width: 160 },
      { key: 'tipoCotizacion', label: 'Tipo de cotiz.', panelLabel: 'Tipo de cotización', group: 'Tipo de cambio', hiddenByDefault: true, width: 160 },
      { key: 'tipoCambioCompra', label: 'Compra', group: 'Tipo de cambio', hiddenByDefault: true, align: 'right', width: 110 },
      { key: 'tipoCambioVenta', label: 'Venta', group: 'Tipo de cambio', hiddenByDefault: true, align: 'right', width: 110 },
      { key: 'saldoInicial', label: 'Saldo inicial', group: 'Imp. m. cuenta', align: 'right', width: 120 },
      { key: 'debito', label: 'Débito', group: 'Imp. m. cuenta', align: 'right', width: 110 },
      { key: 'credito', label: 'Crédito', group: 'Imp. m. cuenta', align: 'right', width: 110 },
      { key: 'saldoDisponible', label: 'Saldo disponible', group: 'Imp. m. cuenta', hiddenByDefault: true, align: 'right', width: 140 },
      { key: 'saldoInicialMN', label: 'Saldo inicial', group: 'Imp. m. nacional', hiddenByDefault: true, align: 'right', width: 130 },
      { key: 'debitoMN', label: 'Débito', group: 'Imp. m. nacional', hiddenByDefault: true, align: 'right', width: 120 },
      { key: 'creditoMN', label: 'Crédito', group: 'Imp. m. nacional', hiddenByDefault: true, align: 'right', width: 130 },
      { key: 'saldoDisponibleMN', label: 'Saldo disponible', group: 'Imp. m. nacional', hiddenByDefault: true, align: 'right', width: 140 },
      { key: 'saldoFinalMN', label: 'Saldo final', group: 'Imp. m. nacional', hiddenByDefault: true, align: 'right', width: 140 },
      // «Más columnas» del detalle del registro (las mismas de la pestaña Registros): ocultas hasta que se activen.
      { key: 'fechaRegistro', label: 'Fecha de registro', hiddenByDefault: true, width: 170 },
      { key: 'numeroOperacion', label: 'Número de operación', hiddenByDefault: true, width: 170 },
      { key: 'entidadAdministradoraCodigo', label: 'Código', group: 'Entidad administradora', hiddenByDefault: true, width: 120 },
      { key: 'entidadAdministradoraSigla', label: 'Sigla', group: 'Entidad administradora', hiddenByDefault: true, width: 120 },
      { key: 'movimientoInternoCodigo', label: 'Código', group: 'Movimiento interno', hiddenByDefault: true, width: 120 },
      { key: 'movimientoInternoDescripcion', label: 'Descripción', group: 'Movimiento interno', hiddenByDefault: true, width: 260 },
      { key: 'movimientoInternoSigla', label: 'Sigla', group: 'Movimiento interno', hiddenByDefault: true, width: 100 },
      { key: 'movimientoExternoCodigo', label: 'Código', group: 'Movimiento externo', hiddenByDefault: true, width: 120 },
      { key: 'movimientoExternoDescripcion', label: 'Descripción', group: 'Movimiento externo', hiddenByDefault: true, width: 200 },
      { key: 'documentoCutNumero', label: 'Número', group: 'Documento CUT', hiddenByDefault: true, width: 130 },
      { key: 'documentoCutArchivo', label: 'Archivo', group: 'Documento CUT', hiddenByDefault: true, width: 130 },
      { key: 'documentoCutSigla', label: 'Sigla', group: 'Documento CUT', hiddenByDefault: true, width: 100 },
      { key: 'descripcionDetallada', label: 'Descripción detallada', hiddenByDefault: true, width: 260 },
      { key: 'estadoConciliacion', label: 'Estado de conciliación', hiddenByDefault: true, width: 170 },
      { key: 'numeroDocumento', label: 'Número', group: 'Documento', hiddenByDefault: true, width: 150, kind: 'link' },
      { key: 'descripcionDocumento', label: 'Descripción', group: 'Documento', hiddenByDefault: true, width: 300 },
      { key: 'saldoFinal', label: 'Saldo final', group: 'Imp. m. cuenta', align: 'right', width: 135, fixed: true },
];

/** Columnas que solo interesan en la cuenta en dólares (tipo de cambio e importe en moneda nacional): visibles por
 *  defecto solo en esa cuenta (Figma nodo 6094:125648); en soles quedan disponibles en «Columnas visibles». */
export const COLUMNAS_MONEDA_EXTRANJERA: ReadonlySet<string> = new Set(['tipoCotizacion', 'tipoCambioCompra', 'tipoCambioVenta', 'saldoInicialMN', 'debitoMN', 'creditoMN', 'saldoDisponibleMN', 'saldoFinalMN']);
