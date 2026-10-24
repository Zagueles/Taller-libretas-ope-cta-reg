import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DateRangeFilterPillComponent } from './date-range-filter-pill.component';

describe('DateRangeFilterPillComponent — límites del período personalizado', () => {
  let fixture: ComponentFixture<DateRangeFilterPillComponent>;
  let pill: DateRangeFilterPillComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DateRangeFilterPillComponent] }).compileComponents();
    fixture = TestBed.createComponent(DateRangeFilterPillComponent);
    pill = fixture.componentInstance;
    fixture.componentRef.setInput('minDate', '2020-01-01');
    fixture.componentRef.setInput('maxDate', '2026-10-22');
    fixture.detectChanges();
  });

  it('«Hasta» no admite días anteriores a «Desde» ni al mínimo del período', () => {
    expect(pill.minimoHasta()).toBe('2020-01-01');
    pill.cambiarDesde('2026-03-20');
    expect(pill.minimoHasta()).toBe('2026-03-20');
  });

  it('si «Hasta» queda anterior a la nueva «Desde», se limpia; si no, se conserva', () => {
    pill.hasta.set('2026-03-10');
    pill.cambiarDesde('2026-03-20');
    expect(pill.hasta()).toBe('');

    pill.hasta.set('2026-04-01');
    pill.cambiarDesde('2026-03-20');
    expect(pill.hasta()).toBe('2026-04-01');
  });

  it('los mensajes de error nombran el mínimo del período, la fecha «Desde» elegida y el tope de hoy', () => {
    expect(pill.errorMinimo(pill.minimoHasta())).toBe('Ingrese una fecha igual o posterior al 01/01/2020.');
    pill.cambiarDesde('2026-03-20');
    expect(pill.errorMinimo(pill.minimoHasta())).toBe('Ingrese una fecha igual o posterior a la fecha desde.');
    expect(pill.errorMinimo(pill.minDate)).toBe('Ingrese una fecha igual o posterior al 01/01/2020.');
    expect(pill.errorMaximo()).toBe('Ingrese una fecha igual o anterior a la actual.');
  });

  it('sin límites configurados, «Hasta» solo depende de «Desde»', () => {
    fixture.componentRef.setInput('minDate', '');
    fixture.componentRef.setInput('maxDate', '');
    fixture.detectChanges();
    expect(pill.minimoHasta()).toBe('');
    pill.cambiarDesde('2021-05-01');
    expect(pill.minimoHasta()).toBe('2021-05-01');
  });
});
