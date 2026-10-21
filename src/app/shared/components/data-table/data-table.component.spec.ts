import { TestBed } from '@angular/core/testing';

import { DataTableColumn, DataTableComponent, DataTableRow } from './data-table.component';

describe('DataTableComponent — orden', () => {
  const columnas: DataTableColumn[] = [
    { key: 'numero', label: 'Número', sortable: true },
    { key: 'estado', label: 'Estado' },
  ];
  const filas: DataTableRow[] = [
    { id: '1', numero: '10', estado: 'A' },
    { id: '2', numero: '2', estado: 'B' },
  ];
  const crear = (modo: 'local' | 'externo' = 'local') => {
    const fixture = TestBed.createComponent(DataTableComponent);
    fixture.componentRef.setInput('columns', columnas);
    fixture.componentRef.setInput('rows', filas);
    fixture.componentRef.setInput('sortMode', modo);
    fixture.detectChanges();
    return fixture;
  };
  const primeraColumna = (f: ReturnType<typeof crear>): string[] =>
    Array.from((f.nativeElement as HTMLElement).querySelectorAll('tbody tr')).map((tr) => tr.querySelector('td')!.textContent!.trim());
  const titulo = (f: ReturnType<typeof crear>): HTMLButtonElement => (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('thead th button')!;

  it('solo las columnas sortable llevan botón y aria-sort', () => {
    const f = crear();
    const ths = (f.nativeElement as HTMLElement).querySelectorAll('thead th');
    expect(ths[0].getAttribute('aria-sort')).toBe('none');
    expect(ths[0].querySelector('button')).not.toBeNull();
    expect(ths[1].getAttribute('aria-sort')).toBeNull();
    expect(ths[1].querySelector('button')).toBeNull();
  });

  it('local: ordena las filas ascendente, descendente y vuelve al orden original', () => {
    const f = crear();
    expect(primeraColumna(f)).toEqual(['10', '2']);
    titulo(f).click();
    f.detectChanges();
    expect(primeraColumna(f)).toEqual(['2', '10']);
    expect((f.nativeElement as HTMLElement).querySelector('thead th')!.getAttribute('aria-sort')).toBe('ascending');
    titulo(f).click();
    f.detectChanges();
    expect(primeraColumna(f)).toEqual(['10', '2']);
    expect((f.nativeElement as HTMLElement).querySelector('thead th')!.getAttribute('aria-sort')).toBe('descending');
    titulo(f).click();
    f.detectChanges();
    expect(primeraColumna(f)).toEqual(['10', '2']);
    expect((f.nativeElement as HTMLElement).querySelector('thead th')!.getAttribute('aria-sort')).toBe('none');
  });

  it('externo: solo emite el orden y deja las filas como llegan', () => {
    const f = crear('externo');
    const emitidos: unknown[] = [];
    f.componentInstance.sortChange.subscribe((o) => emitidos.push(o));
    titulo(f).click();
    f.detectChanges();
    expect(emitidos).toEqual([{ key: 'numero', direction: 'asc' }]);
    expect(primeraColumna(f)).toEqual(['10', '2']);
  });
});
