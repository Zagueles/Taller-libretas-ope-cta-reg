import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { DetailHistoryEntry, DetailHistoryTabsComponent } from '../../../../../shared/components/detail-history-tabs/detail-history-tabs.component';
import { FormTableSearchComponent } from '../../../../../shared/components/form-table-search/form-table-search.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { SolicitudeInfoCardComponent } from '../../../../../shared/components/solicitude-info-card/solicitude-info-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { ActionTrackerComponent } from '../../../../../shared/ui/action-tracker/action-tracker.component';
import { AlertComponent } from '../../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import type { IconDropdownMenuItem } from '../../../../../shared/ui/icon-dropdown-menu/icon-dropdown-menu.component';
import { DocumentSummaryCardComponent } from '../../../../../shared/ui/document-summary-card/document-summary-card.component';
import { ReadonlyFieldComponent } from '../../../../../shared/ui/readonly-field/readonly-field.component';
import { ReportTableColumn, ReportTableComponent, ReportTableRow } from '../../../../../shared/ui/report-table/report-table.component';
import { ConsultasFiltrosChipsComponent, FiltroChip } from '../../../../../shared/components/consultas-filtros-chips/consultas-filtros-chips.component';
import { SideNavComponent } from '../../../../../shared/ui/side-nav/side-nav.component';
import { DateTimePickerComponent } from '../../../../../shared/ui/date-time-picker/date-time-picker.component';
import { TextFieldComponent } from '../../../../../shared/ui/text-field/text-field.component';
import { ColumnasPanelGrupo, ReportColumnsPanelComponent } from '../../../../../shared/components/report-columns-panel/report-columns-panel.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { SnackbarComponent } from '../../../../../shared/ui/snackbar/snackbar.component';
import { volverAlOrigen } from '../../../../../shared/utils/volver.util';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { COLUMNAS_REGISTRO_LIBRETAS } from '../../config/registro-libretas-columnas';
import { PROCESS_ID, PROCESS_ROUTE, REGISTRO_ROUTE } from '../../config/registro-libretas.rutas';
import { RegistroLibretasApiService } from '../../api/registro-libretas-api.service';
import { CUENTAS_BANCARIAS_INFO, DetalleDocumentoLibreta, nombreBeneficiario, nombreTipoOperacion } from '../../models/registro-libretas.model';
import { generarPdfDocumento } from '../../utils/exportacion/pdf-documento.util';
import { filaMovimiento } from '../../utils/registro-libretas-fila.util';
import { claveMovimiento, saldosMNPorMovimiento, tipoCambioDeMovimiento } from '../../utils/registro-libretas-saldos.util';

/** Descarga un Blob como archivo. */
function descargarArchivo(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

const formatoMonto = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monto = (valor: number): string => formatoMonto.format(valor);
const fechaVisible = (iso: string): string => iso.slice(0, 10).split('-').reverse().join('/');
const fechaHoraVisible = (iso: string): string => `${fechaVisible(iso)} ${iso.slice(11, 19)}`;
const normalizar = (t: string): string => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Cuentas bancarias del documento, como las muestra el Figma (número completo y moneda). */
const CUENTAS = [
  { id: 'mef-dgtp-cut', nombre: 'MEF - DGTP - CUT', numero: '11040103570200000000', moneda: 'PEN' },
  { id: 'mef-dgtp', nombre: 'MEF - DGTP', numero: '12073303572000000003', moneda: 'USD' },
];

/** Un filtro personalizado aplicado a los registros del documento. */
interface FiltroDocumento {
  id: string;
  campo: string;
  campoLabel: string;
  condicion: string;
  valor: string;
}

/** Nombre completo de los grupos de cabecera abreviados («Imp. m. cuenta» → «Importe en moneda de la cuenta»). */
const etiquetaGrupo = (grupo: string): string => (grupo === 'Imp. m. cuenta' ? 'Importe en moneda de la cuenta' : grupo === 'Imp. m. nacional' ? 'Importe en moneda nacional' : grupo);

/** Las columnas de los registros, las mismas de Consultas y reportes; el documento ya es esta página, así que su grupo no se ofrece. */
const COLUMNAS_DOCUMENTO: ReportTableColumn[] = (() => {
  // De fábrica solo se ven Acreditación, Beneficiario (código y descripción), Cuenta de registro (número y descripción) y los
  // importes en moneda de la cuenta; el resto está disponible en «Columnas visibles».
  const deFabrica = new Set(['sec', 'fecha', 'beneficiarioCodigo', 'beneficiario', 'numeroCuentaRegistro', 'descripcionCuentaRegistro', 'saldoInicial', 'debito', 'credito', 'saldoFinal']);
  return COLUMNAS_REGISTRO_LIBRETAS.filter((c) => c.group !== 'Documento').map((c) => ({ ...c, hiddenByDefault: !deFabrica.has(c.key) }));
})();

/**
 * Vista de un documento de «Documentos y registros» (Figma nodo 6021:56145): documento generado automáticamente por
 * el sistema, en solo lectura. Muestra su fecha, ente rector, número y estado, la información de las operaciones
 * financieras, las cuentas bancarias del documento (al elegir una se ven sus registros) y quién lo registró y
 * procesó. Se abre al pulsar una fila de la pestaña Documentos. Datos simulados.
 */
@Component({
  selector: 'siaf-registro-libretas-documento',
  standalone: true,
  imports: [
    ActionTrackerComponent,
    AlertComponent,
    ButtonComponent,
    DocumentSummaryCardComponent,
    FormTableSearchComponent,
    ReadonlyFieldComponent,
    ReportTableComponent,
    SnackbarComponent,
    SideNavComponent,
    ConsultasFiltrosChipsComponent,
    DateTimePickerComponent,
    TextFieldComponent,
    ReportColumnsPanelComponent,
    IconComponent,
    DetailHistoryTabsComponent,
    SolicitudeFormCardComponent,
    SolicitudeInfoCardComponent,
    SolicitudePageLayoutComponent,
  ],
  template: `
    <siaf-solicitude-page-layout
      [breadcrumbs]="breadcrumbs"
      heading="Registro de operaciones en las libretas de las cuentas de registro"
      secondaryText="Creación"
      [showReturn]="true"
      [showTag]="false"
      [customActions]="true"
      (returned)="volver()"
    >
      <siaf-button actions variant="filled" icon="download" (click)="descargar()">Descargar</siaf-button>

      @if (documento(); as d) {
        <siaf-alert
          tone="info"
          title="Este documento se generó automáticamente"
          description="La información corresponde a las operaciones de las libretas de las cuentas de registro."
        />

        <div class="grid gap-siaf-md lg:grid-cols-[1fr_320px]">
          <siaf-solicitude-info-card
            [fields]="[
              { label: 'Fecha', value: d.fechaRegistro },
              { label: 'Ente rector', value: 'DIRECCIÓN GENERAL DEL TESORO PÚBLICO' }
            ]"
          />
          <siaf-document-summary-card [documentNumber]="d.numero" [status]="d.estado" />
        </div>

        <siaf-solicitude-form-card title="Información de operaciones financieras">
          <div class="grid gap-x-siaf-lg gap-y-siaf-lg md:grid-cols-3">
            <readonly-field caption="Fecha registro" [value]="d.fechaRegistro" />
            <readonly-field caption="Número de operación" [value]="d.numeroOperacion" />
            <readonly-field caption="Tipo de operación" [value]="d.tipoOperacion" />
          </div>
        </siaf-solicitude-form-card>

        <siaf-solicitude-form-card title="Información de la cuenta bancaria">
          <div class="grid gap-siaf-lg md:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Cuenta bancaria del documento">
            @for (cuenta of cuentasDelDocumento(); track cuenta.id) {
              <button
                class="relative flex flex-col gap-siaf-xs rounded-siaf-md border p-siaf-md text-left transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                type="button"
                role="radio"
                [attr.aria-checked]="cuentaActiva() === cuenta.id"
                [class.border-[var(--sys-color-border-states-active)]]="cuentaActiva() === cuenta.id"
                [class.bg-[var(--sys-color-bg-states-light-selected)]]="cuentaActiva() === cuenta.id"
                [class.border-[var(--sys-color-border-states-enabled)]]="cuentaActiva() !== cuenta.id"
                (click)="cuentaElegida.set(cuenta.id)"
              >
                <span class="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-brand-primary" aria-hidden="true"></span>
                <span class="text-sm font-bold text-[var(--sys-color-text-neutral-high)]">{{ cuenta.nombre }}</span>
                <span class="flex justify-between text-sm text-[var(--sys-color-text-neutral-medium)]">
                  <span>{{ cuenta.numero }}</span>
                  <span>{{ cuenta.moneda }}</span>
                </span>
              </button>
            }
          </div>
        </siaf-solicitude-form-card>

        <siaf-solicitude-form-card title="Registros de operaciones en las libretas">
          <div class="relative flex flex-col gap-siaf-md">
            <siaf-form-table-search
              [value]="busqueda()"
              [filterCount]="filtros().length"
              filterLabel="Filtros"
              moreLabel="Más opciones"
              [moreItems]="opcionesMas"
              (valueChange)="busqueda.set($any($event))"
              (filter)="abrirFiltros()"
              (moreSelected)="elegirOpcionMas($event)"
            />

            @if (filtros().length) {
              <siaf-consultas-filtros-chips
                data-filtros-aplicados
                [chips]="chipsFiltros()"
                [removable]="true"
                (removed)="quitarFiltro($event.id ?? '')"
                (cleared)="borrarFiltros()"
              />
            }
          </div>
          <siaf-report-table [columns]="columnasVisibles()" [rows]="filas()" rowKey="sec" [clickableRows]="true" ariaLabel="Registros de operaciones en las libretas del documento" (rowClicked)="abrirRegistro($event)" />
        </siaf-solicitude-form-card>

        @if (d.textoError) {
          <siaf-detail-history-tabs [comentario]="{ label: d.etiquetaError, texto: d.textoError }" [entries]="historialRechazo()" />
        }

        <siaf-action-tracker
          [summaryItems]="[
            { label: 'Registrado por', actionBy: 'SIAF RP', date: d.fechaRegistro },
            { label: 'Procesado por', actionBy: d.textoError ? '' : 'SIAF RP', date: d.textoError ? '' : d.fechaProcesado }
          ]"
        />
      }
    </siaf-solicitude-page-layout>

    <siaf-side-nav
      [open]="filtroAbierto()"
      title="Filtros"
      confirmLabel="Aceptar"
      [confirmDisabled]="!hayCambiosEnFiltros()"
      (closed)="cerrarFiltros()"
      (canceled)="cerrarFiltros()"
      (confirmed)="aceptarFiltros()"
    >
      <div class="flex flex-col gap-siaf-lg" data-filtros-documento>
        @for (grupo of gruposFiltro(); track grupo.titulo) {
          <section class="flex flex-col gap-siaf-md">
            <h3 class="m-0 px-siaf-xs text-sm font-normal uppercase text-[var(--sys-color-text-neutral-high)]">{{ grupo.titulo }}</h3>
            @for (campo of grupo.campos; track campo.key) {
              @if (campo.tipo === 'fecha') {
                <siaf-date-time-picker
                  [label]="campo.label"
                  [fullWidth]="true"
                  [defaultToToday]="false"
                  [value]="borradorFiltros()[campo.key] ?? ''"
                  (valueChange)="cambiarBorrador(campo.key, $event)"
                />
              } @else if (campo.tipo === 'select') {
                <siaf-input
                  type="select"
                  [label]="campo.label"
                  [autoSuccess]="false"
                  [options]="valoresPorCampo()[campo.key] ?? []"
                  [value]="borradorFiltros()[campo.key] ?? ''"
                  (valueChange)="cambiarBorrador(campo.key, '' + $event)"
                />
              } @else {
                <siaf-input
                  [label]="campo.label"
                  [value]="borradorFiltros()[campo.key] ?? ''"
                  (valueChange)="cambiarBorrador(campo.key, '' + $event)"
                />
              }
            }
          </section>
        }
      </div>
    </siaf-side-nav>

    <siaf-report-columns-panel
      [open]="panelColumnasAbierto()"
      [grupos]="gruposColumnas()"
      [selected]="columnasElegidas()"
      [defaults]="todasLasColumnas()"
      [baseKeys]="columnasBase()"
      (closed)="panelColumnasAbierto.set(false)"
      (applied)="aplicarColumnas($event)"
    />

    <div class="fixed bottom-siaf-lg left-1/2 z-50 w-[min(430px,calc(100vw-32px))] -translate-x-1/2">
      <siaf-snackbar [open]="preparandoDescarga()" tone="neutral" [dismissible]="false" message="Preparando archivo para descargar" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroLibretasDocumentoComponent implements OnInit {
  private readonly api = inject(RegistroLibretasApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  readonly breadcrumbs = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE);
  readonly cuentas = CUENTAS;

  // ── Columnas visibles (mismo panel que Consultas y reportes) ──
  readonly panelColumnasAbierto = signal(false);
  /** «Más opciones» abre un menú, igual que en la pestaña Registros: de ahí se llega a «Columnas visibles». */
  readonly opcionesMas: IconDropdownMenuItem[] = [{ label: 'Ocultar o mostrar columnas', value: 'open-columns' }];

  elegirOpcionMas(valor: string): void {
    if (valor === 'open-columns') this.panelColumnasAbierto.set(true);
  }
  readonly columnasCuenta = computed(() => COLUMNAS_DOCUMENTO);
  /** Las que se ven de fábrica (y a las que vuelve «Restablecer»): todas menos las `hiddenByDefault`. */
  readonly todasLasColumnas = computed<ReadonlySet<string>>(() => new Set(this.columnasCuenta().filter((c) => !c.hiddenByDefault).map((c) => c.key)));
  /** Las de fábrica no se pueden ocultar (como en Consultas y reportes): solo se suman las demás. */
  readonly columnasBase = computed<ReadonlySet<string>>(() => this.todasLasColumnas());
  /** Lo que se eligió en el panel; sin elegir, las de fábrica de la cuenta. */
  private readonly columnasEscogidas = signal<ReadonlySet<string> | null>(null);
  readonly columnasElegidas = computed<ReadonlySet<string>>(() => this.columnasEscogidas() ?? this.todasLasColumnas());
  readonly columnasVisibles = computed(() => this.columnasCuenta().filter((c) => this.columnasElegidas().has(c.key)));
  readonly gruposColumnas = computed<ColumnasPanelGrupo[]>(() =>
    [...new Set(this.columnasCuenta().map((c) => c.group ?? c.key))].map((id) => {
      const columnas = this.columnasCuenta().filter((c) => (c.group ?? c.key) === id);
      return {
        id,
        label: columnas[0].group ? etiquetaGrupo(id) : (columnas[0].panelLabel ?? columnas[0].label),
        suelta: !columnas[0].group,
        columnas: columnas.map((c) => ({ key: c.key, label: c.panelLabel ?? c.label })),
      };
    }),
  );

  aplicarColumnas(elegidas: Set<string>): void {
    this.columnasEscogidas.set(elegidas);
    this.panelColumnasAbierto.set(false);
    // Un filtro sobre una columna que ya no se ve deja de ofrecerse y de aplicarse.
    this.filtros.update((actual) => actual.filter((f) => elegidas.has(f.campo)));
  }
  readonly cuentaElegida = signal('mef-dgtp-cut');
  /** Solo las cuentas con operaciones en el documento: sin movimientos en dólares no se ofrece la cuenta en dólares. */
  readonly cuentasDelDocumento = computed(() => {
    const ids = new Set(this.movimientos().map((m) => m.cuentaBancariaId));
    const delDocumento = this.cuentas.filter((c) => ids.has(c.id));
    return delDocumento.length ? delDocumento : this.cuentas;
  });
  /** La cuenta elegida si el documento la tiene; si no, la primera (la única, por defecto ya seleccionada). */
  readonly cuentaActiva = computed(() => {
    const lista = this.cuentasDelDocumento();
    return lista.some((c) => c.id === this.cuentaElegida()) ? this.cuentaElegida() : lista[0].id;
  });
  readonly busqueda = signal('');
  readonly preparandoDescarga = signal(false);
  /** El documento con sus movimientos, tal como lo entrega el backend simulado. */
  private readonly detalle = signal<DetalleDocumentoLibreta | null>(null);
  private readonly movimientos = computed(() => this.detalle()?.movimientos ?? []);

  ngOnInit(): void {
    const numero = this.ruta.snapshot.paramMap.get('numero') ?? '';
    this.api.obtenerDocumento(numero).subscribe({
      next: (detalle) => this.detalle.set(detalle),
      error: () => this.detalle.set(null),
    });
  }

  readonly documento = computed(() => {
    const detalle = this.detalle();
    const primero = this.movimientos()[0];
    if (!detalle || !primero) return null;
    const { codigoError, descripcionError, estado } = detalle.documento;
    const textoError = codigoError ? `${codigoError} - ${descripcionError}` : '';
    return {
      numero: detalle.documento.numero,
      estado: detalle.documento.estado,
      textoError,
      // El pendiente es parecido a una observación: su detalle es un comentario de observación, no un motivo de rechazo.
      etiquetaError: estado === 'Pendiente' ? 'Comentario de observación' : 'Motivo de rechazo',
      fechaRegistro: `${fechaVisible(primero.fecha)}  18:01:00`,
      fechaProcesado: `${fechaVisible(primero.fecha)}  18:02:00`,
      // Operación del documento: la de su primer registro (número y tipo), no un dato fijo.
      numeroOperacion: `1234${primero.id.slice(-4)}`,
      tipoOperacion: nombreTipoOperacion(primero.tipoOperacionCodigo),
    };
  });

  /** Historial de un documento rechazado o pendiente: el resultado automático con su código de error (pestaña «Historial»). */
  readonly historialRechazo = computed<DetailHistoryEntry[]>(() => {
    const d = this.documento();
    const primero = this.movimientos()[0];
    if (!d?.textoError || !primero) return [];
    return [
      {
        iteracion: 1,
        proceso: `Creación - ${d.estado}`,
        comentario: 'Comentario',
        descripcion: d.textoError,
        fecha: fechaVisible(primero.fecha),
        hora: '18:02:00',
        rol: 'Automático',
        usuario: 'SIAF RP',
      },
    ];
  });

  /** Las filas de la cuenta elegida, sin buscar ni filtrar. */
  private readonly saldosMN = computed(() => saldosMNPorMovimiento(this.movimientos(), tipoCambioDeMovimiento));
  private readonly filasCuenta = computed<ReportTableRow[]>(() =>
    this.movimientos()
      .filter((m) => m.cuentaBancariaId === this.cuentaActiva())
      .map((m) => filaMovimiento(m, this.saldosMN().get(claveMovimiento(m)))),
  );

  // ── Filtros personalizados del documento (Campo · Condición · Valor) ──
  readonly filtros = signal<FiltroDocumento[]>([]);
  readonly filtroAbierto = signal(false);
  readonly chipsFiltros = computed<FiltroChip[]>(() => this.filtros().map((f) => ({ id: f.id, label: f.campoLabel, values: [f.valor] })));
  private secuenciaFiltro = 0;
  /** Lo que se va escribiendo en el panel «Filtros» (campo → valor), sin aplicar todavía. */
  readonly borradorFiltros = signal<Record<string, string>>({});

  /** Los campos del panel: las columnas visibles, por grupo; fecha con selector, códigos y descripciones con lista, importes con texto. */
  readonly gruposFiltro = computed(() => {
    const importes = new Set(this.columnasCuenta().filter((c) => c.align === 'right').map((c) => c.key));
    const tipoDe = (key: string): 'fecha' | 'select' | 'texto' => (key === 'fecha' ? 'fecha' : importes.has(key) ? 'texto' : 'select');
    const grupos = new Map<string, { titulo: string; campos: { key: string; label: string; tipo: 'fecha' | 'select' | 'texto' }[] }>();
    for (const c of this.columnasVisibles()) {
      const titulo = c.group ? etiquetaGrupo(c.group) : c.label;
      const grupo = grupos.get(titulo) ?? { titulo, campos: [] };
      grupo.campos.push({ key: c.key, label: c.panelLabel ?? c.label, tipo: tipoDe(c.key) });
      grupos.set(titulo, grupo);
    }
    return [...grupos.values()];
  });

  /** Valores a elegir de cada campo: los que tiene en las filas de la cuenta elegida. */
  readonly valoresPorCampo = computed<Record<string, { label: string; value: string }[]>>(() =>
    Object.fromEntries(
      this.columnasCuenta().map((c) => {
        const valores = [...new Set(this.filasCuenta().map((f) => String(f[c.key] ?? '')).filter(Boolean))];
        return [c.key, valores.map((v) => ({ label: v, value: v }))];
      }),
    ),
  );

  private filtrosComoBorrador(): Record<string, string> {
    return Object.fromEntries(this.filtros().map((f) => [f.campo, f.campo === 'fecha' ? this.aIso(f.valor) : f.valor]));
  }

  readonly hayCambiosEnFiltros = computed(() => {
    const actual = this.filtrosComoBorrador();
    const borrador = Object.fromEntries(Object.entries(this.borradorFiltros()).filter(([, v]) => v));
    return JSON.stringify(Object.entries(actual).sort()) !== JSON.stringify(Object.entries(borrador).sort());
  });

  /** dd/mm/aaaa → aaaa-mm-dd, que es lo que entiende el selector de fecha. */
  private aIso(valor: string): string {
    const [d, m, a] = valor.split('/');
    return a && m && d ? `${a}-${m}-${d}` : '';
  }

  abrirFiltros(): void {
    this.borradorFiltros.set(this.filtrosComoBorrador());
    this.filtroAbierto.set(true);
  }
  cerrarFiltros(): void {
    this.filtroAbierto.set(false);
  }
  cambiarBorrador(campo: string, valor: string): void {
    this.borradorFiltros.update((actual) => ({ ...actual, [campo]: valor }));
  }
  /** «Aceptar»: cada campo con valor pasa a ser un filtro aplicado (la fecha, comparada por su día; los importes, por contenido). */
  aceptarFiltros(): void {
    const etiqueta = (key: string): string => {
      const columna = this.columnasCuenta().find((c) => c.key === key);
      return columna?.panelLabel ?? columna?.label ?? key;
    };
    this.filtros.set(
      Object.entries(this.borradorFiltros())
        .filter(([, valor]) => !!valor)
        .map(([campo, valor]) => ({
          id: `filtro-${++this.secuenciaFiltro}`,
          campo,
          campoLabel: etiqueta(campo),
          condicion: campo === 'fecha' || this.columnasCuenta().some((c) => c.key === campo && c.align === 'right') ? 'contains' : 'eq',
          valor: campo === 'fecha' ? valor.split('-').reverse().join('/') : valor,
        })),
    );
    this.filtroAbierto.set(false);
  }
  quitarFiltro(id: string): void {
    this.filtros.update((actual) => actual.filter((f) => f.id !== id));
  }
  borrarFiltros(): void {
    this.filtros.set([]);
  }

  private cumpleFiltro(fila: ReportTableRow, filtro: FiltroDocumento): boolean {
    const valorFila = String(fila[filtro.campo] ?? '').toLocaleLowerCase();
    const valor = filtro.valor.toLocaleLowerCase();
    switch (filtro.condicion) {
      case 'neq': return valorFila !== valor;
      case 'contains': return valorFila.includes(valor);
      case 'not_contains': return !valorFila.includes(valor);
      case 'starts_with': return valorFila.startsWith(valor);
      case 'ends_with': return valorFila.endsWith(valor);
      default: return valorFila === valor;
    }
  }

  readonly filas = computed<ReportTableRow[]>(() => {
    const termino = normalizar(this.busqueda().trim());
    const filtros = this.filtros();
    return this.filasCuenta()
      .filter((f) => !termino || Object.values(f).some((v) => normalizar(v).includes(termino)))
      .filter((f) => filtros.every((filtro) => this.cumpleFiltro(f, filtro)));
  });

  /** Descarga el PDF del documento (Figma nodo 4990:17215): una hoja apaisada por cada cuenta bancaria referenciada.
   *  Mientras arma el PDF, muestra el snackbar «Preparando archivo para descargar» (Figma nodo 5420:54420); armar el
   *  PDF es casi instantáneo, así que se le pone un mínimo de tiempo visible para que alcance a leerse antes de que
   *  aparezca el diálogo «Guardar como» del navegador. */
  async descargar(): Promise<void> {
    const detalle = this.detalle();
    if (!detalle) return;
    this.preparandoDescarga.set(true);
    try {
      const minimoVisible = new Promise((resuelve) => setTimeout(resuelve, 1200));
      const [generado] = await Promise.all([generarPdfDocumento(detalle), minimoVisible]);
      descargarArchivo(generado.blob, generado.nombre);
    } finally {
      this.preparandoDescarga.set(false);
    }
  }

  /** Pulsar una fila de «Registros de operaciones en las libretas» abre el detalle de ese registro. */
  abrirRegistro(fila: ReportTableRow): void {
    const id = fila['id'];
    if (id) void this.router.navigate([REGISTRO_ROUTE, id]);
  }

  volver(): void {
    volverAlOrigen(this.location, this.router, PROCESS_ROUTE);
  }
}
