/**
 * Árbol maestro de procesos + utilidad de búsqueda de ruta.
 * Vive en shared/utils/ (no en layout/) porque lo consumen tanto piezas
 * del shell (layout/process-menu-tree, layout/create-document) como
 * utilidades transversales de shared (breadcrumbs.util) — shared no debe
 * depender de layout, así que la fuente de verdad va acá.
 */
export interface ProcessMenuNode {
  id: string;
  label: string;
  selected?: boolean;
  // Solo debe marcarse en nodos raiz: la vista inicial muestra hasta el segundo nivel.
  expanded?: boolean;
  // Ruta de la página principal del módulo (documentos y registros)
  moduleRoute?: string;
  // Si un nodo tiene estas propiedades, Crear documento puede completar documento/tipo y navegar.
  createRoute?: string;
  documentOptions?: string[];
  documentCreateOptions?: Array<{
    label: string;
    route?: string;
    actionTypes?: string[];
  }>;
  actionTypeOptions?: string[];
  /**
   * Marca un nodo como módulo planificado pero aún no implementado.
   * El menú lo renderiza con texto atenuado y badge "Próximamente",
   * y el click no navega (solo expande si tiene hijos).
   */
  comingSoon?: boolean;
  children?: ProcessMenuNode[];
}

/**
 * Árbol de procesos del taller, calcado del menú de procesos de Figma (nodo 5839:15712, archivo
 * «CEL-005-02.01.01.09 Registro de operaciones en las libretas de las cuentas de registro»). Solo
 * «Registro de operaciones en las libretas de las cuentas de registro» está implementado (con datos
 * simulados); el resto son ejemplos de cómo se ve un proceso planificado («Próximamente»). Para sumar
 * un proceso: una hoja con `moduleRoute` (Documentos y registros) y otra para sus consultas, y sus
 * rutas en `app.routes.ts`.
 *
 * IDs consumidos por componentes externos (migas de pan con `findProcessPathById`):
 *   - registro-libretas-cuentas-registro-documentos
 *   - registro-libretas-cuentas-registro-consultas
 */
export const DEFAULT_PROCESS_TREE: ProcessMenuNode[] = [
  {
    id: 'gestion-tesoreria',
    label: 'Gestión de tesorería',
    expanded: true,
    children: [
      { id: 'gestion-ingresos', label: 'Gestión de ingresos', comingSoon: true },
      {
        id: 'gestion-liquidez',
        label: 'Gestión de liquidez',
        expanded: true,
        children: [
          {
            id: 'conciliacion-bancaria',
            label: 'Conciliación bancaria',
            expanded: true,
            children: [
              { id: 'registro-operaciones-bancarias', label: 'Registro de operaciones bancarias', comingSoon: true },
              { id: 'conciliacion-diaria', label: 'Conciliación diaria', comingSoon: true },
              { id: 'insercion-cuentas-registro', label: 'Inserción de cuentas de registro', comingSoon: true },
              { id: 'conciliacion-mensual', label: 'Conciliación mensual', comingSoon: true },
              {
                id: 'saldos-iniciales-libro-banco',
                label: 'Saldos iniciales en libro banco y libreta de cuentas de registro',
                comingSoon: true,
              },
              {
                id: 'registro-libretas-cuentas-registro',
                label: 'Registro de operaciones en las libretas de las cuentas de registro',
                selected: true,
                children: [
                  {
                    id: 'registro-libretas-cuentas-registro-documentos',
                    label: 'Documentos de operaciones en las libretas de las cuentas de registro',
                    moduleRoute: '/procesos/registro-libretas-cuentas-registro',
                    createRoute: '/procesos/registro-libretas-cuentas-registro/solicitud',
                    documentOptions: ['Solicitud de Registro de Operaciones en Libretas de Cuentas de Registro'],
                    documentCreateOptions: [
                      {
                        label: 'Solicitud de Registro de Operaciones en Libretas de Cuentas de Registro',
                        route: '/procesos/registro-libretas-cuentas-registro/solicitud',
                        actionTypes: ['Creación'],
                      },
                    ],
                    actionTypeOptions: ['Creación'],
                  },
                  {
                    id: 'registro-libretas-cuentas-registro-consultas',
                    label: 'Consulta y reporte de operaciones en las libretas de las cuentas de registro',
                    moduleRoute: '/procesos/registro-libretas-cuentas-registro/consultas',
                  },
                ],
              },
            ],
          },
        ],
      },
      { id: 'gestion-pagos', label: 'Gestión de pagos', comingSoon: true },
    ],
  },
  { id: 'clasificadores-catalogos', label: 'Clasificadores y catálogos', comingSoon: true },
  { id: 'consultas-reportes', label: 'Consultas y reportes', comingSoon: true },
];

export function findProcessPathById(id: string, nodes: readonly ProcessMenuNode[] = DEFAULT_PROCESS_TREE): ProcessMenuNode[] {
  for (const node of nodes) {
    if (node.id === id) {
      return [node];
    }

    const childPath = findProcessPathById(id, node.children || []);

    if (childPath.length > 0) {
      return [node, ...childPath];
    }
  }

  return [];
}

/**
 * Árbol del menú "Ajustes" (módulo de administración). Lo pinta el mismo `siaf-process-menu-tree`
 * que el menú de procesos, con otros textos. En el taller no hay módulo de administración: las hojas
 * van como «Próximamente» y no navegan.
 */
export const ADMIN_MENU_TREE: ProcessMenuNode[] = [
  {
    id: 'administracion',
    label: 'Administración',
    expanded: true,
    children: [
      {
        id: 'usuarios-accesos',
        label: 'Usuarios y accesos',
        expanded: true,
        children: [
          { id: 'gestion-usuarios', label: 'Gestión de usuarios', comingSoon: true },
          { id: 'perfiles-funcionales', label: 'Perfiles funcionales', comingSoon: true },
        ],
      },
      {
        id: 'organizacion',
        label: 'Organización',
        children: [
          { id: 'entidades', label: 'Entidades', comingSoon: true },
          { id: 'unidades', label: 'Unidades orgánicas', comingSoon: true },
        ],
      },
    ],
  },
];
