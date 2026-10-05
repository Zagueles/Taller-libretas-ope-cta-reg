import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

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
import { TabsComponent, TabItem } from '../../../../../shared/ui/tabs/tabs.component';
import { SnackbarComponent } from '../../../../../shared/ui/snackbar/snackbar.component';
import { volverAlOrigen } from '../../../../../shared/utils/volver.util';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { PROCESS_ID, PROCESS_ROUTE } from '../../config/registro-libretas.rutas';
import { DOCUMENTOS_RECHAZADOS, movimientosDeDocumento, nombreBeneficiario } from '../../models/registro-libretas.model';
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
    TabsComponent,
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
          <siaf-form-table-search [value]="busqueda()" (valueChange)="busqueda.set($any($event))" />
          <siaf-report-table [columns]="columnas" [rows]="filas()" rowKey="sec" ariaLabel="Registros de operaciones en las libretas del documento" />
        </siaf-solicitude-form-card>

        @if (d.motivoRechazo) {
          <section class="overflow-hidden rounded-siaf-md bg-surface">
            <siaf-tabs [tabs]="pestanas" [activeId]="pestana()" (activeIdChange)="pestana.set($event)" ariaLabel="Detalle e historial del documento" />
            @if (pestana() === 'detalle') {
              <div class="flex flex-col gap-siaf-xs p-siaf-lg" data-detalle-rechazo>
                <span class="text-xs uppercase tracking-[0.66px] text-[var(--sys-color-text-neutral-medium)]">Motivo de rechazo</span>
                <p class="m-0 text-base text-[var(--sys-color-text-neutral-high)]">{{ d.motivoRechazo }}</p>
              </div>
            } @else {
              <div class="flex flex-col gap-siaf-md p-siaf-lg" data-historial-rechazo>
                <h3 class="m-0 text-base font-bold uppercase text-[var(--sys-color-text-neutral-high)]">Historial de comentarios y detalles</h3>
                <siaf-report-table [columns]="columnasHistorial" [rows]="filasHistorial()" rowKey="iteracion" ariaLabel="Historial de comentarios y detalles del documento" />
              </div>
            }
          </section>
        }

        <siaf-action-tracker
          [summaryItems]="[
            { label: 'Registrado por', actionBy: 'SIAF RP', date: d.fechaRegistro },
            { label: 'Procesado por', actionBy: d.motivoRechazo ? 'No asignado aún' : 'SIAF RP', date: d.motivoRechazo ? 'Fecha y hora no registradas' : d.fechaProcesado }
          ]"
        />
      }
    </siaf-solicitude-page-layout>

    <div class="fixed bottom-siaf-lg left-1/2 z-50 w-[min(430px,calc(100vw-32px))] -translate-x-1/2">
      <siaf-snackbar [open]="preparandoDescarga()" tone="neutral" [dismissible]="false" message="Preparando archivo para descargar" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroLibretasDocumentoComponent {
  private readonly ruta = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  readonly breadcrumbs = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE);
  readonly cuentas = CUENTAS;
  readonly columnas = COLUMNAS;
  readonly cuentaElegida = signal('mef-dgtp-cut');
  readonly busqueda = signal('');
  readonly preparandoDescarga = signal(false);
  readonly pestana = signal('detalle');
  readonly pestanas: TabItem[] = [
    { id: 'detalle', label: 'Detalle' },
    { id: 'historial', label: 'Historial' },
  ];
  readonly columnasHistorial: ReportTableColumn[] = [
    { key: 'iteracion', label: 'Iteración', width: 100 },
    { key: 'proceso', label: 'Proceso', width: 180 },
    { key: 'tipo', label: 'Comentario / Motivo', width: 200 },
    { key: 'descripcion', label: 'Descripción', width: 420 },
    { key: 'fecha', label: 'Fecha', width: 160 },
    { key: 'rol', label: 'Rol', width: 130 },
    { key: 'usuario', label: 'Usuario', width: 130 },
  ];

  private readonly movimientos = computed(() => {
    const numero = this.ruta.snapshot.paramMap.get('numero');
    return movimientosDeDocumento(numero ?? '');
  });

  readonly documento = computed(() => {
    const primero = this.movimientos()[0];
    if (!primero) return null;
    const motivoRechazo = DOCUMENTOS_RECHAZADOS[primero.numeroDocumento] ?? '';
    return {
      numero: primero.numeroDocumento,
      estado: motivoRechazo ? ('Rechazado' as const) : ('Procesado' as const),
      motivoRechazo,
      fechaRegistro: `${fechaVisible(primero.fecha)}  18:01:00`,
      fechaProcesado: `${fechaVisible(primero.fecha)}  18:02:00`,
    };
  });

  /** Historial de un documento rechazado: el rechazo automático con su motivo. */
  readonly filasHistorial = computed<ReportTableRow[]>(() => {
    const d = this.documento();
    if (!d?.motivoRechazo) return [];
    return [{ iteracion: '1', proceso: 'Creación - Rechazado', tipo: 'Comentario', descripcion: d.motivoRechazo, fecha: d.fechaProcesado, rol: 'Automático', usuario: 'SIAF RP' }];
  });

  readonly filas = computed<ReportTableRow[]>(() => {
    const termino = normalizar(this.busqueda().trim());
    return this.movimientos()
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
      }))
      .filter((f) => !termino || Object.values(f).some((v) => normalizar(v).includes(termino)));
  });

  /** Descarga el PDF del documento (Figma nodo 4990:17215): una hoja apaisada por cada cuenta bancaria referenciada.
   *  Mientras arma el PDF, muestra el snackbar «Preparando archivo para descargar» (Figma nodo 5420:54420); armar el
   *  PDF es casi instantáneo, así que se le pone un mínimo de tiempo visible para que alcance a leerse antes de que
   *  aparezca el diálogo «Guardar como» del navegador. */
  async descargar(): Promise<void> {
    const numero = this.ruta.snapshot.paramMap.get('numero');
    if (!numero) return;
    this.preparandoDescarga.set(true);
    try {
      const minimoVisible = new Promise((resuelve) => setTimeout(resuelve, 1200));
      const [generado] = await Promise.all([generarPdfDocumento(numero), minimoVisible]);
      if (generado) descargarArchivo(generado.blob, generado.nombre);
    } finally {
      this.preparandoDescarga.set(false);
    }
  }

  volver(): void {
    volverAlOrigen(this.location, this.router, PROCESS_ROUTE);
  }
}
