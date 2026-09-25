import { ChangeDetectionStrategy, Component } from '@angular/core';

import { DocumentsRecordsPageComponent } from '../../../../../shared/components/documents-records-page/documents-records-page.component';
import type { DocumentsRecordsConfig, DocumentsRecordsRow } from '../../../../../shared/types/documents-records.types';
import { DOCUMENTO_ROUTE, REGISTRO_ROUTE } from '../../config/registro-libretas.rutas';
import { REGISTRO_LIBRETAS_DOCUMENTS_CONFIG } from '../../config/registro-libretas-documents.config';
import { MOVIMIENTOS_LIBRETA_REGISTRO, nombreBeneficiario, nombreTipoOperacion } from '../../models/registro-libretas.model';

const NOMBRE_DOCUMENTO = 'Registro de operaciones en las libretas de las cuentas de registro';
const ENTIDAD = '009 - Ministerio de Economía y Finanzas';

/** Un documento por cada número que los movimientos de la libreta referencian (datos simulados). */
const DOCUMENTOS = [...new Map(MOVIMIENTOS_LIBRETA_REGISTRO.map((m) => [m.numeroDocumento, m])).values()].sort((a, b) =>
  a.numeroDocumento.localeCompare(b.numeroDocumento),
);

const formatoMonto = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monto = (valor: number): string => formatoMonto.format(valor);

const fechaHoraVisible = (iso: string): string => `${fechaVisible(iso)} ${iso.slice(11, 19)}`;

const fechaVisible = (iso: string): string => iso.slice(0, 10).split('-').reverse().join('/');

/**
 * «Documentos y registros» de Registro de operaciones en las libretas de las cuentas de registro. La pantalla la
 * arma `siaf-documents-records-page`; aquí solo se entregan las filas: documentos generados por el sistema (ya
 * procesados) y, en «Registros», los movimientos de la libreta.
 */
@Component({
  selector: 'siaf-registro-libretas-documents',
  standalone: true,
  imports: [DocumentsRecordsPageComponent],
  template: `<siaf-documents-records-page [config]="pageConfig" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroLibretasDocumentsComponent {
  readonly pageConfig: DocumentsRecordsConfig = {
    ...REGISTRO_LIBRETAS_DOCUMENTS_CONFIG,
    documentRows: DOCUMENTOS.map(
      (m): DocumentsRecordsRow => ({
        document: NOMBRE_DOCUMENTO,
        documentId: m.documentoId,
        number: m.numeroDocumento,
        actionType: 'Creación',
        status: 'Procesado',
        system: 'Tesorería',
        date: fechaVisible(m.fecha),
        entity: ENTIDAD,
        linkRoute: `/procesos/registro-libretas-cuentas-registro/consultas`,
        detailRoute: `${DOCUMENTO_ROUTE}/${m.numeroDocumento}`,
      }),
    ),
    recordRows: MOVIMIENTOS_LIBRETA_REGISTRO.map(
      (m): DocumentsRecordsRow => ({
        sec: m.sec,
        fecha: fechaHoraVisible(m.fecha),
        beneficiarioCodigo: m.beneficiarioCodigo,
        beneficiario: nombreBeneficiario(m.beneficiarioCodigo).toUpperCase(),
        numeroCuentaRegistro: m.numeroCuentaRegistro,
        descripcionCuentaRegistro: m.descripcionCuentaRegistro,
        tipoOperacion: nombreTipoOperacion(m.tipoOperacionCodigo),
        entidad: m.entidad,
        unidadEjecutora: m.entidad === 'MEF' ? '-' : m.unidadEjecutora,
        grupo: m.grupo,
        saldoInicial: monto(m.saldoInicial),
        debito: monto(m.debito),
        credito: monto(m.credito),
        status: 'Activo',
        number: m.numeroDocumento,
        descripcionDocumento: m.descripcionDocumento,
        saldoFinal: monto(m.saldoFinal),
        document: NOMBRE_DOCUMENTO,
        documentId: m.documentoId,
        actionType: 'Creación',
        linkRoute: `/procesos/registro-libretas-cuentas-registro/consultas`,
        recordRoute: `${REGISTRO_ROUTE}/${m.sec}`,
      }),
    ),
    buildDocumentHistory: (row) => ({
      staticRows: [
        { usuario: 'Sistema', rol: 'Motor de registro', fecha: String(row['date'] ?? ''), hora: '18:02:00', estado: 'Procesado', comentario: '' },
      ],
    }),
  };
}
