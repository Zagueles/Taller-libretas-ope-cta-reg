import type { NotificacionResponse } from '../core/api/notificaciones-api.service';
import type { HistorialItem, SolicitudResponse } from '../core/api/solicitudes-api.service';
import type { EstadoDocumento } from '../core/models/documento.model';
import {
  CODIGO_DOCUMENTO,
  CuentaBancariaDatos,
  CuentaBancariaRegistro,
  NOMBRE_DOCUMENTO,
} from '../modules/tesoreria/cuentas-bancarias/models/cuenta-bancaria.model';
import {
  CODIGO_DOCUMENTO as CODIGO_CONCILIACION,
  CUENTAS_CONCILIACION,
  ConciliacionManualDatos,
  NOMBRE_DOCUMENTO as NOMBRE_CONCILIACION,
  REGISTROS_NO_CONCILIADOS,
} from '../modules/tesoreria/conciliacion-diaria/models/conciliacion-diaria.model';
import type { QueryReportFavorite } from '../shared/types/query-report.types';
import { USUARIOS_DEMO, UsuarioDemo } from './usuarios-demo';

/**
 * «Base de datos» del backend simulado: vive en el `localStorage` del navegador, así lo que hace un usuario lo ve
 * otro al iniciar sesión (en el mismo navegador). `reiniciarDatosDemo()` vuelve a los datos iniciales.
 */

const CLAVE = 'taller-siaf-rp:datos';
const VERSION = 4;

export interface NotificacionMock extends NotificacionResponse {
  /** Destinatario: un usuario puntual o, si no hay, todos los perfiles con este rol. */
  paraUsuarioId?: string;
  paraRolCodigo?: 'CREADOR' | 'APROBADOR';
}

export interface DatosTaller {
  version: number;
  solicitudes: SolicitudResponse[];
  registros: CuentaBancariaRegistro[];
  notificaciones: NotificacionMock[];
  correlativoDocumento: number;
  correlativoRegistro: number;
  /** Correlativo de la conciliación manual diaria (se reinicia cada año en el sistema real; en el taller es único). */
  correlativoConciliacion: number;
  secuencia: number;
  /** Favoritos de «Consultas y reportes», por reporte (clave = ruta del proceso). */
  favoritos: Record<string, QueryReportFavorite[]>;
}

export const TIPO_DOCUMENTO = { id: 'td-srcb', codigo: CODIGO_DOCUMENTO, nombre: NOMBRE_DOCUMENTO };
export const TIPO_DOCUMENTO_CONCILIACION = { id: 'td-scmd', codigo: CODIGO_CONCILIACION, nombre: NOMBRE_CONCILIACION };
export const ENTIDAD_CREADORA = { id: 'ent-mef', codMef: '0001', siglas: 'MEF', nombre: 'Ministerio de Economía y Finanzas' };
export const UNIDAD_CREADORA = { id: 'uo-oga', sigla: 'OGA', nombre: 'Oficina General de Administración' };

export function leerDatos(): DatosTaller {
  try {
    const guardados = localStorage.getItem(CLAVE);
    if (guardados) {
      const datos = JSON.parse(guardados) as DatosTaller;
      if (datos.version === VERSION) return datos;
    }
  } catch {
    // Datos corruptos o sin acceso al almacenamiento: se empieza de nuevo.
  }
  const iniciales = crearDatosIniciales();
  guardarDatos(iniciales);
  return iniciales;
}

export function guardarDatos(datos: DatosTaller): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    // Sin almacenamiento (modo privado estricto): los cambios duran lo que dure la pestaña.
  }
}

export function leerFavoritos(reporte: string): QueryReportFavorite[] {
  return leerDatos().favoritos[reporte] ?? [];
}

export function guardarFavoritos(reporte: string, favoritos: QueryReportFavorite[]): void {
  const datos = leerDatos();
  datos.favoritos[reporte] = favoritos;
  guardarDatos(datos);
}

/** Vuelve a los datos iniciales de la demo. */
export function reiniciarDatosDemo(): void {
  guardarDatos(crearDatosIniciales());
}

export function nuevoId(datos: DatosTaller, prefijo: string): string {
  datos.secuencia += 1;
  return `${prefijo}-${datos.secuencia}`;
}

export function numeroDocumento(correlativo: number, fecha: Date): string {
  return `PCB-SRCB-${String(correlativo).padStart(5, '0')}-${fecha.getFullYear()}-MEF-OGA`;
}

/** Número de la conciliación manual diaria: correlativo de 6 dígitos y año («000010-2025»). */
export function numeroConciliacion(correlativo: number, fecha: Date): string {
  return `${String(correlativo).padStart(6, '0')}-${fecha.getFullYear()}`;
}

export function filaHistorial(
  datos: DatosTaller,
  anterior: EstadoDocumento | null,
  nuevo: EstadoDocumento,
  fecha: string,
  usuario: UsuarioDemo,
  rol: { codigo: string; nombre: string },
  comentario: string | null = null,
): HistorialItem {
  return {
    id: nuevoId(datos, 'hist'),
    estadoAnterior: anterior,
    estadoNuevo: nuevo,
    comentario,
    createdAt: fecha,
    creador: { nombres: usuario.nombres, apellidoPaterno: usuario.apellidoPaterno, apellidoMaterno: usuario.apellidoMaterno },
    perfil: { cfgPerfil: { rol } },
  };
}

// ─── Datos iniciales ───────────────────────────────────────────────

const ROL_CREADOR = { codigo: 'CREADOR', nombre: 'Creador' };
const ROL_APROBADOR = { codigo: 'APROBADOR', nombre: 'Aprobador' };

interface Semilla {
  datos: CuentaBancariaDatos;
  /** Día en que se creó la solicitud (yyyy-mm-dd). */
  creada: string;
  estado: 'ELABORADO' | 'VERIFICADO' | 'APROBADO' | 'OBSERVADO' | 'RECHAZADO';
  justificacion: string;
  comentario?: string;
  registroInactivo?: boolean;
}

function cuenta(banco: string, tipo: 'CORRIENTE' | 'AHORROS', moneda: 'PEN' | 'USD', n: number, denominacion: string, apertura: string, recaudadora: boolean): CuentaBancariaDatos {
  return {
    bancoCodigo: banco,
    tipoCuenta: tipo,
    moneda,
    numeroCuenta: `${banco}100${String(58213400000000 + n * 7919).slice(-14)}`,
    denominacion,
    fechaApertura: apertura,
    esRecaudadora: recaudadora,
  };
}

const SEMILLAS: Semilla[] = [
  { creada: '2026-01-16', estado: 'APROBADO', justificacion: 'Cuenta para la recaudación de tasas por procedimientos administrativos.', datos: cuenta('018', 'CORRIENTE', 'PEN', 1, 'Recaudación de tasas administrativas', '2026-01-15', true) },
  { creada: '2026-02-04', estado: 'APROBADO', justificacion: 'Cuenta para pagos a proveedores del exterior en dólares.', datos: cuenta('002', 'CORRIENTE', 'USD', 2, 'Pagos a proveedores del exterior', '2026-02-03', false) },
  { creada: '2026-02-23', estado: 'APROBADO', justificacion: 'Cuenta de ahorros para el fondo de caja chica de la oficina.', datos: cuenta('003', 'AHORROS', 'PEN', 3, 'Fondo de caja chica', '2026-02-20', false) },
  { creada: '2026-03-12', estado: 'APROBADO', justificacion: 'Cuenta para la recaudación de multas administrativas.', datos: cuenta('011', 'CORRIENTE', 'PEN', 4, 'Recaudación de multas', '2026-03-11', true) },
  { creada: '2026-04-09', estado: 'APROBADO', justificacion: 'Cuenta para las transferencias a unidades ejecutoras.', datos: cuenta('018', 'CORRIENTE', 'PEN', 5, 'Transferencias a unidades ejecutoras', '2026-04-08', false) },
  { creada: '2026-05-20', estado: 'APROBADO', justificacion: 'Cuenta para garantías recibidas en moneda extranjera.', datos: cuenta('009', 'AHORROS', 'USD', 6, 'Garantías en moneda extranjera', '2026-05-19', false), registroInactivo: true },
  { creada: '2026-06-03', estado: 'APROBADO', justificacion: 'Cuenta para la recaudación de servicios no exclusivos.', datos: cuenta('018', 'CORRIENTE', 'PEN', 7, 'Recaudación de servicios no exclusivos', '2026-06-02', true) },
  { creada: '2026-07-15', estado: 'APROBADO', justificacion: 'Cuenta de ahorros para encargos a las oficinas desconcentradas.', datos: cuenta('002', 'AHORROS', 'PEN', 8, 'Encargos a oficinas desconcentradas', '2026-07-14', false) },
  { creada: '2026-08-06', estado: 'RECHAZADO', justificacion: 'Cuenta para la recaudación de derechos de trámite.', datos: cuenta('009', 'CORRIENTE', 'PEN', 9, 'Recaudación de derechos de trámite', '2026-08-05', true), comentario: '[Información incorrecta] La cuenta ya está registrada con el código CB-0004.' },
  { creada: '2026-08-24', estado: 'VERIFICADO', justificacion: 'Cuenta en dólares para los fondos de cooperación internacional.', datos: cuenta('003', 'CORRIENTE', 'USD', 10, 'Fondos de cooperación internacional', '2026-08-21', false) },
  { creada: '2026-09-02', estado: 'OBSERVADO', justificacion: 'Cuenta para la recaudación por alquiler de ambientes.', datos: cuenta('011', 'CORRIENTE', 'PEN', 11, 'Recaudación de alquileres', '2026-09-01', true), comentario: 'Adjunte la constancia de apertura emitida por el banco.' },
  { creada: '2026-09-09', estado: 'ELABORADO', justificacion: 'Cuenta de ahorros para el fondo de viáticos.', datos: cuenta('018', 'AHORROS', 'PEN', 12, 'Fondo de viáticos', '2026-09-08', false) },
];

function enFecha(dia: string, horas: number, dias = 0): string {
  const fecha = new Date(`${dia}T00:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  fecha.setHours(horas, 15 + dias * 7, 0, 0);
  return fecha.toISOString();
}

function crearDatosIniciales(): DatosTaller {
  const datos: DatosTaller = {
    version: VERSION,
    solicitudes: [],
    registros: [],
    notificaciones: [],
    correlativoDocumento: 0,
    correlativoRegistro: 0,
    correlativoConciliacion: 0,
    secuencia: 0,
    favoritos: {},
  };
  // Un solo usuario de demostración: las solicitudes iniciales las crea con su perfil de creador y las resuelve con el de aprobador.
  const ana = USUARIOS_DEMO[0];
  const luis = USUARIOS_DEMO[0];

  for (const semilla of SEMILLAS) {
    const id = nuevoId(datos, 'sol');
    datos.correlativoDocumento += 1;
    const creada = enFecha(semilla.creada, 9);
    const numero = numeroDocumento(datos.correlativoDocumento, new Date(creada));
    const historial: HistorialItem[] = [
      filaHistorial(datos, null, 'NUEVO', creada, ana, ROL_CREADOR),
      filaHistorial(datos, 'NUEVO', 'ELABORADO', enFecha(semilla.creada, 9, 0), ana, ROL_CREADOR),
    ];
    if (semilla.estado !== 'ELABORADO') {
      historial.push(filaHistorial(datos, 'ELABORADO', 'VERIFICADO', enFecha(semilla.creada, 10, 1), ana, ROL_CREADOR));
    }
    if (['APROBADO', 'OBSERVADO', 'RECHAZADO'].includes(semilla.estado)) {
      historial.push(filaHistorial(datos, 'VERIFICADO', semilla.estado, enFecha(semilla.creada, 11, 2), luis, ROL_APROBADOR, semilla.comentario ?? null));
    }
    const ultima = historial[historial.length - 1].createdAt;

    const solicitud: SolicitudResponse = {
      id,
      numero,
      catDocumento: TIPO_DOCUMENTO,
      tipoAccion: 'creacion',
      estado: semilla.estado,
      asuntoMotivo: `[OFICINA GENERAL DE ADMINISTRACIÓN] ${semilla.justificacion}`,
      entidadCreadora: ENTIDAD_CREADORA,
      unidadCreadora: UNIDAD_CREADORA,
      creador: { id: ana.id, nombres: ana.nombres, apellidoPaterno: ana.apellidoPaterno, apellidoMaterno: ana.apellidoMaterno },
      fechaRegistro: creada,
      createdAt: creada,
      updatedAt: ultima,
      itemsCuenta: [],
      detalleCuentaBancaria: { documentoId: id, ...semilla.datos },
      sustentos: [
        {
          id: nuevoId(datos, 'sus'),
          tipoSustento: 'sustento',
          archivo: { nombreOriginal: `Constancia de apertura ${String(datos.correlativoDocumento).padStart(2, '0')}.pdf`, storagePath: 'taller' },
        },
      ],
      historialEstados: historial,
    };
    datos.solicitudes.push(solicitud);

    if (semilla.estado === 'APROBADO') {
      datos.correlativoRegistro += 1;
      datos.registros.push({
        id: nuevoId(datos, 'cb'),
        codigo: `CB-${String(datos.correlativoRegistro).padStart(4, '0')}`,
        estado: semilla.registroInactivo ? 'Inactivo' : 'Activo',
        entidadSiglas: 'MEF',
        documentoId: id,
        numeroDocumento: numero,
        fechaRegistro: ultima,
        ...semilla.datos,
      });
    }
  }

  sembrarConciliaciones(datos, ana, luis);

  // Notificaciones: el aprobador tiene una solicitud por aprobar; el creador, una observada y otras ya leídas.
  const aviso = (s: SolicitudResponse, tipo: string, titulo: string, mensaje: string, leida: boolean, destino: Pick<NotificacionMock, 'paraUsuarioId' | 'paraRolCodigo'>): NotificacionMock => ({
    id: nuevoId(datos, 'not'),
    tipo,
    titulo,
    mensaje,
    leida,
    leidaEn: leida ? s.updatedAt ?? null : null,
    createdAt: s.updatedAt ?? s.createdAt,
    documento: { id: s.id, numero: s.numero, catDocumento: { ...TIPO_DOCUMENTO, ...s.catDocumento } },
    ...destino,
  });
  const porEstado = (estado: string) => datos.solicitudes.filter((s) => s.estado === estado);
  for (const s of porEstado('VERIFICADO')) {
    datos.notificaciones.push(aviso(s, 'DOCUMENTO_VERIFICADO', 'Solicitud por aprobar', `La solicitud ${s.numero} fue verificada y espera su aprobación.`, false, { paraRolCodigo: 'APROBADOR' }));
  }
  for (const s of porEstado('OBSERVADO')) {
    datos.notificaciones.push(aviso(s, 'DOCUMENTO_OBSERVADO', 'Solicitud observada', `La solicitud ${s.numero} fue observada: revise el comentario y subsane.`, false, { paraRolCodigo: 'CREADOR' }));
  }
  for (const s of porEstado('RECHAZADO')) {
    datos.notificaciones.push(aviso(s, 'DOCUMENTO_RECHAZADO', 'Solicitud rechazada', `La solicitud ${s.numero} fue rechazada.`, true, { paraRolCodigo: 'CREADOR' }));
  }
  const ultimaAprobada = porEstado('APROBADO').at(-1);
  if (ultimaAprobada) {
    datos.notificaciones.push(aviso(ultimaAprobada, 'DOCUMENTO_APROBADO', 'Solicitud aprobada', `La solicitud ${ultimaAprobada.numero} fue aprobada.`, true, { paraRolCodigo: 'CREADOR' }));
  }

  return datos;
}

// ─── Conciliación manual diaria ────────────────────────────────────

/** Un registro que el creador ya concilió a mano: montos completos en ambas fuentes. */
function registroConciliado(base: (typeof REGISTROS_NO_CONCILIADOS)[number], credito: string): (typeof REGISTROS_NO_CONCILIADOS)[number] {
  const propio = base.lbNumero ? 'lb' : 'rb';
  return {
    ...base,
    lbFecha: base.lbFecha || base.rbFecha,
    lbNumero: base.lbNumero || base.rbNumero,
    lbDescripcion: base.lbDescripcion || base.rbDescripcion,
    lbEntidad: base.lbEntidad || 'SUNAT',
    lbDebito: base.lbDebito || '0.00',
    lbCredito: base.lbCredito || credito,
    rbFecha: base.rbFecha || base.lbFecha,
    rbNumero: base.rbNumero || base.lbNumero,
    rbDescripcion: base.rbDescripcion || base.lbDescripcion,
    rbDebito: base.rbDebito || '0.00',
    rbCredito: base.rbCredito || (propio === 'lb' ? base.lbCredito : credito),
    motivo: '-',
    conciliado: true,
    sustentos: [{ tipo: 'Constancia', nombre: `Constancia registro ${base.nro}.pdf` }],
    justificacion: 'La operación bancaria coincide con el registro del libro banco.',
  };
}

interface SemillaConciliacion {
  creada: string;
  estado: 'ELABORADO' | 'VERIFICADO' | 'APROBADO' | 'OBSERVADO';
  cuenta: number;
  registros: number[];
  comentario?: string;
}

const SEMILLAS_CONCILIACION: SemillaConciliacion[] = [
  { creada: '2026-08-18', estado: 'APROBADO', cuenta: 0, registros: [0, 1] },
  { creada: '2026-09-04', estado: 'VERIFICADO', cuenta: 2, registros: [2] },
  { creada: '2026-09-16', estado: 'OBSERVADO', cuenta: 0, registros: [3], comentario: 'Adjunte el sustento de la operación bancaria conciliada.' },
  { creada: '2026-09-28', estado: 'ELABORADO', cuenta: 5, registros: [0] },
];

function sembrarConciliaciones(datos: DatosTaller, creador: UsuarioDemo, aprobador: UsuarioDemo): void {
  for (const semilla of SEMILLAS_CONCILIACION) {
    const id = nuevoId(datos, 'sol');
    datos.correlativoConciliacion += 1;
    const creada = enFecha(semilla.creada, 9);
    const numero = numeroConciliacion(datos.correlativoConciliacion, new Date(creada));
    const historial: HistorialItem[] = [
      filaHistorial(datos, null, 'NUEVO', creada, creador, ROL_CREADOR),
      filaHistorial(datos, 'NUEVO', 'ELABORADO', creada, creador, ROL_CREADOR),
    ];
    if (semilla.estado !== 'ELABORADO') historial.push(filaHistorial(datos, 'ELABORADO', 'VERIFICADO', enFecha(semilla.creada, 10, 1), creador, ROL_CREADOR));
    if (semilla.estado === 'APROBADO' || semilla.estado === 'OBSERVADO') {
      historial.push(filaHistorial(datos, 'VERIFICADO', semilla.estado, enFecha(semilla.creada, 11, 2), aprobador, ROL_APROBADOR, semilla.comentario ?? null));
    }
    const detalle: ConciliacionManualDatos = {
      numeroCuenta: CUENTAS_CONCILIACION[semilla.cuenta].numeroCuenta,
      registros: semilla.registros.map((i) => registroConciliado(REGISTROS_NO_CONCILIADOS[i], '1,000.00')),
    };
    datos.solicitudes.push({
      id,
      numero,
      catDocumento: TIPO_DOCUMENTO_CONCILIACION,
      tipoAccion: 'creacion',
      estado: semilla.estado,
      asuntoMotivo: '[DIRECCIÓN GENERAL DEL TESORO PÚBLICO] Conciliación manual de registros no conciliados.',
      entidadCreadora: ENTIDAD_CREADORA,
      unidadCreadora: UNIDAD_CREADORA,
      creador: { id: creador.id, nombres: creador.nombres, apellidoPaterno: creador.apellidoPaterno, apellidoMaterno: creador.apellidoMaterno },
      fechaRegistro: creada,
      createdAt: creada,
      updatedAt: historial[historial.length - 1].createdAt,
      itemsCuenta: [],
      detalleCuentaBancaria: null,
      detalleConciliacionManual: { documentoId: id, ...detalle },
      sustentos: [],
      historialEstados: historial,
    });
  }
}
