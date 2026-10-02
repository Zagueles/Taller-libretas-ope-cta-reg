import type { QueryReportParameters } from '../../../../shared/types/query-report.types';
import { CUENTAS_BANCARIAS_INFO, MOVIMIENTOS_LIBRETA_REGISTRO, MovimientoLibretaRegistro, nombreBeneficiario, nombreTipoOperacion } from '../models/registro-libretas.model';
import { construirDetalleRegistro, DetalleRegistro } from './registro-libretas-detalle.util';

const formatoMonto = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monto = (valor: number): string => formatoMonto.format(valor);
const fechaVisible = (iso: string): string => iso.slice(0, 10).split('-').reverse().join('/');
const fechaHoraVisible = (iso: string): string => `${fechaVisible(iso)} ${iso.slice(11, 19)}`;

/** Fecha y hora de este instante (pie de página «Creado …»): cuándo se arma el PDF, no la fecha del registro. */
const fechaHoraActual = (): string => {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}  ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
};

/** Descarga un Blob como archivo. */
function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/** Una cuenta bancaria consultada, con los movimientos ya filtrados que le tocan (Figma nodo «reporte detallado»). */
export interface CuentaConsultaExcel {
  id: string;
  movimientos: MovimientoLibretaRegistro[];
}

const AZUL_ENCABEZADO = 'FF014899';

/** Cabecera azul de dos filas (grupo + sub-encabezado), blanca y centrada, como las tablas del PDF. */
function estiloEncabezado(celda: { fill: unknown; font: unknown; alignment: unknown }): void {
  celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_ENCABEZADO } };
  celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
}

/**
 * Genera el Excel de «Exportar» de la consulta (plantilla «reporte detallado»): una pestaña «Resumen» con los
 * parámetros de búsqueda y, por cada cuenta bancaria elegida, una pestaña «Resultado N» con su detalle — con una sola
 * cuenta, solo hay «Resultado 1». Es el único formato que ofrece esta pantalla (`exportFormats: ['excel']`): CSV y
 * PDF no distinguen los grupos de columnas de esta tabla. Las librerías se cargan al exportar, así no pesan en la
 * pantalla hasta que se usan.
 */
export async function exportarConsultaExcel(parametros: QueryReportParameters, cuentas: CuentaConsultaExcel[]): Promise<void> {
  const { Workbook } = await import('exceljs');
  const libro = new Workbook();

  // ---------- Resumen ----------
  const resumen = libro.addWorksheet('Resumen');
  resumen.getCell('B2').value = 'Registro de operaciones en las libretas de las cuentas de registro';
  resumen.getCell('B2').font = { bold: true, size: 14 };

  resumen.getCell('B7').value = 'Datos de la consulta';
  resumen.getCell('B7').font = { bold: true, size: 12 };

  const desde = String(parametros['desde'] ?? '');
  const hasta = String(parametros['hasta'] ?? '');
  const tiposOperacion = (parametros['tipoOperacion'] as string[] | undefined) ?? [];
  const etiquetasTipoOperacion = (tiposOperacion.length ? tiposOperacion : ['1', '2', '3']).map((codigo) => nombreTipoOperacion(codigo));

  resumen.getCell('B9').value = 'FECHA DE OPERACIÓN DESDE';
  resumen.getCell('E9').value = 'FECHA DE OPERACIÓN HASTA';
  resumen.getCell('K9').value = 'TIPO DE OPERACIÓN';
  ['B9', 'E9', 'K9'].forEach((ref) => (resumen.getCell(ref).font = { bold: true }));
  resumen.getCell('B10').value = desde ? fechaVisible(desde) : '';
  resumen.getCell('E10').value = hasta ? fechaVisible(hasta) : '';
  resumen.getCell('K10').value = etiquetasTipoOperacion.join(', ');

  resumen.getCell('B12').value = 'CUENTA BANCARIA';
  resumen.getCell('E12').value = 'ENTIDAD';
  resumen.getCell('H12').value = 'UNIDAD EJECUTORA';
  resumen.getCell('K12').value = 'BENEFICIARIO';
  ['B12', 'E12', 'H12', 'K12'].forEach((ref) => (resumen.getCell(ref).font = { bold: true }));

  let fila = 13;
  cuentas.forEach(({ id, movimientos }) => {
    const cuenta = CUENTAS_BANCARIAS_INFO.find((c) => c.id === id);
    // Agrupa por entidad + unidad ejecutora (como la plantilla): la cuenta bancaria queda una vez por cuenta, con los
    // beneficiarios de cada grupo apilados en la misma celda.
    const grupos = new Map<string, { entidad: string; unidadEjecutora: string; beneficiarios: Set<string> }>();
    movimientos.forEach((m) => {
      const clave = `${m.entidad}|${m.unidadEjecutora}`;
      const grupo = grupos.get(clave) ?? { entidad: m.entidad, unidadEjecutora: m.unidadEjecutora, beneficiarios: new Set<string>() };
      grupo.beneficiarios.add(nombreBeneficiario(m.beneficiarioCodigo).toUpperCase());
      grupos.set(clave, grupo);
    });

    const filaInicio = fila;
    [...grupos.values()].forEach((grupo) => {
      resumen.getCell(fila, 2).value = `${cuenta?.nombre ?? ''} - ${cuenta?.numeroCuenta ?? ''} - ${cuenta?.moneda ?? ''}`;
      resumen.getCell(fila, 5).value = grupo.entidad;
      resumen.getCell(fila, 8).value = grupo.unidadEjecutora;
      const celdaBeneficiario = resumen.getCell(fila, 11);
      celdaBeneficiario.value = [...grupo.beneficiarios].join('\n');
      celdaBeneficiario.alignment = { wrapText: true, vertical: 'top' };
      fila++;
    });
    if (fila - filaInicio > 1) {
      resumen.mergeCells(filaInicio, 2, fila - 1, 2);
      resumen.getCell(filaInicio, 2).alignment = { vertical: 'top' };
    }
  });

  resumen.getColumn(2).width = 34;
  resumen.getColumn(5).width = 18;
  resumen.getColumn(8).width = 24;
  resumen.getColumn(11).width = 36;

  // ---------- Resultado N (una hoja por cuenta bancaria elegida) ----------
  cuentas.forEach(({ id, movimientos }, indice) => {
    const cuenta = CUENTAS_BANCARIAS_INFO.find((c) => c.id === id);
    const enDolares = cuenta?.moneda === 'USD';
    const hoja = libro.addWorksheet(`Resultado ${indice + 1}`);

    hoja.getCell('A2').value = 'Cta. Bancaria:';
    hoja.getCell('A2').font = { bold: true };
    hoja.getCell('B2').value = `${cuenta?.nombre ?? ''} - ${cuenta?.numeroCuenta ?? ''} - ${cuenta?.moneda ?? ''}`;
    hoja.getCell('A3').value = 'Saldo inicial';
    hoja.getCell('A3').font = { bold: true };
    hoja.getCell('B3').value = cuenta?.saldoInicial ?? 0;
    hoja.getCell('B3').numFmt = '#,##0.00';
    hoja.getCell('A4').value = 'Saldo final';
    hoja.getCell('A4').font = { bold: true };
    hoja.getCell('B4').value = cuenta?.saldoFinal ?? 0;
    hoja.getCell('B4').numFmt = '#,##0.00';

    const grupos: { grupo: string; subs: ReadonlyArray<string | null> }[] = [
      { grupo: 'ACREDITACIÓN', subs: ['SECUENCIA', 'FECHA'] },
      { grupo: 'BENEFICIARIO', subs: ['CÓDIGO', 'DESCRIPCIÓN'] },
      { grupo: 'CUENTA DE REGISTRO', subs: ['NÚMERO', 'DESCRIPCIÓN', 'FF/SUB FF'] },
      { grupo: 'TIPO DE OPERACIÓN', subs: [null] },
      { grupo: 'CUENTA BANCARIA', subs: ['NÚMERO', 'DESCRIPCIÓN'] },
      { grupo: 'MONEDA', subs: [null] },
      { grupo: 'ÁMBITO INSTITUCIONAL', subs: ['ENTIDAD', 'UNIDAD EJECUTORA', 'GRUPO'] },
      { grupo: 'TIPO DE CAMBIO', subs: ['TIPO DE COTIZACIÓN', 'COMPRA', 'VENTA'] },
      { grupo: 'IMPORTE EN MONEDA DE LA CUENTA', subs: ['SALDO INICIAL', 'DÉBITO', 'CRÉDITO', 'SALDO FINAL'] },
      ...(enDolares ? [{ grupo: 'IMPORTE EN MONEDA NACIONAL', subs: ['SALDO INICIAL', 'DÉBITO', 'CRÉDITO', 'SALDO FINAL'] }] : []),
      { grupo: 'DOCUMENTO', subs: ['NÚMERO', 'DESCRIPCIÓN'] },
    ];

    const filaGrupo = 6;
    let col = 1;
    grupos.forEach(({ grupo, subs }) => {
      const inicio = col;
      const fin = col + subs.length - 1;
      if (fin > inicio) hoja.mergeCells(filaGrupo, inicio, filaGrupo, fin);
      const celdaGrupo = hoja.getCell(filaGrupo, inicio);
      celdaGrupo.value = grupo;
      estiloEncabezado(celdaGrupo);
      if (subs.length === 1 && subs[0] === null) {
        hoja.mergeCells(filaGrupo, inicio, filaGrupo + 1, inicio);
      } else {
        subs.forEach((sub, i) => {
          const celdaSub = hoja.getCell(filaGrupo + 1, inicio + i);
          celdaSub.value = sub;
          estiloEncabezado(celdaSub);
        });
      }
      col = fin + 1;
    });

    // Tipo de cambio de ejemplo (igual al de la vista de datos): solo convierte en la cuenta en dólares.
    const tipoCambioCompra = 3.35;
    const tipoCambioVenta = 3.32;

    movimientos.forEach((m, i) => {
      const filaDato = filaGrupo + 2 + i;
      const valores: Array<string | number> = [
        m.sec,
        fechaHoraVisible(m.fecha),
        m.beneficiarioCodigo,
        nombreBeneficiario(m.beneficiarioCodigo).toUpperCase(),
        m.numeroCuentaRegistro,
        m.descripcionCuentaRegistro,
        m.ffSubFf,
        nombreTipoOperacion(m.tipoOperacionCodigo),
        cuenta?.numeroCuenta ?? '',
        cuenta?.nombre ?? '',
        cuenta?.moneda ?? '',
        m.entidad,
        m.unidadEjecutora,
        m.grupo,
        '1. Compra / Venta',
        enDolares ? tipoCambioCompra : '-',
        enDolares ? tipoCambioVenta : '-',
        m.saldoInicial,
        m.debito,
        m.credito,
        m.saldoFinal,
        ...(enDolares ? [m.saldoInicial * tipoCambioVenta, m.debito * tipoCambioVenta, m.credito * tipoCambioVenta, m.saldoFinal * tipoCambioVenta] : []),
        m.numeroDocumento,
        m.descripcionDocumento,
      ];
      valores.forEach((valor, indiceCol) => {
        hoja.getCell(filaDato, indiceCol + 1).value = valor;
      });
    });

    const colsMonto = [18, 19, 20, 21, ...(enDolares ? [22, 23, 24, 25] : [])];
    for (let f = filaGrupo + 2; f < filaGrupo + 2 + movimientos.length; f++) {
      colsMonto.forEach((c) => (hoja.getCell(f, c).numFmt = '#,##0.00'));
    }

    hoja.getColumn(4).width = 32;
    hoja.getColumn(6).width = 40;
    hoja.getColumn(10).width = 20;
  });

  const nombreArchivo = `registro-libretas-cuentas-registro-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const buffer = await libro.xlsx.writeBuffer();
  descargar(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombreArchivo);
}

/** Nombre del PDF de «Ver documento PDF» de un registro: «{operación}-{documento} - detalle de registro...pdf», como en el Figma. */
export function nombrePdfRegistro(detalle: DetalleRegistro): string {
  return `${detalle.numeroOperacion}-${detalle.numeroDocumento} - detalle de registro de Movimiento de la libreta de cuenta de registro.pdf`;
}

interface Logo {
  dataUrl: string;
  /** Ancho / alto del SVG original: el PNG que trae embebido es un recorte cuadrado de una hoja de íconos, pasarlo
   *  directo a `addImage` con un ancho y alto fijos lo deformaba; se dibuja primero en un `<canvas>` del tamaño real
   *  del SVG (donde el navegador ya resuelve el patrón/recorte) y de ahí sale la proporción correcta. */
  proporcion: number;
}

/** Logo SIAF·RP de las cabeceras del PDF (`assets/img/LogoSIAF.svg`), rasterizado una sola vez. */
let logoPromesa: Promise<Logo | null> | null = null;
function cargarLogo(): Promise<Logo | null> {
  logoPromesa ??= new Promise<Logo | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const escala = 4;
      const ancho = img.naturalWidth || 105;
      const alto = img.naturalHeight || 28;
      const canvas = document.createElement('canvas');
      canvas.width = ancho * escala;
      canvas.height = alto * escala;
      const contexto = canvas.getContext('2d');
      if (!contexto) {
        resolve(null);
        return;
      }
      contexto.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({ dataUrl: canvas.toDataURL('image/png'), proporcion: ancho / alto });
    };
    img.onerror = () => resolve(null);
    img.src = 'assets/img/LogoSIAF.svg';
  });
  return logoPromesa;
}

/** QR de verificación del documento (Figma nodo 440:84666), con el enlace para comprobarlo. */
async function cargarQr(contenido: string): Promise<string | null> {
  try {
    const { toDataURL } = await import('qrcode');
    return await toDataURL(contenido, { margin: 0, width: 240, color: { dark: '#202020', light: '#ffffff' } });
  } catch {
    return null;
  }
}

/** Sin tildes ni eñe: evita que cada lector decodifique los acentos con una página de códigos distinta (en el
 *  lector nativo de iPhone se veían como símbolos sueltos, aunque Google Lens sí los mostraba bien). */
const sinTildes = (texto: string): string => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Texto plano del QR: para la trazabilidad, no un enlace, así se lee igual sin conexión al escanearlo.
 *  El guion de «000001-2026» se cambia por un punto: la cámara nativa de iPhone matchea «dígitos-dígitos» como
 *  teléfono y ofrece llamar en vez de mostrar el texto. */
const textoTrazabilidadQr = (numeroDocumento: string, fechaHora: string): string =>
  sinTildes(
    [
      'REGISTRO DE OPERACIONES EN LAS LIBRETAS DE LAS CUENTAS DE REGISTRO',
      '',
      `NÚMERO DE DOCUMENTO: ${numeroDocumento.replace(/-/g, '.')}`,
      'ESTADO DEL DOCUMENTO: PROCESADO',
      `FECHA Y HORA: ${fechaHora}`,
    ].join('\n'),
  );

/**
 * Arma el PDF de «Ver documento PDF» de un registro de Registros (Figma nodo 440:84666, «PDF 600»): las mismas
 * secciones que `siaf-registro-libretas-registro`, en hojas A4 con la cabecera y el pie de SIAF·RP. Devuelve el Blob
 * para previsualizarlo en el visor nativo; no lo descarga (eso lo hace el visor con su propio botón).
 */
export async function generarPdfRegistro(sec: string): Promise<{ blob: Blob; nombre: string; paginas: number } | null> {
  const detalle = construirDetalleRegistro(sec);
  if (!detalle) return null;

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
    y += alto + 3;
  };

  const linea = (): void => {
    salto(4);
    pdf.setDrawColor(210);
    pdf.line(margen, y, 210 - margen, y);
    y += 5;
  };

  encabezado();
  // QR de verificación (Figma 440:84666): solo en la primera hoja, a la altura de «Información de operaciones financieras».
  const yQr = y;
  if (qr) pdf.addImage(qr, 'PNG', 210 - margen - 24, yQr, 24, 24);
  subtitulo('Información de operaciones financieras:');
  campos([
    { caption: 'Fecha registro', value: detalle.fechaRegistro },
    { caption: 'Número de operación', value: detalle.numeroOperacion },
    { caption: 'Tipo de operación', value: detalle.tipoOperacion },
  ]);
  if (qr) y = Math.max(y, yQr + 24 + 3);

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
  importesDestacados(detalle.importes);

  subtitulo('Descripción detallada del registro');
  campos([{ caption: 'Descripción', value: detalle.descripcionDetallada, ancho: 2 }]);
  linea();

  campos([
    { caption: 'Estado de conciliación', value: 'Conciliado' },
    { caption: 'Estado de registro', value: 'Activo' },
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

/** Nombre del PDF de «Descargar» de un documento: «{número} - registro de operaciones...pdf». */
export function nombrePdfDocumento(numero: string): string {
  return `${numero} - registro de operaciones en las libretas de las cuentas de registro.pdf`;
}

/**
 * Arma el PDF de «Descargar» de un documento (Figma nodo 4990:17215, «PDF 603»): apaisado, una hoja por cada cuenta
 * bancaria que el documento referencia, con su tabla de movimientos (igual a `siaf-registro-libretas-documento`).
 * Se descarga directo, a diferencia de `generarPdfRegistro`, que solo se previsualiza.
 */
export async function generarPdfDocumento(numero: string): Promise<{ blob: Blob; nombre: string } | null> {
  const movimientos = MOVIMIENTOS_LIBRETA_REGISTRO.filter((m) => m.numeroDocumento === numero);
  if (!movimientos.length) return null;

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
