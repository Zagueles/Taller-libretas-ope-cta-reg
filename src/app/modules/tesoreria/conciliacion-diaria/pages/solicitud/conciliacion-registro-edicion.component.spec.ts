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
    c.agregarOperacion();
    c.agregarOperacion();
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

    c.cambiarCandidato('c2', 'credito', '');
    expect(c.puedeAceptar()).toBeFalse();
    expect(c.error('c2:credito', '')).toContain('obligatorio');
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
    c.agregarOperacion();
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
    c.agregarOperacion();
    c.agregarOperacion();
    c.cambiarCandidato('c1', 'credito', '9000');
    c.cambiarCandidato('c2', 'credito', '753');
    c.cambiarCandidato('c2', 'debito', '1.5');
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
    expect(fixture.nativeElement.textContent).toContain('haga clic en el botón (+) para seleccionar una opción');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();

    c.agregarOperacion();
    fixture.detectChanges();
    expect(c.candidatos().length).toBe(1);
    expect(fixture.nativeElement.textContent).not.toContain('haga clic en el botón (+)');
  });

  it('cada (+) agrega una sola operación que repite la fecha, el número y la descripción del registro de origen', () => {
    const c = crear(0);
    c.agregarOperacion();
    c.agregarOperacion();
    const origen = REGISTROS_NO_CONCILIADOS[0];
    expect(c.candidatos().length).toBe(2);
    c.candidatos().forEach((o) => expect(o).toEqual(jasmine.objectContaining({ numero: origen.lbNumero, fecha: origen.lbFecha, descripcion: origen.lbDescripcion })));
  });

  it('en el otro origen (registro de operaciones bancarias) las operaciones repiten sus datos', () => {
    const c = crear(3);
    c.agregarOperacion();
    c.agregarOperacion();
    const origen = REGISTROS_NO_CONCILIADOS[3];
    c.candidatos().forEach((o) => expect(o).toEqual(jasmine.objectContaining({ numero: origen.rbNumero, fecha: origen.rbFecha })));
  });
});
