import type {
  DocumentsRecordsColumn,
  DocumentsRecordsConfig,
  DocumentsRecordsFilterOption,
  DocumentsRecordsMenuOption,
} from '../../../../shared/types/documents-records.types';
import { buildProcessBreadcrumbs } from '../../../../shared/utils/breadcrumbs.util';
import { BENEFICIARIOS } from '../models/registro-libretas.model';
import { PROCESS_ID, PROCESS_ROUTE } from './registro-libretas.rutas';

/**
 * Configuración de «Documentos y registros» de Registro de operaciones en las libretas de las cuentas de registro
 * (Figma nodo 241:21418). Es un proceso de solo consulta: los documentos los genera el sistema al registrar las
 * operaciones, así que no hay «Crear documento» ni acción de verificar o aprobar.
 */

const documentColumns: DocumentsRecordsColumn[] = [
  { key: 'document', label: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[300px]', sortable: true },
  { key: 'number', label: 'Número', visibility: 'visible', group: 'default', widthClass: 'w-[160px]', sortable: true },
  { key: 'actionType', label: 'Tipo de acción', visibility: 'visible', group: 'default', widthClass: 'w-[140px]', sortable: true },
  { key: 'status', label: 'Estado', visibility: 'visible', group: 'default', widthClass: 'w-[120px]', kind: 'flow-status', sortable: true },
  { key: 'system', label: 'Sistema', visibility: 'visible', group: 'default', widthClass: 'w-[150px]', sortable: true },
  { key: 'date', label: 'Fecha de registro', visibility: 'visible', group: 'default', widthClass: 'w-[120px]', sortable: true, sortType: 'date' },
  { key: 'entity', label: 'Entidad', visibility: 'visible', group: 'default', widthClass: 'w-[280px]', sortable: true },
];

const recordColumns: DocumentsRecordsColumn[] = [
  { key: 'sec', label: 'Sec.', headerGroup: 'Acreditación', visibility: 'visible', group: 'default', widthClass: 'w-[90px]', sortable: true, sortType: 'text' },
  { key: 'fecha', label: 'Fecha', headerGroup: 'Acreditación', visibility: 'visible', group: 'default', widthClass: 'w-[130px]', sortable: true, sortType: 'date' },
  { key: 'cuentaBancariaNumero', label: 'Número', panelLabel: 'Cuenta bancaria · Número', headerGroup: 'Cuenta bancaria', visibility: 'visible', group: 'default', widthClass: 'w-[200px]', sortable: true },
  { key: 'cuentaBancariaDenominacion', label: 'Denominación', panelLabel: 'Cuenta bancaria · Denominación', headerGroup: 'Cuenta bancaria', visibility: 'visible', group: 'default', widthClass: 'w-[200px]', sortable: true },
  { key: 'moneda', label: 'Moneda', panelLabel: 'Cuenta bancaria · Moneda', headerGroup: 'Cuenta bancaria', visibility: 'visible', group: 'default', widthClass: 'w-[100px]', borderRight: true, sortable: true },
  { key: 'beneficiarioCodigo', label: 'Código', panelLabel: 'Beneficiario · Código', headerGroup: 'Beneficiario', visibility: 'visible', group: 'default', widthClass: 'w-[110px]', sortable: true },
  { key: 'beneficiario', label: 'Descripción', panelLabel: 'Beneficiario · Descripción', headerGroup: 'Beneficiario', visibility: 'visible', group: 'default', widthClass: 'w-[230px]', sortable: true },
  { key: 'tipoBeneficiario', label: 'Tipo', headerGroup: 'Beneficiario', panelLabel: 'Beneficiario · Tipo', visibility: 'hidden', group: 'more', widthClass: 'w-[130px]', sortable: true },
  { key: 'numeroCuentaRegistro', label: 'Número', panelLabel: 'Cuenta de registro · Número', headerGroup: 'Cuenta de registro', visibility: 'visible', group: 'default', widthClass: 'w-[300px]', sortable: true },
  { key: 'descripcionCuentaRegistro', label: 'Descripción', panelLabel: 'Cuenta de registro · Descripción', headerGroup: 'Cuenta de registro', visibility: 'visible', group: 'default', widthClass: 'w-[320px]', sortable: true },
  { key: 'tipoOperacion', label: 'Tipo de operación', visibility: 'visible', group: 'default', widthClass: 'w-[190px]', borderRight: true, sortable: true },
  { key: 'entidad', label: 'Entidad', headerGroup: 'Ámbito institucional', visibility: 'visible', group: 'default', widthClass: 'w-[110px]', sortable: true },
  { key: 'unidadEjecutora', label: 'Unidad ejecutora', headerGroup: 'Ámbito institucional', visibility: 'visible', group: 'default', widthClass: 'w-[190px]', sortable: true },
  { key: 'grupo', label: 'Grupo', headerGroup: 'Ámbito institucional', visibility: 'visible', group: 'default', widthClass: 'w-[160px]', sortable: true },
  { key: 'saldoInicial', label: 'Saldo inicial', headerGroup: 'Imp. m. cuenta', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[135px]', sortable: true, sortType: 'number' },
  { key: 'debito', label: 'Débito', headerGroup: 'Imp. m. cuenta', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[110px]', sortable: true, sortType: 'number' },
  { key: 'credito', label: 'Crédito', headerGroup: 'Imp. m. cuenta', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[110px]', sortable: true, sortType: 'number' },
  { key: 'saldoDisponible', label: 'Saldo disponible', headerGroup: 'Imp. m. cuenta', visibility: 'hidden', group: 'more', align: 'right', widthClass: 'w-[135px]', sortable: true, sortType: 'number' },
  { key: 'status', label: 'Est. Reg.', panelLabel: 'Estado de registro', visibility: 'visible', group: 'default', widthClass: 'w-[130px]', kind: 'record-status', borderRight: true, sortable: true },
  { key: 'number', label: 'Número', panelLabel: 'Documento · Número', headerGroup: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[150px]', sortable: true },
  { key: 'descripcionDocumento', label: 'Descripción', panelLabel: 'Documento · Descripción', headerGroup: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[300px]', sortable: true },
  // «Más columnas»: los datos del detalle del registro que la tabla no muestra de entrada.
  { key: 'fechaRegistro', label: 'Fecha de registro', panelLabel: 'Fecha de registro', visibility: 'hidden', group: 'more', widthClass: 'w-[170px]', sortable: true, sortType: 'date' },
  { key: 'numeroOperacion', label: 'Número de operación', visibility: 'hidden', group: 'more', widthClass: 'w-[170px]', sortable: true },
  { key: 'entidadAdministradoraCodigo', label: 'Código', headerGroup: 'Entidad administradora', panelLabel: 'Entidad administradora · Código', visibility: 'hidden', group: 'more', widthClass: 'w-[120px]', sortable: true },
  { key: 'entidadAdministradoraSigla', label: 'Sigla', headerGroup: 'Entidad administradora', panelLabel: 'Entidad administradora · Sigla', visibility: 'hidden', group: 'more', widthClass: 'w-[120px]', sortable: true },
  { key: 'movimientoInternoCodigo', label: 'Código', headerGroup: 'Movimiento interno', panelLabel: 'Movimiento interno · Código', visibility: 'hidden', group: 'more', widthClass: 'w-[120px]', sortable: true },
  { key: 'movimientoInternoDescripcion', label: 'Descripción', headerGroup: 'Movimiento interno', panelLabel: 'Movimiento interno · Descripción', visibility: 'hidden', group: 'more', widthClass: 'w-[260px]', sortable: true },
  { key: 'movimientoInternoSigla', label: 'Sigla', headerGroup: 'Movimiento interno', panelLabel: 'Movimiento interno · Sigla', visibility: 'hidden', group: 'more', widthClass: 'w-[100px]', sortable: true },
  { key: 'movimientoExternoCodigo', label: 'Código', headerGroup: 'Movimiento externo', panelLabel: 'Movimiento externo · Código', visibility: 'hidden', group: 'more', widthClass: 'w-[120px]', sortable: true },
  { key: 'movimientoExternoDescripcion', label: 'Descripción', headerGroup: 'Movimiento externo', panelLabel: 'Movimiento externo · Descripción', visibility: 'hidden', group: 'more', widthClass: 'w-[200px]', sortable: true },
  { key: 'documentoCutNumero', label: 'Número', headerGroup: 'Documento CUT', panelLabel: 'Documento CUT · Número', visibility: 'hidden', group: 'more', widthClass: 'w-[130px]', sortable: true },
  { key: 'documentoCutArchivo', label: 'Archivo', headerGroup: 'Documento CUT', panelLabel: 'Documento CUT · Archivo', visibility: 'hidden', group: 'more', widthClass: 'w-[130px]', sortable: true },
  { key: 'documentoCutSigla', label: 'Sigla', headerGroup: 'Documento CUT', panelLabel: 'Documento CUT · Sigla', visibility: 'hidden', group: 'more', widthClass: 'w-[100px]', sortable: true },
  { key: 'descripcionDetallada', label: 'Descripción detallada', visibility: 'hidden', group: 'more', widthClass: 'w-[260px]', sortable: true },
  { key: 'estadoConciliacion', label: 'Estado de conciliación', visibility: 'hidden', group: 'more', widthClass: 'w-[170px]', sortable: true },
  { key: 'saldoFinal', label: 'Saldo final', headerGroup: 'Imp. m. cuenta', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[135px]', fixed: true, sortable: true, sortType: 'number' },
];

const fieldsMenuOptions: DocumentsRecordsMenuOption[] = [
  { label: 'Documento' },
  { label: 'Tipo de acción' },
  { label: 'Estado' },
  { label: 'Fecha de registro', hasChildren: true },
  { label: 'Entidad' },
];

const filterCampoOptions: DocumentsRecordsFilterOption[] = [
  { label: 'Documento', value: 'document' },
  { label: 'Número', value: 'number' },
  { label: 'Tipo de acción', value: 'actionType' },
  { label: 'Estado', value: 'status' },
  { label: 'Fecha', value: 'date' },
  { label: 'Entidad', value: 'entity' },
];

export const REGISTRO_LIBRETAS_DOCUMENTS_CONFIG: DocumentsRecordsConfig = {
  modoConsulta: true,
  title: 'Documentos de operaciones en las libretas de las cuentas de registro',
  processId: PROCESS_ID,
  defaultRequestRoute: PROCESS_ROUTE,
  createDocumentOptions: [],
  breadcrumbs: buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE),
  documentRows: [],
  recordRows: [],
  documentColumns,
  recordColumns,
  documentTableMinWidthClass: 'min-w-[1270px]',
  recordTableMinWidthClass: 'min-w-[5200px]',
  recordSelectable: true,
  documentSelectable: true,
  lockDefaultColumns: true,
  rememberTab: true,
  columnsTreePanel: true,
  recordFilterFieldsFromColumns: true,
  headerGroupLabels: { 'Imp. m. cuenta': 'Importe en moneda de la cuenta' },
  selectionDownload: true,
  recordRowAction: { icon: 'description', label: 'Ver documento PDF' },
  recordTrackKey: 'id',
  recordHistoryDocumentLabel: 'Registro de operaciones en las libretas de las cuentas de registro',
  recordHistoryKind: 'documento',
  statusFilterOptions: ['Procesado', 'Pendiente', 'Rechazado'],
  actionTypeFilterOptions: ['Creación'],
  filterCampoOptions,
  filterValorOptions: [
    { label: 'Procesado', value: 'Procesado' },
    { label: 'Pendiente', value: 'Pendiente' },
    { label: 'Rechazado', value: 'Rechazado' },
    { label: 'Creación', value: 'Creación' },
  ],
  fieldsMenuOptions,
  recordFilter1Label: 'Beneficiario',
  recordFilter1Key: 'beneficiario',
  recordFilter1Options: BENEFICIARIOS.map((b) => b.label.toUpperCase()),
  recordFilter2Label: 'Tipo de operación',
  recordFilter2Key: 'tipoOperacion',
  recordFilter2Options: ['1 - Saldos Iniciales', '2 - Reporte de Recaudación SUNAT', '3 - Devolución'],
  recordFilterCampoOptions: [
    { label: 'Beneficiario', value: 'beneficiario' },
    { label: 'Tipo de operación', value: 'tipoOperacion' },
    { label: 'Entidad', value: 'entidad' },
    { label: 'Unidad ejecutora', value: 'unidadEjecutora' },
  ],
  recordFilterValorOptions: [
    { label: 'MEF', value: 'MEF' },
    { label: 'IPD', value: 'IPD' },
    { label: 'MINCETUR', value: 'MINCETUR' },
  ],
};
