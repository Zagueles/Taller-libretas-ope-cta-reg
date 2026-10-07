import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
  TIPOS_OPERACION,
  UNIDADES_EJECUTORAS,
  nombreBeneficiario,
  nombreCuentaBancaria,
  nombreTipoOperacion,
  nombreTipoOperacionCorto,
} from '../../models/registro-libretas.model';

/** Columnas que solo interesan en la cuenta en dólares (tipo de cambio e importe en moneda nacional): visibles por
 *  defecto solo en esa pestaña (Figma nodo 6094:125648); en soles quedan disponibles en «Columnas visibles». */
const COLUMNAS_MONEDA_EXTRANJERA = new Set(['tipoCotizacion', 'tipoCambioCompra', 'tipoCambioVenta', 'saldoInicialMN', 'debitoMN', 'creditoMN', 'saldoFinalMN']);

/** Prefijo de los montos en los KPI de la vista de gráficas, según la moneda de la cuenta bancaria de la pestaña activa. */
const SIMBOLO_MONEDA: Record<'PEN' | 'USD', string> = { PEN: 'S/ ', USD: 'US$ ' };

import { exportarConsultaExcel } from '../../utils/registro-libretas-export.util';

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

const TITULO = 'Consultas y reportes de registro de operaciones en las libretas de las cuentas de registro';

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
      { key: 'desde', label: 'Fecha desde', type: 'date', required: true, icon: 'calendar_today', rangeEnd: 'hasta', rangeLabel: 'Fecha' },
      { key: 'hasta', label: 'Fecha hasta', type: 'date', required: true, icon: 'event' },
      { key: 'tipoOperacion', label: 'Tipo de operación', type: 'select-multiple', icon: 'calculate', options: TIPOS_OPERACION },
      { key: 'cuentaBancaria', label: 'Cuenta bancaria', type: 'select-multiple', required: true, icon: 'account_balance_wallet', options: CUENTAS_BANCARIAS_REGISTRO },
      { key: 'entidad', label: 'Entidad', type: 'select-multiple', icon: 'account_balance', options: ENTIDADES },
      { key: 'unidadEjecutora', label: 'Unidad ejecutora', type: 'select-multiple', icon: 'business', options: UNIDADES_EJECUTORAS },
      { key: 'beneficiario', label: 'Beneficiario', type: 'select-multiple', icon: 'groups', options: BENEFICIARIOS },
    ],
    advancedFilterFields: [
      { key: 'fechaAcreditacion', label: 'Fecha de acreditación', type: 'date', groupable: true, groupableIn: ['agrupado'], hidesColumns: ['fecha'], groupLabelPrefix: 'Fecha' },
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
      { key: 'ffSubFf', label: 'FF/Sub FF', groupable: true, groupLabelPrefix: 'FF', hidesColumns: ['ffSubFf'], valueDetails: {} },
      { key: 'numeroDocumento', label: 'Documento' },
    ],
    groupAggregation: { runningBalance: { startColumn: 'saldoInicial', endColumn: 'saldoFinal' }, hiddenColumns: ['sec', 'fecha', 'tipoOperacion', 'entidad', 'unidadEjecutora', 'grupo', 'numeroDocumento', 'descripcionDocumento'] },
    columns: [
      { key: 'sec', label: 'Sec.', panelLabel: 'Secuencia', group: 'Acreditación', width: 90 },
      { key: 'fecha', label: 'Fecha', group: 'Acreditación', width: 130 },
      { key: 'beneficiarioCodigo', label: 'Código', group: 'Beneficiario', width: 90 },
      { key: 'beneficiario', label: 'Descripción', group: 'Beneficiario', width: 230 },
      { key: 'numeroCuentaRegistro', label: 'Número', group: 'Cuenta de registro', width: 300 },
      { key: 'descripcionCuentaRegistro', label: 'Descripción', group: 'Cuenta de registro', width: 320 },
      { key: 'ffSubFf', label: 'FF/SUB FF', group: 'Cuenta de registro', width: 260, ungroupWhenGroupHidden: true },
      { key: 'tipoOperacion', label: 'Tipo de operación', width: 190 },
      { key: 'entidad', label: 'Entidad', group: 'Ámbito institucional', width: 110 },
      { key: 'unidadEjecutora', label: 'Unidad ejecutora', group: 'Ámbito institucional', width: 190 },
      { key: 'grupo', label: 'Grupo', group: 'Ámbito institucional', width: 160 },
      { key: 'tipoCotizacion', label: 'Tipo de cotiz.', panelLabel: 'Tipo de cotización', group: 'Tipo de cambio', hiddenByDefault: true, width: 160 },
      { key: 'tipoCambioCompra', label: 'Compra', group: 'Tipo de cambio', hiddenByDefault: true, align: 'right', width: 110 },
      { key: 'tipoCambioVenta', label: 'Venta', group: 'Tipo de cambio', hiddenByDefault: true, align: 'right', width: 110 },
      { key: 'saldoInicial', label: 'Saldo inicial', group: 'Imp. m. cuenta', align: 'right', width: 120 },
      { key: 'debito', label: 'Débito', group: 'Imp. m. cuenta', align: 'right', width: 110 },
      { key: 'credito', label: 'Crédito', group: 'Imp. m. cuenta', align: 'right', width: 110 },
      { key: 'saldoInicialMN', label: 'Saldo inicial', group: 'Imp. m. nacional', hiddenByDefault: true, align: 'right', width: 130 },
      { key: 'debitoMN', label: 'Débito', group: 'Imp. m. nacional', hiddenByDefault: true, align: 'right', width: 120 },
      { key: 'creditoMN', label: 'Crédito', group: 'Imp. m. nacional', hiddenByDefault: true, align: 'right', width: 130 },
      { key: 'saldoFinalMN', label: 'Saldo final', group: 'Imp. m. nacional', hiddenByDefault: true, align: 'right', width: 140 },
      { key: 'numeroDocumento', label: 'Número', group: 'Documento', width: 150, kind: 'link' },
      { key: 'descripcionDocumento', label: 'Descripción', group: 'Documento', width: 300 },
      { key: 'saldoFinal', label: 'Saldo final', group: 'Imp. m. cuenta', align: 'right', width: 135, fixed: true },
    ],
    columnsPanel: {
      baseGroups: ['Acreditación', 'Beneficiario', 'Cuenta de registro', 'Imp. m. cuenta'],
      groupLabels: { 'Imp. m. cuenta': 'Importe en moneda de la cuenta', 'Imp. m. nacional': 'Importe en moneda nacional' },
    },
    rowKey: 'sec',
    resultTitle: 'Resultado de reporte',
    tableLabel: TITULO,
    // Este reporte solo se exporta a Excel: CSV y PDF no distinguen los grupos de columnas de la tabla.
    exportFormats: ['excel'],
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
          description: 'Saldo final de la cuenta, por hora de acreditación',
          type: 'line',
          groupBy: 'fecha',
          byHour: true,
          column: 'saldoFinal',
          aggregate: 'last',
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
    this.api
      .listarMovimientos({ desde, hasta, cuentasBancarias: cuentasSeleccionadas, tiposOperacion, entidades, unidadesEjecutoras, beneficiarios })
      .subscribe({
      next: (filtrados) => {
        const idsConPestana = cuentasSeleccionadas.length ? cuentasSeleccionadas : [...new Set(filtrados.map((m) => m.cuentaBancariaId))];
        const tabs: TabItem[] = idsConPestana.map((id) => ({ id, label: nombreCuentaBancaria(id) }));

        this.filasPorCuenta = new Map(idsConPestana.map((id) => [id, filtrados.filter((m) => m.cuentaBancariaId === id)]));
        this.config.update((actual) => ({ ...actual, tabs }));
        this.mostrarPestana(idsConPestana[0] ?? '');
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  mostrarPestana(cuentaId: string): void {
    const filas = this.filasPorCuenta.get(cuentaId) ?? [];
    const cuenta = CUENTAS_BANCARIAS_INFO.find((c) => c.id === cuentaId);

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
              { label: 'Saldo inicial', value: monto(cuenta.saldoInicial) },
              { label: 'Saldo final', value: monto(cuenta.saldoFinal) },
            ],
          }
        : null,
    });
  }

  guardarFavoritosDelReporte(lista: QueryReportFavorite[]): void {
    this.favoritos.set(lista);
    guardarFavoritos(PROCESS_ROUTE, lista);
  }

  /** Esta pantalla solo exporta a Excel (`exportFormats: ['excel']`): la plantilla «Resumen» + «Resultado N», una
   *  pestaña por cada cuenta bancaria consultada, con todas sus filas (no solo las de la pestaña activa) tras las
   *  condiciones y filtros de la pantalla. Con un agrupado o agregado aplicado, cada pestaña sale con esa estructura. */
  async exportar(evento: QueryReportExportEvent): Promise<void> {
    const todas = [...this.filasPorCuenta.values()].flat();
    const permitidas = new Set(evento.filterRows(todas.map((m) => this.aFila(m))).map((fila) => fila['sec']));
    const cuentas = [...this.filasPorCuenta.entries()]
      .map(([id, movimientos]) => ({ id, movimientos: movimientos.filter((m) => permitidas.has(m.sec)) }))
      .filter((cuenta) => cuenta.movimientos.length);
    const { resultType, levels } = evento.advanced;
    const agrupacion = levels.length
      ? { tipo: resultType, niveles: evento.levels, columnasOcultas: evento.hiddenColumns, gruposOcultos: evento.hiddenGroups }
      : undefined;
    // Armar el Excel es casi instantáneo: se le da un mínimo de tiempo visible al snackbar para que alcance a leerse.
    this.preparandoExportacion.set(true);
    try {
      const minimoVisible = new Promise((resuelve) => setTimeout(resuelve, 1200));
      await Promise.all([exportarConsultaExcel(evento.parameters, cuentas, agrupacion), minimoVisible]);
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
    // Cuentas en dólares: el importe en moneda nacional es el importe por el tipo de cambio (dato de ejemplo).
    // Tipo de cambio SUNAT del día (Compra/Venta), solo relevante para la cuenta en dólares; el sol se convierte 1 a 1.
    const enDolares = CUENTAS_BANCARIAS_INFO.find((c) => c.id === m.cuentaBancariaId)?.moneda === 'USD';
    const tipoCambioCompra = enDolares ? 3.35 : 1;
    const tipoCambioVenta = enDolares ? 3.32 : 1;
    const tipoCambio = tipoCambioVenta;
    return {
      sec: m.sec,
      fecha: fechaHoraVisible(m.fecha),
      /** Solo para «Filtros avanzados» (Fecha de acreditación): comparable como aaaa-mm-dd, a diferencia de `fecha`, que ya viene formateada para mostrarse. */
      fechaAcreditacion: m.fecha.slice(0, 10),
      beneficiarioCodigo: m.beneficiarioCodigo,
      beneficiario: nombreBeneficiario(m.beneficiarioCodigo),
      numeroCuentaRegistro: m.numeroCuentaRegistro,
      descripcionCuentaRegistro: m.descripcionCuentaRegistro,
      /** Solo para el subtítulo del grupo «Benef.» en Agrupado/Agregado (Figma nodo 5960:44051). */
      cuentaRegistroResumen: `CR: ${m.numeroCuentaRegistro} - ${m.descripcionCuentaRegistro}`,
      ffSubFf: m.ffSubFf,
      tipoOperacion: nombreTipoOperacion(m.tipoOperacionCodigo),
      tipoOperacionCorto: nombreTipoOperacionCorto(m.tipoOperacionCodigo),
      entidad: m.entidad,
      unidadEjecutora: m.unidadEjecutora,
      grupo: m.grupo,
      saldoInicial: monto(m.saldoInicial),
      debito: monto(m.debito),
      credito: monto(m.credito),
      numeroDocumento: m.numeroDocumento,
      documentoId: m.documentoId,
      descripcionDocumento: m.descripcionDocumento,
      saldoFinal: monto(m.saldoFinal),
      tipoCotizacion: '1. Compra / Venta',
      tipoCambioCompra: tipoCambioCompra.toFixed(2),
      tipoCambioVenta: tipoCambioVenta.toFixed(2),
      saldoInicialMN: monto(m.saldoInicial * tipoCambio),
      debitoMN: monto(m.debito * tipoCambio),
      creditoMN: monto(m.credito * tipoCambio),
      saldoFinalMN: monto(m.saldoFinal * tipoCambio),
    };
  }
}
