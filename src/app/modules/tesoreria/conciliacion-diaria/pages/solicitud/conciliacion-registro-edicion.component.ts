import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';

import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { AlertComponent } from '../../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { TextAreaControlComponent } from '../../../../../shared/ui/text-area-control/text-area-control.component';
import { TextFieldComponent } from '../../../../../shared/ui/text-field/text-field.component';
import { UploadSideNavComponent } from '../../../../../shared/ui/upload-side-nav/upload-side-nav.component';
import { UploadedFileCardComponent } from '../../../../../shared/ui/uploaded-file-card/uploaded-file-card.component';
import { cumpleMinimoTextoLibre, MIN_CARACTERES_TEXTO_LIBRE } from '../../../../../shared/utils/texto-libre.util';
import { RegistroNoConciliado, SustentoRegistro, TIPOS_DOCUMENTO_SUSTENTO } from '../../models/conciliacion-diaria.model';

/** Un sustento en edición: si se cargó en esta sesión conserva su archivo (para descargarlo). */
interface SustentoEnEdicion extends SustentoRegistro {
  archivo?: File;
}

/** Una operación de la otra fuente (OBO o libro banco) con la que se concilia: su débito y crédito se ingresan en línea. */
interface Candidato {
  id: string;
  fecha: string;
  numero: string;
  descripcion: string;
  debito: string;
  credito: string;
}

const CANDIDATOS_BASE: Omit<Candidato, 'debito' | 'credito'>[] = [
  { id: 'c1', fecha: '01/12/2025 10:00:13', numero: '02698149', descripcion: 'Reporte de Recaudación' },
  { id: 'c2', fecha: '01/12/2025 11:00:13', numero: '02698150', descripcion: 'Reporte de Recaudación' },
];

const comoNumero = (valor: string | number): number => Number(String(valor).replace(/,/g, ''));
const valido = (valor: string | number): boolean => String(valor).trim() !== '' && Number.isFinite(comoNumero(valor));
const formato = (valor: string | number): string => comoNumero(valor).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * «Editar registro no conciliado» (Figma 284:7898): formulario precargado con el registro que no concilió. Lo propio del
 * registro (número, origen y motivo) es de solo lectura; el débito y el crédito de la fuente de origen y los de cada
 * operación con la que se concilia son obligatorios, también al editarlos en la fila. «Aceptar» emite el registro ya
 * conciliado y queda deshabilitado mientras falte algún monto.
 */
@Component({
  selector: 'siaf-conciliacion-registro-edicion',
  standalone: true,
  imports: [AlertComponent, ButtonComponent, IconComponent, SolicitudeFormCardComponent, TextAreaControlComponent, TextFieldComponent, UploadSideNavComponent, UploadedFileCardComponent],
  template: `
    <siaf-solicitude-form-card title="Editar registro no conciliado">
      <div card-actions class="flex items-center gap-siaf-xs">
        <siaf-button variant="outline" (click)="cancelled.emit()">Cancelar</siaf-button>
        <siaf-button variant="filled" [disabled]="!puedeAceptar()" (click)="aceptar()">Aceptar</siaf-button>
      </div>

      <div class="grid gap-siaf-lg md:grid-cols-2 xl:grid-cols-4">
        <siaf-input label="Número" [value]="registro.nro" [disabled]="true" trailingIcon="info" />
        <siaf-input label="Origen" [value]="origenLB ? 'LB' : 'ROB'" [disabled]="true" trailingIcon="info" />
        <siaf-input label="Motivo de inconsistencia" [value]="registro.motivo" [disabled]="true" trailingIcon="info" />
      </div>

      <h3 class="m-0 mt-siaf-md text-sm font-bold uppercase text-text">{{ origenLB ? 'Libro banco' : 'Registro de operaciones bancarias' }}</h3>
      <div class="grid gap-siaf-lg md:grid-cols-2 xl:grid-cols-4">
        <siaf-input [label]="origenLB ? 'Fecha de operación' : 'Fecha de operación B.'" [value]="base().fecha" [disabled]="true" trailingIcon="calendar_today" />
        <siaf-input label="Número" [value]="base().numero" [disabled]="true" />
        <siaf-input label="Descripción" [value]="base().descripcion" [disabled]="true" />
        @if (origenLB) {
          <siaf-input label="Entidad administradora del ingreso" [value]="base().entidad" [disabled]="true" />
        }
        <siaf-input
          label="Débito"
          type="decimal"
          [required]="true"
          [value]="debito()"
          [error]="error('debito', debito())"
          (valueChange)="cambiarBase('debito', $any($event))"
        />
        <siaf-input
          label="Crédito"
          type="decimal"
          [required]="true"
          [value]="credito()"
          [error]="error('credito', credito())"
          (valueChange)="cambiarBase('credito', $any($event))"
        />
      </div>

      <h3 class="m-0 mt-siaf-md text-sm font-bold uppercase text-text">{{ origenLB ? 'Registro de operaciones bancarias' : 'Libro banco' }}</h3>
      <siaf-alert [tone]="aviso().tono" [title]="aviso().titulo" [description]="aviso().descripcion" />

      <div class="overflow-x-auto">
        <table class="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead>
            <tr class="h-10 bg-[var(--sys-color-bg-surfaces-surface-high)] text-xs font-bold uppercase text-text">
              <th class="rounded-tl-siaf-sm px-siaf-md">{{ origenLB ? 'F. operación B.' : 'F. operación' }}</th>
              <th class="px-siaf-md">Número</th>
              <th class="px-siaf-md">Descripción</th>
              <th class="w-[240px] px-siaf-md">Débito (S/)</th>
              <th class="w-[240px] px-siaf-md">Crédito (S/)</th>
              <th class="w-12 rounded-tr-siaf-sm"></th>
            </tr>
          </thead>
          <tbody>
            @for (c of candidatos(); track c.id) {
              <tr class="border-b border-[var(--sys-color-divider-default)] align-top text-[var(--sys-color-text-neutral-medium)]">
                <td class="px-siaf-md py-siaf-sm">{{ c.fecha }}</td>
                <td class="px-siaf-md py-siaf-sm">{{ c.numero }}</td>
                <td class="px-siaf-md py-siaf-sm">{{ c.descripcion }}</td>
                <td class="px-siaf-md py-siaf-sm">
                  <siaf-input
                    placeholder="Ingresar débito"
                    type="decimal"
                    [value]="c.debito"
                    [error]="error(c.id + ':debito', c.debito)"
                    (valueChange)="cambiarCandidato(c.id, 'debito', $any($event))"
                  />
                </td>
                <td class="px-siaf-md py-siaf-sm">
                  <siaf-input
                    placeholder="Ingresar crédito"
                    type="decimal"
                    [value]="c.credito"
                    [error]="error(c.id + ':credito', c.credito)"
                    (valueChange)="cambiarCandidato(c.id, 'credito', $any($event))"
                  />
                </td>
                <td class="px-siaf-sm py-siaf-sm">
                  <button
                    class="inline-flex size-10 items-center justify-center rounded-siaf-md text-text transition hover:bg-surface-muted"
                    type="button"
                    [attr.aria-label]="'Quitar la operación ' + c.numero"
                    (click)="quitarCandidato(c.id)"
                  >
                    <siaf-icon name="delete" [size]="24" />
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="px-siaf-md py-siaf-lg text-center text-text-muted">No quedan operaciones para conciliar.</td></tr>
            }
          </tbody>
        </table>
      </div>

      <div class="flex flex-col gap-siaf-xs">
        <div class="flex min-h-10 items-center justify-between gap-siaf-md">
          <h3 class="m-0 text-sm font-bold uppercase text-text">Documento sustento<span class="text-[var(--sys-color-text-feedback-danger)]" aria-hidden="true"> *</span></h3>
          <siaf-button variant="filled" icon="file_upload" [iconOnly]="true" ariaLabel="Subir documento" (click)="abrirSustento()" />
        </div>
        @switch (sustentos().length) {
          @case (0) {
            <div class="flex min-h-[49px] items-center rounded-siaf-md bg-[var(--sys-color-bg-surfaces-surface-low)] px-siaf-md py-siaf-sm">
              <p class="m-0 text-sm text-[var(--sys-color-text-neutral-medium)]">No se han adjuntado archivos. Por favor, haga clic en el botón para subir un archivo.</p>
            </div>
          }
          @case (1) {
            <!-- Un solo documento: la tarjeta del archivo, con su tipo encima -->
            <p class="m-0 text-xs uppercase tracking-[0.66px] text-[var(--sys-color-text-neutral-low)]">Tipo de documento: {{ sustentos()[0].tipo }}</p>
            <siaf-uploaded-file-card [file]="archivoUnico()" (replace)="abrirSustento(0)" (removed)="quitarSustento(0)" />
          }
          @default {
            <!-- Dos o más: grilla con tipo de documento y archivo (Figma 162:9647) -->
            <table class="w-full border-collapse text-left text-sm">
              <thead>
                <tr class="h-10 bg-[var(--sys-color-bg-surfaces-surface-high)] text-xs font-bold uppercase text-text">
                  <th class="w-16 rounded-tl-siaf-sm px-siaf-md">Nro</th>
                  <th class="w-[350px] px-siaf-md">Tipo de documento</th>
                  <th class="px-siaf-md">Archivo</th>
                  <th class="w-24 rounded-tr-siaf-sm"></th>
                </tr>
              </thead>
              <tbody>
                @for (d of sustentos(); track $index; let i = $index) {
                  <tr class="border-b border-[var(--sys-color-divider-default)] text-[var(--sys-color-text-neutral-medium)]">
                    <td class="px-siaf-md py-siaf-sm">{{ i + 1 }}</td>
                    <td class="px-siaf-md py-siaf-sm uppercase">{{ d.tipo }}</td>
                    <td class="px-siaf-md py-siaf-sm">
                      <span class="block font-bold text-text">{{ d.nombre }}</span>
                      @if (d.tamano) {
                        <span class="block text-xs text-[var(--sys-color-text-neutral-low)]">{{ tamano(d.tamano) }}</span>
                      }
                    </td>
                    <td class="px-siaf-sm py-siaf-sm">
                      <span class="inline-flex items-center justify-end gap-siaf-xxs">
                        @if (d.archivo) {
                          <button class="inline-flex size-10 items-center justify-center rounded-siaf-md text-text transition hover:bg-surface-muted" type="button" [attr.aria-label]="'Descargar ' + d.nombre" (click)="descargarSustento(d)">
                            <siaf-icon name="download" [size]="24" />
                          </button>
                        }
                        <button class="inline-flex size-10 items-center justify-center rounded-siaf-md text-text transition hover:bg-surface-muted" type="button" [attr.aria-label]="'Quitar ' + d.nombre" (click)="quitarSustento(i)">
                          <siaf-icon name="cancel" [size]="24" />
                        </button>
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        }
      </div>

      <div class="flex flex-col gap-siaf-xs">
        <h3 class="m-0 text-sm font-bold uppercase text-text">Justificación de sustento<span class="text-[var(--sys-color-text-feedback-danger)]" aria-hidden="true"> *</span></h3>
        <text-area-control placeholder="Descripción" [required]="true" [maxlength]="500" [minlength]="minCaracteres" [value]="justificacion()" (valueChange)="justificacion.set($event)" />
      </div>
    </siaf-solicitude-form-card>

    <siaf-upload-side-nav
      [open]="sustentoAbierto()"
      variant="document-type"
      title="Documento sustento"
      description=""
      accept=".pdf,.jpg,.jpeg,.png"
      acceptedLabel="Solo se admiten archivos PDF, JPG y PNG."
      [documentTypeOptions]="tiposSustento"
      [documentTypeValue]="tipoSustento()"
      (documentTypeValueChange)="tipoSustento.set($event)"
      (closed)="sustentoAbierto.set(false)"
      [multiple]="!reemplazando()"
      (confirmedFiles)="agregarSustentos($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConciliacionRegistroEdicionComponent implements OnChanges {
  @Input({ required: true }) registro!: RegistroNoConciliado;

  @Output() cancelled = new EventEmitter<void>();
  /** El registro con sus montos completados y ya conciliado. */
  @Output() accepted = new EventEmitter<RegistroNoConciliado>();

  readonly minCaracteres = MIN_CARACTERES_TEXTO_LIBRE;
  origenLB = true;
  readonly debito = signal('');
  readonly credito = signal('');
  readonly candidatos = signal<Candidato[]>([]);
  readonly tocados = signal<ReadonlySet<string>>(new Set());
  /** Documentos de sustento del registro; el de `reemplazo` se cambia al subir uno nuevo. */
  readonly sustentos = signal<SustentoEnEdicion[]>([]);
  readonly archivoUnico = computed(() => {
    const d = this.sustentos()[0];
    return d ? { name: d.nombre, size: d.tamano } : null;
  });
  readonly tipoSustento = signal('');
  readonly tiposSustento = TIPOS_DOCUMENTO_SUSTENTO.map((t) => ({ label: t.toUpperCase(), value: t }));
  /** Posición del sustento que se reemplaza (con uno solo, el panel no admite varios archivos). */
  readonly reemplazando = signal<number | null>(null);
  readonly sustentoAbierto = signal(false);
  readonly justificacion = signal('');

  readonly base = computed(() => {
    const r = this.registro;
    return this.origenLB
      ? { fecha: r.lbFecha, numero: r.lbNumero, descripcion: r.lbDescripcion, entidad: r.lbEntidad }
      : { fecha: r.rbFecha, numero: r.rbNumero, descripcion: r.rbDescripcion, entidad: '' };
  });

  /** Débito y crédito de la fuente de origen y de cada operación a conciliar, más el documento y la justificación de sustento. */
  readonly puedeAceptar = computed(
    () =>
      valido(this.debito()) &&
      valido(this.credito()) &&
      this.candidatos().length > 0 &&
      this.candidatos().every((c) => valido(c.debito) && valido(c.credito)) &&
      this.sustentos().length > 0 &&
      cumpleMinimoTextoLibre(this.justificacion()),
  );

  /** Monto del registro de origen (el débito o el crédito: el otro va en cero). */
  private readonly montoBase = computed(() => comoNumero(this.debito() || 0) + comoNumero(this.credito() || 0));
  /** Suma de lo ingresado en las operaciones con las que se concilia. */
  private readonly sumaCandidatos = computed(() => this.candidatos().reduce((total, c) => total + comoNumero(c.debito || 0) + comoNumero(c.credito || 0), 0));

  /**
   * Aviso de la sección de la otra fuente: amarillo mientras falte conciliar y verde cuando las operaciones ingresadas
   * están completas y suman el monto del registro de origen.
   */
  readonly aviso = computed<{ tono: 'warning' | 'success'; titulo: string; descripcion: string }>(() => {
    const base = formato(this.montoBase());
    const completas = this.candidatos().length > 0 && this.candidatos().every((c) => valido(c.debito) && valido(c.credito));
    const coincide = completas && Math.abs(this.sumaCandidatos() - this.montoBase()) < 0.005;
    const suma = formato(this.sumaCandidatos());
    if (this.origenLB) {
      if (coincide) return { tono: 'success', titulo: 'Registro de operación bancarias', descripcion: `La operación(es) bancaria(s) suman S/ ${suma} y coinciden con el Libro Banco.` };
      if (this.registro.motivo === 'Montos diferentes') {
        return { tono: 'warning', titulo: 'Montos diferentes', descripcion: `El Libro Banco registra S/ ${base}: ajuste las operaciones bancarias para que sumen el mismo monto.` };
      }
      return { tono: 'warning', titulo: 'No existe operación bancaria', descripcion: `Busque y registre la operación bancaria que corresponde al RR por S/ ${base}.` };
    }
    if (coincide) return { tono: 'success', titulo: 'Libro Banco', descripcion: `El RR suma S/ ${suma} y coincide con la operación bancaria.` };
    return { tono: 'warning', titulo: 'No existe RR', descripcion: `Busque y registre el RR que corresponde a la operación bancaria por S/ ${base}.` };
  });

  ngOnChanges(): void {
    const r = this.registro;
    this.origenLB = !!r.lbNumero;
    this.debito.set(this.origenLB ? r.lbDebito : r.rbDebito);
    this.credito.set(this.origenLB ? r.lbCredito : r.rbCredito);
    // «Montos diferentes»: la otra fuente ya existe y viene precargada; en los demás motivos, se ofrecen sus operaciones libres.
    this.candidatos.set(
      this.origenLB && r.rbNumero
        ? [{ id: 'c0', fecha: r.rbFecha, numero: r.rbNumero, descripcion: r.rbDescripcion, debito: r.rbDebito, credito: r.rbCredito }]
        : CANDIDATOS_BASE.map((c) => ({ ...c, debito: '', credito: '' })),
    );
    this.sustentos.set((r.sustentos ?? []).map((d) => ({ ...d })));
    this.reemplazando.set(null);
    this.justificacion.set(r.justificacion ?? '');
    this.tocados.set(new Set());
  }

  /** Mensaje de campo obligatorio una vez que el usuario tocó el campo y lo dejó vacío o inválido. */
  error(clave: string, valor: string | number): string {
    return this.tocados().has(clave) && !valido(valor) ? 'Este campo es obligatorio.' : '';
  }

  cambiarBase(campo: 'debito' | 'credito', valor: string | number): void {
    (campo === 'debito' ? this.debito : this.credito).set(String(valor));
    this.marcar(campo);
  }

  cambiarCandidato(id: string, campo: 'debito' | 'credito', valor: string | number): void {
    this.candidatos.update((lista) => lista.map((c) => (c.id === id ? { ...c, [campo]: String(valor) } : c)));
    this.marcar(`${id}:${campo}`);
  }

  quitarCandidato(id: string): void {
    this.candidatos.update((lista) => lista.filter((c) => c.id !== id));
  }

  abrirSustento(reemplazar: number | null = null): void {
    this.reemplazando.set(reemplazar);
    this.tipoSustento.set(reemplazar === null ? '' : this.sustentos()[reemplazar].tipo);
    this.sustentoAbierto.set(true);
  }

  /** «Aceptar» del panel: suma los archivos con el tipo elegido, o cambia el sustento que se reemplaza. */
  agregarSustentos(archivos: File[]): void {
    const tipo = this.tipoSustento();
    const nuevos: SustentoEnEdicion[] = archivos.map((archivo) => ({ tipo, nombre: archivo.name, tamano: archivo.size, archivo }));
    const reemplazo = this.reemplazando();
    this.sustentos.update((lista) => (reemplazo === null ? [...lista, ...nuevos] : lista.map((d, i) => (i === reemplazo ? nuevos[0] : d))));
    this.reemplazando.set(null);
    this.sustentoAbierto.set(false);
  }

  quitarSustento(indice: number): void {
    this.sustentos.update((lista) => lista.filter((_, i) => i !== indice));
  }

  descargarSustento(d: SustentoEnEdicion): void {
    if (!d.archivo) return;
    const url = URL.createObjectURL(d.archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = d.nombre;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  tamano(bytes: number): string {
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)}mb` : `${Math.max(1, Math.round(bytes / 1024))}kb`;
  }

  aceptar(): void {
    if (!this.puedeAceptar()) return;
    const r = this.registro;
    const otro = this.candidatos()[0];
    const propio = { debito: formato(this.debito()), credito: formato(this.credito()) };
    const extra = { sustentos: this.sustentos().map(({ tipo, nombre, tamano }) => ({ tipo, nombre, tamano })), justificacion: this.justificacion() };
    const contraparte = { fecha: otro.fecha, numero: otro.numero, descripcion: otro.descripcion, debito: formato(otro.debito), credito: formato(otro.credito) };
    this.accepted.emit(
      this.origenLB
        ? { ...r, lbDebito: propio.debito, lbCredito: propio.credito, rbFecha: contraparte.fecha, rbNumero: contraparte.numero, rbDescripcion: contraparte.descripcion, rbDebito: contraparte.debito, rbCredito: contraparte.credito, motivo: '-', conciliado: true, ...extra }
        : { ...r, rbDebito: propio.debito, rbCredito: propio.credito, lbFecha: contraparte.fecha, lbNumero: contraparte.numero, lbDescripcion: contraparte.descripcion, lbEntidad: 'SUNAT', lbDebito: contraparte.debito, lbCredito: contraparte.credito, motivo: '-', conciliado: true, ...extra },
    );
  }

  private marcar(clave: string): void {
    this.tocados.update((t) => new Set([...t, clave]));
  }
}
