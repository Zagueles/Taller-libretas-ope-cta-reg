import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SolicitudResponse, SolicitudesApiService } from '../../../core/api/solicitudes-api.service';
import { DocumentHistoryPanelComponent } from './document-history-panel.component';

const SOLICITUD = {
  id: 'sol-1',
  numero: '000001-2026',
  unidadCreadora: { id: 'uo-dgtp', sigla: 'DGTP', nombre: 'Dirección General del Tesoro Público' },
  historialEstados: [
    { id: 'h1', estadoNuevo: 'ELABORADO', createdAt: '2026-08-18T09:15:00', creador: { nombres: 'Carla', apellidoPaterno: 'Mendoza', apellidoMaterno: 'Ríos' }, perfil: { cfgPerfil: { rol: { codigo: 'CREADOR', nombre: 'Creador' } } } },
    { id: 'h2', estadoNuevo: 'APROBADO', createdAt: '2026-08-20T11:29:00', creador: { nombres: 'Luis', apellidoPaterno: 'Quispe', apellidoMaterno: 'Salas' }, perfil: { cfgPerfil: { rol: { codigo: 'APROBADOR', nombre: 'Aprobador' } } } },
  ],
} as unknown as SolicitudResponse;

describe('DocumentHistoryPanelComponent — historial de estados', () => {
  let fixture: ComponentFixture<DocumentHistoryPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentHistoryPanelComponent],
      providers: [{ provide: SolicitudesApiService, useValue: { obtenerDetalle: () => of(SOLICITUD) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(DocumentHistoryPanelComponent);
    fixture.componentRef.setInput('summary', { solicitudId: 'sol-1', document: 'Conciliación manual diaria', number: '000001-2026', actionType: 'Creación' });
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('la columna «Unidad organizacional» muestra la unidad que creó la solicitud y no el rol del usuario', () => {
    const filas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent!.replace(/\s+/g, ' ').trim()));

    expect(filas.length).toBe(2);
    for (const fila of filas) {
      expect(fila[1]).toBe('Dirección General del Tesoro Público');
      expect(fila[1]).not.toMatch(/Creador|Aprobador/);
    }
  });

  it('muestra quién actuó en cada paso: quien aprueba es otra persona que quien elaboró', () => {
    const usuarios = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')).map((tr) => tr.querySelector('td')!.textContent!.trim());

    expect(usuarios).toEqual(['Carla Mendoza Ríos', 'Luis Quispe Salas']);
  });
});
