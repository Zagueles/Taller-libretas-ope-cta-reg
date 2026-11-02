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

describe('ProcessMenuTreeComponent — procesos «Próximamente»', () => {
  let fixture: ComponentFixture<ProcessMenuTreeComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const boton = (texto: string): HTMLButtonElement => Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent!.includes(texto))!;

  const nodos: ProcessMenuNode[] = [
    { id: 'listo', label: 'Documentos de conciliación', moduleRoute: '/a' },
    { id: 'pendiente', label: 'Gestión de pagos', comingSoon: true },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProcessMenuTreeComponent] }).compileComponents();
    fixture = TestBed.createComponent(ProcessMenuTreeComponent);
    fixture.componentRef.setInput('nodes', nodos);
    fixture.detectChanges();
  });

  it('el proceso pendiente va deshabilitado y el disponible, no', () => {
    expect(boton('Gestión de pagos').getAttribute('aria-disabled')).toBe('true');
    expect(boton('Gestión de pagos').className).toContain('cursor-not-allowed');
    expect(boton('Documentos de conciliación').getAttribute('aria-disabled')).toBeNull();
  });

  it('al pasar el mouse por un proceso pendiente aparece «Próximamente»', () => {
    boton('Gestión de pagos').dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(document.body.textContent).toContain('Próximamente');
    boton('Gestión de pagos').dispatchEvent(new Event('mouseleave'));
  });

  it('un proceso disponible no muestra ese tooltip y uno pendiente no emite la selección', () => {
    const emitidos: string[] = [];
    fixture.componentInstance.nodeSelected.subscribe((n) => emitidos.push(n.id));
    boton('Gestión de pagos').click();
    boton('Documentos de conciliación').click();
    expect(emitidos).toEqual(['listo']);
  });
});

