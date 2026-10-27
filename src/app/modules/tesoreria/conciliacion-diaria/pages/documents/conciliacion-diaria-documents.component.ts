import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject } from '@angular/core';

import { PermissionService } from '../../../../../core/auth/permission.service';
import { SolicitudesFacadeService } from '../../../../../core/state/solicitudes-facade.service';
import { SolicitudesStateService } from '../../../../../core/state/solicitudes-state.service';

import { DocumentsRecordsPageComponent } from '../../../../../shared/components/documents-records-page/documents-records-page.component';
import type { DocumentsRecordsConfig, DocumentsRecordsRow } from '../../../../../shared/types/documents-records.types';
import { CONCILIACION_DIARIA_CONFIG, REQUEST_ROUTE } from '../../config/conciliacion-diaria.config';
import {
  CODIGO_DOCUMENTO,
  CUENTAS_CONCILIACION,
  FECHA_CONCILIACION_APROBADA,
  RegistroNoConciliado,
  conciliarRegistro,
  diaDeOperacion,
  registrosNoConciliados,
  trazabilidadDeEjemplo,
} from '../../models/conciliacion-diaria.model';

/** Misma entidad que muestran las solicitudes del usuario en la bandeja. */
const ENTIDAD = 'MEF Ministerio de Economía y Finanzas';
const DESC = 'Reporte de Recaudación';

/**
 * La historia de los datos de ejemplo, de un día a otro: el día D se procesan las operaciones y, al cierre (19:00), el sistema
 * genera la conciliación automática y las inconsistencias; el día siguiente el usuario crea la conciliación manual que las
 * ajusta (por eso sus operaciones son siempre de un día antes), que se verifica y aprueba en los días que siguen. Los registros
 * activos llevan el número del documento que los originó.
 */
const CREACION_MANUAL = new Date(`${FECHA_CONCILIACION_APROBADA}T00:00:00`);
const DIA_D = diaDeOperacion(CREACION_MANUAL);
const dos = (n: number): string => String(n).padStart(2, '0');
const DIA_D_TEXTO = `${dos(DIA_D.getDate())}/${dos(DIA_D.getMonth() + 1)}/${DIA_D.getFullYear()}`;
const DIA_D_ISO = `${DIA_D.getFullYear()}-${dos(DIA_D.getMonth() + 1)}-${dos(DIA_D.getDate())}`;
const CIERRE = `${DIA_D_TEXTO} 19:00:00`;
const TRAZA_MANUAL = trazabilidadDeEjemplo(FECHA_CONCILIACION_APROBADA);

const documento = (document: string, number: string, status: string, hora: string): DocumentsRecordsRow => ({
  document,
  number,
  actionType: 'Creación',
  status,
  system: 'Tesorería',
  date: `${DIA_D_TEXTO} ${hora}`,
  dateIso: DIA_D_ISO,
  entity: ENTIDAD,
});

/**
 * Documentos que genera el sistema al procesar la conciliación (sin pantalla de detalle). La conciliación manual no está aquí:
 * la crea el usuario y viene de su bandeja (000001-2026, aprobada, es la que originó los registros manuales).
 */
export const DOCUMENTOS_DEL_SISTEMA: DocumentsRecordsRow[] = [
  documento('Inconsistencias de conciliación diaria', '000001-2026', 'Generado', '19:00:00'),
  documento('Conciliación automática diaria', '000001-2026', 'Generado', '19:00:00'),
  documento('Procesamiento de conciliación diaria', '000004-2026', 'Procesado', '10:06:11'),
  documento('Procesamiento de conciliación diaria', '000003-2026', 'Procesado', '10:05:09'),
  documento('Procesamiento de conciliación diaria', '000002-2026', 'Procesado', '10:05:06'),
  documento('Procesamiento de conciliación diaria', '000001-2026', 'Procesado', '10:00:13'),
];

const MANUAL = 'Conciliación manual diaria';
const AUTO = 'Conciliación automática diaria';
const INCONSISTENCIAS = 'Inconsistencias de conciliación diaria';

/** Cuenta bancaria de los registros de ejemplo. */
const CUENTA = CUENTAS_CONCILIACION[0];

/** Quién elaboró, verificó y aprobó la conciliación manual (Carla crea y verifica; Luis, otra persona, aprueba). */
const TRAZA_PERSONAS = {
  elaboradoPor: 'CARLA MENDOZA RÍOS', elaboradoFecha: TRAZA_MANUAL.elaborado,
  verificadoPor: 'CARLA MENDOZA RÍOS', verificadoFecha: TRAZA_MANUAL.verificado,
  aprobadoPor: 'LUIS QUISPE SALAS', aprobadoFecha: TRAZA_MANUAL.aprobado,
};
/** Lo que genera el sistema (conciliación automática e inconsistencias) lo elabora SIAF RP al cierre del día. */
const TRAZA_SISTEMA = { elaboradoPor: 'SIAF RP', elaboradoFecha: CIERRE };

/** La fila de un registro: sus operaciones del libro banco y del registro de operaciones bancarias, y su documento. */
const fila = (r: RegistroNoConciliado, tipo: string, doc: string, number: string, estado: 'Conciliado' | 'No conciliado', extra: DocumentsRecordsRow): DocumentsRecordsRow => ({
  nro: r.nro,
  tipoConciliacion: tipo,
  lbFecha: r.lbFecha,
  lbNumero: r.lbNumero,
  lbDescripcion: r.lbDescripcion,
  lbEntidad: r.lbEntidad,
  lbDebito: r.lbDebito,
  lbCredito: r.lbCredito,
  rbFecha: r.rbFecha,
  rbNumero: r.rbNumero,
  rbDescripcion: r.rbDescripcion,
  rbDebito: r.rbDebito,
  rbCredito: r.rbCredito,
  motivo: r.motivo || '-',
  status: 'Activo',
  number,
  descripcionDocumento: doc,
  estadoConciliacion: estado,
  document: doc,
  actionType: 'Creación',
  cuentaNumero: CUENTA.numeroCuenta,
  cuentaDenominacion: CUENTA.denominacion,
  cuentaMoneda: CUENTA.moneda,
  cuentaEntidad: CUENTA.entidadFinanciera,
  ...extra,
});

/** Los registros que Carla concilió a mano en 000001-2026: los mismos que la solicitud aprobada, con su sustento y justificación. */
const NO_CONCILIADOS = registrosNoConciliados(CREACION_MANUAL);
const MANUALES = [0, 1].map((i) => {
  const r = conciliarRegistro(NO_CONCILIADOS[i], '1,000.00');
  return fila(r, 'Manual', MANUAL, '000001-2026', 'Conciliado', {
    fechaRegistro: TRAZA_MANUAL.aprobado,
    sustentosJson: JSON.stringify((r.sustentos ?? []).map((s) => ({ tipo: s.tipo, nombre: s.nombre }))),
    justificacion: r.justificacion ?? '',
    ...TRAZA_PERSONAS,
  });
});

/** Registro conciliado por el sistema: la misma operación en libro banco y en el registro de operaciones bancarias. */
const automatico = (nro: number, hora: string, numero: string, credito: string): DocumentsRecordsRow =>
  fila(
    {
      id: `auto-${nro}`, nro: String(nro),
      lbFecha: `${DIA_D_TEXTO} ${hora}`, lbNumero: numero, lbDescripcion: DESC, lbEntidad: 'SUNAT', lbDebito: '0.00', lbCredito: credito,
      rbFecha: `${DIA_D_TEXTO} ${hora}`, rbNumero: numero, rbDescripcion: DESC, rbDebito: '0.00', rbCredito: credito, motivo: '-',
    },
    'Automático', AUTO, '000001-2026', 'Conciliado', { fechaRegistro: CIERRE, ...TRAZA_SISTEMA },
  );

export const REGISTROS_DE_EJEMPLO: DocumentsRecordsRow[] = [
  ...MANUALES,
  automatico(6, '10:40:06', '02698156', '24,030.00'),
  automatico(5, '10:40:05', '02698155', '26,784.00'),
  automatico(4, '10:30:11', '02698153', '35,000.00'),
  automatico(3, '10:30:10', '02698152', '16,200.00'),
  automatico(2, '10:10:09', '02698151', '9,000.00'),
  automatico(1, '10:06:11', '02698149', '9,753.00'),
  // Inconsistencias: sin su par en el libro banco o en el registro de operaciones bancarias, o con montos distintos.
  ...NO_CONCILIADOS.map((r) => fila(r, 'Automático', INCONSISTENCIAS, '000001-2026', 'No conciliado', { fechaRegistro: CIERRE, ...TRAZA_SISTEMA })),
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
      recordRows: REGISTROS_DE_EJEMPLO,
    };
  });
}
