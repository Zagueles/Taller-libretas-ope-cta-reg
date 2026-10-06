import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { REGISTROS_NO_CONCILIADOS } from '../../models/conciliacion-diaria.model';
import { ConciliacionDiariaSolicitudComponent } from './conciliacion-diaria-solicitud.component';

describe('ConciliacionDiariaSolicitudComponent', () => {
  const crear = () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(ConciliacionDiariaSolicitudComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  it('la papelera de la barra de control quita solo los registros marcados', () => {
    const c = crear();
    c.registrosElegidos.set([...REGISTROS_NO_CONCILIADOS]);
    c.alternarMarcado(REGISTROS_NO_CONCILIADOS[0].id);
    c.alternarMarcado(REGISTROS_NO_CONCILIADOS[1].id);

    c.eliminarSeleccionados();

    expect(c.registrosElegidos().map((r) => r.id)).toEqual([REGISTROS_NO_CONCILIADOS[2].id, REGISTROS_NO_CONCILIADOS[3].id]);
    expect(c.marcados()).toEqual([]);
  });

  it('se puede grabar con la cuenta elegida y cambios aplicados; los registros son opcionales', () => {
    const c = crear();
    expect(c.formValido()).withContext('sin cuenta').toBeFalse();

    c.cuentaTemporal.set('11040103570200000000');
    c.aceptarCuenta();
    expect(c.formValido()).withContext('con cuenta, sin registros').toBeTrue();

    c.registrosElegidos.set([{ ...REGISTROS_NO_CONCILIADOS[0] }]);
    expect(c.formValido()).withContext('un registro sin conciliar tampoco lo impide').toBeTrue();

    c.registroEnEdicion.set(c.registrosElegidos()[0]);
    expect(c.formValido()).withContext('con un registro a medio editar').toBeFalse();
  });
});
