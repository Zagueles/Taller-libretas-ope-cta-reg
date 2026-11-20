import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { QueryReportAdvancedFilterField } from '../../types/query-report.types';
import { AdvancedFiltersPanelComponent, MAX_NIVELES } from './advanced-filters-panel.component';

const CAMPOS: QueryReportAdvancedFilterField[] = [
  { key: 'fecha', label: 'Fecha', type: 'date', groupable: true, groupableIn: ['agrupado'] },
  { key: 'entidad', label: 'Entidad', groupable: true, hierarchy: 1 },
  { key: 'ue', label: 'Unidad ejecutora', groupable: true, hierarchy: 2 },
  { key: 'ff', label: 'FF/Sub FF', groupable: true },
  { key: 'tipo', label: 'Tipo de operación', groupable: true },
];

describe('AdvancedFiltersPanelComponent', () => {
  let fixture: ComponentFixture<AdvancedFiltersPanelComponent>;
  let panel: AdvancedFiltersPanelComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(AdvancedFiltersPanelComponent);
    panel = fixture.componentInstance;
    fixture.componentRef.setInput('fields', CAMPOS);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('la fecha de acreditación solo se ofrece como nivel en Agrupado, y al pasar a Agregado se quita', () => {
    expect(panel.nivelesDisponibles().map((c) => c.key)).toContain('fecha');
    panel.niveles.set(['fecha', 'ff']);
    panel.cambiarTipo('agregado');
    expect(panel.nivelesDisponibles().map((c) => c.key)).not.toContain('fecha');
    expect(panel.niveles()).toEqual(['ff']);
  });

  it('admite hasta 3 niveles', () => {
    for (let i = 0; i < 5; i++) {
      panel.agregarNivel();
      const ultimo = panel.niveles().length - 1;
      if (panel.niveles()[ultimo] === '') panel.cambiarNivel(ultimo, panel.opcionesNivel(ultimo)[0].value as string);
    }
    expect(panel.niveles().length).toBe(MAX_NIVELES);
  });

  it('el nivel y la condición nuevos entran vacíos, y solo se aplica lo que la persona completó', () => {
    panel.agregarNivel();
    expect(panel.niveles()).toEqual(['']);
    expect(panel.puedeAgregarNivel()).toBeTrue();

    panel.agregarCondicion();
    expect(panel.condiciones()).toEqual([jasmine.objectContaining({ field: '', operator: '' })]);

    let aplicado: { conditions: unknown[]; levels: string[] } | undefined;
    panel.applied.subscribe((v) => (aplicado = v));
    panel.aplicar();
    expect(aplicado?.levels).toEqual([]);
    expect(aplicado?.conditions).toEqual([]);
  });

  it('Entidad va antes de Unidad ejecutora: el arrastre no los intercambia y el orden roto se marca', () => {
    panel.niveles.set(['entidad', 'ue']);
    panel.arrastrado = 1;
    panel.soltar(0);
    expect(panel.niveles()).toEqual(['entidad', 'ue']);

    panel.niveles.set(['entidad', 'ff', 'ue']);
    panel.arrastrado = 1;
    panel.soltar(0);
    expect(panel.niveles()).toEqual(['ff', 'entidad', 'ue']);

    panel.niveles.set(['ue', 'entidad']);
    expect(panel.jerarquiaCorrecta()).toBeFalse();
  });

  it('el arrastre de un nivel con jerarquía solo se habilita si encima tiene un nivel sin jerarquía', () => {
    panel.niveles.set(['entidad', 'ue', 'fecha']);
    expect([0, 1, 2].map((i) => panel.puedeArrastrar(i))).toEqual([false, false, true]);

    panel.niveles.set(['entidad', 'fecha', 'ue']);
    expect([0, 1, 2].map((i) => panel.puedeArrastrar(i))).toEqual([false, true, true]);

    panel.niveles.set(['fecha', 'entidad', 'ue']);
    expect([0, 1, 2].map((i) => panel.puedeArrastrar(i))).toEqual([true, true, false]);

    panel.niveles.set(['entidad']);
    expect(panel.puedeArrastrar(0)).toBeFalse();
  });

  it('no ofrece ni permite elegir un campo que rompa la jerarquía', () => {
    panel.niveles.set(['ue']);
    expect(panel.opcionesNivel(0).map((o) => o.value)).toContain('ue');
    panel.agregarNivel();
    panel.agregarNivel();
    expect(panel.niveles()).not.toContain('entidad');

    panel.niveles.set(['entidad', 'ff']);
    expect(panel.opcionesNivel(1).map((o) => o.value)).toContain('ue');
    panel.niveles.set(['ue', 'ff']);
    expect(panel.opcionesNivel(1).map((o) => o.value)).not.toContain('entidad');

    panel.niveles.set(['entidad', 'ff']);
    panel.cambiarNivel(0, 'ue');
    expect(panel.niveles()).toEqual(['ue', 'ff']);
    panel.niveles.set(['ue', 'ff']);
    panel.cambiarNivel(1, 'entidad');
    expect(panel.niveles()).toEqual(['ue', 'ff']);
  });

  describe('valores de la condición según lo ya filtrado', () => {
    const FILAS = [
      { fecha: '2026-06-28', entidad: 'MEF', ue: 'A', tipo: 'X' },
      { fecha: '2026-06-29', entidad: 'MEF', ue: 'B', tipo: 'Y' },
      { fecha: '2026-06-30', entidad: 'IPD', ue: 'C', tipo: 'X' },
    ];

    it('con las filas que dejaron los filtros de la pantalla, solo ofrece lo que queda (solo MEF)', () => {
      fixture.componentRef.setInput('rows', FILAS.filter((f) => f.entidad === 'MEF'));
      fixture.detectChanges();
      panel.agregarCondicion();
      const condicion = panel.condiciones()[0];
      panel.cambiarCondicion(condicion.id, { field: 'entidad' });
      expect(panel.opcionesValor(panel.condiciones()[0]).map((o) => o.value)).toEqual(['MEF']);
    });

    it('otra condición del borrador también recorta los valores, pero no los de su propio campo', () => {
      fixture.componentRef.setInput('rows', FILAS);
      fixture.detectChanges();
      panel.agregarCondicion();
      panel.agregarCondicion();
      const [uno, dos] = panel.condiciones();
      panel.cambiarCondicion(uno.id, { field: 'entidad', operator: '=', value: 'MEF' });
      panel.cambiarCondicion(dos.id, { field: 'tipo' });
      expect(panel.opcionesValor(panel.condiciones()[1]).map((o) => o.value)).toEqual(['X', 'Y']);
      panel.cambiarCondicion(dos.id, { field: 'ue', operator: '=', value: 'B' });
      expect(panel.opcionesValor(panel.condiciones()[0]).map((o) => o.value)).toEqual(['MEF']);
      expect(panel.opcionesValor({ id: 'x', field: 'tipo', operator: '=' }).map((o) => o.value)).toEqual(['Y']);
    });

    it('la fecha también se elige de una lista, con las fechas que quedan en dd/mm/aaaa', () => {
      fixture.componentRef.setInput('rows', FILAS.filter((f) => f.entidad === 'MEF'));
      fixture.detectChanges();
      panel.agregarCondicion();
      panel.cambiarCondicion(panel.condiciones()[0].id, { field: 'fecha', operator: '=' });
      fixture.detectChanges();
      expect(panel.opcionesValor(panel.condiciones()[0])).toEqual([
        { label: '28/06/2026', value: '2026-06-28' },
        { label: '29/06/2026', value: '2026-06-29' },
      ]);
      expect(fixture.nativeElement.querySelector('siaf-date-time-picker')).toBeNull();
    });
  });
});
