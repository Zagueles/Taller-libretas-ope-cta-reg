import type { PerfilItem } from '../core/api/auth-api.service';

/**
 * Usuarios de demostración del taller. Entran con su DNI y la contraseña común.
 *
 * Son dos personas distintas, porque quien aprueba una solicitud no puede ser quien la creó:
 * - Carla (creador y visualizador de consultas): registra y verifica solicitudes, o solo consulta; cambia de perfil desde el
 *   menú del usuario.
 * - Luis (aprobador): aprueba, observa o rechaza lo verificado.
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

export const USUARIOS_DEMO: UsuarioDemo[] = [
  {
    id: 'usr-demo',
    dni: '33333333',
    email: 'carla.mendoza@taller.pe',
    nombres: 'Carla',
    apellidoPaterno: 'Mendoza',
    apellidoMaterno: 'Ríos',
    descripcion: 'Creador y visualizador de consultas (cambia de perfil desde el menú del usuario)',
    perfiles: [
      perfil('perfil-demo-creador', 'CREADOR', 'Creador', 'Operador de cuentas bancarias'),
      perfil('perfil-demo-visualizador', 'VISUALIZADOR', 'Visualizador de consultas', 'Visualizador de consultas'),
    ],
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

export function buscarUsuarioPorPerfil(perfilId: string): { usuario: UsuarioDemo; perfil: PerfilItem } | null {
  for (const usuario of USUARIOS_DEMO) {
    const encontrado = usuario.perfiles.find((p) => p.id === perfilId);
    if (encontrado) return { usuario, perfil: encontrado };
  }
  return null;
}
