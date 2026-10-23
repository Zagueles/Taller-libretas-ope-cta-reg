import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProcessMenuNode } from '../../shared/utils/process-tree.util';
import { ProcessMenuTreeComponent } from './process-menu-tree.component';

describe('ProcessMenuTreeComponent — búsqueda', () => {
  let fixture: ComponentFixture<ProcessMenuTreeComponent>;
  let menu: ProcessMenuTreeComponent;
  const el = (): HTMLElement => fixture.nativeElement;
  /** Escribe en el buscador como lo haría el usuario (el componente es OnPush). */
  const buscar = (texto: string): void => {
    const campo = el().querySelector<HTMLInputElement>('siaf-input input')!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const nodos: ProcessMenuNode[] = [
    {
      id: 'tesoreria',
      label: 'Gestión de tesorería',
      children: [
        { id: 'docs', label: 'Documentos y registros de recaudación', moduleRoute: '/a' },
        { id: 'cons', label: 'Consulta y reportes de recaudación', moduleRoute: '/b' },
      ],
    },
    { id: 'clasif', label: 'Clasificadores', moduleRoute: '/c' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProcessMenuTreeComponent] }).compileComponents();
    fixture = TestBed.createComponent(ProcessMenuTreeComponent);
    fixture.componentRef.setInput('nodes', nodos);
    fixture.detectChanges();
    menu = fixture.componentInstance;
  });

  it('resalta en negrita lo que coincide con la búsqueda, sin distinguir tildes ni mayúsculas', () => {
    buscar('RECAUDACION');
    const negritas = Array.from(el().querySelectorAll('[data-coincidencia]')).map((n) => n.textContent);
    expect(negritas).toEqual(['recaudación', 'recaudación']);
    expect(el().querySelector('[data-sin-resultados]')).toBeNull();
  });

  it('sin búsqueda no hay negritas de coincidencia', () => {
    expect(el().querySelectorAll('[data-coincidencia]').length).toBe(0);
  });

  it('sin coincidencias muestra «Sin resultados» con el texto buscado y ningún nodo', () => {
    buscar('zunat');
    const vacia = el().querySelector('[data-sin-resultados]')!;
    expect(vacia.textContent).toContain('Sin resultados');
    expect(vacia.textContent).toContain('No hay coincidencias para "zunat"');
    expect(el().querySelectorAll('button[aria-expanded], section button').length).toBe(0);
  });

  it('partes() parte el texto en tramos conservando las tildes originales', () => {
    buscar('gestion');
    expect(menu.partes('Gestión de tesorería')).toEqual([
      { texto: 'Gestión', resaltada: true },
      { texto: ' de tesorería', resaltada: false },
    ]);
  });
});
