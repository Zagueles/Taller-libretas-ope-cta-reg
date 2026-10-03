import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';

import { ButtonComponent } from '../../ui/button/button.component';
import { ExpansionPanelComponent } from '../../ui/expansion-panel/expansion-panel.component';
import { IconComponent } from '../../ui/icon/icon.component';
import { SideNavComponent } from '../../ui/side-nav/side-nav.component';
import { TextFieldComponent } from '../../ui/text-field/text-field.component';
import { TooltipDirective } from '../../ui/tooltip/tooltip.directive';
import type { ParametroAplicado } from '../parametros-aplicados/parametros-aplicados.component';

/** Un favorito ya resumido para el listado: lo que dice su segunda línea. */
export interface FavoritoResumen {
  id: string;
  description: string;
  isDefault: boolean;
  /** «7 parámetros · 2 condiciones · 3 agrupados». */
  summary: string;
  /** Lo que se guardó, redactado para la tarjeta que sale al pasar el puntero por el favorito (sin él no hay tarjeta). */
  detalle?: FavoritoDetalle;
}

/** Los tres bloques de la tarjeta de un favorito: parámetros, condiciones y agrupado o agregado, ya en texto. */
export interface FavoritoDetalle {
  parametros: string;
  condiciones: string;
  niveles: string;
  tipoResultado: 'agrupado' | 'agregado';
}

/** La consulta que se está viendo, descrita para el formulario «Agregar favorito». */
export interface FavoritoActual {
  parametros: ParametroAplicado[];
  /** Condiciones ya redactadas («Entidad: = MEF»). */
  condiciones: string[];
  /** Niveles con su etiqueta, en orden; vacío sin agrupado ni agregado. */
  niveles: string[];
  tipoResultado: 'agrupado' | 'agregado';
}

export interface FavoritoNuevo {
  description: string;
  isDefault: boolean;
}

const plural = (n: number, singular: string, pluralTexto: string): string => `${n} ${n === 1 ? singular : pluralTexto}`;

/**
 * Panel lateral «Favoritos» (Figma nodos 5326:72389, 5651:70562, 5735:132055 y 4152:41872): guarda la configuración de
 * un reporte (parámetros aplicados, condiciones y agrupado o agregado) con una descripción, para reaplicarla después.
 * Sin favoritos muestra el aviso y «Agregar favorito»; con favoritos, el listado (la estrella rellena marca el
 * predeterminado); «Agregar favorito» abre el formulario con la descripción, «Favorito predeterminado» y dos resúmenes
 * plegables, «Parámetros» y «Filtros», con lo que se guardará.
 *
 * No guarda nada: emite `added`, `applied`, `removed` y `defaultToggled`, y el padre persiste.
 *
 * @figma 5326:72389 Favoritos (sin favoritos)
 * @figma 5651:70562 Agregar favorito
 * @figma 5735:132055 Agregar favorito (resumen desplegado)
 * @figma 4152:41872 Favoritos (listado)
 * @usar
 * - Desde «Favoritos» de `siaf-query-report-page`, que le pasa los favoritos del reporte y la consulta vigente.
 * @evitar
 * - Para guardar datos de un formulario de solicitud: esto solo guarda criterios de consulta.
 * - Para elegir entre opciones fijas de un filtro: usar `siaf-filter-pill`.
 * @teclado
 * - **Tab**: recorre la X, cada favorito (estrella, nombre y papelera) y «Agregar favorito»; en el formulario, la
 *   descripción, la casilla, cada resumen, «Cancelar» y «Guardar».
 * - **Enter / Espacio**: en el nombre de un favorito lo aplica a la consulta y cierra el panel; en la estrella lo marca o desmarca como predeterminado.
 * - **Escape**: cierra el panel.
 * @accesibilidad
 * - **4.1.2 Nombre, función y valor (A)**: la estrella es un `button` con `aria-pressed` y nombre «Favorito
 *   predeterminado: …»; la papelera se llama «Eliminar favorito …».
 * - **1.4.1 Uso del color (A)**: el predeterminado se distingue por la estrella rellena y `aria-pressed`, además del color.
 * - **2.5.8 Tamaño del objetivo (AA)**: estrella y papelera miden 40 px.
 */
@Component({
  selector: 'siaf-favorites-panel',
  standalone: true,
  imports: [ButtonComponent, ExpansionPanelComponent, IconComponent, SideNavComponent, TextFieldComponent, TooltipDirective],
  template: `
    <siaf-side-nav
      [open]="open"
      [title]="nuevo() ? 'Agregar favorito' : 'Favoritos'"
      [showFooter]="nuevo()"
      confirmLabel="Guardar"
      [confirmDisabled]="!descripcion().trim()"
      (closed)="closed.emit()"
      (confirmed)="guardar()"
    >
      @if (nuevo()) {
        <div class="flex flex-col gap-siaf-md" data-favorito-formulario>
          <siaf-input label="Descripción" [value]="descripcion()" (valueChange)="descripcion.set('' + $event)" />

          <!-- Nativo, no siaf-checkbox: no tiene consumidores en la app ni estilo propio. -->
          <label class="flex items-start gap-siaf-sm px-siaf-xs text-sm text-[var(--sys-color-text-neutral-high)]">
            <input
              class="mt-0.5 size-4 shrink-0"
              type="checkbox"
              [checked]="predeterminado()"
              (change)="predeterminado.set($any($event.target).checked)"
            />
            <span>
              <span class="block font-medium">Favorito predeterminado</span>
              <span class="block text-[var(--sys-color-text-neutral-low)]">Se aplicará automáticamente la próxima vez que ingreses a este reporte.</span>
            </span>
          </label>

          <siaf-expansion-panel title="Parámetros" [subtitle]="plural(actual.parametros.length, 'campo', 'campos')">
            <ul class="m-0 flex list-none flex-col gap-siaf-md p-0">
              @for (parametro of actual.parametros; track parametro.label) {
                <li class="flex items-start gap-siaf-md">
                  <siaf-icon [name]="parametro.icon" [size]="24" class="shrink-0" />
                  <div class="flex min-w-0 flex-col">
                    <span class="text-sm text-[var(--sys-color-text-neutral-high)]">{{ parametro.label }}</span>
                    <span class="text-xs text-[var(--sys-color-text-neutral-medium)]">{{ parametro.value }}</span>
                  </div>
                </li>
              }
            </ul>
          </siaf-expansion-panel>

          <siaf-expansion-panel title="Filtros" [subtitle]="resumenFiltros()">
            <ul class="m-0 flex list-none flex-col gap-siaf-md p-0">
              @if (actual.condiciones.length) {
                <li class="flex items-start gap-siaf-md">
                  <siaf-icon name="filter_list" [size]="24" class="shrink-0" />
                  <div class="flex min-w-0 flex-col">
                    <span class="text-xs text-[var(--sys-color-text-neutral-high)]">Condiciones:</span>
                    <span class="text-xs text-[var(--sys-color-text-neutral-medium)]">{{ actual.condiciones.join('. ') }}.</span>
                  </div>
                </li>
              }
              @if (actual.niveles.length) {
                <li class="flex items-start gap-siaf-md">
                  <siaf-icon name="layers" [size]="24" class="shrink-0" />
                  <div class="flex min-w-0 flex-col">
                    <span class="text-xs text-[var(--sys-color-text-neutral-high)]">{{ actual.tipoResultado === 'agrupado' ? 'Agrupados:' : 'Agregados:' }}</span>
                    <span class="text-xs text-[var(--sys-color-text-neutral-medium)]">{{ actual.niveles.join(' ▶ ') }}</span>
                  </div>
                </li>
              }
              @if (!actual.condiciones.length && !actual.niveles.length) {
                <li class="text-xs text-[var(--sys-color-text-neutral-medium)]">Sin condiciones ni agrupados.</li>
              }
            </ul>
          </siaf-expansion-panel>
        </div>
      } @else {
        <div class="flex flex-col gap-siaf-md" data-favoritos-lista>
          @if (!favorites.length) {
            <p class="m-0 rounded-siaf-md bg-[var(--sys-color-bg-surfaces-surface-low)] p-siaf-md text-xs text-[var(--sys-color-text-neutral-high)]" data-favoritos-vacio>
              Aún no tienes favoritos. Guarda tu configuración de parámetros, filtros y columnas visibles para reutilizarla después.
            </p>
          } @else {
            <ul class="m-0 flex list-none flex-col gap-siaf-xs p-0">
              @for (favorito of favorites; track favorito.id) {
                <li
                  class="relative flex items-center gap-siaf-xs rounded-siaf-sm border pr-siaf-xs"
                  [class.border-[var(--sys-color-border-states-active)]]="favorito.id === selectedId"
                  [class.bg-[var(--sys-color-bg-states-light-selected)]]="favorito.id === selectedId"
                  [class.border-[var(--sys-color-divider-strong)]]="favorito.id !== selectedId"
                >
                  <button
                    class="inline-flex size-10 shrink-0 items-center justify-center rounded-siaf-md focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                    [class.text-[var(--sys-color-text-brand-primary)]]="favorito.isDefault"
                    type="button"
                    [siafTooltip]="favorito.isDefault ? 'Quitar predeterminado' : 'Aplicar predeterminado'"
                    [attr.aria-pressed]="favorito.isDefault"
                    [attr.aria-label]="'Favorito predeterminado: ' + favorito.description"
                    (click)="defaultToggled.emit(favorito.id)"
                  >
                    <siaf-icon [name]="favorito.isDefault ? 'star' : 'star_border'" [size]="24" />
                  </button>
                  <button
                    class="flex min-h-[58px] min-w-0 flex-1 flex-col justify-center rounded-siaf-sm py-siaf-xs text-left focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                    type="button"
                    [attr.aria-current]="favorito.id === selectedId ? 'true' : null"
                    [attr.aria-describedby]="favorito.detalle ? 'favorito-detalle-' + favorito.id : null"
                    (focus)="resaltado.set(favorito.id)"
                    (blur)="resaltado.set(null)"
                    (click)="applied.emit(favorito.id)"
                  >
                    <span class="truncate text-sm font-bold text-[var(--sys-color-text-neutral-high)]">{{ favorito.description }}</span>
                    <span
                      class="truncate text-xs text-[var(--sys-color-text-neutral-medium)]"
                      (mouseenter)="resaltado.set(favorito.id)"
                      (mouseleave)="resaltado.set(null)"
                      >{{ favorito.summary }}</span
                    >
                  </button>
                  <button
                    class="inline-flex size-10 shrink-0 items-center justify-center rounded-siaf-md text-[var(--sys-color-text-neutral-high)] hover:bg-surface-muted focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                    type="button"
                    siafTooltip="Borrar"
                    [attr.aria-label]="'Eliminar favorito ' + favorito.description"
                    (click)="removed.emit(favorito.id)"
                  >
                    <siaf-icon name="delete" [size]="24" />
                  </button>

                  <!-- Tarjeta con lo guardado (mismo fondo y sombra que siaf-popover): sale al pasar el puntero por el texto del resumen («2 parámetros…») o al enfocar el favorito con el teclado. -->
                  @if (favorito.detalle; as detalle) {
                    <div
                      class="pointer-events-none absolute left-siaf-lg right-0 top-full z-20 mt-1 flex flex-col gap-siaf-sm rounded-siaf-sm bg-[var(--sys-color-bg-surfaces-surface-highest)] p-siaf-md text-left text-sm leading-normal text-[var(--sys-color-text-neutral-high)] shadow-siaf-elevation-6"
                      [class.hidden]="resaltado() !== favorito.id"
                      [id]="'favorito-detalle-' + favorito.id"
                      role="tooltip"
                      data-favorito-detalle
                    >
                      <p class="m-0"><strong class="block">Parámetros:</strong>{{ detalle.parametros }}.</p>
                      @if (detalle.condiciones) {
                        <p class="m-0"><strong class="block">Condiciones:</strong>{{ detalle.condiciones }}</p>
                      }
                      @if (detalle.niveles) {
                        <p class="m-0"><strong class="block">{{ detalle.tipoResultado === 'agrupado' ? 'Agrupados:' : 'Agregados:' }}</strong>{{ detalle.niveles }}</p>
                      }
                    </div>
                  }
                </li>
              }
            </ul>
          }

          <div>
            <siaf-button variant="outline" icon="add" [disabled]="!hayConsulta" (click)="abrirNuevo()">Agregar favorito</siaf-button>
          </div>
        </div>
      }
    </siaf-side-nav>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoritesPanelComponent implements OnChanges {
  @Input() open = false;
  @Input() favorites: readonly FavoritoResumen[] = [];
  /** Favorito aplicado a la consulta: su fila se ve seleccionada. La estrella no selecciona, solo marca el predeterminado. */
  @Input() selectedId: string | null = null;
  /** Sin consulta aplicada no hay nada que guardar: «Agregar favorito» queda deshabilitado. */
  @Input() hayConsulta = false;
  @Input() actual: FavoritoActual = { parametros: [], condiciones: [], niveles: [], tipoResultado: 'agrupado' };

  @Output() closed = new EventEmitter<void>();
  @Output() added = new EventEmitter<FavoritoNuevo>();
  @Output() applied = new EventEmitter<string>();
  @Output() removed = new EventEmitter<string>();
  @Output() defaultToggled = new EventEmitter<string>();

  /** Favorito cuyo resumen está bajo el puntero (o que tiene el foco): muestra su tarjeta. */
  readonly resaltado = signal<string | null>(null);
  readonly nuevo = signal(false);
  readonly descripcion = signal('');
  readonly predeterminado = signal(false);

  readonly plural = plural;

  ngOnChanges(changes: SimpleChanges): void {
    if ('open' in changes && this.open) {
      this.nuevo.set(false);
      this.descripcion.set('');
      this.predeterminado.set(false);
    }
  }

  resumenFiltros(): string {
    const { condiciones, niveles, tipoResultado } = this.actual;
    const partes = [
      condiciones.length ? plural(condiciones.length, 'condición', 'condiciones') : '',
      niveles.length ? plural(niveles.length, tipoResultado === 'agrupado' ? 'agrupado' : 'agregado', tipoResultado === 'agrupado' ? 'agrupados' : 'agregados') : '',
    ].filter(Boolean);
    return partes.length ? partes.join(', ') : 'Sin filtros';
  }

  abrirNuevo(): void {
    this.nuevo.set(true);
  }

  guardar(): void {
    this.added.emit({ description: this.descripcion().trim(), isDefault: this.predeterminado() });
  }
}
