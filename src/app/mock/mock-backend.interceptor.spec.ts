import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Observable } from 'rxjs';

import type { LoginResponse } from '../core/api/auth-api.service';
import type { SolicitudResponse } from '../core/api/solicitudes-api.service';
import type { CuentaBancariaDatos, CuentaBancariaRegistro } from '../modules/tesoreria/cuentas-bancarias/models/cuenta-bancaria.model';
import { CUENTAS_CONCILIACION, ConciliacionManualDatos, REGISTROS_NO_CONCILIADOS } from '../modules/tesoreria/conciliacion-diaria/models/conciliacion-diaria.model';
import type { DetalleDocumentoLibreta, DetalleMovimientoLibreta, DocumentoLibreta, MovimientoLibretaRegistro, CuentaRegistroCatalogo } from '../modules/tesoreria/registro-libretas-cuentas-registro/models/registro-libretas.model';
import { mockBackendInterceptor } from './mock-backend.interceptor';
import { reiniciarDatosDemo } from './mock-db';
import { CONTRASENA_DEMO } from './usuarios-demo';

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

  /** Entra con el usuario de demostración y, si se pide, cambia a ese perfil (creador por defecto). */
  function entrar(perfil: 'creador' | 'aprobador' | 'visualizador' = 'creador'): HttpHeaders {
    const { valor } = esperar(http.post<LoginResponse>(`${API}/auth/login`, { dni: '33333333', password: CONTRASENA_DEMO }));
    const headers = new HttpHeaders({ Authorization: `Bearer ${valor!.accessToken}` });
    if (perfil === 'creador') return headers;
    const cambio = esperar(http.patch<{ accessToken: string }>(`${API}/auth/cambiar-perfil`, { perfilId: `perfil-demo-${perfil}` }, { headers }));
    return new HttpHeaders({ Authorization: `Bearer ${cambio.valor!.accessToken}` });
  }

  function archivo(): FormData {
    const form = new FormData();
    form.append('archivo', new File(['%PDF'], 'constancia.pdf', { type: 'application/pdf' }));
    return form;
  }

  beforeEach(() => {
    reiniciarDatosDemo();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([mockBackendInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    red = TestBed.inject(HttpTestingController);
  });

  // Ninguna llamada a la API sale a la red: las responde el simulador.
  afterEach(() => red.verify());

  afterAll(() => reiniciarDatosDemo());

  it('rechaza una contraseña incorrecta con el mensaje que muestra el login', fakeAsync(() => {
    const { error } = esperar(http.post(`${API}/auth/login`, { dni: '33333333', password: 'otra' }));

    expect(error?.status).toBe(401);
    expect(error?.error.message).toContain('DNI o contraseña incorrectos');
  }));

  it('entrega los perfiles del usuario y cambia al que se elige', fakeAsync(() => {
    const { valor } = esperar(http.post<LoginResponse>(`${API}/auth/login`, { dni: '33333333', password: CONTRASENA_DEMO }));
    expect(valor?.perfilesDisponibles.map((p) => p.rolCodigo)).toEqual(['CREADOR', 'APROBADOR', 'VISUALIZADOR']);

    const headers = new HttpHeaders({ Authorization: `Bearer ${valor!.accessToken}` });
    const cambio = esperar(http.patch<{ perfilActivo: { rolCodigo: string } }>(`${API}/auth/cambiar-perfil`, { perfilId: 'perfil-demo-aprobador' }, { headers }));

    expect(cambio.valor?.perfilActivo.rolCodigo).toBe('APROBADOR');
  }));

  it('la bandeja no muestra solicitudes en NUEVO y pagina si se pide', fakeAsync(() => {
    const headers = entrar('creador');
    esperar(http.post(`${API}/solicitudes`, { tipoAccion: 'creacion', organoLinea: 'OGA', justificacion: 'Borrador' }, { headers }));

    const { valor } = esperar(http.get<{ data: SolicitudResponse[]; total: number }>(`${API}/solicitudes/bandeja-creador?tipos=SRCB&page=1&limit=5`, { headers }));

    expect(valor?.data.length).toBe(5);
    expect(valor?.total).toBe(12);
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
    expect(elaborada.valor?.numero).toMatch(/^PCB-SRCB-00013-\d{4}-MEF-OGA$/);

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

  describe('libretas de las cuentas de registro (/libretas)', () => {
    it('filtra los movimientos en el servidor con los parámetros de la URL', fakeAsync(() => {
      const url = `${API}/libretas/movimientos?desde=2026-09-01&hasta=2026-09-30&cuentasBancarias=mef-dgtp&tiposOperacion=2,3`;
      const { valor } = esperar(http.get<MovimientoLibretaRegistro[]>(url));

      expect(valor!.length).toBeGreaterThan(0);
      expect(valor!.every((m) => m.cuentaBancariaId === 'mef-dgtp' && m.fecha.startsWith('2026-09') && ['2', '3'].includes(m.tipoOperacionCodigo))).toBeTrue();

      const todos = esperar(http.get<MovimientoLibretaRegistro[]>(`${API}/libretas/movimientos`));
      expect(todos.valor!.length).toBeGreaterThan(valor!.length);
    }));

    it('lista los documentos (con filtro de estado) y entrega el detalle de uno, rechazado incluido', fakeAsync(() => {
      const rechazados = esperar(http.get<DocumentoLibreta[]>(`${API}/libretas/documentos?estado=Rechazado`));
      expect(rechazados.valor!.map((d) => d.numero)).toEqual(['000016-2026', '000017-2026', '000018-2026']);

      const detalle = esperar(http.get<DetalleDocumentoLibreta>(`${API}/libretas/documentos/000016-2026`));
      expect(detalle.valor?.documento.motivoRechazo).toContain('validaciones');
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
