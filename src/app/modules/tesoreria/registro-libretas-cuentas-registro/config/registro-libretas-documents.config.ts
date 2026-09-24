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
  { key: 'beneficiarioCodigo', label: 'Código', headerGroup: 'Beneficiario', visibility: 'visible', group: 'default', widthClass: 'w-[90px]' },
  { key: 'beneficiario', label: 'Descripción', headerGroup: 'Beneficiario', visibility: 'visible', group: 'default', widthClass: 'w-[230px]' },
  { key: 'numeroCuentaRegistro', label: 'Número', headerGroup: 'Cuenta de registro', visibility: 'visible', group: 'default', widthClass: 'w-[230px]' },
  { key: 'descripcionCuentaRegistro', label: 'Descripción', headerGroup: 'Cuenta de registro', visibility: 'visible', group: 'default', widthClass: 'w-[320px]' },
  { key: 'tipoOperacion', label: 'Tipo de operación', visibility: 'visible', group: 'default', widthClass: 'w-[190px]' },
  { key: 'entidad', label: 'Entidad', headerGroup: 'Ámbito institucional', visibility: 'visible', group: 'default', widthClass: 'w-[110px]' },
  { key: 'unidadEjecutora', label: 'Unidad ejecutora', headerGroup: 'Ámbito institucional', visibility: 'visible', group: 'default', widthClass: 'w-[190px]' },
  { key: 'grupo', label: 'Grupo', headerGroup: 'Ámbito institucional', visibility: 'visible', group: 'default', widthClass: 'w-[160px]' },
  { key: 'saldoInicial', label: 'Saldo inicial', headerGroup: 'Imp. m. cuenta', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[120px]' },
  { key: 'debito', label: 'Débito', headerGroup: 'Imp. m. cuenta', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[110px]' },
  { key: 'credito', label: 'Crédito', headerGroup: 'Imp. m. cuenta', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[110px]' },
  { key: 'status', label: 'Estado de registro', visibility: 'visible', group: 'default', widthClass: 'w-[130px]', kind: 'record-status' },
  { key: 'number', label: 'Número', headerGroup: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[110px]' },
  { key: 'descripcionDocumento', label: 'Descripción', headerGroup: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[300px]' },
  { key: 'saldoFinal', label: 'Saldo final', headerGroup: 'Imp. m. cuenta', visibility: 'visible', group: 'default', align: 'right', widthClass: 'w-[135px]' },
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
  recordTableMinWidthClass: 'min-w-[2900px]',
  recordSelectable: true,
  recordRowAction: { icon: 'description', label: 'Ver documento PDF' },
  recordTrackKey: 'sec',
  recordHistoryDocumentLabel: 'Registro de operaciones en las libretas de las cuentas de registro',
  recordHistoryKind: 'documento',
  statusFilterOptions: ['Procesado'],
  actionTypeFilterOptions: ['Creación'],
  filterCampoOptions,
  filterValorOptions: [
    { label: 'Procesado', value: 'Procesado' },
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
