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

  it('avisa con el copy de cada caso: falta la operación (amarillo) y coinciden los montos (verde)', () => {
    const c = crear(0);
    expect(c.aviso()).toEqual({ tono: 'warning', titulo: 'No existe operación bancaria', descripcion: 'Busque y registre la operación bancaria que corresponde al RR por S/ 1,267.00.' });

    // 1,000.00 + 267.00 suman el crédito del libro banco (1,267.00).
    c.cambiarCandidato('c1', 'debito', '0');
    c.cambiarCandidato('c1', 'credito', '1000');
    c.cambiarCandidato('c2', 'debito', '0');
    c.cambiarCandidato('c2', 'credito', '100');
    expect(c.aviso().tono).toBe('warning');
    c.cambiarCandidato('c2', 'credito', '267');
    expect(c.aviso()).toEqual({ tono: 'success', titulo: 'Registro de operación bancarias', descripcion: 'La operación(es) bancaria(s) suman S/ 1,267.00 y coinciden con el Libro Banco.' });
  });

  it('en «Montos diferentes» pide ajustar las operaciones hasta igualar el monto', () => {
    const c = crear(1);
    expect(c.aviso()).toEqual(jasmine.objectContaining({ tono: 'warning', titulo: 'Montos diferentes' }));
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
});
