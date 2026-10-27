import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { DocumentsRecordsRow } from '../../types/documents-records.types';
import { ConciliacionHistoryPanelComponent } from './conciliacion-history-panel.component';

const REGISTRO: DocumentsRecordsRow = {
  document: 'Conciliación manual diaria',
  number: '000010-2025',
  actionType: 'Creación',
  status: 'Activo',
  tipoConciliacion: 'Manual',
  estadoConciliacion: 'No conciliado',
  nro: '4',
  motivo: 'No existe OBO',
  fechaRegistro: '19/08/2026 08:00:59',
  lbFecha: '01/12/2025 10:05:09', lbNumero: '02698149', lbDescripcion: 'Reporte de Recaudación', lbEntidad: 'SUNAT', lbDebito: '0.00', lbCredito: '9,000.00',
  rbFecha: '', rbNumero: '', rbDescripcion: '', rbDebito: '', rbCredito: '',
  cuentaNumero: '11040103570200000000', cuentaDenominacion: 'MEF - DGTP - CUT', cuentaMoneda: 'PEN', cuentaEntidad: 'Banco Central de Reserva del Perú',
  sustentosJson: JSON.stringify([{ tipo: 'Constancia', nombre: 'Constancia_BCR.pdf', tamano: '500kb' }]),
  justificacion: 'El BCR informó el RR anterior.',
  elaboradoPor: 'RICARDO JOHN DOE BUSTAMANTE', elaboradoFecha: '19/08/2025 08:00:59',
};

describe('ConciliacionHistoryPanelComponent', () => {
  let fixture: ComponentFixture<ConciliacionHistoryPanelComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  const abrir = (registro: DocumentsRecordsRow): void => {
    fixture.componentRef.setInput('record', registro);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ConciliacionHistoryPanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(ConciliacionHistoryPanelComponent);
  });

  it('es un diálogo «Historial del registro» que se cierra con la X', () => {
    const cerrados: number[] = [];
    fixture.componentInstance.closed.subscribe(() => cerrados.push(1));
    abrir(REGISTRO);

    expect(el().querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
    expect(el().querySelector('#conciliacion-history-title')?.textContent).toContain('Historial del registro');
    el().querySelector<HTMLButtonElement>('button[aria-label="Cerrar historial del registro"]')!.click();
    expect(cerrados.length).toBe(1);
  });

  it('muestra el documento, la información de conciliación, la cuenta bancaria y el registro no conciliado con su motivo', () => {
    abrir(REGISTRO);
    const texto = el().textContent!.replace(/\s+/g, ' ');

    expect(texto).toContain('Conciliación manual diaria');
    expect(texto).toContain('000010-2025');
    expect(texto).toContain('Información de conciliación');
    expect(texto).toContain('Manual');
    expect(texto).toContain('11040103570200000000');
    expect(texto).toContain('MEF - DGTP - CUT');
    expect(el().querySelector('[data-titulo-registro]')?.textContent).toContain('Registros no conciliados');
    expect(texto).toContain('Motivo de inconsistencia');
    expect(texto).toContain('No existe OBO');
  });

  it('el libro banco lleva su fila TOTAL y, sin operación bancaria, la otra sección avisa que no hay', () => {
    abrir(REGISTRO);

    const total = el().querySelector('[data-libro-banco] [data-total]')!.textContent!.replace(/\s+/g, ' ');
    expect(total).toContain('TOTAL');
    expect(total).toContain('9,000.00');
    expect(el().querySelectorAll('[data-libro-banco] tbody tr').length).toBe(2);
    expect(el().querySelector('[data-operaciones-bancarias] table')).toBeNull();
    expect(el().querySelector('[data-operaciones-bancarias]')!.textContent).toContain('No hay una operación');
  });

  it('un registro conciliado cambia el título, no muestra el motivo y trae las dos tablas', () => {
    abrir({ ...REGISTRO, estadoConciliacion: 'Conciliado', motivo: '-', rbFecha: '01/12/2025 10:05:09', rbNumero: '02698149', rbDescripcion: 'Reporte de Recaudación', rbDebito: '0.00', rbCredito: '9,000.00' });

    expect(el().querySelector('[data-titulo-registro]')?.textContent).toContain('Registros conciliados');
    expect(el().textContent).not.toContain('Motivo de inconsistencia');
    expect(el().querySelector('[data-operaciones-bancarias] table')).not.toBeNull();
  });

  it('el sustento y la justificación solo salen cuando el registro los trae', () => {
    abrir(REGISTRO);
    expect(el().querySelector('[data-sustentos]')!.textContent).toContain('Constancia_BCR.pdf');
    expect(el().querySelector('[data-justificacion]')!.textContent).toContain('El BCR informó el RR anterior.');

    abrir({ ...REGISTRO, sustentosJson: undefined, justificacion: undefined });
    expect(el().querySelector('[data-sustentos]')).toBeNull();
    expect(el().querySelector('[data-justificacion]')).toBeNull();
  });

  it('el pie muestra quién elaboró y marca como no asignados a quienes aún no actuaron', () => {
    abrir(REGISTRO);
    const pie = el().textContent!.replace(/\s+/g, ' ');

    expect(pie).toContain('RICARDO JOHN DOE BUSTAMANTE');
    expect(pie).toContain('No asignado aún');
  });
});
