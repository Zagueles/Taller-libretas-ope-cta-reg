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
