import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { CatalogosApiService, TipoDocumentoResponse } from '../../../../../core/api/catalogos-api.service';
import { SolicitudResponse, SolicitudesApiService } from '../../../../../core/api/solicitudes-api.service';
import { PermissionService } from '../../../../../core/auth/permission.service';
import { ESTADO, MOTIVOS_RECHAZO } from '../../../../../core/models/documento.model';
import { SolicitudesFacadeService } from '../../../../../core/state/solicitudes-facade.service';
import { BreadcrumbItem } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { DetailHistoryTabsComponent } from '../../../../../shared/components/detail-history-tabs/detail-history-tabs.component';
import { HistorialSource, buildCurrentComment, buildHistoryEntries } from '../../../../../shared/components/detail-history-tabs/detail-history-tabs.utils';
import { FormTableSearchComponent } from '../../../../../shared/components/form-table-search/form-table-search.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import { RequestApprovalModalsComponent } from '../../../../../shared/components/request-approval-modals/request-approval-modals.component';
import { SelectionColumn, SelectionSideNavComponent } from '../../../../../shared/components/selection-side-nav/selection-side-nav.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { SolicitudeHeaderState } from '../../../../../shared/components/solicitude-header/solicitude-header.component';
import { SolicitudeInfoCardComponent, SolicitudeInfoField } from '../../../../../shared/components/solicitude-info-card/solicitude-info-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { TableControlsComponent } from '../../../../../shared/components/table-controls/table-controls.component';
import { ActionTrackerComponent, ActionTrackerSummary } from '../../../../../shared/ui/action-tracker/action-tracker.component';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { DocumentSummaryCardComponent } from '../../../../../shared/ui/document-summary-card/document-summary-card.component';
import { FlowStatus } from '../../../../../shared/ui/flow-status-tag/flow-status-tag.component';
import { MessageBoxComponent } from '../../../../../shared/ui/message-box/message-box.component';
import { ReadonlyFieldComponent } from '../../../../../shared/ui/readonly-field/readonly-field.component';
import { SnackbarVariant } from '../../../../../shared/ui/snackbar/snackbar.component';
import { SummaryCardComponent, SummaryCardField } from '../../../../../shared/ui/summary-card/summary-card.component';
import { TextFieldComponent } from '../../../../../shared/ui/text-field/text-field.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { crearSnapshotFormulario, hayCambiosRespectoAlSnapshot } from '../../../../../shared/utils/form-snapshot.util';
import { ConciliacionDiariaApiService } from '../../api/conciliacion-diaria-api.service';
import { ConciliacionRegistrosTablaComponent } from '../../components/conciliacion-registros-tabla.component';
import { PROCESS_ID, PROCESS_ROUTE, REQUEST_SEGMENT } from '../../config/conciliacion-diaria.config';
import {
  CODIGO_DOCUMENTO,
  CUENTAS_CONCILIACION,
  ConciliacionManualDatos,
  CuentaBancariaConciliacion,
  NOMBRE_DOCUMENTO,
  REGISTROS_NO_CONCILIADOS,
  RegistroNoConciliado,
} from '../../models/conciliacion-diaria.model';
import { ConciliacionRegistroEdicionComponent } from './conciliacion-registro-edicion.component';

const ENTE_RECTOR = 'DIRECCIÓN GENERAL DEL TESORO PÚBLICO';

const normalizar = (valor: string): string =>
  valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const fechaHora = (iso: string): string => {
  const d = new Date(iso);
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}  ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
};

/**
 * Solicitud «Conciliación manual diaria» (SCMD, Figma 284:8059 y 292:12609): el creador elige la cuenta bancaria y los
 * registros no conciliados, completa el débito y el crédito de cada uno y graba. Sigue el flujo del proceso de ejemplo:
 * Grabar crea la solicitud, guarda el detalle y la pasa a ELABORADO (genera el número); luego el creador edita, verifica o
 * elimina, y el aprobador aprueba, observa o rechaza un documento VERIFICADO. Todo el estado vive en signals y la
 * cabecera se deriva del estado del documento.
 */
@Component({
  selector: 'siaf-conciliacion-diaria-solicitud',
  standalone: true,
  imports: [
    ActionTrackerComponent,
    ButtonComponent,
    ConciliacionRegistroEdicionComponent,
    ConciliacionRegistrosTablaComponent,
    DetailHistoryTabsComponent,
    DocumentSummaryCardComponent,
    FormTableSearchComponent,
    MessageBoxComponent,
    PaginationComponent,
    ReadonlyFieldComponent,
    RequestApprovalModalsComponent,
    SelectionSideNavComponent,
    SolicitudeFormCardComponent,
    SolicitudeInfoCardComponent,
    SolicitudePageLayoutComponent,
    SummaryCardComponent,
    TableControlsComponent,
    TextFieldComponent,
  ],
  templateUrl: './conciliacion-diaria-solicitud.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConciliacionDiariaSolicitudComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly permissions = inject(PermissionService);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly solicitudesApi = inject(SolicitudesApiService);
  private readonly solicitudesFacade = inject(SolicitudesFacadeService);
  private readonly conciliacionApi = inject(ConciliacionDiariaApiService);

  readonly heading = NOMBRE_DOCUMENTO;
  readonly breadcrumbs: BreadcrumbItem[] = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE, NOMBRE_DOCUMENTO);

  readonly columnasCuenta: SelectionColumn<CuentaBancariaConciliacion>[] = [
    { key: 'numeroCuenta', label: 'Número de cuenta' },
    { key: 'denominacion', label: 'Denominación' },
    { key: 'moneda', label: 'Moneda', widthClass: 'w-[160px]' },
    { key: 'entidadFinanciera', label: 'Entidad financiera' },
  ];

  private solicitudId: string | null = null;
  private tiposDocumento: TipoDocumentoResponse[] = [];

  // ── Estado del documento ──────────────────────────────────────────
  /** Última respuesta del backend: de ella salen el estado, el detalle, el historial y la trazabilidad. */
  private readonly solicitud = signal<SolicitudResponse | null>(null);
  readonly estado = computed(() => (this.solicitud()?.estado ?? 'NUEVO').toUpperCase());
  readonly editando = signal(false);
  readonly cargando = signal(false);
  readonly saving = signal(false);

  readonly headerRole = computed<'creator' | 'approver'>(() => (this.permissions.currentRole() === 'approver' ? 'approver' : 'creator'));
  readonly elaborado = computed(() => this.estado() !== 'NUEVO');
  readonly soloLectura = computed(() => this.elaborado() && !this.editando());
  readonly puedeVerificar = computed(() => ['ELABORADO', 'OBSERVADO'].includes(this.estado()));
  readonly numeroDocumento = computed(() => this.solicitud()?.numero ?? '');

  readonly headerState = computed<SolicitudeHeaderState>(() => {
    if (this.editando()) return 'edit';
    switch (this.estado()) {
      case 'APROBADO': return 'approved';
      case 'OBSERVADO': return 'observed';
      case 'RECHAZADO': return 'rejected';
      case 'VERIFICADO': return 'verified';
      case 'ELIMINADO': return 'deleted';
      case 'ELABORADO': return 'elaborated';
      default: return 'new';
    }
  });

  readonly estadoDocumento = computed<FlowStatus>(() => {
    const etiquetas: Record<string, FlowStatus> = {
      APROBADO: ESTADO.APROBADO,
      OBSERVADO: ESTADO.OBSERVADO,
      RECHAZADO: ESTADO.RECHAZADO,
      VERIFICADO: ESTADO.VERIFICADO,
      ELIMINADO: ESTADO.ELIMINADO,
    };
    return etiquetas[this.estado()] ?? ESTADO.ELABORADO;
  });

  readonly camposEntidad = computed<SolicitudeInfoField[]>(() => {
    const registro = this.solicitud()?.fechaRegistro;
    return [
      { label: 'Fecha', value: registro ? fechaHora(registro) : '' },
      { label: 'Ente rector', value: ENTE_RECTOR },
    ];
  });

  // ── Cuenta bancaria ───────────────────────────────────────────────
  readonly cuenta = signal<CuentaBancariaConciliacion | null>(null);
  readonly cuentasAbierto = signal(false);
  readonly cuentaTemporal = signal('');
  readonly busquedaCuenta = signal('');
  readonly paginaCuentas = signal(1);
  readonly filasCuentas = signal(25);

  readonly camposCuenta = computed<SummaryCardField[]>(() => {
    const c = this.cuenta();
    return c
      ? [
          { label: 'Nro de cuenta bancaria', value: c.numeroCuenta },
          { label: 'Denominación de la cuenta', value: c.denominacion },
          { label: 'Moneda', value: c.moneda },
          { label: 'Entidad financiera', value: c.entidadFinanciera },
        ]
      : [];
  });

  readonly cuentasFiltradas = computed(() => {
    const q = normalizar(this.busquedaCuenta());
    return CUENTAS_CONCILIACION.filter((c) => !q || normalizar(Object.values(c).join(' ')).includes(q));
  });
  readonly totalPaginasCuentas = computed(() => Math.max(1, Math.ceil(this.cuentasFiltradas().length / this.filasCuentas())));
  readonly cuentasPagina = computed(() => {
    const filas = this.filasCuentas();
    const desde = (this.paginaCuentas() - 1) * filas;
    return this.cuentasFiltradas().slice(desde, desde + filas);
  });

  // ── Registros no conciliados ──────────────────────────────────────
  readonly registrosElegidos = signal<RegistroNoConciliado[]>([]);
  readonly registrosAbierto = signal(false);
  readonly registrosTemporales = signal<string[]>([]);
  readonly filasRegistros = signal(25);
  readonly busquedaRegistro = signal('');
  readonly registroEnEdicion = signal<RegistroNoConciliado | null>(null);

  readonly registrosFiltrados = computed(() => {
    const q = normalizar(this.busquedaRegistro());
    return REGISTROS_NO_CONCILIADOS.filter((r) => !q || normalizar(Object.values(r).join(' ')).includes(q));
  });
  readonly todosMarcados = computed(() => this.registrosFiltrados().length > 0 && this.registrosFiltrados().every((r) => this.registrosTemporales().includes(r.id)));

  // Tabla del documento: búsqueda, página y selección propias.
  readonly busquedaTabla = signal('');
  readonly filasTabla = signal(25);
  readonly marcados = signal<string[]>([]);
  readonly registrosTabla = computed(() => {
    const q = normalizar(this.busquedaTabla());
    return this.registrosElegidos().filter((r) => !q || normalizar(Object.values(r).join(' ')).includes(q));
  });
  readonly todosMarcadosTabla = computed(() => this.registrosTabla().length > 0 && this.registrosTabla().every((r) => this.marcados().includes(r.id)));

  // Grabar solo con cambios: la foto se toma al pulsar Editar; sin foto (documento nuevo) se asume que hay cambios.
  private readonly fotoEdicion = signal<string | null>(null);
  private readonly fotoActual = computed(() => crearSnapshotFormulario({ cuenta: this.cuenta()?.numeroCuenta ?? '', registros: this.registrosElegidos() }));
  private readonly hayCambios = computed(() => hayCambiosRespectoAlSnapshot(this.fotoEdicion(), this.fotoActual()));

  /**
   * Se graba con la cuenta elegida y cambios aplicados, sin un registro a medio editar. Los registros son opcionales «en
   * este momento»; los que se conciliaron ya salen completos del formulario de edición (que exige montos y sustento).
   */
  readonly formValido = computed(
    () => !this.soloLectura() && !this.registroEnEdicion() && !!this.cuenta() && this.hayCambios(),
  );

  // ── Historial y trazabilidad (del historial de estados) ───────────
  private readonly fuentesHistorial = computed<HistorialSource[]>(() =>
    (this.solicitud()?.historialEstados ?? []).map((h) => ({
      estadoBackend: h.estadoNuevo,
      fechaISO: h.createdAt,
      comentario: h.comentario,
      usuario: h.creador ? `${h.creador.nombres} ${h.creador.apellidoPaterno} ${h.creador.apellidoMaterno}` : '',
      rol: h.perfil?.cfgPerfil?.rol?.nombre ?? '',
    })),
  );
  readonly historial = computed(() => buildHistoryEntries(this.fuentesHistorial()));
  readonly comentarioActual = computed(() => buildCurrentComment(this.estado(), this.fuentesHistorial()));

  readonly trazabilidad = computed<ActionTrackerSummary[]>(() => {
    const historial = this.solicitud()?.historialEstados ?? [];
    // La última vez que pasó por cada estado (tras observar y subsanar, cuenta la verificación nueva).
    const ultimo = (estado: string) => [...historial].reverse().find((h) => h.estadoNuevo === estado);
    const quien = (estado: string, label: string): ActionTrackerSummary => {
      const h = ultimo(estado);
      const nombre = h?.creador ? `${h.creador.nombres} ${h.creador.apellidoPaterno} ${h.creador.apellidoMaterno}` : '';
      return { label, actionBy: nombre.toUpperCase(), date: h ? new Date(h.createdAt).toLocaleString('es-PE') : '' };
    };
    const tercero = this.estado() === 'OBSERVADO'
      ? quien('OBSERVADO', 'Observado por')
      : this.estado() === 'RECHAZADO' ? quien('RECHAZADO', 'Rechazado por') : quien('APROBADO', 'Aprobado por');
    return [quien('ELABORADO', 'Elaborado por'), quien('VERIFICADO', 'Verificado por'), tercero];
  });

  // ── Modales y avisos ──────────────────────────────────────────────
  readonly modalGrabar = signal(false);
  readonly modalVerificar = signal(false);
  readonly modalEliminar = signal(false);
  readonly modalAprobar = signal(false);
  readonly modalObservar = signal(false);
  readonly modalRechazar = signal(false);
  readonly comentario = signal('');
  readonly motivoRechazo = signal('');
  readonly motivosRechazo = [...MOTIVOS_RECHAZO];
  readonly avisoAbierto = signal(false);
  readonly aviso = signal<SnackbarVariant>('creation-elaborated');

  ngOnInit(): void {
    this.catalogosApi.listarTiposDocumento().subscribe((tipos) => (this.tiposDocumento = tipos));
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.cargar(id);

    const estadoNavegacion = history.state as { fromSave?: boolean } | null;
    if (estadoNavegacion?.fromSave) this.mostrarAviso('creation-elaborated');
  }

  // ── Cuenta bancaria ───────────────────────────────────────────────
  abrirCuentas(): void {
    this.cuentaTemporal.set(this.cuenta()?.numeroCuenta ?? '');
    this.busquedaCuenta.set('');
    this.paginaCuentas.set(1);
    this.cuentasAbierto.set(true);
  }

  aceptarCuenta(): void {
    const elegida = CUENTAS_CONCILIACION.find((c) => c.numeroCuenta === this.cuentaTemporal()) ?? null;
    // Otra cuenta invalida los registros que se habían elegido para la anterior.
    if (elegida?.numeroCuenta !== this.cuenta()?.numeroCuenta) this.registrosElegidos.set([]);
    this.cuenta.set(elegida);
    this.cuentasAbierto.set(false);
  }

  // ── Registros no conciliados ──────────────────────────────────────
  abrirRegistros(): void {
    this.registrosTemporales.set(this.registrosElegidos().map((r) => r.id));
    this.busquedaRegistro.set('');
    this.registrosAbierto.set(true);
  }

  alternarRegistro(id: string): void {
    this.registrosTemporales.update((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  }

  alternarTodos(): void {
    const visibles = this.registrosFiltrados().map((r) => r.id);
    this.registrosTemporales.update((ids) => (this.todosMarcados() ? ids.filter((i) => !visibles.includes(i)) : [...new Set([...ids, ...visibles])]));
  }

  aceptarRegistros(): void {
    const ids = this.registrosTemporales();
    // Los registros que ya se habían conciliado conservan su trabajo.
    const previos = new Map(this.registrosElegidos().map((r) => [r.id, r]));
    this.registrosElegidos.set(REGISTROS_NO_CONCILIADOS.filter((r) => ids.includes(r.id)).map((r) => previos.get(r.id) ?? r));
    this.marcados.set([]);
    this.registrosAbierto.set(false);
  }

  alternarMarcado(id: string): void {
    this.marcados.update((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  }

  alternarTodosTabla(): void {
    const visibles = this.registrosTabla().map((r) => r.id);
    this.marcados.update((ids) => (this.todosMarcadosTabla() ? ids.filter((i) => !visibles.includes(i)) : [...new Set([...ids, ...visibles])]));
  }

  /** El lápiz de la barra de control edita la única fila marcada. */
  editarSeleccionado(): void {
    const [id] = this.marcados();
    if (this.marcados().length === 1) this.registroEnEdicion.set(this.registrosElegidos().find((r) => r.id === id) ?? null);
  }

  /** La papelera de la barra de control quita de la solicitud los registros marcados. */
  eliminarSeleccionados(): void {
    const quitar = new Set(this.marcados());
    this.registrosElegidos.update((lista) => lista.filter((r) => !quitar.has(r.id)));
    this.marcados.set([]);
  }

  aceptarEdicion(actualizado: RegistroNoConciliado): void {
    this.registrosElegidos.update((lista) => lista.map((r) => (r.id === actualizado.id ? actualizado : r)));
    this.registroEnEdicion.set(null);
    this.marcados.set([]);
  }

  // ── Navegación y edición ──────────────────────────────────────────
  regresar(): void {
    if (this.registroEnEdicion()) {
      this.registroEnEdicion.set(null);
      return;
    }
    if (this.editando()) {
      // Cancelar la edición vuelve a los datos grabados.
      this.editando.set(false);
      this.restaurar(this.solicitud());
      return;
    }
    void this.router.navigate([PROCESS_ROUTE]);
  }

  editar(): void {
    this.editando.set(true);
    this.avisoAbierto.set(false);
    this.fotoEdicion.set(this.fotoActual());
  }

  // ── Grabar ────────────────────────────────────────────────────────
  onConfirmarGrabar(): void {
    this.modalGrabar.set(false);
    const cuenta = this.cuenta();
    if (!cuenta) return;
    const datos: ConciliacionManualDatos = { numeroCuenta: cuenta.numeroCuenta, registros: this.registrosElegidos() };
    const guardarYElaborar = (id: string): Observable<unknown> =>
      this.conciliacionApi.guardarDetalle(id, datos).pipe(switchMap(() => this.solicitudesApi.cambiarEstado(id, { estadoNuevo: 'ELABORADO' })));

    this.saving.set(true);

    if (this.solicitudId) {
      const id = this.solicitudId;
      this.solicitudesApi.actualizar(id, { justificacion: this.justificacion(), organoLinea: ENTE_RECTOR })
        .pipe(switchMap(() => guardarYElaborar(id)))
        .subscribe({
          next: () => { this.editando.set(false); this.mostrarAviso('creation-elaborated'); this.cargar(id); },
          error: () => this.cargar(id),
        });
      return;
    }

    const tipo = this.tiposDocumento.find((t) => t.codigo === CODIGO_DOCUMENTO);
    if (!tipo) { this.saving.set(false); return; }
    this.solicitudesFacade.crearSolicitud({
      tipoDocumentoId: tipo.id,
      tipoAccion: 'creacion',
      fechaRequerimiento: new Date().toISOString(),
      organoLinea: ENTE_RECTOR,
      justificacion: this.justificacion(),
      cuentas: [],
    }).pipe(
      switchMap((creada) => { this.solicitudId = creada.id; return guardarYElaborar(creada.id).pipe(switchMap(() => [creada.id])); }),
    ).subscribe({
      next: (id) => { this.saving.set(false); void this.router.navigate([PROCESS_ROUTE, REQUEST_SEGMENT, id], { state: { fromSave: true } }); },
      error: () => {
        this.saving.set(false);
        if (this.solicitudId) void this.router.navigate([PROCESS_ROUTE, REQUEST_SEGMENT, this.solicitudId]);
      },
    });
  }

  /** Motivo del documento: la cantidad de registros que se concilian. */
  private justificacion(): string {
    return `Conciliación manual de ${this.registrosElegidos().length} registro(s) no conciliado(s).`;
  }

  // ── Acciones de estado ────────────────────────────────────────────
  onConfirmarVerificar(): void {
    this.modalVerificar.set(false);
    this.accion((id) => this.solicitudesApi.cambiarEstado(id, { estadoNuevo: 'VERIFICADO' }), 'creation-verified');
  }

  onConfirmarEliminar(): void {
    this.modalEliminar.set(false);
    this.accion((id) => this.solicitudesApi.cambiarEstado(id, { estadoNuevo: 'ELIMINADO' }), 'creation-deleted');
  }

  abrirAprobar(): void { this.comentario.set(''); this.modalAprobar.set(true); }
  abrirObservar(): void { this.comentario.set(''); this.modalObservar.set(true); }
  abrirRechazar(): void { this.comentario.set(''); this.motivoRechazo.set(''); this.modalRechazar.set(true); }

  cerrarModalesAprobador(): void {
    this.modalAprobar.set(false);
    this.modalObservar.set(false);
    this.modalRechazar.set(false);
  }

  onConfirmarAprobar(): void {
    this.modalAprobar.set(false);
    this.accion((id) => this.solicitudesFacade.aprobar(id), 'creation-approved');
  }

  onConfirmarObservar(): void {
    if (!this.comentario().trim()) return;
    this.modalObservar.set(false);
    this.accion((id) => this.solicitudesFacade.observar(id, this.comentario()), 'creation-observed');
  }

  onConfirmarRechazar(): void {
    if (!this.comentario().trim()) return;
    this.modalRechazar.set(false);
    this.accion((id) => this.solicitudesFacade.rechazar(id, this.comentario(), this.motivoRechazo() || undefined), 'creation-rejected');
  }

  /** Verificar, eliminar, aprobar, observar y rechazar: llamar, avisar y recargar. */
  private accion(llamada: (id: string) => Observable<unknown>, aviso: SnackbarVariant): void {
    const id = this.solicitudId;
    if (!id) return;
    this.saving.set(true);
    llamada(id).subscribe({
      next: () => { this.mostrarAviso(aviso); this.cargar(id); },
      error: () => this.saving.set(false),
    });
  }

  private mostrarAviso(variante: SnackbarVariant): void {
    this.aviso.set(variante);
    this.avisoAbierto.set(true);
  }

  // ── Carga ─────────────────────────────────────────────────────────
  private cargar(id: string): void {
    this.cargando.set(true);
    this.solicitudesApi.obtenerDetalle(id).subscribe({
      next: (s) => {
        this.solicitudId = s.id;
        this.solicitud.set(s);
        this.editando.set(false);
        this.fotoEdicion.set(null);
        this.restaurar(s);
        this.cargando.set(false);
        this.saving.set(false);
      },
      error: () => { this.cargando.set(false); this.saving.set(false); },
    });
  }

  private restaurar(s: SolicitudResponse | null): void {
    const detalle = s?.detalleConciliacionManual;
    this.cuenta.set(CUENTAS_CONCILIACION.find((c) => c.numeroCuenta === detalle?.numeroCuenta) ?? null);
    this.registrosElegidos.set(detalle?.registros.map((r) => ({ ...r })) ?? []);
    this.registroEnEdicion.set(null);
    this.marcados.set([]);
  }
}
