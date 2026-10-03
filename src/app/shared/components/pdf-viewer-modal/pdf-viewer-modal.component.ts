import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, signal } from '@angular/core';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';

import { IconComponent } from '../../ui/icon/icon.component';

const ZOOM_MIN = 25;
const ZOOM_MAX = 400;
const ZOOM_PASO = 25;
/** Píxeles CSS por punto del PDF al 100 %: el tamaño real de una hoja (96 dpi). */
const ESCALA_100 = 96 / 72;

/**
 * Visor de PDF superpuesto a toda la pantalla (Figma nodo 6152:60726, «Controles header»): la barra de arriba ocupa
 * todo el ancho (Cerrar y el nombre del archivo a la izquierda, Descargar e Imprimir a la derecha) y, debajo, las
 * hojas del PDF sobre un fondo **transparente**: un velo oscuro translúcido (negro al 70 %, más cerrado que el de `siaf-side-panel`) deja ver la pantalla de atrás, y la barra de arriba usa `bg-on-surfaces-medium`. Las hojas las
 * dibuja pdf.js en `<canvas>` (el visor nativo del navegador pinta su propio fondo gris y no se puede quitar); el
 * único scroll es el de las hojas.
 *
 * El padre genera el Blob (por ejemplo con jsPDF) y se lo pasa por `blob`; este componente lo lee, dibuja sus hojas
 * (con `pdfjs-dist`, que se carga solo al abrir el primer PDF) y no guarda nada.
 *
 * @figma 6152:60726 Visor PDF
 * @usar
 * - Para «Ver documento PDF» de una fila (Registros de Documentos y registros, o cualquier acción que arme un PDF al
 *   vuelo) en vez de descargarlo directo: se ve antes de decidir descargarlo o imprimirlo.
 * @evitar
 * - Para un documento que ya vive en el servidor con su propia URL pública: un `<a target="_blank">` directo alcanza.
 * - Para contenido que no es un PDF: `siaf-side-panel` o `siaf-modal`.
 * Abajo, centrados (Figma «Controles footer»), el paginador y el zoom: la página mostrada sigue al scroll, y escribir
 * un número lleva a esa hoja.
 *
 * @teclado
 * - **Escape**: cierra el visor (emite `closed`).
 * - **Tab**: recorre Cerrar, Descargar e Imprimir, el campo de página y los botones de zoom.
 * @accesibilidad
 * - **4.1.2 Nombre, función y valor (A)**: `role="dialog"` con `aria-modal` y `aria-label` con el nombre del archivo.
 * - **1.1.1 Contenido no textual (A)**: cada hoja es un `<canvas>` con `role="img"` y «Página N de T» como nombre; el
 *   texto del PDF no se puede seleccionar ni leer por lector de pantalla desde el visor (el archivo descargado sí).
 */
@Component({
  selector: 'siaf-pdf-viewer-modal',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (open) {
      <section
        class="fixed inset-0 z-50 flex flex-col overscroll-contain bg-black/70"
        (wheel)="alRodar($event)"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="nombre"
      >
        <header class="flex h-[51px] shrink-0 items-center gap-siaf-md bg-[var(--sys-color-bg-on-surfaces-medium)] px-siaf-md text-white">
          <button
            class="inline-flex size-8 shrink-0 items-center justify-center rounded-siaf-md transition hover:bg-white/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            type="button"
            aria-label="Cerrar visor de PDF"
            (click)="cerrar()"
          >
            <siaf-icon name="close" [size]="20" />
          </button>
          <p class="m-0 min-w-0 flex-1 truncate text-sm">{{ nombre }}</p>
          <button
            class="inline-flex size-8 shrink-0 items-center justify-center rounded-siaf-md transition hover:bg-white/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            type="button"
            aria-label="Descargar"
            (click)="descargar()"
          >
            <siaf-icon name="download" [size]="20" />
          </button>
          <button
            class="inline-flex size-8 shrink-0 items-center justify-center rounded-siaf-md transition hover:bg-white/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            type="button"
            aria-label="Imprimir"
            (click)="imprimir()"
          >
            <siaf-icon name="print" [size]="20" />
          </button>
        </header>

        <div class="relative min-h-0 flex-1">
          <!-- El único scroll es el de las hojas: la zona desplazable mide lo que las hojas y el fondo no se mueve. -->
          <div class="flex h-full justify-center">
            <div #hojas class="flex h-full max-w-full flex-col items-center gap-siaf-md overflow-auto px-siaf-md pb-24 pt-siaf-md" (scroll)="alDesplazar()"></div>
          </div>

          <div class="absolute bottom-siaf-lg left-1/2 flex -translate-x-1/2 items-center gap-siaf-md rounded-siaf-md bg-[var(--sys-color-bg-feedback-dark-default)] px-siaf-md py-siaf-sm text-white shadow-siaf-elevation-8">
            @if (paginas() > 1) {
              <div class="flex items-center gap-siaf-xs text-sm">
                <span>Página</span>
                <input
                  class="h-8 w-12 rounded-siaf-sm border-0 bg-white/10 text-center text-white focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-white"
                  type="number"
                  min="1"
                  [max]="paginas()"
                  [value]="pagina()"
                  aria-label="Número de página"
                  (change)="irAPagina($any($event.target).valueAsNumber)"
                />
                <span>de {{ paginas() }}</span>
              </div>
            }
            <div class="flex items-center gap-siaf-xs">
              <button
                class="inline-flex size-8 shrink-0 items-center justify-center rounded-siaf-md transition hover:bg-white/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40"
                type="button"
                aria-label="Alejar"
                [disabled]="zoom() <= zoomMin"
                (click)="cambiarZoom(-zoomPaso)"
              >
                <siaf-icon name="remove" [size]="20" />
              </button>
              <span class="w-12 text-center text-sm">{{ zoom() }}%</span>
              <button
                class="inline-flex size-8 shrink-0 items-center justify-center rounded-siaf-md transition hover:bg-white/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40"
                type="button"
                aria-label="Acercar"
                [disabled]="zoom() >= zoomMax"
                (click)="cambiarZoom(zoomPaso)"
              >
                <siaf-icon name="add" [size]="20" />
              </button>
            </div>
          </div>
        </div>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfViewerModalComponent implements OnChanges, OnDestroy {
  @Input() open = false;
  @Input() blob: Blob | null = null;
  @Input() nombre = 'documento.pdf';
  /** Ya no hace falta: el visor lee las hojas del propio PDF. Se conserva para no romper a quien lo pasa. */
  @Input() totalPaginas = 1;

  @Output() closed = new EventEmitter<void>();

  @ViewChild('hojas') private set contenedor(ref: ElementRef<HTMLDivElement> | undefined) {
    this.hojas = ref?.nativeElement ?? null;
    if (this.hojas && this.documento) void this.dibujar();
  }
  private hojas: HTMLDivElement | null = null;

  readonly zoomMin = ZOOM_MIN;
  readonly zoomMax = ZOOM_MAX;
  readonly zoomPaso = ZOOM_PASO;
  readonly pagina = signal(1);
  readonly paginas = signal(1);
  readonly zoom = signal(100);

  private documento: PDFDocumentProxy | null = null;
  private tarea: PDFDocumentLoadingTask | null = null;
  /** Cada dibujo nuevo (otro zoom, otro archivo) invalida al anterior que aún esté en curso. */
  private generacion = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (!('blob' in changes) && !('open' in changes)) return;
    document.body.style.overflow = this.open ? 'hidden' : '';
    if (this.open && this.blob) {
      this.pagina.set(1);
      this.zoom.set(100);
      void this.cargar(this.blob);
    } else {
      this.liberar();
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.liberar();
  }

  private async cargar(blob: Blob): Promise<void> {
    const generacion = ++this.generacion;
    // Versión «legacy»: la actual de pdf.js usa funciones (como `Promise.try`) que los navegadores algo viejos no traen.
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('assets/pdfjs/pdf.worker.min.mjs', document.baseURI).toString();
    const datos = new Uint8Array(await blob.arrayBuffer());
    const tarea = pdfjs.getDocument({ data: datos });
    const documento = await tarea.promise;
    if (generacion !== this.generacion) {
      void tarea.destroy();
      return;
    }
    void this.tarea?.destroy();
    this.tarea = tarea;
    this.documento = documento;
    this.paginas.set(documento.numPages);
    await this.dibujar();
  }

  /** Dibuja todas las hojas al zoom actual, una tras otra, y vuelve a la hoja que se estaba viendo. */
  private async dibujar(): Promise<void> {
    const documento = this.documento;
    const contenedor = this.hojas;
    if (!documento || !contenedor) return;
    const generacion = ++this.generacion;
    const actual = this.pagina();
    const escala = ESCALA_100 * (this.zoom() / 100);
    const ratio = window.devicePixelRatio || 1;

    const lienzos: HTMLCanvasElement[] = [];
    for (let n = 1; n <= documento.numPages; n++) {
      const hoja = await documento.getPage(n);
      if (generacion !== this.generacion) return;
      const vista = hoja.getViewport({ scale: escala });
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.floor(vista.width * ratio);
      lienzo.height = Math.floor(vista.height * ratio);
      lienzo.style.width = `${Math.floor(vista.width)}px`;
      lienzo.style.height = `${Math.floor(vista.height)}px`;
      lienzo.className = 'block shrink-0 bg-white shadow-siaf-elevation-8';
      lienzo.setAttribute('role', 'img');
      lienzo.setAttribute('aria-label', `Página ${n} de ${documento.numPages}`);
      const contexto = lienzo.getContext('2d');
      if (!contexto) continue;
      try {
        await hoja.render({ canvas: lienzo, canvasContext: contexto, viewport: vista, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined }).promise;
      } catch (error) {
        // Otro dibujo (zoom, otro archivo) tomó el relevo de este: no es un fallo.
        if ((error as { name?: string }).name === 'RenderingCancelledException') return;
        throw error;
      }
      lienzos.push(lienzo);
    }
    if (generacion !== this.generacion) return;
    contenedor.replaceChildren(...lienzos);
    this.irAPagina(actual);
  }

  /** Rueda sobre el fondo (fuera de las hojas): no mueve nada, ni este visor ni la pantalla de atrás. */
  alRodar(evento: WheelEvent): void {
    if (!this.hojas?.contains(evento.target as Node)) evento.preventDefault();
  }

  alDesplazar(): void {
    const contenedor = this.hojas;
    if (!contenedor) return;
    const centro = contenedor.scrollTop + contenedor.clientHeight / 3;
    let visible = 1;
    Array.from(contenedor.children).forEach((hoja, i) => {
      if ((hoja as HTMLElement).offsetTop - contenedor.offsetTop <= centro) visible = i + 1;
    });
    if (visible !== this.pagina()) this.pagina.set(visible);
  }

  irAPagina(valor: number): void {
    if (!Number.isFinite(valor)) return;
    const n = Math.min(this.paginas(), Math.max(1, Math.round(valor)));
    this.pagina.set(n);
    const contenedor = this.hojas;
    const hoja = contenedor?.children[n - 1] as HTMLElement | undefined;
    if (contenedor && hoja) contenedor.scrollTo({ top: hoja.offsetTop - contenedor.offsetTop - 16 });
  }

  cambiarZoom(delta: number): void {
    this.zoom.set(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom() + delta)));
    void this.dibujar();
  }

  descargar(): void {
    if (!this.blob) return;
    const url = URL.createObjectURL(this.blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = this.nombre;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Imprime el PDF original (no los lienzos) con el visor nativo, desde un marco oculto. */
  imprimir(): void {
    if (!this.blob) return;
    const url = URL.createObjectURL(this.blob);
    const marco = document.createElement('iframe');
    marco.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
    marco.onload = () => {
      marco.contentWindow?.focus();
      marco.contentWindow?.print();
      setTimeout(() => {
        marco.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    };
    marco.src = url;
    document.body.appendChild(marco);
  }

  cerrar(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.cerrar();
  }

  private liberar(): void {
    this.generacion++;
    void this.tarea?.destroy();
    this.tarea = null;
    this.documento = null;
    this.paginas.set(1);
  }
}
