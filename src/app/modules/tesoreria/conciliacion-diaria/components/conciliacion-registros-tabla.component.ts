import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { StatusTagComponent } from '../../../../shared/ui/status-tag/status-tag.component';
import { RegistroNoConciliado } from '../models/conciliacion-diaria.model';

/**
 * Tabla de registros no conciliados de la conciliación manual diaria (Figma 284:11534): la cabecera agrupa «Libro banco» y
 * «Registro de operaciones bancarias», y cada fila muestra su motivo y su estado de conciliación. Con `selectable` suma la
 * columna de casillas por fila (sin casilla en la cabecera: «seleccionar todo» va en la barra de control sobre la tabla); la
 * selección la lleva quien la usa (el side-nav de selección y la tarjeta del documento).
 */
@Component({
  selector: 'siaf-conciliacion-registros-tabla',
  standalone: true,
  imports: [StatusTagComponent],
  template: `
    <div class="siaf-sidepanel-table-scroll">
      <table class="w-full min-w-[1500px] border-collapse text-left text-sm">
        <thead class="text-xs font-bold uppercase text-text">
          <tr class="h-10 bg-[var(--sys-color-bg-surfaces-surface-high)] text-center">
            @if (selectable) {
              <th rowspan="2" class="w-12 rounded-tl-siaf-sm px-siaf-sm"></th>
            }
            <th rowspan="2" class="px-siaf-md text-left" [class.rounded-tl-siaf-sm]="!selectable">Nro</th>
            <th colspan="6" class="border-l border-[var(--sys-color-divider-strong)] px-siaf-md">Libro banco</th>
            <th colspan="5" class="border-l border-[var(--sys-color-divider-strong)] px-siaf-md">Registro de operaciones bancarias</th>
            <th rowspan="2" class="border-l border-[var(--sys-color-divider-strong)] px-siaf-md text-left">Mot. incons.</th>
            <th rowspan="2" class="rounded-tr-siaf-sm border-l border-[var(--sys-color-divider-strong)] px-siaf-md text-left">Estado conciliación</th>
          </tr>
          <tr class="h-10 bg-[var(--sys-color-bg-surfaces-surface-high)]">
            <th class="border-l border-[var(--sys-color-divider-strong)] px-siaf-md">F. operación</th>
            <th class="px-siaf-md">Número</th>
            <th class="px-siaf-md">Descripción</th>
            <th class="px-siaf-md">Ent. adm. ing.</th>
            <th class="px-siaf-md text-right">Débito (S/)</th>
            <th class="px-siaf-md text-right">Crédito (S/)</th>
            <th class="border-l border-[var(--sys-color-divider-strong)] px-siaf-md">F. operación B.</th>
            <th class="px-siaf-md">Número</th>
            <th class="px-siaf-md">Descripción</th>
            <th class="px-siaf-md text-right">Débito (S/)</th>
            <th class="px-siaf-md text-right">Crédito (S/)</th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows; track r.id) {
            <tr
              class="min-h-12 border-b border-[var(--sys-color-divider-default)] text-[var(--sys-color-text-neutral-medium)]"
              [class.cursor-pointer]="selectable"
              [class.hover:bg-surface-muted]="selectable"
              [class.bg-[var(--sys-color-bg-states-light-selected)]]="selectable && selectedIds.includes(r.id)"
              (click)="selectable && toggled.emit(r.id)"
            >
              @if (selectable) {
                <td class="px-siaf-sm" (click)="$event.stopPropagation()">
                  <input class="size-4 accent-brand-primary" type="checkbox" aria-label="Seleccionar fila" [checked]="selectedIds.includes(r.id)" (change)="toggled.emit(r.id)" />
                </td>
              }
              <td class="px-siaf-md py-siaf-sm">{{ r.nro }}</td>
              <td class="px-siaf-md py-siaf-sm">{{ r.lbFecha }}</td>
              <td class="px-siaf-md py-siaf-sm">{{ r.lbNumero }}</td>
              <td class="px-siaf-md py-siaf-sm">{{ r.lbDescripcion }}</td>
              <td class="px-siaf-md py-siaf-sm">{{ r.lbEntidad }}</td>
              <td class="px-siaf-md py-siaf-sm text-right">{{ r.lbDebito }}</td>
              <td class="px-siaf-md py-siaf-sm text-right">{{ r.lbCredito }}</td>
              <td class="px-siaf-md py-siaf-sm">{{ r.rbFecha }}</td>
              <td class="px-siaf-md py-siaf-sm">{{ r.rbNumero }}</td>
              <td class="px-siaf-md py-siaf-sm">{{ r.rbDescripcion }}</td>
              <td class="px-siaf-md py-siaf-sm text-right">{{ r.rbDebito }}</td>
              <td class="px-siaf-md py-siaf-sm text-right">{{ r.rbCredito }}</td>
              <td class="px-siaf-md py-siaf-sm">{{ r.motivo }}</td>
              <td class="px-siaf-md py-siaf-sm">
                <siaf-status-tag [tone]="r.conciliado ? 'success' : 'default'" appearance="soft" size="small">{{ r.conciliado ? 'Conciliado' : 'No conciliado' }}</siaf-status-tag>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="16" class="px-siaf-md py-siaf-lg text-center text-text-muted">No se encontraron resultados.</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConciliacionRegistrosTablaComponent {
  @Input() rows: RegistroNoConciliado[] = [];
  /** Agrega la columna de casillas. */
  @Input() selectable = false;
  @Input() selectedIds: readonly string[] = [];

  @Output() toggled = new EventEmitter<string>();
}
