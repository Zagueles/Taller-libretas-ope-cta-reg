import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportTableColumn, ReportTableComponent, ReportTableRow } from './report-table.component';

describe('ReportTableComponent', () => {
  let fixture: ComponentFixture<ReportTableComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  const columnas: ReportTableColumn[] = [
    { key: 'secuencia', label: 'Secuencia', group: 'Acreditación', width: 104 },
    { key: 'fecha', label: 'Fecha', group: 'Acreditación', width: 120 },
    { key: 'operacion', label: 'Tipo de operación', width: 220 },
    { key: 'documento', label: 'Documento', kind: 'link' },
    { key: 'saldo', label: 'Saldo final', group: 'Importe', align: 'right', fixed: true, width: 150 },
  ];
  const filas: ReportTableRow[] = [
    { secuencia: '000001', fecha: '28/06/2026', operacion: '1 - Saldos Iniciales', documento: '000001-2026', saldo: '10,000.00' },
    { secuencia: '000002', fecha: '28/06/2026', operacion: '2 - Reporte SUNAT', documento: '', saldo: '19,000.00' },
  ];

  const montar = (cols: ReportTableColumn[], rows: ReportTableRow[]): void => {
    fixture = TestBed.createComponent(ReportTableComponent);
    fixture.componentRef.setInput('columns', cols);
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('rowKey', 'secuencia');
    fixture.componentRef.setInput('ariaLabel', 'Movimientos');
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReportTableComponent] }).compileComponents();
  });

  it('con grupos, la cabecera tiene dos filas: los grupos contiguos en una celda y las columnas sueltas ocupan las dos', () => {
    montar(columnas, filas);
    const superior = Array.from(el().querySelectorAll<HTMLTableCellElement>('[data-cabecera-superior]'));
    expect(superior.map((c) => [c.textContent!.trim(), c.colSpan, c.rowSpan, c.getAttribute('scope')])).toEqual([
      ['Acreditación', 2, 1, 'colgroup'],
      ['Tipo de operación', 1, 2, 'col'],
      ['Documento', 1, 2, 'col'],
      ['Importe', 1, 1, 'colgroup'],
    ]);
    expect(superior[0].style.width).withContext('suma de los anchos del grupo').toBe('224px');
    expect(Array.from(el().querySelectorAll('[data-cabecera-columna]')).map((c) => c.textContent!.trim())).toEqual(['Secuencia', 'Fecha', 'Saldo final']);
  });

  it('la columna fija lleva su propia celda de grupo, para que el resto del grupo no quede fijo al desplazar', () => {
    montar(
      [
        { key: 'inicial', label: 'Saldo inicial', group: 'Imp. m. cuenta' },
        { key: 'credito', label: 'Crédito', group: 'Imp. m. cuenta' },
        { key: 'saldo', label: 'Saldo final', group: 'Imp. m. cuenta', fixed: true },
      ],
      filas,
    );
    const superior = Array.from(el().querySelectorAll<HTMLTableCellElement>('[data-cabecera-superior]'));
    expect(superior.map((c) => [c.textContent!.trim(), c.colSpan, c.classList.contains('sticky')])).toEqual([
      ['Imp. m. cuenta', 2, false],
      ['Imp. m. cuenta', 1, true],
    ]);
  });

  it('sin grupos, una sola fila de cabecera', () => {
    montar([{ key: 'secuencia', label: 'Secuencia' }, { key: 'saldo', label: 'Saldo', align: 'right' }], filas);
    expect(el().querySelectorAll('thead tr').length).toBe(1);
    expect(el().querySelectorAll('[data-cabecera-superior]').length).toBe(2);
  });

  it('los importes van a la derecha y la última columna queda fija con su sombra de scroll', () => {
    montar(columnas, filas);
    const celdaFija = el().querySelectorAll<HTMLTableRowElement>('tbody tr')[0].cells[4];
    expect(celdaFija.textContent!.trim()).toBe('10,000.00');
    expect(celdaFija.classList).toContain('text-right');
    expect(celdaFija.classList).toContain('sticky');
    expect(celdaFija.classList).toContain('right-0');
    const cabeceraFija = el().querySelector<HTMLElement>('[data-cabecera-columna].sticky')!;
    expect(cabeceraFija.textContent!.trim()).toBe('Saldo final');
    expect(cabeceraFija.classList).toContain('z-[3]');
  });

  it('con ancho fijo: un col por columna y la tabla mide la suma de sus anchos', () => {
    montar([{ key: 'a', label: 'A', width: 100 }, { key: 'b', label: 'B', width: 150 }, { key: 'c', label: 'C' }], [{ a: '1', b: '2', c: '3' }]);
    const tabla = el().querySelector<HTMLTableElement>('table')!;
    expect(tabla.querySelectorAll('col').length).toBe(3);
    expect(tabla.style.width).toBe('430px');
  });

  it('el texto largo de una celda se corta a 3 líneas', () => {
    montar([{ key: 'a', label: 'A', width: 100 }], [{ a: 'texto largo' }]);
    expect(el().querySelector('tbody td span')!.classList).toContain('line-clamp-3');
  });

  it('una columna link pinta un botón que emite la fila y la columna; sin valor no hay botón', () => {
    montar(columnas, filas);
    const emitidos: string[] = [];
    fixture.componentInstance.linkClicked.subscribe(({ row, column }) => emitidos.push(`${column.key}:${row['secuencia']}`));
    const botones = Array.from(el().querySelectorAll<HTMLButtonElement>('tbody button'));
    expect(botones.map((b) => b.textContent!.trim())).toEqual(['000001-2026']);
    botones[0].click();
    expect(emitidos).toEqual(['documento:000001']);
  });

  it('la zona desplazable es una región con nombre que recibe el foco, y sin filas avisa con role="status"', () => {
    montar(columnas, []);
    const region = el().querySelector<HTMLElement>('[role="region"]')!;
    expect(region.getAttribute('aria-label')).toBe('Movimientos');
    expect(region.tabIndex).toBe(0);
    const aviso = el().querySelector<HTMLTableCellElement>('td[role="status"]')!;
    expect(aviso.colSpan).toBe(5);
    expect(aviso.textContent).toContain('Aún no se encontraron resultados');
  });

  it('con sortable, los títulos son botones que emiten el siguiente orden y marcan aria-sort', () => {
    montar(columnas, filas);
    fixture.componentRef.setInput('sortable', true);
    fixture.detectChanges();
    const emitidos: unknown[] = [];
    fixture.componentInstance.sortChange.subscribe((o) => emitidos.push(o));

    const boton = (nombre: string): HTMLButtonElement =>
      Array.from(el().querySelectorAll<HTMLButtonElement>('thead button')).find((b) => b.getAttribute('aria-label') === `Ordenar por ${nombre}`)!;
    boton('Tipo de operación').click();
    expect(emitidos).toEqual([{ key: 'operacion', direction: 'asc' }]);

    fixture.componentRef.setInput('sort', { key: 'operacion', direction: 'asc' });
    fixture.detectChanges();
    expect(Array.from(el().querySelectorAll('thead th')).find((th) => th.textContent!.includes('Tipo de operación'))!.getAttribute('aria-sort')).toBe('ascending');
    boton('Tipo de operación').click();
    expect(emitidos[1]).toEqual({ key: 'operacion', direction: 'desc' });
  });

  it('sin sortable los títulos son texto y no hay aria-sort', () => {
    montar(columnas, filas);
    expect(el().querySelectorAll('thead button').length).toBe(0);
    expect(el().querySelector('thead th[aria-sort]')).toBeNull();
  });

  it('el ancho de cada columna alcanza para su título completo (la flecha de orden va en el relleno de la celda y no suma)', () => {
    montar([{ key: 'a', label: 'Saldo inicial', width: 90 }, { key: 'b', label: 'Código', width: 60 }], [{ a: '1', b: '2' }]);
    // 9 px por letra + 32 de relleno: «Saldo inicial» (13 caracteres) 149 px y «Código» (6) 86 px.
    const anchos = (): string[] => Array.from(el().querySelectorAll<HTMLElement>('col')).map((c) => c.style.width);
    expect(anchos()).toEqual(['149px', '86px']);
    fixture.componentRef.setInput('sortable', true);
    fixture.detectChanges();
    expect(anchos()).toEqual(['149px', '86px']);
  });
});
