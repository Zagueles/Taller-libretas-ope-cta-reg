import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

import type { DocumentsRecordsRow } from '../../types/documents-records.types';
import { SidePanelAnimacion } from '../../ui/side-panel-animacion';
import { ActionTrackerComponent, ActionTrackerSummary } from '../../ui/action-tracker/action-tracker.component';
import { FocoDirective } from '../../ui/foco/foco.directive';
import { IconComponent } from '../../ui/icon/icon.component';
import { RecordStatus, RecordStatusTagComponent } from '../../ui/record-status-tag/record-status-tag.component';
import { StepItem, StepsComponent } from '../../ui/steps/steps.component';
import { TooltipDirective } from '../../ui/tooltip/tooltip.directive';
import { SummaryCardComponent, SummaryCardField } from '../../ui/summary-card/summary-card.component';

type HistoryField = { label: string; value: string };

/** Una operación del libro banco o del registro de operaciones bancarias, lista para la tabla. */
interface OperacionFila {
  sec: string;
  fecha: string;
  numero: string;
  descripcion: string;
  entidad: string;
  debito: string;
  credito: string;
}

interface SustentoFila {
  nro: number;
  tipo: string;
  nombre: string;
  tamano: string;
}

/** Número de una celda de importe («5,068.00» → 5068). */
const aNumero = (texto: string | undefined): number => {
  const numero = parseFloat(String(texto ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(numero) ? numero : 0;
};

const aImporte = (valor: number): string => valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Historial del registro de Conciliación diaria — pestaña Registros (Figma 509:59906).
 *
 * Misma cáscara que `siaf-account-history-panel` (overlay a la derecha, columna de versiones, tarjetas y tracker), con la
 * estructura de la conciliación: el documento, la información y la cuenta bancaria, el registro conciliado o no conciliado
 * (número, origen y motivo de inconsistencia) con las tablas del libro banco y del registro de operaciones bancarias, el
 * documento sustento con su justificación y, al pie, quién elaboró, verificó y aprobó. Todo sale de la fila del registro
 * (`record`): no llama a ninguna API.
 *
 * @usar
 * - Para ver, desde la pestaña Registros de Conciliación diaria (`recordHistoryKind: 'conciliacion'`), cómo quedó un
 *   registro: si concilió o no, por qué no, las operaciones de cada lado, el sustento y quién lo trabajó.
 * - Para un registro de conciliación manual, que además trae sus documentos de sustento y la justificación.
 * @evitar
 * - Para registros del plan de cuentas o asientos de ajuste: usar `siaf-account-history-panel` o
 *   `siaf-asiento-history-panel`; para el historial de estados de un documento, `siaf-document-history-panel`.
 * - Para conciliar un registro: la solicitud de conciliación manual lo hace; este panel es de solo lectura.
 * @teclado
 * - **Tab**: al abrir, el foco entra en la X y da la vuelta sin salir del panel.
 * - **Enter / Espacio** en la X: cierran el panel (emite `closed`).
 * - **Escape**: cierra el panel (emite `closed`) y el foco vuelve al botón de historial.
 * @accesibilidad
 * - **4.1.2 Nombre, función y valor (A)**: es `role="dialog"` con `aria-modal="true"` y nombre desde su título
 *   (`aria-labelledby`); la X se llama «Cerrar historial del registro».
 * - **1.3.1 Información y relaciones (A)**: títulos `h2` y `h3` por sección y tablas con `thead`, `th` con `scope` y
 *   `caption` oculto que las nombra.
 * - **1.4.1 Uso del color (A)**: el estado del registro va en `siaf-record-status-tag`, con ícono y texto.
 * - **1.4.3 Contraste mínimo (AA)**: títulos y valores `text-neutral-high` 16.29:1 (oscuro 16.53:1), etiquetas
 *   `text-neutral-low` 5.01:1 (8.86:1) sobre la superficie.
 * - **2.4.3 Orden del foco (A)**: con `siafFoco`, al abrir lleva el foco a la X y lo retiene en el panel; al cerrar lo
 *   devuelve al botón de historial.
 * - **Pendiente · 2.1.1 Teclado (A)**: el icono de descarga del sustento es solo ilustrativo en el taller: no es un botón.
 */
@Component({
  selector: 'siaf-conciliacion-history-panel',
  standalone: true,
  imports: [ActionTrackerComponent, FocoDirective, IconComponent, NgTemplateOutlet, RecordStatusTagComponent, StepsComponent, SummaryCardComponent, TooltipDirective],
  template: `
    @if (anim.visible()) {
      <section class="siaf-sidepanel-overlay fixed inset-y-0 left-0 right-0 z-50 bg-black/55 pl-0 lg:pl-[65px]" [class.cerrando]="anim.cerrando()" aria-modal="true" role="dialog" aria-labelledby="conciliacion-history-title" (click)="closed.emit()">
        <aside class="flex h-screen w-full flex-col overflow-hidden bg-surface text-text shadow-siaf-lg lg:rounded-l-siaf-md" [siafFoco]="open" (siafFocoEscape)="closed.emit()" (click)="$event.stopPropagation()">
          <header class="flex h-14 shrink-0 items-center gap-siaf-xs px-siaf-md">
            <h2 id="conciliacion-history-title" class="m-0 min-w-0 flex-1 text-base font-bold uppercase leading-normal tracking-[0.02px] text-text">Historial del registro</h2>
            <button class="inline-flex size-10 items-center justify-center rounded-siaf-md text-text transition hover:bg-surface-muted active:bg-[var(--sys-color-bg-states-light-pressed)]" type="button" aria-label="Cerrar historial del registro" (click)="closed.emit()">
              <siaf-icon name="close" [size]="24" />
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto bg-surface">
            <div class="mx-auto grid min-h-full w-full max-w-[1160px] grid-cols-1 gap-[64px] px-siaf-md py-siaf-md sm:px-siaf-xl lg:grid-cols-[210px_minmax(0,890px)] lg:px-0">
              <aside class="hidden lg:block">
                <siaf-steps class="sticky top-siaf-md block" variant="cards" [steps]="versiones" [activeStep]="1" />
              </aside>

              <section class="flex min-w-0 flex-col gap-siaf-sm">
                <section class="rounded-siaf-md border border-[var(--sys-color-divider-strong)] bg-surface px-siaf-lg py-siaf-md">
                  <ng-container [ngTemplateOutlet]="plainField" [ngTemplateOutletContext]="{ field: { label: 'Documento', value: value('document') } }" />
                  <div class="mt-siaf-lg grid gap-siaf-md md:grid-cols-3">
                    <ng-container [ngTemplateOutlet]="plainField" [ngTemplateOutletContext]="{ field: { label: 'Nº documento', value: value('number') } }" />
                    <ng-container [ngTemplateOutlet]="plainField" [ngTemplateOutletContext]="{ field: { label: 'Tipo de acción', value: value('actionType', 'Creación') } }" />
                    <div class="flex min-w-0 flex-col gap-siaf-xxs">
                      <span class="sm:truncate text-[11px] font-medium uppercase leading-none tracking-[0.66px] text-text-muted" siafTooltip>Estado de registro</span>
                      <siaf-record-status-tag [status]="recordStatus" size="small" />
                    </div>
                  </div>
                </section>

                <section class="rounded-siaf-md border border-[var(--sys-color-divider-strong)] bg-surface px-siaf-xl py-siaf-lg">
                  <header class="mb-siaf-md">
                    <h2 class="m-0 text-base font-bold uppercase leading-normal tracking-[0.02px] text-text">Información de conciliación</h2>
                  </header>
                  <ng-container [ngTemplateOutlet]="labeledValue" [ngTemplateOutletContext]="{ field: { label: 'Tipo de conciliación', value: value('tipoConciliacion') } }" />
                </section>

                <section class="rounded-siaf-md border border-[var(--sys-color-divider-strong)] bg-surface px-siaf-xl py-siaf-lg">
                  <header class="mb-siaf-md">
                    <h2 class="m-0 text-base font-bold uppercase leading-normal tracking-[0.02px] text-text">Cuenta bancaria</h2>
                  </header>
                  <siaf-summary-card [fields]="cuentaFields" [showIndicator]="true" [bordered]="true" [showClose]="false" />
                </section>

                <section class="rounded-siaf-md border border-[var(--sys-color-divider-strong)] bg-surface px-siaf-xl py-siaf-lg">
                  <header class="mb-siaf-md">
                    <h2 class="m-0 text-base font-bold uppercase leading-normal tracking-[0.02px] text-text" data-titulo-registro>{{ tituloRegistro }}</h2>
                  </header>

                  <div class="flex flex-col gap-siaf-xl">
                    <div class="grid gap-x-siaf-xl gap-y-siaf-md md:grid-cols-3">
                      <ng-container [ngTemplateOutlet]="labeledValue" [ngTemplateOutletContext]="{ field: { label: 'Número', value: value('nro') } }" />
                      <ng-container [ngTemplateOutlet]="labeledValue" [ngTemplateOutletContext]="{ field: { label: 'Origen', value: origen } }" />
                      @if (motivo) {
                        <ng-container [ngTemplateOutlet]="labeledValue" [ngTemplateOutletContext]="{ field: { label: 'Motivo de inconsistencia', value: motivo } }" />
                      }
                    </div>

                    <section class="flex flex-col gap-siaf-md" data-libro-banco>
                      <ng-container [ngTemplateOutlet]="sectionTitle" [ngTemplateOutletContext]="{ title: 'Libro banco' }" />
                      @if (libroBanco.length) {
                        <ng-container [ngTemplateOutlet]="operaciones" [ngTemplateOutletContext]="{ filas: libroBanco, conEntidad: true, fechaLabel: 'F. operación', nombre: 'Libro banco' }" />
                      } @else {
                        <p class="m-0 text-sm text-[var(--sys-color-text-neutral-medium)]">No hay una operación en el libro banco para este registro.</p>
                      }
                    </section>

                    <section class="flex flex-col gap-siaf-md" data-operaciones-bancarias>
                      <ng-container [ngTemplateOutlet]="sectionTitle" [ngTemplateOutletContext]="{ title: 'Registro de operaciones bancarias' }" />
                      @if (operacionesBancarias.length) {
                        <ng-container [ngTemplateOutlet]="operaciones" [ngTemplateOutletContext]="{ filas: operacionesBancarias, conEntidad: false, fechaLabel: 'F. operación B.', nombre: 'Registro de operaciones bancarias' }" />
                      } @else {
                        <p class="m-0 text-sm text-[var(--sys-color-text-neutral-medium)]">No hay una operación en el registro de operaciones bancarias para este registro.</p>
                      }
                    </section>

                    @if (sustentos.length) {
                      <section class="flex flex-col gap-siaf-md" data-sustentos>
                        <ng-container [ngTemplateOutlet]="sectionTitle" [ngTemplateOutletContext]="{ title: 'Documento sustento' }" />
                        <div class="siaf-table-scroll min-w-0">
                          <table class="w-full min-w-[560px] border-collapse text-left text-sm">
                            <caption class="sr-only">Documentos de sustento del registro</caption>
                            <thead>
                              <tr class="h-10 bg-[var(--sys-color-bg-surfaces-surface-high)] text-xs font-bold uppercase leading-4 text-text">
                                <th scope="col" class="w-[72px] rounded-l-siaf-sm px-siaf-md py-0">Nro</th>
                                <th scope="col" class="w-[280px] px-siaf-md py-0">Tipo de documento</th>
                                <th scope="col" class="px-siaf-md py-0">Archivo</th>
                                <th scope="col" class="w-[56px] rounded-r-siaf-sm px-siaf-md py-0"><span class="sr-only">Descargar</span></th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (sustento of sustentos; track sustento.nro) {
                                <tr class="h-12 border-b border-[var(--sys-color-divider-default)] bg-surface text-[var(--sys-color-text-neutral-medium)]">
                                  <td class="px-siaf-md py-siaf-xs">{{ sustento.nro }}</td>
                                  <td class="px-siaf-md py-siaf-xs uppercase">{{ sustento.tipo }}</td>
                                  <td class="px-siaf-md py-siaf-xs">
                                    <strong class="block text-sm font-bold leading-tight text-text">{{ sustento.nombre }}</strong>
                                    @if (sustento.tamano) {
                                      <span class="block text-xs text-text-muted">{{ sustento.tamano }}</span>
                                    }
                                  </td>
                                  <td class="px-siaf-md py-siaf-xs text-right"><siaf-icon name="download" [size]="20" /></td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      </section>
                    }

                    @if (justificacion) {
                      <section class="flex flex-col gap-siaf-md" data-justificacion>
                        <ng-container [ngTemplateOutlet]="sectionTitle" [ngTemplateOutletContext]="{ title: 'Justificación de sustento' }" />
                        <ng-container [ngTemplateOutlet]="labeledValue" [ngTemplateOutletContext]="{ field: { label: 'Descripción', value: justificacion }, multiline: true }" />
                      </section>
                    }
                  </div>
                </section>

                <section class="rounded-siaf-md border border-[var(--sys-color-divider-strong)] bg-surface">
                  <siaf-action-tracker [summaryItems]="actionSummary" />
                </section>
              </section>
            </div>
          </div>

          <ng-template #plainField let-field="field">
            <div class="min-w-0">
              <span class="block text-[11px] font-medium uppercase leading-none tracking-[0.66px] text-text-muted">{{ field.label }}</span>
              <span class="mt-siaf-xs block sm:truncate text-sm font-normal leading-normal text-text" siafTooltip>{{ field.value }}</span>
            </div>
          </ng-template>

          <!-- Etiqueta pequeña sobre el valor, como los campos de solo lectura de «Registros no conciliados» del Figma. -->
          <ng-template #labeledValue let-field="field" let-multiline="multiline">
            <div class="min-w-0 px-siaf-md">
              <span class="block text-xs leading-normal text-[var(--sys-color-text-neutral-low)]">{{ field.label }}</span>
              @if (multiline) {
                <p class="m-0 text-sm leading-normal text-text">{{ field.value }}</p>
              } @else {
                <span class="block sm:truncate text-sm leading-normal text-text" siafTooltip>{{ field.value }}</span>
              }
            </div>
          </ng-template>

          <ng-template #sectionTitle let-title="title">
            <div class="flex min-h-10 items-center">
              <h3 class="m-0 text-sm font-bold uppercase leading-normal tracking-[0.02px] text-text">{{ title }}</h3>
            </div>
          </ng-template>

          <!-- Tabla de operaciones con su fila de TOTAL (débito y crédito). -->
          <ng-template #operaciones let-filas="filas" let-conEntidad="conEntidad" let-fechaLabel="fechaLabel" let-nombre="nombre">
            <div class="siaf-table-scroll min-w-0">
              <table class="w-full min-w-[760px] border-collapse text-left text-sm">
                <caption class="sr-only">{{ nombre }}</caption>
                <thead>
                  <tr class="h-10 bg-[var(--sys-color-bg-surfaces-surface-high)] text-xs font-bold uppercase leading-4 text-text">
                    <th scope="col" class="w-[80px] rounded-l-siaf-sm px-siaf-md py-0">Sec.</th>
                    <th scope="col" class="w-[170px] px-siaf-md py-0">{{ fechaLabel }}</th>
                    <th scope="col" class="w-[120px] px-siaf-md py-0">Número</th>
                    <th scope="col" class="w-[150px] px-siaf-md py-0">Descripción</th>
                    @if (conEntidad) {
                      <th scope="col" class="w-[130px] px-siaf-md py-0">Ent. adm. ing.</th>
                    }
                    <th scope="col" class="w-[130px] px-siaf-md py-0 text-right">Débito ({{ simbolo }})</th>
                    <th scope="col" class="w-[130px] rounded-r-siaf-sm px-siaf-md py-0 text-right">Crédito ({{ simbolo }})</th>
                  </tr>
                </thead>
                <tbody>
                  @for (fila of filas; track fila.sec) {
                    <tr class="h-[58px] border-b border-[var(--sys-color-divider-default)] bg-surface text-text">
                      <td class="px-siaf-md py-siaf-xs">{{ fila.sec }}</td>
                      <td class="px-siaf-md py-siaf-xs">{{ fila.fecha }}</td>
                      <td class="px-siaf-md py-siaf-xs">{{ fila.numero }}</td>
                      <td class="px-siaf-md py-siaf-xs leading-tight">{{ fila.descripcion }}</td>
                      @if (conEntidad) {
                        <td class="px-siaf-md py-siaf-xs">{{ fila.entidad }}</td>
                      }
                      <td class="px-siaf-md py-siaf-xs text-right">{{ fila.debito }}</td>
                      <td class="px-siaf-md py-siaf-xs text-right">{{ fila.credito }}</td>
                    </tr>
                  }
                  <tr class="h-12 bg-[var(--sys-color-bg-surfaces-surface-lowest)] font-bold text-text" data-total>
                    <td class="px-siaf-md py-siaf-xs text-left text-sm font-bold text-text">TOTAL</td>
                    <td [attr.colspan]="conEntidad ? 4 : 3"></td>
                    <td class="px-siaf-md py-siaf-xs text-right">{{ total(filas, 'debito') }}</td>
                    <td class="px-siaf-md py-siaf-xs text-right">{{ total(filas, 'credito') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ng-template>
        </aside>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConciliacionHistoryPanelComponent implements OnChanges {
  @Input() open = false;
  @Input() record: DocumentsRecordsRow | null = null;

  @Output() closed = new EventEmitter<void>();

  /** Render animado del panel (entrada/salida por la derecha, 300ms). */
  readonly anim = new SidePanelAnimacion();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) this.anim.actualizar(this.open);
  }

  value(key: string, fallback = '--'): string {
    const valor = this.record?.[key];
    return valor == null || valor === '' ? fallback : String(valor);
  }

  get simbolo(): string {
    return this.value('cuentaMoneda', 'PEN') === 'USD' ? 'US$' : 'S/';
  }

  get recordStatus(): RecordStatus {
    const estado = this.value('status', 'Activo');
    return (['Activo', 'Inactivo', 'Anulado', 'En Proceso', 'Validado', 'Eliminado'] as string[]).includes(estado) ? (estado as RecordStatus) : 'Activo';
  }

  /** Versiones del registro para la columna de `siaf-steps`: hoy solo la de creación. */
  get versiones(): StepItem[] {
    // Como en el Figma: la fecha con el año a dos cifras y la hora a su lado («19/08/26  08:00:59»).
    const [fechaLarga, hora] = this.value('fechaRegistro', '--').split(' ');
    const [dia, mes, anio] = fechaLarga.split('/');
    const fecha = anio && anio.length === 4 ? `${dia}/${mes}/${anio.slice(2)}` : fechaLarga;
    return [
      {
        label: 'Creación',
        fields: [
          { label: 'Nº documento', value: this.value('number') },
          { label: 'Tipo de acción', value: this.value('actionType', 'Creación') },
          { label: 'Fecha', value: hora ? `${fecha}\u00a0\u00a0\u00a0${hora}` : fecha },
        ],
      },
    ];
  }

  get cuentaFields(): SummaryCardField[] {
    return [
      { label: 'Nro de cuenta bancaria', value: this.value('cuentaNumero') },
      { label: 'Denominación de la cuenta', value: this.value('cuentaDenominacion') },
      { label: 'Moneda', value: this.value('cuentaMoneda') },
      { label: 'Entidad financiera', value: this.value('cuentaEntidad') },
    ];
  }

  get conciliado(): boolean {
    return this.value('estadoConciliacion', 'No conciliado') === 'Conciliado';
  }

  get tituloRegistro(): string {
    return this.conciliado ? 'Registros conciliados' : 'Registros no conciliados';
  }

  /** «LB» si el registro viene del libro banco; si solo existe en las operaciones bancarias, «OBO». */
  get origen(): string {
    return this.record?.['lbNumero'] ? 'LB' : 'OBO';
  }

  get motivo(): string {
    const motivo = this.value('motivo', '');
    return motivo && motivo !== '-' ? motivo : '';
  }

  get libroBanco(): OperacionFila[] {
    const r = this.record;
    if (!r?.['lbNumero']) return [];
    return [{ sec: '0001', fecha: this.value('lbFecha'), numero: this.value('lbNumero'), descripcion: this.value('lbDescripcion'), entidad: this.value('lbEntidad'), debito: this.value('lbDebito', '0.00'), credito: this.value('lbCredito', '0.00') }];
  }

  get operacionesBancarias(): OperacionFila[] {
    const r = this.record;
    if (!r?.['rbNumero']) return [];
    return [{ sec: '0001', fecha: this.value('rbFecha'), numero: this.value('rbNumero'), descripcion: this.value('rbDescripcion'), entidad: '', debito: this.value('rbDebito', '0.00'), credito: this.value('rbCredito', '0.00') }];
  }

  /** Suma de una columna de importes de la tabla, con dos decimales. */
  total(filas: OperacionFila[], columna: 'debito' | 'credito'): string {
    return aImporte(filas.reduce((suma, fila) => suma + aNumero(fila[columna]), 0));
  }

  /** Documentos de sustento del registro (un registro manual los trae adjuntos; el taller los guarda en `sustentosJson`). */
  get sustentos(): SustentoFila[] {
    const crudo = this.record?.['sustentosJson'];
    if (!crudo) return [];
    try {
      const lista = JSON.parse(String(crudo)) as { tipo: string; nombre: string; tamano?: string }[];
      return lista.map((s, i) => ({ nro: i + 1, tipo: s.tipo, nombre: s.nombre, tamano: s.tamano ?? '' }));
    } catch {
      return [];
    }
  }

  get justificacion(): string {
    return this.value('justificacion', '');
  }

  get actionSummary(): ActionTrackerSummary[] {
    const accion = (etiqueta: string, quien: string, cuando: string): ActionTrackerSummary => {
      const [fecha, hora] = this.value(cuando, '').split(' ');
      return {
        label: etiqueta,
        actionBy: this.value(quien, 'No asignado aún'),
        date: fecha ? `${fecha}${hora ? `\n${hora}` : ''}` : 'Fecha y hora no registradas',
      };
    };
    return [
      accion('Elaborado por', 'elaboradoPor', 'elaboradoFecha'),
      accion('Verificado por', 'verificadoPor', 'verificadoFecha'),
      accion('Aprobado por', 'aprobadoPor', 'aprobadoFecha'),
    ];
  }
}
