import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { DataTableColumn, DataTableComponent, DataTableRow } from '../../components/data-table/data-table.component';
import { TableSort } from '../../utils/table-sort.util';

/**
 * Envoltorio mínimo sobre `siaf-data-table`: tabla de columnas y filas, sin selección ni paginación.
 *
 * Úsalo para listados simples. Cuando la tabla necesita barra superior o paginado, va la grilla
 * estándar: `siaf-table-controls` arriba (siempre, con `[showSelection]=false` si no hay selección)
 * y `siaf-pagination Bottom` abajo.
 *
 * Con `sortable` en una columna, su título ordena la tabla (flecha ↑/↓ en la columna ordenada, `aria-sort`): `local`
 * ordena las filas recibidas y `externo` solo emite `sortChange` para que el servidor las ordene.
 *
 * @usar
 * - Para un listado corto de solo lectura con columnas de texto (número, documento, estado como texto) dentro de una
 *   tarjeta o un panel.
 * - Hoy ninguna pantalla la usa: es la opción del kit antes de escribir otra `<table>` a mano.
 * @evitar
 * - Para enlace al documento, tags de estado, checkbox o historial por fila: `siaf-documents-records-table`.
 * - Para paginar o seleccionar: no lo hace; va la grilla estándar alrededor (`siaf-table-controls` arriba y
 *   `siaf-pagination` con `position="Bottom"` y `rowPage` abajo).
 * - Para ítems sin columnas (título, descripción, ícono): `siaf-list`.
 * @teclado
 * - No recibe foco: no es interactiva. El scroll es el de `siaf-data-table`, sin `tabindex`.
 * @accesibilidad
 * - **1.3.1 Información y relaciones (A)**: pinta `siaf-data-table`: `<table>` con `<thead>` y un `<th>` por columna.
 *   No admite `<caption>` ni `ariaLabel` (el padre debe titularla con un encabezado cercano) y solo las columnas con
 *   `sortable` llevan `aria-sort`.
 * - **1.4.3 Contraste mínimo (AA)**: celdas en `text-neutral-high` sobre la superficie (16.29:1 / 16.53:1).
 */
@Component({
  selector: 'siaf-table',
  standalone: true,
  imports: [DataTableComponent],
  template: `<siaf-data-table [columns]="columns" [rows]="rows" [idKey]="idKey" [sortMode]="sortMode" [sort]="sort" (sortChange)="sortChange.emit($event)" />`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableComponent {
  @Input({ required: true }) columns: DataTableColumn[] = [];
  @Input({ required: true }) rows: DataTableRow[] = [];
  @Input() idKey = 'id';
  /** `local` ordena aquí las filas; `externo` solo avisa con `sortChange` para que quien las trae las ordene. */
  @Input() sortMode: 'local' | 'externo' = 'local';
  /** Orden inicial o controlado desde fuera. */
  @Input() sort: TableSort | null = null;
  /** Orden elegido al pulsar el título de una columna con `sortable`; `null` al quitarlo. */
  @Output() sortChange = new EventEmitter<TableSort | null>();
}
