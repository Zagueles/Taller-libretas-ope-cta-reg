import { cargarLogo } from './pdf-comun.util';
import { fechaHoraActual } from './formato-exportacion.util';

export interface GraficaPdf {
  title: string;
  description: string;
  /** JPEG en data URL, sobre fondo blanco. */
  image: string;
  /** Ancho / alto de la imagen. */
  ratio: number;
  /** La dona lleva su leyenda a un costado; las demás gráficas, encima. */
  type?: string;
  /** Leyenda de la gráfica: nombre y color (`rgb(r, g, b)`) de cada serie o parte. */
  legend?: { label: string; color: string }[];
}

/** Una hoja del PDF: lo que se ve en una pestaña (cuenta bancaria) de la vista de gráficas. */
export interface PaginaPdfGraficas {
  /** Nombre de la pestaña (p. ej. «Soles»), para el nombre del archivo. */
  etiqueta: string;
  parametros: { label: string; value: string }[];
  kpis: { title: string; amount: string }[];
  graficas: GraficaPdf[];
}

export interface DatosPdfGraficas {
  titulo: string;
  /** Una hoja por pestaña, en el orden de las pestañas. */
  paginas: PaginaPdfGraficas[];
}

/** Nombre del PDF de gráficas: el título de la consulta, las pestañas que incluye y la fecha, sin caracteres que los sistemas de archivos rechazan. */
export function nombrePdfGraficas(titulo: string, pestanas: string[] = []): string {
  const fecha = fechaHoraActual().slice(0, 10).replace(/\//g, '-');
  const limpio = (texto: string): string => texto.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
  const etiquetas = pestanas.filter(Boolean).map((e) => limpio(e).toLowerCase());
  return `${limpio(titulo)} - gráficas${etiquetas.length ? ` ${etiquetas.join(' y ')}` : ''} ${fecha}.pdf`;
}

/**
 * Arma el PDF de la vista de gráficas, como un «print» de la pantalla: una hoja A4 horizontal por pestaña (soles, dólares…)
 * con la cabecera y el logo SIAF·RP, los parámetros aplicados, las tarjetas KPI y las gráficas en sus tarjetas, tal como se
 * ven: las de línea o barras a la izquierda, con su leyenda encima del dibujo, y la dona a la derecha con su leyenda arriba.
 * Las imágenes conservan su proporción (no se estiran); si no caben, se reducen.
 */
export async function generarPdfGraficas(datos: DatosPdfGraficas): Promise<{ blob: Blob; nombre: string; paginas: number }> {
  const [{ default: jsPDF }, logo] = await Promise.all([import('jspdf'), cargarLogo()]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const ancho = 297;
  const altoPagina = 210;
  const margen = 12;
  const anchoUtil = ancho - margen * 2;
  const limite = altoPagina - 10 - margen + 4;
  const relleno = 5;

  const encabezado = (yy: number): number => {
    pdf.setFont('helvetica', 'bold');
    let fuente = 13;
    pdf.setFontSize(fuente);
    const titulo = datos.titulo.toUpperCase();
    while (fuente > 9 && pdf.getTextWidth(titulo) > anchoUtil - 32) {
      fuente -= 0.5;
      pdf.setFontSize(fuente);
    }
    pdf.setTextColor(0);
    pdf.text(titulo, margen, yy + 3);
    if (logo) {
      const anchoLogo = 24;
      pdf.addImage(logo.dataUrl, 'PNG', ancho - margen - anchoLogo, yy - 3, anchoLogo, anchoLogo / logo.proporcion);
    }
    pdf.setDrawColor(220);
    pdf.line(margen, yy + 9, ancho - margen, yy + 9);
    return yy + 16;
  };

  const marca = (color: string, x: number, yy: number): void => {
    const [r, g, b] = (color.match(/\d+(\.\d+)?/g) ?? ['120', '120', '120']).slice(0, 3).map(Number);
    pdf.setFillColor(r, g, b);
    pdf.circle(x + 1.6, yy - 1.1, 1.6, 'F');
  };

  /** Una tarjeta de gráfica tal como se ve en pantalla; `alto` la estira hasta igualar a la de al lado. */
  interface Tarjeta {
    g: GraficaPdf;
    dona: boolean;
    descripcion: string[];
    anchoImagen: number;
    altoImagen: number;
    altoEncabezado: number;
    altoNatural: number;
  }

  const medir = (g: GraficaPdf, anchoCol: number, escala: number): Tarjeta => {
    const dona = g.type === 'donut' && Boolean(g.legend?.length);
    const interior = anchoCol - relleno * 2;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    const descripcion = g.description ? (pdf.splitTextToSize(g.description, interior) as string[]) : [];
    const leyenda = g.legend?.length ? (dona ? g.legend.length * 6 + 4 : 8) : 0;
    const altoEncabezado = relleno + 6 + descripcion.length * 4.2 + 3 + leyenda;
    const anchoMaximo = dona ? Math.min(interior, 62) : interior;
    const altoMaximo = Math.min(anchoMaximo / g.ratio, 100) * escala;
    const altoImagen = altoMaximo;
    const anchoImagen = altoImagen * g.ratio;
    return { g, dona, descripcion, anchoImagen, altoImagen, altoEncabezado, altoNatural: altoEncabezado + altoImagen + relleno };
  };

  const dibujarTarjeta = (t: Tarjeta, x: number, yy: number, anchoCol: number, alto: number): void => {
    pdf.setDrawColor(190);
    pdf.setLineWidth(0.25);
    pdf.roundedRect(x, yy, anchoCol, alto, 2, 2);
    const interior = anchoCol - relleno * 2;
    let cy = yy + relleno;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(40);
    pdf.text(t.g.title, x + relleno, cy + 4);
    cy += 6;
    if (t.descripcion.length) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(110);
      pdf.text(t.descripcion, x + relleno, cy + 3);
      cy += t.descripcion.length * 4.2;
    }
    cy += 3;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    if (t.g.legend?.length) {
      if (t.dona) {
        for (const item of t.g.legend) {
          marca(item.color, x + relleno + 4, cy + 4);
          pdf.setTextColor(40);
          pdf.text(pdf.splitTextToSize(item.label, interior - 12)[0], x + relleno + 9, cy + 4);
          cy += 6;
        }
        cy += 4;
      } else {
        // Leyenda alineada a la derecha, encima del dibujo, como en pantalla.
        const total = t.g.legend.reduce((suma, item) => suma + 5 + pdf.getTextWidth(item.label) + 8, -8);
        let lx = x + anchoCol - relleno - total;
        for (const item of t.g.legend) {
          marca(item.color, lx, cy + 4);
          pdf.setTextColor(60);
          pdf.text(item.label, lx + 5, cy + 4);
          lx += 5 + pdf.getTextWidth(item.label) + 8;
        }
        cy += 8;
      }
    }
    const xi = t.dona ? x + (anchoCol - t.anchoImagen) / 2 : x + relleno;
    pdf.addImage(t.g.image, 'JPEG', xi, cy, t.anchoImagen, t.altoImagen);
    pdf.setTextColor(0);
  };

  datos.paginas.forEach((pagina, indice) => {
    if (indice > 0) pdf.addPage();
    let y = encabezado(margen);

    // Parámetros aplicados: una banda con «ETIQUETA valor» uno tras otro.
    if (pagina.parametros.length) {
      let x = margen;
      for (const parametro of pagina.parametros) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        const etiqueta = parametro.label.toUpperCase();
        const anchoEtiqueta = pdf.getTextWidth(etiqueta);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        const valor = (pdf.splitTextToSize(parametro.value || '-', anchoUtil * 0.6) as string[])[0];
        const total = anchoEtiqueta + 3 + pdf.getTextWidth(valor);
        if (x > margen && x + total > margen + anchoUtil) {
          x = margen;
          y += 5.5;
        }
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(0);
        pdf.text(etiqueta, x, y);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(valor, x + anchoEtiqueta + 3, y);
        x += total + 12;
      }
      y += 9;
    }

    // Tarjetas KPI en una fila, como en pantalla.
    if (pagina.kpis.length) {
      const columnas = Math.min(pagina.kpis.length, 4);
      const separacion = 4;
      const anchoCol = (anchoUtil - separacion * (columnas - 1)) / columnas;
      for (let i = 0; i < pagina.kpis.length; i += columnas) {
        pagina.kpis.slice(i, i + columnas).forEach((kpi, col) => {
          const x = margen + col * (anchoCol + separacion);
          pdf.setDrawColor(190);
          pdf.setLineWidth(0.25);
          pdf.roundedRect(x, y, anchoCol, 15, 2, 2);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(7.5);
          pdf.setTextColor(90);
          pdf.text(pdf.splitTextToSize(kpi.title.toUpperCase(), anchoCol - 8)[0], x + 4, y + 5);
          pdf.setFontSize(12);
          pdf.setTextColor(0);
          pdf.text(kpi.amount, x + 4, y + 11.5);
        });
        y += 15 + 5;
      }
      y += 2;
    }

    // Las gráficas: de línea o barras en la columna ancha y la dona en la angosta (en pantalla, 1fr y 336 px).
    const izquierda = pagina.graficas.filter((g) => !(g.type === 'donut' && g.legend?.length));
    const derecha = pagina.graficas.filter((g) => g.type === 'donut' && g.legend?.length);
    const dosColumnas = izquierda.length > 0 && derecha.length > 0;
    const gap = 8;
    const anchoDer = dosColumnas ? Math.min(Math.max(anchoUtil * 0.3, 78), 92) : anchoUtil;
    const anchoIzq = dosColumnas ? anchoUtil - gap - anchoDer : anchoUtil;
    const separacionPila = 6;
    const disponible = limite - y;

    const apilar = (graficas: GraficaPdf[], anchoCol: number, escala: number): Tarjeta[] => graficas.map((g) => medir(g, anchoCol, escala));
    const altoPila = (tarjetas: Tarjeta[]): number => tarjetas.reduce((suma, t) => suma + t.altoNatural, 0) + separacionPila * Math.max(tarjetas.length - 1, 0);
    // Si no caben a su tamaño, todas las imágenes se reducen por igual (sin deformarlas).
    let escala = 1;
    let colIzq = apilar(izquierda, anchoIzq, escala);
    let colDer = apilar(derecha, anchoDer, escala);
    for (let intento = 0; intento < 8 && Math.max(altoPila(colIzq), altoPila(colDer)) > disponible; intento++) {
      escala *= 0.88;
      colIzq = apilar(izquierda, anchoIzq, escala);
      colDer = apilar(derecha, anchoDer, escala);
    }
    const altoFila = Math.max(altoPila(colIzq), altoPila(colDer));

    const pintarPila = (tarjetas: Tarjeta[], x: number, anchoCol: number): void => {
      let yy = y;
      tarjetas.forEach((t, i) => {
        const extra = i === tarjetas.length - 1 ? altoFila - altoPila(tarjetas) : 0;
        dibujarTarjeta(t, x, yy, anchoCol, t.altoNatural + extra);
        yy += t.altoNatural + extra + separacionPila;
      });
    };
    pintarPila(colIzq, margen, anchoIzq);
    pintarPila(colDer, margen + anchoIzq + (dosColumnas ? gap : 0), anchoDer);
  });

  const paginas = pdf.getNumberOfPages();
  const fecha = fechaHoraActual();
  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(`Generado el ${fecha}`, margen, altoPagina - 8);
    pdf.text(`Página ${i} de ${paginas}`, ancho - margen, altoPagina - 8, { align: 'right' });
  }
  return { blob: pdf.output('blob'), nombre: nombrePdfGraficas(datos.titulo, datos.paginas.map((p) => p.etiqueta)), paginas };
}
