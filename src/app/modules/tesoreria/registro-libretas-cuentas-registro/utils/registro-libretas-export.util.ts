import type { QueryReportColumn, QueryReportExportFormat, QueryReportRow } from '../../../../shared/types/query-report.types';
import { construirDetalleRegistro, DetalleRegistro } from './registro-libretas-detalle.util';

/** Descarga un Blob como archivo. */
function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/**
 * Genera el archivo de «Exportar» de la consulta con las filas de la pestaña activa (tras buscar y filtrar). Las
 * librerías se cargan al exportar, así no pesan en la pantalla hasta que se usan.
 */
export async function exportarLibretasRegistro(formato: QueryReportExportFormat, columnas: QueryReportColumn[], filas: QueryReportRow[]): Promise<void> {
  const fecha = new Date().toISOString().slice(0, 10);
  const nombre = `registro-libretas-cuentas-registro-${fecha}`;
  const encabezados = columnas.map((c) => c.label);
  const valores = filas.map((fila) => columnas.map((c) => fila[c.key] ?? ''));

  if (formato === 'csv') {
    const escapar = (valor: string) => (/[",\n;]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor);
    const contenido = [encabezados, ...valores].map((linea) => linea.map(escapar).join(',')).join('\n');
    // BOM para que Excel abra bien las tildes.
    descargar(new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' }), `${nombre}.csv`);
    return;
  }

  if (formato === 'excel') {
    const { Workbook } = await import('exceljs');
    const libro = new Workbook();
    const hoja = libro.addWorksheet('Movimientos');
    hoja.columns = columnas.map((c) => ({ header: c.label, key: c.key, width: Math.max(14, Math.round((c.width ?? 140) / 7)) }));
    hoja.getRow(1).font = { bold: true };
    filas.forEach((fila) => hoja.addRow(fila));
    const buffer = await libro.xlsx.writeBuffer();
    descargar(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${nombre}.xlsx`);
    return;
  }

  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new jsPDF({ orientation: 'landscape' });
  pdf.setFontSize(14);
  pdf.text('Registro de operaciones en las libretas de las cuentas de registro', 14, 16);
  autoTable(pdf, { head: [encabezados], body: valores, startY: 22, styles: { fontSize: 8 } });
  pdf.save(`${nombre}.pdf`);
}

/** Nombre del PDF de «Ver documento PDF» de un registro: «{operación}-{documento} - detalle de registro...pdf», como en el Figma. */
export function nombrePdfRegistro(detalle: DetalleRegistro): string {
  return `${detalle.numeroOperacion}-${detalle.numeroDocumento} - detalle de registro de Movimiento de la libreta de cuenta de registro.pdf`;
}

/**
 * Arma el PDF de «Ver documento PDF» de un registro de Registros (Figma nodo 429:83188): las mismas secciones que
 * `siaf-registro-libretas-registro`, en una hoja A4. Devuelve el Blob para previsualizarlo en el visor nativo; no lo
 * descarga (eso lo hace el visor con su propio botón).
 */
export async function generarPdfRegistro(sec: string): Promise<{ blob: Blob; nombre: string } | null> {
  const detalle = construirDetalleRegistro(sec);
  if (!detalle) return null;

  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const margen = 14;
  const anchoUtil = 210 - margen * 2;
  let y = margen;

  const salto = (alto: number): void => {
    if (y + alto > 297 - margen) {
      pdf.addPage();
      y = margen;
    }
  };

  const titulo = (): void => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text('DETALLE DE REGISTRO DE OPERACIONES EN LAS', margen, y);
    pdf.text('LIBRETAS DE LAS CUENTAS DE REGISTRO', margen, y + 5.5);
    pdf.setFontSize(11);
    pdf.text('SIAF·RP', 210 - margen, y + 2, { align: 'right' });
    y += 14;
  };

  const subtitulo = (texto: string): void => {
    salto(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(texto.toUpperCase(), margen, y);
    y += 5;
  };

  /** Etiquetas y valores en columnas, como `readonly-field`: 3 por fila (o `anchoCol` para una que ocupe dos). */
  const campos = (filas: { caption: string; value: string; ancho?: 1 | 2 }[]): void => {
    const columnas = 3;
    const anchoCol = anchoUtil / columnas;
    let col = 0;
    for (const campo of filas) {
      const x = margen + col * anchoCol;
      salto(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(campo.caption.toUpperCase(), x, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      const lineas = pdf.splitTextToSize(campo.value || '-', (campo.ancho === 2 ? 2 : 1) * anchoCol - 4);
      pdf.text(lineas, x, y + 4.5);
      col += campo.ancho === 2 ? 2 : 1;
      if (col >= columnas) {
        col = 0;
        y += 4.5 + lineas.length * 4;
      }
    }
    if (col !== 0) y += 12;
    y += 3;
  };

  const linea = (): void => {
    salto(4);
    pdf.setDrawColor(210);
    pdf.line(margen, y, 210 - margen, y);
    y += 5;
  };

  titulo();
  subtitulo('Información de operaciones financieras:');
  campos([
    { caption: 'Fecha registro', value: detalle.fechaRegistro },
    { caption: 'Número de operación', value: detalle.numeroOperacion },
    { caption: 'Tipo de operación', value: detalle.tipoOperacion },
  ]);

  subtitulo('Información de la cuenta bancaria:');
  campos([
    { caption: 'Número de cuenta bancaria', value: detalle.cuenta.numeroCuenta },
    { caption: 'Denominación de la cuenta', value: detalle.cuenta.nombre },
    { caption: 'Entidad financiera', value: 'Banco Central de Reserva del Perú' },
    { caption: 'Moneda', value: detalle.cuenta.moneda },
    { caption: 'Entidad titular de la cuenta', value: 'Ministerio de Economía y Finanzas' },
    { caption: 'Unidad ejecutora', value: '-' },
    { caption: 'Unidad organizacional responsable de la cuenta', value: 'Dirección General del Tesoro Público' },
  ]);
  linea();

  subtitulo('Registro de operación de la libreta');
  for (const seccion of detalle.secciones) {
    subtitulo(seccion.titulo);
    campos(seccion.campos);
  }

  subtitulo('Importe en moneda de la cuenta');
  campos(detalle.importes.map((i) => ({ ...i, ancho: 1 as const })));

  subtitulo('Descripción detallada del registro');
  campos([{ caption: 'Descripción', value: detalle.descripcionDetallada, ancho: 2 }]);
  linea();

  campos([
    { caption: 'Estado de conciliación', value: 'Conciliado' },
    { caption: 'Estado de registro', value: 'Activo' },
  ]);

  return { blob: pdf.output('blob'), nombre: nombrePdfRegistro(detalle) };
}
