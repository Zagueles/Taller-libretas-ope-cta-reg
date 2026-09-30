import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostListener, Injector, Input, Output, afterNextRender, inject, signal } from '@angular/core';

import { ButtonComponent } from '../../ui/button/button.component';
import { DateTimePickerComponent } from '../../ui/date-time-picker/date-time-picker.component';
import { FocoDirective } from '../../ui/foco/foco.directive';
import { IconComponent } from '../../ui/icon/icon.component';
import { TagComponent } from '../../ui/tag/tag.component';

export interface DateRangeFilterValue {
  desde: string;
  hasta: string;
  /** Lo que se ve en la píldora («Hoy», «Últimos 7 días» o «dd/mm/aaaa - dd/mm/aaaa»). */
  label: string;
}

/** aaaa-mm-dd de hoy, o de `hoy` menos `diasAtras` días. */
const fechaIso = (diasAtras = 0): string => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - diasAtras);
  return fecha.toISOString().slice(0, 10);
};

const fechaVisible = (iso: string): string => (iso ? iso.split('-').reverse().join('/') : '');

/**
 * Píldora de filtro por fecha con rangos relativos (Figma «Fecha de registro selected» y «Calendar form»): Hoy,
 * Últimos 7 días y Últimos 30 días aplican solos; «Período personalizado» abre un segundo panel con Desde y Hasta,
 * y Cancelar / Aplicar. Se ve como `siaf-filter-pill` (mismo `siaf-tag` variante `filter`), pero en vez de una lista
 * plana de valores resuelve un rango de fechas aaaa-mm-dd.
 *
 * @figma «Fecha de registro selected» y «Calendar form»
 * @usar
 * - Para un filtro rápido de fecha sobre una grilla, cuando además de un valor puntual conviene ofrecer atajos
 *   relativos (Documentos y registros, Consultas y reportes).
 * @evitar
 * - Para un valor exacto entre pocas opciones fijas: `siaf-filter-pill`.
 * - Para un rango de fechas dentro de un formulario (no un filtro rápido): `siaf-date-time-picker` directo, dos
 *   campos Desde/Hasta.
 * @teclado
 * - **Tab / Enter / Espacio**: igual que `siaf-filter-pill` para abrir, y recorre las opciones del primer panel; en
 *   «Período personalizado», entra a Desde, Hasta, Cancelar y Aplicar.
 * - **Escape**: cierra cualquiera de los dos paneles y devuelve el foco a la píldora.
 * @accesibilidad
 * - **4.1.2 Nombre, función y valor (A)**: el tag es un `<button>` con `aria-haspopup="dialog"` y `aria-expanded`,
 *   como `siaf-filter-pill`; el panel de período personalizado es un `role="dialog"` con `aria-label`.
 * - **2.4.3 Orden del foco (A)**: con `siafFoco`, al abrir el foco entra en la primera opción y, al aplicar,
 *   cancelar o cerrar con Escape, vuelve a la píldora.
 */
@Component({
  selector: 'siaf-date-range-filter-pill',
  standalone: true,
  imports: [ButtonComponent, DateTimePickerComponent, FocoDirective, IconComponent, TagComponent],
  template: `
    <div class="relative inline-flex">
      <siaf-tag
        variant="filter"
        [selected]="!!selectedLabel"
        [expanded]="panelAbierto() !== 'cerrado'"
        [removable]="!!selectedLabel"
        [removeLabel]="'Quitar filtro ' + label"
        (clicked)="abrirOpciones()"
        (removed)="limpiar($event)"
      >{{ selectedLabel ? label + ': ' + selectedLabel : label }}</siaf-tag>

      @if (panelAbierto() !== 'cerrado') {
        <button
          class="fixed inset-0 z-20 cursor-default bg-transparent"
          type="button"
          data-capa-cierre
          tabindex="-1"
          aria-hidden="true"
          (mousedown)="$event.preventDefault()"
          (click)="cerrar()"
        ></button>

        <!-- Un solo siafFoco para las dos: con una por panel, al abrir «Período personalizado» el foco «sale» de la
             primera hacia la segunda y la cierra a las dos (siafFocoSalida no distingue paneles hermanos). -->
        <div
          class="contents"
          siafFoco
          [siafFocoAtrapar]="false"
          (siafFocoSalida)="cerrar()"
          (click)="$event.stopPropagation()"
        >
          <div class="absolute left-0 top-10 z-30 w-[260px] rounded-siaf-md border border-[var(--sys-color-divider-strong)] bg-surface py-siaf-xs shadow-siaf-elevation-8">
            @for (opcion of OPCIONES_RELATIVAS; track opcion.dias) {
              <button
                class="flex min-h-12 w-full items-center px-siaf-md text-left text-sm text-[var(--sys-color-text-neutral-high)] transition hover:bg-surface-muted focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                type="button"
                (click)="elegirRelativo(opcion.label, opcion.dias)"
              >
                {{ opcion.label }}
              </button>
            }
            <button
              class="flex min-h-12 w-full items-center justify-between px-siaf-md text-left text-sm text-[var(--sys-color-text-neutral-high)] transition hover:bg-surface-muted focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
              type="button"
              [class.bg-surface-muted]="panelAbierto() === 'personalizado'"
              [attr.aria-expanded]="panelAbierto() === 'personalizado'"
              (click)="panelAbierto.set('personalizado')"
            >
              Período personalizado
              <siaf-icon name="chevron_right" [size]="20" />
            </button>
          </div>

          @if (panelAbierto() === 'personalizado') {
            <div
              class="absolute left-[264px] top-10 z-30 flex w-[280px] flex-col gap-siaf-md rounded-siaf-md border border-[var(--sys-color-divider-strong)] bg-surface p-siaf-md shadow-siaf-elevation-8"
              role="dialog"
              [attr.aria-label]="label + ': período personalizado'"
            >
              <siaf-date-time-picker label="Desde" [fullWidth]="true" [defaultToToday]="false" [value]="desde()" (valueChange)="desde.set($event)" />
              <siaf-date-time-picker label="Hasta" [fullWidth]="true" [defaultToToday]="false" [minDate]="desde()" [value]="hasta()" (valueChange)="hasta.set($event)" />
              <div class="flex items-center justify-end gap-siaf-xs">
                <siaf-button variant="outline" size="sm" (click)="cerrar()">Cancelar</siaf-button>
                <siaf-button variant="filled" size="sm" [disabled]="!desde() || !hasta()" (click)="aplicarPersonalizado()">Aplicar</siaf-button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateRangeFilterPillComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  @Input() label = 'Fecha';
  /** Lo que se ve en la píldora; vacío, sin filtro aplicado. */
  @Input() selectedLabel = '';

  @Output() applied = new EventEmitter<DateRangeFilterValue>();
  @Output() cleared = new EventEmitter<void>();

  readonly OPCIONES_RELATIVAS = [
    { label: 'Hoy', dias: 0 },
    { label: 'Últimos 7 días', dias: 6 },
    { label: 'Últimos 30 días', dias: 29 },
  ];

  readonly panelAbierto = signal<'cerrado' | 'opciones' | 'personalizado'>('cerrado');
  readonly desde = signal('');
  readonly hasta = signal('');

  abrirOpciones(): void {
    this.desde.set('');
    this.hasta.set('');
    this.panelAbierto.set('opciones');
  }

  elegirRelativo(label: string, diasAtras: number): void {
    this.applied.emit({ desde: fechaIso(diasAtras), hasta: fechaIso(0), label });
    this.cerrar();
  }

  aplicarPersonalizado(): void {
    if (!this.desde() || !this.hasta()) return;
    const label = this.desde() === this.hasta() ? fechaVisible(this.desde()) : `${fechaVisible(this.desde())} - ${fechaVisible(this.hasta())}`;
    this.applied.emit({ desde: this.desde(), hasta: this.hasta(), label });
    this.cerrar();
  }

  limpiar(event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    this.cleared.emit();
    this.cerrar();
  }

  cerrar(): void {
    this.panelAbierto.set('cerrado');
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('[data-tag-boton]')?.focus(), { injector: this.injector });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.panelAbierto() !== 'cerrado') this.cerrar();
  }
}
