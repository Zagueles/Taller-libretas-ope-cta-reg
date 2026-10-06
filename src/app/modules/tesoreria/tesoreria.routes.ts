import { Routes } from '@angular/router';

/** Proceso de ejemplo del taller: Documentos y registros, la solicitud y la consulta. */
export const TESORERIA_ROUTES: Routes = [
  {
    path: 'procesos/registro-cuentas-bancarias',
    loadComponent: () =>
      import('./cuentas-bancarias/pages/documents/cuentas-bancarias-documents.component').then(
        (m) => m.CuentasBancariasDocumentsComponent,
      ),
  },
  {
    path: 'procesos/registro-cuentas-bancarias/solicitud',
    loadComponent: () =>
      import('./cuentas-bancarias/pages/solicitud/cuenta-bancaria-request.component').then(
        (m) => m.CuentaBancariaRequestComponent,
      ),
  },
  {
    path: 'procesos/registro-cuentas-bancarias/solicitud/:id',
    loadComponent: () =>
      import('./cuentas-bancarias/pages/solicitud/cuenta-bancaria-request.component').then(
        (m) => m.CuentaBancariaRequestComponent,
      ),
  },
  {
    path: 'procesos/registro-cuentas-bancarias/consultas',
    loadComponent: () =>
      import('./cuentas-bancarias/pages/consultas/cuentas-bancarias-consultas.component').then(
        (m) => m.CuentasBancariasConsultasComponent,
      ),
  },
  {
    path: 'procesos/registro-libretas-cuentas-registro',
    loadComponent: () =>
      import('./registro-libretas-cuentas-registro/pages/documents/registro-libretas-documents.component').then(
        (m) => m.RegistroLibretasDocumentsComponent,
      ),
  },
  {
    path: 'procesos/registro-libretas-cuentas-registro/documento/:numero',
    loadComponent: () =>
      import('./registro-libretas-cuentas-registro/pages/documento/registro-libretas-documento.component').then(
        (m) => m.RegistroLibretasDocumentoComponent,
      ),
  },
  {
    path: 'procesos/registro-libretas-cuentas-registro/registro/:sec',
    loadComponent: () =>
      import('./registro-libretas-cuentas-registro/pages/registro/registro-libretas-registro.component').then(
        (m) => m.RegistroLibretasRegistroComponent,
      ),
  },
  {
    path: 'procesos/registro-libretas-cuentas-registro/consultas',
    loadComponent: () =>
      import('./registro-libretas-cuentas-registro/pages/consultas/registro-libretas-consultas.component').then(
        (m) => m.RegistroLibretasConsultasComponent,
      ),
  },
  {
    path: 'procesos/conciliacion-diaria',
    loadComponent: () =>
      import('./conciliacion-diaria/pages/documents/conciliacion-diaria-documents.component').then(
        (m) => m.ConciliacionDiariaDocumentsComponent,
      ),
  },
  {
    path: 'procesos/conciliacion-diaria/solicitud',
    loadComponent: () =>
      import('./conciliacion-diaria/pages/solicitud/conciliacion-diaria-solicitud.component').then(
        (m) => m.ConciliacionDiariaSolicitudComponent,
      ),
  },
  {
    path: 'procesos/conciliacion-diaria/solicitud/:id',
    loadComponent: () =>
      import('./conciliacion-diaria/pages/solicitud/conciliacion-diaria-solicitud.component').then(
        (m) => m.ConciliacionDiariaSolicitudComponent,
      ),
  },
];
