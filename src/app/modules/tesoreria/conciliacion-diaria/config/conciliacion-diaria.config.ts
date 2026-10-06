import type { CreateDocumentProcessOption } from '../../../../shared/components/create-document/create-document.component';
import type { DocumentsRecordsColumn, DocumentsRecordsConfig } from '../../../../shared/types/documents-records.types';
import { buildProcessBreadcrumbs } from '../../../../shared/utils/breadcrumbs.util';

/** Ruta y hoja «Documentos de conciliación diaria» del árbol de procesos. */
export const PROCESS_ROUTE = '/procesos/conciliacion-diaria';
export const PROCESS_ID = 'conciliacion-diaria-documentos';
export const REQUEST_SEGMENT = 'solicitud';
export const REQUEST_ROUTE = `${PROCESS_ROUTE}/${REQUEST_SEGMENT}`;

/** «Crear documento» del proceso: es la única hoja del árbol de creación . */
export const CREATE_CONCILIACION_DIARIA_OPTION: CreateDocumentProcessOption = {
  id: 'conciliacion-diaria',
  label: 'Conciliación diaria',
  route: REQUEST_ROUTE,
  documents: ['Conciliación manual diaria'],
  documentOptions: [{ label: 'Conciliación manual diaria', route: REQUEST_ROUTE, actionTypes: ['Creación'] }],
  actionTypes: ['Creación'],
};

/** Los estados del flujo de la solicitud y los de los documentos que genera el sistema. */
const ESTADOS_DOCUMENTO = ['Elaborado', 'Verificado', 'Aprobado', 'Observado', 'Rechazado', 'Generado', 'Procesado'];

const documentColumns: DocumentsRecordsColumn[] = [
  { key: 'document', label: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[300px]' },
  { key: 'number', label: 'Número', visibility: 'visible', group: 'default', widthClass: 'w-[130px]' },
  { key: 'actionType', label: 'Tipo de acción', visibility: 'visible', group: 'default', widthClass: 'w-[140px]' },
  { key: 'status', label: 'Estado', visibility: 'visible', group: 'default', widthClass: 'w-[120px]', kind: 'flow-status' },
  { key: 'system', label: 'Sistema', visibility: 'visible', group: 'default', widthClass: 'w-[130px]' },
  { key: 'date', label: 'Fecha de registro', visibility: 'visible', group: 'default', widthClass: 'w-[170px]' },
  { key: 'entity', label: 'Entidad', visibility: 'visible', group: 'default', widthClass: 'w-[280px]' },
];

const recordColumns: DocumentsRecordsColumn[] = [
  { key: 'nro', label: 'Nro', visibility: 'visible', group: 'default', widthClass: 'w-[70px]' },
  { key: 'tipoConciliacion', label: 'Tipo conc.', panelLabel: 'Tipo de conciliación', visibility: 'visible', group: 'default', widthClass: 'w-[120px]' },
  { key: 'lbFecha', label: 'F. operación', panelLabel: 'Libro banco · F. operación', headerGroup: 'Libro banco', visibility: 'visible', group: 'default', widthClass: 'w-[130px]' },
  { key: 'lbNumero', label: 'Número', panelLabel: 'Libro banco · Número', headerGroup: 'Libro banco', visibility: 'visible', group: 'default', widthClass: 'w-[110px]' },
  { key: 'lbDescripcion', label: 'Descripción', panelLabel: 'Libro banco · Descripción', headerGroup: 'Libro banco', visibility: 'visible', group: 'default', widthClass: 'w-[150px]' },
  { key: 'lbEntidad', label: 'Ent. adm. ing.', panelLabel: 'Libro banco · Ent. adm. ing.', headerGroup: 'Libro banco', visibility: 'visible', group: 'default', widthClass: 'w-[130px]' },
  { key: 'lbDebito', label: 'Débito (S/)', panelLabel: 'Libro banco · Débito', headerGroup: 'Libro banco', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[110px]' },
  { key: 'lbCredito', label: 'Crédito (S/)', panelLabel: 'Libro banco · Crédito', headerGroup: 'Libro banco', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[110px]' },
  { key: 'rbFecha', label: 'F. operación B.', panelLabel: 'Registro de operaciones bancarias · F. operación B.', headerGroup: 'Registro de operaciones bancarias', visibility: 'visible', group: 'default', widthClass: 'w-[140px]' },
  { key: 'rbNumero', label: 'Número', panelLabel: 'Registro de operaciones bancarias · Número', headerGroup: 'Registro de operaciones bancarias', visibility: 'visible', group: 'default', widthClass: 'w-[110px]' },
  { key: 'rbDescripcion', label: 'Descripción', panelLabel: 'Registro de operaciones bancarias · Descripción', headerGroup: 'Registro de operaciones bancarias', visibility: 'visible', group: 'default', widthClass: 'w-[150px]' },
  { key: 'rbDebito', label: 'Débito (S/)', panelLabel: 'Registro de operaciones bancarias · Débito', headerGroup: 'Registro de operaciones bancarias', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[110px]' },
  { key: 'rbCredito', label: 'Crédito (S/)', panelLabel: 'Registro de operaciones bancarias · Crédito', headerGroup: 'Registro de operaciones bancarias', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[110px]' },
  { key: 'motivo', label: 'Mot. incons.', panelLabel: 'Motivo de inconsistencias', visibility: 'visible', group: 'default', widthClass: 'w-[140px]' },
  { key: 'status', label: 'Estado reg.', panelLabel: 'Estado del registro', visibility: 'visible', group: 'default', widthClass: 'w-[130px]', kind: 'record-status' },
  { key: 'number', label: 'Número', panelLabel: 'Documento · Número', headerGroup: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[130px]' },
  { key: 'descripcionDocumento', label: 'Descripción', panelLabel: 'Documento · Descripción', headerGroup: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[270px]' },
  { key: 'estadoConciliacion', label: 'Estado conciliación', panelLabel: 'Estado de conciliación', visibility: 'visible', group: 'default', widthClass: 'w-[150px]', kind: 'conciliation-status', fixed: true },
];

/** Documentos y registros de Conciliación diaria (Figma 261:54041 y 203:14262). Los documentos los genera el sistema. */
export const CONCILIACION_DIARIA_CONFIG: DocumentsRecordsConfig = {
  title: 'Documentos de conciliación diaria',
  processId: PROCESS_ID,
  defaultRequestRoute: PROCESS_ROUTE,
  createDocumentOptions: [CREATE_CONCILIACION_DIARIA_OPTION],
  breadcrumbs: buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE),
  documentRows: [],
  recordRows: [],
  documentColumns,
  recordColumns,
  documentTableMinWidthClass: 'min-w-[1270px]',
  recordTableMinWidthClass: 'min-w-[2300px]',
  rememberTab: true,
  modoConsulta: true,
  crearEnModoConsulta: true,
  recordTrackKey: 'id',
  recordHistoryDocumentLabel: 'Conciliación diaria',
  filterCampoOptions: [
    { label: 'Documento', value: 'document' },
    { label: 'Número', value: 'number' },
    { label: 'Tipo de acción', value: 'actionType' },
    { label: 'Estado', value: 'status' },
    { label: 'Entidad', value: 'entity' },
  ],
  filterValorOptions: [
    ...ESTADOS_DOCUMENTO.map((estado) => ({ label: estado, value: estado })),
    { label: 'Creación', value: 'Creación' },
  ],
  fieldsMenuOptions: [{ label: 'Documento' }, { label: 'Tipo de acción' }, { label: 'Estado' }, { label: 'Entidad' }],
  statusFilterOptions: ESTADOS_DOCUMENTO,
  actionTypeFilterOptions: ['Creación'],
  documentFilter1Label: 'Documento',
  documentFilter1Key: 'document',
  documentFilter1Options: ['Conciliación manual diaria', 'Inconsistencias de conciliación diaria', 'Conciliación automática diaria', 'Procesamiento de conciliación diaria'],
  documentFilter2Label: 'Estado',
  documentFilter2Key: 'status',
  documentFilter2Options: ESTADOS_DOCUMENTO,
  recordFilter1Label: 'Tipo conciliación',
  recordFilter1Key: 'tipoConciliacion',
  recordFilter1Options: ['Manual', 'Automático'],
  recordFilter2Label: 'Estado del registro',
  recordFilter2Key: 'status',
  recordFilter2Options: ['Activo'],
};
