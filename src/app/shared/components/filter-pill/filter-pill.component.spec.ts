import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { FilterPillComponent } from './filter-pill.component';

describe('FilterPillComponent', () => {
  let fixture: ComponentFixture<FilterPillComponent>;
  let component: FilterPillComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FilterPillComponent] }).compileComponents();
    fixture = TestBed.createComponent(FilterPillComponent);
    component = fixture.componentInstance;
  });

  function render(opts: Partial<{
    label: string;
    selectedValue: string;
    options: ReadonlyArray<string | { label: string; value: string }>;
  }> = {}): void {
    if (opts.label !== undefined) fixture.componentRef.setInput('label', opts.label);
    if (opts.selectedValue !== undefined) fixture.componentRef.setInput('selectedValue', opts.selectedValue);
    if (opts.options !== undefined) fixture.componentRef.setInput('options', opts.options);
    fixture.detectChanges();
  }

  it('estado idle: pintar "Label" sin ":" y SIN icon "check"', () => {
    render({ label: 'Estado', options: ['Aprobado', 'Observado'] });

    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(button.textContent).toContain('Estado');
    expect(button.textContent).not.toContain('Estado:');
    // En idle no hay icono "check" (ese aparece solo cuando hay valor seleccionado).
    const icons = fixture.debugElement.queryAll(By.css('siaf-icon'));
    const iconNames = icons.map(el => el.componentInstance?.name);
    expect(iconNames).not.toContain('check');
  });

  it('estado selected: pintar "Label: valor" + X', () => {
    render({ label: 'Estado', selectedValue: 'Aprobado', options: ['Aprobado', 'Observado'] });

    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(button.textContent).toContain('Estado: Aprobado');
  });

  it('con un valor elegido, al abrir el menú su opción aparece en estado seleccionado y las demás no', () => {
    render({ label: 'Entidad', selectedValue: 'MEF', options: ['MEF', 'IPD', 'MINCETUR'] });
    component.toggleMenu();
    fixture.detectChanges();

    const opciones = fixture.debugElement.queryAll(By.css('[role="menuitem"]')).map((d) => d.nativeElement as HTMLElement);
    expect(opciones.map((o) => o.getAttribute('aria-current'))).toEqual(['true', null, null]);
    expect(opciones[0].className).toContain('bg-[var(--sys-color-bg-states-light-selected)]');
    expect(opciones[1].className).not.toContain('bg-[var(--sys-color-bg-states-light-selected)]');
  });

  it('un valor largo limita el ancho de la píldora (320 px) y ofrece el texto completo en el tooltip', () => {
    const largo = 'Recaudación Impuesto a los Juegos y Apuestas Deportivas a Distancia – MINCETUR';
    render({ label: 'Cuenta de registro', selectedValue: largo, options: [largo] });
    const contenedor = fixture.debugElement.query(By.css('div.relative')).nativeElement as HTMLElement;
    expect(contenedor.className).toContain('max-w-[320px]');
    expect(component.textoCompleto).toBe(`Cuenta de registro: ${largo}`);
  });

  it('un valor corto no repite su texto en el tooltip', () => {
    render({ label: 'Entidad', selectedValue: 'MEF', options: ['MEF'] });
    expect(component.textoCompleto).toBe('');
  });

  it('toggle abre y cierra el menú', () => {
    render({ label: 'Estado', options: ['Aprobado'] });

    expect(fixture.debugElement.query(By.css('[role="menu"]'))).toBeNull();
    fixture.debugElement.query(By.css('button')).triggerEventHandler('click', null);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('[role="menu"]'))).not.toBeNull();
  });

  it('seleccionar opción emite el value y cierra el menú', () => {
    render({ label: 'Estado', options: ['Aprobado', 'Observado'] });
    fixture.debugElement.query(By.css('button')).triggerEventHandler('click', null);
    fixture.detectChanges();

    let emitted: string | undefined;
    component.selectedValueChange.subscribe(v => (emitted = v));

    const items = fixture.debugElement.queryAll(By.css('[role="menuitem"]'));
    items[1].triggerEventHandler('click', null);

    expect(emitted).toBe('Observado');
    expect(component.menuOpen()).toBeFalse();
  });

  it('clear emite "" sin disparar el toggle del padre', () => {
    render({ label: 'Estado', selectedValue: 'Aprobado', options: ['Aprobado'] });

    let emitted: string | undefined;
    component.selectedValueChange.subscribe(v => (emitted = v));

    const stop = jasmine.createSpy('stopPropagation');
    const prevent = jasmine.createSpy('preventDefault');
    component.clear({ stopPropagation: stop, preventDefault: prevent } as unknown as Event);

    expect(emitted).toBe('');
    expect(stop).toHaveBeenCalled();
    expect(prevent).toHaveBeenCalled();
  });

  it('dibuja con siaf-tag filter: el botón publica el menú con y sin valor, y la × es otro botón que limpia sin abrirlo', () => {
    render({ label: 'Estado', options: ['Aprobado'] });
    const pildora = (): HTMLButtonElement => fixture.nativeElement.querySelector('siaf-tag[variant="filter"] button[data-tag-boton]');
    expect(pildora().getAttribute('aria-haspopup')).toBe('menu');
    expect(pildora().getAttribute('aria-expanded')).toBe('false');
    expect(fixture.nativeElement.querySelector('button[data-tag-quitar]')).toBeNull();

    render({ selectedValue: 'Aprobado' });
    expect(pildora().getAttribute('aria-haspopup')).toBe('menu');
    let emitted: string | undefined;
    component.selectedValueChange.subscribe(v => (emitted = v));
    const quitar = fixture.nativeElement.querySelector('button[data-tag-quitar]') as HTMLButtonElement;
    expect(quitar.getAttribute('aria-label')).toBe('Quitar filtro Estado');
    expect(quitar.closest('[data-tag-boton]')).toBeNull();
    quitar.click();
    expect(emitted).toBe('');
    expect(component.menuOpen()).toBeFalse();
  });

  it('options soporta string[] y objetos {label,value}', () => {
    render({
      label: 'Tipo',
      options: [
        'Creación',
        { label: 'Modificación de Cuenta', value: 'mod' },
      ],
    });
    fixture.debugElement.query(By.css('button')).triggerEventHandler('click', null);
    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(By.css('[role="menuitem"]'));
    expect(items[0].nativeElement.textContent.trim()).toBe('Creación');
    expect(items[1].nativeElement.textContent.trim()).toBe('Modificación de Cuenta');

    let emitted: string | undefined;
    component.selectedValueChange.subscribe(v => (emitted = v));
    items[1].triggerEventHandler('click', null);
    expect(emitted).toBe('mod');
  });

  it('selectedLabel resuelve label desde value', () => {
    render({
      label: 'Tipo',
      selectedValue: 'mod',
      options: [{ label: 'Modificación', value: 'mod' }],
    });
    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(button.textContent).toContain('Tipo: Modificación');
  });

  it('Escape cierra el menú', () => {
    render({ label: 'Estado', options: ['X'] });
    fixture.debugElement.query(By.css('button')).triggerEventHandler('click', null);
    fixture.detectChanges();
    expect(component.menuOpen()).toBeTrue();
    component.onEscape();
    expect(component.menuOpen()).toBeFalse();
  });
});
