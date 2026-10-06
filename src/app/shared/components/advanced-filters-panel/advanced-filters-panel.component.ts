import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, signal } from '@angular/core';

import type {
  QueryReportAdvancedFilterField,
  QueryReportAdvancedFilters,
  QueryReportCondition,
  QueryReportConditionOperator,
  QueryReportResultType,
} from '../../types/query-report.types';
import { ButtonComponent } from '../../ui/button/button.component';
import { DateTimePickerComponent } from '../../ui/date-time-picker/date-time-picker.component';
import type { TextFieldOption } from '../../ui/text-field/text-field.component';
import { FocoDirective } from '../../ui/foco/foco.directive';
import { IconComponent } from '../../ui/icon/icon.component';
import { SidePanelAnimacion } from '../../ui/side-panel-animacion';
import { TextFieldComponent } from '../../ui/text-field/text-field.component';

/** Figma «Condición» (nodo 4663:59398): símbolo + etiqueta en la misma opción. */
const OPERADORES: { value: QueryReportConditionOperator; label: string }[] = [
  { value: '=', label: '=  Es igual a' },
  { value: '!=', label: '≠  No es igual a' },
  { value: '>', label: '>  Mayor que' },
  { value: '>=', label: '≥  Mayor o igual que' },
  { value: '<', label: '<  Menor que' },
  { value: '<=', label: '≤  Menor o igual que' },
  { value: 'between', label: '↔  Entre' },
  { value: 'empty', label: '∅  Está vacío' },
  { value: 'notEmpty', label: '≠∅  No está vacío' },
];

let siguienteId = 0;
let siguienteCondicionId = 0;

/** Máximo de niveles de Agrupado o Agregado. */
export const MAX_NIVELES = 3;

/**
 * Panel lateral «Filtros avanzados» (Figma «Filtrar por», nodos 4451:46835 y 4663:59398): «Condiciones» refina el
 * resultado ya traído con una o más comparaciones sobre sus columnas, y «Tipo de resultado» reorganiza esas filas en
 * grupos con subtotales (Agrupado) o en un panel de entidades consolidadas (Agregado) según los niveles elegidos.
 * Sin niveles, el resultado sigue siendo la tabla detallada de siempre.
 *
 * Trabaja sobre un borrador, igual que `siaf-query-parameters-panel`: cerrar sin aplicar no cambia nada, y reabrirlo
 * muestra lo último aplicado.
 *
 * @figma 4451:46835 Filtros avanzados (vacío)
 * @figma 4663:59398 Filtros avanzados (con condición y niveles)
 * @usar
 * - Desde el ícono de filtro de `siaf-form-table-search` en `siaf-query-report-page`, con `advancedFilterFields` de su
 *   configuración.
 * - Los niveles son hasta 3. Los campos con `hierarchy` (Entidad ▶ Unidad ejecutora) mantienen el orden del
 *   clasificador: el select no ofrece un campo que rompería el orden y el arrastre no los intercambia. El ícono de
 *   arrastre se apaga en un nivel con jerarquía que no puede subir (Entidad; Unidad ejecutora justo debajo de Entidad). `groupableIn` limita un campo a Agrupado o a Agregado.
 * @evitar
 * - Para los criterios que arman la consulta (fechas, cuenta, entidad): eso es «Parámetros de consulta»
 *   (`siaf-query-parameters-panel`).
 * - Para un filtro de una sola columna con opciones fijas: usar `siaf-filter-pill`.
 * @teclado
 * - **Tab**: recorre cada condición (Campo, Condición, Valor y su ✕), «Agregar condición», los radios de tipo de
 *   resultado, cada nivel (Campo y su ✕), «Agregar nivel», «Limpiar todo» y «Aplicar».
 * - **Escape**: cierra sin aplicar, como el panel de parámetros.
 * @accesibilidad
 * - **4.1.2 Nombre, función y valor (A)**: `role="dialog"` con `aria-modal` y `aria-labelledby`, igual que
 *   `siaf-query-parameters-panel`.
 * - **Pendiente**: los niveles no tienen reordenamiento por teclado; el ícono de arrastre del Figma es solo visual.
 */
@Component({
  selector: 'siaf-advanced-filters-panel',
  standalone: true,
  imports: [ButtonComponent, DateTimePickerComponent, FocoDirective, IconComponent, TextFieldComponent],
  template: `
    @if (anim.visible()) {
      <section
        class="siaf-sidepanel-overlay fixed inset-y-0 left-0 right-0 z-50 bg-black/55 pl-0 lg:pl-[65px]"
        [class.cerrando]="anim.cerrando()"
        aria-modal="true"
        role="dialog"
        [attr.aria-labelledby]="idTitulo"
        (click)="cerrar()"
      >
        <aside
          class="absolute bottom-0 right-0 top-0 flex w-full max-w-[420px] flex-col overflow-hidden border-l border-[var(--sys-color-divider-default)] bg-surface shadow-siaf-elevation-8"
          [siafFoco]="open"
          (siafFocoEscape)="cerrar()"
          (click)="$event.stopPropagation()"
        >
          <header class="flex h-14 shrink-0 items-center gap-siaf-xs px-siaf-md">
            <h2 class="m-0 flex-1 text-base font-bold uppercase leading-normal tracking-[0.02px] text-text" [id]="idTitulo">Filtros avanzados</h2>
            <button
              class="inline-flex size-10 items-center justify-center rounded-siaf-md text-text transition hover:bg-surface-muted active:bg-[var(--sys-color-bg-states-light-pressed)] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
              type="button"
              aria-label="Cerrar Filtros avanzados"
              (click)="cerrar()"
            >
              <siaf-icon name="close" [size]="24" />
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto px-siaf-md pb-siaf-md pt-siaf-sm">
            <div class="flex flex-col gap-siaf-lg">
              <section class="flex flex-col gap-siaf-md" data-condiciones>
                <h3 class="m-0 text-sm font-bold uppercase leading-normal text-[var(--sys-color-text-neutral-high)]">Condiciones</h3>

                @if (!condiciones().length) {
                  <p class="m-0 rounded-siaf-md bg-[var(--sys-color-bg-surfaces-surface-low,rgba(32,32,32,0.04))] p-siaf-md text-sm text-[var(--sys-color-text-neutral-medium)]">
                    Agrega una o más condiciones para refinar los resultados.
                  </p>
                }

                @for (condicion of condiciones(); track condicion.id; let i = $index) {
                  <div class="flex flex-col gap-siaf-md" [attr.data-condicion]="i">
                    <div class="flex h-8 items-center justify-between">
                      <span class="text-[11px] font-medium uppercase tracking-[0.66px] text-[var(--sys-color-text-neutral-medium)]">Condición {{ i + 1 }}</span>
                      <button
                        class="inline-flex size-8 items-center justify-center rounded-siaf-md text-[var(--sys-color-text-neutral-medium)] transition hover:bg-surface-muted focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                        type="button"
                        [attr.aria-label]="'Quitar condición ' + (i + 1)"
                        (click)="quitarCondicion(condicion.id)"
                      >
                        <siaf-icon name="delete" [size]="20" />
                      </button>
                    </div>

                    <div class="flex flex-col gap-siaf-md">
                      <div class="flex gap-siaf-md">
                        <siaf-input
                          class="flex-1"
                          type="select"
                          label="Campo"
                          [autoSuccess]="false"
                          [options]="opcionesCampo()"
                          [value]="condicion.field"
                          (valueChange)="cambiarCondicion(condicion.id, { field: $any($event), value: '', valueTo: '' })"
                        />
                        <siaf-input
                          class="flex-1"
                          type="select"
                          label="Condición"
                          [autoSuccess]="false"
                          [options]="opcionesOperador"
                          [value]="condicion.operator"
                          (valueChange)="cambiarCondicion(condicion.id, { operator: $any($event) })"
                        />
                      </div>

                      @if (condicion.operator !== 'empty' && condicion.operator !== 'notEmpty') {
                        @if (esCampoFecha(condicion.field)) {
                          <siaf-date-time-picker
                            [label]="condicion.operator === 'between' ? 'Valor desde' : 'Valor'"
                            [fullWidth]="true"
                            [value]="condicion.value ?? ''"
                            (valueChange)="cambiarCondicion(condicion.id, { value: $event })"
                          />
                          @if (condicion.operator === 'between') {
                            <siaf-date-time-picker
                              label="Valor hasta"
                              [fullWidth]="true"
                              [value]="condicion.valueTo ?? ''"
                              (valueChange)="cambiarCondicion(condicion.id, { valueTo: $event })"
                            />
                          }
                        } @else {
                          <!-- Con valores conocidos del campo: lista de selección; si no, texto libre. -->
                          @if (opcionesValor(condicion.field).length) {
                            <siaf-input
                              type="select"
                              [autoSuccess]="false"
                              [label]="condicion.operator === 'between' ? 'Valor desde' : 'Valor'"
                              [options]="opcionesValor(condicion.field)"
                              [value]="condicion.value ?? ''"
                              (valueChange)="cambiarCondicion(condicion.id, { value: $any($event) })"
                            />
                            @if (condicion.operator === 'between') {
                              <siaf-input
                                type="select"
                                  [autoSuccess]="false"
                                label="Valor hasta"
                                [options]="opcionesValor(condicion.field)"
                                [value]="condicion.valueTo ?? ''"
                                (valueChange)="cambiarCondicion(condicion.id, { valueTo: $any($event) })"
                              />
                            }
                          } @else {
                            <siaf-input
                              [label]="condicion.operator === 'between' ? 'Valor desde' : 'Valor'"
                              [value]="condicion.value ?? ''"
                              (valueChange)="cambiarCondicion(condicion.id, { value: $any($event) })"
                            />
                            @if (condicion.operator === 'between') {
                              <siaf-input
                                label="Valor hasta"
                                [value]="condicion.valueTo ?? ''"
                                (valueChange)="cambiarCondicion(condicion.id, { valueTo: $any($event) })"
                              />
                            }
                          }
                        }
                      }
                    </div>
                  </div>
                }

                <siaf-button variant="outline" icon="add" [disabled]="!opcionesCampo().length" (click)="agregarCondicion()">Agregar condición</siaf-button>
              </section>

              @if (haySeccionResultado()) {
                <div class="h-px w-full bg-[var(--sys-color-divider-default)]"></div>

                <section class="flex flex-col gap-siaf-md" data-tipo-resultado>
                  <h3 class="m-0 text-sm font-bold uppercase leading-normal text-[var(--sys-color-text-neutral-high)]">Tipo de resultado</h3>

                  <div class="flex gap-siaf-xs" role="radiogroup" aria-label="Tipo de resultado">
                    @for (opcion of opcionesTipoResultado; track opcion.value) {
                      <button
                        class="flex min-h-10 flex-1 items-center gap-siaf-md overflow-hidden rounded-siaf-sm border p-siaf-sm text-left transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                        type="button"
                        role="radio"
                        [attr.aria-checked]="tipoResultado() === opcion.value"
                        [class.border-[var(--sys-color-border-states-active)]]="tipoResultado() === opcion.value"
                        [class.bg-[var(--sys-color-bg-states-light-selected)]]="tipoResultado() === opcion.value"
                        [class.border-[var(--sys-color-border-states-enabled)]]="tipoResultado() !== opcion.value"
                        (click)="cambiarTipo(opcion.value)"
                      >
                        <siaf-icon
                          [name]="tipoResultado() === opcion.value ? 'radio_button_checked' : 'radio_button_unchecked'"
                          [size]="24"
                          class="shrink-0"
                          [class.text-[var(--sys-color-text-neutral-activated)]]="tipoResultado() === opcion.value"
                          [class.text-[var(--sys-color-icon-states-enabled)]]="tipoResultado() !== opcion.value"
                        />
                        <span
                          class="text-sm tracking-[-0.02px]"
                          [class.font-bold]="tipoResultado() === opcion.value"
                          [class.text-[var(--sys-color-text-neutral-activated)]]="tipoResultado() === opcion.value"
                          [class.text-[var(--sys-color-text-neutral-medium)]]="tipoResultado() !== opcion.value"
                        >
                          {{ opcion.label }}
                        </span>
                      </button>
                    }
                  </div>

                  @if (!niveles().length) {
                    <p class="m-0 rounded-siaf-md bg-[var(--sys-color-bg-surfaces-surface-low)] p-siaf-md text-sm text-[var(--sys-color-text-neutral-medium)]">
                      {{ tipoResultado() === 'agrupado'
                        ? 'Organiza los registros en grupos de uno o más campos, manteniendo el detalle de cada registro.'
                        : 'El saldo inicial y final se sumarán automáticamente según los campos seleccionados.' }}
                    </p>
                  }

                  @for (nivel of niveles(); track $index; let i = $index) {
                    <div
                      class="flex items-center gap-siaf-sm"
                      [attr.data-nivel]="i"
                      [draggable]="puedeArrastrar(i)"
                      (dragstart)="arrastrado = i"
                      (dragover)="$event.preventDefault()"
                      (drop)="soltar(i)"
                    >
                      <siaf-icon
                        name="drag_indicator"
                        [size]="20"
                        class="shrink-0"
                        [class.cursor-grab]="puedeArrastrar(i)"
                        [class.text-[var(--sys-color-icon-states-enabled)]]="puedeArrastrar(i)"
                        [class.text-[var(--sys-color-icon-states-disabled)]]="!puedeArrastrar(i)"
                        [attr.data-arrastre]="puedeArrastrar(i) ? 'habilitado' : 'deshabilitado'"
                      />
                      <siaf-input
                        class="flex-1"
                        type="select"
                        label="Campo"
                        [autoSuccess]="false"
                        [options]="opcionesNivel(i)"
                        [value]="nivel"
                        (valueChange)="cambiarNivel(i, $any($event))"
                      />
                      <button
                        class="inline-flex size-8 shrink-0 items-center justify-center rounded-siaf-md text-[var(--sys-color-text-neutral-medium)] transition hover:bg-surface-muted focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                        type="button"
                        [attr.aria-label]="'Quitar nivel ' + (i + 1)"
                        (click)="quitarNivel(i)"
                      >
                        <siaf-icon name="delete" [size]="20" />
                      </button>
                    </div>
                  }

                  @if (niveles().length < maxNiveles) {
                    <siaf-button variant="outline" icon="add" [disabled]="!puedeAgregarNivel()" (click)="agregarNivel()">Agregar nivel</siaf-button>
                  }
                </section>
              }
            </div>
          </div>

          <footer class="flex shrink-0 items-center justify-end gap-siaf-xs px-siaf-md py-siaf-sm">
            <siaf-button variant="outline" [disabled]="!hayCambios()" (click)="limpiar()">Limpiar todo</siaf-button>
            <siaf-button variant="filled" (click)="aplicar()">Aplicar</siaf-button>
          </footer>
        </aside>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdvancedFiltersPanelComponent implements OnChanges {
  @Input() open = false;
  @Input() fields: readonly QueryReportAdvancedFilterField[] = [];
  @Input() value: QueryReportAdvancedFilters | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() applied = new EventEmitter<QueryReportAdvancedFilters>();

  readonly anim = new SidePanelAnimacion();
  readonly idTitulo = `siaf-filtros-avanzados-${++siguienteId}`;
  readonly opcionesOperador: TextFieldOption[] = OPERADORES;
  readonly opcionesTipoResultado: { value: QueryReportResultType; label: string }[] = [
    { value: 'agrupado', label: 'Agrupado' },
    { value: 'agregado', label: 'Agregado' },
  ];

  readonly campos = signal<readonly QueryReportAdvancedFilterField[]>([]);
  readonly condiciones = signal<QueryReportCondition[]>([]);
  readonly tipoResultado = signal<QueryReportResultType>('agrupado');
  readonly niveles = signal<string[]>([]);

  readonly opcionesCampo = computed<TextFieldOption[]>(() => this.campos().map((c) => ({ label: c.label, value: c.key })));
  readonly maxNiveles = MAX_NIVELES;
  readonly haySeccionResultado = computed(() => this.campos().some((c) => c.groupable));
  arrastrado = -1;

  /** Campos que se pueden elegir como nivel según el tipo de resultado: Agrupado admite también la fecha de acreditación. */
  readonly nivelesDisponibles = computed(() =>
    this.campos().filter((c) => c.groupable && (!c.groupableIn || c.groupableIn.includes(this.tipoResultado()))),
  );

  private jerarquiaDe(clave: string): number | undefined {
    return this.campos().find((c) => c.key === clave)?.hierarchy;
  }

  /** Los niveles con jerarquía (Entidad ▶ Unidad ejecutora) deben ir en el orden del clasificador. */
  private ordenValido(niveles: readonly string[]): boolean {
    const rangos = niveles.map((n) => this.jerarquiaDe(n)).filter((r): r is number => r !== undefined);
    return rangos.every((r, i) => i === 0 || rangos[i - 1] < r);
  }

  readonly jerarquiaCorrecta = computed(() => this.ordenValido(this.niveles()));

  /**
   * Un nivel sin jerarquía se arrastra siempre que haya otro con quien cambiar. Uno con jerarquía (Entidad, Unidad
   * ejecutora) queda bloqueado, salvo que justo encima tenga un nivel sin jerarquía por el que subir: así Entidad ▶
   * Unidad ejecutora nunca se intercambian.
   */
  puedeArrastrar(indice: number): boolean {
    const niveles = this.niveles();
    if (niveles.length < 2) return false;
    if (this.jerarquiaDe(niveles[indice]) === undefined) return true;
    return indice > 0 && this.jerarquiaDe(niveles[indice - 1]) === undefined;
  }

  cambiarTipo(tipo: QueryReportResultType): void {
    this.tipoResultado.set(tipo);
    const permitidos = new Set(this.nivelesDisponibles().map((c) => c.key));
    this.niveles.update((actual) => actual.filter((n) => n === '' || permitidos.has(n)));
  }

  /** Suelta el nivel arrastrado en `destino`; si el nuevo orden rompe la jerarquía, no cambia nada. */
  soltar(destino: number): void {
    const origen = this.arrastrado;
    this.arrastrado = -1;
    if (origen < 0 || origen === destino) return;
    const nuevo = [...this.niveles()];
    const [movido] = nuevo.splice(origen, 1);
    nuevo.splice(destino, 0, movido);
    if (this.ordenValido(nuevo)) this.niveles.set(nuevo);
  }

  readonly hayCambios = computed(() => this.condiciones().length > 0 || this.niveles().length > 0);

  ngOnChanges(changes: SimpleChanges): void {
    if ('fields' in changes) this.campos.set(this.fields);
    if ('open' in changes) {
      if (this.open) this.cargarBorrador();
      this.anim.actualizar(this.open);
    }
  }

  /** Valores que el campo tiene en el resultado (los entrega la pantalla); vacío = texto libre. */
  @Input() valueOptions: Record<string, TextFieldOption[]> = {};

  opcionesValor(clave: string): TextFieldOption[] {
    return this.valueOptions[clave] ?? [];
  }

  esCampoFecha(clave: string): boolean {
    return this.campos().find((c) => c.key === clave)?.type === 'date';
  }

  /**
   * Opciones del select del nivel `indice`: su campo actual y los libres que, puestos ahí, respetan la jerarquía del
   * clasificador (no se ofrece Entidad detrás de Unidad ejecutora).
   */
  opcionesNivel(indice: number): TextFieldOption[] {
    const elegidos = new Set(this.niveles());
    const actual = this.niveles()[indice];
    return this.nivelesDisponibles()
      .filter((c) => c.key === actual || (!elegidos.has(c.key) && this.ordenValido(this.niveles().map((n, i) => (i === indice ? c.key : n)))))
      .map((c) => ({ label: c.label, value: c.key }));
  }

  private libresParaAgregar(): QueryReportAdvancedFilterField[] {
    return this.nivelesDisponibles().filter((c) => !this.niveles().includes(c.key) && this.ordenValido([...this.niveles(), c.key]));
  }

  puedeAgregarNivel(): boolean {
    // Se puede agregar otro nivel aunque el anterior siga vacío, mientras queden campos por elegir para todos.
    const vacios = this.niveles().filter((n) => n === '').length;
    return this.niveles().length < MAX_NIVELES && this.libresParaAgregar().length > vacios;
  }

  /** La condición nueva entra vacía (sin campo ni condición): la persona elige cada cosa; hasta entonces no se aplica. */
  agregarCondicion(): void {
    this.condiciones.update((actual) => [...actual, { id: `condicion-${++siguienteCondicionId}`, field: '', operator: '' as QueryReportCondition['operator'] }]);
  }

  quitarCondicion(id: string): void {
    this.condiciones.update((actual) => actual.filter((c) => c.id !== id));
  }

  cambiarCondicion(id: string, cambios: Partial<QueryReportCondition>): void {
    this.condiciones.update((actual) => actual.map((c) => (c.id === id ? { ...c, ...cambios } : c)));
  }

  agregarNivel(): void {
    if (this.niveles().length >= MAX_NIVELES) return;
    // El nivel nuevo entra vacío: la persona elige el campo.
    if (this.puedeAgregarNivel()) this.niveles.update((actual) => [...actual, '']);
  }

  quitarNivel(indice: number): void {
    this.niveles.update((actual) => actual.filter((_, i) => i !== indice));
  }

  cambiarNivel(indice: number, valor: string): void {
    const nuevo = this.niveles().map((v, i) => (i === indice ? valor : v));
    if (this.ordenValido(nuevo)) this.niveles.set(nuevo);
  }

  limpiar(): void {
    this.condiciones.set([]);
    this.tipoResultado.set('agrupado');
    this.niveles.set([]);
  }

  aplicar(): void {
    const condicionesCompletas = this.condiciones().filter(
      (c) => c.field && c.operator && (c.operator === 'empty' || c.operator === 'notEmpty' || !!c.value),
    );
    this.applied.emit({ conditions: condicionesCompletas, resultType: this.tipoResultado(), levels: this.niveles().filter(Boolean) });
  }

  cerrar(): void {
    this.closed.emit();
  }

  private cargarBorrador(): void {
    this.condiciones.set(this.value?.conditions.map((c) => ({ ...c })) ?? []);
    this.tipoResultado.set(this.value?.resultType ?? 'agrupado');
    this.niveles.set([...(this.value?.levels ?? [])]);
  }
}
