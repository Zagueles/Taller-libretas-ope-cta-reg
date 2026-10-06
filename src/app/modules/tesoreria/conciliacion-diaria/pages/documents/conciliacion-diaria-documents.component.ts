import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject } from '@angular/core';

import { PermissionService } from '../../../../../core/auth/permission.service';
import { SolicitudesFacadeService } from '../../../../../core/state/solicitudes-facade.service';
import { SolicitudesStateService } from '../../../../../core/state/solicitudes-state.service';

import { DocumentsRecordsPageComponent } from '../../../../../shared/components/documents-records-page/documents-records-page.component';
import type { DocumentsRecordsConfig, DocumentsRecordsRow } from '../../../../../shared/types/documents-records.types';
import { CONCILIACION_DIARIA_CONFIG, REQUEST_ROUTE } from '../../config/conciliacion-diaria.config';
import { CODIGO_DOCUMENTO } from '../../models/conciliacion-diaria.model';

const ENTIDAD = '009 - Ministerio de Economia y Finanzas';
const DESC = 'Reporte de Recaudación';

const documento = (document: string, number: string, status: string, hora: string): DocumentsRecordsRow => ({
  document,
  number,
  actionType: 'Creación',
  status,
  system: 'Tesorería',
  date: `01/12/2025 ${hora}`,
  dateIso: '2025-12-01',
  entity: ENTIDAD,
});

/** Documentos que genera el sistema al procesar la conciliación (sin pantalla de detalle). */
const DOCUMENTOS_DEL_SISTEMA: DocumentsRecordsRow[] = [
  documento('Conciliación manual diaria', '000001-2025', 'Elaborado', '19:00:00'),
  documento('Inconsistencias de conciliación diaria', '000001-2025', 'Generado', '19:00:00'),
  documento('Conciliación automática diaria', '000001-2025', 'Generado', '19:00:00'),
  documento('Procesamiento de conciliación diaria', '000004-2025', 'Procesado', '10:06:11'),
  documento('Procesamiento de conciliación diaria', '000003-2025', 'Procesado', '10:05:09'),
  documento('Procesamiento de conciliación diaria', '000002-2025', 'Procesado', '10:05:06'),
  documento('Procesamiento de conciliación diaria', '000001-2025', 'Procesado', '10:00:13'),
];

/** Registro conciliado: la misma operación en libro banco y en el registro de operaciones bancarias. */
const conciliado = (nro: number, tipo: string, hora: string, numero: string, credito: string, desc: string, doc: string): DocumentsRecordsRow => ({
  nro: String(nro),
  tipoConciliacion: tipo,
  lbFecha: `01/12/2025 ${hora}`,
  lbNumero: numero,
  lbDescripcion: DESC,
  lbEntidad: 'SUNAT',
  lbDebito: '0.00',
  lbCredito: credito,
  rbFecha: `01/12/2025 ${hora}`,
  rbNumero: numero,
  rbDescripcion: DESC,
  rbDebito: '0.00',
  rbCredito: credito,
  motivo: '-',
  status: 'Activo',
  number: '000010-2025',
  descripcionDocumento: desc,
  estadoConciliacion: 'Conciliado',
  document: doc,
});

const MANUAL = 'Conciliación manual diaria';
const AUTO = 'Conciliación automática diaria';

const REGISTROS: DocumentsRecordsRow[] = [
  conciliado(3, 'Manual', '10:00:13', '02698150', '5,068.00', MANUAL, MANUAL),
  conciliado(1, 'Manual', '10:00:13', '02698147', '9,753.00', MANUAL, MANUAL),
  conciliado(6, 'Automático', '10:40:06', '02698156', '24,030.00', AUTO, AUTO),
  conciliado(5, 'Automático', '10:40:05', '02698155', '26,784.00', AUTO, AUTO),
  conciliado(4, 'Automático', '10:30:11', '02698153', '35,000.00', AUTO, AUTO),
  conciliado(3, 'Automático', '10:30:10', '02698152', '16,200.00', AUTO, AUTO),
  conciliado(2, 'Automático', '10:10:09', '02698151', '9,000.00', AUTO, AUTO),
  conciliado(1, 'Automático', '10:06:11', '02698149', '9,753.00', AUTO, AUTO),
  // Inconsistencias: sin su par en el libro banco o en el registro de operaciones bancarias, o con montos distintos.
  {
    ...conciliado(4, 'Automático', '10:40:04', '02698154', '1,267.00', 'Inconsistencias de conciliación diaria', 'Inconsistencias de conciliación diaria'),
    rbFecha: '', rbNumero: '', rbDescripcion: '', rbDebito: '', rbCredito: '', motivo: 'No existe OBO', estadoConciliacion: 'No conciliado',
  },
  {
    ...conciliado(3, 'Automático', '10:10:08', '02698150', '5,068.80', 'Inconsistencias de conciliación diaria', 'Inconsistencias de conciliación diaria'),
    rbCredito: '5,068.00', motivo: 'Montos diferentes', estadoConciliacion: 'No conciliado',
  },
  {
    ...conciliado(2, 'Automático', '10:05:06', '02698148', '31,245.00', 'Inconsistencias de conciliación diaria', 'Inconsistencias de conciliación diaria'),
    rbFecha: '', rbNumero: '', rbDescripcion: '', rbDebito: '', rbCredito: '', motivo: 'No existe OBO', estadoConciliacion: 'No conciliado',
  },
  {
    ...conciliado(1, 'Automático', '10:00:13', '02698147', '9,753.00', 'Inconsistencias de conciliación diaria', 'Inconsistencias de conciliación diaria'),
    lbFecha: '', lbNumero: '', lbDescripcion: '', lbEntidad: '', lbDebito: '', lbCredito: '', motivo: 'No existe RR', estadoConciliacion: 'No conciliado',
  },
];

/**
 * «Documentos y registros» de Conciliación diaria. La pantalla la arma `siaf-documents-records-page`: esta página carga la
 * bandeja (las conciliaciones manuales que crea el usuario; al tocar una fila se abre su solicitud) y les suma los documentos que genera el
 * sistema al procesar la conciliación y los registros conciliados.
 */
@Component({
  selector: 'siaf-conciliacion-diaria-documents',
  standalone: true,
  imports: [DocumentsRecordsPageComponent],
  template: `<siaf-documents-records-page [config]="pageConfig()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConciliacionDiariaDocumentsComponent implements OnInit {
  private readonly permissions = inject(PermissionService);
  private readonly solicitudesState = inject(SolicitudesStateService);
  private readonly solicitudesFacade = inject(SolicitudesFacadeService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    // Bandeja según el rol (el aprobador además refresca cada 30 s). Se pide completa: la paginación es de la tabla.
    this.solicitudesFacade.iniciarBandeja(this.permissions.currentRole(), this.destroyRef, [CODIGO_DOCUMENTO], { page: 1, limit: 100 });
  }

  readonly pageConfig = computed((): DocumentsRecordsConfig => {
    const solicitudes = this.permissions.currentRole() === 'approver'
      ? this.solicitudesState.bandejaAprobador()
      : this.solicitudesState.bandejaCreador();

    const propios: DocumentsRecordsRow[] = solicitudes.map((s) => ({
      document: s.tipoDocumento,
      documentId: s.id,
      number: s.numero || '—',
      actionType: s.tipoAccion === 'creacion' ? 'Creación' : s.tipoAccion,
      status: s.estado,
      system: 'Tesorería',
      date: s.fecha,
      entity: s.entidad || '—',
      creator: s.creador,
      subject: s.justificacion,
      requesterArea: s.unidad,
      linkRoute: `${REQUEST_ROUTE}/${s.id}`,
      detailRoute: `${REQUEST_ROUTE}/${s.id}`,
    }));

    return {
      ...CONCILIACION_DIARIA_CONFIG,
      documentRows: [...propios, ...DOCUMENTOS_DEL_SISTEMA],
      recordRows: REGISTROS,
    };
  });
}
