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
  { key: 'document', label: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[300px]' },
  { key: 'number', label: 'Número', visibility: 'visible', group: 'default', widthClass: 'w-[160px]' },
  { key: 'actionType', label: 'Tipo de acción', visibility: 'visible', group: 'default', widthClass: 'w-[140px]' },
  { key: 'status', label: 'Estado', visibility: 'visible', group: 'default', widthClass: 'w-[120px]', kind: 'flow-status' },
  { key: 'system', label: 'Sistema', visibility: 'visible', group: 'default', widthClass: 'w-[150px]' },
  { key: 'date', label: 'Fecha de registro', visibility: 'visible', group: 'default', widthClass: 'w-[120px]' },
  { key: 'entity', label: 'Entidad', visibility: 'visible', group: 'default', widthClass: 'w-[280px]' },
];

const recordColumns: DocumentsRecordsColumn[] = [
  { key: 'sec', label: 'Sec.', headerGroup: 'Acreditación', visibility: 'visible', group: 'default', widthClass: 'w-[90px]' },
  { key: 'fecha', label: 'Fecha', headerGroup: 'Acreditación', visibility: 'visible', group: 'default', widthClass: 'w-[130px]' },
  { key: 'cuentaBancariaNumero', label: 'Número', panelLabel: 'Cuenta bancaria · Número', headerGroup: 'Cuenta bancaria', visibility: 'visible', group: 'default', widthClass: 'w-[200px]' },
  { key: 'cuentaBancariaDenominacion', label: 'Denominación', panelLabel: 'Cuenta bancaria · Denominación', headerGroup: 'Cuenta bancaria', visibility: 'visible', group: 'default', widthClass: 'w-[200px]' },
  { key: 'moneda', label: 'Moneda', visibility: 'visible', group: 'default', widthClass: 'w-[100px]', borderRight: true },
  { key: 'beneficiarioCodigo', label: 'Código', panelLabel: 'Beneficiario · Código', headerGroup: 'Beneficiario', visibility: 'visible', group: 'default', widthClass: 'w-[90px]' },
  { key: 'beneficiario', label: 'Descripción', panelLabel: 'Beneficiario · Descripción', headerGroup: 'Beneficiario', visibility: 'visible', group: 'default', widthClass: 'w-[230px]' },
  { key: 'numeroCuentaRegistro', label: 'Número', panelLabel: 'Cuenta de registro · Número', headerGroup: 'Cuenta de registro', visibility: 'visible', group: 'default', widthClass: 'w-[300px]' },
  { key: 'descripcionCuentaRegistro', label: 'Descripción', panelLabel: 'Cuenta de registro · Descripción', headerGroup: 'Cuenta de registro', visibility: 'visible', group: 'default', widthClass: 'w-[320px]' },
  { key: 'tipoOperacion', label: 'Tipo de operación', visibility: 'visible', group: 'default', widthClass: 'w-[190px]' },
  { key: 'entidad', label: 'Entidad', headerGroup: 'Ámbito institucional', visibility: 'visible', group: 'default', widthClass: 'w-[110px]' },
  { key: 'unidadEjecutora', label: 'Unidad ejecutora', headerGroup: 'Ámbito institucional', visibility: 'visible', group: 'default', widthClass: 'w-[190px]' },
  { key: 'grupo', label: 'Grupo', headerGroup: 'Ámbito institucional', visibility: 'visible', group: 'default', widthClass: 'w-[160px]' },
  { key: 'saldoInicial', label: 'Saldo inicial', headerGroup: 'Imp. m. cuenta', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[120px]' },
  { key: 'debito', label: 'Débito', headerGroup: 'Imp. m. cuenta', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[110px]' },
  { key: 'credito', label: 'Crédito', headerGroup: 'Imp. m. cuenta', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[110px]' },
  { key: 'status', label: 'Estado de registro', visibility: 'visible', group: 'default', widthClass: 'w-[130px]', kind: 'record-status' },
  { key: 'number', label: 'Número', panelLabel: 'Documento · Número', headerGroup: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[150px]' },
  { key: 'descripcionDocumento', label: 'Descripción', panelLabel: 'Documento · Descripción', headerGroup: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[300px]' },
  // «Más columnas»: los datos del detalle del registro que la tabla no muestra de entrada.
  { key: 'fechaRegistro', label: 'Fecha de registro', panelLabel: 'Fecha de registro', visibility: 'hidden', group: 'more', widthClass: 'w-[170px]' },
  { key: 'numeroOperacion', label: 'Número de operación', visibility: 'hidden', group: 'more', widthClass: 'w-[170px]' },
  { key: 'tipoBeneficiario', label: 'Tipo', headerGroup: 'Beneficiario', panelLabel: 'Beneficiario · Tipo', visibility: 'hidden', group: 'more', widthClass: 'w-[130px]' },
  { key: 'entidadAdministradoraCodigo', label: 'Código', headerGroup: 'Entidad administradora', panelLabel: 'Entidad administradora · Código', visibility: 'hidden', group: 'more', widthClass: 'w-[120px]' },
  { key: 'entidadAdministradoraSigla', label: 'Sigla', headerGroup: 'Entidad administradora', panelLabel: 'Entidad administradora · Sigla', visibility: 'hidden', group: 'more', widthClass: 'w-[120px]' },
  { key: 'movimientoInternoCodigo', label: 'Código', headerGroup: 'Movimiento interno', panelLabel: 'Movimiento interno · Código', visibility: 'hidden', group: 'more', widthClass: 'w-[120px]' },
  { key: 'movimientoInternoDescripcion', label: 'Descripción', headerGroup: 'Movimiento interno', panelLabel: 'Movimiento interno · Descripción', visibility: 'hidden', group: 'more', widthClass: 'w-[260px]' },
  { key: 'movimientoInternoSigla', label: 'Sigla', headerGroup: 'Movimiento interno', panelLabel: 'Movimiento interno · Sigla', visibility: 'hidden', group: 'more', widthClass: 'w-[100px]' },
  { key: 'movimientoExternoCodigo', label: 'Código', headerGroup: 'Movimiento externo', panelLabel: 'Movimiento externo · Código', visibility: 'hidden', group: 'more', widthClass: 'w-[120px]' },
  { key: 'movimientoExternoDescripcion', label: 'Descripción', headerGroup: 'Movimiento externo', panelLabel: 'Movimiento externo · Descripción', visibility: 'hidden', group: 'more', widthClass: 'w-[200px]' },
  { key: 'documentoCutNumero', label: 'Número', headerGroup: 'Documento CUT', panelLabel: 'Documento CUT · Número', visibility: 'hidden', group: 'more', widthClass: 'w-[130px]' },
  { key: 'documentoCutArchivo', label: 'Archivo', headerGroup: 'Documento CUT', panelLabel: 'Documento CUT · Archivo', visibility: 'hidden', group: 'more', widthClass: 'w-[130px]' },
  { key: 'documentoCutSigla', label: 'Sigla', headerGroup: 'Documento CUT', panelLabel: 'Documento CUT · Sigla', visibility: 'hidden', group: 'more', widthClass: 'w-[100px]' },
  { key: 'descripcionDetallada', label: 'Descripción detallada', visibility: 'hidden', group: 'more', widthClass: 'w-[260px]' },
  { key: 'saldoFinal', label: 'Saldo final', headerGroup: 'Imp. m. cuenta', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[135px]', fixed: true },
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
  selectionDownload: true,
  recordRowAction: { icon: 'description', label: 'Ver documento PDF' },
  recordTrackKey: 'sec',
  recordHistoryDocumentLabel: 'Registro de operaciones en las libretas de las cuentas de registro',
  recordHistoryKind: 'documento',
  statusFilterOptions: ['Procesado', 'Rechazado'],
  actionTypeFilterOptions: ['Creación'],
  filterCampoOptions,
  filterValorOptions: [
    { label: 'Procesado', value: 'Procesado' },
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
