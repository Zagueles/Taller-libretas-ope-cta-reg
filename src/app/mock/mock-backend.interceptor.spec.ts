import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Observable } from 'rxjs';

import type { LoginResponse } from '../core/api/auth-api.service';
import type { SolicitudResponse } from '../core/api/solicitudes-api.service';
import type { CuentaBancariaDatos, CuentaBancariaRegistro } from '../modules/tesoreria/cuentas-bancarias/models/cuenta-bancaria.model';
import { CUENTAS_CONCILIACION, ConciliacionManualDatos, REGISTROS_NO_CONCILIADOS, RegistroConciliado } from '../modules/tesoreria/conciliacion-diaria/models/conciliacion-diaria.model';
import type { DetalleDocumentoLibreta, DetalleMovimientoLibreta, DocumentoLibreta, MovimientoLibretaRegistro, CuentaRegistroCatalogo } from '../modules/tesoreria/registro-libretas-cuentas-registro/models/registro-libretas.model';
import { mockBackendInterceptor } from './mock-backend.interceptor';
import { leerDatos, reiniciarDatosDemo } from './mock-db';
import { DEMO_PROCESAMIENTO } from './procesamiento-conciliacion';
import { CONTRASENA_DEMO, USUARIOS_DEMO, activarUsuariosDePrueba } from './usuarios-demo';

/**
 * El backend simulado sigue las reglas del flujo de una solicitud. Si una clase cambia una regla, este spec dice
 * cuál se rompió.
 */
describe('mockBackendInterceptor', () => {
  const API = '/api/v1';
  let http: HttpClient;
  let red: HttpTestingController;

  const CUENTA: CuentaBancariaDatos = {
    bancoCodigo: '002',
    tipoCuenta: 'CORRIENTE',
    moneda: 'PEN',
    numeroCuenta: '19412345678901',
    denominacion: 'Cuenta de prueba',
    fechaApertura: '2026-09-10',
    esRecaudadora: false,
  };

  /** Resuelve la petición simulada (tiene una latencia de 250 ms) y devuelve la respuesta o el error. */
  function esperar<T>(peticion: Observable<T>): { valor?: T; error?: HttpErrorResponse } {
    const resultado: { valor?: T; error?: HttpErrorResponse } = {};
    peticion.subscribe({ next: (v) => (resultado.valor = v), error: (e: HttpErrorResponse) => (resultado.error = e) });
    tick(300);
    return resultado;
  }

  /** Entra con el usuario de demostración de ese perfil (Carla es creador y visualizador; Luis, aprobador). Creador por defecto. */
  function entrar(perfil: 'creador' | 'aprobador' | 'visualizador' = 'creador'): HttpHeaders {
    const dni = perfil === 'aprobador' ? '44444444' : '33333333';
    const { valor } = esperar(http.post<LoginResponse>(`${API}/auth/login`, { dni, password: CONTRASENA_DEMO }));
    const headers = new HttpHeaders({ Authorization: `Bearer ${valor!.accessToken}` });
    if (perfil !== 'visualizador') return headers;
    const cambio = esperar(http.patch<{ accessToken: string }>(`${API}/auth/cambiar-perfil`, { perfilId: `perfil-demo-${perfil}` }, { headers }));
    return new HttpHeaders({ Authorization: `Bearer ${cambio.valor!.accessToken}` });
  }

  function archivo(): FormData {
    const form = new FormData();
    form.append('archivo', new File(['%PDF'], 'constancia.pdf', { type: 'application/pdf' }));
    return form;
  }

  beforeEach(() => {
    // El flujo completo (crear, verificar, aprobar) se prueba con Carla y Luis; la demo solo tiene al visualizador.
    activarUsuariosDePrueba(true);
    reiniciarDatosDemo();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([mockBackendInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    red = TestBed.inject(HttpTestingController);
  });

  // Ninguna llamada a la API sale a la red: las responde el simulador.
  afterEach(() => {
    red.verify();
    activarUsuariosDePrueba(false);
  });

  afterAll(() => reiniciarDatosDemo());

  describe('usuarios de la demo', () => {
    beforeEach(() => activarUsuariosDePrueba(false));

    it('solo hay un usuario, con el perfil «Visualizador de consultas»', fakeAsync(() => {
      expect(USUARIOS_DEMO.length).toBe(1);
      const { valor } = esperar(http.post<LoginResponse>(`${API}/auth/login`, { dni: '33333333', password: CONTRASENA_DEMO }));

      expect(valor?.perfilesDisponibles.map((p) => [p.rolCodigo, p.rol])).toEqual([['VISUALIZADOR', 'Visualizador de consultas']]);
      expect(valor?.perfilActivo.rolCodigo).toBe('VISUALIZADOR');
    }));

    it('no existen el aprobador ni el perfil de creador: no entran ni se pueden elegir', fakeAsync(() => {
      expect(esperar(http.post(`${API}/auth/login`, { dni: '44444444', password: CONTRASENA_DEMO })).error?.status).toBe(401);

      const { valor } = esperar(http.post<LoginResponse>(`${API}/auth/login`, { dni: '33333333', password: CONTRASENA_DEMO }));
      const headers = new HttpHeaders({ Authorization: `Bearer ${valor!.accessToken}` });
      expect(esperar(http.patch(`${API}/auth/cambiar-perfil`, { perfilId: 'perfil-demo-creador' }, { headers })).error?.status).toBe(404);
    }));

    it('los documentos de ejemplo conservan en su historial a quienes los crearon y aprobaron', () => {
      const aprobada = leerDatos().solicitudes.find((x) => x.estado === 'APROBADO');
      const quien = (estado: string): string => aprobada!.historialEstados!.find((h) => h.estadoNuevo === estado)!.creador!.nombres;
      expect([quien('ELABORADO'), quien('APROBADO')]).toEqual(['Carla', 'Luis']);
    });
  });

  it('rechaza una contraseña incorrecta con el mensaje que muestra el login', fakeAsync(() => {
    const { error } = esperar(http.post(`${API}/auth/login`, { dni: '33333333', password: 'otra' }));

    expect(error?.status).toBe(401);
    expect(error?.error.message).toContain('DNI o contraseña incorrectos');
  }));

  it('entrega los perfiles del usuario y cambia al que se elige', fakeAsync(() => {
    const { valor } = esperar(http.post<LoginResponse>(`${API}/auth/login`, { dni: '33333333', password: CONTRASENA_DEMO }));
    expect(valor?.perfilesDisponibles.map((p) => p.rolCodigo)).toEqual(['CREADOR', 'VISUALIZADOR']);

    const headers = new HttpHeaders({ Authorization: `Bearer ${valor!.accessToken}` });
    const cambio = esperar(http.patch<{ perfilActivo: { rolCodigo: string } }>(`${API}/auth/cambiar-perfil`, { perfilId: 'perfil-demo-visualizador' }, { headers }));

    expect(cambio.valor?.perfilActivo.rolCodigo).toBe('VISUALIZADOR');
  }));

  it('el aprobador es otra persona que el creador: no puede cambiar al perfil de creador ni aprobar con el de Carla', fakeAsync(() => {
    const { valor } = esperar(http.post<LoginResponse>(`${API}/auth/login`, { dni: '44444444', password: CONTRASENA_DEMO }));
    expect(valor?.perfilesDisponibles.map((p) => p.rolCodigo)).toEqual(['APROBADOR']);

    const headers = new HttpHeaders({ Authorization: `Bearer ${valor!.accessToken}` });
    const cambio = esperar(http.patch(`${API}/auth/cambiar-perfil`, { perfilId: 'perfil-demo-creador' }, { headers }));
    expect(cambio.error?.status).toBe(404);
  }));

  it('quien aprueba en el historial de los documentos de ejemplo no es quien los creó', () => {
    const datos = leerDatos();
    const nombre = (h: { creador?: { nombres: string; apellidoPaterno: string; apellidoMaterno?: string | null } | null }): string =>
      `${h.creador?.nombres} ${h.creador?.apellidoPaterno} ${h.creador?.apellidoMaterno ?? ''}`.trim();
    expect(datos.solicitudes.length).toBeGreaterThan(0);
    for (const solicitud of datos.solicitudes) {
      const historial = solicitud.historialEstados ?? [];
      const creadores = new Set(historial.filter((h) => ['NUEVO', 'ELABORADO', 'VERIFICADO'].includes(h.estadoNuevo ?? '')).map(nombre));
      const aprobadores = historial.filter((h) => ['APROBADO', 'OBSERVADO', 'RECHAZADO'].includes(h.estadoNuevo ?? '')).map(nombre);
      for (const aprobador of aprobadores) expect(creadores.has(aprobador)).withContext(`${solicitud.numero}: ${aprobador}`).toBeFalse();
    }
  });

  it('la bandeja no muestra solicitudes en NUEVO y pagina si se pide', fakeAsync(() => {
    const headers = entrar('creador');
    esperar(http.post(`${API}/solicitudes`, { tipoAccion: 'creacion', organoLinea: 'OGA', justificacion: 'Borrador' }, { headers }));

    const { valor } = esperar(http.get<{ data: SolicitudResponse[]; total: number }>(`${API}/solicitudes/bandeja-creador?tipos=SRCB&page=1&limit=5`, { headers }));

    expect(valor?.data.length).toBe(5);
    expect(valor?.total).toBe(12);
  }));

  it('la bandeja se ordena en el servidor por la columna y el sentido pedidos, antes de paginar', fakeAsync(() => {
    const headers = entrar('creador');
    const pedir = (sentido: string) =>
      esperar(http.get<{ data: SolicitudResponse[]; total: number }>(`${API}/solicitudes/bandeja-creador?tipos=SRCB&page=1&limit=3&orden=number&sentido=${sentido}`, { headers })).valor!;

    const asc = pedir('asc').data.map((s) => s.numero!);
    const desc = pedir('desc').data.map((s) => s.numero!);

    expect(asc).toEqual([...asc].sort());
    expect(desc).toEqual([...desc].sort().reverse());
    expect(asc[0]).not.toBe(desc[0]);
    expect(pedir('asc').total).toBe(12);
  }));

  it('recorre el flujo completo: elaborar, verificar y aprobar crea la cuenta y avisa a cada rol', fakeAsync(() => {
    const ana = entrar('creador');
    const creada = esperar(http.post<SolicitudResponse>(`${API}/solicitudes`, { tipoAccion: 'creacion', organoLinea: 'OGA', justificacion: 'Cuenta nueva' }, { headers: ana }));
    const id = creada.valor!.id;

    // Sin datos ni sustento no se puede elaborar.
    expect(esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: ana })).error?.status).toBe(400);

    esperar(http.post(`${API}/solicitudes/${id}/cuenta-bancaria`, CUENTA, { headers: ana }));
    esperar(http.post(`${API}/solicitudes/${id}/sustentos`, archivo(), { headers: ana }));
    const elaborada = esperar(http.patch<{ numero: string }>(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: ana }));
    expect(elaborada.valor?.numero).toMatch(/^PCB-SRCB-00013-\d{4}-MEF-DGTP$/);

    // El creador no puede aprobar.
    expect(esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'APROBADO' }, { headers: ana })).error?.status).toBe(409);
    esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'VERIFICADO' }, { headers: ana }));

    const luis = entrar('aprobador');
    const avisos = esperar(http.get<{ titulo: string; documento: { id: string } }[]>(`${API}/notificaciones`, { headers: luis }));
    expect(avisos.valor?.some((n) => n.documento.id === id && n.titulo === 'Solicitud por aprobar')).toBeTrue();

    esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'APROBADO' }, { headers: luis }));

    const registros = esperar(http.get<CuentaBancariaRegistro[]>(`${API}/cuentas-bancarias`, { headers: luis }));
    const cuenta = registros.valor?.find((r) => r.documentoId === id);
    expect(cuenta?.codigo).toBe('CB-0009');
    expect(cuenta?.numeroCuenta).toBe(CUENTA.numeroCuenta);

    const detalle = esperar(http.get<SolicitudResponse>(`${API}/solicitudes/${id}`, { headers: luis }));
    expect(detalle.valor?.historialEstados?.map((h) => h.estadoNuevo)).toEqual(['NUEVO', 'ELABORADO', 'VERIFICADO', 'APROBADO']);

    const avisosAna = esperar(http.get<{ titulo: string; documento: { id: string } }[]>(`${API}/notificaciones`, { headers: ana }));
    expect(avisosAna.valor?.some((n) => n.documento.id === id && n.titulo === 'Solicitud aprobada')).toBeTrue();
  }));

  it('observar pide comentario y una solicitud observada ya no se puede eliminar', fakeAsync(() => {
    const luis = entrar('aprobador');
    const bandeja = esperar(http.get<SolicitudResponse[]>(`${API}/solicitudes/bandeja-aprobador?tipos=SRCB`, { headers: luis }));
    const verificada = bandeja.valor!.find((s) => s.estado === 'VERIFICADO')!;

    expect(esperar(http.patch(`${API}/solicitudes/${verificada.id}/estado`, { estadoNuevo: 'OBSERVADO' }, { headers: luis })).error?.status).toBe(400);
    esperar(http.patch(`${API}/solicitudes/${verificada.id}/estado`, { estadoNuevo: 'OBSERVADO', comentario: 'Falta la constancia.' }, { headers: luis }));

    const ana = entrar('creador');
    esperar(http.patch(`${API}/solicitudes/${verificada.id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: ana }));
    const eliminar = esperar(http.patch(`${API}/solicitudes/${verificada.id}/estado`, { estadoNuevo: 'ELIMINADO' }, { headers: ana }));

    expect(eliminar.error?.status).toBe(409);
    expect(eliminar.error?.error.message).toContain('observada');
  }));

  describe('conciliación manual diaria (SCMD)', () => {
    /** Un registro ya conciliado: montos completos en el libro banco y en el registro de operaciones bancarias. */
    const conciliado = (i: number): ConciliacionManualDatos['registros'][number] => ({
      ...REGISTROS_NO_CONCILIADOS[i],
      lbDebito: '0.00',
      lbCredito: '1,000.00',
      rbDebito: '0.00',
      rbCredito: '1,000.00',
      motivo: '-',
      conciliado: true,
      sustentos: [{ tipo: 'Constancia', nombre: 'constancia.pdf' }],
      justificacion: 'Coincide con el libro banco.',
    });
    const DETALLE: ConciliacionManualDatos = { numeroCuenta: CUENTAS_CONCILIACION[0].numeroCuenta, registros: [conciliado(0)] };

    it('lista el tipo de documento y numera la conciliación con su propio correlativo', fakeAsync(() => {
      const ana = entrar('creador');
      const tipos = esperar(http.get<{ id: string; codigo: string; proceso: { codigo: string } }[]>(`${API}/tipos-documento`, { headers: ana }));
      const tipo = tipos.valor!.find((t) => t.codigo === 'SCMD')!;
      expect(tipo.proceso.codigo).toBe('conciliacion-diaria');

      const creada = esperar(http.post<SolicitudResponse>(`${API}/solicitudes`, { tipoDocumentoId: tipo.id, tipoAccion: 'creacion', organoLinea: 'DGTP', justificacion: 'Prueba' }, { headers: ana }));
      const id = creada.valor!.id;
      expect(creada.valor?.catDocumento?.codigo).toBe('SCMD');

      // Sin cuenta y registros no se puede elaborar; la conciliación no pide sustento.
      expect(esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: ana })).error?.status).toBe(400);
      esperar(http.post(`${API}/solicitudes/${id}/conciliacion-manual`, DETALLE, { headers: ana }));
      const elaborada = esperar(http.patch<{ numero: string }>(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: ana }));

      expect(elaborada.valor?.numero).toMatch(/^000005-\d{4}$/);
    }));

    it('exige la cuenta y, en cada registro conciliado, el débito, el crédito y el sustento', fakeAsync(() => {
      const ana = entrar('creador');
      const creada = esperar(http.post<SolicitudResponse>(`${API}/solicitudes`, { tipoDocumentoId: 'td-scmd', tipoAccion: 'creacion', organoLinea: 'DGTP', justificacion: 'Prueba' }, { headers: ana }));
      const guardar = (detalle: unknown) => esperar(http.post(`${API}/solicitudes/${creada.valor!.id}/conciliacion-manual`, detalle, { headers: ana })).error;

      expect(guardar({ numeroCuenta: 'inexistente', registros: [conciliado(0)] })?.status).toBe(400);
      expect(guardar({ numeroCuenta: DETALLE.numeroCuenta, registros: [{ ...conciliado(0), rbCredito: '' }] })?.error.message).toContain('débito, el crédito');
      // Un registro sin conciliar todavía puede grabarse (los registros son opcionales «en este momento»).
      expect(guardar({ numeroCuenta: DETALLE.numeroCuenta, registros: [{ ...REGISTROS_NO_CONCILIADOS[0] }] })).toBeUndefined();
      expect(guardar({ numeroCuenta: DETALLE.numeroCuenta, registros: [] })).toBeUndefined();
      expect(guardar({ numeroCuenta: DETALLE.numeroCuenta, registros: [{ ...conciliado(0), sustentos: [] }] })?.status).toBe(400);
      expect(guardar({ numeroCuenta: DETALLE.numeroCuenta, registros: [{ ...conciliado(0), justificacion: ' ' }] })?.status).toBe(400);
      expect(guardar(DETALLE)).toBeUndefined();
    }));

    it('el flujo de verificar y aprobar avisa con el tipo de documento de la conciliación y no crea registros de cuentas', fakeAsync(() => {
      const ana = entrar('creador');
      const creada = esperar(http.post<SolicitudResponse>(`${API}/solicitudes`, { tipoDocumentoId: 'td-scmd', tipoAccion: 'creacion', organoLinea: 'DGTP', justificacion: 'Prueba' }, { headers: ana }));
      const id = creada.valor!.id;
      esperar(http.post(`${API}/solicitudes/${id}/conciliacion-manual`, DETALLE, { headers: ana }));
      esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: ana }));
      esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'VERIFICADO' }, { headers: ana }));

      const luis = entrar('aprobador');
      const avisos = esperar(http.get<{ documento: { id: string; catDocumento: { codigo: string } } }[]>(`${API}/notificaciones`, { headers: luis }));
      expect(avisos.valor?.find((n) => n.documento.id === id)?.documento.catDocumento.codigo).toBe('SCMD');

      const antes = esperar(http.get<CuentaBancariaRegistro[]>(`${API}/cuentas-bancarias`, { headers: luis })).valor!.length;
      esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'APROBADO' }, { headers: luis }));
      expect(esperar(http.get<CuentaBancariaRegistro[]>(`${API}/cuentas-bancarias`, { headers: luis })).valor!.length).toBe(antes);
    }));
  });

  describe('modificación de registros conciliados', () => {
    const original = { ...DEMO_PROCESAMIENTO };
    afterEach(() => Object.assign(DEMO_PROCESAMIENTO, original));

    const registros = (headers: HttpHeaders) => esperar(http.get<RegistroConciliado[]>(`${API}/conciliaciones-manuales/registros`, { headers })).valor!;

    /** Una modificación en borrador: el registro de ejemplo ya conciliado, con el crédito corregido en ambos lados. */
    function modificacion(carla: HttpHeaders, tipoModificacion = 'Montos') {
      const creada = esperar(http.post<SolicitudResponse>(`${API}/solicitudes`, { tipoDocumentoId: 'td-scmd', tipoAccion: 'modificacion', organoLinea: 'DGTP', justificacion: 'Prueba' }, { headers: carla }));
      const id = creada.valor!.id;
      const actual = registros(carla)[0];
      const { documentos: _documentos, numeroCuenta: _cuenta, ...base } = actual;
      const corregido = { ...base, lbCredito: '1,300.00', rbCredito: '1,300.00', modificado: true, sustentos: [{ tipo: 'Constancia', nombre: 'modificacion.pdf' }], justificacion: 'Se corrige el monto.', ediciones: [{ lado: 'Libro banco', numero: base.lbNumero, campo: 'Crédito', antes: base.lbCredito, despues: '1,300.00' }] };
      const guardar = (detalle: object) => esperar(http.post(`${API}/solicitudes/${id}/conciliacion-manual`, detalle, { headers: carla })).error;
      return { id, actual, corregido, guardar, numeroCuenta: actual.numeroCuenta, tipoModificacion };
    }

    it('la conciliación ofrece la acción «modificación» y los registros conciliados salen del backend', fakeAsync(() => {
      const carla = entrar('creador');
      const tipos = esperar(http.get<{ codigo: string; accionesPermitidas: { tipoAccion: string }[] }[]>(`${API}/tipos-documento`, { headers: carla }));
      expect(tipos.valor!.find((t) => t.codigo === 'SCMD')!.accionesPermitidas.map((a) => a.tipoAccion)).toEqual(['creacion', 'modificacion']);

      const lista = registros(carla);
      expect(lista.length).toBe(2);
      expect(lista[0].documentos.map((d) => [d.tipoAccion, d.numero])).toEqual([['Creación', '000001-2026']]);
      expect(lista[0].motivo).toBe('-');
    }));

    it('exige el tipo de modificación y que los registros ya estén conciliados', fakeAsync(() => {
      const carla = entrar('creador');
      const { guardar, corregido, numeroCuenta } = modificacion(carla);

      expect(guardar({ numeroCuenta, registros: [corregido] })?.error.message).toContain('tipo de modificación');
      expect(guardar({ numeroCuenta, tipoModificacion: 'Otro', registros: [corregido] })?.status).toBe(400);
      expect(guardar({ numeroCuenta, tipoModificacion: 'Montos', registros: [{ ...corregido, id: 'nc-1' }] })?.error.message).toContain('registros conciliados');
      expect(guardar({ numeroCuenta, tipoModificacion: 'Montos', registros: [corregido] })).toBeUndefined();
    }));

    it('no se puede elaborar sin haber modificado cada registro', fakeAsync(() => {
      const carla = entrar('creador');
      const { id, guardar, corregido, numeroCuenta } = modificacion(carla);
      const elaborar = () => esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: carla })).error;

      guardar({ numeroCuenta, tipoModificacion: 'Montos', registros: [{ ...corregido, modificado: false }] });
      expect(elaborar()?.error.message).toContain('Modifique cada registro');
      guardar({ numeroCuenta, tipoModificacion: 'Montos', registros: [corregido] });
      expect(elaborar()).toBeUndefined();
    }));

    it('al aprobar, el registro toma los datos nuevos y su historial suma el documento de modificación', fakeAsync(() => {
      Object.assign(DEMO_PROCESAMIENTO, { escenario: 'aplicado', duracionMs: 60_000 });
      const carla = entrar('creador');
      const luis = entrar('aprobador');
      const { id, actual, corregido, guardar, numeroCuenta } = modificacion(carla);
      guardar({ numeroCuenta, tipoModificacion: 'Montos', registros: [corregido] });
      const numero = esperar(http.patch<{ numero: string }>(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: carla })).valor!.numero;
      esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'VERIFICADO' }, { headers: carla }));

      // Mientras no se apruebe, el registro sigue como estaba.
      expect(registros(luis)[0].lbCredito).toBe(actual.lbCredito);
      const aprobada = esperar(http.post<{ procesamiento: string }>(`${API}/conciliaciones-manuales/${id}/aprobar`, {}, { headers: luis }));
      expect(aprobada.valor?.procesamiento).toBe('EN_PROCESO');

      const despues = registros(luis);
      const modificado = despues.find((r) => r.id === actual.id)!;
      expect(despues.length).toBe(2);
      expect([modificado.lbCredito, modificado.rbCredito]).toEqual(['1,300.00', '1,300.00']);
      expect(modificado.documentos.map((d) => [d.tipoAccion, d.numero, d.tipoModificacion])).toEqual([
        ['Creación', '000001-2026', undefined],
        ['Modificación', numero, 'Montos'],
      ]);
      // Cada documento conserva los datos con los que se aprobó: la creación, lo conciliado; la modificación, lo corregido.
      expect([modificado.documentos[0].datos.lbCredito, modificado.documentos[1].datos.lbCredito]).toEqual([actual.lbCredito, '1,300.00']);
      expect(modificado.documentos[1]).toEqual(jasmine.objectContaining({ elaboradoPor: 'CARLA MENDOZA RÍOS', aprobadoPor: 'LUIS QUISPE SALAS', justificacion: 'Se corrige el monto.' }));
      expect(modificado.ediciones?.some((e) => e.despues === '1,300.00')).toBeTrue();
    }));

    it('al aprobar una creación con varios registros por lado, la aprobación genera la secuencia 1, 2, 3…', fakeAsync(() => {
      Object.assign(DEMO_PROCESAMIENTO, { escenario: 'aplicado', duracionMs: 60_000 });
      const carla = entrar('creador');
      const luis = entrar('aprobador');
      const id = esperar(http.post<SolicitudResponse>(`${API}/solicitudes`, { tipoDocumentoId: 'td-scmd', tipoAccion: 'creacion', organoLinea: 'DGTP', justificacion: 'Prueba' }, { headers: carla })).valor!.id;
      const linea = (n: string, credito: string) => ({ id: `l${n}`, fecha: '17/08/2026 10:00:00', numero: '02698160', descripcion: 'RR', entidad: 'SUNAT', debito: '0.00', credito, secuencia: '', original: { fecha: '17/08/2026 10:00:00', numero: '02698160', descripcion: 'RR', entidad: 'SUNAT', debito: '0.00', credito, secuencia: '' } });
      const grupo = { ...REGISTROS_NO_CONCILIADOS[0], lbDebito: '0.00', lbCredito: '1,000.00', rbDebito: '0.00', rbCredito: '1,000.00', conciliado: true, sustentos: [{ tipo: 'Constancia', nombre: 'c.pdf' }], justificacion: 'Coincide.', lbLineas: [linea('1', '1,000.00')], rbLineas: [linea('2', '300.00'), linea('3', '300.00'), linea('4', '400.00')] };
      esperar(http.post(`${API}/solicitudes/${id}/conciliacion-manual`, { numeroCuenta: CUENTAS_CONCILIACION[0].numeroCuenta, registros: [grupo] }, { headers: carla }));
      esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: carla }));
      esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'VERIFICADO' }, { headers: carla }));
      expect(leerDatos().solicitudes.find((x) => x.id === id)!.detalleConciliacionManual!.registros[0].rbLineas!.map((l) => l.secuencia)).withContext('antes de aprobar').toEqual(['', '', '']);

      esperar(http.post(`${API}/conciliaciones-manuales/${id}/aprobar`, {}, { headers: luis }));
      const nuevo = registros(luis).find((r) => r.documentos[0].documentoId === id)!;
      expect(nuevo.lbLineas!.map((l) => l.secuencia)).toEqual(['1']);
      expect(nuevo.rbLineas!.map((l) => l.secuencia)).toEqual(['1', '2', '3']);
      expect(nuevo.documentos[0].datos.rbLineas!.map((l) => l.secuencia)).toEqual(['1', '2', '3']);
    }));

    it('una creación aprobada suma sus registros conciliados a la lista', fakeAsync(() => {
      Object.assign(DEMO_PROCESAMIENTO, { escenario: 'aplicado', duracionMs: 60_000 });
      const carla = entrar('creador');
      const luis = entrar('aprobador');
      const creada = esperar(http.post<SolicitudResponse>(`${API}/solicitudes`, { tipoDocumentoId: 'td-scmd', tipoAccion: 'creacion', organoLinea: 'DGTP', justificacion: 'Prueba' }, { headers: carla }));
      const id = creada.valor!.id;
      const nuevo = { ...REGISTROS_NO_CONCILIADOS[0], lbDebito: '0.00', lbCredito: '1,000.00', rbDebito: '0.00', rbCredito: '1,000.00', conciliado: true, sustentos: [{ tipo: 'Constancia', nombre: 'c.pdf' }], justificacion: 'Coincide.' };
      esperar(http.post(`${API}/solicitudes/${id}/conciliacion-manual`, { numeroCuenta: CUENTAS_CONCILIACION[0].numeroCuenta, registros: [nuevo] }, { headers: carla }));
      const numero = esperar(http.patch<{ numero: string }>(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: carla })).valor!.numero;
      esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'VERIFICADO' }, { headers: carla }));
      esperar(http.post(`${API}/conciliaciones-manuales/${id}/aprobar`, {}, { headers: luis }));

      const lista = registros(luis);
      expect(lista.length).toBe(3);
      expect(lista[2].documentos.map((d) => [d.tipoAccion, d.numero])).toEqual([['Creación', numero]]);
      expect(lista[2].motivo).toBe('-');
    }));
  });

  describe('procesamiento de la conciliación tras la aprobación', () => {
    interface Aviso { titulo: string; mensaje: string; leida: boolean; documento: { id: string } }
    const original = { ...DEMO_PROCESAMIENTO };
    afterEach(() => Object.assign(DEMO_PROCESAMIENTO, original));

    /** Carla elabora y verifica una conciliación y Luis la aprueba: el documento queda Aprobado y el procesamiento, en proceso. */
    function aprobar(escenario: typeof DEMO_PROCESAMIENTO.escenario, duracionMs = 0) {
      Object.assign(DEMO_PROCESAMIENTO, { escenario, duracionMs });
      const carla = entrar('creador');
      const luis = entrar('aprobador');
      const creada = esperar(http.post<SolicitudResponse>(`${API}/solicitudes`, { tipoDocumentoId: 'td-scmd', tipoAccion: 'creacion', organoLinea: 'DGTP', justificacion: 'Prueba' }, { headers: carla }));
      const id = creada.valor!.id;
      const registro = { ...REGISTROS_NO_CONCILIADOS[0], lbDebito: '0.00', lbCredito: '1,000.00', rbDebito: '0.00', rbCredito: '1,000.00', conciliado: true, sustentos: [{ tipo: 'Constancia', nombre: 'c.pdf' }], justificacion: 'Coincide.' };
      esperar(http.post(`${API}/solicitudes/${id}/conciliacion-manual`, { numeroCuenta: CUENTAS_CONCILIACION[0].numeroCuenta, registros: [registro] }, { headers: carla }));
      const numero = esperar(http.patch<{ numero: string }>(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: carla })).valor!.numero;
      esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'VERIFICADO' }, { headers: carla }));
      const respuesta = esperar(http.post<{ estadoDocumento: string; procesamiento: string }>(`${API}/conciliaciones-manuales/${id}/aprobar`, {}, { headers: luis }));
      return { id, numero, carla, luis, respuesta };
    }
    const procesamiento = (id: string, headers: HttpHeaders) =>
      esperar(http.get<{ estado: string; sistemasConError: { nombre: string }[]; reintentosAgotados: boolean }>(`${API}/conciliaciones-manuales/${id}/procesamiento`, { headers })).valor!;
    const avisos = (headers: HttpHeaders, id: string) =>
      esperar(http.get<Aviso[]>(`${API}/notificaciones`, { headers })).valor!.filter((n) => n.documento.id === id && n.titulo.startsWith('Conciliación'));

    it('aprobar deja el documento Aprobado y el procesamiento en proceso, sin avisar todavía', fakeAsync(() => {
      const { id, respuesta, carla, luis } = aprobar('aplicado', 60_000);

      expect(respuesta.valor).toEqual({ estadoDocumento: 'APROBADO', procesamiento: 'EN_PROCESO' });
      expect(esperar(http.get<SolicitudResponse>(`${API}/solicitudes/${id}`, { headers: luis })).valor?.estado).toBe('APROBADO');
      expect(procesamiento(id, luis).estado).toBe('EN_PROCESO');
      expect(avisos(carla, id)).withContext('«en proceso» no genera notificación').toEqual([]);
    }));

    it('«aplicado»: al terminar avisa al elaborador y al aprobador', fakeAsync(() => {
      const { id, numero, carla, luis } = aprobar('aplicado');

      expect(procesamiento(id, luis)).toEqual(jasmine.objectContaining({ estado: 'APLICADO', sistemasConError: [], reintentosAgotados: false }));
      for (const quien of [carla, luis]) {
        const [aviso] = avisos(quien, id);
        expect(aviso.titulo).toBe(`Conciliación ${numero} aplicada`);
        expect(aviso.mensaje).toBe('Los sistemas relacionados se actualizaron.');
        expect(aviso.leida).toBeFalse();
      }
      // Una segunda consulta no repite el aviso.
      procesamiento(id, luis);
      expect(avisos(carla, id).length).toBe(1);
    }));

    it('«con incidencias»: el documento sigue Aprobado y se nombra el sistema que falló', fakeAsync(() => {
      const { id, numero, carla, luis } = aprobar('con-incidencias');
      const p = procesamiento(id, luis);

      expect(p.estado).toBe('CON_INCIDENCIAS');
      expect(p.sistemasConError.map((x) => x.nombre)).toEqual(['Contabilidad']);
      expect(p.reintentosAgotados).toBeFalse();
      expect(esperar(http.get<SolicitudResponse>(`${API}/solicitudes/${id}`, { headers: luis })).valor?.estado).toBe('APROBADO');
      expect(avisos(carla, id)[0].titulo).toBe(`Conciliación ${numero}: no se pudo actualizar Contabilidad`);
      expect(avisos(carla, id)[0].mensaje).toBe('El documento sigue aprobado.');
    }));

    it('«reintentos agotados»: fallan varios sistemas y el procesamiento lo indica', fakeAsync(() => {
      const { id, numero, carla, luis } = aprobar('reintentos-agotados');
      const p = procesamiento(id, luis);

      expect(p.sistemasConError.map((x) => x.nombre)).toEqual(['Libretas', 'Contabilidad']);
      expect(p.reintentosAgotados).toBeTrue();
      expect(avisos(carla, id)[0].titulo).toBe(`Conciliación ${numero}: no se pudo actualizar 2 sistemas: Libretas y Contabilidad`);
    }));

    it('«procesando» no termina nunca', fakeAsync(() => {
      const { id, luis } = aprobar('procesando');
      expect(procesamiento(id, luis).estado).toBe('EN_PROCESO');
    }));

    it('solo el aprobador aprueba y la conciliación aprobada de ejemplo ya está aplicada', fakeAsync(() => {
      const carla = entrar('creador');
      const luis = entrar('aprobador');
      const aprobada = leerDatos().solicitudes.find((x) => x.estado === 'APROBADO' && x.catDocumento?.codigo === 'SCMD')!;
      expect(esperar(http.post(`${API}/conciliaciones-manuales/${aprobada.id}/aprobar`, {}, { headers: carla })).error?.status).toBe(409);
      expect(procesamiento(aprobada.id, luis).estado).toBe('APLICADO');
      expect(esperar(http.get(`${API}/conciliaciones-manuales/inexistente/procesamiento`, { headers: luis })).error?.status).toBe(404);
    }));
  });

  describe('libretas de las cuentas de registro (/libretas)', () => {
    it('filtra los movimientos en el servidor con los parámetros de la URL', fakeAsync(() => {
      const url = `${API}/libretas/movimientos?desde=2026-09-01&hasta=2026-09-30&cuentasBancarias=mef-dgtp&tiposOperacion=1,5`;
      const { valor } = esperar(http.get<MovimientoLibretaRegistro[]>(url));

      expect(valor!.length).toBeGreaterThan(0);
      expect(valor!.every((m) => m.cuentaBancariaId === 'mef-dgtp' && m.fecha.startsWith('2026-09') && ['1', '5'].includes(m.tipoOperacionCodigo))).toBeTrue();

      const todos = esperar(http.get<MovimientoLibretaRegistro[]>(`${API}/libretas/movimientos`));
      expect(todos.valor!.length).toBeGreaterThan(valor!.length);
    }));

    it('lista los documentos (con filtro de estado) y entrega el detalle de uno, rechazado incluido', fakeAsync(() => {
      const rechazados = esperar(http.get<DocumentoLibreta[]>(`${API}/libretas/documentos?estado=Rechazado`));
      expect(rechazados.valor!.map((d) => d.numero)).toEqual(['000017-2026']);
      const pendientes = esperar(http.get<DocumentoLibreta[]>(`${API}/libretas/documentos?estado=Pendiente`));
      expect(pendientes.valor!.map((d) => d.numero)).toEqual(['000016-2026', '000018-2026']);

      const detalle = esperar(http.get<DetalleDocumentoLibreta>(`${API}/libretas/documentos/000016-2026`));
      expect(detalle.valor?.documento.codigoError).toBe('P-001');
      expect(detalle.valor?.movimientos.length).toBe(2);

      expect(esperar(http.get(`${API}/libretas/documentos/no-existe`)).error?.status).toBe(404);
    }));

    it('entrega el registro con su documento, y 404 si no existe', fakeAsync(() => {
      const normal = esperar(http.get<DetalleMovimientoLibreta>(`${API}/libretas/registros/000001`));
      expect(normal.valor?.rechazado).toBeFalse();
      expect(normal.valor?.movimiento.sec).toBe('000001');

      const rechazado = esperar(http.get<DetalleMovimientoLibreta>(`${API}/libretas/registros/000056`));
      expect(rechazado.valor?.rechazado).toBeTrue();

      expect(esperar(http.get(`${API}/libretas/registros/zzz`)).error?.status).toBe(404);
    }));

    it('entrega las cuentas de registro de la libreta', fakeAsync(() => {
      const { valor } = esperar(http.get<CuentaRegistroCatalogo[]>(`${API}/libretas/cuentas-registro`));
      expect(valor!.length).toBeGreaterThan(0);
      expect(valor![0].numero).toBeTruthy();
    }));
  });

  it('deja pasar lo que no es de la API (los assets)', () => {
    http.get('assets/datos.json').subscribe();

    red.expectOne('assets/datos.json').flush({});
  });
});
