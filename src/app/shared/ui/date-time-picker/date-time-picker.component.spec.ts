import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DateTimePickerComponent } from './date-time-picker.component';

describe('DateTimePickerComponent — elegir mes y año', () => {
  let fixture: ComponentFixture<DateTimePickerComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const calendario = (): HTMLElement => el().querySelector<HTMLElement>('[role="dialog"]')!;
  const cabecera = (cual: 'mes' | 'anio'): HTMLButtonElement => calendario().querySelector<HTMLButtonElement>(`[data-cabecera="${cual}"]`)!;
  const opciones = (): HTMLButtonElement[] => Array.from(calendario().querySelectorAll<HTMLButtonElement>('[role="option"]'));
  const pulsar = (b: HTMLElement): void => {
    b.click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DateTimePickerComponent] }).compileComponents();
    fixture = TestBed.createComponent(DateTimePickerComponent);
    fixture.componentRef.setInput('label', 'Fecha');
    fixture.componentRef.setInput('value', '2026-03-15');
    fixture.detectChanges();
    pulsar(el().querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!);
  });

  it('abre en los días con mes y año como botones', () => {
    expect(cabecera('mes').textContent?.trim()).toBe('Marzo');
    expect(cabecera('anio').textContent?.trim()).toBe('2026');
    expect(opciones().length).toBe(0);
  });

  it('el mes muestra los 12 meses con el actual marcado y al elegir vuelve a los días de ese mes', () => {
    pulsar(cabecera('mes'));
    expect(opciones().map((o) => o.textContent?.trim())).toEqual([
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ]);
    expect(opciones()[2].getAttribute('aria-selected')).toBe('true');

    pulsar(opciones()[9]);
    expect(opciones().length).toBe(0);
    expect(cabecera('mes').textContent?.trim()).toBe('Octubre');
    expect(cabecera('anio').textContent?.trim()).toBe('2026');
  });

  it('el año muestra 12 años, las flechas dobles pasan de página y al elegir vuelve a los días', () => {
    pulsar(cabecera('anio'));
    const anios = (): string[] => opciones().map((o) => o.textContent!.trim());
    expect(anios()).toEqual(['2022', '2023', '2024', '2025', '2026', '2027', '2028', '2029', '2030', '2031', '2032', '2033']);
    expect(opciones()[4].getAttribute('aria-selected')).toBe('true');

    pulsar(calendario().querySelector<HTMLButtonElement>('[aria-label="Años siguientes"]')!);
    expect(anios()[0]).toBe('2034');

    pulsar(opciones().find((o) => o.textContent?.trim() === '2040')!);
    expect(opciones().length).toBe(0);
    expect(cabecera('anio').textContent?.trim()).toBe('2040');
    expect(cabecera('mes').textContent?.trim()).toBe('Marzo');
  });

  it('con minDate deshabilita los meses y años que terminan antes', () => {
    fixture.componentRef.setInput('minDate', '2026-03-10');
    fixture.detectChanges();

    pulsar(cabecera('mes'));
    expect(opciones().slice(0, 3).map((o) => o.disabled)).toEqual([true, true, false]);

    // La flecha de año anterior no lleva a un año completo fuera del rango: queda deshabilitada.
    expect(calendario().querySelector<HTMLButtonElement>('[aria-label="Año anterior"]')!.disabled).toBeTrue();
  });

  it('elegir un día sigue funcionando después de cambiar de mes', () => {
    let valor = '';
    fixture.componentInstance.valueChange.subscribe((v) => (valor = v));
    pulsar(cabecera('mes'));
    pulsar(opciones()[6]);
    const dia = Array.from(calendario().querySelectorAll<HTMLButtonElement>('.grid-cols-7 button')).find((b) => b.textContent?.trim() === '20' && !b.disabled)!;
    pulsar(dia);
    expect(valor).toBe('2026-07-20');
  });
});

describe('DateTimePickerComponent — variante datetime', () => {
  it('emite fecha y hora (aaaa-mm-ddThh:mm:ss), la muestra en el campo y lee ese mismo formato', () => {
    TestBed.configureTestingModule({ imports: [DateTimePickerComponent] });
    const fixture = TestBed.createComponent(DateTimePickerComponent);
    fixture.componentRef.setInput('variant', 'datetime');
    fixture.componentRef.setInput('value', '2026-03-15T08:09:10');
    fixture.componentRef.setInput('defaultToToday', false);
    fixture.detectChanges();
    expect(fixture.componentInstance.displayValue).toBe('15/03/2026 08:09:10');

    const emitidos: string[] = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitidos.push(v));
    fixture.componentInstance.cambiarHora('hora', '7');
    fixture.componentInstance.cambiarHora('minuto', '75');
    expect(emitidos).toEqual(['2026-03-15T07:09:10', '2026-03-15T07:59:10']);
    expect(fixture.componentInstance.hora).withContext('mientras se escribe no se completa con ceros').toBe('7');
    fixture.componentInstance.normalizarHora();
    expect(fixture.componentInstance.displayValue).toBe('15/03/2026 07:59:10');
  });
});

describe('DateTimePickerComponent — escribir la fecha', () => {
  let fixture: ComponentFixture<DateTimePickerComponent>;
  let emitidos: string[];
  const campo = (): HTMLInputElement => fixture.nativeElement.querySelector('input[type="text"]')!;
  const escribir = (texto: string): void => {
    campo().value = texto;
    campo().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const salir = (): void => {
    campo().dispatchEvent(new Event('blur'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DateTimePickerComponent] }).compileComponents();
    fixture = TestBed.createComponent(DateTimePickerComponent);
    emitidos = [];
    fixture.componentInstance.valueChange.subscribe((v: string) => emitidos.push(v));
    fixture.componentRef.setInput('label', 'Fecha');
    fixture.componentRef.setInput('defaultToToday', false);
    fixture.detectChanges();
  });

  describe('por secciones con el teclado', () => {
    const tecla = (key: string, opciones: KeyboardEventInit = {}): void => {
      campo().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opciones }));
      fixture.detectChanges();
    };
    const teclear = (digitos: string): void => [...digitos].forEach((d) => tecla(d));
    const enfocar = (): void => {
      campo().focus();
      campo().dispatchEvent(new Event('focus'));
      fixture.detectChanges();
    };

    it('al enfocar muestra la plantilla dd/mm/aaaa y al salir sin escribir queda vacío', () => {
      enfocar();
      expect(campo().value).toBe('dd/mm/aaaa');
      salir();
      expect(campo().value).toBe('');
    });

    it('conserva la plantilla mientras se escribe y pasa a la siguiente sección al completar una', () => {
      enfocar();
      teclear('15');
      expect(campo().value).toBe('15/mm/aaaa');
      teclear('0');
      expect(campo().value).toBe('15/0m/aaaa');
      teclear('3');
      expect(campo().value).toBe('15/03/aaaa');
      teclear('2026');
      expect(campo().value).toBe('15/03/2026');
      expect(emitidos).toEqual(['2026-03-15']);
    });

    it('un primer dígito que no cabe en el mes o el día antepone 0', () => {
      enfocar();
      teclear('5');
      expect(campo().value).toBe('05/mm/aaaa');
      teclear('7');
      expect(campo().value).toBe('05/07/aaaa');
    });

    it('se corrige una sección elegida con las flechas sin tocar las demás', () => {
      enfocar();
      teclear('15032026');
      tecla('ArrowLeft');
      teclear('11');
      expect(campo().value).toBe('15/11/2026');
      expect(emitidos).toEqual(['2026-03-15', '2026-11-15']);
    });

    it('Retroceso quita el último dígito de la sección y, sin dígitos, pasa a la anterior y la vacía', () => {
      enfocar();
      teclear('150');
      tecla('Backspace');
      expect(campo().value).toBe('15/mm/aaaa');
      tecla('Backspace');
      expect(campo().value).toBe('15/mm/aaaa');
      tecla('Backspace');
      expect(campo().value).toBe('dd/mm/aaaa');
    });

    it('«/» cierra una sección de un solo dígito anteponiendo 0 y pasa a la siguiente', () => {
      enfocar();
      teclear('7');
      tecla('/');
      teclear('4');
      expect(campo().value).toBe('07/04/aaaa');
    });

    it('una fecha completa que no existe se queda en rojo con «Ingrese una fecha válida.»', () => {
      enfocar();
      teclear('00000000');
      expect(campo().value).toBe('00/00/0000');
      expect(fixture.nativeElement.textContent).toContain('Ingrese una fecha válida.');
      expect(campo().getAttribute('aria-invalid')).toBe('true');
      expect(emitidos).toEqual([]);
      salir();
      expect(campo().value).toBe('00/00/0000');
      enfocar();
      teclear('3102');
      teclear('2026');
      expect(fixture.nativeElement.textContent).toContain('Ingrese una fecha válida.');
    });

    it('un año muy antiguo con minDateError muestra ese error y sin él, «fecha válida»', () => {
      fixture.componentRef.setInput('minDate', '2020-01-01');
      fixture.componentRef.setInput('minDateError', 'Ingrese una fecha igual o posterior al 01/01/2020.');
      fixture.detectChanges();
      enfocar();
      teclear('10101000');
      expect(fixture.nativeElement.textContent).toContain('igual o posterior al 01/01/2020');
      fixture.componentRef.setInput('minDateError', '');
      fixture.componentRef.setInput('minDate', '');
      fixture.detectChanges();
      enfocar();
      teclear('10101000');
      expect(fixture.nativeElement.textContent).toContain('Ingrese una fecha válida.');
    });

    describe('recientes', () => {
      const CLAVE = 'taller-siaf-rp:fechas-recientes:prueba';
      const lista = (): string[] => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-reciente]')).map((b) => b.textContent!.trim());

      beforeEach(() => {
        localStorage.setItem(CLAVE, JSON.stringify(['2026-03-15', '2026-03-10', '2026-02-01']));
        fixture.componentRef.setInput('recentKey', 'prueba');
        fixture.componentInstance.ngOnInit();
        fixture.detectChanges();
      });
      afterEach(() => localStorage.removeItem(CLAVE));

      it('al enfocar el campo vacío ofrece las últimas fechas y elegirla la emite', () => {
        enfocar();
        expect(lista()).toEqual(['15/03/2026', '10/03/2026', '01/02/2026']);
        (fixture.nativeElement.querySelectorAll('[data-reciente]')[1] as HTMLButtonElement).click();
        fixture.detectChanges();
        expect(emitidos).toEqual(['2026-03-10']);
        expect(campo().value).toBe('10/03/2026');
        expect(lista()).toEqual([]);
      });

      it('la X quita una fecha de los recientes y del almacenamiento', () => {
        enfocar();
        (fixture.nativeElement.querySelectorAll('[data-quitar-reciente]')[0] as HTMLButtonElement).click();
        fixture.detectChanges();
        expect(lista()).toEqual(['10/03/2026', '01/02/2026']);
        expect(JSON.parse(localStorage.getItem(CLAVE)!)).toEqual(['2026-03-10', '2026-02-01']);
      });

      it('se navega con flecha abajo y Enter, y empezar a escribir cierra la lista', () => {
        enfocar();
        tecla('ArrowDown');
        tecla('ArrowDown');
        tecla('Enter');
        expect(emitidos).toEqual(['2026-03-10']);
        campo().value = '';
        enfocar();
        tecla('1');
        expect(lista()).toEqual([]);
      });

      it('solo ofrece las que respetan minDate y maxDate, y recuerda las nuevas sin repetir', () => {
        fixture.componentRef.setInput('minDate', '2026-03-01');
        fixture.componentRef.setInput('maxDate', '2026-03-31');
        enfocar();
        expect(lista()).toEqual(['15/03/2026', '10/03/2026']);
        teclear('20032026');
        expect(JSON.parse(localStorage.getItem(CLAVE)!)).toEqual(['2026-03-20', '2026-03-15', '2026-03-10', '2026-02-01']);
      });
    });

    it('ignora letras y símbolos', () => {
      enfocar();
      tecla('a');
      tecla('x');
      expect(campo().value).toBe('dd/mm/aaaa');
    });
  });

  it('pone la máscara dd/mm/aaaa mientras se escriben dígitos y emite al completar una fecha válida', () => {
    escribir('1503');
    expect(campo().value).toBe('15/03/aaaa');
    expect(emitidos).toEqual([]);
    escribir('15032026');
    expect(campo().value).toBe('15/03/2026');
    expect(emitidos).toEqual(['2026-03-15']);
  });

  it('una fecha inexistente no se emite y se queda en rojo con su mensaje; una incompleta vuelve a la elegida al salir', () => {
    fixture.componentRef.setInput('value', '2026-03-15');
    fixture.detectChanges();
    escribir('31022026');
    expect(emitidos).toEqual([]);
    salir();
    expect(campo().value).toBe('31/02/2026');
    expect(fixture.nativeElement.textContent).toContain('Ingrese una fecha válida.');
    escribir('1503');
    salir();
    expect(campo().value).toBe('15/03/2026');
  });

  it('respeta minDate y vaciar el campo borra la fecha cuando no hay fecha por defecto', () => {
    fixture.componentRef.setInput('minDate', '2026-03-10');
    fixture.componentRef.setInput('value', '2026-03-15');
    fixture.detectChanges();
    escribir('01032026');
    expect(emitidos).toEqual([]);
    escribir('');
    salir();
    expect(emitidos).toEqual(['']);
  });

  it('con datetime acepta la hora y emite aaaa-mm-ddThh:mm:ss', () => {
    fixture.componentRef.setInput('variant', 'datetime');
    fixture.detectChanges();
    escribir('15032026134510');
    expect(campo().value).toBe('15/03/2026 13:45:10');
    expect(emitidos).toEqual(['2026-03-15T13:45:10']);
  });
});

describe('DateTimePickerComponent — fecha máxima', () => {
  let fixture: ComponentFixture<DateTimePickerComponent>;
  let emitidos: string[];
  const campo = (): HTMLInputElement => fixture.nativeElement.querySelector('input[type="text"]')!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DateTimePickerComponent] }).compileComponents();
    fixture = TestBed.createComponent(DateTimePickerComponent);
    emitidos = [];
    fixture.componentInstance.valueChange.subscribe((v: string) => emitidos.push(v));
    fixture.componentRef.setInput('label', 'Fecha');
    fixture.componentRef.setInput('defaultToToday', false);
    fixture.componentRef.setInput('maxDate', '2026-03-15');
    fixture.componentRef.setInput('value', '2026-03-10');
    fixture.detectChanges();
  });

  it('deshabilita los días posteriores a maxDate en el calendario', () => {
    fixture.nativeElement.querySelector('button[aria-haspopup="dialog"]').click();
    fixture.detectChanges();
    const dias = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.grid-cols-7 button'));
    const estado = (n: string): boolean => dias.find((b) => b.textContent?.trim() === n && !b.disabled) === undefined;
    expect(estado('15')).toBeFalse();
    expect(estado('16')).toBeTrue();
  });

  it('no acepta al escribir una fecha posterior a maxDate', () => {
    campo().value = '16032026';
    campo().dispatchEvent(new Event('input'));
    expect(emitidos).toEqual([]);
    campo().value = '15032026';
    campo().dispatchEvent(new Event('input'));
    expect(emitidos).toEqual(['2026-03-15']);
  });

  it('con maxDateError, la fecha posterior escrita y confirmada se conserva con el mensaje y se limpia al corregirla', () => {
    fixture.componentRef.setInput('maxDateError', 'Ingrese una fecha igual o anterior a la actual.');
    fixture.detectChanges();
    campo().value = '20062027';
    campo().dispatchEvent(new Event('input'));
    campo().dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(campo().value).toBe('20/06/2027');
    expect(fixture.nativeElement.textContent).toContain('Ingrese una fecha igual o anterior a la actual.');
    expect(campo().getAttribute('aria-invalid')).toBe('true');
    expect(emitidos).toEqual([]);
    campo().value = '10032026';
    campo().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Ingrese una fecha igual o anterior');
    expect(emitidos).toEqual(['2026-03-10']);
  });

  it('con minDateError, la fecha anterior escrita y confirmada se conserva con el mensaje', () => {
    fixture.componentRef.setInput('minDate', '2020-01-01');
    fixture.componentRef.setInput('minDateError', 'Ingrese una fecha igual o posterior al 01/01/2020.');
    fixture.detectChanges();
    campo().value = '31122019';
    campo().dispatchEvent(new Event('input'));
    campo().dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(campo().value).toBe('31/12/2019');
    expect(fixture.nativeElement.textContent).toContain('Ingrese una fecha igual o posterior al 01/01/2020.');
    expect(emitidos).toEqual([]);
  });

  it('con minDate y maxDate la grilla de años solo ofrece los años del rango y las flechas no salen de él', () => {
    fixture.componentRef.setInput('minDate', '2020-01-01');
    fixture.componentRef.setInput('maxDate', '2026-10-22');
    fixture.componentRef.setInput('value', '2026-03-15');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-haspopup="dialog"]').click();
    fixture.detectChanges();
    const cab = (c: string): HTMLButtonElement => fixture.nativeElement.querySelector(`[data-cabecera="${c}"]`);
    cab('anio').click();
    fixture.detectChanges();
    const anios = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[role="option"]')).map((o) => o.textContent!.trim());
    expect(anios).toEqual(['2022', '2023', '2024', '2025', '2026']);
    const flecha = (nombre: string): HTMLButtonElement => fixture.nativeElement.querySelector(`button[aria-label="${nombre}"]`);
    expect(flecha('Años siguientes').disabled).toBeTrue();
    expect(flecha('Años anteriores').disabled).toBeFalse();
  });
});
