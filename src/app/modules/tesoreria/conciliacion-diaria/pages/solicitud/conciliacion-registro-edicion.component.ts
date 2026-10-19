import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';

import { SelectionColumn, SelectionSideNavComponent } from '../../../../../shared/components/selection-side-nav/selection-side-nav.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { TextAreaControlComponent } from '../../../../../shared/ui/text-area-control/text-area-control.component';
import { TextFieldComponent } from '../../../../../shared/ui/text-field/text-field.component';
import { UploadSideNavComponent } from '../../../../../shared/ui/upload-side-nav/upload-side-nav.component';
import { UploadedFileCardComponent } from '../../../../../shared/ui/uploaded-file-card/uploaded-file-card.component';
import { cumpleMinimoTextoLibre, MIN_CARACTERES_TEXTO_LIBRE } from '../../../../../shared/utils/texto-libre.util';
import { OPERACIONES_CONCILIABLES, OperacionConciliable, RegistroNoConciliado, SustentoRegistro, TIPOS_DOCUMENTO_SUSTENTO } from '../../models/conciliacion-diaria.model';

/** Un sustento en edición: si se cargó en esta sesión conserva su archivo (para descargarlo). */
interface SustentoEnEdicion extends SustentoRegistro {
  archivo?: File;
}

/**
 * Una operación de la otra fuente (OBO o libro banco) con la que se concilia. Todas repiten la fecha, el número y la
 * descripción del registro de origen: solo se ingresan su débito y su crédito.
 */
interface Candidato {
  id: string;
  fecha: string;
  numero: string;
  descripcion: string;
  debito: string;
  credito: string;
}

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
  imports: [ButtonComponent, IconComponent, SelectionSideNavComponent, SolicitudeFormCardComponent, TextAreaControlComponent, TextFieldComponent, UploadSideNavComponent, UploadedFileCardComponent],
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

      <!-- Cada sección: encabezado de 40 px y 8 px hasta su contenido, como «Documento sustento» -->
      <div class="flex flex-col gap-siaf-xs">
          <!-- Mismo encabezado que los demás (alto de 40 px, como si llevara su botón) -->
        <div class="flex min-h-10 items-center">
          <h3 class="m-0 text-sm font-bold uppercase text-text">{{ origenLB ? 'Libro banco' : 'Registro de operaciones bancarias' }}</h3>
        </div>
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
      </div>

      <div class="flex flex-col gap-siaf-xs">
        <div class="flex min-h-10 items-center justify-between gap-siaf-md">
          <h3 class="m-0 text-sm font-bold uppercase text-text">{{ origenLB ? 'Registro de operaciones bancarias' : 'Libro banco' }}</h3>
          <siaf-button variant="filled" icon="search" [iconOnly]="true" [ariaLabel]="'Buscar ' + tituloBusqueda().toLowerCase()" (click)="abrirBusqueda()" />
        </div>
        @if (candidatos().length === 0) {
          <!-- Sin operaciones: vista vacía (Figma 327:50141) -->
          <div class="flex min-h-[49px] items-center rounded-siaf-md bg-[var(--sys-color-bg-surfaces-surface-low)] px-siaf-md py-siaf-sm">
            <p class="m-0 text-sm text-[var(--sys-color-text-neutral-medium)]">Por favor, haga clic en el botón de búsqueda para seleccionar una opción.</p>
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr class="h-10 bg-[var(--sys-color-bg-surfaces-surface-high)] text-xs font-bold uppercase text-text">
                  <th class="w-20 rounded-tl-siaf-sm px-siaf-md">Sec.</th>
                  <th class="w-[220px] px-siaf-md">{{ origenLB ? 'F. operación B.' : 'F. operación' }}</th>
                  <th class="w-[160px] px-siaf-md">Número</th>
                  <th class="px-siaf-md">Descripción</th>
                  <th class="w-[220px] px-siaf-md">Débito (S/)</th>
                  <th class="w-[220px] px-siaf-md">Crédito (S/)</th>
                  <th class="w-12 rounded-tr-siaf-sm"></th>
                </tr>
              </thead>
              <tbody>
                @for (c of candidatos(); track c.id; let i = $index) {
                  <tr class="border-b border-[var(--sys-color-divider-default)] align-top text-[var(--sys-color-text-neutral-medium)]">
                    <td class="px-siaf-md py-siaf-md">{{ secuenciaDe(i) }}</td>
                    <td class="px-siaf-md py-siaf-md">{{ c.fecha }}</td>
                    <td class="px-siaf-md py-siaf-md">{{ c.numero }}</td>
                    <td class="px-siaf-md py-siaf-md">{{ c.descripcion }}</td>
                    <td class="px-siaf-sm py-siaf-sm">
                      <siaf-input
                        placeholder="Ingresar débito"
                        type="decimal"
                        [value]="c.debito"
                        [error]="error(c.id + ':debito', c.debito)"
                        (valueChange)="cambiarCandidato(c.id, 'debito', $any($event))"
                      />
                    </td>
                    <td class="px-siaf-sm py-siaf-sm">
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
                        [attr.aria-label]="'Quitar la operación ' + (c.numero || 'sin número')"
                        (click)="quitarCandidato(c.id)"
                      >
                        <siaf-icon name="delete" [size]="24" />
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="h-12 bg-[var(--sys-color-bg-surfaces-surface-low)] text-sm font-bold text-text">
                  <td class="rounded-bl-siaf-sm px-siaf-md" colspan="4">TOTAL</td>
                  <td class="px-siaf-md">{{ totalDebito() }}</td>
                  <td class="px-siaf-md">{{ totalCredito() }}</td>
                  <td class="rounded-br-siaf-sm"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        }
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


    <!-- Seleccionar registro de operaciones bancarias (Figma 461:28376): una o más operaciones -->
    <siaf-selection-side-nav
      [open]="busquedaAbierta()"
      [title]="'Seleccionar ' + tituloBusqueda()"
      mode="multiple"
      [rows]="operacionesPagina()"
      [columns]="columnasOperacion"
      [searchValue]="busqueda()"
      [selectedIds]="seleccion()"
      [paginated]="true"
      [page]="paginaOperaciones()"
      [totalPages]="totalPaginasOperaciones()"
      [pageSize]="filasOperaciones()"
      [rowsPerPage]="filasOperaciones()"
      [totalItems]="operacionesFiltradas().length"
      [rowsPerPageOptions]="[10, 25, 50, 100]"
      (searchChange)="busqueda.set($event); paginaOperaciones.set(1)"
      (selectionChange)="seleccion.set($event)"
      (previousPage)="paginaOperaciones.set(paginaOperaciones() - 1)"
      (nextPage)="paginaOperaciones.set(paginaOperaciones() + 1)"
      (rowsPerPageChange)="filasOperaciones.set($event); paginaOperaciones.set(1)"
      (closed)="busquedaAbierta.set(false)"
      (accepted)="aceptarOperaciones()"
    />

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
  readonly busquedaAbierta = signal(false);
  readonly busqueda = signal('');
  readonly seleccion = signal<string[]>([]);
  readonly filasOperaciones = signal(25);
  readonly paginaOperaciones = signal(1);

  readonly columnasOperacion: SelectionColumn<OperacionConciliable>[] = [
    { key: 'fecha', label: 'F. operación B.', widthClass: 'w-[200px]' },
    { key: 'numero', label: 'Número', widthClass: 'w-[130px]' },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'debito', label: 'Débito (S/)', align: 'right' },
    { key: 'credito', label: 'Crédito (S/)', align: 'right' },
  ];

  /** Lo que se busca: si el registro nace del libro banco, operaciones bancarias; si nace de ellas, el libro banco. */
  readonly tituloBusqueda = computed(() => (this.origenLBSignal() ? 'Registro de operaciones bancarias' : 'Libro banco'));
  private readonly origenLBSignal = signal(true);

  /** Las que todavía no están en la tabla. */
  private readonly operacionesDisponibles = computed(() => {
    const usadas = new Set(this.candidatos().map((c) => c.numero));
    return OPERACIONES_CONCILIABLES.filter((o) => !usadas.has(o.numero));
  });
  readonly operacionesFiltradas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    return this.operacionesDisponibles().filter((o) => !q || [o.fecha, o.numero, o.descripcion, o.debito, o.credito].some((v) => v.toLowerCase().includes(q)));
  });
  readonly totalPaginasOperaciones = computed(() => Math.max(1, Math.ceil(this.operacionesFiltradas().length / this.filasOperaciones())));
  readonly operacionesPagina = computed(() => {
    const desde = (Math.min(this.paginaOperaciones(), this.totalPaginasOperaciones()) - 1) * this.filasOperaciones();
    return this.operacionesFiltradas().slice(desde, desde + this.filasOperaciones());
  });
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

  /** Totales de las columnas Débito y Crédito de las operaciones ingresadas. */
  readonly totalDebito = computed(() => formato(this.candidatos().reduce((total, c) => total + comoNumero(c.debito || 0), 0)));
  readonly totalCredito = computed(() => formato(this.candidatos().reduce((total, c) => total + comoNumero(c.credito || 0), 0)));

  /** Secuencia de la fila en la tabla, a cuatro dígitos. */
  secuenciaDe(indice: number): string {
    return String(indice + 1).padStart(4, '0');
  }

  ngOnChanges(): void {
    const r = this.registro;
    this.origenLB = !!r.lbNumero;
    this.origenLBSignal.set(this.origenLB);
    this.debito.set(this.origenLB ? r.lbDebito : r.rbDebito);
    this.credito.set(this.origenLB ? r.lbCredito : r.rbCredito);
    // «Montos diferentes»: la otra fuente ya existe y viene precargada; si falta (no existe OBO o RR), la sección arranca
    // vacía y cada (+) agrega una operación.
    this.candidatos.set(
      this.origenLB && r.rbNumero
        ? [{ id: 'c0', fecha: r.rbFecha, numero: r.rbNumero, descripcion: r.rbDescripcion, debito: r.rbDebito, credito: r.rbCredito }]
        : [],
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

  abrirBusqueda(): void {
    this.seleccion.set([]);
    this.busqueda.set('');
    this.paginaOperaciones.set(1);
    this.busquedaAbierta.set(true);
  }

  /** «Aceptar» del panel: suma las operaciones elegidas, con su fecha, número y descripción; solo falta ingresar débito y crédito. */
  aceptarOperaciones(): void {
    const elegidas = OPERACIONES_CONCILIABLES.filter((o) => this.seleccion().includes(o.id));
    this.candidatos.update((lista) => [...lista, ...elegidas.map((o) => ({ id: o.id, fecha: o.fecha, numero: o.numero, descripcion: o.descripcion, debito: '', credito: '' }))]);
    this.busquedaAbierta.set(false);
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
    const suma = (campo: 'debito' | 'credito'): string => formato(this.candidatos().reduce((total, c) => total + comoNumero(c[campo]), 0));
    const contraparte = { fecha: otro.fecha, numero: otro.numero, descripcion: otro.descripcion, debito: suma('debito'), credito: suma('credito') };
    this.accepted.emit(
      this.origenLB
        ? { ...r, lbDebito: propio.debito, lbCredito: propio.credito, rbFecha: contraparte.fecha, rbNumero: contraparte.numero, rbDescripcion: contraparte.descripcion, rbDebito: contraparte.debito, rbCredito: contraparte.credito, conciliado: true, ...extra }
        : { ...r, rbDebito: propio.debito, rbCredito: propio.credito, lbFecha: contraparte.fecha, lbNumero: contraparte.numero, lbDescripcion: contraparte.descripcion, lbEntidad: 'SUNAT', lbDebito: contraparte.debito, lbCredito: contraparte.credito, conciliado: true, ...extra },
    );
  }

  private marcar(clave: string): void {
    this.tocados.update((t) => new Set([...t, clave]));
  }
}
