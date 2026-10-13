import { TestBed } from '@angular/core/testing';

import { REGISTROS_NO_CONCILIADOS } from '../models/conciliacion-diaria.model';
import { ConciliacionRegistrosTablaComponent } from './conciliacion-registros-tabla.component';

describe('ConciliacionRegistrosTablaComponent', () => {
  const estados = (aprobado: boolean): string[] => {
    const fixture = TestBed.createComponent(ConciliacionRegistrosTablaComponent);
    fixture.componentRef.setInput('rows', [{ ...REGISTROS_NO_CONCILIADOS[0], conciliado: true }]);
    fixture.componentRef.setInput('aprobado', aprobado);
    fixture.detectChanges();
    return Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('siaf-status-tag')).map((e) => e.textContent!.trim());
  };

  it('un registro trabajado sigue «No conciliado» hasta que el aprobador apruebe el documento', () => {
    expect(estados(false)).toEqual(['No conciliado']);
    expect(estados(true)).toEqual(['Conciliado']);
  });
});
