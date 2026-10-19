import { TestBed } from '@angular/core/testing';

import { REGISTROS_NO_CONCILIADOS } from '../../models/conciliacion-diaria.model';
import { ConciliacionRegistroEdicionComponent } from './conciliacion-registro-edicion.component';

describe('ConciliacionRegistroEdicionComponent', () => {
  const crear = (indice: number) => {
    const fixture = TestBed.createComponent(ConciliacionRegistroEdicionComponent);
    fixture.componentRef.setInput('registro', REGISTROS_NO_CONCILIADOS[indice]);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  it('precarga los montos del libro banco y exige los de cada operación a conciliar', () => {
    const c = crear(0);
    c.abrirBusqueda();
    c.seleccion.set(['op-02698150', 'op-02698147']);
    c.aceptarOperaciones();
    expect(c.debito()).toBe('0.00');
    expect(c.credito()).toBe('1,267.00');
    expect(c.puedeAceptar()).toBeFalse();

    c.candidatos().forEach((o) => {
      c.cambiarCandidato(o.id, 'debito', '0');
      c.cambiarCandidato(o.id, 'credito', '100');
    });
    expect(c.puedeAceptar()).withContext('falta el sustento').toBeFalse();
    c.sustentos.set([{ tipo: 'Constancia', nombre: 'constancia.pdf' }]);
    expect(c.puedeAceptar()).withContext('falta la justificación').toBeFalse();
    c.justificacion.set('La operación coincide.');
    expect(c.puedeAceptar()).toBeTrue();

    c.cambiarCandidato('op-02698147', 'credito', '');
    expect(c.puedeAceptar()).toBeFalse();
    expect(c.error('op-02698147:credito', '')).toContain('obligatorio');
  });

  it('exige también el débito y el crédito del registro de origen', () => {
    const c = crear(0);
    c.candidatos().forEach((o) => {
      c.cambiarCandidato(o.id, 'debito', '0');
      c.cambiarCandidato(o.id, 'credito', '1');
    });
    c.cambiarBase('credito', '');
    expect(c.puedeAceptar()).toBeFalse();
  });

  it('al aceptar emite el registro conciliado con la contraparte', () => {
    const c = crear(0);
    c.abrirBusqueda();
    c.seleccion.set(['op-02698150']);
    c.aceptarOperaciones();
    const emitidos: unknown[] = [];
    c.accepted.subscribe((r) => emitidos.push(r));
    c.candidatos().forEach((o) => {
      c.cambiarCandidato(o.id, 'debito', '0');
      c.cambiarCandidato(o.id, 'credito', '1267');
    });
    c.aceptar();
    expect(emitidos.length).withContext('sin sustento ni justificación no acepta').toBe(0);
    c.sustentos.set([{ tipo: 'Constancia', nombre: 'constancia.pdf' }]);
    c.justificacion.set('La operación coincide.');
    c.aceptar();
    expect(emitidos.length).toBe(1);
    expect(emitidos[0]).toEqual(jasmine.objectContaining({ conciliado: true, motivo: REGISTROS_NO_CONCILIADOS[0].motivo, rbCredito: '1,267.00', sustentos: [{ tipo: 'Constancia', nombre: 'constancia.pdf', tamano: undefined }], justificacion: 'La operación coincide.' }));
  });

  it('la sección arranca vacía y no muestra alertas (lo que falte lo informa «Verificar»)', () => {
    const c = crear(0);
    expect(c.candidatos()).withContext('no existe OBO: sin operaciones').toEqual([]);
  });

  it('la tabla totaliza débito y crédito de las operaciones ingresadas', () => {
    const c = crear(0);
    c.abrirBusqueda();
    c.seleccion.set(['op-02698150', 'op-02698147']);
    c.aceptarOperaciones();
    c.cambiarCandidato('op-02698150', 'credito', '9000');
    c.cambiarCandidato('op-02698147', 'credito', '753');
    c.cambiarCandidato('op-02698147', 'debito', '1.5');
    expect(c.totalCredito()).toBe('9,753.00');
    expect(c.totalDebito()).toBe('1.50');
    expect(c.secuenciaDe(0)).toBe('0001');
    expect(c.secuenciaDe(1)).toBe('0002');
  });

  it('en «Montos diferentes» la operación existente viene precargada, sin alerta', () => {
    const c = crear(1);
    expect(c.candidatos().length).toBe(1);
  });

  it('suma varios sustentos con su tipo en una carga, reemplaza uno y exige al menos uno', () => {
    const c = crear(0);
    c.abrirSustento();
    c.tipoSustento.set('Constancia');
    c.agregarSustentos([new File(['a'], 'constancia.pdf')]);
    c.abrirSustento();
    c.tipoSustento.set('Captura de pantalla');
    c.agregarSustentos([new File(['bb'], 'captura.png'), new File(['bbb'], 'captura-2.png')]);
    expect(c.sustentos().map((d) => [d.tipo, d.nombre])).toEqual([['Constancia', 'constancia.pdf'], ['Captura de pantalla', 'captura.png'], ['Captura de pantalla', 'captura-2.png']]);

    // Reemplazar el primero conserva su posición y precarga su tipo.
    c.abrirSustento(0);
    expect(c.tipoSustento()).toBe('Constancia');
    c.agregarSustentos([new File(['ccc'], 'constancia-v2.pdf')]);
    expect(c.sustentos().map((d) => d.nombre)).toEqual(['constancia-v2.pdf', 'captura.png', 'captura-2.png']);

    c.quitarSustento(0);
    c.quitarSustento(0);
    c.quitarSustento(0);
    expect(c.sustentos()).toEqual([]);
  });

  it('sin operaciones muestra la vista vacía y el (+) las vuelve a ofrecer', () => {
    const fixture = TestBed.createComponent(ConciliacionRegistroEdicionComponent);
    fixture.componentRef.setInput('registro', REGISTROS_NO_CONCILIADOS[0]);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    c.candidatos().forEach((o) => c.quitarCandidato(o.id));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('haga clic en el botón de búsqueda para seleccionar una opción');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();

    c.abrirBusqueda();
    c.seleccion.set(['op-02698150']);
    c.aceptarOperaciones();
    fixture.detectChanges();
    expect(c.candidatos().length).toBe(1);
    expect(fixture.nativeElement.textContent).not.toContain('haga clic en el botón de búsqueda');
  });

  it('el panel de búsqueda agrega una o más operaciones con su propia fecha, número y descripción, y solo falta su débito y crédito', () => {
    const c = crear(0);
    c.abrirBusqueda();
    expect(c.operacionesFiltradas().length).toBe(2);
    c.seleccion.set(['op-02698150', 'op-02698147']);
    c.aceptarOperaciones();
    expect(c.candidatos().map((o) => [o.numero, o.fecha, o.debito, o.credito])).toEqual([
      ['02698150', '01/12/2025 10:10:08', '', ''],
      ['02698147', '01/12/2025 10:00:13', '', ''],
    ]);
    // Las que ya están en la tabla no se vuelven a ofrecer.
    c.abrirBusqueda();
    expect(c.operacionesFiltradas()).toEqual([]);
  });

  it('el panel filtra por la búsqueda y no suma nada si se cancela', () => {
    const c = crear(0);
    c.abrirBusqueda();
    c.busqueda.set('02698147');
    expect(c.operacionesFiltradas().map((o) => o.numero)).toEqual(['02698147']);
    c.busquedaAbierta.set(false);
    expect(c.candidatos()).toEqual([]);
  });
});
