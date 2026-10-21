import { ariaSortDe, ordenarFilas, siguienteOrden, valorOrdenable } from './table-sort.util';

describe('table-sort.util', () => {
  it('siguienteOrden cicla ascendente → descendente → sin orden y empieza de nuevo al cambiar de columna', () => {
    let orden = siguienteOrden(null, 'a');
    expect(orden).toEqual({ key: 'a', direction: 'asc' });
    orden = siguienteOrden(orden, 'a');
    expect(orden).toEqual({ key: 'a', direction: 'desc' });
    expect(siguienteOrden(orden, 'a')).toBeNull();
    expect(siguienteOrden({ key: 'a', direction: 'desc' }, 'b')).toEqual({ key: 'b', direction: 'asc' });
  });

  it('ariaSortDe describe el orden solo en la columna ordenada', () => {
    expect(ariaSortDe({ key: 'a', direction: 'asc' }, 'a')).toBe('ascending');
    expect(ariaSortDe({ key: 'a', direction: 'desc' }, 'a')).toBe('descending');
    expect(ariaSortDe({ key: 'a', direction: 'asc' }, 'b')).toBe('none');
    expect(ariaSortDe(null, 'a')).toBe('none');
  });

  describe('ordenarFilas', () => {
    const valor = (f: Record<string, string | number>, k: string) => f[k];
    const filas = [{ id: 'b', n: '10' }, { id: 'a', n: '2' }, { id: 'c', n: '' }, { id: 'd', n: '2' }];

    it('usa el orden natural («2» antes que «10»), es estable y deja los vacíos al final en cualquier sentido', () => {
      expect(ordenarFilas(filas, { key: 'n', direction: 'asc' }, valor).map((f) => f.id)).toEqual(['a', 'd', 'b', 'c']);
      expect(ordenarFilas(filas, { key: 'n', direction: 'desc' }, valor).map((f) => f.id)).toEqual(['b', 'a', 'd', 'c']);
    });

    it('compara números como números y sin orden devuelve una copia en el orden original', () => {
      const montos = [{ id: 'x', m: 9 }, { id: 'y', m: 100 }];
      expect(ordenarFilas(montos, { key: 'm', direction: 'desc' }, valor).map((f) => f.id)).toEqual(['y', 'x']);
      const copia = ordenarFilas(filas, null, valor);
      expect(copia).toEqual(filas);
      expect(copia).not.toBe(filas);
    });
  });

  describe('valorOrdenable', () => {
    it('convierte montos con miles a número, fechas dd/mm/aaaa a una clave comparable y deja vacío lo que no es', () => {
      expect(valorOrdenable('1,000,000.50', 'number')).toBe(1000000.5);
      expect(valorOrdenable('abc', 'number')).toBeNull();
      expect(valorOrdenable('28/06/2026 18:02:00', 'date')).toBe('20260628180200');
      expect(valorOrdenable('29/06/2026', 'date')).toBe('20260629000000');
      expect(valorOrdenable('', 'text')).toBeNull();
      expect(valorOrdenable('000010', 'text')).toBe('000010');
    });

    it('el orden por fecha pone junio antes que julio aunque el texto no lo haga', () => {
      const filas = [{ f: '01/07/2026 08:00:00' }, { f: '28/06/2026 18:02:00' }];
      const ordenadas = ordenarFilas(filas, { key: 'f', direction: 'asc' }, (fila, k) => valorOrdenable((fila as Record<string, string>)[k], 'date'));
      expect(ordenadas.map((x) => x.f)).toEqual(['28/06/2026 18:02:00', '01/07/2026 08:00:00']);
    });
  });
});
