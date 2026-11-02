import { TestBed } from '@angular/core/testing';

import { REGISTROS_NO_CONCILIADOS, RegistroNoConciliado, conciliarRegistro } from '../../models/conciliacion-diaria.model';
import { ConciliacionRegistroEdicionComponent } from './conciliacion-registro-edicion.component';

describe('ConciliacionRegistroEdicionComponent', () => {
  const crear = (indice: number, registro: RegistroNoConciliado = REGISTROS_NO_CONCILIADOS[indice]) => {
    const fixture = TestBed.createComponent(ConciliacionRegistroEdicionComponent);
    fixture.componentRef.setInput('registro', registro);
    fixture.detectChanges();
    return { fixture, c: fixture.componentInstance };
  };
  const agregar = (c: ConciliacionRegistroEdicionComponent, lado: 'lb' | 'rb', ...ids: string[]) => {
    c.abrirBusqueda(lado);
    c.seleccion.set(ids);
    c.aceptarOperaciones();
  };
  const sustentar = (c: ConciliacionRegistroEdicionComponent) => {
    c.sustentos.set([{ tipo: 'Constancia', nombre: 'constancia.pdf' }]);
    c.justificacion.set('La operación coincide.');
  };

  describe('caso 2: la contraparte existe pero un dato impide formar el par', () => {
    it('arranca con el registro de origen y sin operaciones', () => {
      const { c } = crear(0);
      expect(c.lineasLB().map((l) => l.id)).toEqual(['origen']);
      expect(c.lineasRB()).toEqual([]);
      expect(c.banner()).toBeNull();
      expect(c.puedeAceptar()).toBeFalse();
    });

    it('con el número mal informado no cuadra hasta corregirlo, y la corrección queda en la bitácora', () => {
      const { c } = crear(0);
      agregar(c, 'rb', 'op-02698145');
      sustentar(c);
      expect(c.puedeAceptar()).withContext('números distintos').toBeFalse();

      c.cambiar('rb', 'op-02698145', 'numero', '02698154');
      expect(c.antes(c.lineasRB()[0], 'numero')).toBe('Antes: 02698145');
      expect(c.puedeAceptar()).toBeTrue();

      const emitidos: RegistroNoConciliado[] = [];
      c.accepted.subscribe((r) => emitidos.push(r));
      c.aceptar();
      expect(emitidos[0]).toEqual(jasmine.objectContaining({ conciliado: true, rbNumero: '02698154', rbCredito: '1,267.00', justificacion: 'La operación coincide.' }));
      expect(emitidos[0].ediciones).toEqual([{ lado: 'Operaciones bancarias', numero: '02698145', campo: 'Número', antes: '02698145', despues: '02698154' }]);
    });

    it('si falta el RR, la fecha de un día antes se corrige hasta que todos tengan el mismo día', () => {
      const { c } = crear(3);
      agregar(c, 'lb', 'rr-02698147');
      sustentar(c);
      expect(c.puedeAceptar()).withContext('fechas de días distintos').toBeFalse();
      c.cambiar('lb', 'rr-02698147', 'fecha', c.lineasRB()[0].fecha);
      expect(c.puedeAceptar()).toBeTrue();
    });

    it('una fecha que no existe no se acepta', () => {
      const { c } = crear(3);
      agregar(c, 'lb', 'rr-02698147');
      c.cambiar('lb', 'rr-02698147', 'fecha', '31/02/2026');
      sustentar(c);
      expect(c.puedeAceptar()).toBeFalse();
      expect(c.errorCampo('lb', c.lineasLB()[0], 'fecha')).toContain('Fecha no válida');
    });
  });

  describe('caso 1: monto distinto con la misma llave', () => {
    it('trae la operación y avisa la diferencia; al corregir el monto marca «Editado · Antes»', () => {
      const { c } = crear(1);
      expect(c.lineasRB().length).toBe(1);
      expect(c.cuadra()).toBeFalse();
      sustentar(c);
      expect(c.puedeAceptar()).toBeFalse();

      c.cambiar('rb', 'rb0', 'credito', '5068.80');
      expect(c.antes(c.lineasRB()[0], 'credito')).toBe('Antes: 5,068.00');
      expect(c.puedeAceptar()).toBeTrue();

      const emitidos: RegistroNoConciliado[] = [];
      c.accepted.subscribe((r) => emitidos.push(r));
      c.aceptar();
      expect(emitidos[0].ediciones).toEqual([{ lado: 'Operaciones bancarias', numero: '02698150', campo: 'Crédito', antes: '5,068.00', despues: '5,068.80' }]);
      expect(emitidos[0].rbCredito).toBe('5,068.80');
    });

    it('si se corrige el monto del otro lado también cuadra', () => {
      const { c } = crear(1);
      c.cambiar('lb', 'origen', 'credito', '5068');
      expect(c.cuadra()).toBeTrue();
    });
  });

  describe('caso 3: grupo con varios registros en cada lado', () => {
    const armarGrupo = () => {
      const { c, fixture } = crear(2);
      agregar(c, 'lb', 'rr-02698149');
      agregar(c, 'rb', 'op-02698148-a', 'op-02698148-b', 'op-02698157');
      // Como indica el banner: el mismo número en todos los registros que se concilian juntos.
      c.cambiar('lb', 'rr-02698149', 'numero', '02698148');
      c.cambiar('rb', 'op-02698157', 'numero', '02698148');
      return { c, fixture };
    };

    it('cuadra cuando la suma de los RR iguala la de las operaciones y todos llevan el mismo número', () => {
      const { c } = armarGrupo();
      expect(c.esGrupo()).toBeTrue();
      expect(c.cuadra()).toBeTrue();
      expect(c.lineasRB().map((l) => l.secuencia)).toEqual(['1', '2', '3']);
      sustentar(c);
      expect(c.puedeAceptar()).toBeTrue();
    });

    it('exige secuencias seguidas y sin repetir en el lado con varios registros', () => {
      const { c } = armarGrupo();
      sustentar(c);
      c.cambiar('rb', 'op-02698148-b', 'secuencia', '1');
      expect(c.puedeAceptar()).toBeFalse();
      c.cambiar('rb', 'op-02698148-b', 'secuencia', '2');
      expect(c.puedeAceptar()).toBeTrue();
    });

    it('con una suma distinta no cuadra, y con números distintos tampoco', () => {
      const { c } = armarGrupo();
      sustentar(c);
      c.cambiar('lb', 'rr-02698149', 'numero', '02698149');
      expect(c.puedeAceptar()).withContext('número distinto').toBeFalse();
      c.cambiar('lb', 'rr-02698149', 'numero', '02698148');
      c.quitar('lb', 'rr-02698149');
      expect(c.cuadra()).toBeFalse();
      expect(c.puedeAceptar()).toBeFalse();
    });

    it('el banner explica qué hacer con varios registros', () => {
      const { c } = armarGrupo();
      expect(c.banner()?.titulo).toBe('Varios RR y operaciones en un mismo registro');
      expect(c.banner()?.descripcion).toContain('mismo número');
    });

    it('emite una línea por registro y suma los montos de cada lado', () => {
      const { c } = armarGrupo();
      sustentar(c);
      const emitidos: RegistroNoConciliado[] = [];
      c.accepted.subscribe((r) => emitidos.push(r));
      c.aceptar();
      expect(emitidos[0].lbLineas?.length).toBe(2);
      expect(emitidos[0].rbLineas?.length).toBe(3);
      expect(emitidos[0]).toEqual(jasmine.objectContaining({ lbCredito: '34,490.00', rbCredito: '34,490.00' }));
    });
  });

  it('con «Montos diferentes» el banner se adapta y solo aparece con varios registros', () => {
    const { c, fixture } = crear(1);
    expect(c.banner()).withContext('un RR y una operación').toBeNull();
    agregar(c, 'rb', 'op-02698145');
    fixture.detectChanges();
    expect(c.banner()?.titulo).toBe('Montos diferentes con varios registros');
    expect(fixture.nativeElement.textContent).toContain('Montos diferentes con varios registros');
    expect(fixture.nativeElement.textContent).not.toContain('Resumen de la conciliación');
  });

  it('el registro de origen no se puede quitar y su botón no se muestra', () => {
    const { c, fixture } = crear(0);
    c.quitar('lb', 'origen');
    expect(c.lineasLB().length).toBe(1);
    expect(fixture.nativeElement.querySelector('[aria-label^="Quitar el registro"]')).toBeNull();
    agregar(c, 'rb', 'op-02698145');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[aria-label^="Quitar el registro"]').length).toBe(1);
  });

  it('todos los campos son editables y no se acepta uno vacío', () => {
    const { c } = crear(1);
    c.cambiar('rb', 'rb0', 'descripcion', '');
    c.cambiar('rb', 'rb0', 'credito', '5068.80');
    sustentar(c);
    expect(c.errorCampo('rb', c.lineasRB()[0], 'descripcion')).toContain('obligatorio');
    expect(c.puedeAceptar()).toBeFalse();
    c.cambiar('rb', 'rb0', 'descripcion', 'Reporte de Recaudación SUNAT');
    expect(c.puedeAceptar()).toBeTrue();
    c.cambiar('lb', 'origen', 'entidad', '');
    expect(c.puedeAceptar()).withContext('la entidad del libro banco es obligatoria').toBeFalse();
  });

  it('al reabrir un registro ya editado vuelve con sus líneas y lo que traían', () => {
    const { c } = crear(1);
    c.cambiar('rb', 'rb0', 'credito', '5068.80');
    sustentar(c);
    let guardado!: RegistroNoConciliado;
    c.accepted.subscribe((r) => (guardado = r));
    c.aceptar();

    const reabierto = crear(1, guardado).c;
    expect(reabierto.lineasRB()[0].credito).toBe('5,068.80');
    expect(reabierto.antes(reabierto.lineasRB()[0], 'credito')).toBe('Antes: 5,068.00');
  });

  it('suma varios sustentos con su tipo en una carga, reemplaza uno y exige al menos uno', () => {
    const { c } = crear(0);
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

  describe('panel de búsqueda', () => {
    it('cada lupa ofrece lo suyo (RR u operaciones), sin lo que ya está en alguna tabla', () => {
      const { c } = crear(0);
      c.abrirBusqueda('rb');
      expect(c.operacionesFiltradas().map((o) => o.id)).toEqual(['op-02698145', 'op-02698148-a', 'op-02698148-b', 'op-02698157']);
      c.abrirBusqueda('lb');
      expect(c.operacionesFiltradas().map((o) => o.id)).toEqual(['rr-02698147', 'rr-02698149']);

      agregar(c, 'rb', 'op-02698145');
      c.abrirBusqueda('rb');
      expect(c.operacionesFiltradas().map((o) => o.id)).not.toContain('op-02698145');
    });

    it('trae la fecha, el número, la descripción y los montos del registro elegido', () => {
      const { c } = crear(0);
      agregar(c, 'rb', 'op-02698148-a');
      expect(c.lineasRB().map((l) => [l.numero, l.debito, l.credito, l.secuencia])).toEqual([['02698148', '0.00', '20,000.00', '1']]);
    });

    it('filtra por la búsqueda y no suma nada si se cancela', () => {
      const { c } = crear(0);
      c.abrirBusqueda('rb');
      c.busqueda.set('02698157');
      expect(c.operacionesFiltradas().map((o) => o.numero)).toEqual(['02698157']);
      c.busquedaAbierta.set(false);
      expect(c.lineasRB()).toEqual([]);
    });

    it('un lado sin registros muestra la vista vacía', () => {
      const { fixture } = crear(0);
      expect(fixture.nativeElement.textContent).toContain('haga clic en el botón de búsqueda para seleccionar una opción');
    });
  });

  it('el motivo de inconsistencia se conserva hasta que el documento se aprueba', () => {
    expect(conciliarRegistro(REGISTROS_NO_CONCILIADOS[0], '1,000.00').motivo).toBe('No existe OBO');
    expect(conciliarRegistro(REGISTROS_NO_CONCILIADOS[0], '1,000.00', true).motivo).toBe('-');
  });

  describe('modificación de un registro conciliado', () => {
    const conciliado = (): RegistroNoConciliado => ({ ...conciliarRegistro(REGISTROS_NO_CONCILIADOS[0], '1,267.00'), sustentos: [], justificacion: '', ediciones: [], modificado: false });
    const abrir = (tipo: 'Datos' | 'Montos') => {
      const fixture = TestBed.createComponent(ConciliacionRegistroEdicionComponent);
      fixture.componentRef.setInput('registro', conciliado());
      fixture.componentRef.setInput('tipoModificacion', tipo);
      fixture.detectChanges();
      return { fixture, c: fixture.componentInstance };
    };

    it('«Montos» solo deja corregir el débito y el crédito', () => {
      const { c } = abrir('Montos');
      expect(c.esModificacion()).toBeTrue();
      expect((['fecha', 'numero', 'descripcion', 'entidad', 'secuencia', 'debito', 'credito'] as const).filter((x) => c.editable(x))).toEqual(['debito', 'credito']);
    });

    it('«Datos» deja corregir fecha, número, descripción, entidad y secuencia, pero no los montos', () => {
      const { c } = abrir('Datos');
      expect((['fecha', 'numero', 'descripcion', 'entidad', 'secuencia', 'debito', 'credito'] as const).filter((x) => c.editable(x))).toEqual(['fecha', 'numero', 'descripcion', 'entidad', 'secuencia']);
    });

    it('sin cambios no se acepta; con la corrección, el sustento y la justificación emite el registro modificado con su «Antes»', () => {
      const { c } = abrir('Montos');
      sustentar(c);
      expect(c.puedeAceptar()).withContext('aunque cuadre, no cambió nada').toBeFalse();

      c.cambiar('lb', 'origen', 'credito', '1300');
      expect(c.puedeAceptar()).withContext('los dos lados deben seguir cuadrando').toBeFalse();
      c.cambiar('rb', 'rb0', 'credito', '1300');
      expect(c.antes(c.lineasLB()[0], 'credito')).toBe('Antes: 1,267.00');
      expect(c.puedeAceptar()).toBeTrue();

      let emitido!: RegistroNoConciliado;
      c.accepted.subscribe((r) => (emitido = r));
      c.aceptar();
      expect(emitido).toEqual(jasmine.objectContaining({ modificado: true, conciliado: true, lbCredito: '1,300.00', rbCredito: '1,300.00' }));
      expect(emitido.ediciones?.map((e) => [e.lado, e.campo, e.antes, e.despues])).toEqual([
        ['Libro banco', 'Crédito', '1,267.00', '1,300.00'],
        ['Operaciones bancarias', 'Crédito', '1,267.00', '1,300.00'],
      ]);
    });

    it('lo que se compara es lo vigente del registro, no lo de su creación', () => {
      const previo = { ...conciliado(), ediciones: [{ lado: 'Libro banco' as const, numero: 'x', campo: 'Crédito', antes: '1.00', despues: '1,267.00' }] };
      const fixture = TestBed.createComponent(ConciliacionRegistroEdicionComponent);
      fixture.componentRef.setInput('registro', previo);
      fixture.componentRef.setInput('tipoModificacion', 'Montos');
      fixture.detectChanges();
      expect(fixture.componentInstance.hayEdiciones()).toBeFalse();
    });

    it('no se agregan ni se quitan registros: sin lupas ni botón de quitar', () => {
      const { fixture } = abrir('Datos');
      expect(fixture.nativeElement.querySelector('[aria-label^="Buscar"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[aria-label^="Quitar el registro"]')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('Editar registro conciliado');
      expect(fixture.nativeElement.textContent).toContain('Tipo de modificación');
    });
  });

  it('las secciones van siempre en el mismo orden, libro banco primero, también cuando falta el RR', () => {
    const titulos = (indice: number): string[] => {
      const { fixture } = crear(indice);
      return Array.from(fixture.nativeElement.querySelectorAll('h3')).map((h) => (h as HTMLElement).textContent!.trim()).filter((t) => /libro banco|operaciones bancarias/i.test(t));
    };
    const esperado = ['Libro banco', 'Registro de operaciones bancarias'];
    // «No existe OBO» (nace en el libro banco), «Montos diferentes» y «No existe RR» (nace en las operaciones bancarias).
    expect(titulos(0)).toEqual(esperado);
    expect(titulos(1)).toEqual(esperado);
    expect(titulos(3)).toEqual(esperado);
  });
});

