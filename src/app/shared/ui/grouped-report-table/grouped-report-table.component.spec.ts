import { TestBed } from '@angular/core/testing';

import { GroupedReportTableComponent } from './grouped-report-table.component';

describe('GroupedReportTableComponent — cabecera con columna fija', () => {
  const columnas = [
    { key: 'entidad', label: 'Entidad', group: 'Ámbito institucional', width: 100 },
    { key: 'saldoInicial', label: 'Saldo inicial', group: 'Imp. m. cuenta', width: 120 },
    { key: 'saldoFinal', label: 'Saldo final', group: 'Imp. m. cuenta', width: 130, fixed: true },
  ];
  const crear = () => {
    const fixture = TestBed.createComponent(GroupedReportTableComponent);
    fixture.componentRef.setInput('columns', columnas);
    fixture.componentRef.setInput('rows', []);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  it('solo la columna fija queda sticky (con el título de su grupo): el grupo entero no se vuelve sticky porque taparía al anterior', () => {
    const c = crear();
    const fila = c.filaSuperior;
    expect(fila.map((x) => [x.label, x.colspan, x.fixed])).toEqual([
      ['Ámbito institucional', 1, false],
      ['Imp. m. cuenta', 1, false],
      ['Imp. m. cuenta', 1, true],
    ]);
    expect(fila[1].sinDivisor).toBeTrue();
  });
});

describe('GroupedReportTableComponent — orden del detalle de cada grupo', () => {
  const columnas = [
    { key: 'entidad', label: 'Entidad', width: 100 },
    { key: 'sec', label: 'Sec.', width: 80 },
    { key: 'monto', label: 'Monto', align: 'right' as const, width: 100 },
  ];
  const filas = [
    { entidad: 'MEF', sec: '000002', monto: '1,500.00' },
    { entidad: 'MEF', sec: '000001', monto: '20,000.00' },
    { entidad: 'IPD', sec: '000003', monto: '300.00' },
  ];
  const detalle = (fixture: ReturnType<typeof TestBed.createComponent<GroupedReportTableComponent>>): string[] =>
    fixture.componentInstance.nodos.filter((n) => n.tipo === 'detalle').map((n) => (n as { fila: Record<string, string> }).fila['sec']);

  it('ordena el detalle dentro de cada grupo (importes como número) y conserva el orden de los grupos', () => {
    const fixture = TestBed.createComponent(GroupedReportTableComponent);
    fixture.componentRef.setInput('columns', columnas);
    fixture.componentRef.setInput('rows', filas);
    fixture.componentRef.setInput('levels', [{ key: 'entidad', label: 'Entidad' }]);
    fixture.componentRef.setInput('sortable', true);
    fixture.detectChanges();
    expect(detalle(fixture)).toEqual(['000002', '000001', '000003']);

    fixture.componentRef.setInput('sort', { key: 'monto', direction: 'desc' });
    fixture.detectChanges();
    // MEF primero (orden de los grupos); dentro de MEF, 20,000.00 antes que 1,500.00.
    expect(detalle(fixture)).toEqual(['000001', '000002', '000003']);

    fixture.componentRef.setInput('sort', { key: 'sec', direction: 'asc' });
    fixture.detectChanges();
    expect(detalle(fixture)).toEqual(['000001', '000002', '000003']);
  });

  it('suma al ancho de la primera columna la sangría de sus niveles para que su valor no se parta', () => {
    const fixture = TestBed.createComponent(GroupedReportTableComponent);
    fixture.componentRef.setInput('columns', columnas);
    fixture.componentRef.setInput('rows', filas);
    fixture.componentRef.setInput('levels', [{ key: 'entidad', label: 'Entidad' }]);
    fixture.detectChanges();
    const cols = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('col')).map((c) => c.style.width);
    // «entidad» es nivel y se oculta: la primera visible es «sec» (80 px) con 40 px de sangría (un nivel + el detalle).
    expect(cols[0]).toBe('120px');
    expect(fixture.componentInstance.anchoTabla).toBe(80 + 100 + 40);
  });
});
