import type { PerfilItem } from '../core/api/auth-api.service';

/**
 * Usuarios del taller. Entran con su DNI y la contraseña común.
 *
 * - **`USUARIOS_DEMO`** (los que ve el login y entran a la demo): un solo usuario, Carla, con el perfil «Visualizador de
 *   consultas». Hoy el taller solo consulta.
 * - **`USUARIOS_PRUEBA`**: las personas con las que se prueba el flujo completo del backend simulado (verificar, aprobar,
 *   observar, modificar…): Carla como creadora y visualizadora y Luis como aprobador, porque quien aprueba no puede ser quien creó.
 *   No salen en el login: los tests los activan con `activarUsuariosDePrueba(true)`. Las solicitudes de ejemplo conservan sus
 *   nombres en el historial.
 *
 * Son datos de ejemplo: no hay contraseñas reales ni se validan contra un servidor.
 */
export const CONTRASENA_DEMO = 'Taller2026*';

export interface UsuarioDemo {
  id: string;
  dni: string;
  email: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  /** Qué muestra en el panel de usuarios del login. */
  descripcion: string;
  perfiles: PerfilItem[];
}

const ENTIDAD = {
  entidad: 'Ministerio de Economía y Finanzas',
  entidadId: 'ent-mef',
  entidadCodigo: '0001',
  entidadSiglas: 'MEF',
  ue: null,
  ueId: null,
  ueSiglas: null,
  unidad: 'Dirección General del Tesoro Público',
  unidadSigla: 'DGTP',
  etiquetaOficina: 'DGTP',
  unidadId: 'uo-dgtp',
  procedimiento: 'Registro de cuentas bancarias',
  procedimientoCodigo: 'RCB',
  nivelAmbito: 'PLIEGO' as const,
  entidadAmbitoId: 'amb-gn',
  entidadAmbitoCodigo: 'GN',
};

function perfil(id: string, rolCodigo: 'CREADOR' | 'APROBADOR' | 'VISUALIZADOR', rol: string, perfilFuncional: string): PerfilItem {
  return { id, ...ENTIDAD, rol, rolCodigo, perfilFuncional };
}

const PERFIL_VISUALIZADOR = perfil('perfil-demo-visualizador', 'VISUALIZADOR', 'Visualizador de consultas', 'Visualizador de consultas');

const CARLA = {
  id: 'usr-demo',
  dni: '33333333',
  email: 'carla.mendoza@taller.pe',
  nombres: 'Carla',
  apellidoPaterno: 'Mendoza',
  apellidoMaterno: 'Ríos',
};

/** El único usuario de la demo: consulta, no crea ni aprueba. */
export const USUARIOS_DEMO: UsuarioDemo[] = [
  { ...CARLA, descripcion: 'Visualizador de consultas', perfiles: [PERFIL_VISUALIZADOR] },
];

/** Las personas del flujo completo del backend simulado, solo para pruebas y para el historial de los documentos de ejemplo. */
export const USUARIOS_PRUEBA: UsuarioDemo[] = [
  {
    ...CARLA,
    descripcion: 'Creador y visualizador de consultas',
    perfiles: [perfil('perfil-demo-creador', 'CREADOR', 'Creador', 'Operador de cuentas bancarias'), PERFIL_VISUALIZADOR],
  },
  {
    id: 'usr-demo-aprobador',
    dni: '44444444',
    email: 'luis.quispe@taller.pe',
    nombres: 'Luis',
    apellidoPaterno: 'Quispe',
    apellidoMaterno: 'Salas',
    descripcion: 'Aprobador: aprueba, observa o rechaza lo que Carla verifica',
    perfiles: [perfil('perfil-demo-aprobador', 'APROBADOR', 'Aprobador', 'Aprobador de cuentas bancarias')],
  },
];

let usarUsuariosDePrueba = false;

/** Activa (o apaga) los usuarios de prueba en el backend simulado. Solo lo usan los tests. */
export function activarUsuariosDePrueba(activo: boolean): void {
  usarUsuariosDePrueba = activo;
}

/** Con quién responde el backend simulado: la demo (un solo usuario) o, en las pruebas, el flujo completo. */
export function usuariosDelBackend(): UsuarioDemo[] {
  return usarUsuariosDePrueba ? USUARIOS_PRUEBA : USUARIOS_DEMO;
}

export function buscarUsuarioPorPerfil(perfilId: string): { usuario: UsuarioDemo; perfil: PerfilItem } | null {
  for (const usuario of usuariosDelBackend()) {
    const encontrado = usuario.perfiles.find((p) => p.id === perfilId);
    if (encontrado) return { usuario, perfil: encontrado };
  }
  return null;
}
