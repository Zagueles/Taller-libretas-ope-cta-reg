import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { IconComponent } from '../../ui/icon/icon.component';

const ZOOM_MIN = 25;
const ZOOM_MAX = 400;
const ZOOM_PASO = 25;

/**
 * Visor de PDF superpuesto a toda la pantalla (Figma nodo 6152:60726, «Controles header»): la barra de arriba ocupa
 * todo el ancho (Cerrar y el nombre del archivo a la izquierda, Descargar e Imprimir a la derecha) y, debajo, el PDF
 * ocupa el resto, dibujado por el propio motor del navegador (`<iframe>` con el Blob, sin su barra: ya está la de
 * arriba) — sin márgenes ni bordes propios alrededor, así el único scroll que aparece es el del visor nativo del PDF,
 * no uno doble. Sin reimplementar página ni zoom.
 *
 * El padre genera el Blob (por ejemplo con jsPDF) y se lo pasa por `blob`; este componente arma la URL, la revoca al
 * cerrar o cambiar de archivo, y no guarda nada.
 *
 * @figma 6152:60726 Visor PDF
 * @usar
 * - Para «Ver documento PDF» de una fila (Registros de Documentos y registros, o cualquier acción que arme un PDF al
 *   vuelo) en vez de descargarlo directo: se ve antes de decidir descargarlo o imprimirlo.
 * @evitar
 * - Para un documento que ya vive en el servidor con su propia URL pública: un `<a target="_blank">` directo alcanza.
 * - Para contenido que no es un PDF: `siaf-side-panel` o `siaf-modal`.
 * Abajo, centrados (Figma «Controles footer»), el paginador (con `totalPaginas`) y el zoom: cambian la página o el
 * zoom reconstruyendo la URL del `<iframe>` con `#page=N&zoom=N`, el fragmento que entiende el visor nativo.
 *
 * @teclado
 * - **Escape**: cierra el visor (emite `closed`).
 * - **Tab**: recorre Cerrar, Descargar e Imprimir, el campo de página y los botones de zoom; el PDF embebido sigue
 *   además su propio teclado (flechas, Ctrl+rueda).
 * @accesibilidad
 * - **4.1.2 Nombre, función y valor (A)**: `role="dialog"` con `aria-modal` y `aria-label` con el nombre del archivo.
 * - **Pendiente · 1.1.1 Contenido no textual (A)**: el `<iframe>` no tiene texto alternativo; el navegador no lo
 *   permite. El nombre del archivo en la barra es la única descripción para quien no ve el PDF.
 */
@Component({
  selector: 'siaf-pdf-viewer-modal',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (open) {
      <section
        class="fixed inset-0 z-50 flex flex-col"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="nombre"
      >
        <header class="flex h-[51px] shrink-0 items-center gap-siaf-md bg-[#323639] px-siaf-md text-white">
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
          @if (urlSegura) {
            <iframe #visor [src]="urlSegura" [title]="nombre" class="block h-full w-full border-0"></iframe>
          }

          @if (totalPaginas > 1 || zoom() !== 100) {
            <div class="absolute bottom-siaf-lg left-1/2 flex -translate-x-1/2 items-center gap-siaf-md rounded-siaf-md bg-[#323639] px-siaf-md py-siaf-sm text-white shadow-siaf-elevation-8">
              @if (totalPaginas > 1) {
                <div class="flex items-center gap-siaf-xs text-sm">
                  <span>Página</span>
                  <input
                    class="h-8 w-12 rounded-siaf-sm border-0 bg-white/10 text-center text-white focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-white"
                    type="number"
                    min="1"
                    [max]="totalPaginas"
                    [value]="pagina()"
                    aria-label="Número de página"
                    (change)="irAPagina($any($event.target).valueAsNumber)"
                  />
                  <span>de {{ totalPaginas }}</span>
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
          }
        </div>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfViewerModalComponent implements OnChanges {
  @Input() open = false;
  @Input() blob: Blob | null = null;
  @Input() nombre = 'documento.pdf';
  /** Para el paginador del footer; sin más de una hoja, no aparece. */
  @Input() totalPaginas = 1;

  @Output() closed = new EventEmitter<void>();

  @ViewChild('visor') private readonly visor?: ElementRef<HTMLIFrameElement>;

  readonly zoomMin = ZOOM_MIN;
  readonly zoomMax = ZOOM_MAX;
  readonly zoomPaso = ZOOM_PASO;
  readonly pagina = signal(1);
  readonly zoom = signal(100);

  urlSegura: SafeResourceUrl | null = null;
  /** URL del Blob que se ve ahora mismo; cambiar de página o zoom arma una nueva (ver `actualizarUrlSegura`). */
  private url = '';

  constructor(private readonly sanitizer: DomSanitizer) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ('blob' in changes || 'open' in changes) {
      if (this.open && this.blob) {
        this.pagina.set(1);
        this.zoom.set(100);
        this.actualizarUrlSegura();
      } else {
        this.liberarUrl();
      }
    }
  }

  irAPagina(valor: number): void {
    if (!Number.isFinite(valor)) return;
    this.pagina.set(Math.min(this.totalPaginas, Math.max(1, Math.round(valor))));
    this.actualizarUrlSegura();
  }

  cambiarZoom(delta: number): void {
    this.zoom.set(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom() + delta)));
    this.actualizarUrlSegura();
  }

  /**
   * `#toolbar=0`: el visor del PDF ya tiene su propia barra (nombre, descargar, imprimir); `page`/`zoom`: los que
   * mueve el footer propio. El visor nativo solo lee el fragmento al cargar: cambiarlo en la misma URL no mueve de
   * página, así que cada cambio arma un Blob URL nuevo (se revoca el anterior) para forzar una carga de verdad.
   */
  private actualizarUrlSegura(): void {
    if (!this.blob) return;
    this.liberarUrl();
    this.url = URL.createObjectURL(this.blob);
    this.urlSegura = this.sanitizer.bypassSecurityTrustResourceUrl(`${this.url}#toolbar=0&page=${this.pagina()}&zoom=${this.zoom()}`);
  }

  descargar(): void {
    if (!this.blob) return;
    const enlace = document.createElement('a');
    enlace.href = this.url || URL.createObjectURL(this.blob);
    enlace.download = this.nombre;
    enlace.click();
  }

  imprimir(): void {
    this.visor?.nativeElement.contentWindow?.print();
  }

  cerrar(): void {
    this.closed.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.cerrar();
  }

  ngOnDestroy(): void {
    this.liberarUrl();
  }

  private liberarUrl(): void {
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = '';
    this.urlSegura = null;
  }
}
