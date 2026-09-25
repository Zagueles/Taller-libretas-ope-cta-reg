import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { ReadonlyFieldComponent } from '../../../../../shared/ui/readonly-field/readonly-field.component';
import { RecordStatusTagComponent } from '../../../../../shared/ui/record-status-tag/record-status-tag.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { PROCESS_ID, PROCESS_ROUTE } from '../../config/registro-libretas.rutas';
import {
  CODIGO_ENTIDAD,
  CUENTAS_BANCARIAS_INFO,
  MOVIMIENTOS_LIBRETA_REGISTRO,
  nombreBeneficiario,
  nombreTipoOperacion,
} from '../../models/registro-libretas.model';

const formatoMonto = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monto = (valor: number): string => formatoMonto.format(valor);

const fechaVisible = (iso: string): string => iso.slice(0, 10).split('-').reverse().join('/');

/** Movimiento interno por tipo de operación (código, descripción y sigla). */
const MOVIMIENTO_INTERNO: Record<string, { codigo: string; descripcion: string; sigla: string }> = {
  '1': { codigo: 'SI0001', descripcion: 'Saldos iniciales', sigla: 'SI' },
  '2': { codigo: 'RR0002', descripcion: 'Reporte de recaudación SUNAT', sigla: 'RR' },
  '3': { codigo: 'DV0003', descripcion: 'Devolución', sigla: 'DV' },
};

const SIN_DATO = '-';

/**
 * Detalle de un registro de la libreta (Figma nodo 241:20830, «Detalle de registros»): solo lectura, con la
 * información de la operación financiera, de la cuenta bancaria y el registro de la operación por secciones. Se abre
 * al pulsar una fila de la pestaña Registros de «Documentos y registros». Datos simulados.
 */
@Component({
  selector: 'siaf-registro-libretas-registro',
  standalone: true,
  imports: [ReadonlyFieldComponent, RecordStatusTagComponent, SolicitudeFormCardComponent, SolicitudePageLayoutComponent],
  template: `
    <siaf-solicitude-page-layout
      [breadcrumbs]="breadcrumbs"
      heading="Detalle de registro de operaciones en las libretas de las cuentas de registro"
      [showReturn]="true"
      [showTag]="false"
      [customActions]="true"
      secondaryText=""
      (returned)="volver()"
    >
      @if (registro(); as r) {
        <siaf-solicitude-form-card title="Información de operaciones financieras">
          <div class="grid gap-x-siaf-lg gap-y-siaf-lg md:grid-cols-3">
            <readonly-field caption="Fecha registro" [value]="r.fechaRegistro" />
            <readonly-field caption="Número de operación" [value]="r.numeroOperacion" />
            <readonly-field caption="Tipo de operación" [value]="r.tipoOperacion" />
          </div>
        </siaf-solicitude-form-card>

        <siaf-solicitude-form-card title="Información de la cuenta bancaria">
          <div class="grid gap-x-siaf-lg gap-y-siaf-lg md:grid-cols-3">
            <readonly-field caption="Número de cuenta bancaria" [value]="r.cuenta.numeroCuenta" />
            <readonly-field caption="Denominación de la cuenta" [value]="r.cuenta.nombre" />
            <readonly-field caption="Entidad financiera" value="Banco Central de Reserva del Perú" />
            <readonly-field caption="Moneda" [value]="r.cuenta.moneda" />
            <readonly-field caption="Entidad titular de la cuenta" value="Ministerio de Economía y Finanzas" />
            <readonly-field caption="Unidad ejecutora" value="-" />
            <readonly-field caption="Unidad organizacional responsable de la cuenta" value="Dirección General del Tesoro Público" />
          </div>
        </siaf-solicitude-form-card>

        <siaf-solicitude-form-card title="Registro de operación de la libreta">
          <div class="flex flex-col gap-siaf-lg">
            @for (seccion of r.secciones; track seccion.titulo) {
              <section class="flex flex-col gap-siaf-sm">
                <h3 class="m-0 text-sm font-bold uppercase leading-normal text-[var(--sys-color-text-neutral-high)]">{{ seccion.titulo }}</h3>
                <div class="grid gap-x-siaf-lg gap-y-siaf-lg md:grid-cols-3">
                  @for (campo of seccion.campos; track campo.caption) {
                    <readonly-field [class]="campo.ancho === 2 ? 'md:col-span-2' : ''" [caption]="campo.caption" [value]="campo.value" />
                  }
                </div>
              </section>
            }

            <section class="flex flex-col gap-siaf-sm">
              <h3 class="m-0 text-sm font-bold uppercase leading-normal text-[var(--sys-color-text-neutral-high)]">Importe en moneda de la cuenta</h3>
              <div class="grid gap-siaf-md sm:grid-cols-2 lg:grid-cols-4">
                @for (importe of r.importes; track importe.caption) {
                  <readonly-field
                    class="block rounded-siaf-md bg-[var(--sys-color-bg-surfaces-highlight)] [&_span.min-w-0]:ml-auto [&>div]:bg-transparent"
                    [caption]="importe.caption"
                    [value]="importe.value"
                  />
                }
              </div>
            </section>

            <section class="flex flex-col gap-siaf-sm">
              <h3 class="m-0 text-sm font-bold uppercase leading-normal text-[var(--sys-color-text-neutral-high)]">Descripción detallada del registro</h3>
              <readonly-field caption="Descripcion" [value]="r.descripcionDetallada" />
            </section>

            <div class="h-px w-full bg-[var(--sys-color-divider-default)]"></div>

            <div class="grid gap-x-siaf-lg gap-y-siaf-lg md:grid-cols-3">
              <readonly-field caption="Estado de conciliación" value="Conciliado" />
              <div class="flex flex-col gap-siaf-xxs px-siaf-md">
                <span class="text-xs font-medium text-text-muted">Estado de registro</span>
                <span><siaf-record-status-tag status="Activo" size="small" /></span>
              </div>
            </div>
          </div>
        </siaf-solicitude-form-card>
      }
    </siaf-solicitude-page-layout>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroLibretasRegistroComponent {
  private readonly ruta = inject(ActivatedRoute);
  private readonly location = inject(Location);

  readonly breadcrumbs = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE);

  readonly registro = computed(() => {
    const sec = this.ruta.snapshot.paramMap.get('sec');
    const m = MOVIMIENTOS_LIBRETA_REGISTRO.find((x) => x.sec === sec);
    if (!m) return null;
    const cuenta = CUENTAS_BANCARIAS_INFO.find((c) => c.id === m.cuentaBancariaId) ?? CUENTAS_BANCARIAS_INFO[0];
    const interno = MOVIMIENTO_INTERNO[m.tipoOperacionCodigo] ?? { codigo: SIN_DATO, descripcion: SIN_DATO, sigla: SIN_DATO };
    const tipo = nombreTipoOperacion(m.tipoOperacionCodigo);
    const codigoUe = m.entidad === 'MINCETUR' ? '11111107004  - ' : '';
    return {
      cuenta,
      tipoOperacion: tipo,
      fechaRegistro: `${fechaVisible(m.fecha)}  18:01:00`,
      numeroOperacion: `1234${m.sec.slice(-4)}`,
      secciones: [
        {
          titulo: 'Acreditación',
          campos: [
            { caption: 'Secuencia', value: m.sec },
            { caption: 'Fecha', value: `${fechaVisible(m.fecha)}  ${m.fecha.slice(11, 19)}` },
          ],
        },
        {
          titulo: 'Beneficiario',
          campos: [
            { caption: 'Código', value: m.beneficiarioCodigo },
            { caption: 'Tipo', value: 'Concepto' },
            { caption: 'Descripción', value: nombreBeneficiario(m.beneficiarioCodigo).toUpperCase() },
          ],
        },
        {
          titulo: 'Cuenta de registro',
          campos: [
            { caption: 'Número', value: m.numeroCuentaRegistro },
            { caption: 'Descripción', value: m.descripcionCuentaRegistro, ancho: 2 },
          ],
        },
        {
          titulo: 'Ámbito institucional',
          campos: [
            { caption: 'Entidad', value: `${CODIGO_ENTIDAD[m.entidad] ?? ''} - ${m.entidad}` },
            { caption: 'Unidad ejecutora', value: m.entidad === 'MEF' ? SIN_DATO : `${codigoUe}${m.unidadEjecutora}` },
            { caption: 'Grupo', value: m.grupo },
          ],
        },
        { titulo: 'Entidad administradora', campos: [{ caption: 'Código', value: SIN_DATO }, { caption: 'Sigla', value: SIN_DATO }] },
        {
          titulo: 'Movimiento interno',
          campos: [
            { caption: 'Código', value: interno.codigo },
            { caption: 'Descripción', value: interno.descripcion },
            { caption: 'Sigla', value: interno.sigla },
          ],
        },
        { titulo: 'Movimiento externo', campos: [{ caption: 'Código', value: SIN_DATO }, { caption: 'Descripción', value: SIN_DATO }] },
        {
          titulo: 'Documento CUT',
          campos: [
            { caption: 'Número', value: SIN_DATO },
            { caption: 'Archivo', value: SIN_DATO },
            { caption: 'Sigla', value: SIN_DATO },
          ],
        },
      ] as { titulo: string; campos: { caption: string; value: string; ancho?: 1 | 2 }[] }[],
      importes: [
        { caption: 'Saldo inicial', value: monto(m.saldoInicial) },
        { caption: 'Débito', value: monto(m.debito) },
        { caption: 'Crédito', value: monto(m.credito) },
        { caption: 'Saldo final', value: monto(m.saldoFinal) },
      ],
      descripcionDetallada: `Registro de ${tipo.split(' - ')[1]?.toLowerCase() ?? tipo.toLowerCase()}`,
    };
  });

  volver(): void {
    this.location.back();
  }
}
