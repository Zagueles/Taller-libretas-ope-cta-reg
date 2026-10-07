import { CUENTAS_BANCARIAS_INFO, DetalleDocumentoLibreta, nombreBeneficiario } from '../../models/registro-libretas.model';
import { cargarLogo, cargarQr, textoTrazabilidadQr } from './pdf-comun.util';
import { fechaHoraActual, fechaHoraVisible, fechaVisible, monto } from './formato-exportacion.util';

/** Nombre del PDF de «Descargar» de un documento: «{número} - registro de operaciones...pdf». */
export function nombrePdfDocumento(numero: string): string {
  return `${numero} - registro de operaciones en las libretas de las cuentas de registro.pdf`;
}

/**
 * Arma el PDF de «Descargar» de un documento (Figma nodo 4990:17215, «PDF 603»): apaisado, una hoja por cada cuenta
 * bancaria que el documento referencia, con su tabla de movimientos (igual a `siaf-registro-libretas-documento`).
 * Se descarga directo, a diferencia de `generarPdfRegistro`, que solo se previsualiza.
 */
export async function generarPdfDocumento({ documento, movimientos }: DetalleDocumentoLibreta): Promise<{ blob: Blob; nombre: string }> {
  const numero = documento.numero;

  const [{ default: jsPDF }, { default: autoTable }, logo, qr] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    cargarLogo(),
    cargarQr(textoTrazabilidadQr(numero, `${fechaVisible(movimientos[0].fecha)}  18:01:00`)),
  ]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const margen = 16;
  const anchoPagina = 297;
  const altoPagina = 210;
  const anchoUtil = anchoPagina - margen * 2;
  const fechaRegistro = `${fechaVisible(movimientos[0].fecha)}  18:01:00`;
  let y = margen;

  const encabezado = (): void => {
    const anchoLogo = 24;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text('REGISTRO DE OPERACIONES EN LAS LIBRETAS DE LAS CUENTAS DE REGISTRO', margen, y + 3);
    if (logo) pdf.addImage(logo.dataUrl, 'PNG', anchoPagina - margen - anchoLogo, y - 3.5, anchoLogo, anchoLogo / logo.proporcion);
    y += 12;
    pdf.setDrawColor(220);
    pdf.line(margen, y, anchoPagina - margen, y);
    y += 8;
  };

  const subtitulo = (texto: string): void => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(texto.toUpperCase(), margen, y);
    y += 6;
  };

  /** Etiquetas y valores en columnas, como `readonly-field`: hasta 3 por fila (o `ancho` para una que ocupe más de una). */
  const campos = (filas: { caption: string; value: string; ancho?: 1 | 2 }[]): void => {
    const columnas = 3;
    const anchoCol = anchoUtil / columnas;
    let col = 0;
    for (const campo of filas) {
      const x = margen + col * anchoCol;
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
    y += 4;
  };

  const idsCuentas = [...new Set(movimientos.map((m) => m.cuentaBancariaId))];
  idsCuentas.forEach((cuentaId, indice) => {
    if (indice > 0) {
      pdf.addPage();
      y = margen;
    }
    encabezado();
    // QR de trazabilidad (Figma 4990:17215): solo en la primera hoja, a la altura de «Información de operaciones financieras».
    const yQr = y;
    if (indice === 0 && qr) pdf.addImage(qr, 'PNG', anchoPagina - margen - 22, yQr, 22, 22);
    subtitulo('Información de operaciones financieras:');
    campos([
      { caption: 'Fecha registro', value: fechaRegistro },
      { caption: 'Número de operación', value: '12345678' },
      { caption: 'Tipo de operación', value: '1 - Saldos iniciales' },
    ]);
    if (indice === 0 && qr) y = Math.max(y, yQr + 22 + 3);

    const cuenta = CUENTAS_BANCARIAS_INFO.find((c) => c.id === cuentaId);
    subtitulo('Información de la cuenta bancaria:');
    campos([
      { caption: 'Cuenta bancaria', value: `${cuenta?.numeroCuenta ?? ''} ${cuenta?.nombre ?? ''}`, ancho: 2 },
      { caption: 'Moneda', value: cuenta?.moneda ?? '' },
    ]);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('REGISTROS DE OPERACIONES DE LAS LIBRETAS', margen, y);
    y += 7;

    const cuerpo = movimientos
      .filter((m) => m.cuentaBancariaId === cuentaId)
      .map((m) => [
        m.sec,
        fechaHoraVisible(m.fecha),
        m.beneficiarioCodigo,
        nombreBeneficiario(m.beneficiarioCodigo).toUpperCase(),
        m.numeroCuentaRegistro,
        m.descripcionCuentaRegistro,
        monto(m.saldoInicial),
        monto(m.debito),
        monto(m.credito),
        monto(m.saldoFinal),
      ]);

    // Límite de columna (0-based) tras el que termina cada grupo: ahí va el divisor vertical de la cabecera, nunca
    // dentro de un mismo grupo (Saldo inicial | Débito | Crédito | Saldo final no llevan raya entre sí).
    const limiteGrupos = new Set([1, 3, 5]);
    let yCabecera = y;
    autoTable(pdf, {
      startY: y,
      margin: { left: margen, right: margen },
      theme: 'plain',
      head: [
        [
          { content: 'ACREDITACIÓN', colSpan: 2 },
          { content: 'BENEFICIARIO', colSpan: 2 },
          { content: 'CUENTA DE REGISTRO', colSpan: 2 },
          { content: 'IMPORTE EN MONEDA DE LA CUENTA', colSpan: 4 },
        ],
        ['SEC.', 'FECHA', 'CÓDIGO', 'DESCRIPCIÓN', 'NÚMERO', 'DESCRIPCIÓN', 'SALDO INICIAL', 'DÉBITO', 'CRÉDITO', 'SALDO FINAL'],
      ],
      body: cuerpo,
      styles: { fontSize: 7.5, cellPadding: 1.5, lineWidth: 0 },
      // Sin borde propio en la cabecera (Figma): el grupo va centrado y la sub-cabecera, alineada como su columna
      // (texto a la izquierda, montos a la derecha); el divisor entre grupos se dibuja aparte, solo donde corresponde.
      headStyles: { fillColor: [1, 72, 153], textColor: 255, lineWidth: 0 },
      columnStyles: {
        // Número de cuenta de registro más ancho para que entre en una sola línea; su descripción cede ese espacio.
        4: { cellWidth: 52 },
        5: { cellWidth: 68 },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
      },
      didParseCell: (datos) => {
        // `columnStyles` de autoTable solo se aplica al cuerpo, no a la cabecera: la alineación de cada sub-columna
        // (montos a la derecha) hay que repetirla acá a mano.
        if (datos.section !== 'head') return;
        datos.cell.styles.halign = datos.row.index === 0 ? 'center' : datos.column.index >= 6 ? 'right' : 'left';
      },
      didDrawCell: (datos) => {
        if (datos.section === 'head' && datos.row.index === 0 && datos.column.index === 0) yCabecera = datos.cell.y;
        if (datos.section === 'head' && datos.row.index === 0) {
          // Raya blanca entre la fila de grupos y la de sub-cabeceras (Figma), a todo el ancho de la tabla.
          pdf.setDrawColor(255);
          const yBorde = datos.cell.y + datos.cell.height;
          pdf.line(margen, yBorde, anchoPagina - margen, yBorde);
        }
        if (datos.section === 'head' && datos.row.index === 1 && limiteGrupos.has(datos.column.index)) {
          pdf.setDrawColor(255);
          const xBorde = datos.cell.x + datos.cell.width;
          pdf.line(xBorde, yCabecera, xBorde, datos.cell.y + datos.cell.height);
        }
        if (datos.section !== 'body' || datos.column.index !== datos.table.columns.length - 1) return;
        pdf.setDrawColor(225);
        const yBorde = datos.cell.y + datos.cell.height;
        pdf.line(margen, yBorde, anchoPagina - margen, yBorde);
      },
    });
  });

  // Pie de página: divider + «Creado …» y «Página X de Y» en todas las hojas, como en `generarPdfRegistro`.
  const totalPaginas = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    pdf.setPage(p);
    const yPie = altoPagina - margen + 2;
    pdf.setDrawColor(230);
    pdf.line(margen, yPie - 4, anchoPagina - margen, yPie - 4);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.text(`Creado ${fechaHoraActual()}`, margen, yPie);
    pdf.text(`Página ${p} de ${totalPaginas}`, anchoPagina - margen, yPie, { align: 'right' });
  }

  return { blob: pdf.output('blob'), nombre: nombrePdfDocumento(numero) };
}

// ---------- «Documentos existentes» y «Registros existentes» (descarga de las filas elegidas con casilla) ----------
