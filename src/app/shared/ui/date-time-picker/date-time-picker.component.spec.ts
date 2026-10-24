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

  it('pone la máscara dd/mm/aaaa mientras se escriben dígitos y emite al completar una fecha válida', () => {
    escribir('1503');
    expect(campo().value).toBe('15/03');
    expect(emitidos).toEqual([]);
    escribir('15032026');
    expect(campo().value).toBe('15/03/2026');
    expect(emitidos).toEqual(['2026-03-15']);
  });

  it('una fecha inexistente no se emite y al salir vuelve a la fecha elegida', () => {
    fixture.componentRef.setInput('value', '2026-03-15');
    fixture.detectChanges();
    escribir('31022026');
    expect(emitidos).toEqual([]);
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
