import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { DocumentsRecordsPageComponent } from '../../../../../shared/components/documents-records-page/documents-records-page.component';
import { PdfViewerModalComponent } from '../../../../../shared/components/pdf-viewer-modal/pdf-viewer-modal.component';
import { SnackbarComponent } from '../../../../../shared/ui/snackbar/snackbar.component';
import type { DocumentsRecordsConfig, DocumentsRecordsDownloadEvent, DocumentsRecordsRow } from '../../../../../shared/types/documents-records.types';
import { DOCUMENTO_ROUTE, REGISTRO_ROUTE } from '../../config/registro-libretas.rutas';
import { REGISTRO_LIBRETAS_DOCUMENTS_CONFIG } from '../../config/registro-libretas-documents.config';
import { CUENTAS_BANCARIAS_INFO, DOCUMENTOS_RECHAZADOS, MOVIMIENTOS_LIBRETA_REGISTRO, MOVIMIENTOS_RECHAZADOS, nombreBeneficiario, nombreTipoOperacion } from '../../models/registro-libretas.model';
import { construirDetalleRegistro } from '../../utils/registro-libretas-detalle.util';
import { exportarDocumentosExcel, exportarRegistrosExcel, generarPdfRegistro } from '../../utils/registro-libretas-export.util';

const NOMBRE_DOCUMENTO = 'Registro de operaciones en las libretas de las cuentas de registro';
const ENTIDAD = '009 - Ministerio de Economía y Finanzas';
const USUARIO_HISTORIAL = 'JUAN DOE PEREZ PEREZ';
const UNIDAD_HISTORIAL = 'Dirección General del Tesoro Público';

/** hh:mm:ss menos un minuto (el documento se registra justo antes de procesarse). */
const unMinutoAntes = (hora: string): string => {
  const [h, m, s] = hora.split(':').map(Number);
  const total = Math.max(0, h * 60 + m - 1);
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${dos(Math.floor(total / 60))}:${dos(total % 60)}:${dos(s || 0)}`;
};

/** Un documento por cada número que los movimientos de la libreta referencian (datos simulados). */
const DOCUMENTOS = [...new Map([...MOVIMIENTOS_LIBRETA_REGISTRO, ...MOVIMIENTOS_RECHAZADOS].map((m) => [m.numeroDocumento, m])).values()].sort((a, b) =>
  a.numeroDocumento.localeCompare(b.numeroDocumento),
);

const formatoMonto = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monto = (valor: number): string => formatoMonto.format(valor);

const fechaHoraVisible = (iso: string): string => `${fechaVisible(iso)} ${iso.slice(11, 19)}`;

const fechaVisible = (iso: string): string => iso.slice(0, 10).split('-').reverse().join('/');

/** El valor de un campo del detalle del registro (sección y rótulo), para las columnas de «Más columnas». */
const campoDetalle = (sec: string, seccion: string, caption: string): string =>
  construirDetalleRegistro(sec)?.secciones.find((s) => s.titulo === seccion)?.campos.find((c) => c.caption === caption)?.value ?? '-';

/**
 * «Documentos y registros» de Registro de operaciones en las libretas de las cuentas de registro. La pantalla la
 * arma `siaf-documents-records-page`; aquí solo se entregan las filas: documentos generados por el sistema (ya
 * procesados) y, en «Registros», los movimientos de la libreta.
 */
@Component({
  selector: 'siaf-registro-libretas-documents',
  standalone: true,
  imports: [DocumentsRecordsPageComponent, PdfViewerModalComponent, SnackbarComponent],
  template: `
    <siaf-documents-records-page [config]="pageConfig" (recordActionClicked)="verDocumentoPdf($event)" (selectionDownloaded)="descargarSeleccion($event)" />
    <div class="fixed bottom-siaf-lg left-1/2 z-50 w-[min(430px,calc(100vw-32px))] -translate-x-1/2">
      <siaf-snackbar [open]="preparandoExportacion()" tone="neutral" [dismissible]="false" message="Preparando archivo para exportar" />
    </div>
    <siaf-pdf-viewer-modal [open]="pdfAbierto()" [blob]="pdfBlob()" [nombre]="pdfNombre()" [totalPaginas]="pdfPaginas()" (closed)="cerrarPdf()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroLibretasDocumentsComponent {
  readonly pdfAbierto = signal(false);
  readonly pdfBlob = signal<Blob | null>(null);
  readonly pdfNombre = signal('documento.pdf');
  readonly pdfPaginas = signal(1);
  readonly preparandoExportacion = signal(false);

  readonly pageConfig: DocumentsRecordsConfig = {
    ...REGISTRO_LIBRETAS_DOCUMENTS_CONFIG,
    // Estado y tipo de acción no distinguen nada acá (todos los documentos quedan «Procesado»/«Creación»): los
    // filtros rápidos de la pestaña Documentos son, en su lugar, el número de documento y la fecha de registro.
    documentFilter1Label: 'Estado',
    documentFilter1Key: 'status',
    documentFilter1Options: ['Procesado', 'Rechazado'],
    documentFilter2Label: 'Fecha de registro',
    documentFilter2Key: 'dateIso',
    documentFilter2Type: 'dateRange',
    documentRows: DOCUMENTOS.map(
      (m): DocumentsRecordsRow => ({
        document: NOMBRE_DOCUMENTO,
        documentId: m.documentoId,
        number: m.numeroDocumento,
        actionType: 'Creación',
        status: m.numeroDocumento in DOCUMENTOS_RECHAZADOS ? 'Rechazado' : 'Procesado',
        system: 'Tesorería',
        date: fechaVisible(m.fecha),
        dateIso: m.fecha.slice(0, 10),
        time: m.fecha.slice(11, 19),
        entity: ENTIDAD,
        linkRoute: `/procesos/registro-libretas-cuentas-registro/consultas`,
        detailRoute: `${DOCUMENTO_ROUTE}/${m.numeroDocumento}`,
      }),
    ),
    recordRows: MOVIMIENTOS_LIBRETA_REGISTRO.map(
      (m): DocumentsRecordsRow => ({
        sec: m.sec,
        fecha: fechaHoraVisible(m.fecha),
        cuentaBancariaNumero: CUENTAS_BANCARIAS_INFO.find((c) => c.id === m.cuentaBancariaId)?.numeroCuenta ?? '',
        cuentaBancariaDenominacion: CUENTAS_BANCARIAS_INFO.find((c) => c.id === m.cuentaBancariaId)?.nombre ?? '',
        moneda: CUENTAS_BANCARIAS_INFO.find((c) => c.id === m.cuentaBancariaId)?.moneda ?? '',
        fechaRegistro: construirDetalleRegistro(m.sec)?.fechaRegistro ?? '-',
        numeroOperacion: construirDetalleRegistro(m.sec)?.numeroOperacion ?? '-',
        tipoBeneficiario: campoDetalle(m.sec, 'Beneficiario', 'Tipo'),
        entidadAdministradoraCodigo: campoDetalle(m.sec, 'Entidad administradora', 'Código'),
        entidadAdministradoraSigla: campoDetalle(m.sec, 'Entidad administradora', 'Sigla'),
        movimientoInternoCodigo: campoDetalle(m.sec, 'Movimiento interno', 'Código'),
        movimientoInternoDescripcion: campoDetalle(m.sec, 'Movimiento interno', 'Descripción'),
        movimientoInternoSigla: campoDetalle(m.sec, 'Movimiento interno', 'Sigla'),
        movimientoExternoCodigo: campoDetalle(m.sec, 'Movimiento externo', 'Código'),
        movimientoExternoDescripcion: campoDetalle(m.sec, 'Movimiento externo', 'Descripción'),
        documentoCutNumero: campoDetalle(m.sec, 'Documento CUT', 'Número'),
        documentoCutArchivo: campoDetalle(m.sec, 'Documento CUT', 'Archivo'),
        documentoCutSigla: campoDetalle(m.sec, 'Documento CUT', 'Sigla'),
        descripcionDetallada: construirDetalleRegistro(m.sec)?.descripcionDetallada ?? '-',
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
    // Trazabilidad de todo documento existente: se Registró un minuto antes de quedar Procesado (más reciente arriba).
    buildDocumentHistory: (row) => {
      const fecha = String(row['date'] ?? '');
      const procesado = String(row['time'] ?? '18:02:00');
      const estadoFinal = String(row['status'] ?? 'Procesado');
      return {
        staticRows: [
          { usuario: USUARIO_HISTORIAL, rol: UNIDAD_HISTORIAL, fecha, hora: procesado, estado: estadoFinal, comentario: '' },
          { usuario: USUARIO_HISTORIAL, rol: UNIDAD_HISTORIAL, fecha, hora: unMinutoAntes(procesado), estado: 'Registrado', comentario: '' },
        ],
      };
    },
  };

  /** «Ver documento PDF» de una fila de Registros: arma el PDF del registro (jsPDF) y lo abre en el visor nativo. */
  async verDocumentoPdf(row: DocumentsRecordsRow): Promise<void> {
    const sec = String(row['sec'] ?? '');
    const generado = await generarPdfRegistro(sec);
    if (!generado) return;
    this.pdfBlob.set(generado.blob);
    this.pdfNombre.set(generado.nombre);
    this.pdfPaginas.set(generado.paginas);
    this.pdfAbierto.set(true);
  }

  /** «Descargar» de la barra de selección: Excel de los documentos o de los registros elegidos (según la pestaña). */
  async descargarSeleccion(evento: DocumentsRecordsDownloadEvent): Promise<void> {
    if (!evento.rows.length) return;
    this.preparandoExportacion.set(true);
    try {
      // Armar el Excel es casi instantáneo: se le da un mínimo de tiempo visible al snackbar para que alcance a leerse.
      const minimoVisible = new Promise((resuelve) => setTimeout(resuelve, 1200));
      const archivo =
        evento.tab === 'documents'
          ? exportarDocumentosExcel(
              evento.rows.map((r) => ({
                document: String(r['document'] ?? ''),
                number: String(r['number'] ?? ''),
                actionType: String(r['actionType'] ?? ''),
                status: String(r['status'] ?? ''),
                system: String(r['system'] ?? ''),
                dateIso: String(r['dateIso'] ?? ''),
                entity: String(r['entity'] ?? ''),
              })),
              evento.filters,
            )
          : exportarRegistrosExcel(
              evento.rows.map((r) => String(r['sec'] ?? '')),
              evento.filters,
              evento.visibleColumns,
            );
      await Promise.all([archivo, minimoVisible]);
    } finally {
      this.preparandoExportacion.set(false);
    }
  }

  cerrarPdf(): void {
    this.pdfAbierto.set(false);
  }
}
