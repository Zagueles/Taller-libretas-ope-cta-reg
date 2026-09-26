import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ColumnasPanelGrupo, ReportColumnsPanelComponent } from './report-columns-panel.component';

const GRUPOS: ColumnasPanelGrupo[] = [
  { id: 'A', label: 'A', suelta: false, columnas: [{ key: 'a1', label: 'A1' }, { key: 'a2', label: 'A2' }] },
  { id: 'B', label: 'B', suelta: false, columnas: [{ key: 'b1', label: 'B1' }] },
  { id: 'col-c', label: 'C', suelta: true, columnas: [{ key: 'c', label: 'C' }] },
];

describe('ReportColumnsPanelComponent', () => {
  let fixture: ComponentFixture<ReportColumnsPanelComponent>;
  let panel: ReportColumnsPanelComponent;
  let aplicado: Set<string> | null;

  beforeEach(() => {
    fixture = TestBed.createComponent(ReportColumnsPanelComponent);
    panel = fixture.componentInstance;
    aplicado = null;
    panel.applied.subscribe((v) => (aplicado = v));
    fixture.componentRef.setInput('grupos', GRUPOS);
    fixture.componentRef.setInput('selected', new Set(['a1', 'a2', 'c']));
    fixture.componentRef.setInput('defaults', new Set(['a1', 'a2', 'b1']));
    fixture.componentRef.setInput('baseKeys', new Set(['b1']));
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('parte de lo visible, con los estados de grupo y de «Seleccionar todas» en tres estados', () => {
    expect(panel.estadoGrupo(GRUPOS[0])).toBe('todas');
    expect(panel.estadoGrupo(GRUPOS[2])).toBe('todas');
    panel.alternarColumna('a2');
    expect(panel.estadoGrupo(GRUPOS[0])).toBe('algunas');
    expect(panel.algunasMarcadas()).toBeTrue();
  });

  it('un grupo marca o desmarca todas sus columnas', () => {
    panel.alternarGrupo(GRUPOS[0]);
    expect(panel.borrador().has('a1')).toBeFalse();
    panel.alternarGrupo(GRUPOS[0]);
    expect(panel.borrador().has('a1') && panel.borrador().has('a2')).toBeTrue();
  });

  it('desmarcar todas deja las columnas base; «Restablecer» vuelve a las de fábrica', () => {
    expect(panel.todasMarcadas()).toBeTrue();
    panel.alternarTodas();
    expect([...panel.borrador()]).toEqual(['b1']);
    panel.alternarTodas();
    expect(panel.todasMarcadas()).toBeTrue();
    panel.alternarTodas();
    panel.restablecer();
    expect([...panel.borrador()].sort()).toEqual(['a1', 'a2', 'b1']);
  });

  it('las columnas base siempre están marcadas y no se pueden desmarcar', () => {
    expect(panel.bloqueado(GRUPOS[1])).toBeTrue();
    expect(panel.bloqueado(GRUPOS[0])).toBeFalse();
    panel.alternarGrupo(GRUPOS[1]);
    panel.alternarColumna('b1');
    expect(panel.borrador().has('b1')).toBeTrue();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-grupo="B"]').disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('[data-columna="b1"]').disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('[data-grupo="A"]').disabled).toBeFalse();
  });

  it('«Aplicar» con todo vacío emite las columnas base', () => {
    panel.borrador.set(new Set());
    panel.aplicar();
    expect([...aplicado!]).toEqual(['b1']);
  });
});
