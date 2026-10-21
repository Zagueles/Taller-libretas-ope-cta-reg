import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

import { IconComponent } from '../../ui/icon/icon.component';
import { TableSort, ariaSortDe, ordenarFilas, siguienteOrden } from '../../utils/table-sort.util';

export interface DataTableColumn {
  key: string;
  label: string;
  /** El título pasa a ser un botón que ordena la tabla por esta columna (ascendente, descendente, sin orden). */
  sortable?: boolean;
}

export type DataTableRow = Record<string, string | number>;

/**
 * Tabla de solo lectura: una cabecera con las `columns` y una fila por registro con el texto de cada celda
 * (`row[column.key]`); `idKey` identifica las filas.
 *
 * Usa las clases globales `siaf-table-*` (cabecera fija y scroll con alto máximo de 480 px, 320 px en móvil). No
 * selecciona ni pagina; `siaf-table` la envuelve con la misma API. Ordena solo las columnas con `sortable`.
 *
 * @usar
 * - Para un listado corto de solo lectura con texto plano en cada celda (número, documento, estado como texto), sin
 *   acciones por fila.
 * - Hoy solo la pinta `siaf-table`, que ninguna pantalla usa: es la base para un listado nuevo antes de escribir otra
 *   `<table>` a mano.
 * @evitar
 * - Para celdas con enlace al documento, tag de estado, checkbox o historial: `siaf-documents-records-table`.
 * - Para seleccionar o paginar: no lo hace sola; va dentro de la grilla estándar (`siaf-table-controls` arriba y
 *   `siaf-pagination` con `position="Bottom"` y `rowPage` abajo).
 * - Para ítems sin columnas (título, descripción, ícono): `siaf-list`.
 * @teclado
 * - **Tab / Enter / Espacio**: solo en el título de una columna `sortable` (botón que ordena). El resto no recibe foco.
 * - No recibe foco: no es interactiva. Si las filas pasan el alto máximo, el contenedor con scroll no lleva
 *   `tabindex`: desplazarlo con el teclado depende del navegador.
 * @accesibilidad
 * - **1.3.1 Información y relaciones (A)**: `<table>` con `<thead>`, `<tbody>` y un `<th>` por columna (sin `scope`,
 *   que con una sola fila de cabecera no hace falta). No admite `<caption>` ni `ariaLabel`: el padre debe titularla
 *   con un encabezado cercano. Las columnas `sortable` llevan `aria-sort` en su `<th>` y su título es un botón.
 * - **2.1.1 Teclado (A)**: el título de una columna `sortable` es un botón: Tab lo enfoca y Enter o Espacio ordenan.
 * - **1.4.3 Contraste mínimo (AA)**: celdas en `text-neutral-high` sobre la superficie (16.29:1 / 16.53:1); la
 *   cabecera, en `text-neutral-high` sobre `bg-surfaces-surface-high` (más que `text-neutral-medium` en ese fondo,
 *   11.46:1 / 11.39:1).
 */
@Component({
  selector: 'siaf-data-table',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="siaf-table-shell">
      <table class="siaf-table">
        <thead>
          <tr class="siaf-table-head-row">
            @for (column of columns; track column.key) {
              <th class="siaf-table-th" [attr.aria-sort]="column.sortable ? ariaSort(column.key) : null">
                @if (column.sortable) {
                  <button class="group inline-flex items-center gap-siaf-xxs bg-transparent p-0 font-[inherit] uppercase text-inherit" type="button" title="Ordenar" [attr.aria-label]="'Ordenar por ' + column.label" (click)="ordenar(column.key)">
                    {{ column.label }}
                    <siaf-icon
                      class="shrink-0 transition-opacity"
                      [class]="claseFlecha(column.key)"
                      [name]="orden()?.key === column.key && orden()?.direction === 'desc' ? 'arrow_downward' : 'arrow_upward'"
                      [size]="16"
                    />
                  </button>
                } @else {
                  {{ column.label }}
                }
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of filas(); track row[idKey]) {
            <tr class="siaf-table-row">
              @for (column of columns; track column.key) {
                <td class="siaf-table-td">{{ row[column.key] }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataTableComponent {
  @Input({ required: true }) columns: DataTableColumn[] = [];
  private readonly _rows = signal<DataTableRow[]>([]);
  @Input({ required: true }) set rows(valor: DataTableRow[]) {
    this._rows.set(valor ?? []);
  }
  @Input() idKey = 'id';
  /**
   * Quién ordena: `local` (por defecto) ordena aquí las filas recibidas; `externo` solo emite `sortChange` y deja el
   * orden a quien alimenta las filas (p. ej. el servidor, cuando la lista está paginada).
   */
  @Input() sortMode: 'local' | 'externo' = 'local';
  /** Orden inicial o controlado desde fuera; sin él, la tabla lo lleva sola. */
  @Input() set sort(valor: TableSort | null) {
    this.orden.set(valor);
  }
  /** Se emite al pulsar el título de una columna `sortable`: el nuevo orden, o `null` al quitarlo. */
  @Output() sortChange = new EventEmitter<TableSort | null>();

  readonly orden = signal<TableSort | null>(null);
  readonly filas = computed(() => (this.sortMode === 'local' ? ordenarFilas(this._rows(), this.orden(), (fila, key) => fila[key]) : this._rows()));

  ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    return ariaSortDe(this.orden(), key);
  }

  /** La flecha de la columna ordenada se ve siempre; en las demás aparece tenue al pasar el cursor o enfocar el título. */
  claseFlecha(key: string): string {
    return this.orden()?.key === key ? 'opacity-100' : 'opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60';
  }

  ordenar(key: string): void {
    const nuevo = siguienteOrden(this.orden(), key);
    this.orden.set(nuevo);
    this.sortChange.emit(nuevo);
  }
}
