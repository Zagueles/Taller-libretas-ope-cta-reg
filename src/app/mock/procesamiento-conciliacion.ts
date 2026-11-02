import type { ProcesamientoConciliacion, SistemaConError } from '../modules/tesoreria/conciliacion-diaria/models/conciliacion-diaria.model';

/**
 * Procesamiento simulado de la conciliación manual tras la aprobación: el motor actualiza las libretas y la contabilidad
 * en segundo plano. El backend real lo hace de forma asíncrona; aquí `EN_PROCESO` dura `DEMO_PROCESAMIENTO.duracionMs` y
 * luego termina según el escenario. Para la clase, cambiar `escenario` (o `duracionMs`) antes de aprobar.
 */
export type EscenarioProcesamiento = 'procesando' | 'aplicado' | 'con-incidencias' | 'reintentos-agotados';

export const DEMO_PROCESAMIENTO: { escenario: EscenarioProcesamiento; duracionMs: number } = {
  /** `procesando` no termina nunca; `aplicado`, `con-incidencias` (falla Contabilidad) y `reintentos-agotados` (fallan Libretas y Contabilidad). */
  escenario: 'aplicado',
  duracionMs: 8000,
};

export const SISTEMAS = {
  libretas: { codigo: 'LIBRETAS', nombre: 'Libretas' },
  contabilidad: { codigo: 'CONTABILIDAD', nombre: 'Contabilidad' },
} satisfies Record<string, SistemaConError>;

/** Un procesamiento en curso o terminado de una solicitud aprobada. */
export interface ProcesamientoMock extends ProcesamientoConciliacion {
  solicitudId: string;
  iniciadoEn: string;
  escenario: EscenarioProcesamiento;
  /** Quién aprobó: junto con quien elaboró, recibe la notificación al terminar. */
  aprobadorId: string;
  notificado: boolean;
}

export function iniciarProcesamiento(solicitudId: string, aprobadorId: string, ahora = new Date()): ProcesamientoMock {
  const iso = ahora.toISOString();
  return { solicitudId, aprobadorId, iniciadoEn: iso, actualizadoEn: iso, escenario: DEMO_PROCESAMIENTO.escenario, estado: 'EN_PROCESO', sistemasConError: [], reintentosAgotados: false, notificado: false };
}

/** Si ya pasó el tiempo, el procesamiento termina según su escenario; devuelve si cambió. */
export function avanzarProcesamiento(p: ProcesamientoMock, ahora = new Date()): boolean {
  if (p.estado !== 'EN_PROCESO' || p.escenario === 'procesando') return false;
  if (ahora.getTime() - new Date(p.iniciadoEn).getTime() < DEMO_PROCESAMIENTO.duracionMs) return false;
  p.actualizadoEn = ahora.toISOString();
  if (p.escenario === 'aplicado') {
    p.estado = 'APLICADO';
  } else {
    p.estado = 'CON_INCIDENCIAS';
    p.sistemasConError = p.escenario === 'con-incidencias' ? [SISTEMAS.contabilidad] : [SISTEMAS.libretas, SISTEMAS.contabilidad];
    p.reintentosAgotados = p.escenario === 'reintentos-agotados';
  }
  return true;
}

export function respuestaProcesamiento(p: ProcesamientoMock): ProcesamientoConciliacion {
  return { estado: p.estado, actualizadoEn: p.actualizadoEn, sistemasConError: p.sistemasConError, reintentosAgotados: p.reintentosAgotados };
}
