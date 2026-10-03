import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { TooltipDirective } from '../tooltip/tooltip.directive';
import type { QueryReportGroupAggregation } from '../../types/query-report.types';
import type { ReportTableColumn, ReportTableRow } from '../report-table/report-table.component';

/** Un nivel de agrupación: el campo, cómo se llama en el encabezado y su línea secundaria opcional. */
export interface GroupedTableLevel {
  key: string;
  label: string;
  labelPrefix?: string;
  subtitleColumn?: string;
}

type Nodo =
  | { tipo: 'grupo'; id: string; nivel: number; etiqueta: string; subtitulo?: string; cantidad: number; totales: Record<string, string> }
  | { tipo: 'detalle'; id: string; nivel: number; fila: ReportTableRow }
  | { tipo: 'pie'; id: string; nivel: number; etiqueta: string; totales: Record<string, string> };

/** Celda de la primera fila de la cabecera: un grupo que abarca varias columnas o una columna sin grupo (igual que `siaf-report-table`). */
interface CeldaCabecera {
  label: string;
  colspan: number;
  rowspan: 1 | 2;
  align: 'left' | 'right' | 'center';
  width: number | null;
  fixed: boolean;
  /** Nombre completo de la abreviatura (Sec. → Secuencia), en un globo al pasar el puntero. */
  tooltip?: string | null;
}

/** aaaa-mm-dd, dd/mm/aaaa o un monto con miles: se queda solo con dígitos, signo y punto decimal. */
const aNumero = (valor: string | undefined): number => {
  if (!valor) return 0;
  const limpio = valor.replace(/[^\d.-]/g, '');
  const numero = parseFloat(limpio);
  return Number.isFinite(numero) ? numero : 0;
};

const formatoMonto = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let siguienteId = 0;

/**
 * Tabla de «Resultado de reporte» en modalidad Agrupado o Agregado (Figma nodos 5960:44051 y 5960:46696): en vez de
 * una fila por registro, uno o más `levels` anidan los registros en grupos colapsables con su cantidad y, en el
 * último nivel, el saldo inicial/final del grupo junto a su etiqueta; cerrando cada grupo (salvo el más interno) va
 * «Subtotal» y, al cerrar el más externo, «TOTAL» — ambos siempre visibles, sin depender de si el grupo está
 * expandido. Las columnas de los `levels` no se repiten en la tabla (ya están en la etiqueta del grupo), pero el resto
 * conserva sus grupos de cabecera (Acreditación, Beneficiario…) con la misma columna fija a la derecha (con sombra al
 * desplazar) que `siaf-report-table`.
 *
 * No pagina ni ordena: recibe todas las filas que agrupar (ya filtradas y con las condiciones aplicadas).
 *
 * @figma 5960:44051 Resultado agrupado
 * @figma 5960:46696 Resultado agregado (bajo la entidad elegida en `siaf-query-report-page`)
 * @usar
 * - Desde `siaf-query-report-page` cuando «Filtros avanzados» aplica uno o más niveles; con «Agregado» el primer nivel
 *   se saca a un panel de entidades aparte y esta tabla recibe los niveles restantes.
 * @evitar
 * - Sin niveles: la tabla detallada de siempre, `siaf-report-table`.
 * @teclado
 * - **Tab**: entra en la zona desplazable de la tabla y recorre el botón de cada grupo visible y, en las filas de
 *   detalle, cada enlace.
 * - **Enter / Espacio**: en el botón de un grupo, lo pliega o despliega.
 * @accesibilidad
 * - **1.3.1 Información y relaciones (A)**: cada grupo es un `role="row"` con `aria-expanded`, dentro de una tabla con
 *   `role="table"`, así el lector anuncia el nivel y si está abierto.
 * - **4.1.2 Nombre, función y valor (A)**: el botón de cada grupo se llama con su etiqueta y su cantidad de registros.
 */
@Component({
  selector: 'siaf-grouped-report-table',
  standalone: true,
  imports: [IconComponent, TooltipDirective],
  host: { class: 'block min-w-0' },
  template: `
    <div
      class="siaf-table-scroll rounded-siaf-sm outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
      role="region"
      tabindex="0"
      [attr.aria-label]="ariaLabel"
    >
      <table class="w-full min-w-full border-collapse text-left text-sm" [attr.aria-label]="ariaLabel">
        <thead>
          <tr>
            @for (celda of filaSuperior; track $index; let ultimo = $last) {
              <th
                class="h-10 px-siaf-md py-siaf-sm text-xs font-bold uppercase leading-normal text-[var(--sys-color-text-neutral-high)]"
                [class.text-center]="celda.align === 'center'"
                [class.text-right]="celda.align === 'right'"
                [class.border-r]="!ultimo && !celda.fixed"
                [class.border-[var(--sys-color-divider-strong)]]="!ultimo && !celda.fixed"
                [class]="celda.fixed ? claseFijaCabecera : ''"
                [attr.colspan]="celda.colspan > 1 ? celda.colspan : null"
                [attr.rowspan]="celda.rowspan > 1 ? celda.rowspan : null"
                [attr.scope]="celda.rowspan === 2 ? 'col' : 'colgroup'"
                [style.width.px]="celda.width"
                [style.min-width.px]="celda.width"
              >
                <span class="block truncate" [siafTooltip]="celda.tooltip ?? null">{{ celda.label }}</span>
              </th>
            }
          </tr>
          @if (hayGrupos) {
            <tr>
              @for (columna of columnasAgrupadas; track columna.key; let i = $index) {
                <th
                  class="h-10 px-siaf-md py-siaf-sm text-xs font-bold uppercase leading-normal text-[var(--sys-color-text-neutral-high)]"
                  [class.text-right]="columna.align === 'right'"
                  [class.border-r]="finDeGrupo(i) && !columna.fixed"
                  [class.border-[var(--sys-color-divider-strong)]]="finDeGrupo(i) && !columna.fixed"
                  [class]="columna.fixed ? claseFijaCabecera : ''"
                  scope="col"
                  [style.width.px]="columna.width ?? null"
                  [style.min-width.px]="columna.width ?? null"
                >
                  <span class="block truncate" [siafTooltip]="tooltipColumna(columna)">{{ columna.label }}</span>
                </th>
              }
            </tr>
          }
        </thead>
        <tbody>
          @for (nodo of nodos; track nodo.id) {
            @switch (nodo.tipo) {
              @case ('grupo') {
                <tr class="border-b border-[var(--sys-color-divider-default)] bg-surface">
                  <td [attr.colspan]="indiceInicio > -1 ? Math.max(indiceInicio, 1) : columnasVisibles.length" class="p-0">
                    <button
                      class="flex w-full items-center gap-siaf-sm px-siaf-md py-siaf-sm text-left text-sm font-bold text-[var(--sys-color-text-neutral-high)] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                      type="button"
                      [style.paddingLeft.px]="16 + nodo.nivel * 20"
                      [attr.aria-expanded]="!colapsados.has(nodo.id)"
                      (click)="alternar(nodo.id)"
                    >
                      <siaf-icon [name]="colapsados.has(nodo.id) ? 'chevron_right' : 'expand_more'" [size]="20" class="shrink-0" />
                      <span class="min-w-0 flex-1 truncate">
                        {{ nodo.etiqueta }} <span class="font-normal text-[var(--sys-color-text-neutral-medium)]">({{ nodo.cantidad }} Registros)</span>
                        @if (nodo.subtitulo) {
                          <br /><span class="text-xs font-normal text-[var(--sys-color-text-neutral-medium)]">{{ nodo.subtitulo }}</span>
                        }
                      </span>
                    </button>
                  </td>
                  @if (indiceInicio > -1) {
                    <td class="px-siaf-md py-siaf-sm text-right font-bold tabular-nums text-[var(--sys-color-text-neutral-high)]">{{ nodo.totales['inicio'] }}</td>
                    @if (indiceFin - indiceInicio > 1) {
                      <td [attr.colspan]="indiceFin - indiceInicio - 1"></td>
                    }
                    <td [class]="indiceFin === indiceFija ? claseFija + ' bg-surface' : ''" class="px-siaf-md py-siaf-sm text-right font-bold tabular-nums text-[var(--sys-color-text-neutral-high)]">
                      {{ nodo.totales['fin'] }}
                    </td>
                    @if (indiceFin < columnasVisibles.length - 1) {
                      <td [attr.colspan]="columnasVisibles.length - indiceFin - 1"></td>
                    }
                  }
                </tr>
              }
              @case ('detalle') {
                <tr class="border-b border-[var(--sys-color-divider-default)] bg-surface">
                  @for (columna of columnasVisibles; track columna.key; let primero = $first) {
                    <td
                      class="h-12 px-siaf-md py-siaf-sm align-middle text-sm leading-normal tracking-[0.0249px] text-[var(--sys-color-text-neutral-medium)]"
                      [class.text-right]="columna.align === 'right'"
                      [class.whitespace-nowrap]="columna.align === 'right'"
                      [class]="columna.fixed ? claseFija + ' z-[1] bg-surface' : ''"
                      [style.paddingLeft.px]="primero ? 16 + (nodo.nivel + 1) * 20 : null"
                    >
                      @if (columna.kind === 'link' && nodo.fila[columna.key]) {
                        <button
                          class="rounded-siaf-sm text-left font-medium text-[var(--sys-color-text-brand-primary)] underline-offset-2 hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                          type="button"
                          (click)="linkClicked.emit({ row: nodo.fila, column: columna })"
                        >
                          {{ nodo.fila[columna.key] }}
                        </button>
                      } @else {
                        {{ nodo.fila[columna.key] }}
                      }
                    </td>
                  }
                </tr>
              }
              @case ('pie') {
                <tr
                  class="border-b border-[var(--sys-color-divider-default)] font-bold text-[var(--sys-color-text-neutral-high)]"
                  [class.bg-[var(--sys-color-bg-surfaces-highlight)]]="nodo.nivel === 0"
                  [class.bg-[var(--sys-color-bg-surfaces-surface-low)]]="nodo.nivel !== 0"
                >
                  @if (indiceInicio > -1) {
                    <td [attr.colspan]="Math.max(indiceInicio, 1)" class="px-siaf-md py-siaf-sm" [style.paddingLeft.px]="16 + nodo.nivel * 20">{{ nodo.etiqueta }}</td>
                    <td class="px-siaf-md py-siaf-sm text-right tabular-nums">{{ nodo.totales['inicio'] }}</td>
                    @if (indiceFin - indiceInicio > 1) {
                      <td [attr.colspan]="indiceFin - indiceInicio - 1"></td>
                    }
                    <td [class]="indiceFin === indiceFija ? claseFija + (nodo.nivel === 0 ? ' bg-[var(--sys-color-bg-surfaces-highlight)]' : ' bg-[var(--sys-color-bg-surfaces-surface-low)]') : ''" class="px-siaf-md py-siaf-sm text-right tabular-nums">
                      {{ nodo.totales['fin'] }}
                    </td>
                    @if (indiceFin < columnasVisibles.length - 1) {
                      <td [attr.colspan]="columnasVisibles.length - indiceFin - 1"></td>
                    }
                  } @else {
                    <td [attr.colspan]="columnasVisibles.length" class="px-siaf-md py-siaf-sm" [style.paddingLeft.px]="16 + nodo.nivel * 20">{{ nodo.etiqueta }}</td>
                  }
                </tr>
              }
            }
          } @empty {
            <tr>
              <td class="px-siaf-md py-siaf-xl text-center text-sm text-[var(--sys-color-text-neutral-medium)]" [attr.colspan]="columnasVisibles.length || 1" role="status">
                {{ emptyMessage }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupedReportTableComponent implements OnChanges {
  /** Todas las columnas del reporte; las de los `levels` se ocultan porque ya están en la etiqueta del grupo. */
  @Input({ required: true }) columns: readonly ReportTableColumn[] = [];
  @Input() rows: readonly ReportTableRow[] = [];
  @Input() levels: readonly GroupedTableLevel[] = [];
  @Input() aggregation: QueryReportGroupAggregation | null = null;
  /** El nivel más interno también cierra con su pie (el primer nivel es el «TOTAL» y los demás, «Subtotal»): en «Agregado» siempre y en «Agrupado» con dos niveles; con tres o más, el más interno solo lleva su saldo en el título. */
  @Input() footerInnermost = false;
  @Input() ariaLabel = 'Resultado del reporte agrupado';
  @Input() emptyMessage = 'No se encontraron resultados con los filtros aplicados.';

  @Output() linkClicked = new EventEmitter<{ row: ReportTableRow; column: ReportTableColumn }>();

  protected readonly Math = Math;

  /** Igual que `siaf-report-table`: sticky con la sombra de elevación 6 recortada a su borde izquierdo. */
  readonly claseFija = 'sticky right-0 shadow-siaf-elevation-6 [clip-path:inset(0_0_0_-16px)]';
  readonly claseFijaCabecera =
    'sticky right-0 z-[3] border-b-0 shadow-[inset_0_-1px_0_var(--sys-color-divider-strong),var(--sys-shadow-elevation-6)] [clip-path:inset(0_0_0_-16px)]';

  columnasVisibles: ReportTableColumn[] = [];
  nodos: Nodo[] = [];
  /** Índice, dentro de `columnasVisibles`, de las columnas de `aggregation.runningBalance`; -1 si no hay `aggregation` o no aparecen (quedaron como nivel). */
  indiceInicio = -1;
  indiceFin = -1;
  /** Índice de la columna `fixed` (fija a la derecha al desplazar); -1 si ninguna columna visible lo es. */
  indiceFija = -1;
  readonly colapsados = new Set<string>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['columns'] || changes['levels'] || changes['aggregation']) {
      // Solo se ocultan las columnas que pasaron a ser nivel; el resto conserva su `group` (Acreditación, Beneficiario…).
      const claves = new Set(this.levels.map((l) => l.key));
      this.columnasVisibles = this.columns.filter((c) => !claves.has(c.key));
      const balance = this.aggregation?.runningBalance;
      this.indiceInicio = balance ? this.columnasVisibles.findIndex((c) => c.key === balance.startColumn) : -1;
      this.indiceFin = balance ? this.columnasVisibles.findIndex((c) => c.key === balance.endColumn) : -1;
      this.indiceFija = this.columnasVisibles.findIndex((c) => c.fixed);
    }
    this.reconstruir();
  }

  /** Igual que `siaf-report-table`: agrupa columnas contiguas del mismo `group` en una celda; las sueltas ocupan las dos filas. */
  /** Nombre completo de cada grupo de cabecera abreviado (`'Imp. m. cuenta'` → «Importe en moneda de la cuenta»). */
  @Input() groupTooltips: Record<string, string> = {};

  /** El nombre completo de una columna cuya etiqueta va abreviada (`panelLabel`), o nada si ya se lee completa. */
  tooltipColumna(c: ReportTableColumn): string | null {
    return c.panelLabel && c.panelLabel !== c.label ? c.panelLabel : null;
  }

  tooltipGrupo(grupo: string): string | null {
    const completo = this.groupTooltips[grupo];
    return completo && completo !== grupo ? completo : null;
  }

  get hayGrupos(): boolean {
    return this.columnasVisibles.some((c) => !!c.group);
  }

  get filaSuperior(): CeldaCabecera[] {
    if (!this.hayGrupos) {
      return this.columnasVisibles.map((c) => ({ label: c.label, colspan: 1, rowspan: 1, align: c.align ?? 'left', width: c.width ?? null, fixed: !!c.fixed, tooltip: this.tooltipColumna(c) }));
    }
    const celdas: CeldaCabecera[] = [];
    for (let i = 0; i < this.columnasVisibles.length; i++) {
      const columna = this.columnasVisibles[i];
      if (!columna.group) {
        celdas.push({ label: columna.label, colspan: 1, rowspan: 2, align: columna.align ?? 'left', width: columna.width ?? null, fixed: !!columna.fixed, tooltip: this.tooltipColumna(columna) });
        continue;
      }
      let fin = i;
      while (fin + 1 < this.columnasVisibles.length && this.columnasVisibles[fin + 1].group === columna.group) fin++;
      const grupo = this.columnasVisibles.slice(i, fin + 1);
      const anchos = grupo.map((c) => c.width);
      celdas.push({
        label: columna.group,
        colspan: grupo.length,
        rowspan: 1,
        align: 'center' as const,
        width: anchos.every((a) => typeof a === 'number') ? (anchos as number[]).reduce((s, a) => s + a, 0) : null,
        fixed: grupo.some((c) => c.fixed),
        tooltip: this.tooltipGrupo(columna.group),
      });
      i = fin;
    }
    return celdas;
  }

  get columnasAgrupadas(): ReportTableColumn[] {
    return this.columnasVisibles.filter((c) => !!c.group);
  }

  /** La columna en `indice` es la última de su grupo (o no hay otra después): ahí va el divisor, no entre subcolumnas de un mismo grupo. */
  finDeGrupo(indice: number): boolean {
    const columnas = this.columnasAgrupadas;
    return indice === columnas.length - 1 || columnas[indice].group !== columnas[indice + 1].group;
  }

  alternar(id: string): void {
    if (this.colapsados.has(id)) this.colapsados.delete(id);
    else this.colapsados.add(id);
    this.reconstruir();
  }

  private reconstruir(): void {
    this.nodos = this.construirNivel(this.rows, 0, '');
  }

  private construirNivel(filas: readonly ReportTableRow[], nivel: number, rutaPadre: string): Nodo[] {
    const nivelActual = this.levels[nivel];
    if (!nivelActual) {
      return filas.map((fila, i) => ({ tipo: 'detalle', id: `${rutaPadre}-d${i}`, nivel, fila }));
    }

    const esUltimoNivel = nivel === this.levels.length - 1;
    const grupos = new Map<string, ReportTableRow[]>();
    for (const fila of filas) {
      const valor = fila[nivelActual.key] ?? '';
      if (!grupos.has(valor)) grupos.set(valor, []);
      grupos.get(valor)!.push(fila);
    }

    const nodos: Nodo[] = [];
    for (const [valor, filasGrupo] of grupos) {
      const id = `${rutaPadre}/${nivelActual.key}=${valor}`;
      const prefijo = nivelActual.labelPrefix ?? nivelActual.label;
      const subtitulo = nivelActual.subtitleColumn ? filasGrupo[0]?.[nivelActual.subtitleColumn] : undefined;
      // Solo el nivel más interno muestra el saldo del grupo en su propio encabezado; los demás quedan en blanco
      // (la fila estructural de esta cabecera sigue existiendo, para no desalinear las columnas de saldo).
      const totalesEncabezado = esUltimoNivel ? this.totalizar(filasGrupo) : { inicio: '', fin: '' };

      nodos.push({ tipo: 'grupo', id, nivel, etiqueta: `${prefijo}: ${valor}`, subtitulo, cantidad: filasGrupo.length, totales: totalesEncabezado });

      if (!this.colapsados.has(id)) {
        nodos.push(...this.construirNivel(filasGrupo, nivel + 1, id));
      }

      // Subtotal/TOTAL siempre se muestran, aunque el grupo esté colapsado: no dependen de ver el detalle.
      if (!esUltimoNivel || this.footerInnermost) {
        const totales = this.totalizar(filasGrupo);
        const etiquetaPie = nivel === 0 ? `TOTAL ${prefijo}: ${valor}` : `Subtotal ${prefijo}: ${valor}`;
        nodos.push({ tipo: 'pie', id: `${id}-pie`, nivel, etiqueta: etiquetaPie, totales });
      }
    }
    return nodos;
  }

  /** `runningBalance`: primera fila como inicio y última como fin (un saldo que se arrastra, no se suma). */
  private totalizar(filas: readonly ReportTableRow[]): Record<string, string> {
    const balance = this.aggregation?.runningBalance;
    if (!balance || !filas.length) return { inicio: '', fin: '' };
    return {
      inicio: formatoMonto.format(aNumero(filas[0][balance.startColumn])),
      fin: formatoMonto.format(aNumero(filas[filas.length - 1][balance.endColumn])),
    };
  }
}
