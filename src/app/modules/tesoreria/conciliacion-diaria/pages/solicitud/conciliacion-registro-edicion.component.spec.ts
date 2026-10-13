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
    c.cambiarFecha('c2', '2025-12-01');
    c.cambiarCandidato('c2', 'numero', '02698150');
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
    expect(emitidos[0]).toEqual(jasmine.objectContaining({ conciliado: true, motivo: '-', rbCredito: '1,267.00', sustentos: [{ tipo: 'Constancia', nombre: 'constancia.pdf', tamano: undefined }], justificacion: 'La operación coincide.' }));
  });

  it('no advierte lo que falta (lo hace «Verificar»): la sección arranca vacía y solo avisa en verde cuando los montos coinciden', () => {
    const c = crear(0);
    expect(c.candidatos()).withContext('no existe OBO: sin operaciones').toEqual([]);
    expect(c.aviso()).toBeNull();

    c.agregarOperacion();
    c.agregarOperacion();
    // 1,000.00 + 267.00 suman el crédito del libro banco (1,267.00).
    c.cambiarCandidato('c1', 'debito', '0');
    c.cambiarCandidato('c1', 'credito', '1000');
    c.cambiarCandidato('c2', 'debito', '0');
    c.cambiarCandidato('c2', 'credito', '100');
    expect(c.aviso()).toBeNull();
    c.cambiarCandidato('c2', 'credito', '267');
    expect(c.aviso()).toEqual({ titulo: 'Registro de operación bancarias', descripcion: 'La operación(es) bancaria(s) suman S/ 1,267.00 y coinciden con el Libro Banco.' });
  });

  it('en «Montos diferentes» la operación existente viene precargada, sin alerta', () => {
    const c = crear(1);
    expect(c.candidatos().length).toBe(1);
    expect(c.aviso()).toBeNull();
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

  it('cada (+) agrega una sola operación: la primera repite el libro banco y las siguientes editan fecha y número', () => {
    const c = crear(0);
    c.agregarOperacion();
    expect(c.candidatos().length).toBe(1);
    expect(c.candidatos()[0]).toEqual(jasmine.objectContaining({ numero: REGISTROS_NO_CONCILIADOS[0].lbNumero, fecha: REGISTROS_NO_CONCILIADOS[0].lbFecha, editable: false }));

    c.agregarOperacion();
    const segunda = c.candidatos()[1];
    expect(c.candidatos().length).toBe(2);
    expect(segunda).toEqual(jasmine.objectContaining({ numero: '', fecha: '', descripcion: c.candidatos()[0].descripcion, editable: true }));

    c.cambiarFecha(segunda.id, '2025-12-02T14:30:05');
    c.cambiarCandidato(segunda.id, 'numero', '02698200');
    expect(c.candidatos()[1]).toEqual(jasmine.objectContaining({ fecha: '02/12/2025 14:30:05', numero: '02698200' }));
  });
});
