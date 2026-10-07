import { cargarWorkbook } from '../../../../../shared/utils/librerias-dinamicas.util';
import { CUENTAS_BANCARIAS_INFO, MovimientoLibretaRegistro, nombreBeneficiario, nombreTipoOperacion } from '../../models/registro-libretas.model';
import { construirDetalleRegistro } from '../registro-libretas-detalle.util';
import { AZUL, BLANCO, BORDES, aFecha, relleno } from './estilos-excel.util';
import { descargar, fechaHoraActual, fechaHoraVisible } from './formato-exportacion.util';

const AZUL_TABLA = 'FF04589D';

const TITULO_DESCARGA = 'DOCUMENTOS DE OPERACIONES EN LAS LIBRETAS DE LAS CUENTAS DE REGISTRO';

export interface FiltroDescarga {
  label: string;
  value: string;
}

type Hoja = import('exceljs').Worksheet;

/** Hoja «Resumen» de las dos descargas: título, hora de creación, sección y los dos filtros rápidos aplicados. */
function resumenDescarga(libro: import('exceljs').Workbook, seccion: string, filtros: FiltroDescarga[], anchos: number[]): void {
  const resumen = libro.addWorksheet('Resumen', { views: [{ zoomScale: 100, zoomScaleNormal: 100 }] });
  anchos.forEach((ancho, i) => (resumen.getColumn(i + 1).width = ancho));
  for (let f = 1; f <= 14; f++) for (let c = 1; c <= 14; c++) resumen.getCell(f, c).fill = relleno(BLANCO);

  resumen.getRow(2).height = 26;
  resumen.getCell('B2').value = TITULO_DESCARGA;
  resumen.getCell('B2').font = { name: 'Calibri', bold: true, size: 20, color: { argb: AZUL } };
  resumen.getCell('B3').value = `Creado ${fechaHoraActual().replace('  ', '    ')}`;
  resumen.getCell('B3').font = { name: 'Calibri', italic: true, size: 11 };
  resumen.getRow(7).height = 19;
  resumen.getCell('B7').value = seccion;
  resumen.getCell('B7').font = { name: 'Calibri', bold: true, size: 14, color: { argb: AZUL } };
  for (let c = 2; c <= 14; c++) resumen.getCell(7, c).border = { bottom: { style: 'hair' } };

  // Cada filtro rápido con su etiqueta en negrita (columnas B y F) y debajo el valor aplicado.
  filtros.slice(0, 2).forEach((filtro, i) => {
    const col = i === 0 ? 2 : 6;
    resumen.getCell(9, col).value = filtro.label;
    resumen.getCell(9, col).font = { name: 'Calibri', bold: true, size: 11 };
    resumen.getCell(10, col).value = filtro.value;
    resumen.getCell(10, col).font = { name: 'Calibri', size: 11 };
    resumen.getCell(10, col).alignment = { horizontal: 'left' };
  });
}

function cabeceraTabla(celda: import('exceljs').Cell, horizontal: 'left' | 'center' | 'right'): void {
  celda.fill = relleno(AZUL_TABLA);
  celda.font = { name: 'Calibri', bold: true, size: 14, color: { argb: BLANCO } };
  celda.alignment = { horizontal, vertical: 'middle', wrapText: true };
  celda.border = BORDES;
}

async function guardarLibro(libro: import('exceljs').Workbook, nombre: string): Promise<void> {
  const buffer = await libro.xlsx.writeBuffer();
  descargar(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombre);
}

export interface DocumentoDescarga {
  document: string;
  number: string;
  actionType: string;
  status: string;
  system: string;
  dateIso: string;
  entity: string;
}

/** Excel de los documentos elegidos en la pestaña Documentos (plantilla «Documentos_existentes»). */
export async function exportarDocumentosExcel(documentos: DocumentoDescarga[], filtros: FiltroDescarga[]): Promise<void> {
  await guardarLibro(await construirLibroDocumentos(documentos, filtros), 'Documentos_existentes.xlsx');
}

/** Arma el libro de documentos sin descargarlo (lo que prueban los tests). */
export async function construirLibroDocumentos(documentos: DocumentoDescarga[], filtros: FiltroDescarga[]): Promise<import('exceljs').Workbook> {
  const Workbook = await cargarWorkbook();
  const libro = new Workbook();
  resumenDescarga(libro, 'DOCUMENTOS EXISTENTES', filtros, [3.5, 57.2, 9.2, 9.2, 9.2, 16.2]);

  const hoja: Hoja = libro.addWorksheet('Resultado');
  const columnas: [string, number][] = [['Documento', 30], ['Número', 17.5], ['Tipo de acción', 19.5], ['Estado', 12], ['Sistema', 25], ['Fecha de registro', 22], ['Entidad', 30]];
  hoja.getRow(1).height = 30;
  columnas.forEach(([titulo, ancho], i) => {
    hoja.getColumn(i + 1).width = ancho;
    hoja.getCell(1, i + 1).value = titulo;
    cabeceraTabla(hoja.getCell(1, i + 1), 'left');
  });
  documentos.forEach((d, i) => {
    const f = i + 2;
    hoja.getRow(f).height = 40;
    const valores: Array<string | Date> = [d.document, d.number, d.actionType, d.status, d.system, aFecha(d.dateIso), d.entity];
    valores.forEach((valor, c) => {
      const celda = hoja.getCell(f, c + 1);
      celda.value = valor;
      celda.border = BORDES;
      celda.fill = relleno(BLANCO);
      celda.font = { name: 'Calibri', size: 11 };
      celda.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      if (valor instanceof Date) celda.numFmt = 'mm-dd-yy';
    });
  });
  return libro;
}

interface ColumnaRegistro {
  key: string;
  grupo?: string;
  rotulo: string;
  ancho: number;
  alinea: 'left' | 'center' | 'right';
  valor: (m: MovimientoLibretaRegistro) => string | number;
}

const campoDetalleExcel = (m: MovimientoLibretaRegistro, seccion: string, caption: string): string =>
  construirDetalleRegistro(m).secciones.find((x) => x.titulo === seccion)?.campos.find((c) => c.caption === caption)?.value ?? '-';

const cuentaDe = (m: MovimientoLibretaRegistro) => CUENTAS_BANCARIAS_INFO.find((c) => c.id === m.cuentaBancariaId);

/** Todas las columnas posibles de la pestaña Registros, en el orden del Excel; la descarga lleva las que están visibles. */
const COLUMNAS_REGISTRO: ColumnaRegistro[] = [
  { key: 'sec', grupo: 'Acreditación', rotulo: 'Secuencia', ancho: 12, alinea: 'left', valor: (m) => m.sec },
  { key: 'fecha', grupo: 'Acreditación', rotulo: 'Fecha', ancho: 20.3, alinea: 'left', valor: (m) => fechaHoraVisible(m.fecha) },
  { key: 'cuentaBancariaNumero', grupo: 'Cuenta bancaria', rotulo: 'Número', ancho: 24, alinea: 'left', valor: (m) => cuentaDe(m)?.numeroCuenta ?? '' },
  { key: 'cuentaBancariaDenominacion', grupo: 'Cuenta bancaria', rotulo: 'Denominación', ancho: 24, alinea: 'left', valor: (m) => cuentaDe(m)?.nombre ?? '' },
  { key: 'moneda', rotulo: 'Moneda', ancho: 12, alinea: 'center', valor: (m) => cuentaDe(m)?.moneda ?? '' },
  { key: 'beneficiarioCodigo', grupo: 'Beneficiario', rotulo: 'Código', ancho: 12, alinea: 'left', valor: (m) => m.beneficiarioCodigo },
  { key: 'beneficiario', grupo: 'Beneficiario', rotulo: 'Descripción', ancho: 37, alinea: 'left', valor: (m) => nombreBeneficiario(m.beneficiarioCodigo).toUpperCase() },
  { key: 'tipoBeneficiario', grupo: 'Beneficiario', rotulo: 'Tipo', ancho: 14, alinea: 'left', valor: (m) => campoDetalleExcel(m, 'Beneficiario', 'Tipo') },
  { key: 'numeroCuentaRegistro', grupo: 'Cuenta de registro', rotulo: 'Número', ancho: 26.5, alinea: 'left', valor: (m) => m.numeroCuentaRegistro },
  { key: 'descripcionCuentaRegistro', grupo: 'Cuenta de registro', rotulo: 'Descripción', ancho: 73.8, alinea: 'left', valor: (m) => m.descripcionCuentaRegistro },
  { key: 'tipoOperacion', rotulo: 'Tipo de operación', ancho: 32, alinea: 'left', valor: (m) => nombreTipoOperacion(m.tipoOperacionCodigo) },
  { key: 'entidad', grupo: 'Ámbito institucional', rotulo: 'Entidad', ancho: 13.2, alinea: 'left', valor: (m) => m.entidad },
  { key: 'unidadEjecutora', grupo: 'Ámbito institucional', rotulo: 'Unidad ejecutora', ancho: 30.3, alinea: 'left', valor: (m) => (m.entidad === 'MEF' ? '-' : m.unidadEjecutora) },
  { key: 'grupo', grupo: 'Ámbito institucional', rotulo: 'Grupo', ancho: 20.5, alinea: 'left', valor: (m) => m.grupo },
  { key: 'saldoInicial', grupo: 'Importe en moneda de la cuenta', rotulo: 'Saldo inicial', ancho: 15, alinea: 'right', valor: (m) => m.saldoInicial },
  { key: 'debito', grupo: 'Importe en moneda de la cuenta', rotulo: 'Débito', ancho: 13, alinea: 'right', valor: (m) => m.debito },
  { key: 'credito', grupo: 'Importe en moneda de la cuenta', rotulo: 'Crédito', ancho: 13, alinea: 'right', valor: (m) => m.credito },
  { key: 'saldoFinal', grupo: 'Importe en moneda de la cuenta', rotulo: 'Saldo final', ancho: 15, alinea: 'right', valor: (m) => m.saldoFinal },
  { key: 'status', rotulo: 'Estado de registro', ancho: 14, alinea: 'center', valor: () => 'Activo' },
  { key: 'number', grupo: 'Documento', rotulo: 'Número', ancho: 16.7, alinea: 'left', valor: (m) => m.numeroDocumento },
  { key: 'descripcionDocumento', grupo: 'Documento', rotulo: 'Descripción', ancho: 59, alinea: 'left', valor: (m) => m.descripcionDocumento },
  { key: 'fechaRegistro', rotulo: 'Fecha de registro', ancho: 22, alinea: 'left', valor: (m) => construirDetalleRegistro(m).fechaRegistro },
  { key: 'numeroOperacion', rotulo: 'Número de operación', ancho: 20, alinea: 'left', valor: (m) => construirDetalleRegistro(m).numeroOperacion },
  { key: 'entidadAdministradoraCodigo', grupo: 'Entidad administradora', rotulo: 'Código', ancho: 14, alinea: 'left', valor: (m) => campoDetalleExcel(m, 'Entidad administradora', 'Código') },
  { key: 'entidadAdministradoraSigla', grupo: 'Entidad administradora', rotulo: 'Sigla', ancho: 14, alinea: 'left', valor: (m) => campoDetalleExcel(m, 'Entidad administradora', 'Sigla') },
  { key: 'movimientoInternoCodigo', grupo: 'Movimiento interno', rotulo: 'Código', ancho: 14, alinea: 'left', valor: (m) => campoDetalleExcel(m, 'Movimiento interno', 'Código') },
  { key: 'movimientoInternoDescripcion', grupo: 'Movimiento interno', rotulo: 'Descripción', ancho: 32, alinea: 'left', valor: (m) => campoDetalleExcel(m, 'Movimiento interno', 'Descripción') },
  { key: 'movimientoInternoSigla', grupo: 'Movimiento interno', rotulo: 'Sigla', ancho: 12, alinea: 'left', valor: (m) => campoDetalleExcel(m, 'Movimiento interno', 'Sigla') },
  { key: 'movimientoExternoCodigo', grupo: 'Movimiento externo', rotulo: 'Código', ancho: 14, alinea: 'left', valor: (m) => campoDetalleExcel(m, 'Movimiento externo', 'Código') },
  { key: 'movimientoExternoDescripcion', grupo: 'Movimiento externo', rotulo: 'Descripción', ancho: 24, alinea: 'left', valor: (m) => campoDetalleExcel(m, 'Movimiento externo', 'Descripción') },
  { key: 'documentoCutNumero', grupo: 'Documento CUT', rotulo: 'Número', ancho: 14, alinea: 'left', valor: (m) => campoDetalleExcel(m, 'Documento CUT', 'Número') },
  { key: 'documentoCutArchivo', grupo: 'Documento CUT', rotulo: 'Archivo', ancho: 14, alinea: 'left', valor: (m) => campoDetalleExcel(m, 'Documento CUT', 'Archivo') },
  { key: 'documentoCutSigla', grupo: 'Documento CUT', rotulo: 'Sigla', ancho: 12, alinea: 'left', valor: (m) => campoDetalleExcel(m, 'Documento CUT', 'Sigla') },
  { key: 'descripcionDetallada', rotulo: 'Descripción detallada', ancho: 32, alinea: 'left', valor: (m) => construirDetalleRegistro(m).descripcionDetallada },
];

/**
 * Excel de los registros elegidos en la pestaña Registros (plantilla «Registros_existentes»): la tabla de dos filas de
 * cabecera. Lleva las columnas visibles en la tabla (`columnasVisibles`): las de siempre, la cuenta bancaria y las que
 * la persona activó en «Más columnas». Sin ese dato, las predeterminadas.
 */
export async function exportarRegistrosExcel(movimientos: MovimientoLibretaRegistro[], filtros: FiltroDescarga[], columnasVisibles?: string[]): Promise<void> {
  await guardarLibro(await construirLibroRegistros(movimientos, filtros, columnasVisibles), 'Registros_existentes.xlsx');
}

/** Arma el libro de registros sin descargarlo (lo que prueban los tests). */
export async function construirLibroRegistros(
  movimientos: MovimientoLibretaRegistro[],
  filtros: FiltroDescarga[],
  columnasVisibles?: string[],
): Promise<import('exceljs').Workbook> {
  const Workbook = await cargarWorkbook();
  const libro = new Workbook();
  resumenDescarga(libro, 'REGISTROS EXISTENTES', filtros, [10.7, 10.7, 10.7, 10.7, 10.7, 11.8]);

  const hoja: Hoja = libro.addWorksheet('Resultado', { pageSetup: { orientation: 'landscape' } });
  const visibles = columnasVisibles ? new Set(columnasVisibles) : null;
  const columnas = COLUMNAS_REGISTRO.filter((c) => (visibles ? visibles.has(c.key) : !EXTRAS_REGISTRO.has(c.key)));

  hoja.getRow(1).height = 21.75;
  hoja.getRow(2).height = 30;
  for (let i = 0; i < columnas.length; ) {
    const c = columnas[i];
    let fin = i;
    if (c.grupo) while (fin + 1 < columnas.length && columnas[fin + 1].grupo === c.grupo) fin++;
    for (let k = i; k <= fin; k++) {
      hoja.getColumn(k + 1).width = columnas[k].ancho;
      for (const f of [1, 2]) cabeceraTabla(hoja.getCell(f, k + 1), f === 2 && columnas[k].alinea === 'right' ? 'right' : 'center');
    }
    if (!c.grupo) {
      hoja.mergeCells(1, i + 1, 2, i + 1);
      hoja.getCell(1, i + 1).value = c.rotulo;
    } else {
      if (fin > i) hoja.mergeCells(1, i + 1, 1, fin + 1);
      hoja.getCell(1, i + 1).value = c.grupo;
      for (let k = i; k <= fin; k++) hoja.getCell(2, k + 1).value = columnas[k].rotulo;
    }
    i = fin + 1;
  }

  movimientos.forEach((m, i) => {
    const f = i + 3;
    hoja.getRow(f).height = 25.5;
    columnas.forEach((col, c) => {
      const valor = col.valor(m);
      const celda = hoja.getCell(f, c + 1);
      celda.value = valor;
      celda.border = BORDES;
      celda.font = { name: 'Calibri', size: 11 };
      celda.alignment = { horizontal: col.alinea, vertical: 'middle' };
      if (typeof valor === 'number') celda.numFmt = '#,##0.00';
    });
  });
  return libro;
}

/** Las que solo salen en el Excel si la persona las activó en «Más columnas». */
const EXTRAS_REGISTRO = new Set([
  'fechaRegistro', 'numeroOperacion', 'tipoBeneficiario', 'entidadAdministradoraCodigo', 'entidadAdministradoraSigla', 'movimientoInternoCodigo',
  'movimientoInternoDescripcion', 'movimientoInternoSigla', 'movimientoExternoCodigo', 'movimientoExternoDescripcion', 'documentoCutNumero',
  'documentoCutArchivo', 'documentoCutSigla', 'descripcionDetallada',
]);
