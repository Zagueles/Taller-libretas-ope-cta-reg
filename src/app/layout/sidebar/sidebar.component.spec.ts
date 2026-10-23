import { TestBed } from '@angular/core/testing';

import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent — ítem seleccionado', () => {
  it('el ícono del ítem activo va relleno y el de los demás, delineado', async () => {
    await TestBed.configureTestingModule({ imports: [SidebarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.componentRef.setInput('navigation', 'Proceso');
    fixture.detectChanges();

    const iconoDe = (texto: string): Element =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav button')).find((b) => b.textContent!.includes(texto))!.querySelector('siaf-icon span')!;
    expect(iconoDe('Procesos').classList).toContain('material-icons');
    expect(iconoDe('Procesos').classList).not.toContain('material-icons-outlined');
    expect(iconoDe('Panel').classList).toContain('material-icons-outlined');
    expect(iconoDe('Bandeja').classList).toContain('material-icons-outlined');
  });
});
