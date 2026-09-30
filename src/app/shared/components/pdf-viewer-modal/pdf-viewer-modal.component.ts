import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { IconComponent } from '../../ui/icon/icon.component';

/**
 * Visor de PDF nativo, superpuesto a toda la pantalla (Figma nodo 429:83188): una barra oscura propia con el nombre
 * del archivo, «Descargar» e «Imprimir», y debajo el PDF, que dibuja el propio motor del navegador (`<embed>` con el
 * Blob del PDF), sin reimplementar página, zoom ni desplazamiento.
 *
 * El padre genera el Blob (por ejemplo con jsPDF) y se lo pasa por `blob`; este componente arma la URL, la revoca al
 * cerrar o cambiar de archivo, y no guarda nada.
 *
 * @figma 429:83188 Visor PDF
 * @usar
 * - Para «Ver documento PDF» de una fila (Registros de Documentos y registros, o cualquier acción que arme un PDF al
 *   vuelo) en vez de descargarlo directo: se ve antes de decidir descargarlo o imprimirlo.
 * @evitar
 * - Para un documento que ya vive en el servidor con su propia URL pública: un `<a target="_blank">` directo alcanza.
 * - Para contenido que no es un PDF: `siaf-side-panel` o `siaf-modal`.
 * @teclado
 * - **Escape**: cierra el visor (emite `closed`).
 * - **Tab**: recorre Cerrar, Descargar e Imprimir; el PDF embebido sigue el teclado propio del visor del navegador.
 * @accesibilidad
 * - **4.1.2 Nombre, función y valor (A)**: `role="dialog"` con `aria-modal` y `aria-label` con el nombre del archivo.
 * - **Pendiente · 1.1.1 Contenido no textual (A)**: el `<embed>` no tiene texto alternativo; el navegador no lo
 *   permite. El nombre del archivo en la barra es la única descripción para quien no ve el PDF.
 */
@Component({
  selector: 'siaf-pdf-viewer-modal',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (open) {
      <section
        class="fixed inset-0 z-50 flex flex-col bg-[var(--sys-color-bg-on-surfaces-medium)]"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="nombre"
      >
        <header class="flex h-14 shrink-0 items-center gap-siaf-md bg-[#323639] px-siaf-md text-white">
          <button
            class="inline-flex size-10 shrink-0 items-center justify-center rounded-siaf-md transition hover:bg-white/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            type="button"
            aria-label="Cerrar visor de PDF"
            (click)="cerrar()"
          >
            <siaf-icon name="close" [size]="24" />
          </button>
          <p class="m-0 min-w-0 flex-1 truncate text-sm">{{ nombre }}</p>
          <button
            class="inline-flex size-10 shrink-0 items-center justify-center rounded-siaf-md transition hover:bg-white/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            type="button"
            aria-label="Descargar"
            (click)="descargar()"
          >
            <siaf-icon name="download" [size]="24" />
          </button>
          <button
            class="inline-flex size-10 shrink-0 items-center justify-center rounded-siaf-md transition hover:bg-white/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            type="button"
            aria-label="Imprimir"
            (click)="imprimir()"
          >
            <siaf-icon name="print" [size]="24" />
          </button>
        </header>

        <div class="min-h-0 flex-1 overflow-auto bg-[#525659]">
          @if (urlSegura) {
            <embed #visor [src]="urlSegura" type="application/pdf" class="block h-full min-h-[600px] w-full" />
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

  @Output() closed = new EventEmitter<void>();

  @ViewChild('visor') private readonly visor?: ElementRef<HTMLEmbedElement>;

  urlSegura: SafeResourceUrl | null = null;
  private url = '';

  constructor(private readonly sanitizer: DomSanitizer) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ('blob' in changes || 'open' in changes) {
      this.liberarUrl();
      if (this.open && this.blob) {
        this.url = URL.createObjectURL(this.blob);
        // #toolbar=0: el visor del PDF ya tiene su propia barra (nombre, descargar, imprimir); no hace falta la del navegador.
        this.urlSegura = this.sanitizer.bypassSecurityTrustResourceUrl(`${this.url}#toolbar=0`);
      }
    }
  }

  descargar(): void {
    if (!this.blob) return;
    const enlace = document.createElement('a');
    enlace.href = this.url || URL.createObjectURL(this.blob);
    enlace.download = this.nombre;
    enlace.click();
  }

  imprimir(): void {
    // HTMLEmbedElement no declara contentWindow en el DOM de TypeScript, pero el navegador lo expone para un <embed> con contenido de plugin (el PDF).
    (this.visor?.nativeElement as unknown as { contentWindow?: Window })?.contentWindow?.print();
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
