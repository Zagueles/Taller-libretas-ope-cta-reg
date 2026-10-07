import { datosLibretasIniciales } from '../../../../mock/libretas-backend';
import { TIPO_CAMBIO } from '../models/registro-libretas.model';
import { construirDetalleRegistro } from './registro-libretas-detalle.util';

/** El detalle de un registro: lo comparten la pantalla de detalle, el PDF del registro y los Excel de Registros. */
describe('construirDetalleRegistro', () => {
  const libretas = datosLibretasIniciales();
  const enSoles = libretas.movimientos.find((m) => m.cuentaBancariaId === 'mef-dgtp-cut' && m.entidad === 'MINCETUR')!;
  const mef = libretas.movimientos.find((m) => m.cuentaBancariaId === 'mef-dgtp-cut' && m.entidad === 'MEF')!;
  const enDolares = libretas.movimientos.find((m) => m.cuentaBancariaId === 'mef-dgtp')!;

  const valor = (d: ReturnType<typeof construirDetalleRegistro>, seccion: string, caption: string): string | undefined =>
    d.secciones.find((s) => s.titulo === seccion)?.campos.find((c) => c.caption === caption)?.value;

  it('en soles trae las secciones de la operación y los cuatro importes, sin tipo de cambio', () => {
    const d = construirDetalleRegistro(enSoles);

    expect(d.secciones.map((s) => s.titulo)).toEqual([
      'Acreditación', 'Beneficiario', 'Cuenta de registro', 'Ámbito institucional', 'Entidad administradora',
      'Movimiento interno', 'Movimiento externo', 'Documento CUT',
    ]);
    expect(d.importes.map((i) => i.caption)).toEqual(['Saldo inicial', 'Débito', 'Crédito', 'Saldo final']);
    expect(d.importesNacional).toEqual([]);
    expect(d.cuenta.moneda).toBe('PEN');
  });

  it('en dólares suma «Tipo de cambio» y los importes convertidos a soles con el tipo de cambio de compra', () => {
    const d = construirDetalleRegistro(enDolares);

    expect(d.secciones.map((s) => s.titulo)).toContain('Tipo de cambio');
    expect(valor(d, 'Tipo de cambio', 'Compra')).toBe(TIPO_CAMBIO.compra.toFixed(2));
    expect(valor(d, 'Tipo de cambio', 'Venta')).toBe(TIPO_CAMBIO.venta.toFixed(2));
    expect(d.importesNacional.length).toBe(4);
    const aSoles = (n: number): string => new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n * TIPO_CAMBIO.compra);
    expect(d.importesNacional.map((i) => i.value)).toEqual([enDolares.saldoInicial, enDolares.debito, enDolares.credito, enDolares.saldoFinal].map(aSoles));
  });

  it('la unidad ejecutora del MEF va vacía («-») y la de otras entidades con su código cuando lo tienen', () => {
    expect(valor(construirDetalleRegistro(mef), 'Ámbito institucional', 'Unidad ejecutora')).toBe('-');
    expect(valor(construirDetalleRegistro(enSoles), 'Ámbito institucional', 'Unidad ejecutora')).toContain('COMERCIO EXTERIOR TURISMO');
    expect(valor(construirDetalleRegistro(enSoles), 'Ámbito institucional', 'Entidad')).toBe('111111070000 - MINCETUR');
  });

  it('el movimiento interno sale del tipo de operación y la descripción detallada lo nombra', () => {
    const devolucion = libretas.movimientos.find((m) => m.tipoOperacionCodigo === '3')!;
    const d = construirDetalleRegistro(devolucion);

    expect(valor(d, 'Movimiento interno', 'Código')).toBe('DV0003');
    expect(valor(d, 'Movimiento interno', 'Sigla')).toBe('DV');
    expect(d.descripcionDetallada).toBe('Registro de devolución');
    expect(d.numeroOperacion).toBe(`1234${devolucion.sec.slice(-4)}`);
  });

  it('marca como rechazado el registro de un documento rechazado', () => {
    expect(construirDetalleRegistro(enSoles).rechazado).toBeFalse();
    expect(construirDetalleRegistro(libretas.rechazados[0], true).rechazado).toBeTrue();
  });
});
