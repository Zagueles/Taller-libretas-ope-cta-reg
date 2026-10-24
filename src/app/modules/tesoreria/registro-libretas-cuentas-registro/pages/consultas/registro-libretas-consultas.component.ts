import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Router } from '@angular/router';

import { guardarFavoritos, leerFavoritos } from '../../../../../mock/mock-db';

import { QueryReportExportEvent, QueryReportPageComponent } from '../../../../../shared/components/query-report-page/query-report-page.component';
import type { QueryReportConfig, QueryReportFavorite, QueryReportParameters, QueryReportResult, QueryReportRow } from '../../../../../shared/types/query-report.types';
import type { TabItem } from '../../../../../shared/ui/tabs/tabs.component';
import { SnackbarComponent } from '../../../../../shared/ui/snackbar/snackbar.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { RegistroLibretasApiService } from '../../api/registro-libretas-api.service';
import { CONSULTAS_PROCESS_ID, CONSULTAS_ROUTE, DOCUMENTO_ROUTE, PROCESS_ROUTE } from '../../config/registro-libretas.rutas';
import {
  BENEFICIARIOS,
  CUENTAS_BANCARIAS_INFO,
  CUENTAS_BANCARIAS_REGISTRO,
  CuentaRegistroCatalogo,
  ENTIDADES,
  MovimientoLibretaRegistro,
  SaldosCuentaBancaria,
  TIPO_CAMBIO,
  TIPOS_OPERACION,
  UNIDADES_EJECUTORAS,
  nombreBeneficiario,
  nombreCuentaBancaria,
  nombreTipoOperacion,
  nombreTipoOperacionCorto,
} from '../../models/registro-libretas.model';

/** Prefijo de los montos en los KPI de la vista de gráficas, según la moneda de la cuenta bancaria de la pestaña activa. */
const SIMBOLO_MONEDA: Record<'PEN' | 'USD', string> = { PEN: 'S/ ', USD: 'US$ ' };

import { COLUMNAS_MONEDA_EXTRANJERA, COLUMNAS_REGISTRO_LIBRETAS } from '../../config/registro-libretas-columnas';
import { filaMovimiento } from '../../utils/registro-libretas-fila.util';
import { claveMovimiento, importesMN, saldosMNPorMovimiento, saldosPorCuentaRegistro, tipoCambioDeMovimiento, TIPO_OPERACION_SALDO_INICIAL } from '../../utils/registro-libretas-saldos.util';
import { exportarConsultaExcel } from '../../utils/exportacion/excel-consulta.util';
import { descargar } from '../../utils/exportacion/formato-exportacion.util';
import { generarPdfGraficas } from '../../utils/exportacion/pdf-graficas.util';

/** Beneficiario y Cuenta de registro van asociados: elegir cualquiera como nivel oculta los dos grupos de cabecera. */
const GRUPOS_ASOCIADOS = ['Beneficiario', 'Cuenta de registro'];

/** Denominación (título) y código (apoyo) de cada valor, para la card del nivel 1 de «Agregado». */
type Detalle = Record<string, { title: string; description: string }>;

const DETALLE_BENEFICIARIO: Detalle = Object.fromEntries(BENEFICIARIOS.map((b) => [b.label, { title: b.label, description: b.value }]));

const DETALLE_TIPO_OPERACION: Detalle = Object.fromEntries(
  TIPOS_OPERACION.map((t) => {
    const [codigo, ...nombre] = t.label.split(' - ');
    return [t.label, { title: nombre.join(' - '), description: codigo }];
  }),
);

/** Las cards del nivel 1 de «Agregado» para la cuenta de registro y el FF/SUB FF, desde las cuentas de registro de la libreta. */
function detallesDeCuentasRegistro(cuentas: CuentaRegistroCatalogo[]): { cuentaRegistro: Detalle; ff: Detalle } {
  return {
    cuentaRegistro: Object.fromEntries(cuentas.map((c) => [c.numero, { title: c.descripcion, description: c.numero }])),
    ff: Object.fromEntries(
      cuentas.map((c) => {
        const [codigo, ...nombre] = c.ffSubFf.split(' ');
        return [c.ffSubFf, { title: nombre.join(' '), description: codigo }];
      }),
    ),
  };
}

/** RF-07: la fecha desde no puede ser anterior a 2020 (configurable en el Catálogo de parámetros). */
const FECHA_MINIMA_CONSULTA = '2020-01-01';

const TITULO = 'Consultas y reportes de operaciones en las libretas de las cuentas de registro';

const formatoMonto = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monto = (valor: number): string => formatoMonto.format(valor);

/** aaaa-mm-ddThh:mm:ss → dd/mm/aaaa hh:mm:ss (Figma «Acreditación»: fecha y hora en dos líneas). */
const fechaHoraVisible = (iso: string): string => {
  const [fecha, hora] = iso.split('T');
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio} ${hora}`;
};

/**
 * «Consultas y reportes» de Registro de operaciones en las libretas de las cuentas de registro (Figma nodo
 * 5953:39984). Una pestaña por cada cuenta bancaria consultada, con su card resumen (saldo inicial y final) y la
 * tabla de movimientos de esa cuenta; cambiar de pestaña solo reordena las filas ya traídas, sin volver a consultar.
 */
@Component({
  selector: 'siaf-registro-libretas-consultas',
  standalone: true,
  imports: [QueryReportPageComponent, SnackbarComponent],
  template: `
    <siaf-query-report-page
      [config]="config()"
      [result]="resultado()"
      [loading]="cargando()"
      (queried)="consultar($event)"
      (tabChanged)="mostrarPestana($event)"
      [favorites]="favoritos()"
      (favoritesChange)="guardarFavoritosDelReporte($event)"
      (exported)="exportar($event)"
      (linkClicked)="abrirDocumento($event.row)"
    />
    <div class="fixed bottom-siaf-lg left-1/2 z-50 w-[min(430px,calc(100vw-32px))] -translate-x-1/2">
      <siaf-snackbar [open]="preparandoExportacion()" tone="neutral" [dismissible]="false" message="Preparando archivo para exportar" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroLibretasConsultasComponent {
  private readonly api = inject(RegistroLibretasApiService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  private filasPorCuenta = new Map<string, MovimientoLibretaRegistro[]>();
  /** Saldo inicial y final en moneda nacional de cada movimiento, encadenados por libreta (RN-044/045). */
  private saldosMN = new Map<string, { saldoInicialMN: number; saldoFinalMN: number }>();
  /** Saldo inicial y final de cada cuenta bancaria (el total de su libreta, no el del período consultado). */
  private saldosCuentas = new Map<string, SaldosCuentaBancaria>();

  constructor() {
    // Las cuentas de registro de la libreta alimentan el filtro predeterminado y las cards del agregado.
    this.api.listarCuentasRegistro().subscribe((cuentas) => {
      const { cuentaRegistro, ff } = detallesDeCuentasRegistro(cuentas);
      this.config.update((actual) => ({
        ...actual,
        advancedFilterFields: actual.advancedFilterFields?.map((campo) =>
          campo.key === 'numeroCuentaRegistro' ? { ...campo, valueDetails: cuentaRegistro } : campo.key === 'ffSubFf' ? { ...campo, valueDetails: ff } : campo,
        ),
        presetFilters: actual.presetFilters?.map((filtro) =>
          filtro.key === 'numeroCuentaRegistro' ? { ...filtro, options: cuentas.map((c) => ({ value: c.numero, label: c.descripcion })) } : filtro,
        ),
      }));
    });
  }

  readonly resultado = signal<QueryReportResult | null>(null);
  readonly cargando = signal(false);
  readonly preparandoExportacion = signal(false);
  readonly favoritos = signal<QueryReportFavorite[]>(leerFavoritos(PROCESS_ROUTE));

  readonly config = signal<QueryReportConfig>({
    title: TITULO,
    breadcrumbs: buildProcessBreadcrumbs(CONSULTAS_PROCESS_ID, CONSULTAS_ROUTE, TITULO),
    parameterFields: [
      { key: 'desde', label: 'Fecha desde', type: 'date', required: true, icon: 'calendar_today', rangeEnd: 'hasta', rangeLabel: 'Fecha', noFuture: true, minDate: FECHA_MINIMA_CONSULTA },
      { key: 'hasta', label: 'Fecha hasta', type: 'date', required: true, icon: 'event', noFuture: true, minDate: FECHA_MINIMA_CONSULTA, minDateFrom: 'desde' },
      { key: 'tipoOperacion', label: 'Tipo de operación', type: 'select-multiple', icon: 'calculate', options: TIPOS_OPERACION },
      { key: 'cuentaBancaria', label: 'Cuenta bancaria', type: 'select-multiple', required: true, icon: 'account_balance_wallet', options: CUENTAS_BANCARIAS_REGISTRO },
      { key: 'entidad', label: 'Entidad', type: 'select-multiple', icon: 'account_balance', options: ENTIDADES },
      { key: 'unidadEjecutora', label: 'Unidad ejecutora', type: 'select-multiple', icon: 'business', options: UNIDADES_EJECUTORAS },
      { key: 'beneficiario', label: 'Beneficiario', type: 'select-multiple', icon: 'groups', options: BENEFICIARIOS },
    ],
    advancedFilterFields: [
      { key: 'fechaAcreditacion', label: 'Fecha de acreditación', type: 'date', noFuture: true, groupable: true, groupableIn: ['agrupado'], hidesColumns: ['fecha'], groupLabelPrefix: 'Fecha' },
      { key: 'beneficiario', label: 'Beneficiario', groupable: true, groupLabelPrefix: 'Benef.', groupSubtitleColumn: 'cuentaRegistroResumen', hidesGroups: GRUPOS_ASOCIADOS, valueDetails: DETALLE_BENEFICIARIO },
      { key: 'numeroCuentaRegistro', label: 'Cuenta de registro', groupable: true, groupLabelPrefix: 'CR', hidesGroups: GRUPOS_ASOCIADOS, valueDetails: {} },
      { key: 'tipoOperacion', label: 'Tipo de operación', groupable: true, groupLabelPrefix: 'Op.', hidesColumns: ['tipoOperacion'], valueDetails: DETALLE_TIPO_OPERACION },
      {
        key: 'entidad',
        label: 'Entidad',
        groupable: true,
        hierarchy: 1,
        hidesColumns: ['entidad'],
        groupLabelPrefix: 'Ent.',
        valueDetails: {
          MEF: { title: 'Ministerio de Economía y Finanzas', description: '111110009000' },
          IPD: { title: 'Instituto Peruano del Deporte', description: '111110193994' },
          MINCETUR: { title: 'Ministerio de Comercio Exterior y Turismo', description: '111111070000' },
        },
      },
      { key: 'unidadEjecutora', label: 'Unidad ejecutora', groupable: true, hierarchy: 2, hidesColumns: ['unidadEjecutora'], groupLabelPrefix: 'UE.' },
      { key: 'grupo', label: 'Grupo', groupable: true, groupLabelPrefix: 'Grupo', hidesColumns: ['grupo'], valueDetails: {} },
      { key: 'ffSubFf', label: 'Fuente de financiamiento', pluralLabel: 'Fuentes de financiamiento', groupable: true, groupLabelPrefix: 'FF/SUB FF', groupLabelTooltip: 'Fuente / Sub fuente de financiamiento', hidesColumns: ['ffSubFf'], valueDetails: {} },
      { key: 'numeroDocumento', label: 'Documento' },
    ],
    groupAggregation: { runningBalance: { startColumn: 'saldoInicial', endColumn: 'saldoFinal' }, accountColumn: 'numeroCuentaRegistro', openingCreditColumn: 'creditoSaldoInicial', consolidate: {
        sumColumns: [
          { column: 'debito' },
          { column: 'credito', excludeColumn: 'creditoSaldoInicial' },
          { column: 'debitoMN' },
          { column: 'creditoMN', excludeColumn: 'creditoSaldoInicialMN' },
        ],
        startColumns: [
          { column: 'saldoInicial', openingColumn: 'creditoSaldoInicial' },
          { column: 'saldoInicialMN', openingColumn: 'creditoSaldoInicialMN' },
        ],
        endColumns: ['saldoFinal', 'saldoFinalMN'],
      }, hiddenColumns: ['saldoDisponible', 'saldoDisponibleMN', 'sec', 'fecha', 'tipoOperacion', 'entidad', 'unidadEjecutora', 'grupo', 'numeroDocumento', 'descripcionDocumento', 'fechaRegistro', 'numeroOperacion', 'tipoBeneficiario', 'entidadAdministradoraCodigo', 'entidadAdministradoraSigla', 'movimientoInternoCodigo', 'movimientoInternoDescripcion', 'movimientoInternoSigla', 'movimientoExternoCodigo', 'movimientoExternoDescripcion', 'documentoCutNumero', 'documentoCutArchivo', 'documentoCutSigla', 'descripcionDetallada'] },
    columns: COLUMNAS_REGISTRO_LIBRETAS,
    // RF-07: la búsqueda sale sola desde 3 caracteres, con resultados preliminares por ocurrencia.
    searchMinChars: 3,
    columnsPanel: {
      baseGroups: ['Acreditación', 'Beneficiario', 'Cuenta de registro', 'Imp. m. cuenta'],
      groupLabels: { 'Imp. m. cuenta': 'Importe en moneda de la cuenta', 'Imp. m. nacional': 'Importe en moneda nacional' },
    },
    rowKey: 'id',
    resultTitle: 'Resultado de reporte',
    tableLabel: TITULO,
    // La tabla solo se exporta a Excel: CSV y PDF no distinguen los grupos de columnas. «PDF de gráficas» solo sale en la vista de gráficas.
    exportFormats: ['excel', 'graficas'],
    presetFilters: [
      { key: 'numeroCuentaRegistro', label: 'Cuenta de registro', options: [] },
      { key: 'entidad', label: 'Entidad', options: ENTIDADES },
    ],
    /** Vista de gráficas (Figma nodo 6091:81845), con las filas que quedan tras buscar y filtrar en la vista de datos. */
    charts: {
      kpis: [
        { title: 'Total créditos', icon: 'add_circle', tone: 'success', column: 'credito', prefix: SIMBOLO_MONEDA.PEN },
        { title: 'Total débitos', icon: 'remove_circle', tone: 'danger', column: 'debito', prefix: SIMBOLO_MONEDA.PEN },
        { title: 'Saldo inicial', icon: 'account_balance_wallet', tone: 'warning', column: 'saldoInicial', aggregate: 'first', prefix: SIMBOLO_MONEDA.PEN },
        { title: 'Saldo final', icon: 'account_balance', tone: 'informative', column: 'saldoFinal', aggregate: 'last', prefix: SIMBOLO_MONEDA.PEN },
      ],
      charts: [
        {
          title: 'Evolución del saldo por período',
          description: 'Saldo de la cuenta bancaria (suma del último saldo de cada cuenta de registro consultada), por hora de acreditación',
          type: 'line',
          groupBy: 'fecha',
          byHour: true,
          column: 'saldoFinal',
          aggregate: 'last',
          combineBy: 'numeroCuentaRegistro',
          combineFrom: 'saldoInicial',
          seriesName: 'Saldo final',
        },
        {
          title: 'Distribución por tipo de operación',
          description: 'Cantidad de movimientos de cada tipo de operación',
          type: 'donut',
          groupBy: 'tipoOperacionCorto',
          aggregate: 'count',
          seriesName: 'Movimientos',
          width: 'narrow',
        },
      ],
    },
  });

  consultar(parametros: QueryReportParameters): void {
    const desde = String(parametros['desde'] ?? '');
    const hasta = String(parametros['hasta'] ?? '');
    const tiposOperacion = (parametros['tipoOperacion'] as string[] | undefined) ?? [];
    const cuentasSeleccionadas = (parametros['cuentaBancaria'] as string[] | undefined) ?? [];
    const entidades = (parametros['entidad'] as string[] | undefined) ?? [];
    const unidadesEjecutoras = (parametros['unidadEjecutora'] as string[] | undefined) ?? [];
    const beneficiarios = (parametros['beneficiario'] as string[] | undefined) ?? [];

    this.cargando.set(true);
    // El período, las cuentas y los demás filtros los resuelve el servidor.
    // Los saldos de la cuenta bancaria son los de toda su libreta: no dependen del período ni de los demás filtros.
    forkJoin({
      filtrados: this.api.listarMovimientos({ desde, hasta, cuentasBancarias: cuentasSeleccionadas, tiposOperacion, entidades, unidadesEjecutoras, beneficiarios }),
      saldos: this.api.listarSaldosCuentasBancarias(),
    }).subscribe({
      next: ({ filtrados, saldos }) => {
        this.saldosCuentas = new Map(saldos.map((x) => [x.cuentaBancariaId, x]));
        const idsConPestana = cuentasSeleccionadas.length ? cuentasSeleccionadas : [...new Set(filtrados.map((m) => m.cuentaBancariaId))];
        const tabs: TabItem[] = idsConPestana.map((id) => ({ id, label: nombreCuentaBancaria(id) }));

        this.saldosMN = saldosMNPorMovimiento(filtrados, tipoCambioDeMovimiento);
        this.filasPorCuenta = new Map(idsConPestana.map((id) => [id, filtrados.filter((m) => m.cuentaBancariaId === id)]));
        this.config.update((actual) => ({ ...actual, tabs }));
        this.mostrarPestana(idsConPestana[0] ?? '');
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  /** Cuenta bancaria de la pestaña que se está viendo: el PDF de gráficas exporta esa. */
  private cuentaActivaId = '';

  mostrarPestana(cuentaId: string): void {
    this.cuentaActivaId = cuentaId;
    const filas = this.filasPorCuenta.get(cuentaId) ?? [];
    const cuenta = CUENTAS_BANCARIAS_INFO.find((c) => c.id === cuentaId);
    const delServidor = this.saldosCuentas.get(cuentaId);
    const saldosCuenta = delServidor ?? saldosPorCuentaRegistro(filas);

    // Tipo de cambio e importe en moneda nacional solo interesan en la cuenta en dólares: en soles no hay nada que
    // convertir. Se muestran solos al entrar a esa pestaña, sin que el usuario tenga que ir a «Columnas visibles».
    const enDolares = cuenta?.moneda === 'USD';
    const simbolo = SIMBOLO_MONEDA[enDolares ? 'USD' : 'PEN'];
    this.config.update((actual) => ({
      ...actual,
      columns: actual.columns.map((c) => (COLUMNAS_MONEDA_EXTRANJERA.has(c.key) ? { ...c, hiddenByDefault: !enDolares } : c)),
      charts: actual.charts && {
        ...actual.charts,
        kpis: actual.charts.kpis.map((kpi) => (kpi.prefix ? { ...kpi, prefix: simbolo } : kpi)),
      },
    }));

    this.resultado.set({
      rows: filas.map((m) => this.aFila(m)),
      summary: cuenta
        ? {
            label: 'Cuenta bancaria',
            icon: 'account_balance_wallet',
            title: cuenta.nombre,
            description: `${cuenta.numeroCuenta} - ${cuenta.moneda}`,
            fields: [
              { label: 'Saldo inicial', value: monto(saldosCuenta.saldoInicial) },
              { label: 'Saldo final', value: monto(saldosCuenta.saldoFinal) },
            ],
          }
        : null,
      // Los KPI son de toda la cuenta bancaria, sin importar parámetros ni filtros; los gráficos sí siguen lo consultado.
      kpiValues: delServidor
        ? { credito: delServidor.totalCreditos, debito: delServidor.totalDebitos, saldoInicial: delServidor.saldoInicial, saldoFinal: delServidor.saldoFinal }
        : undefined,
    });
  }

  guardarFavoritosDelReporte(lista: QueryReportFavorite[]): void {
    this.favoritos.set(lista);
    guardarFavoritos(PROCESS_ROUTE, lista);
  }

  /** La tabla solo exporta a Excel (`exportFormats: ['excel', 'graficas']`): la plantilla «Resumen» + «Resultado N», una
   *  pestaña por cada cuenta bancaria consultada, con todas sus filas (no solo las de la pestaña activa) tras las
   *  condiciones y filtros de la pantalla. Con un agrupado o agregado aplicado, cada pestaña sale con esa estructura. */
  async exportar(evento: QueryReportExportEvent): Promise<void> {
    if (evento.format === 'graficas') {
      await this.exportarGraficas(evento);
      return;
    }
    const todas = [...this.filasPorCuenta.values()].flat();
    const permitidas = new Set(evento.filterRows(todas.map((m) => this.aFila(m))).map((fila) => fila['id']));
    const cuentas = [...this.filasPorCuenta.entries()]
      .map(([id, movimientos]) => ({ id, movimientos: movimientos.filter((m) => permitidas.has(m.id)), saldos: this.saldosCuentas.get(id) }))
      .filter((cuenta) => cuenta.movimientos.length);
    const { resultType, levels } = evento.advanced;
    // Número y descripción del documento van ocultos por defecto en la tabla: el Excel los trae solo si se habilitan.
    const documento = {
      numero: evento.visibleColumns.includes('numeroDocumento'),
      descripcion: evento.visibleColumns.includes('descripcionDocumento'),
    };
    const sinDocumento = [...(documento.numero ? [] : ['numeroDocumento']), ...(documento.descripcion ? [] : ['descripcionDocumento'])];
    const agrupacion = levels.length
      ? {
          tipo: resultType,
          niveles: evento.levels,
          columnasOcultas: [...new Set([...evento.hiddenColumns, ...sinDocumento])],
          gruposOcultos: evento.hiddenGroups,
        }
      : undefined;
    // Armar el Excel es casi instantáneo: se le da un mínimo de tiempo visible al snackbar para que alcance a leerse.
    this.preparandoExportacion.set(true);
    try {
      const minimoVisible = new Promise((resuelve) => setTimeout(resuelve, 1200));
      await Promise.all([exportarConsultaExcel(evento.parameters, cuentas, agrupacion, documento), minimoVisible]);
    } finally {
      this.preparandoExportacion.set(false);
    }
  }

  /** «PDF de gráficas»: las gráficas de la vista, con los parámetros aplicados y las tarjetas KPI, en un PDF. */
  private async exportarGraficas(evento: QueryReportExportEvent): Promise<void> {
    this.preparandoExportacion.set(true);
    try {
      const minimoVisible = new Promise((resuelve) => setTimeout(resuelve, 1200));
      // Cada pestaña es una cuenta bancaria (soles o dólares): el PDF lleva una hoja por pestaña, con su cuenta y su moneda.
      const paginas = (evento.tabs ?? []).map((tab) => {
        const cuenta = CUENTAS_BANCARIAS_INFO.find((c) => c.id === tab.id);
        const moneda = cuenta ? (cuenta.moneda === 'USD' ? 'Dólares' : 'Soles') : '';
        const parametros = (evento.appliedParameters ?? []).map((p) =>
          cuenta && p.label === 'Cuenta bancaria' ? { label: p.label, value: `${cuenta.numeroCuenta} - ${cuenta.nombre}` } : p,
        );
        return {
          etiqueta: moneda,
          parametros: cuenta ? [...parametros, { label: 'Moneda', value: `${moneda} (${cuenta.moneda})` }] : parametros,
          kpis: tab.kpis,
          graficas: tab.charts,
        };
      });
      const [{ blob, nombre }] = await Promise.all([generarPdfGraficas({ titulo: TITULO, paginas }), minimoVisible]);
      descargar(blob, nombre);
    } finally {
      this.preparandoExportacion.set(false);
    }
  }

  /** El número del documento del registro lleva a su documento (el de «Documentos y registros»), en una pestaña nueva. */
  abrirDocumento(fila: QueryReportRow): void {
    const numero = fila['numeroDocumento'];
    if (!numero) return;
    const url = this.location.prepareExternalUrl(this.router.serializeUrl(this.router.createUrlTree([DOCUMENTO_ROUTE, numero])));
    window.open(url, '_blank', 'noopener');
  }

  private aFila(m: MovimientoLibretaRegistro): QueryReportRow {
    return filaMovimiento(m, this.saldosMN.get(claveMovimiento(m)));
  }
}
