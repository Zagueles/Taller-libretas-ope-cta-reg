import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, signal } from '@angular/core';

import { ButtonComponent } from '../../ui/button/button.component';
import { FocoDirective } from '../../ui/foco/foco.directive';
import { IconComponent } from '../../ui/icon/icon.component';
import { SidePanelAnimacion } from '../../ui/side-panel-animacion';

/** Un grupo del panel: sus columnas, o una sola columna suelta (sin flecha). */
export interface ColumnasPanelGrupo {
  id: string;
  label: string;
  /** Una columna sin grupo de cabecera: se muestra como fila de primer nivel, sin desplegable. */
  suelta: boolean;
  columnas: { key: string; label: string }[];
}

let siguienteId = 0;

/**
 * Panel lateral «Columnas visibles» de Consultas y reportes (Figma nodos 4397:61240 y 4397:61284): las columnas de la
 * tabla en árbol, por grupo de cabecera, con casillas de tres estados (grupo completo, parcial o vacío), «Seleccionar
 * todas» y las flechas que pliegan cada grupo (por defecto abiertos). «Restablecer» vuelve a las columnas visibles de
 * fábrica y «Aplicar» emite `applied` con las claves elegidas. Si se ocultan todas, quedan las columnas base
 * (`baseKeys`: Acreditación, Beneficiario, Cuenta de registro e Importe en moneda de la cuenta), que van siempre
 * marcadas y con la casilla deshabilitada.
 *
 * Trabaja sobre un borrador: cerrar sin aplicar no cambia nada.
 *
 * @figma 4397:61240 Columnas visibles (expandidas)
 * @figma 4397:61284 Columnas visibles (colapsadas)
 * @usar
 * - Desde el botón «Columnas» (`view_column`) del buscador de `siaf-query-report-page`, que le pasa los grupos, lo
 *   elegido, lo de fábrica y las columnas base.
 * @evitar
 * - Para las columnas de Documentos y registros: usar `siaf-column-visibility-panel`.
 * @teclado
 * - **Tab**: recorre «Seleccionar todas», la flecha y la casilla de cada grupo, cada columna, «Restablecer» y «Aplicar».
 * - **Espacio**: marca o desmarca la casilla; **Enter / Espacio** en una flecha pliega o despliega el grupo.
 * - **Escape**: cierra sin aplicar.
 * @accesibilidad
 * - **4.1.2 Nombre, función y valor (A)**: `role="dialog"` con `aria-modal` y `aria-labelledby`; las flechas llevan
 *   `aria-expanded` y su nombre, y las casillas de grupo usan el estado mixto (`indeterminate`).
 * - **2.4.3 Orden del foco (A)**: con `siafFoco` el foco entra al abrir y vuelve al control que lo abrió.
 * - **2.5.8 Tamaño del objetivo (AA)**: cada fila mide al menos 48 px de alto.
 */
@Component({
  selector: 'siaf-report-columns-panel',
  standalone: true,
  imports: [ButtonComponent, FocoDirective, IconComponent],
  template: `
    @if (anim.visible()) {
      <section
        class="siaf-sidepanel-overlay fixed inset-y-0 left-0 right-0 z-50 bg-black/55 pl-0 lg:pl-[65px]"
        [class.cerrando]="anim.cerrando()"
        aria-modal="true"
        role="dialog"
        [attr.aria-labelledby]="idTitulo"
        (click)="closed.emit()"
      >
        <aside
          class="absolute bottom-0 right-0 top-0 flex w-full max-w-[420px] flex-col overflow-hidden border-l border-[var(--sys-color-divider-default)] bg-surface shadow-siaf-elevation-8"
          [siafFoco]="open"
          (siafFocoEscape)="closed.emit()"
          (click)="$event.stopPropagation()"
        >
          <header class="flex h-14 shrink-0 items-center gap-siaf-xs px-siaf-md">
            <h2 class="m-0 flex-1 text-base font-bold uppercase leading-normal tracking-[0.02px] text-text" [id]="idTitulo">Columnas visibles</h2>
            <button
              class="inline-flex size-10 items-center justify-center rounded-siaf-md text-text transition hover:bg-surface-muted focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
              type="button"
              aria-label="Cerrar Columnas visibles"
              (click)="closed.emit()"
            >
              <siaf-icon name="close" [size]="24" />
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto px-siaf-md pb-siaf-md pt-siaf-sm" data-columnas-arbol>
            <label class="flex min-h-12 cursor-pointer items-center gap-siaf-sm pl-1 text-sm text-[var(--sys-color-text-neutral-medium)]">
              <input class="size-4 accent-[var(--sys-color-icon-states-enabled)]" type="checkbox" data-todas [checked]="todasMarcadas()" [indeterminate]="algunasMarcadas()" (change)="alternarTodas()" />
              Seleccionar todas
            </label>

            @for (grupo of grupos; track grupo.id) {
              <div class="flex min-h-12 items-center gap-siaf-xs">
                @if (grupo.suelta) {
                  <span class="size-6 shrink-0"></span>
                } @else {
                  <button
                    class="inline-flex size-6 shrink-0 items-center justify-center rounded-siaf-sm text-[var(--sys-color-text-neutral-medium)] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                    type="button"
                    [attr.aria-expanded]="!plegados().has(grupo.id)"
                    [attr.aria-label]="(plegados().has(grupo.id) ? 'Desplegar ' : 'Plegar ') + grupo.label"
                    (click)="plegar(grupo.id)"
                  >
                    <siaf-icon [name]="plegados().has(grupo.id) ? 'arrow_right' : 'arrow_drop_down'" [size]="24" />
                  </button>
                }
                <label class="flex min-h-12 flex-1 items-center gap-siaf-md text-xs font-bold uppercase text-[var(--sys-color-text-neutral-high)]" [class.cursor-pointer]="!bloqueado(grupo)">
                  <input
                    class="size-4 accent-[var(--sys-color-icon-states-enabled)] disabled:cursor-not-allowed"
                    type="checkbox"
                    [attr.data-grupo]="grupo.id"
                    [checked]="estadoGrupo(grupo) === 'todas'"
                    [disabled]="bloqueado(grupo)"
                    [indeterminate]="estadoGrupo(grupo) === 'algunas'"
                    (change)="alternarGrupo(grupo)"
                  />
                  {{ grupo.label }}
                </label>
              </div>

              @if (!grupo.suelta && !plegados().has(grupo.id)) {
                @for (columna of grupo.columnas; track columna.key) {
                  <label class="flex min-h-12 cursor-pointer items-center gap-siaf-md pl-[64px] text-sm text-[var(--sys-color-text-neutral-medium)]">
                    <input class="size-4 accent-[var(--sys-color-icon-states-enabled)] disabled:cursor-not-allowed" type="checkbox" [attr.data-columna]="columna.key" [checked]="borrador().has(columna.key)" [disabled]="baseKeys.has(columna.key)" (change)="alternarColumna(columna.key)" />
                    {{ columna.label }}
                  </label>
                }
              }
            }
          </div>

          <footer class="flex shrink-0 items-center justify-end gap-siaf-xs px-siaf-md py-siaf-sm">
            <siaf-button variant="outline" (click)="restablecer()">Restablecer</siaf-button>
            <siaf-button variant="filled" (click)="aplicar()">Aplicar</siaf-button>
          </footer>
        </aside>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportColumnsPanelComponent implements OnChanges {
  @Input() open = false;
  @Input() grupos: readonly ColumnasPanelGrupo[] = [];
  /** Claves de las columnas visibles ahora; el borrador parte de ellas al abrir. */
  @Input() selected: ReadonlySet<string> = new Set();
  /** Columnas visibles de fábrica, a las que vuelve «Restablecer». */
  @Input() defaults: ReadonlySet<string> = new Set();
  /** Columnas que quedan si se ocultan todas. */
  @Input() baseKeys: ReadonlySet<string> = new Set();

  @Output() closed = new EventEmitter<void>();
  @Output() applied = new EventEmitter<Set<string>>();

  readonly anim = new SidePanelAnimacion();
  readonly idTitulo = `siaf-columnas-visibles-${++siguienteId}`;

  readonly borrador = signal<ReadonlySet<string>>(new Set());
  readonly plegados = signal<ReadonlySet<string>>(new Set());

  private readonly todas = computed(() => this.grupos.flatMap((g) => g.columnas.map((c) => c.key)));
  readonly todasMarcadas = computed(() => this.todas().length > 0 && this.todas().every((k) => this.borrador().has(k)));
  readonly algunasMarcadas = computed(() => this.todas().some((k) => this.borrador().has(k)) && !this.todasMarcadas());

  ngOnChanges(changes: SimpleChanges): void {
    if ('open' in changes) {
      if (this.open) {
        this.borrador.set(new Set([...this.selected, ...this.baseKeys]));
        this.plegados.set(new Set());
      }
      this.anim.actualizar(this.open);
    }
  }

  /** Un grupo formado solo por columnas base no se puede desmarcar. */
  bloqueado(grupo: ColumnasPanelGrupo): boolean {
    return grupo.columnas.length > 0 && grupo.columnas.every((c) => this.baseKeys.has(c.key));
  }

  estadoGrupo(grupo: ColumnasPanelGrupo): 'todas' | 'algunas' | 'ninguna' {
    const marcadas = grupo.columnas.filter((c) => this.borrador().has(c.key)).length;
    if (marcadas === 0) return 'ninguna';
    return marcadas === grupo.columnas.length ? 'todas' : 'algunas';
  }

  plegar(id: string): void {
    this.plegados.update((actual) => {
      const nuevo = new Set(actual);
      if (!nuevo.delete(id)) nuevo.add(id);
      return nuevo;
    });
  }

  alternarColumna(clave: string): void {
    if (this.baseKeys.has(clave)) return;
    this.borrador.update((actual) => {
      const nuevo = new Set(actual);
      if (!nuevo.delete(clave)) nuevo.add(clave);
      return nuevo;
    });
  }

  alternarGrupo(grupo: ColumnasPanelGrupo): void {
    const completo = this.estadoGrupo(grupo) === 'todas';
    this.borrador.update((actual) => {
      const nuevo = new Set(actual);
      for (const c of grupo.columnas) {
        if (completo) {
          if (!this.baseKeys.has(c.key)) nuevo.delete(c.key);
        } else nuevo.add(c.key);
      }
      return nuevo;
    });
  }

  /** Marcar todas las selecciona; desmarcarlas deja solo las columnas base. */
  alternarTodas(): void {
    this.borrador.set(this.todasMarcadas() ? new Set(this.baseKeys) : new Set(this.todas()));
  }

  restablecer(): void {
    this.borrador.set(new Set([...this.defaults, ...this.baseKeys]));
  }

  aplicar(): void {
    this.applied.emit(this.borrador().size ? new Set(this.borrador()) : new Set(this.baseKeys));
  }
}
