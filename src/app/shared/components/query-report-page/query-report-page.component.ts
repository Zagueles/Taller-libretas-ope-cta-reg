import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

import type {
  QueryReportAdvancedFilters,
  QueryReportChartType,
  QueryReportCondition,
  QueryReportConfig,
  QueryReportExportFormat,
  QueryReportFavorite,
  QueryReportParameters,
  QueryReportResult,
  QueryReportRow,
} from '../../types/query-report.types';
import { BarChartComponent } from '../../ui/bar-chart/bar-chart.component';
import { ButtonComponent } from '../../ui/button/button.component';
import { ButtonGroupItem, ButtonsGroupComponent } from '../../ui/buttons-group/buttons-group.component';
import { ChartSectionComponent } from '../../ui/chart-section/chart-section.component';
import type { ChartSeries } from '../../ui/charts/grafico-base';
import { DivergingChartComponent } from '../../ui/diverging-chart/diverging-chart.component';
import { DonutChartComponent } from '../../ui/donut-chart/donut-chart.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { GroupedTableLevel, GroupedReportTableComponent } from '../../ui/grouped-report-table/grouped-report-table.component';
import { IconDropdownMenuComponent, IconDropdownMenuItem } from '../../ui/icon-dropdown-menu/icon-dropdown-menu.component';
import { KpiCardComponent } from '../../ui/kpi-card/kpi-card.component';
import { LineChartComponent } from '../../ui/line-chart/line-chart.component';
import { MessageBoxComponent } from '../../ui/message-box/message-box.component';
import { ReportSummaryCardComponent } from '../../ui/report-summary-card/report-summary-card.component';
import { ReportTableColumn, ReportTableComponent } from '../../ui/report-table/report-table.component';
import { TableSkeletonComponent } from '../../ui/table-skeleton/table-skeleton.component';
import { TabsComponent } from '../../ui/tabs/tabs.component';
import { TagComponent } from '../../ui/tag/tag.component';
import { AdvancedFiltersPanelComponent } from '../advanced-filters-panel/advanced-filters-panel.component';
import { ColumnasPanelGrupo, ReportColumnsPanelComponent } from '../report-columns-panel/report-columns-panel.component';
import { FavoritesPanelComponent, FavoritoActual, FavoritoNuevo, FavoritoResumen } from '../favorites-panel/favorites-panel.component';
import { FilterPillComponent } from '../filter-pill/filter-pill.component';
import { FormTableSearchComponent } from '../form-table-search/form-table-search.component';
import { PageHeaderComponent } from '../page-header/page-header.component';
import { PageShellComponent } from '../page-shell/page-shell.component';
import { PaginationComponent } from '../pagination/pagination.component';
import { ParametroAplicado, ParametrosAplicadosComponent } from '../parametros-aplicados/parametros-aplicados.component';
import { QueryParametersPanelComponent, tieneValor } from '../query-parameters-panel/query-parameters-panel.component';
import { GraficoCalculado, calcularGrafico, calcularKpis } from './query-report-charts';
import { cumpleCondicion } from './query-report-conditions';

const AVANZADOS_VACIO: QueryReportAdvancedFilters = { conditions: [], resultType: 'agrupado', levels: [] };

/** Símbolo de cada condición en su chip de «Parámetros aplicados» (Figma nodo 5960:42771: «Beneficiario: = MINCETUR...»). */
const OPERADOR_SIMBOLO: Record<QueryReportCondition['operator'], string> = {
  '=': '=',
  '!=': '≠',
  '>': '>',
  '>=': '≥',
  '<': '<',
  '<=': '≤',
  between: '↔',
  empty: 'Está vacío',
  notEmpty: 'No está vacío',
};

/** Lo que recibe la pantalla al elegir un formato en «Exportar»: los parámetros y las filas que quedaron tras buscar y filtrar. */
export interface QueryReportExportEvent {
  format: QueryReportExportFormat;
  parameters: QueryReportParameters;
  rows: QueryReportRow[];
}

export type QueryReportView = 'datos' | 'graficas';

/** Un gráfico listo para pintar: su serie, su nombre accesible y si ocupa las dos columnas. */
interface GraficoEnVista extends GraficoCalculado {
  /** `vacio` sin categorías que dibujar: los ejes vacíos parecerían valores en cero, así que va un aviso. */
  dibujo: QueryReportChartType | 'vacio';
  series: ChartSeries[];
  ariaLabel: string;
  /** Sin pareja (un `wide` sin `narrow` a su derecha, o al revés), ocupa toda la fila. */
  clase: string;
}

const FORMATOS_EXPORTACION: readonly QueryReportExportFormat[] = ['excel', 'csv', 'pdf'];

/** Sin mayúsculas ni tildes, para buscar «credito» y encontrar «Crédito». */
const normalizar = (texto: string): string => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** aaaa-mm-dd → dd/mm/aaaa, como lo muestra el selector de fecha. */
const fechaVisible = (valor: string): string => {
  const [anio, mes, dia] = valor.split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : valor;
};

let siguienteId = 0;

/**
 * Plantilla de pantalla «Consultas y reportes» (Guía de Estructura de Pantallas, nodo 9455:107865): la nueva versión de
 * las consultas, armada desde un `QueryReportConfig`. Antes de consultar muestra el estado vacío; «Parámetros» abre
 * `siaf-query-parameters-panel` y, al aplicar, emite `queried` para que la pantalla traiga el resultado. Con resultado
 * pinta «Parámetros aplicados», y en «Resultado de reporte» las pestañas, la card resumen, el buscador (Filtrar y
 * Columnas), los filtros predeterminados, la tabla de datos detallada y la paginación. Buscar, filtrar y paginar
 * ocurren sobre las filas recibidas.
 *
 * Con `charts` en la configuración, el encabezado del resultado suma el selector «Vista de datos | Vista de gráficas»
 * (nodo 22715:21316) y la vista de gráficas (nodo 22402:16766): tarjetas KPI y gráficos calculados con las mismas filas
 * que muestra la tabla, es decir, después de buscar y filtrar; un gráfico que se queda sin datos muestra un aviso en vez
 * de ejes vacíos. Esa vista se carga con `@defer` al abrirla, así Chart.js
 * no pesa en la pantalla hasta que alguien la usa. «Exportar» abre el menú Excel, CSV y PDF y emite `exported` con el
 * formato.
 *
 * No llama a la API: la pantalla consulta y entrega `result` (con `loading` mientras tanto).
 *
 * @figma 9455:107865 Query and Report
 * @figma 22715:21316 Content head
 * @figma 22402:16766 Query and report - Charts result - 01
 * @usar
 * - Para una pantalla «Consultas y reportes» de un proceso: título, migas, campos de parámetros, columnas (con grupos y
 *   la última fija), pestañas y filtros predeterminados en la configuración.
 * - `tabs` cuando el reporte tiene varias vistas del mismo resultado: la pantalla recibe `tabChanged` y entrega el
 *   resultado de esa pestaña. Con un solo tab (una sola cuenta bancaria elegida, por ejemplo) no se muestra la fila
 *   de pestañas: no aporta nada elegir entre una sola opción.
 * - `charts` para la vista de gráficas: cada KPI suma una columna (o cuenta filas), con un filtro opcional por valor, y
 *   cada gráfico agrupa por una columna (o por mes, con una fecha), en valores, índice respecto de la primera categoría
 *   (`index`) o variación respecto de ella (`change`). `width: 'narrow'` pone un gráfico en la columna de 336 px a la
 *   derecha del anterior, como en el Figma.
 * - `exported` para generar el archivo: trae el formato elegido y las filas que quedaron tras buscar y filtrar.
 * - `favorites` y `favoritesChange` para «Favoritos» (`siaf-favorites-panel`): la pantalla entrega los favoritos guardados
 *   y persiste la lista completa que recibe al agregar, quitar o cambiar el predeterminado, que se aplica solo al entrar.
 * - `advancedFiltersRequested` y `columnsRequested` para lo que la pantalla resuelve por su cuenta mientras la
 *   plantilla no traiga esos paneles.
 * @evitar
 * - Para la bandeja de documentos y registros de un proceso: usar `siaf-documents-records-page`.
 * - Para una vista de solo lectura que no es un reporte: usar `siaf-page-shell` con `siaf-page-header`.
 * - Maquetar otra consulta con estado vacío, panel de búsqueda y tabla a mano: pasar su configuración a esta
 *   plantilla.
 * - Calcular los KPI o los gráficos en la pantalla y pintarlos aparte: declararlos en `charts`, así siguen a la búsqueda
 *   y a los filtros de la tabla.
 * @teclado
 * - **Tab**: recorre las migas, «Favoritos» y «Parámetros», las tarjetas de parámetros aplicados, el selector de vista,
 *   «Exportar», las pestañas y, en la vista de datos, el buscador y sus botones, los filtros, la tabla y la paginación;
 *   en la de gráficas, cada gráfico.
 * - **Enter** en el buscador: busca en todas las columnas (sin distinguir mayúsculas ni tildes) y vuelve a la primera
 *   página.
 * - El panel de parámetros, el selector de vista, el menú «Exportar», las pestañas, las píldoras, la tabla y los
 *   gráficos siguen su componente.
 * @accesibilidad
 * - **1.3.1 Información y relaciones (A)**: el título de la pantalla es el `h1` de `siaf-page-header`; el de la tarjeta
 *   del resultado, un `h2`, y el de cada gráfico, el `h3` de `siaf-chart-section`.
 * - **4.1.2 Nombre, función y valor (A)**: el selector de vista es un grupo «Vista del resultado» con `aria-pressed` en
 *   cada botón, nombrado como su tooltip; «Exportar» anuncia su menú con `aria-haspopup` y `aria-expanded`.
 * - **4.1.3 Mensajes de estado (AA)**: el total de filas tras buscar o filtrar se anuncia en una región
 *   `aria-live="polite"` que no se ve.
 * - **2.4.3 Orden del foco (A)**: al cerrar el panel de parámetros el foco vuelve a «Parámetros».
 * - **3.2.2 Al introducir datos (A)**: escribir en el buscador no cambia la tabla hasta pulsar Enter; elegir un filtro
 *   predeterminado sí filtra al momento, y se anuncia.
 * - **1.1.1 Contenido no textual (A)**: cada gráfico se llama como su título y lleva su tabla de datos oculta; con una
 *   búsqueda o un filtro activos, una nota avisa con cuántas filas se calcularon.
 * - **1.4.10 Reajuste del contenido (AA)**: en pantallas angostas las acciones del encabezado bajan, las tarjetas KPI
 *   y los gráficos pasan a una columna y la tabla se desplaza dentro de su zona, sin desplazar la página.
 */
@Component({
  selector: 'siaf-query-report-page',
  standalone: true,
  imports: [
    AdvancedFiltersPanelComponent,
    BarChartComponent,
    ButtonComponent,
    ButtonsGroupComponent,
    ChartSectionComponent,
    DivergingChartComponent,
    DonutChartComponent,
    EmptyStateComponent,
    FavoritesPanelComponent,
    FilterPillComponent,
    FormTableSearchComponent,
    GroupedReportTableComponent,
    IconDropdownMenuComponent,
    KpiCardComponent,
    NgTemplateOutlet,
    LineChartComponent,
    MessageBoxComponent,
    PageHeaderComponent,
    PageShellComponent,
    PaginationComponent,
    ParametrosAplicadosComponent,
    QueryParametersPanelComponent,
    ReportColumnsPanelComponent,
    ReportSummaryCardComponent,
    ReportTableComponent,
    TableSkeletonComponent,
    TabsComponent,
    TagComponent,
  ],
  template: `
    <siaf-page-shell [breadcrumbs]="configuracion().breadcrumbs" [stickyHeader]="true">
      <siaf-page-header pageHeader [title]="configuracion().title" [subtitle]="favoritoAplicado() ? 'Favorito: ' + favoritoAplicado()!.description : ''">
        <div actions class="flex flex-wrap items-center justify-end gap-siaf-sm">
          <siaf-button variant="outline" icon="bookmark_border" [disabled]="!parametros() && !favoritos().length" (click)="abrirFavoritos()">Favoritos</siaf-button>
          <siaf-button variant="filled" icon="manage_search" (click)="abrirParametros(null)">Parámetros</siaf-button>
        </div>
      </siaf-page-header>

      @if (!parametros()) {
        <section class="flex min-h-[320px] flex-1 flex-col justify-center rounded-siaf-md bg-surface px-siaf-lg py-siaf-xl" data-consulta-vacia>
          <siaf-empty-state
            illustration="no-records"
            [title]="configuracion().emptyTitle ?? 'Aún no se encontraron resultados'"
            [description]="configuracion().emptyDescription ?? 'Ingrese los parámetros de consulta para visualizar la información disponible.'"
          />
        </section>
      } @else {
        <div class="flex flex-col gap-siaf-sm">
          <section data-parametros>
            <siaf-parametros-aplicados [parametros]="parametrosAplicados()" (selected)="abrirParametros($event)" />
          </section>

          @if (sinResultados()) {
            <section class="flex min-h-[320px] flex-1 flex-col justify-center rounded-siaf-md bg-surface px-siaf-lg py-siaf-xl" data-consulta-sin-resultados>
              <siaf-empty-state
                illustration="no-records"
                title="No se encontraron resultados"
                description="No pudimos hallar coincidencias con los parámetros de búsqueda ingresados"
              />
            </section>
          } @else {
          <section class="flex flex-col rounded-siaf-md bg-surface" [attr.aria-labelledby]="idTitulo" data-resultado>
            <!-- Figma «Content head» (22715:21316): título, selector de vista y «Exportar», con 16 px entre ellos. -->
            <header class="flex min-h-14 flex-wrap items-center gap-siaf-md px-siaf-lg pt-siaf-md">
              <h2 class="m-0 min-w-0 flex-1 text-base font-bold uppercase leading-normal tracking-[0.02px] text-[var(--sys-color-text-neutral-high)]" [id]="idTitulo">
                {{ configuracion().resultTitle ?? 'Resultado de reporte' }}
              </h2>
              <div class="flex flex-wrap items-center gap-siaf-md">
                @if (configuracion().charts) {
                  <siaf-buttons-group
                    [items]="opcionesVista"
                    [value]="vistaActiva()"
                    [iconOnly]="true"
                    ariaLabel="Vista del resultado"
                    (valueChange)="cambiarVista($event)"
                    data-selector-vista
                  />
                }
                <siaf-icon-dropdown-menu
                  label="Exportar"
                  icon="open_in_new"
                  density="standard"
                  [items]="opcionesExportacion()"
                  [menuWidth]="200"
                  [disabled]="loading || !filasFiltradas().length"
                  (selected)="exportar($event)"
                  data-exportar
                />
              </div>
            </header>

            <div class="flex flex-col gap-siaf-lg px-siaf-lg pb-siaf-md pt-siaf-md">
              @if ((configuracion().tabs?.length ?? 0) > 1) {
                <siaf-tabs
                  [tabs]="configuracion().tabs ?? []"
                  [activeId]="pestana()"
                  [border]="false"
                  [idBase]="idTitulo + '-pestanas'"
                  [ariaLabel]="configuracion().resultTitle ?? 'Resultado de reporte'"
                  (activeIdChange)="cambiarPestana($event)"
                />
              }

              @if (loading) {
                <siaf-table-skeleton [columns]="configuracion().columns.length" [rows]="6" ariaLabel="Cargando el resultado del reporte" />
              } @else if (vistaActiva() === 'graficas') {
                <!-- Los gráficos (y Chart.js) llegan en su propio chunk la primera vez que se abre la vista. -->
                @defer (on immediate) {
                  <div class="flex flex-col gap-siaf-lg" data-vista-graficas>
                    @if (!filasFiltradas().length) {
                      <siaf-empty-state
                        illustration="no-records"
                        title="No hay filas para graficar"
                        [description]="hayBusquedaOFiltros() ? 'La búsqueda o los filtros de la vista de datos no dejaron filas.' : 'La consulta no devolvió filas para estos parámetros.'"
                      />
                    } @else {
                      @if (hayBusquedaOFiltros()) {
                        <message-box [text]="notaGraficas()" data-nota-graficas />
                      }

                      @if (kpis().length) {
                        <div class="grid gap-siaf-lg sm:grid-cols-2" [class]="claseKpis()" data-kpis>
                          @for (kpi of kpis(); track $index) {
                            <siaf-kpi-card
                              [title]="kpi.title"
                              [amount]="kpi.amount"
                              [progress]="kpi.progress"
                              [progressLabel]="kpi.title + ' respecto del total'"
                              [tone]="kpi.tone"
                              [icon]="kpi.icon"
                            />
                          }
                        </div>
                      }

                      @if (graficos().length) {
                        <div class="grid gap-siaf-lg" [class]="claseGraficos()" data-graficos>
                          @for (grafico of graficos(); track $index) {
                            <siaf-chart-section class="min-w-0" [class]="grafico.clase" [title]="grafico.title" [description]="grafico.description" [attr.data-grafico]="grafico.type">
                              @switch (grafico.dibujo) {
                                @case ('vacio') {
                                  <message-box [text]="hayBusquedaOFiltros() ? 'No hay datos suficientes para este gráfico con la búsqueda o los filtros actuales.' : 'No hay datos suficientes para este gráfico en el resultado.'" data-grafico-vacio />
                                }
                                @case ('line') {
                                  <siaf-line-chart
                                    [categories]="grafico.categories"
                                    [series]="grafico.series"
                                    [valueSuffix]="grafico.valueSuffix"
                                    [ariaLabel]="grafico.ariaLabel"
                                    [categoryLabel]="grafico.categoryLabel"
                                  />
                                }
                                @case ('donut') {
                                  <siaf-donut-chart
                                    [categories]="grafico.categories"
                                    [values]="grafico.values"
                                    [valueSuffix]="grafico.valueSuffix"
                                    [ariaLabel]="grafico.ariaLabel"
                                    [categoryLabel]="grafico.categoryLabel"
                                    [valueLabel]="grafico.seriesName"
                                  />
                                }
                                @case ('diverging') {
                                  <siaf-diverging-chart
                                    [categories]="grafico.categories"
                                    [values]="grafico.values"
                                    [negativeLabel]="grafico.negativeLabel"
                                    [positiveLabel]="grafico.positiveLabel"
                                    [valueSuffix]="grafico.valueSuffix"
                                    [ariaLabel]="grafico.ariaLabel"
                                    [categoryLabel]="grafico.categoryLabel"
                                  />
                                }
                                @default {
                                  <siaf-bar-chart
                                    [categories]="grafico.categories"
                                    [series]="grafico.series"
                                    [valueSuffix]="grafico.valueSuffix"
                                    [ariaLabel]="grafico.ariaLabel"
                                    [categoryLabel]="grafico.categoryLabel"
                                  />
                                }
                              }
                            </siaf-chart-section>
                          }
                        </div>
                      }
                    }
                  </div>
                } @placeholder {
                  <siaf-table-skeleton [columns]="4" [rows]="6" ariaLabel="Cargando las gráficas" />
                }
              } @else {
                @if (resultado()?.summary; as resumen) {
                  <siaf-report-summary-card
                    [label]="resumen.label"
                    [icon]="resumen.icon"
                    [title]="resumen.title"
                    [description]="resumen.description ?? ''"
                    [fields]="resumen.fields"
                  />
                }

                @if (!vistaAgregado()) {
                  <ng-container [ngTemplateOutlet]="barraBusqueda" />
                }

                @if (vistaAgregado(); as vista) {
                  <div class="flex flex-col gap-siaf-md" data-vista-agregado>
                    <h3 class="m-0 text-base font-bold uppercase leading-normal tracking-[0.02px] text-[var(--sys-color-text-neutral-high)]">{{ vista.campo.plural }}</h3>
                    <div class="flex gap-siaf-md">
                      <nav class="flex w-[180px] shrink-0 flex-col gap-siaf-xs border-r border-[var(--sys-color-divider-default)] pr-siaf-md" [attr.aria-label]="vista.campo.label">
                        @for (opcion of vista.opciones; track opcion) {
                          <button
                            class="rounded-siaf-sm border px-siaf-md py-siaf-sm text-left text-sm transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                            type="button"
                            [attr.aria-pressed]="opcion === vista.elegida"
                            [class.border-[var(--sys-color-border-states-active)]]="opcion === vista.elegida"
                            [class.bg-[var(--sys-color-bg-states-light-selected)]]="opcion === vista.elegida"
                            [class.font-bold]="opcion === vista.elegida"
                            [class.text-[var(--sys-color-text-brand-primary)]]="opcion === vista.elegida"
                            [class.border-[var(--sys-color-border-states-enabled)]]="opcion !== vista.elegida"
                            (click)="entidadAgregado.set(opcion)"
                          >
                            {{ opcion }}
                          </button>
                        }
                      </nav>

                      <div class="flex min-w-0 flex-1 flex-col gap-siaf-lg">
                        @if (resumenAgregado(); as resumen) {
                          <siaf-report-summary-card
                            tone="highlight"
                            [icon]="vista.icono"
                            [title]="resumen.title"
                            [description]="resumen.description"
                            [fields]="resumen.fields"
                          />
                        }

                        <ng-container [ngTemplateOutlet]="barraBusqueda" />

                        <siaf-grouped-report-table
                          [columns]="vista.columnas"
                          [rows]="vista.filas"
                          [levels]="vista.niveles"
                          [aggregation]="configuracion().groupAggregation ?? null"
                          [ariaLabel]="configuracion().tableLabel ?? configuracion().title"
                          (linkClicked)="linkClicked.emit($event)"
                        />
                      </div>
                    </div>
                  </div>
                } @else if (nivelesGrupo().length) {
                  <siaf-grouped-report-table
                    [columns]="columnasPorNiveles(avanzados().levels)"
                    [rows]="filasFiltradas()"
                    [levels]="nivelesGrupo()"
                    [aggregation]="configuracion().groupAggregation ?? null"
                    [ariaLabel]="configuracion().tableLabel ?? configuracion().title"
                    (linkClicked)="linkClicked.emit($event)"
                  />
                } @else {
                  <siaf-report-table
                    [columns]="columnasMostradas()"
                    [rows]="filasPagina()"
                    [rowKey]="configuracion().rowKey"
                    [ariaLabel]="configuracion().tableLabel ?? configuracion().title"
                    (linkClicked)="linkClicked.emit($event)"
                  />
                }

                <siaf-pagination
                  navigation="Activate"
                  position="Bottom"
                  [rowPage]="true"
                  [page]="pagina()"
                  [pageSize]="tamanoPagina()"
                  [rowsPerPage]="tamanoPagina()"
                  [rowsPerPageOptions]="opcionesTamano"
                  [totalItems]="filasFiltradas().length"
                  [totalPages]="totalPaginas()"
                  (previous)="pagina.set(pagina() - 1)"
                  (next)="pagina.set(pagina() + 1)"
                  (rowsPerPageChange)="cambiarTamano($event)"
                />

                <p class="sr-only" aria-live="polite" data-anuncio-filas>{{ anuncio() }}</p>
              }
            </div>
          </section>
          }
        </div>
      }
    </siaf-page-shell>

    <ng-template #barraBusqueda>
      <div class="flex flex-col gap-siaf-lg">
                <siaf-form-table-search
                  variant="reports"
                  [value]="busqueda()"
                  [filterCount]="conteoFiltrosAvanzados()"
                  ariaLabel="Buscar en el resultado"
                  (valueChange)="buscar($event)"
                  (filter)="abrirFiltrosAvanzados()"
                  (columns)="abrirColumnas()"
                />

                @if (configuracion().presetFilters?.length || conteoFiltrosAvanzados()) {
                  <div class="flex flex-wrap items-center gap-siaf-sm" data-filtros-predeterminados>
                    @for (filtro of configuracion().presetFilters ?? []; track filtro.key) {
                      <siaf-filter-pill
                        [label]="filtro.label"
                        [options]="filtro.options"
                        [selectedValue]="filtros()[filtro.key] || ''"
                        (selectedValueChange)="filtrar(filtro.key, $event)"
                      />
                    }

                    @for (condicion of avanzados().conditions; track condicion.id) {
                      <siaf-tag variant="filter" icon="filter_list" [selected]="true" [removable]="true" [removeLabel]="'Quitar condición'" (removed)="quitarCondicion(condicion.id)">
                        {{ etiquetaCondicion(condicion) }}
                      </siaf-tag>
                    }

                    @if (avanzados().levels.length) {
                      <siaf-tag
                        variant="filter"
                        icon="layers"
                        [selected]="true"
                        [removable]="true"
                        removeLabel="Quitar agrupación"
                        (removed)="quitarNiveles()"
                      >
                        {{ avanzados().resultType === 'agrupado' ? 'Agrupado' : 'Agregado' }}: {{ etiquetaNiveles() }}
                      </siaf-tag>
                    }
                  </div>
                }
      </div>
    </ng-template>

    <siaf-query-parameters-panel
      [open]="panelAbierto()"
      [fields]="configuracion().parameterFields"
      [values]="parametros()"
      [focusKey]="campoEnfocado()"
      (closed)="panelAbierto.set(false)"
      (applied)="aplicar($event)"
    />

    <siaf-favorites-panel
      [open]="panelFavoritosAbierto()"
      [favorites]="favoritosResumen()"
      [selectedId]="favoritoAplicadoId()"
      [hayConsulta]="!!parametros()"
      [actual]="favoritoActual()"
      (closed)="panelFavoritosAbierto.set(false)"
      (added)="agregarFavorito($event)"
      (applied)="aplicarFavorito($event)"
      (removed)="quitarFavorito($event)"
      (defaultToggled)="alternarPredeterminado($event)"
    />

    @if (configuracion().columnsPanel) {
      <siaf-report-columns-panel
        [open]="panelColumnasAbierto()"
        [grupos]="gruposColumnas()"
        [selected]="columnasActivas()"
        [defaults]="columnasDeFabrica()"
        [baseKeys]="columnasBase()"
        (closed)="panelColumnasAbierto.set(false)"
        (applied)="aplicarColumnas($event)"
      />
    }

    <siaf-advanced-filters-panel
      [open]="panelAvanzadoAbierto()"
      [fields]="configuracion().advancedFilterFields ?? []"
      [value]="avanzados()"
      (closed)="panelAvanzadoAbierto.set(false)"
      (applied)="aplicarAvanzados($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueryReportPageComponent {
  @Input({ required: true }) set config(valor: QueryReportConfig) {
    this.configuracion.set(valor);
    if (!this.pestana() && valor.tabs?.length) this.pestana.set(valor.tabs[0].id);
  }
  /** Resultado de la consulta (o de la pestaña) para los parámetros aplicados. */
  @Input() set result(valor: QueryReportResult | null) {
    this.resultado.set(valor);
    this.pagina.set(1);
  }
  /** Mientras la pantalla consulta: la tabla o las gráficas pasan a esqueleto y «Exportar» se deshabilita. */
  @Input() loading = false;
  /**
   * Favoritos guardados del reporte. Si uno es el predeterminado y todavía no hay consulta, se aplica solo al entrar.
   * La pantalla los persiste con `favoritesChange`.
   */
  @Input() set favorites(valor: readonly QueryReportFavorite[]) {
    this.favoritos.set([...valor]);
    const predeterminado = valor.find((f) => f.isDefault);
    if (predeterminado && !this.predeterminadoAplicado && !this.parametros()) {
      this.predeterminadoAplicado = true;
      queueMicrotask(() => this.aplicarFavorito(predeterminado.id));
    }
  }
  /** Pestaña activa al empezar; por defecto, la primera. */
  @Input() set activeTab(valor: string) {
    if (valor) this.pestana.set(valor);
  }

  /** «Aplicar consulta»: la pantalla consulta con estos parámetros y entrega `result`. */
  @Output() queried = new EventEmitter<QueryReportParameters>();
  @Output() tabChanged = new EventEmitter<string>();
  /** Un formato de «Exportar»: la pantalla genera el archivo con las filas recibidas. */
  @Output() exported = new EventEmitter<QueryReportExportEvent>();
  @Output() favoritesRequested = new EventEmitter<void>();
  /** La lista completa de favoritos tras agregar, quitar o cambiar el predeterminado: la pantalla la guarda. */
  @Output() favoritesChange = new EventEmitter<QueryReportFavorite[]>();
  /** «Filtrar» del buscador (Filtros avanzados). */
  @Output() advancedFiltersRequested = new EventEmitter<void>();
  /** «Columnas» del buscador (Columnas visibles). */
  @Output() columnsRequested = new EventEmitter<void>();
  @Output() linkClicked = new EventEmitter<{ row: QueryReportRow; column: ReportTableColumn }>();

  readonly configuracion = signal<QueryReportConfig>({ title: '', breadcrumbs: [], parameterFields: [], columns: [], rowKey: '' });
  readonly resultado = signal<QueryReportResult | null>(null);
  readonly parametros = signal<QueryReportParameters | null>(null);
  readonly panelAbierto = signal(false);
  /** Parámetro que se abre al mostrar el panel (el de la tarjeta pulsada); `null` al abrirlo desde «Parámetros». */
  readonly campoEnfocado = signal<string | null>(null);
  readonly panelAvanzadoAbierto = signal(false);
  readonly panelFavoritosAbierto = signal(false);
  readonly panelColumnasAbierto = signal(false);
  /** Columnas elegidas en «Columnas visibles»; `null` = las de fábrica de la configuración. */
  private readonly columnasElegidas = signal<ReadonlySet<string> | null>(null);
  readonly favoritos = signal<QueryReportFavorite[]>([]);
  /** Favorito con el que se armó la consulta actual; deja de serlo si se cambian los parámetros o los filtros avanzados. */
  readonly favoritoAplicadoId = signal<string | null>(null);
  readonly favoritoAplicado = computed(() => this.favoritos().find((f) => f.id === this.favoritoAplicadoId()) ?? null);
  private predeterminadoAplicado = false;
  readonly avanzados = signal<QueryReportAdvancedFilters>(AVANZADOS_VACIO);
  /** Entidad elegida en el panel de «Agregado» (primer nivel, sacado a la izquierda); se resetea al reconsultar o recalcular niveles. */
  readonly entidadAgregado = signal<string | null>(null);
  readonly pestana = signal('');
  readonly vista = signal<QueryReportView>('datos');
  readonly busqueda = signal('');
  readonly filtros = signal<Record<string, string>>({});
  readonly pagina = signal(1);
  readonly tamanoPagina = signal(25);
  readonly opcionesTamano = [10, 25, 50, 100];
  readonly idTitulo = `siaf-consulta-resultado-${++siguienteId}`;

  /** Figma 22715:21316: `info` para la tabla e `insert_chart` para las gráficas; la etiqueta va en el tooltip. */
  readonly opcionesVista: ButtonGroupItem[] = [
    { label: 'Vista de datos', value: 'datos', icon: 'info' },
    { label: 'Vista de gráficas', value: 'graficas', icon: 'insert_chart' },
  ];

  /**
   * Figma «Opciones de tabla» (22402:16485). Material Icons no trae los archivos XLS y PDF del Figma: Excel usa
   * `table_view`, como el resto del kit, y PDF `picture_as_pdf`; CSV es el `table_chart` del Figma.
   * Sin `exportFormats` en la configuración, aparecen los tres.
   */
  private readonly ICONOS_EXPORTACION: Record<QueryReportExportFormat, { label: string; icon: string }> = {
    excel: { label: 'Excel', icon: 'table_view' },
    csv: { label: 'CSV', icon: 'table_chart' },
    pdf: { label: 'PDF', icon: 'picture_as_pdf' },
  };

  readonly opcionesExportacion = computed<IconDropdownMenuItem[]>(() =>
    (this.configuracion().exportFormats ?? FORMATOS_EXPORTACION).map((formato) => ({ value: formato, ...this.ICONOS_EXPORTACION[formato] })),
  );

  /** Sin `charts` en la configuración no hay selector y siempre se ve la tabla. */
  readonly vistaActiva = computed<QueryReportView>(() => (this.configuracion().charts ? this.vista() : 'datos'));

  readonly parametrosAplicados = computed<ParametroAplicado[]>(() => this.describirParametros(this.parametros() ?? {}));

  readonly favoritosResumen = computed<FavoritoResumen[]>(() =>
    this.favoritos().map((f) => {
      const parametros = this.describirParametros(f.parameters).length;
      const { conditions, levels, resultType } = f.advanced;
      const partes = [
        `${parametros} ${parametros === 1 ? 'parámetro' : 'parámetros'}`,
        conditions.length ? `${conditions.length} ${conditions.length === 1 ? 'condición' : 'condiciones'}` : '',
        levels.length ? `${levels.length} ${resultType === 'agrupado' ? (levels.length === 1 ? 'agrupado' : 'agrupados') : levels.length === 1 ? 'agregado' : 'agregados'}` : '',
      ].filter(Boolean);
      return { id: f.id, description: f.description, isDefault: f.isDefault, summary: partes.join(' · ') };
    }),
  );

  readonly favoritoActual = computed<FavoritoActual>(() => ({
    parametros: this.parametrosAplicados(),
    condiciones: this.avanzados().conditions.map((c) => this.etiquetaCondicion(c)),
    niveles: this.avanzados().levels.map((clave) => this.configuracion().advancedFilterFields?.find((c) => c.key === clave)?.label ?? clave),
    tipoResultado: this.avanzados().resultType,
  }));

  readonly filasFiltradas = computed<QueryReportRow[]>(() => {
    const filas = this.resultado()?.rows ?? [];
    const termino = normalizar(this.busqueda().trim());
    const filtros = Object.entries(this.filtros()).filter(([, valor]) => !!valor);
    const condiciones = this.avanzados().conditions;
    const columnas = this.configuracion().columns;
    return filas.filter(
      (fila) =>
        filtros.every(([clave, valor]) => fila[clave] === valor) &&
        condiciones.every((condicion) => cumpleCondicion(fila, condicion)) &&
        (!termino || columnas.some((c) => normalizar(fila[c.key] ?? '').includes(termino))),
    );
  });

  readonly hayBusquedaOFiltros = computed(() => !!this.busqueda().trim() || Object.values(this.filtros()).some((valor) => !!valor));

  readonly conteoFiltrosAvanzados = computed(() => this.avanzados().conditions.length + this.avanzados().levels.length);

  /** Niveles de «Agrupado» listos para `siaf-grouped-report-table`; vacío también cuando el resultado es «Agregado» (usa `vistaAgregado`). */
  readonly nivelesGrupo = computed<GroupedTableLevel[]>(() => {
    const avanzados = this.avanzados();
    if (avanzados.resultType !== 'agrupado' || !avanzados.levels.length) return [];
    return this.aNivelesTabla(avanzados.levels);
  });

  /** Con «Agregado», el primer nivel se saca a un panel de entidades y esta tabla agrupa por los niveles restantes de la entidad elegida. */
  readonly vistaAgregado = computed(() => {
    const avanzados = this.avanzados();
    if (avanzados.resultType !== 'agregado' || !avanzados.levels.length) return null;

    const [primeraClave, ...restoClaves] = avanzados.levels;
    const campo = this.configuracion().advancedFilterFields?.find((c) => c.key === primeraClave);
    if (!campo) return null;

    const filas = this.filasFiltradas();
    const opciones = [...new Set(filas.map((f) => f[primeraClave] ?? ''))].filter(Boolean);
    const entidad = this.entidadAgregado() && opciones.includes(this.entidadAgregado()!) ? this.entidadAgregado()! : (opciones[0] ?? null);

    const iconoParametro = this.configuracion().parameterFields.find((p) => p.key === primeraClave)?.icon;
    return {
      campo: { ...campo, plural: campo.label.endsWith('a') || /[aeiou]$/i.test(campo.label) ? `${campo.label}s` : `${campo.label}es` },
      elegida: entidad,
      columnas: this.columnasPorNiveles(avanzados.levels, this.configuracion().groupAggregation?.hiddenColumns),
      icono: iconoParametro ?? 'account_balance',
      opciones,
      filas: entidad ? filas.filter((f) => f[primeraClave] === entidad) : [],
      niveles: this.aNivelesTabla(restoClaves),
    };
  });

  /** Card de la entidad elegida en «Agregado»: mismo saldo que se arrastra de `groupAggregation.runningBalance`. */
  readonly resumenAgregado = computed(() => {
    const vista = this.vistaAgregado();
    const balance = this.configuracion().groupAggregation?.runningBalance;
    if (!vista || !balance || !vista.filas.length) return null;
    const detalle = vista.campo.valueDetails?.[vista.elegida ?? ''];
    return {
      title: detalle?.title ?? vista.elegida ?? '',
      description: detalle?.description ?? '',
      fields: [
        { label: 'Saldo inicial', value: vista.filas[0][balance.startColumn] ?? '' },
        { label: 'Saldo final', value: vista.filas[vista.filas.length - 1][balance.endColumn] ?? '' },
      ],
    };
  });

  /**
   * La consulta ya trajo un resultado (no `loading`) pero sin filas, con estos parámetros exactos: Figma «Query and
   * report 02» (nodo 23180:9844). Si en cambio las filas se fueron por la búsqueda o un filtro predeterminado, no
   * aplica: eso lo avisa `siaf-report-table` por su cuenta (fila vacía con `role="status"`).
   *
   * Método (no `computed`) porque depende de `loading`, un `@Input` normal y no una signal: un `computed` solo se
   * vuelve a evaluar cuando cambia una signal que leyó, así que quedaría con el valor de la última vez que cambió
   * `resultado` en vez de reflejar `loading` al momento de pintar la plantilla.
   */
  sinResultados(): boolean {
    return !this.loading && this.resultado() !== null && this.resultado()!.rows.length === 0;
  }

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.filasFiltradas().length / this.tamanoPagina())));

  readonly filasPagina = computed(() => {
    const pagina = Math.min(this.pagina(), this.totalPaginas());
    const inicio = (pagina - 1) * this.tamanoPagina();
    return this.filasFiltradas().slice(inicio, inicio + this.tamanoPagina());
  });

  readonly anuncio = computed(() => {
    const total = this.filasFiltradas().length;
    return total === 1 ? '1 fila en el resultado' : `${total} filas en el resultado`;
  });

  readonly kpis = computed(() => calcularKpis(this.filasFiltradas(), this.configuracion().charts?.kpis ?? []));

  readonly graficos = computed<GraficoEnVista[]>(() => {
    const calculados = (this.configuracion().charts?.charts ?? []).map((grafico) => calcularGrafico(this.filasFiltradas(), grafico));
    return calculados.map((grafico, i) => {
      const emparejado =
        grafico.width === 'wide' ? calculados[i + 1]?.width === 'narrow' : calculados[i - 1]?.width === 'wide';
      return {
        ...grafico,
        dibujo: grafico.categories.length ? grafico.type : 'vacio',
        series: [{ name: grafico.seriesName, values: grafico.values }],
        ariaLabel: grafico.title,
        clase: emparejado ? '' : 'xl:col-span-2',
      };
    });
  });

  private readonly hayGraficoAngosto = computed(() => this.graficos().some((grafico) => grafico.width === 'narrow'));

  /** Dos columnas angostas en tablet y hasta cuatro por fila en escritorio; con un gráfico angosto, la última mide 336 px. */
  readonly claseKpis = computed(() => {
    const columnas = Math.min(this.kpis().length, 4);
    if (columnas === 4) return this.hayGraficoAngosto() ? 'xl:grid-cols-[repeat(3,minmax(0,1fr))_336px]' : 'xl:grid-cols-4';
    if (columnas === 3) return this.hayGraficoAngosto() ? 'xl:grid-cols-[repeat(2,minmax(0,1fr))_336px]' : 'xl:grid-cols-3';
    return '';
  });

  /** En escritorio, el gráfico ancho y a su derecha el angosto de 336 px (Figma 22402:16766); en pantallas menores, uno por fila. */
  readonly claseGraficos = computed(() => (this.hayGraficoAngosto() ? 'xl:grid-cols-[minmax(0,1fr)_336px]' : ''));

  readonly notaGraficas = computed(() => {
    const total = this.filasFiltradas().length;
    return total === 1
      ? 'Las gráficas usan la única fila que quedó tras buscar o filtrar en la vista de datos.'
      : `Las gráficas usan las ${total} filas que quedaron tras buscar o filtrar en la vista de datos.`;
  });

  aplicar(valores: QueryReportParameters): void {
    this.parametros.set(valores);
    this.favoritoAplicadoId.set(null);
    this.busqueda.set('');
    this.filtros.set({});
    this.avanzados.set(AVANZADOS_VACIO);
    this.entidadAgregado.set(null);
    this.pagina.set(1);
    this.panelAbierto.set(false);
    this.queried.emit(valores);
  }

  abrirParametros(clave: string | null): void {
    this.campoEnfocado.set(clave);
    this.panelAbierto.set(true);
  }

  private describirParametros(valores: QueryReportParameters): ParametroAplicado[] {
    const campos = this.configuracion().parameterFields;
    const cierresDeRango = new Set(campos.map((c) => c.rangeEnd).filter(Boolean));
    return campos
      .filter((campo) => !cierresDeRango.has(campo.key) && (tieneValor(valores[campo.key]) || (campo.rangeEnd && tieneValor(valores[campo.rangeEnd]))))
      .map((campo) => {
        if (campo.rangeEnd) {
          const fechas = [valores[campo.key], valores[campo.rangeEnd]].filter((v): v is string => typeof v === 'string' && !!v).map(fechaVisible);
          return { key: campo.key, label: campo.rangeLabel ?? campo.label, value: fechas.join(' - '), icon: campo.icon };
        }
        const valor = valores[campo.key];
        const etiqueta = (v: string): string => campo.options?.find((o) => o.value === v)?.label ?? v;
        const texto = Array.isArray(valor)
          ? valor.map(etiqueta).join(', ')
          : campo.type === 'date'
            ? fechaVisible(valor)
            : etiqueta(valor);
        return { key: campo.key, label: campo.label, value: texto, icon: campo.icon };
      });
  }

  abrirFavoritos(): void {
    this.panelFavoritosAbierto.set(true);
    this.favoritesRequested.emit();
  }

  agregarFavorito(nuevo: FavoritoNuevo): void {
    const favorito: QueryReportFavorite = {
      id: `fav-${Date.now()}`,
      description: nuevo.description,
      isDefault: nuevo.isDefault,
      parameters: { ...(this.parametros() ?? {}) },
      advanced: { ...this.avanzados(), conditions: this.avanzados().conditions.map((c) => ({ ...c })), levels: [...this.avanzados().levels] },
    };
    this.cambiarFavoritos([...this.favoritos().map((f) => (nuevo.isDefault ? { ...f, isDefault: false } : f)), favorito]);
    this.panelFavoritosAbierto.set(false);
  }

  aplicarFavorito(id: string): void {
    const favorito = this.favoritos().find((f) => f.id === id);
    if (!favorito) return;
    this.aplicar(favorito.parameters);
    this.avanzados.set(favorito.advanced);
    this.favoritoAplicadoId.set(id);
    this.panelFavoritosAbierto.set(false);
  }

  quitarFavorito(id: string): void {
    this.cambiarFavoritos(this.favoritos().filter((f) => f.id !== id));
  }

  alternarPredeterminado(id: string): void {
    this.cambiarFavoritos(this.favoritos().map((f) => ({ ...f, isDefault: f.id === id ? !f.isDefault : false })));
  }

  private cambiarFavoritos(lista: QueryReportFavorite[]): void {
    this.favoritos.set(lista);
    this.favoritesChange.emit(lista);
  }

  abrirFiltrosAvanzados(): void {
    this.panelAvanzadoAbierto.set(true);
  }

  aplicarAvanzados(valores: QueryReportAdvancedFilters): void {
    this.avanzados.set(valores);
    this.favoritoAplicadoId.set(null);
    this.entidadAgregado.set(null);
    this.pagina.set(1);
    this.panelAvanzadoAbierto.set(false);
  }

  quitarCondicion(id: string): void {
    this.favoritoAplicadoId.set(null);
    this.avanzados.update((actual) => ({ ...actual, conditions: actual.conditions.filter((c) => c.id !== id) }));
  }

  quitarNiveles(): void {
    this.favoritoAplicadoId.set(null);
    this.avanzados.update((actual) => ({ ...actual, levels: [] }));
    this.entidadAgregado.set(null);
  }

  etiquetaCondicion(condicion: QueryReportCondition): string {
    const campo = this.configuracion().advancedFilterFields?.find((c) => c.key === condicion.field)?.label ?? condicion.field;
    const simbolo = OPERADOR_SIMBOLO[condicion.operator];
    if (condicion.operator === 'empty' || condicion.operator === 'notEmpty') return `${campo}: ${simbolo}`;
    if (condicion.operator === 'between') return `${campo}: ${condicion.value} ${simbolo} ${condicion.valueTo}`;
    return `${campo}: ${simbolo} ${condicion.value}`;
  }

  etiquetaNiveles(): string {
    const campos = this.configuracion().advancedFilterFields ?? [];
    return this.avanzados()
      .levels.map((clave) => campos.find((c) => c.key === clave)?.label ?? clave)
      .join(' ▶ ');
  }

  /** Columnas visibles de fábrica: todas menos las `hiddenByDefault`. */
  readonly columnasDeFabrica = computed<ReadonlySet<string>>(() => new Set(this.configuracion().columns.filter((c) => !c.hiddenByDefault).map((c) => c.key)));

  readonly columnasActivas = computed<ReadonlySet<string>>(() => this.columnasElegidas() ?? this.columnasDeFabrica());

  /** Las que quedan si se ocultan todas: las de los grupos base. */
  readonly columnasBase = computed<ReadonlySet<string>>(() => {
    const base = this.configuracion().columnsPanel?.baseGroups ?? [];
    return new Set(this.configuracion().columns.filter((c) => c.group && base.includes(c.group)).map((c) => c.key));
  });

  /** Columnas de la configuración que se ven ahora. */
  readonly columnasMostradas = computed<ReportTableColumn[]>(() => this.configuracion().columns.filter((c) => this.columnasActivas().has(c.key)));

  /** El árbol del panel: un grupo por cabecera (los no contiguos con el mismo nombre se juntan) y las columnas sueltas aparte. */
  readonly gruposColumnas = computed<ColumnasPanelGrupo[]>(() => {
    const nombres = this.configuracion().columnsPanel?.groupLabels ?? {};
    const grupos: ColumnasPanelGrupo[] = [];
    for (const c of this.configuracion().columns) {
      const columna = { key: c.key, label: c.panelLabel ?? c.label };
      const id = c.group ?? `col-${c.key}`;
      const existente = grupos.find((g) => g.id === id);
      if (existente) existente.columnas.push(columna);
      else grupos.push({ id, label: c.group ? (nombres[c.group] ?? c.group) : c.label, suelta: !c.group, columnas: [columna] });
    }
    return grupos;
  });

  abrirColumnas(): void {
    this.columnsRequested.emit();
    if (this.configuracion().columnsPanel) this.panelColumnasAbierto.set(true);
  }

  aplicarColumnas(claves: Set<string>): void {
    this.columnasElegidas.set(claves);
    this.panelColumnasAbierto.set(false);
  }

  /**
   * Columnas de la tabla con los niveles aplicados: cada nivel oculta sus columnas (`hidesColumns`) y los grupos de
   * cabecera que le corresponden (`hidesGroups`), salvo las columnas que siguen visibles sin grupo.
   */
  columnasPorNiveles(niveles: readonly string[], extraOcultas: readonly string[] = []): ReportTableColumn[] {
    const campos = (this.configuracion().advancedFilterFields ?? []).filter((c) => niveles.includes(c.key));
    const columnas = new Set([...extraOcultas, ...campos.flatMap((c) => c.hidesColumns ?? [])]);
    const grupos = new Set(campos.flatMap((c) => c.hidesGroups ?? []));
    return this.columnasMostradas()
      .filter((c) => !columnas.has(c.key) && !(c.group && grupos.has(c.group) && !c.ungroupWhenGroupHidden))
      .map((c) => (c.group && grupos.has(c.group) ? { ...c, group: undefined } : c));
  }

  private aNivelesTabla(claves: readonly string[]): GroupedTableLevel[] {
    const campos = this.configuracion().advancedFilterFields ?? [];
    return claves.map((clave) => {
      const campo = campos.find((c) => c.key === clave);
      return { key: clave, label: campo?.label ?? clave, labelPrefix: campo?.groupLabelPrefix, subtitleColumn: campo?.groupSubtitleColumn };
    });
  }

  cambiarPestana(id: string): void {
    this.pestana.set(id);
    this.pagina.set(1);
    this.tabChanged.emit(id);
  }

  cambiarVista(valor: string): void {
    this.vista.set(valor === 'graficas' ? 'graficas' : 'datos');
  }

  buscar(termino: string): void {
    this.busqueda.set(termino);
    this.pagina.set(1);
  }

  filtrar(clave: string, valor: string): void {
    this.filtros.update((actual) => ({ ...actual, [clave]: valor }));
    this.pagina.set(1);
  }

  cambiarTamano(tamano: number): void {
    this.tamanoPagina.set(tamano);
    this.pagina.set(1);
  }

  exportar(formato: string): void {
    const format = FORMATOS_EXPORTACION.find((f) => f === formato);
    if (!format) return;
    this.exported.emit({ format, parameters: this.parametros() ?? {}, rows: this.filasFiltradas() });
  }
}
