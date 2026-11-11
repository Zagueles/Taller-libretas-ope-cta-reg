import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DEFAULT_PROCESS_TREE, ProcessMenuNode, findProcessPathById } from '../../shared/utils/process-tree.util';
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

describe('ProcessMenuTreeComponent — proceso pendiente con hojas', () => {
  let fixture: ComponentFixture<ProcessMenuTreeComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const textos = (): string[] => Array.from(el().querySelectorAll('button')).map((b) => b.textContent!.replace(/\s+/g, ' ').trim());

  const nodos: ProcessMenuNode[] = [
    {
      id: 'conciliacion',
      label: 'Conciliación diaria',
      comingSoon: true,
      children: [{ id: 'docs', label: 'Documentos de conciliación diaria', moduleRoute: '/procesos/conciliacion-diaria' }],
    },
    { id: 'libretas', label: 'Registro de libretas', moduleRoute: '/procesos/libretas' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProcessMenuTreeComponent] }).compileComponents();
    fixture = TestBed.createComponent(ProcessMenuTreeComponent);
    fixture.componentRef.setInput('nodes', nodos);
    fixture.detectChanges();
  });

  it('va deshabilitado, sin flecha de rama, y ni abre ni muestra sus hojas', () => {
    const boton = Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent!.includes('Conciliación diaria'))!;
    expect(boton.getAttribute('aria-disabled')).toBe('true');
    expect(boton.getAttribute('aria-expanded')).toBeNull();
    boton.click();
    fixture.detectChanges();
    expect(textos().some((t) => t.includes('Documentos de conciliación diaria'))).toBeFalse();
  });

  it('no emite la selección y sus hojas no aparecen ni al buscarlas', () => {
    const emitidos: string[] = [];
    fixture.componentInstance.nodeSelected.subscribe((n) => emitidos.push(n.id));
    Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent!.includes('Conciliación diaria'))!.click();
    expect(emitidos).toEqual([]);

    fixture.componentInstance.onQuery('documentos');
    fixture.detectChanges();
    expect(textos().some((t) => t.includes('Documentos de conciliación diaria'))).toBeFalse();
    expect(el().querySelector('[data-sin-resultados]')).not.toBeNull();
  });

  it('en el árbol del taller, la Conciliación diaria está pendiente pero sus hojas siguen resolviendo las migas de pan', () => {
    const ruta = findProcessPathById('conciliacion-diaria-documentos', DEFAULT_PROCESS_TREE);
    expect(ruta.map((n) => n.id)).toEqual(['gestion-tesoreria', 'gestion-liquidez', 'conciliacion-bancaria', 'conciliacion-diaria', 'conciliacion-diaria-documentos']);
    expect(findProcessPathById('conciliacion-diaria', DEFAULT_PROCESS_TREE).at(-1)?.comingSoon).toBeTrue();
    expect(findProcessPathById('registro-libretas-cuentas-registro', DEFAULT_PROCESS_TREE).at(-1)?.comingSoon).toBeFalsy();
  });
});

describe('ProcessMenuTreeComponent — buscador', () => {
  it('la lupa va como ícono al inicio del campo, sin botón a la derecha', async () => {
    await TestBed.configureTestingModule({ imports: [ProcessMenuTreeComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ProcessMenuTreeComponent);
    fixture.detectChanges();
    const campo = fixture.nativeElement.querySelector('siaf-input label') as HTMLElement;
    const lupa = campo.querySelector('siaf-icon')!;
    expect(lupa.textContent!.trim()).toBe('search');
    expect(lupa.compareDocumentPosition(campo.querySelector('input')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(campo.querySelector('button')).toBeNull();
  });
});

