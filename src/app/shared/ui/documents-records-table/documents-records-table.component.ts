import { TableSort, ariaSortDe, siguienteOrden } from '../../utils/table-sort.util';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { AfterViewChecked, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NotificationsStateService } from '../../../core/realtime/notifications-state.service';
import type { DocumentsRecordsColumn, DocumentsRecordsRow, DocumentsRecordsTab } from '../../types/documents-records.types';
import { FlowStatus, FlowStatusTagComponent } from '../flow-status-tag/flow-status-tag.component';
import { IconComponent } from '../icon/icon.component';
import { RecordStatus, RecordStatusTagComponent } from '../record-status-tag/record-status-tag.component';
import { StatusTagComponent } from '../status-tag/status-tag.component';
import { TooltipDirective } from '../tooltip/tooltip.directive';

export type DocumentsRecordsSelectionChange = {
  row: DocumentsRecordsRow;
  selected: boolean;
};

/**
 * Sombra de una columna fija como indicador de scroll: un degradado continuo (no una sombra por celda, que se corta en cada
 * separador de fila) que solo se ve cuando hay contenido por desplazar hacia ese lado (`data-sombra-izq` / `data-sombra-der`
 * del contenedor, que mantiene `medirScroll`).
 */
// Las clases van escritas completas: Tailwind no detecta las que se arman por interpolación.
const SOMBRA_IZQ =
  "after:pointer-events-none after:absolute after:-bottom-px after:left-full after:top-0 after:w-3 after:bg-gradient-to-r after:from-[color-mix(in_srgb,var(--sys-color-text-neutral-high)_14%,transparent)] after:to-transparent after:opacity-0 after:transition-opacity after:content-[''] group-data-[sombra-izq=true]/tabla:after:opacity-100";
const SOMBRA_DER =
  "after:pointer-events-none after:absolute after:-bottom-px after:right-full after:top-0 after:w-3 after:bg-gradient-to-l after:from-[color-mix(in_srgb,var(--sys-color-text-neutral-high)_14%,transparent)] after:to-transparent after:opacity-0 after:transition-opacity after:content-[''] group-data-[sombra-der=true]/tabla:after:opacity-100";

/** Ancho en px de una clase `w-[Npx]` o `w-N` (N × 4 px); sin clase, los 180 px que usa la tabla por defecto. */
function anchoDeClase(clase?: string): number {
  const px = clase?.match(/w-\[(\d+)px\]/);
  if (px) return Number(px[1]);
  const paso = clase?.match(/(?:^|\s)w-(\d+)(?:\s|$)/);
  return paso ? Number(paso[1]) * 4 : 180;
}

/**
 * Tabla de las pestañas Documentos / Registros: columnas configurables, celdas por tipo
 * (enlace al documento, tag de flujo, tag de registro), checkbox de selección (fijo a la izquierda al desplazar) y botón de historial.
 *
 * Es la tabla interna de `siaf-documents-records-page`; para una grilla nueva compón la grilla
 * estándar (`siaf-table-controls` arriba + `siaf-pagination Bottom` abajo) alrededor de ella.
 *
 * @usar
 * - En las pestañas Documentos / Registros de `siaf-documents-records-page` (plan de cuentas, asiento de ajuste,
 *   catálogo de ajuste, catálogos de eventos, apertura contable y contabilización).
 * - Cuando las columnas vienen de configuración (`DocumentsRecordsColumn` con `kind`, `align` y `widthClass`) y el
 *   panel de columnas decide cuáles se ven.
 * - Con `selectionDisabled` para dejar marcables solo los documentos de la acción masiva: Elaborados para el creador
 *   (Verificar) y Verificados para el aprobador (Aprobar).
 * - Con `headerGroup` en las columnas, la cabecera pasa a dos filas (grupo arriba, columna debajo), y con
 *   `recordSelectable` / `recordRowAction`, Registros suma casillas y cambia el ícono de la fila.
 * - Con `recordRoute` en una fila de Registros, o `detailRoute` en una de Documentos, la fila abre su detalle (emite
 *   `rowOpened`).
 * @evitar
 * - Para un listado de solo lectura con texto plano: `siaf-table`.
 * - Usarla sola, sin barra ni paginado: va dentro de la grilla estándar (`siaf-table-controls` arriba, con el
 *   seleccionar todo, y `siaf-pagination` con `position="Bottom"` y `rowPage` abajo).
 * - Mientras llegan las filas: `siaf-table-skeleton` con las mismas columnas y `minWidthClass`, no la tabla vacía.
 * - Copiar su marcado en otra pantalla: `siaf-tray-documents-view` todavía tiene una tabla parecida hecha a mano.
 * Con `sortable` en una columna, su título ordena (flecha ↑/↓ en la ordenada); la tabla recibe `sort` y emite
 * `sortChange`, y quien le da las filas las ordena (la página `siaf-documents-records-page` ya lo hace).
 *
 * @teclado
 * - **Tab**: recorre, fila por fila, el checkbox (solo en Documentos), el enlace al documento y el botón de historial;
 *   un checkbox deshabilitado queda fuera.
 * - **Espacio**: marca o desmarca el checkbox de la fila (emite `selectionChanged`).
 * - **Enter**: en el enlace, abre el documento (`routerLink`).
 * - **Enter / Espacio**: en el botón de historial, emiten `historyOpened`.
 * @accesibilidad
 * - **1.3.1 Información y relaciones (A)**: `<table>` con `<thead>` y un `<th>` por columna (sin `scope`, que con una
 *   sola fila de cabecera no hace falta); las columnas del checkbox y del historial tienen el `<th>` vacío. Las columnas
 *   `sortable` llevan `aria-sort` y su título es un botón; la tabla no ordena las filas: avisa con `sortChange`.
 * - **Pendiente · 4.1.2 Nombre, función y valor (A)**: el checkbox de cada fila no tiene nombre (ni `aria-label` ni
 *   `<label>`). El botón de historial sí lleva `aria-label`, pero en Registros dice siempre «Ver historial de cuenta
 *   contable», también en los asientos de ajuste.
 * - **Pendiente · 2.1.1 Teclado (A)**: la fila no es clicable y sus acciones son nativas, pero el texto completo de
 *   las cabeceras y celdas cortadas solo sale con `siafTooltip` al pasar el mouse: esas celdas no reciben foco (el
 *   enlace sí lo muestra al enfocarlo).
 * - **1.4.13 Contenido en hover o foco (AA)**: ese tooltip se cierra con Escape y se puede recorrer con el puntero.
 * - **Pendiente · 1.4.3 Contraste mínimo (AA)**: el enlace va en `text-neutral-high` (16.29:1 / 16.53:1) y «Nuevo» en
 *   blanco sobre `bg-brand-primary` (8.79:1 / 6.67:1), pero la etiqueta Observado de `siaf-flow-status-tag` (también
 *   Pendiente y Fallido) da 3.39:1 en claro, y el enlace en hover (`text-brand-primary`) pinta en oscuro con
 *   `bg-brand-primary` (2.66:1 sobre la superficie).
 * - **1.4.1 Uso del color (A)**: los estados llevan su nombre en la etiqueta y «Nuevo» es texto.
 * - **2.4.7 Foco visible (AA)**: sin estilo propio: enlace, checkbox y botón muestran el anillo nativo del navegador.
 * - **2.5.8 Tamaño del objetivo (AA)**: botón de historial de 32 px; el checkbox mide 16 px, pero cumple por
 *   espaciado (celda de 40 × 58 px).
 */
@Component({
  selector: 'siaf-documents-records-table',
  standalone: true,
  imports: [FlowStatusTagComponent, IconComponent, NgClass, NgTemplateOutlet, RecordStatusTagComponent, RouterLink, StatusTagComponent, TooltipDirective],
  template: `
    <div #scroll class="siaf-table-scroll group/tabla min-w-0" (scroll)="medirScroll()">
      <!-- Título de una columna: texto, o botón que ordena si la columna es sortable (flecha en la columna ordenada). -->
      <ng-template #titulo let-column>
        @if (column.sortable) {
          <button class="group inline-flex max-w-full items-center gap-siaf-xxs bg-transparent p-0 font-[inherit] uppercase text-inherit" type="button" title="Ordenar" [attr.aria-label]="'Ordenar por ' + (column.panelLabel || column.label)" (click)="ordenar(column.key)">
            <span class="truncate">{{ column.label }}</span>
            <siaf-icon
              class="shrink-0 transition-opacity"
              [class]="claseFlecha(column.key)"
              [name]="sort?.key === column.key && sort?.direction === 'desc' ? 'arrow_downward' : 'arrow_upward'"
              [size]="16"
            />
          </button>
        } @else {
          {{ column.label }}
        }
      </ng-template>

      <!-- Bordes separados (border-separate): con colapsados, las líneas de la cabecera sticky no la acompañan al desplazar; los de
           las filas van en cada celda. Ancho fijo por columna: con table-fixed y un col por columna, ordenar o paginar no mueve los anchos (en auto
           dependen del contenido de las filas que se ven). -->
      <table class="w-full min-w-full table-fixed border-separate border-spacing-0 text-left text-sm" [style.width.px]="anchoTabla">
        <colgroup>
          @if (mostrarCasilla) {
            <col class="w-10" />
          }
          @for (column of columns; track column.key) {
            <col [ngClass]="column.widthClass || 'w-[180px]'" />
          }
          <col class="w-14" />
        </colgroup>
        <thead>
          <tr class="bg-surface-high text-[10px] font-bold uppercase text-text">
            @if (mostrarCasilla) {
              <th class="sticky left-0 z-[3] w-10 rounded-l-siaf-sm bg-surface-high px-siaf-sm py-siaf-sm " [ngClass]="sombraIzq" [attr.rowspan]="hayGrupos ? 2 : null"></th>
            }
            @if (hayGrupos) {
              @for (celda of filaSuperior; track $index; let primera = $first) {
                <th
                  class="truncate px-siaf-md py-siaf-sm"
                  siafTooltip
                  [attr.colspan]="celda.colspan > 1 ? celda.colspan : null"
                  [attr.rowspan]="celda.rowspan > 1 ? celda.rowspan : null"
                  [attr.aria-sort]="celda.column?.sortable ? ariaSort(celda.column!.key) : null"
                  [ngClass]="[primera && mostrarCasilla ? 'border-l border-[var(--sys-color-divider-strong)]' : '', celda.fija ? claseFijaCabecera : '', celda.rowspan === 2 ? (celda.column?.widthClass || 'w-[180px]') : 'text-center', celda.column?.align === 'right' ? 'text-right' : celda.rowspan === 2 ? 'text-left' : '', celda.grupo && !celda.ultima && !celda.fija ? 'border-r border-[var(--sys-color-divider-strong)]' : '', !celda.grupo && celda.column?.borderRight ? 'border-r border-[var(--sys-color-divider-strong)]' : '']"
                >
                  @if (celda.column) {
                    <ng-container *ngTemplateOutlet="titulo; context: { $implicit: celda.column }" />
                  } @else {
                    {{ celda.label }}
                  }
                </th>
              }
            } @else {
              @for (column of columns; track column.key) {
                <!-- MFD RF-01: al superponer el mouse se muestra el texto completo de la columna -->
                <th class="truncate px-siaf-md py-siaf-sm" siafTooltip [attr.aria-sort]="column.sortable ? ariaSort(column.key) : null" [ngClass]="[column.widthClass || 'w-[180px]', column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left']"><ng-container *ngTemplateOutlet="titulo; context: { $implicit: column }" /></th>
              }
            }
            <th data-columna-accion [ngClass]="[hayColumnaFija ? '' : sombraDer, hayGrupos ? 'border-l border-[var(--sys-color-divider-strong)]' : '']" class="sticky right-0 w-14 rounded-r-siaf-sm bg-surface-high px-siaf-sm py-siaf-sm" [attr.rowspan]="hayGrupos ? 2 : null"></th>
          </tr>
          @if (hayGrupos) {
            <tr class="bg-surface-high text-[10px] font-bold uppercase text-text">
              @for (column of columnasConGrupo; track column.key; let i = $index) {
                <th
                  class="truncate px-siaf-md py-siaf-sm"
                  siafTooltip
                  [attr.aria-sort]="column.sortable ? ariaSort(column.key) : null"
                  [ngClass]="[i === 0 && mostrarCasilla && columns[0]?.headerGroup ? 'border-l border-[var(--sys-color-divider-strong)]' : '', column.fixed ? claseFijaCabecera : '', column.widthClass || 'w-[180px]', column.align === 'right' ? 'text-right' : 'text-left', finDeGrupo(i) && !column.fixed && i < columnasConGrupo.length - 1 ? 'border-r border-[var(--sys-color-divider-strong)]' : '']"
                ><ng-container *ngTemplateOutlet="titulo; context: { $implicit: column }" /></th>
              }
            </tr>
          }
        </thead>
        <tbody>
          @for (row of rows; track rowTrackValue(row, $index)) {
            <tr
              class="group/fila bg-surface hover:bg-[var(--sys-color-bg-states-light-hover)] [&>td]:border-b [&>td]:border-[var(--sys-color-divider-default)]"
              [class.h-12]="activeTab === 'records'"
              [class.cursor-pointer]="abreDetalle(row)"
              (click)="abreDetalle(row) && rowOpened.emit(row)"
            >
              @if (mostrarCasilla) {
                <td class="sticky left-0 z-[1] h-[58px] bg-surface px-siaf-sm py-siaf-xs group-hover/fila:[background-image:linear-gradient(var(--sys-color-bg-states-light-hover),var(--sys-color-bg-states-light-hover))]" [ngClass]="sombraIzq">
                  <input
                    class="size-4 disabled:cursor-not-allowed"
                    type="checkbox"
                    [checked]="row.selected"
                    [disabled]="selectionDisabled(row)"
                    (click)="$event.stopPropagation()"
                    (change)="onSelectionChange(row, $event)"
                  />
                </td>
              }
              @for (column of columns; track column.key) {
                <td class="px-siaf-md py-siaf-sm" [ngClass]="[column.fixed ? claseFija : '', column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left', column.kind === 'document-link' ? 'max-w-[440px]' : '']">
                  @if (column.kind === 'document-link') {
                    <span class="flex min-w-0 items-center gap-siaf-xs">
                      <a class="min-w-0 flex-1 truncate text-sm leading-normal text-text hover:text-brand-primary" siafTooltip [routerLink]="documentRoute(row)" (click)="onDocumentClick(row)">{{ row[column.key] }}</a>
                      @if (row['isNew']) {
                        <span class="inline-flex shrink-0 items-center rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Nuevo</span>
                      }
                    </span>
                  } @else if (column.kind === 'flow-status') {
                    <siaf-flow-status-tag [status]="flowStatus(row[column.key])" size="small" />
                  } @else if (column.kind === 'record-status') {
                    <siaf-record-status-tag [status]="recordStatus(row[column.key])" [size]="activeTab === 'records' ? 'small' : 'standard'" />
                  } @else if (column.kind === 'conciliation-status') {
                    <siaf-status-tag [tone]="row[column.key] === 'Conciliado' ? 'success' : 'default'" appearance="soft" size="small">{{ row[column.key] }}</siaf-status-tag>
                  } @else {
                    <span class="line-clamp-3 break-words" siafTooltip>{{ row[column.key] }}</span>
                  }
                </td>
              }
              <td [ngClass]="hayColumnaFija ? '' : sombraDer" class="sticky right-0 bg-surface px-siaf-sm py-siaf-xs">
                <button class="inline-flex size-8 items-center justify-center rounded-siaf-md transition hover:bg-surface-muted active:bg-[var(--sys-color-bg-states-dark-pressed)]" type="button" [attr.aria-label]="etiquetaAccion" [title]="etiquetaAccion" (click)="$event.stopPropagation(); historyOpened.emit(row)">
                  <siaf-icon [name]="iconoAccion" [size]="20" />
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentsRecordsTableComponent implements AfterViewChecked {
  private readonly notificationsState = inject(NotificationsStateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private observador: ResizeObserver | null = null;
  private columnaAccion: Element | null = null;
  @ViewChild('scroll') private scroll?: ElementRef<HTMLElement>;
  private observadorScroll: ResizeObserver | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.observador?.disconnect();
      this.observadorScroll?.disconnect();
    });
  }

  /**
   * La columna fija de datos se pega a la izquierda de la columna de acción: su `right` es el ancho real de esta última.
   * Con ancho fijo por columna, el navegador reparte el sobrante entre todas (también la de acción), así que no mide
   * siempre 56 px; se mide y se publica como variable CSS.
   */
  ngAfterViewChecked(): void {
    this.vigilarScroll();
    const th = this.host.nativeElement.querySelector('[data-columna-accion]');
    if (th === this.columnaAccion) return;
    this.observador?.disconnect();
    this.columnaAccion = th;
    if (!th || typeof ResizeObserver === 'undefined') return;
    const medir = (): void => this.host.nativeElement.style.setProperty('--ancho-accion', `${th.getBoundingClientRect().width}px`);
    this.observador = new ResizeObserver(medir);
    this.observador.observe(th);
    medir();
  }

  @Input() activeTab: DocumentsRecordsTab = 'documents';
  @Input() columns: DocumentsRecordsColumn[] = [];
  @Input() rows: DocumentsRecordsRow[] = [];
  /** Ya no fija el ancho de la tabla (lo da la suma de sus columnas); queda para quien dibuja el esqueleto con las mismas medidas. */
  @Input() minWidthClass = '';
  /** Registros con casilla por fila (Documentos siempre la tiene). */
  @Input() recordSelectable = false;
  /** Reemplaza el botón de historial de Registros (ícono y nombre accesible). */
  @Input() recordRowAction: { icon: string; label: string } | null = null;
  @Input() recordTrackKey = '';
  @Input() documentRoute: (row: DocumentsRecordsRow) => string = () => '';
  @Input() selectionDisabled: (row: DocumentsRecordsRow) => boolean = () => false;

  /** Orden actual (columna y sentido); la tabla solo lo pinta: ordenar las filas es de quien las entrega. */
  @Input() sort: TableSort | null = null;
  /** Se emite al pulsar el título de una columna `sortable`: el nuevo orden, o `null` al quitarlo. */
  @Output() sortChange = new EventEmitter<TableSort | null>();
  @Output() selectionChanged = new EventEmitter<DocumentsRecordsSelectionChange>();
  @Output() historyOpened = new EventEmitter<DocumentsRecordsRow>();
  /** Clic en una fila que trae `recordRoute` (Registros) o `detailRoute` (Documentos): abre su detalle. */
  @Output() rowOpened = new EventEmitter<DocumentsRecordsRow>();

  abreDetalle(row: DocumentsRecordsRow): boolean {
    const ruta = this.activeTab === 'records' ? row['recordRoute'] : row['detailRoute'];
    return typeof ruta === 'string' && !!ruta;
  }

  readonly sombraIzq = SOMBRA_IZQ;
  readonly sombraDer = SOMBRA_DER;
  /** Sin columna fija de datos (Documentos), la sombra derecha va en la columna de acción, que sí es fija. */
  get hayColumnaFija(): boolean {
    return this.columns.some((c) => c.fixed);
  }
  readonly claseFija = `sticky right-[var(--ancho-accion,3.5rem)] z-[1] bg-surface ${SOMBRA_DER}`;
  readonly claseFijaCabecera = `sticky right-[var(--ancho-accion,3.5rem)] z-[3] !overflow-visible bg-surface-high ${SOMBRA_DER}`;

  get mostrarCasilla(): boolean {
    return this.activeTab === 'documents' || this.recordSelectable;
  }

  get iconoAccion(): string {
    return this.activeTab === 'records' && this.recordRowAction ? this.recordRowAction.icon : 'history';
  }

  get etiquetaAccion(): string {
    if (this.activeTab === 'records') return this.recordRowAction?.label ?? 'Ver historial del registro';
    return 'Historial de documento';
  }

  get hayGrupos(): boolean {
    return this.columns.some((c) => !!c.headerGroup);
  }

  /** Columnas que van bajo un grupo de cabecera, en orden (las sueltas ocupan las dos filas de arriba). */
  get columnasConGrupo(): DocumentsRecordsColumn[] {
    return this.columns.filter((c) => !!c.headerGroup);
  }

  /** La columna en `indice` de `columnasConGrupo` cierra su grupo. */
  finDeGrupo(indice: number): boolean {
    const columnas = this.columnasConGrupo;
    return indice === columnas.length - 1 || columnas[indice].headerGroup !== columnas[indice + 1].headerGroup;
  }

  get filaSuperior(): { label: string; colspan: number; rowspan: 1 | 2; column?: DocumentsRecordsColumn; grupo: boolean; ultima: boolean; fija: boolean }[] {
    const celdas: { label: string; colspan: number; rowspan: 1 | 2; column?: DocumentsRecordsColumn; grupo: boolean; ultima: boolean; fija: boolean }[] = [];
    for (let i = 0; i < this.columns.length; i++) {
      const columna = this.columns[i];
      if (!columna.headerGroup) {
        celdas.push({ label: columna.label, colspan: 1, rowspan: 2, column: columna, grupo: false, ultima: false, fija: !!columna.fixed });
        continue;
      }
      let fin = i;
      while (fin + 1 < this.columns.length && this.columns[fin + 1].headerGroup === columna.headerGroup) fin++;
      celdas.push({ label: columna.headerGroup, colspan: fin - i + 1, rowspan: 1, grupo: true, ultima: fin === this.columns.length - 1, fija: this.columns.slice(i, fin + 1).some((c) => c.fixed) });
      i = fin;
    }
    return celdas;
  }

  rowTrackValue(row: DocumentsRecordsRow, index: number): string | number {
    const key = this.activeTab === 'documents' ? 'number' : this.recordTrackKey;
    const value = row[key];
    // Si el valor está vacío o es placeholder ("—", "-"), usar index para evitar colisiones
    if (!value || value === '—' || value === '-') {
      return `idx-${index}`;
    }
    return String(value);
  }

  onDocumentClick(row: DocumentsRecordsRow): void {
    const documentId = row['documentId'];
    if (typeof documentId === 'string' && documentId) {
      void this.notificationsState.marcarLeidaPorDocumento(documentId);
    }
  }

  onSelectionChange(row: DocumentsRecordsRow, event: Event): void {
    this.selectionChanged.emit({
      row,
      selected: (event.target as HTMLInputElement).checked
    });
  }

  recordStatus(value: unknown): RecordStatus {
    const statuses: RecordStatus[] = ['Activo', 'Inactivo', 'Anulado', 'En Proceso', 'Validado', 'Eliminado', 'Abierto', 'Cerrado', 'Procesado'];
    return statuses.includes(value as RecordStatus) ? (value as RecordStatus) : 'Activo';
  }

  flowStatus(value: unknown): FlowStatus {
    const statuses: FlowStatus[] = [
      'Elaborado',
      'Registrado',
      'Verificado',
      'Validado',
      'Revisado',
      'Generado',
      'En proceso',
      'Autorizado',
      'Firmado',
      'Aprobado',
      'Aceptado',
      'Publicado',
      'Procesado',
      'Observado',
      'Pendiente',
      'Fallido',
      'Eliminado',
      'Rechazado',
      'Anulado'
    ];

    return statuses.includes(value as FlowStatus) ? (value as FlowStatus) : 'Elaborado';
  }

  /**
   * Suma de los anchos de las columnas (checkbox y acción incluidos): la tabla mide exactamente eso, para que el navegador
   * no reparta el sobrante y ensanche las columnas del checkbox y de la acción más allá de su ícono.
   */
  get anchoTabla(): number {
    const datos = this.columns.reduce((suma, c) => suma + anchoDeClase(c.widthClass), 0);
    return (this.mostrarCasilla ? 40 : 0) + datos + 56;
  }

  /** Enciende las sombras de las columnas fijas solo hacia el lado en el que todavía hay contenido por desplazar. */
  medirScroll(): void {
    const el = this.scroll?.nativeElement;
    if (!el) return;
    el.dataset['sombraIzq'] = String(el.scrollLeft > 1);
    el.dataset['sombraDer'] = String(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  private vigilarScroll(): void {
    const el = this.scroll?.nativeElement;
    if (el && !this.observadorScroll && typeof ResizeObserver !== 'undefined') {
      this.observadorScroll = new ResizeObserver(() => this.medirScroll());
      this.observadorScroll.observe(el);
      const tabla = el.querySelector('table');
      if (tabla) this.observadorScroll.observe(tabla);
    }
    this.medirScroll();
  }

  ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    return ariaSortDe(this.sort, key);
  }

  /** La flecha de la columna ordenada se ve siempre; en las demás aparece tenue al pasar el cursor o enfocar el título. */
  claseFlecha(key: string): string {
    return this.sort?.key === key ? 'opacity-100' : 'opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60';
  }

  ordenar(key: string): void {
    this.sortChange.emit(siguienteOrden(this.sort, key));
  }
}
