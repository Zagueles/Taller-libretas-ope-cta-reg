import { DetalleRegistro } from '../registro-libretas-detalle.util';
import { ANCHO_QR, MARGEN_QR, cargarLogo, cargarQr, textoTrazabilidadQr } from './pdf-comun.util';
import { fechaHoraActual } from './formato-exportacion.util';

/** Nombre del PDF de «Ver documento PDF» de un registro: «{operación}-{documento} - detalle de registro...pdf», como en el Figma. */
export function nombrePdfRegistro(detalle: DetalleRegistro): string {
  return `${detalle.numeroOperacion}-${detalle.numeroDocumento} - detalle de registro de Movimiento de la libreta de cuenta de registro.pdf`;
}

/**
 * Arma el PDF de «Ver documento PDF» de un registro de Registros (Figma nodo 440:84666, «PDF 600»): las mismas
 * secciones que `siaf-registro-libretas-registro`, en hojas A4 con la cabecera y el pie de SIAF·RP. Devuelve el Blob
 * para previsualizarlo en el visor nativo; no lo descarga (eso lo hace el visor con su propio botón).
 */
export async function generarPdfRegistro(detalle: DetalleRegistro): Promise<{ blob: Blob; nombre: string; paginas: number }> {

  const [{ default: jsPDF }, logo, qr] = await Promise.all([
    import('jspdf'),
    cargarLogo(),
    cargarQr(textoTrazabilidadQr(detalle.numeroDocumento, detalle.fechaRegistro)),
  ]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const margen = 16;
  const anchoUtil = 210 - margen * 2;
  const altoPagina = 297;
  const altoPie = 12;
  let y = margen;

  const encabezado = (): void => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text('DETALLE DE REGISTRO DE OPERACIONES EN LAS', margen, y);
    pdf.text('LIBRETAS DE LAS CUENTAS DE REGISTRO', margen, y + 5.5);
    if (logo) {
      const anchoLogo = 24;
      pdf.addImage(logo.dataUrl, 'PNG', 210 - margen - anchoLogo, y - 3.5, anchoLogo, anchoLogo / logo.proporcion);
    }
    y += 12;
    pdf.setDrawColor(220);
    pdf.line(margen, y, 210 - margen, y);
    y += 8;
  };

  const salto = (alto: number): void => {
    if (y + alto > altoPagina - altoPie - margen) {
      pdf.addPage();
      y = margen;
      encabezado();
    }
  };

  const subtitulo = (texto: string): void => {
    salto(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(texto.toUpperCase(), margen, y);
    y += 5;
  };

  /** Etiquetas y valores en columnas, como `readonly-field`: 3 por fila (o `anchoCol` para una que ocupe dos). */
  const campos = (filas: { caption: string; value: string; ancho?: 1 | 2 }[], anchoDisponible = anchoUtil, columnas = 3): void => {
    const anchoCol = anchoDisponible / columnas;
    let col = 0;
    /** Líneas de la caja más alta de la fila: toda la fila (y lo que sigue) respeta ese alto. */
    let lineasFila = 1;
    for (const campo of filas) {
      const x = margen + col * anchoCol;
      const ocupa = Math.min(campo.ancho === 2 ? 2 : 1, columnas);
      salto(11 + (lineasFila - 1) * 4);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(campo.caption.toUpperCase(), x, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      const lineas = pdf.splitTextToSize(campo.value || '-', ocupa * anchoCol - 4);
      pdf.text(lineas, x, y + 4.5);
      lineasFila = Math.max(lineasFila, lineas.length);
      col += ocupa;
      if (col >= columnas) {
        col = 0;
        y += 4.5 + lineasFila * 4 + (columnas === 1 ? 3 : 0);
        lineasFila = 1;
      }
    }
    if (col !== 0) y += Math.max(12, 4.5 + lineasFila * 4);
    y += 3;
  };

  /** Alto que ocupará `campos` con esas filas, sin dibujar: para decidir si una sección entera cabe en la hoja. */
  const medirCampos = (filas: { caption: string; value: string; ancho?: 1 | 2 }[], anchoDisponible = anchoUtil, columnas = 3): number => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    const anchoCol = anchoDisponible / columnas;
    let col = 0;
    let lineasFila = 1;
    let total = 0;
    for (const campo of filas) {
      const ocupa = Math.min(campo.ancho === 2 ? 2 : 1, columnas);
      lineasFila = Math.max(lineasFila, (pdf.splitTextToSize(campo.value || '-', ocupa * anchoCol - 4) as string[]).length);
      col += ocupa;
      if (col >= columnas) {
        total += 4.5 + lineasFila * 4 + (columnas === 1 ? 3 : 0);
        col = 0;
        lineasFila = 1;
      }
    }
    if (col !== 0) total += Math.max(12, 4.5 + lineasFila * 4);
    return total + 3;
  };

  /** Fila de 4 montos resaltados (Figma «Importe en moneda de la cuenta»): caja celeste, etiqueta arriba y el valor en negrita a la derecha. */
  const importesDestacados = (filas: { caption: string; value: string }[]): void => {
    const alto = 11;
    salto(alto + 3);
    const gap = 4;
    const anchoCaja = (anchoUtil - gap * (filas.length - 1)) / filas.length;
    filas.forEach((campo, i) => {
      const x = margen + i * (anchoCaja + gap);
      pdf.setFillColor(1, 72, 153);
      pdf.setGState(pdf.GState({ opacity: 0.08 }));
      pdf.roundedRect(x, y, anchoCaja, alto, 1, 1, 'F');
      pdf.setGState(pdf.GState({ opacity: 1 }));
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.text(campo.caption, x + 2, y + 4);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.text(campo.value, x + anchoCaja - 2, y + 8.5, { align: 'right' });
    });
    y += alto + 7; // aire antes del siguiente título (si no, «Descripción detallada» quedaba pegado a las cajas)
  };

  const linea = (): void => {
    salto(4);
    pdf.setDrawColor(210);
    pdf.line(margen, y, 210 - margen, y);
    y += 9; // el mismo aire debajo del divisor que encima
  };

  encabezado();
  // QR de verificación (Figma 440:84666): solo en la primera hoja, a la altura de «Información de operaciones financieras».
  const yQr = y;
  if (qr) pdf.addImage(qr, 'PNG', 210 - margen - ANCHO_QR, yQr, ANCHO_QR, ANCHO_QR);
  subtitulo('Información de operaciones financieras:');
  // Área de seguridad: los campos de esta franja se reparten a la izquierda del QR, sin pasar por debajo de él.
  campos(
    [
      { caption: 'Fecha registro', value: detalle.fechaRegistro },
      { caption: 'Número de operación', value: detalle.numeroOperacion },
      { caption: 'Tipo de operación', value: detalle.tipoOperacion },
    ],
    qr ? anchoUtil - ANCHO_QR - MARGEN_QR : anchoUtil,
  );
  if (qr) y = Math.max(y, yQr + ANCHO_QR + 3);

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
    const columnasSeccion = seccion.titulo === 'Cuenta de registro' ? 1 : 3;
    // Una sección no se parte entre hojas: si su título y sus campos no caben, pasa entera a la siguiente.
    salto(5 + medirCampos(seccion.campos, anchoUtil, columnasSeccion));
    subtitulo(seccion.titulo);
    // «Cuenta de registro»: la descripción (larga) va debajo del número, no al lado.
    campos(seccion.campos, anchoUtil, columnasSeccion);
  }

  salto(5 + 11 + 7);
  subtitulo('Importe en moneda de la cuenta');
  importesDestacados(detalle.importes);
  if (detalle.importesNacional.length) {
    salto(5 + 11 + 7);
    subtitulo('Importe en moneda nacional');
    importesDestacados(detalle.importesNacional);
  }

  const descripcionDetallada = [{ caption: 'Descripción', value: detalle.descripcionDetallada, ancho: 2 as const }];
  salto(5 + medirCampos(descripcionDetallada));
  subtitulo('Descripción detallada del registro');
  campos(descripcionDetallada);
  linea();

  campos([
    { caption: 'Estado de conciliación', value: detalle.rechazado ? 'No conciliado' : 'Conciliado' },
    { caption: 'Estado de registro', value: detalle.rechazado ? '-' : 'Activo' },
  ]);

  // Pie de página (Figma «Pie de página - Membrete»): divider + «Creado …» y «Página X de Y» en todas las hojas.
  const totalPaginas = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    pdf.setPage(p);
    const yPie = altoPagina - margen + 2;
    pdf.setDrawColor(230);
    pdf.line(margen, yPie - 4, 210 - margen, yPie - 4);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.text(`Creado ${fechaHoraActual()}`, margen, yPie);
    pdf.text(`Página ${p} de ${totalPaginas}`, 210 - margen, yPie, { align: 'right' });
  }

  return { blob: pdf.output('blob'), nombre: nombrePdfRegistro(detalle), paginas: totalPaginas };
}
