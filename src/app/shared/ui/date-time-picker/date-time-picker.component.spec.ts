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

    pulsar(calendario().querySelector<HTMLButtonElement>('[aria-label="Año anterior"]')!);
    expect(opciones().every((o) => o.disabled)).toBeTrue();
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
