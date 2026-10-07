import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { DocumentsRecordsPageComponent } from '../../../../../shared/components/documents-records-page/documents-records-page.component';
import { PdfViewerModalComponent } from '../../../../../shared/components/pdf-viewer-modal/pdf-viewer-modal.component';
import { SnackbarComponent } from '../../../../../shared/ui/snackbar/snackbar.component';
import type { DocumentsRecordsConfig, DocumentsRecordsDownloadEvent, DocumentsRecordsRow } from '../../../../../shared/types/documents-records.types';
import { RegistroLibretasApiService } from '../../api/registro-libretas-api.service';
import { DOCUMENTO_ROUTE, REGISTRO_ROUTE } from '../../config/registro-libretas.rutas';
import { REGISTRO_LIBRETAS_DOCUMENTS_CONFIG } from '../../config/registro-libretas-documents.config';
import { CUENTAS_BANCARIAS_INFO, DocumentoLibreta, MovimientoLibretaRegistro, nombreBeneficiario, nombreTipoOperacion } from '../../models/registro-libretas.model';
import { construirDetalleRegistro } from '../../utils/registro-libretas-detalle.util';
import { exportarDocumentosExcel, exportarRegistrosExcel } from '../../utils/exportacion/excel-descargas.util';
import { generarPdfRegistro } from '../../utils/exportacion/pdf-registro.util';

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

const formatoMonto = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monto = (valor: number): string => formatoMonto.format(valor);

const fechaHoraVisible = (iso: string): string => `${fechaVisible(iso)} ${iso.slice(11, 19)}`;

const fechaVisible = (iso: string): string => iso.slice(0, 10).split('-').reverse().join('/');

/** El valor de un campo del detalle del registro (sección y rótulo), para las columnas de «Más columnas». */
const campoDetalle = (m: MovimientoLibretaRegistro, seccion: string, caption: string): string =>
  construirDetalleRegistro(m).secciones.find((s) => s.titulo === seccion)?.campos.find((c) => c.caption === caption)?.value ?? '-';

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
    <siaf-documents-records-page [config]="pageConfig()" (recordActionClicked)="verDocumentoPdf($event)" (selectionDownloaded)="descargarSeleccion($event)" />
    <div class="fixed bottom-siaf-lg left-1/2 z-50 w-[min(430px,calc(100vw-32px))] -translate-x-1/2">
      <siaf-snackbar [open]="preparandoExportacion()" tone="neutral" [dismissible]="false" message="Preparando archivo para exportar" />
    </div>
    <siaf-pdf-viewer-modal [open]="pdfAbierto()" [blob]="pdfBlob()" [nombre]="pdfNombre()" [totalPaginas]="pdfPaginas()" (closed)="cerrarPdf()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroLibretasDocumentsComponent implements OnInit {
  private readonly api = inject(RegistroLibretasApiService);

  /** Lo que entrega el backend simulado: los documentos del sistema y los movimientos de la libreta. */
  private readonly documentos = signal<DocumentoLibreta[]>([]);
  private readonly movimientos = signal<MovimientoLibretaRegistro[]>([]);

  ngOnInit(): void {
    forkJoin({ documentos: this.api.listarDocumentos(), movimientos: this.api.listarMovimientos() }).subscribe(({ documentos, movimientos }) => {
      this.documentos.set(documentos);
      this.movimientos.set(movimientos);
    });
  }

  readonly pdfAbierto = signal(false);
  readonly pdfBlob = signal<Blob | null>(null);
  readonly pdfNombre = signal('documento.pdf');
  readonly pdfPaginas = signal(1);
  readonly preparandoExportacion = signal(false);

  readonly pageConfig = computed((): DocumentsRecordsConfig => ({
    ...REGISTRO_LIBRETAS_DOCUMENTS_CONFIG,
    // Estado y tipo de acción no distinguen nada acá (todos los documentos quedan «Procesado»/«Creación»): los
    // filtros rápidos de la pestaña Documentos son, en su lugar, el número de documento y la fecha de registro.
    documentFilter1Label: 'Estado',
    documentFilter1Key: 'status',
    documentFilter1Options: ['Procesado', 'Rechazado'],
    documentFilter2Label: 'Fecha de registro',
    documentFilter2Key: 'dateIso',
    documentFilter2Type: 'dateRange',
    documentRows: this.documentos().map(
      (d): DocumentsRecordsRow => ({
        document: NOMBRE_DOCUMENTO,
        documentId: d.documentoId,
        number: d.numero,
        actionType: 'Creación',
        status: d.estado,
        system: 'Tesorería',
        date: fechaVisible(d.fecha),
        dateIso: d.fecha.slice(0, 10),
        time: d.fecha.slice(11, 19),
        entity: ENTIDAD,
        linkRoute: `/procesos/registro-libretas-cuentas-registro/consultas`,
        detailRoute: `${DOCUMENTO_ROUTE}/${d.numero}`,
      }),
    ),
    recordRows: this.movimientos().map(
      (m): DocumentsRecordsRow => ({
        sec: m.sec,
        fecha: fechaHoraVisible(m.fecha),
        cuentaBancariaNumero: CUENTAS_BANCARIAS_INFO.find((c) => c.id === m.cuentaBancariaId)?.numeroCuenta ?? '',
        cuentaBancariaDenominacion: CUENTAS_BANCARIAS_INFO.find((c) => c.id === m.cuentaBancariaId)?.nombre ?? '',
        moneda: CUENTAS_BANCARIAS_INFO.find((c) => c.id === m.cuentaBancariaId)?.moneda ?? '',
        fechaRegistro: construirDetalleRegistro(m).fechaRegistro,
        numeroOperacion: construirDetalleRegistro(m).numeroOperacion,
        tipoBeneficiario: campoDetalle(m, 'Beneficiario', 'Tipo'),
        entidadAdministradoraCodigo: campoDetalle(m, 'Entidad administradora', 'Código'),
        entidadAdministradoraSigla: campoDetalle(m, 'Entidad administradora', 'Sigla'),
        movimientoInternoCodigo: campoDetalle(m, 'Movimiento interno', 'Código'),
        movimientoInternoDescripcion: campoDetalle(m, 'Movimiento interno', 'Descripción'),
        movimientoInternoSigla: campoDetalle(m, 'Movimiento interno', 'Sigla'),
        movimientoExternoCodigo: campoDetalle(m, 'Movimiento externo', 'Código'),
        movimientoExternoDescripcion: campoDetalle(m, 'Movimiento externo', 'Descripción'),
        documentoCutNumero: campoDetalle(m, 'Documento CUT', 'Número'),
        documentoCutArchivo: campoDetalle(m, 'Documento CUT', 'Archivo'),
        documentoCutSigla: campoDetalle(m, 'Documento CUT', 'Sigla'),
        descripcionDetallada: construirDetalleRegistro(m).descripcionDetallada,
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
  }));

  /** «Ver documento PDF» de una fila de Registros: arma el PDF del registro (jsPDF) y lo abre en el visor nativo. */
  async verDocumentoPdf(row: DocumentsRecordsRow): Promise<void> {
    const movimiento = this.movimientos().find((m) => m.sec === String(row['sec'] ?? ''));
    if (!movimiento) return;
    const generado = await generarPdfRegistro(construirDetalleRegistro(movimiento));
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
              evento.rows.flatMap((r) => this.movimientos().find((m) => m.sec === String(r['sec'] ?? '')) ?? []),
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
