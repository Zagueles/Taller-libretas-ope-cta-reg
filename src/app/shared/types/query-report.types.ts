import type { BreadcrumbItem } from '../components/breadcrumb/breadcrumb.component';
import type { FilterPillOption } from '../components/filter-pill/filter-pill.component';
import type { KpiCardTone } from '../ui/kpi-card/kpi-card.component';
import type { ReportSummaryField } from '../ui/report-summary-card/report-summary-card.component';
import type { ReportTableColumn, ReportTableRow } from '../ui/report-table/report-table.component';
import type { TabItem } from '../ui/tabs/tabs.component';
import type { TextFieldOption } from '../ui/text-field/text-field.component';

/** Campo del panel «Parámetros de consulta». */
export interface QueryReportParameterField {
  key: string;
  label: string;
  /** `date` usa el selector de fecha; `select-multiple`, la lista con casillas y «Seleccionar todo». */
  type: 'date' | 'select' | 'select-multiple';
  options?: TextFieldOption[];
  required?: boolean;
  /** Ícono de Material Icons de su tarjeta en «Parámetros aplicados». */
  icon: string;
  /**
   * En un campo `date`: la clave del campo que cierra el rango («hasta»). «Parámetros aplicados» los une en una sola
   * tarjeta con `rangeLabel` («Fecha») y las dos fechas separadas por un guion; el otro campo no tiene tarjeta propia.
   */
  rangeEnd?: string;
  rangeLabel?: string;
}

/** Valores aplicados: la fecha (aaaa-mm-dd, como la entrega `siaf-date-time-picker`), el valor elegido o la lista. */
export type QueryReportParameters = Record<string, string | string[]>;

/** Píldora de «Filtros predeterminados»: filtra las filas cuya columna `key` tiene el valor elegido. */
export interface QueryReportPresetFilter {
  key: string;
  label: string;
  options: FilterPillOption[];
}

export interface QueryReportSummary {
  /** Etiqueta en versalitas («Entidad»). */
  label: string;
  icon: string;
  title: string;
  description?: string;
  fields: ReportSummaryField[];
}

/** Lo que devuelve la consulta de la pantalla para los parámetros aplicados. */
export interface QueryReportResult {
  rows: ReportTableRow[];
  summary?: QueryReportSummary | null;
}

export type QueryReportColumn = ReportTableColumn;
export type QueryReportRow = ReportTableRow;

/** `sum` suma una columna de importes («1,031,200.00»); `count` cuenta filas. */
/** `first`/`last` toman el valor de la primera o última fila del grupo (p. ej. el saldo inicial o final de un período), sin sumarlas. */
export type QueryReportAggregate = 'sum' | 'count' | 'first' | 'last';

/** Solo las filas cuya columna tiene exactamente ese valor. */
export interface QueryReportRowFilter {
  column: string;
  value: string;
}

/** Tarjeta KPI de la vista de gráficas, calculada con las filas del resultado. */
export interface QueryReportKpi {
  title: string;
  icon?: string;
  tone?: KpiCardTone;
  /** Columna a sumar; con `count` no hace falta. */
  column?: string;
  aggregate?: QueryReportAggregate;
  /** Con filtro, la barra muestra qué parte del total de la columna representan esas filas; sin él, el 100 %. */
  where?: QueryReportRowFilter;
  /** Texto antes del monto («S/ »). */
  prefix?: string;
}

export type QueryReportChartType = 'bar' | 'line' | 'donut' | 'diverging';

/** Gráfico de la vista de gráficas: agrupa las filas por una columna y suma otra (o las cuenta). */
export interface QueryReportChart {
  title: string;
  description?: string;
  type: QueryReportChartType;
  /** Columna que forma las categorías, en el orden en que aparecen. */
  groupBy: string;
  /** Con una columna de fecha dd/mm/aaaa, agrupa por mes («ENE», «FEB»…) en orden cronológico. */
  byMonth?: boolean;
  /** Con una columna de fecha dd/mm/aaaa hh:mm:ss, agrupa por hora («18:00», «19:00»…) en orden cronológico: para un
   *  período de un solo día, donde agrupar por mes dejaría una única categoría. */
  byHour?: boolean;
  column?: string;
  aggregate?: QueryReportAggregate;
  where?: QueryReportRowFilter;
  /**
   * `index`: cada valor como porcentaje del primero (base = 100). `change`: variación porcentual de cada categoría
   * respecto de la primera, sin la primera.
   */
  transform?: 'index' | 'change';
  /** Nombre de la serie en la leyenda y el tooltip. */
  seriesName?: string;
  /** Nombre de las categorías en la tabla de datos del gráfico («Mes»). */
  categoryLabel?: string;
  /** Con `diverging`, qué significa cada lado; por defecto «Disminución» y «Aumento». */
  negativeLabel?: string;
  positiveLabel?: string;
  /** `narrow` va en la columna angosta (336 px) a la derecha del `wide` anterior, como en el Figma. */
  width?: 'wide' | 'narrow';
}

export interface QueryReportChartsConfig {
  kpis: QueryReportKpi[];
  charts: QueryReportChart[];
}

export type QueryReportExportFormat = 'excel' | 'csv' | 'pdf';

/** Campo disponible para una condición o un nivel de agrupación de «Filtros avanzados»: una columna de la fila. */
export interface QueryReportFilterField {
  key: string;
  label: string;
  /** `date` usa el selector de fecha en «Valor»; el resto, texto libre (Figma no trae un select de catálogo real). */
  type?: 'text' | 'date';
}

/** Símbolo + etiqueta de cada condición (Figma «Condición», nodo 4663:59398). */
export type QueryReportConditionOperator = '=' | '!=' | '>' | '>=' | '<' | '<=' | 'between' | 'empty' | 'notEmpty';

/** Una fila de «Condiciones»: compara `field` contra `value` (y `valueTo` con `between`) sobre el resultado ya traído. */
export interface QueryReportCondition {
  id: string;
  field: string;
  operator: QueryReportConditionOperator;
  value?: string;
  valueTo?: string;
}

export type QueryReportResultType = 'agrupado' | 'agregado';

/** Lo que arma el panel «Filtros avanzados»: condiciones y, con niveles, el tipo de resultado. */
export interface QueryReportAdvancedFilters {
  conditions: QueryReportCondition[];
  resultType: QueryReportResultType;
  /** Campos a agrupar, en orden (Entidad ▶ UE ▶ Beneficiario); vacío = tabla detallada, sin agrupar. */
  levels: string[];
}

/** Configuración guardada de un reporte: sus parámetros y sus filtros avanzados, con una descripción para reaplicarla. */
export interface QueryReportFavorite {
  id: string;
  description: string;
  /** Se aplica sola la próxima vez que se entra al reporte; solo uno por reporte. */
  isDefault: boolean;
  parameters: QueryReportParameters;
  advanced: QueryReportAdvancedFilters;
}

/**
 * Configuración de una pantalla «Consultas y reportes» armada con `siaf-query-report-page`: la pantalla solo pasa sus
 * textos, sus parámetros, sus columnas y el resultado de cada consulta.
 */
export interface QueryReportConfig {
  /** «Columnas visibles»: sin él, el botón Columnas solo emite `columnsRequested`. */
  columnsPanel?: QueryReportColumnsConfig;
  title: string;
  breadcrumbs: BreadcrumbItem[];
  parameterFields: QueryReportParameterField[];
  columns: QueryReportColumn[];
  /** Clave que identifica cada fila del resultado. */
  rowKey: string;
  /** Título de la tarjeta del resultado; por defecto «Resultado de reporte». */
  resultTitle?: string;
  /** Pestañas sobre el resultado; la pantalla recibe `tabChanged` y entrega el resultado de la pestaña. */
  tabs?: TabItem[];
  presetFilters?: QueryReportPresetFilter[];
  /** KPI y gráficos de la vista de gráficas; sin ellos no aparece el selector de vista. */
  charts?: QueryReportChartsConfig;
  /** Nombre de la tabla para el lector de pantalla. */
  tableLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  /**
   * Campos que ofrece «Filtros avanzados»: el «Campo» de cada condición y, los que declaran `groupable`, las
   * opciones de «Agregar nivel» (Agrupado/Agregado). Sin esta lista, «Filtros avanzados» no aparece.
   */
  advancedFilterFields?: QueryReportAdvancedFilterField[];
  /**
   * Cómo totalizar cada grupo de Agrupado/Agregado (Figma «Subtotal»/«TOTAL» y el saldo inline del último nivel,
   * nodo 5960:44051): toma el valor de la primera fila del grupo como inicio y el de la última como fin (Saldo
   * inicial/Saldo final), como un saldo que se arrastra en vez de sumarse (RN-042 del MFD). Sin esta configuración,
   * Agrupado/Agregado no calculan totales por grupo.
   */
  groupAggregation?: QueryReportGroupAggregation;
  /** Formatos que ofrece «Exportar»; por defecto los tres (Excel, CSV, PDF). */
  exportFormats?: QueryReportExportFormat[];
}

export interface QueryReportAdvancedFilterField extends QueryReportFilterField {
  /** Columnas que se ocultan de la tabla cuando el campo es un nivel: su valor pasa a la fila del grupo. */
  hidesColumns?: string[];
  /** Grupos de cabecera enteros que se ocultan cuando el campo es un nivel (Beneficiario y Cuenta de registro van asociados). */
  hidesGroups?: string[];
  /** Sin él, `groupable` vale para Agrupado y Agregado; con él, solo para los tipos de resultado listados. */
  groupableIn?: QueryReportResultType[];
  /**
   * Posición en la jerarquía del clasificador (Entidad 1, Unidad ejecutora 2): entre los campos con jerarquía, los
   * niveles deben ir en ese orden y no se pueden intercambiar.
   */
  hierarchy?: number;
  /** Denominación y código de cada valor del campo (por su valor en las filas): los muestra la card del nivel 1 de «Agregado». */
  valueDetails?: Record<string, { title: string; description?: string }>;
  /** Puede usarse como nivel de agrupación (Agrupado/Agregado), además de como condición. */
  groupable?: boolean;
  /** Abreviatura ante el valor del grupo en su encabezado («Ent.», «UE.», «Benef.»); por defecto, `label`. */
  groupLabelPrefix?: string;
  /** Columna de la fila que se muestra como segunda línea bajo el encabezado del grupo (Figma: la Cuenta de Registro bajo «Benef.»). */
  groupSubtitleColumn?: string;
}

/** Cómo se ofrecen las columnas en «Columnas visibles» de un reporte. */
export interface QueryReportColumnsConfig {
  /** Nombre en el panel de un grupo de cabecera cuando difiere (`'Imp. m. cuenta'` → «Importe en moneda de la cuenta»). */
  groupLabels?: Record<string, string>;
  /** Grupos que se mantienen si se ocultan todas las columnas. */
  baseGroups: string[];
}

export interface QueryReportGroupAggregation {
  /** Columnas que no se muestran en «Agregado», porque son por movimiento (secuencia, fecha de acreditación). */
  hiddenColumns?: string[];
  runningBalance: { startColumn: string; endColumn: string };
}
