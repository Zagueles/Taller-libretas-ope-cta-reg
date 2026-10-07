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
import { PROCESS_ID, PROCESS_ROUTE, REGISTRO_ROUTE } from '../../config/registro-libretas.rutas';
import { RegistroLibretasApiService } from '../../api/registro-libretas-api.service';
import { DetalleDocumentoLibreta, nombreBeneficiario } from '../../models/registro-libretas.model';
import { generarPdfDocumento } from '../../utils/registro-libretas-export.util';

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

const COLUMNAS: ReportTableColumn[] = [
  { key: 'sec', label: 'Sec.', group: 'Acreditación', width: 90 },
  { key: 'fecha', label: 'Fecha', group: 'Acreditación', width: 130 },
  { key: 'codigo', label: 'Código', group: 'Beneficiario', width: 90 },
  { key: 'beneficiario', label: 'Descripción', group: 'Beneficiario', width: 230 },
  { key: 'numeroCuenta', label: 'Número', group: 'Cuenta de registro', width: 300 },
  { key: 'descripcionCuenta', label: 'Descripción', group: 'Cuenta de registro', width: 320 },
  { key: 'saldoInicial', label: 'Saldo inicial', group: 'Imp. m. cuenta', align: 'right', width: 120 },
  { key: 'debito', label: 'Débito', group: 'Imp. m. cuenta', align: 'right', width: 110 },
  { key: 'credito', label: 'Crédito', group: 'Imp. m. cuenta', align: 'right', width: 110 },
  { key: 'saldoFinal', label: 'Saldo final', group: 'Imp. m. cuenta', align: 'right', width: 135, fixed: true },
];

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
            <readonly-field caption="Número de operación" value="12345678" />
            <readonly-field caption="Tipo de operación" value="1 - Saldos iniciales" />
          </div>
        </siaf-solicitude-form-card>

        <siaf-solicitude-form-card title="Información de la cuenta bancaria">
          <div class="grid gap-siaf-lg md:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Cuenta bancaria del documento">
            @for (cuenta of cuentas; track cuenta.id) {
              <button
                class="relative flex flex-col gap-siaf-xs rounded-siaf-md border p-siaf-md text-left transition focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                type="button"
                role="radio"
                [attr.aria-checked]="cuentaElegida() === cuenta.id"
                [class.border-[var(--sys-color-border-states-active)]]="cuentaElegida() === cuenta.id"
                [class.bg-[var(--sys-color-bg-states-light-selected)]]="cuentaElegida() === cuenta.id"
                [class.border-[var(--sys-color-border-states-enabled)]]="cuentaElegida() !== cuenta.id"
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
              moreLabel="Columnas visibles"
              (valueChange)="busqueda.set($any($event))"
              (filter)="abrirFiltros()"
              (more)="panelColumnasAbierto.set(true)"
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

        @if (d.motivoRechazo) {
          <siaf-detail-history-tabs [comentario]="{ label: 'Motivo de rechazo', texto: d.motivoRechazo }" [entries]="historialRechazo()" />
        }

        <siaf-action-tracker
          [summaryItems]="[
            { label: 'Registrado por', actionBy: 'SIAF RP', date: d.fechaRegistro },
            { label: 'Procesado por', actionBy: d.motivoRechazo ? 'No asignado aún' : 'SIAF RP', date: d.motivoRechazo ? 'Fecha y hora no registradas' : d.fechaProcesado }
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
      [grupos]="gruposColumnas"
      [selected]="columnasElegidas()"
      [defaults]="todasLasColumnas"
      [baseKeys]="columnasBase"
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
  readonly columnas = COLUMNAS;

  // ── Columnas visibles (mismo panel que Consultas y reportes) ──
  readonly panelColumnasAbierto = signal(false);
  readonly todasLasColumnas: ReadonlySet<string> = new Set(COLUMNAS.map((c) => c.key));
  /** Si se ocultan todas, queda la secuencia. */
  readonly columnasBase: ReadonlySet<string> = new Set(['sec']);
  readonly columnasElegidas = signal<ReadonlySet<string>>(this.todasLasColumnas);
  readonly columnasVisibles = computed(() => COLUMNAS.filter((c) => this.columnasElegidas().has(c.key)));
  readonly gruposColumnas: ColumnasPanelGrupo[] = [...new Set(COLUMNAS.map((c) => c.group ?? c.key))].map((id) => {
    const columnas = COLUMNAS.filter((c) => (c.group ?? c.key) === id);
    return {
      id,
      label: id === 'Imp. m. cuenta' ? 'Importe en moneda de la cuenta' : id,
      suelta: !columnas[0].group,
      columnas: columnas.map((c) => ({ key: c.key, label: c.label === 'Sec.' ? 'Secuencia' : c.label })),
    };
  });

  aplicarColumnas(elegidas: Set<string>): void {
    this.columnasElegidas.set(elegidas);
    this.panelColumnasAbierto.set(false);
    // Un filtro sobre una columna que ya no se ve deja de ofrecerse y de aplicarse.
    this.filtros.update((actual) => actual.filter((f) => elegidas.has(f.campo)));
  }
  readonly cuentaElegida = signal('mef-dgtp-cut');
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
    const motivoRechazo = detalle.documento.motivoRechazo ?? '';
    return {
      numero: detalle.documento.numero,
      estado: detalle.documento.estado,
      motivoRechazo,
      fechaRegistro: `${fechaVisible(primero.fecha)}  18:01:00`,
      fechaProcesado: `${fechaVisible(primero.fecha)}  18:02:00`,
    };
  });

  /** Historial de un documento rechazado: el rechazo automático con su motivo (pestaña «Historial»). */
  readonly historialRechazo = computed<DetailHistoryEntry[]>(() => {
    const d = this.documento();
    const primero = this.movimientos()[0];
    if (!d?.motivoRechazo || !primero) return [];
    return [
      {
        iteracion: 1,
        proceso: 'Creación - Rechazado',
        comentario: 'Comentario',
        descripcion: d.motivoRechazo,
        fecha: fechaVisible(primero.fecha),
        hora: '18:02:00',
        rol: 'Automático',
        usuario: 'SIAF RP',
      },
    ];
  });

  /** Las filas de la cuenta elegida, sin buscar ni filtrar. */
  private readonly filasCuenta = computed<ReportTableRow[]>(() =>
    this.movimientos()
      .filter((m) => m.cuentaBancariaId === this.cuentaElegida())
      .map((m) => ({
        sec: m.sec,
        fecha: fechaHoraVisible(m.fecha),
        codigo: m.beneficiarioCodigo,
        beneficiario: nombreBeneficiario(m.beneficiarioCodigo).toUpperCase(),
        numeroCuenta: m.numeroCuentaRegistro,
        descripcionCuenta: m.descripcionCuentaRegistro,
        saldoInicial: monto(m.saldoInicial),
        debito: monto(m.debito),
        credito: monto(m.credito),
        saldoFinal: monto(m.saldoFinal),
      })),
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
    const tipoDe = (key: string): 'fecha' | 'select' | 'texto' => (key === 'fecha' ? 'fecha' : ['saldoInicial', 'debito', 'credito', 'saldoFinal'].includes(key) ? 'texto' : 'select');
    const grupos = new Map<string, { titulo: string; campos: { key: string; label: string; tipo: 'fecha' | 'select' | 'texto' }[] }>();
    for (const c of this.columnasVisibles()) {
      const titulo = c.group === 'Imp. m. cuenta' ? 'Importe en moneda de la cuenta' : (c.group ?? c.label);
      const grupo = grupos.get(titulo) ?? { titulo, campos: [] };
      grupo.campos.push({ key: c.key, label: c.label === 'Sec.' ? 'Secuencia' : c.label, tipo: tipoDe(c.key) });
      grupos.set(titulo, grupo);
    }
    return [...grupos.values()];
  });

  /** Valores a elegir de cada campo: los que tiene en las filas de la cuenta elegida. */
  readonly valoresPorCampo = computed<Record<string, { label: string; value: string }[]>>(() =>
    Object.fromEntries(
      COLUMNAS.map((c) => {
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
      const label = COLUMNAS.find((c) => c.key === key)?.label ?? key;
      return label === 'Sec.' ? 'Secuencia' : label;
    };
    this.filtros.set(
      Object.entries(this.borradorFiltros())
        .filter(([, valor]) => !!valor)
        .map(([campo, valor]) => ({
          id: `filtro-${++this.secuenciaFiltro}`,
          campo,
          campoLabel: etiqueta(campo),
          condicion: campo === 'fecha' || ['saldoInicial', 'debito', 'credito', 'saldoFinal'].includes(campo) ? 'contains' : 'eq',
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
    const sec = fila['sec'];
    if (sec) void this.router.navigate([REGISTRO_ROUTE, sec]);
  }

  volver(): void {
    volverAlOrigen(this.location, this.router, PROCESS_ROUTE);
  }
}
