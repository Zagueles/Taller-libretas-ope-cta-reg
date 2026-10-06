import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { ButtonComponent } from '../../ui/button/button.component';
import { IconComponent } from '../../ui/icon/icon.component';
import { TextFieldComponent, TextFieldOption } from '../../ui/text-field/text-field.component';
import { CascadingMenuComponent, CascadingMenuGroup, CascadingMenuSelection } from '../../ui/cascading-menu/cascading-menu.component';
import { FocoDirective } from '../../ui/foco/foco.directive';

export interface FilterRow {
  campo: string;
  condicion: string;
  valor: string;
}

export interface CustomFilterApplyEvent {
  filters: FilterRow[];
}

/**
 * Panel de filtros personalizados: filas de condición con los selects Campo, Condición y Valor (`siaf-input`) que se
 * agregan o quitan; cambiar el Campo vacía la Condición y el Valor, e `initialRows` precarga las filas al editar un
 * filtro ya aplicado.
 *
 * `aplicar` emite solo las filas completas, `cancelar` las limpia y, con `deleteEnabled`, quitar la única fila emite
 * `eliminar`. Solo pinta el contenido: el padre lo abre como panel flotante y lo cierra.
 *
 * @usar
 * - Para el panel «Agregar filtro» de la bandeja y de las pestañas Documentos / Registros
 *   (`siaf-documents-records-page`): cada filtro aplicado queda como un chip que se puede reabrir.
 * - Para editar ese chip: abrirlo con `initialRows` y `[deleteEnabled]="true"`, así quitar la única condición elimina
 *   el filtro.
 * - Cuando el criterio combina un campo, una condición (Es igual a, Contiene) y un valor elegido de una lista.
 * @evitar
 * - Para filtrar por un solo campo con pocas opciones (Estado, Tipo de acción): `siaf-filter-pill`.
 * - Para buscar texto libre: `siaf-form-table-search` (en Documentos y registros y la bandeja, su variante
 *   `siaf-records-search-toolbar`).
 * - Para mostrar los criterios ya aplicados en Consultas y reportes: `siaf-consultas-filtros-chips`.
 * @teclado
 * - **Tab**: al abrirse, el foco entra en el primer campo; recorre fila por fila los selects Campo, Condición y Valor y
 *   la papelera; después «Agregar condición», Aplicar (habilitado solo con una fila completa) y Cancelar.
 * - **Enter / Espacio**: en «Agregar condición» suman una fila; en la papelera la quitan (con `deleteEnabled` y una
 *   sola fila, emiten `eliminar`).
 * - Los selects siguen `siaf-input` y Aplicar / Cancelar, `siaf-button`.
 * - **Escape**: emite `cancelar` para que el padre cierre el panel; el foco vuelve al botón que lo abrió. Con la lista
 *   de un select abierta, Escape cierra solo la lista.
 * @accesibilidad
 * - **Pendiente · 1.3.1 Información y relaciones (A)**: el título «Agregar filtros personalizados» es un `<span>`, no
 *   un encabezado, y las filas no se agrupan (`fieldset` o `role="group"`): con varias condiciones se repiten «Campo»,
 *   «Condición», «Valor» y «Eliminar condicion» sin decir de qué fila son.
 * - **4.1.2 Nombre, función y valor (A)**: los selects de `siaf-input` publican `aria-haspopup="listbox"` y
 *   `aria-expanded`; la papelera es un `<button>` con `aria-label` («Eliminar condicion», sin tilde) y Aplicar usa
 *   `disabled`.
 * - **Pendiente · 2.4.3 Orden del foco (A)**: con `siafFoco` (sin atrapar Tab) el foco entra al abrirse y vuelve al
 *   botón que lo abrió al cerrarse, pero al agregar una condición el foco no pasa a la fila nueva y, al quitar la fila
 *   final, su papelera desaparece sin mover el foco.
 * - **3.3.2 Etiquetas o instrucciones (A)**: cada select muestra su etiqueta (Campo, Condición, Valor); no hay texto
 *   que diga que Aplicar necesita una fila completa.
 * - **1.4.3 Contraste mínimo (AA)**: título `text-neutral-medium` (14.53:1 / 12.87:1), «Agregar condición»
 *   `text-neutral-high` (16.29:1 / 16.53:1) y papelera `text-neutral-low` (5.01:1 / 8.86:1) sobre la superficie.
 * - **Pendiente · 1.4.11 Contraste no textual (AA)**: los selects heredan de `siaf-input` el borde
 *   `border-states-enabled` (2.44:1 / 2.59:1) mientras no tienen foco ni valor.
 * - **2.4.7 Foco visible (AA)**: «Agregar condición» y la papelera muestran un contorno de 2 px del color de su texto
 *   (`focus-visible:outline-2`); los selects y los botones, el de su componente.
 * - **2.5.8 Tamaño del objetivo (AA)**: papelera de 32 px, «Agregar condición» de unos 28 px de alto y Aplicar /
 *   Cancelar de 32 px (`siaf-button` en `sm`).
 */
@Component({
  selector: 'siaf-custom-filter',
  standalone: true,
  imports: [FocoDirective, ButtonComponent, CascadingMenuComponent, IconComponent, TextFieldComponent],
  template: `
    <div class="flex max-h-[calc(100vh-96px)] flex-col gap-siaf-md overflow-y-auto rounded-siaf-md bg-surface p-siaf-md shadow-siaf-elevation-1 sm:max-h-none sm:overflow-visible" siafFoco [siafFocoAtrapar]="false" (siafFocoEscape)="cancelar.emit()">
      <div class="flex flex-col gap-siaf-md">
        <span class="text-sm font-bold text-[var(--sys-color-text-neutral-medium)]">Agregar filtros personalizados</span>

        @for (row of rows; track $index; let i = $index) {
          <div class="flex items-start gap-siaf-sm">
            <div class="grid min-w-0 flex-1 grid-cols-1 gap-siaf-xs sm:grid-cols-3">
              <div class="min-w-0">
                @if (campoGroups) {
                  <!-- Campo en dos niveles: primero el grupo de cabecera y, al costado, su columna. -->
                  <siaf-cascading-menu [open]="menuCampo === i" [groups]="campoGroups" ariaLabel="Campo" (selected)="onCampoCascada(i, $event)" (closed)="menuCampo = -1">
                    <span class="relative block">
                      <span class="absolute -top-2.5 left-3 z-[1] rounded-siaf-sm bg-surface px-siaf-xxs text-xs font-medium leading-normal" [class]="menuCampo === i ? 'text-[var(--sys-color-text-brand-primary)]' : 'text-[var(--sys-color-text-neutral-medium)]'">Campo</span>
                      <button
                        class="flex h-10 w-full items-center rounded-siaf-md border bg-surface px-siaf-md text-left text-sm text-text outline-none transition"
                        [class]="menuCampo === i ? 'border-[var(--sys-color-border-states-active)]' : 'border-[var(--sys-color-border-states-enabled)]'"
                        type="button"
                        aria-haspopup="menu"
                        [attr.aria-expanded]="menuCampo === i"
                        aria-label="Campo"
                        (click)="menuCampo = menuCampo === i ? -1 : i"
                      >
                        <span class="min-w-0 flex-1 truncate" [class.text-[var(--sys-color-text-neutral-low)]]="!row.campo">{{ etiquetaCampo(row.campo) || 'Campo' }}</span>
                        <siaf-icon class="shrink-0 transition" [class.rotate-180]="menuCampo === i" name="expand_more" [size]="24" />
                      </button>
                    </span>
                  </siaf-cascading-menu>
                } @else {
                  <siaf-input
                    label="Campo"
                    type="select"
                    [options]="campoOptions"
                    [value]="row.campo"
                    (valueChange)="onCampoChange(i, $event)"
                  />
                }
              </div>
              <div class="min-w-0">
                <siaf-input
                  label="Condici&oacute;n"
                  type="select"
                  [options]="condicionOptions"
                  [value]="row.condicion"
                  (valueChange)="onCondicionChange(i, $event)"
                />
              </div>
              <div class="min-w-0">
                <siaf-input
                  label="Valor"
                  type="select"
                  [options]="valorOpcionesDe(row.campo)"
                  [value]="row.valor"
                  (valueChange)="onValorChange(i, $event)"
                />
              </div>
            </div>
            <button
              class="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-siaf-md p-siaf-xxs text-text-muted transition hover:bg-surface-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40"
              type="button"
              aria-label="Eliminar condicion"
              (click)="removeRow(i)"
            >
              <siaf-icon name="delete_outline" [size]="20" />
            </button>
          </div>
        }

        <div>
          <button
            class="inline-flex items-center gap-siaf-xs rounded-siaf-md px-siaf-md py-siaf-xxs text-sm font-medium text-text transition hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            type="button"
            (click)="addRow()"
          >
            <siaf-icon name="add" [size]="20" />
            Agregar condici&oacute;n
          </button>
        </div>

        <div class="flex flex-row flex-wrap items-center gap-siaf-sm">
          <siaf-button
            variant="primary"
            size="sm"
            [disabled]="!canApply"
            (click)="onAplicar()"
          >
            Aplicar
          </siaf-button>
          <siaf-button
            variant="secondary"
            size="sm"
            (click)="onCancelar()"
          >
            Cancelar
          </siaf-button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomFilterComponent implements OnChanges {
  @Input() campoOptions: TextFieldOption[] = [];
  @Input() condicionOptions: TextFieldOption[] = [];
  /** Campos agrupados (grupo de cabecera → columnas): el Campo se elige en un menú de dos niveles en vez de una lista plana. */
  @Input() campoGroups: CascadingMenuGroup[] | null = null;
  @Input() valorOptions: TextFieldOption[] = [];
  /** Valores a elegir según el campo de cada fila; si el campo no está aquí (o no se pasa), se usa `valorOptions`. */
  @Input() valorOptionsByCampo: Record<string, TextFieldOption[]> | null = null;
  @Input() initialRows: FilterRow[] = [];
  @Input() deleteEnabled = false;

  @Output() aplicar = new EventEmitter<CustomFilterApplyEvent>();
  @Output() cancelar = new EventEmitter<void>();
  @Output() eliminar = new EventEmitter<void>();

  /** Fila cuyo menú de Campo está abierto (-1: ninguna). */
  menuCampo = -1;

  etiquetaCampo(campo: string): string {
    return this.campoOptions.find((o) => o.value === campo)?.label ?? '';
  }

  onCampoCascada(index: number, seleccion: CascadingMenuSelection): void {
    this.onCampoChange(index, seleccion.optionId);
    this.menuCampo = -1;
  }

  rows: FilterRow[] = [{ campo: '', condicion: '', valor: '' }];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialRows']) {
      this.rows = this.initialRows.length > 0
        ? this.initialRows.map((row) => ({ ...row }))
        : [{ campo: '', condicion: '', valor: '' }];
    }
  }

  get canApply(): boolean {
    return this.rows.some((r) => r.campo && r.condicion && r.valor);
  }

  addRow(): void {
    this.rows = [...this.rows, { campo: '', condicion: '', valor: '' }];
  }

  removeRow(index: number): void {
    if (this.deleteEnabled && this.rows.length === 1) {
      this.eliminar.emit();
      return;
    }

    const updated = this.rows.filter((_, i) => i !== index);
    this.rows = updated.length > 0 ? updated : [{ campo: '', condicion: '', valor: '' }];
  }

  valorOpcionesDe(campo: string): TextFieldOption[] {
    return this.valorOptionsByCampo?.[campo] ?? this.valorOptions;
  }

  onCampoChange(index: number, value: string | number | string[]): void {
    this.rows = this.rows.map((r, i) => (i === index ? { ...r, campo: String(value), condicion: '', valor: '' } : r));
  }

  onCondicionChange(index: number, value: string | number | string[]): void {
    this.rows = this.rows.map((r, i) => (i === index ? { ...r, condicion: String(value) } : r));
  }

  onValorChange(index: number, value: string | number | string[]): void {
    this.rows = this.rows.map((r, i) => (i === index ? { ...r, valor: String(value) } : r));
  }

  onAplicar(): void {
    this.aplicar.emit({ filters: this.rows.filter((r) => r.campo && r.condicion && r.valor) });
  }

  onCancelar(): void {
    this.rows = [{ campo: '', condicion: '', valor: '' }];
    this.cancelar.emit();
  }

}
