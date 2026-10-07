import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { ReadonlyFieldComponent } from '../../../../../shared/ui/readonly-field/readonly-field.component';
import { RecordStatusTagComponent } from '../../../../../shared/ui/record-status-tag/record-status-tag.component';
import { volverAlOrigen } from '../../../../../shared/utils/volver.util';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { RegistroLibretasApiService } from '../../api/registro-libretas-api.service';
import { PROCESS_ID, PROCESS_ROUTE } from '../../config/registro-libretas.rutas';
import { construirDetalleRegistro, DetalleRegistro } from '../../utils/registro-libretas-detalle.util';

/**
 * Detalle de un registro de la libreta (Figma nodo 241:20830, «Detalle de registros»): solo lectura, con la
 * información de la operación financiera, de la cuenta bancaria y el registro de la operación por secciones. Se abre
 * al pulsar una fila de la pestaña Registros de «Documentos y registros». El registro lo entrega el backend simulado.
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

            @if (r.importesNacional.length) {
              <section class="flex flex-col gap-siaf-sm">
                <h3 class="m-0 text-sm font-bold uppercase leading-normal text-[var(--sys-color-text-neutral-high)]">Importe en moneda nacional</h3>
                <div class="grid gap-siaf-md sm:grid-cols-2 lg:grid-cols-4">
                  @for (importe of r.importesNacional; track importe.caption) {
                    <readonly-field
                      class="block rounded-siaf-md bg-[var(--sys-color-bg-surfaces-highlight)] [&_span.min-w-0]:ml-auto [&>div]:bg-transparent"
                      [caption]="importe.caption"
                      [value]="importe.value"
                    />
                  }
                </div>
              </section>
            }

            <section class="flex flex-col gap-siaf-sm">
              <h3 class="m-0 text-sm font-bold uppercase leading-normal text-[var(--sys-color-text-neutral-high)]">Descripción detallada del registro</h3>
              <readonly-field caption="Descripcion" [value]="r.descripcionDetallada" />
            </section>

            <div class="h-px w-full bg-[var(--sys-color-divider-default)]"></div>

            <div class="grid gap-x-siaf-lg gap-y-siaf-lg md:grid-cols-3">
              <readonly-field caption="Estado de conciliación" [value]="r.rechazado ? 'No conciliado' : 'Conciliado'" />
              <div class="flex flex-col gap-siaf-xxs px-siaf-md">
                <span class="text-xs font-medium text-text-muted">Estado de registro</span>
                @if (r.rechazado) {
                  <span class="text-sm text-[var(--sys-color-text-neutral-high)]">-</span>
                } @else {
                  <span><siaf-record-status-tag status="Activo" size="small" /></span>
                }
              </div>
            </div>
          </div>
        </siaf-solicitude-form-card>
      }
    </siaf-solicitude-page-layout>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroLibretasRegistroComponent implements OnInit {
  private readonly api = inject(RegistroLibretasApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  readonly breadcrumbs = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE);

  readonly registro = signal<DetalleRegistro | null>(null);

  ngOnInit(): void {
    const sec = this.ruta.snapshot.paramMap.get('sec') ?? '';
    // Un registro que no existe (404) deja la pantalla sin contenido, como antes.
    this.api.obtenerRegistro(sec).subscribe({
      next: ({ movimiento, rechazado }) => this.registro.set(construirDetalleRegistro(movimiento, rechazado)),
      error: () => this.registro.set(null),
    });
  }

  volver(): void {
    volverAlOrigen(this.location, this.router, `${PROCESS_ROUTE}?tab=records`);
  }
}
