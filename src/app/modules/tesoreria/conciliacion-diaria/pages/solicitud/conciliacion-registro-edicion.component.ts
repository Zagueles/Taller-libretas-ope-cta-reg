import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';

import { SelectionColumn, SelectionSideNavComponent } from '../../../../../shared/components/selection-side-nav/selection-side-nav.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { AlertComponent } from '../../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { TextAreaControlComponent } from '../../../../../shared/ui/text-area-control/text-area-control.component';
import { TextFieldComponent } from '../../../../../shared/ui/text-field/text-field.component';
import { UploadSideNavComponent } from '../../../../../shared/ui/upload-side-nav/upload-side-nav.component';
import { UploadedFileCardComponent } from '../../../../../shared/ui/uploaded-file-card/uploaded-file-card.component';
import { cumpleMinimoTextoLibre, MIN_CARACTERES_TEXTO_LIBRE } from '../../../../../shared/utils/texto-libre.util';
import {
  DatosLinea,
  EdicionRegistro,
  LIBRO_BANCO_CONCILIABLE,
  LineaConciliacion,
  OPERACIONES_CONCILIABLES,
  OperacionConciliable,
  RegistroNoConciliado,
  SustentoRegistro,
  TIPOS_DOCUMENTO_SUSTENTO,
  TipoModificacion,
  camposEditables,
} from '../../models/conciliacion-diaria.model';

/** Un sustento en edición: si se cargó en esta sesión conserva su archivo (para descargarlo). */
interface SustentoEnEdicion extends SustentoRegistro {
  archivo?: File;
}

type Lado = 'lb' | 'rb';
type Campo = keyof DatosLinea;

const comoNumero = (valor: string | number): number => Number(String(valor).replace(/,/g, ''));
const valido = (valor: string | number): boolean => String(valor).trim() !== '' && Number.isFinite(comoNumero(valor));
const formato = (valor: string | number): string => comoNumero(valor).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Lo que vale la línea: crédito menos débito. */
const neto = (l: DatosLinea): number => comoNumero(l.credito || 0) - comoNumero(l.debito || 0);
const sumaNeto = (lineas: LineaConciliacion[]): number => lineas.reduce((total, l) => total + neto(l), 0);

/** «dd/mm/aaaa» o «dd/mm/aaaa hh:mm:ss» de un día que existe. */
function fechaValida(texto: string): boolean {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})( \d{2}:\d{2}:\d{2})?$/.exec(texto.trim());
  if (!m) return false;
  const [dia, mes, anio] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(anio, mes - 1, dia);
  return f.getFullYear() === anio && f.getMonth() === mes - 1 && f.getDate() === dia;
}
/** Solo el día: la comparación entre registros ignora la hora. */
const diaDe = (texto: string): string => texto.trim().slice(0, 10);

const CAMPOS: { clave: Campo; nombre: string }[] = [
  { clave: 'fecha', nombre: 'Fecha de operación' },
  { clave: 'numero', nombre: 'Número' },
  { clave: 'descripcion', nombre: 'Descripción' },
  { clave: 'entidad', nombre: 'Entidad administradora' },
  { clave: 'debito', nombre: 'Débito' },
  { clave: 'credito', nombre: 'Crédito' },
  { clave: 'secuencia', nombre: 'Secuencia' },
];

const linea = (id: string, datos: DatosLinea): LineaConciliacion => ({ id, ...datos, original: { ...datos } });

/**
 * «Editar registro no conciliado» (Figma 284:7898): formulario precargado con el registro que no concilió. Lo propio del
 * registro (número, origen y motivo) es de solo lectura. Libro banco y registro de operaciones bancarias son tablas de
 * registros con todos sus campos editables («Antes: …» marca lo corregido): un par uno a uno (montos distintos,
 * o fecha o número mal informados) o un grupo cuando alguno de los dos lados tiene varios registros. Cada lado tiene su
 * lupa, siempre en el mismo orden (libro banco, operaciones bancarias); el registro de origen no se puede quitar. Con varios registros un banner explica qué hacer. «Aceptar» exige que la
 * suma de ambos lados cuadre, que todos tengan el mismo número y día, secuencias seguidas y, con el sustento y la justificación, emite el registro ya conciliado con su bitácora.
 */
@Component({
  selector: 'siaf-conciliacion-registro-edicion',
  standalone: true,
  imports: [AlertComponent, ButtonComponent, IconComponent, SelectionSideNavComponent, SolicitudeFormCardComponent, TextAreaControlComponent, TextFieldComponent, UploadSideNavComponent, UploadedFileCardComponent],
  template: `
    <siaf-solicitude-form-card [title]="esModificacion() ? 'Editar registro conciliado' : 'Editar registro no conciliado'">
      <div card-actions class="flex items-center gap-siaf-xs">
        <siaf-button variant="outline" (click)="cancelled.emit()">Cancelar</siaf-button>
        <siaf-button variant="filled" [disabled]="!puedeAceptar()" (click)="aceptar()">Aceptar</siaf-button>
      </div>

      <div class="flex flex-col gap-siaf-md">
        <div class="grid gap-siaf-lg md:grid-cols-2 xl:grid-cols-3">
          <siaf-input label="Número de registro" [value]="registro.nro" [disabled]="true" trailingIcon="info" />
          @if (esModificacion()) {
            <siaf-input label="Tipo de modificación" [value]="tipoModificacionActual() ?? ''" [disabled]="true" trailingIcon="info" />
          } @else {
            <siaf-input label="Motivo de inconsistencia" [value]="registro.motivo" [disabled]="true" trailingIcon="info" />
          }
        </div>
        @if (banner(); as b) {
          <siaf-alert tone="info" [title]="b.titulo" [description]="b.descripcion" />
        }
      </div>

      <!-- Libro banco y operaciones bancarias, siempre en ese orden. Mismo encabezado de 40 px que «Documento sustento» -->
      @for (lado of ladosEnOrden; track lado) {
        <div class="flex flex-col gap-siaf-xs">
          <div class="flex min-h-10 items-center justify-between gap-siaf-md">
            <h3 class="m-0 text-sm font-bold uppercase text-text">{{ tituloLado(lado) }}</h3>
            @if (!esModificacion()) {
              <siaf-button variant="filled" icon="search" [iconOnly]="true" [ariaLabel]="'Buscar ' + tituloLado(lado).toLowerCase()" (click)="abrirBusqueda(lado)" />
            }
          </div>
          @if (lineasDe(lado).length === 0) {
            <div class="flex min-h-[49px] items-center rounded-siaf-md bg-[var(--sys-color-bg-surfaces-surface-low)] px-siaf-md py-siaf-sm">
              <p class="m-0 text-sm text-[var(--sys-color-text-neutral-medium)]">Por favor, haga clic en el botón de búsqueda para seleccionar una opción.</p>
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full min-w-[1320px] border-collapse text-left text-sm">
                <thead>
                  <tr class="h-10 bg-[var(--sys-color-bg-surfaces-surface-high)] text-xs font-bold uppercase text-text">
                    <th class="w-[96px] rounded-tl-siaf-sm px-siaf-md">Sec.</th>
                    <th class="w-[200px] px-siaf-md">F. operación</th>
                    <th class="w-[150px] px-siaf-md">Número</th>
                    <th class="px-siaf-md">Descripción</th>
                    @if (lado === 'lb') {
                      <th class="w-[140px] px-siaf-md">Entidad</th>
                    }
                    <th class="w-[160px] px-siaf-md">Débito (S/)</th>
                    <th class="w-[160px] px-siaf-md">Crédito (S/)</th>
                    <th class="w-12 rounded-tr-siaf-sm"></th>
                  </tr>
                </thead>
                <tbody>
                  @for (l of lineasDe(lado); track l.id) {
                    <tr class="border-b border-[var(--sys-color-divider-default)] align-top">
                      @for (c of camposVisibles(lado); track c) {
                        <td class="px-siaf-sm py-siaf-sm">
                          <siaf-input
                            [type]="c === 'debito' || c === 'credito' ? 'decimal' : 'text'"
                            [autoSuccess]="false"
                            [disabled]="!editable(c)"
                            [value]="l[c]"
                            [hint]="antes(l, c)"
                            [error]="errorCampo(lado, l, c)"
                            (valueChange)="cambiar(lado, l.id, c, $any($event))"
                          />
                        </td>
                      }
                      <td class="px-siaf-sm py-siaf-sm">
                        @if (l.id !== 'origen' && !esModificacion()) {
                          <button
                            class="inline-flex size-10 items-center justify-center rounded-siaf-md text-text transition hover:bg-surface-muted"
                            type="button"
                            [attr.aria-label]="'Quitar el registro ' + (l.numero || 'sin número')"
                            (click)="quitar(lado, l.id)"
                          >
                            <siaf-icon name="delete" [size]="24" />
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr class="h-12 bg-[var(--sys-color-bg-surfaces-surface-low)] text-sm font-bold text-text">
                    <td class="rounded-bl-siaf-sm px-siaf-md" [attr.colspan]="lado === 'lb' ? 5 : 4">TOTAL</td>
                    <td class="px-siaf-md">{{ totalDe(lado, 'debito') }}</td>
                    <td class="px-siaf-md">{{ totalDe(lado, 'credito') }}</td>
                    <td class="rounded-br-siaf-sm"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          }
        </div>
      }


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

    <!-- Seleccionar registro (Figma 461:28376): uno o más, del lado de la lupa que se abrió -->
    <siaf-selection-side-nav
      [open]="busquedaAbierta()"
      [title]="'Seleccionar ' + tituloLado(ladoBusqueda())"
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
  /** En una modificación (registro ya conciliado) solo se corrige lo que dice el tipo: «Datos» o «Montos»; no se agregan ni quitan registros. */
  @Input() set tipoModificacion(valor: TipoModificacion | null) {
    this.tipoModificacionActual.set(valor);
  }

  @Output() cancelled = new EventEmitter<void>();
  /** El registro con sus líneas completas, ya conciliado y con su bitácora de ediciones. */
  @Output() accepted = new EventEmitter<RegistroNoConciliado>();

  readonly minCaracteres = MIN_CARACTERES_TEXTO_LIBRE;
  origenLB = true;
  readonly tipoModificacionActual = signal<TipoModificacion | null>(null);
  readonly esModificacion = computed(() => this.tipoModificacionActual() !== null);
  readonly lineasLB = signal<LineaConciliacion[]>([]);
  readonly lineasRB = signal<LineaConciliacion[]>([]);
  readonly ladoBusqueda = signal<Lado>('rb');
  readonly busquedaAbierta = signal(false);
  readonly busqueda = signal('');
  readonly seleccion = signal<string[]>([]);
  readonly filasOperaciones = signal(25);
  readonly paginaOperaciones = signal(1);

  readonly columnasOperacion: SelectionColumn<OperacionConciliable>[] = [
    { key: 'fecha', label: 'F. operación', widthClass: 'w-[200px]' },
    { key: 'numero', label: 'Número', widthClass: 'w-[130px]' },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'debito', label: 'Débito (S/)', align: 'right' },
    { key: 'credito', label: 'Crédito (S/)', align: 'right' },
  ];

  /** Siempre en el mismo orden, sea cual sea el origen del registro: libro banco y, debajo, operaciones bancarias. */
  readonly ladosEnOrden: Lado[] = ['lb', 'rb'];

  /** Lo que ofrece la lupa: RR del libro banco, u operaciones bancarias; sin los que ya están en alguna tabla. */
  private readonly operacionesDisponibles = computed(() => {
    const usadas = new Set([...this.lineasLB(), ...this.lineasRB()].map((l) => l.id));
    const fuente = this.ladoBusqueda() === 'lb' ? LIBRO_BANCO_CONCILIABLE : OPERACIONES_CONCILIABLES;
    return fuente.filter((o) => !usadas.has(o.id));
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

  /** Hay grupo cuando alguno de los dos lados tiene varios registros; si no, es un par. */
  readonly esGrupo = computed(() => this.lineasLB().length > 1 || this.lineasRB().length > 1);
  private readonly sumaLB = computed(() => sumaNeto(this.lineasLB()));
  private readonly sumaRB = computed(() => sumaNeto(this.lineasRB()));
  private readonly diferencia = computed(() => this.sumaLB() - this.sumaRB());
  readonly cuadra = computed(() => Math.abs(this.diferencia()) < 0.005);

  private readonly lineasValidas = computed(() =>
    [...this.lineasLB().map((l) => ({ l, lado: 'lb' as Lado })), ...this.lineasRB().map((l) => ({ l, lado: 'rb' as Lado }))].every(({ l, lado }) =>
      CAMPOS.every((c) => !this.mensajeCampo(lado, l, c.clave)),
    ),
  );
  /** El mismo día en todos los registros (la hora no cuenta). */
  private readonly mismoDia = computed(() => {
    const dias = new Set([...this.lineasLB(), ...this.lineasRB()].map((l) => diaDe(l.fecha)));
    return dias.size <= 1;
  });
  /** Todos los registros que se concilian juntos llevan el mismo número. */
  private readonly numerosCoinciden = computed(() => new Set([...this.lineasLB(), ...this.lineasRB()].map((l) => l.numero.trim())).size === 1);
  /** Con varios registros en un lado, sus secuencias son 1, 2, 3… sin huecos ni repetidas. */
  private readonly secuenciasValidas = computed(() =>
    [this.lineasLB(), this.lineasRB()].every((ls) => ls.length < 2 || ls.map((l) => Number(l.secuencia)).sort((a, b) => a - b).every((n, i) => n === i + 1)),
  );

  /** El aviso de varios registros: qué hacer con el número y la secuencia, o con el monto si el motivo es «Montos diferentes». */
  readonly banner = computed<{ titulo: string; descripcion: string } | null>(() => {
    if (!this.esGrupo() || this.esModificacion()) return null;
    return this.registro.motivo === 'Montos diferentes'
      ? { titulo: 'Montos diferentes con varios registros', descripcion: 'Agregue los RR u operaciones que completan la diferencia. Escriba el mismo número en todos los registros que se concilian juntos y numere la secuencia en cada tabla: 1, 2, 3…' }
      : { titulo: 'Varios RR y operaciones en un mismo registro', descripcion: 'Escriba el mismo número en todos los RR y operaciones que se concilian juntos. Luego numere la secuencia en cada tabla: 1, 2, 3…' };
  });

  /** Alguna línea difiere de lo que traía: en una modificación sin cambios no hay nada que aceptar. */
  readonly hayEdiciones = computed(() => [...this.lineasLB(), ...this.lineasRB()].some((l) => CAMPOS.some((c) => this.editado(l, c.clave))));

  /** Que cuadre la relación, que cada campo sea válido y que haya sustento y justificación. */
  readonly puedeAceptar = computed(
    () =>
      this.lineasLB().length > 0 &&
      this.lineasRB().length > 0 &&
      this.lineasValidas() &&
      this.mismoDia() &&
      this.cuadra() &&
      this.numerosCoinciden() &&
      this.secuenciasValidas() &&
      (!this.esModificacion() || this.hayEdiciones()) &&
      this.sustentos().length > 0 &&
      cumpleMinimoTextoLibre(this.justificacion()),
  );

  ngOnChanges(): void {
    const r = this.registro;
    this.origenLB = !!r.lbNumero;
    if (r.lbLineas?.length || r.rbLineas?.length) {
      // Un registro que ya se editó vuelve con sus líneas y con lo que traían originalmente.
      const copiar = (ls: LineaConciliacion[] = []): LineaConciliacion[] => ls.map((l) => ({ ...l, original: { ...l.original } }));
      this.lineasLB.set(copiar(r.lbLineas));
      this.lineasRB.set(copiar(r.rbLineas));
    } else {
      const propiaLB: DatosLinea = { fecha: r.lbFecha, numero: r.lbNumero, descripcion: r.lbDescripcion, entidad: r.lbEntidad, debito: r.lbDebito, credito: r.lbCredito, secuencia: '1' };
      const propiaRB: DatosLinea = { fecha: r.rbFecha, numero: r.rbNumero, descripcion: r.rbDescripcion, entidad: '', debito: r.rbDebito, credito: r.rbCredito, secuencia: '1' };
      // «Montos diferentes»: la otra fuente ya existe y viene precargada; si falta (no existe OBO o RR) arranca vacía.
      this.lineasLB.set(this.origenLB ? [linea('origen', propiaLB)] : []);
      this.lineasRB.set(this.origenLB ? (r.rbNumero ? [linea('rb0', propiaRB)] : []) : [linea('origen', propiaRB)]);
    }
    // Una modificación parte de lo que el registro tiene hoy: «Antes» es el valor vigente, no el de la creación.
    if (this.esModificacion() && !r.modificado) {
      const vigente = (ls: LineaConciliacion[]): LineaConciliacion[] => ls.map((l) => ({ ...l, original: { fecha: l.fecha, numero: l.numero, descripcion: l.descripcion, entidad: l.entidad, debito: l.debito, credito: l.credito, secuencia: l.secuencia } }));
      this.lineasLB.set(vigente(this.lineasLB()));
      this.lineasRB.set(vigente(this.lineasRB()));
    }
    this.sustentos.set((r.sustentos ?? []).map((d) => ({ ...d })));
    this.reemplazando.set(null);
    this.justificacion.set(r.justificacion ?? '');
    this.tocados.set(new Set());
  }

  /** Si el campo se puede corregir: todos en una creación; en una modificación, los del tipo elegido. */
  editable(campo: Campo): boolean {
    return camposEditables(this.tipoModificacionActual()).includes(campo);
  }

  tituloLado(lado: Lado): string {
    return lado === 'lb' ? 'Libro banco' : 'Registro de operaciones bancarias';
  }

  lineasDe(lado: Lado): LineaConciliacion[] {
    return lado === 'lb' ? this.lineasLB() : this.lineasRB();
  }

  /** Las columnas de cada tabla, en orden; la entidad administradora es solo del libro banco. */
  camposVisibles(lado: Lado): Campo[] {
    return lado === 'lb' ? ['secuencia', 'fecha', 'numero', 'descripcion', 'entidad', 'debito', 'credito'] : ['secuencia', 'fecha', 'numero', 'descripcion', 'debito', 'credito'];
  }

  totalDe(lado: Lado, campo: 'debito' | 'credito'): string {
    return formato(this.lineasDe(lado).reduce((total, l) => total + comoNumero(l[campo] || 0), 0));
  }

  /** Si el valor cambió respecto de lo que traía el registro (los montos se comparan como números). */
  private editado(l: LineaConciliacion, campo: Campo): boolean {
    const [actual, original] = [l[campo], l.original[campo]];
    return campo === 'debito' || campo === 'credito' ? valido(actual) !== valido(original) || (valido(actual) && comoNumero(actual) !== comoNumero(original)) : actual !== original;
  }

  /** «Antes: …» bajo el campo corregido. */
  antes(l: LineaConciliacion, campo: Campo): string {
    return this.editado(l, campo) ? `Antes: ${l.original[campo] || 'vacío'}` : '';
  }

  /** Por qué el valor no es válido, o vacío si lo es. */
  private mensajeCampo(lado: Lado, l: LineaConciliacion, campo: Campo): string {
    const v = l[campo];
    switch (campo) {
      case 'fecha': return fechaValida(v) ? '' : 'Ingrese una fecha válida.';
      case 'debito':
      case 'credito': return valido(v) ? '' : 'Este campo es obligatorio.';
      case 'secuencia': return /^\d+$/.test(v.trim()) && Number(v) > 0 ? '' : 'Ingrese una secuencia válida.';
      case 'entidad': return lado === 'lb' && !v.trim() ? 'Este campo es obligatorio.' : '';
      default: return v.trim() ? '' : 'Este campo es obligatorio.';
    }
  }

  /** El mensaje de un campo una vez que el usuario lo tocó. */
  errorCampo(lado: Lado, l: LineaConciliacion, campo: Campo): string {
    return this.tocados().has(`${lado}:${l.id}:${campo}`) ? this.mensajeCampo(lado, l, campo) : '';
  }

  cambiar(lado: Lado, id: string, campo: Campo, valor: string | number): void {
    const actualizar = (lista: LineaConciliacion[]): LineaConciliacion[] => lista.map((l) => (l.id === id ? { ...l, [campo]: String(valor) } : l));
    (lado === 'lb' ? this.lineasLB : this.lineasRB).update(actualizar);
    this.tocados.update((t) => new Set([...t, `${lado}:${id}:${campo}`]));
  }

  /** El registro de origen no se puede quitar. */
  quitar(lado: Lado, id: string): void {
    if (id === 'origen') return;
    (lado === 'lb' ? this.lineasLB : this.lineasRB).update((lista) => lista.filter((l) => l.id !== id));
  }

  abrirBusqueda(lado: Lado): void {
    this.ladoBusqueda.set(lado);
    this.seleccion.set([]);
    this.busqueda.set('');
    this.paginaOperaciones.set(1);
    this.busquedaAbierta.set(true);
  }

  /** «Aceptar» del panel: suma los registros elegidos al lado de la lupa, con sus datos y la siguiente secuencia. */
  aceptarOperaciones(): void {
    const lado = this.ladoBusqueda();
    const fuente = lado === 'lb' ? LIBRO_BANCO_CONCILIABLE : OPERACIONES_CONCILIABLES;
    const elegidas = fuente.filter((o) => this.seleccion().includes(o.id));
    (lado === 'lb' ? this.lineasLB : this.lineasRB).update((lista) => [
      ...lista,
      ...elegidas.map((o, i) =>
        linea(o.id, { fecha: o.fecha, numero: o.numero, descripcion: o.descripcion, entidad: lado === 'lb' ? (o.entidad ?? 'SUNAT') : '', debito: o.debito, credito: o.credito, secuencia: String(lista.length + i + 1) }),
      ),
    ]);
    this.busquedaAbierta.set(false);
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
    const normalizar = (ls: LineaConciliacion[]): LineaConciliacion[] => ls.map((l) => ({ ...l, debito: formato(l.debito), credito: formato(l.credito) }));
    const lb = normalizar(this.lineasLB());
    const rb = normalizar(this.lineasRB());
    const resumen = (ls: LineaConciliacion[]) => ({
      fecha: ls[0].fecha,
      numero: ls[0].numero,
      descripcion: ls[0].descripcion,
      debito: formato(ls.reduce((total, l) => total + comoNumero(l.debito), 0)),
      credito: formato(ls.reduce((total, l) => total + comoNumero(l.credito), 0)),
    });
    const [a, b] = [resumen(lb), resumen(rb)];
    const ediciones: EdicionRegistro[] = [];
    for (const [lado, ls] of [['lb', this.lineasLB()], ['rb', this.lineasRB()]] as [Lado, LineaConciliacion[]][]) {
      for (const l of ls) {
        for (const c of CAMPOS) {
          if (c.clave === 'entidad' && lado === 'rb') continue;
          if (!this.editado(l, c.clave)) continue;
          const esMonto = c.clave === 'debito' || c.clave === 'credito';
          ediciones.push({
            lado: lado === 'lb' ? 'Libro banco' : 'Operaciones bancarias',
            numero: l.original.numero,
            campo: c.nombre,
            antes: esMonto && valido(l.original[c.clave]) ? formato(l.original[c.clave]) : l.original[c.clave],
            despues: esMonto ? formato(l[c.clave]) : l[c.clave],
          });
        }
      }
    }
    this.accepted.emit({
      ...r,
      lbFecha: a.fecha,
      lbNumero: a.numero,
      lbDescripcion: a.descripcion,
      lbEntidad: lb[0].entidad,
      lbDebito: a.debito,
      lbCredito: a.credito,
      rbFecha: b.fecha,
      rbNumero: b.numero,
      rbDescripcion: b.descripcion,
      rbDebito: b.debito,
      rbCredito: b.credito,
      conciliado: true,
      sustentos: this.sustentos().map(({ tipo, nombre, tamano }) => ({ tipo, nombre, tamano })),
      justificacion: this.justificacion(),
      lbLineas: lb,
      rbLineas: rb,
      ediciones,
      ...(this.esModificacion() ? { modificado: true } : {}),
    });
  }
}
