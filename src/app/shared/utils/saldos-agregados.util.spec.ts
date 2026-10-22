import { consolidarPorCuenta, totalizarSaldos } from './saldos-agregados.util';

describe('totalizarSaldos', () => {
  const balance = { startColumn: 'saldoInicial', endColumn: 'saldoFinal' };
  const fila = (cuenta: string, inicial: string, apertura: string, final: string) => ({ cuenta, saldoInicial: inicial, apertura, saldoFinal: final });
  const agg = { runningBalance: balance, accountColumn: 'cuenta', openingCreditColumn: 'apertura' };

  it('sin filas no hay saldos', () => {
    expect(totalizarSaldos([], balance, agg)).toBeNull();
  });

  it('una sola vez por cuenta: inicial de su primera fila y final de su última, sumadas entre cuentas', () => {
    const filas = [fila('A', '100.00', '0.00', '150.00'), fila('A', '150.00', '0.00', '120.00'), fila('B', '10.00', '0.00', '15.00')];
    expect(totalizarSaldos(filas, balance, agg)).toEqual({ inicio: 110, fin: 135 });
  });

  it('el crédito del movimiento «Saldo inicial» se suma al saldo inicial de su cuenta', () => {
    const filas = [fila('A', '0.00', '10,000.00', '10,000.00'), fila('A', '10,000.00', '0.00', '20,800.00'), fila('B', '5.00', '0.00', '5.00')];
    expect(totalizarSaldos(filas, balance, agg)).toEqual({ inicio: 10005, fin: 20805 });
  });

  it('sin accountColumn trata todas las filas como una sola cuenta', () => {
    const filas = [fila('A', '1.00', '0.00', '2.00'), fila('B', '2.00', '0.00', '5.00')];
    expect(totalizarSaldos(filas, balance)).toEqual({ inicio: 1, fin: 5 });
  });
});

describe('consolidarPorCuenta', () => {
  const agg = {
    runningBalance: { startColumn: 'saldoInicial', endColumn: 'saldoFinal' },
    accountColumn: 'cuenta',
    openingCreditColumn: 'apertura',
    consolidate: {
      sumColumns: [{ column: 'debito' }, { column: 'credito', excludeColumn: 'apertura' }],
      startColumns: [{ column: 'saldoInicial', openingColumn: 'apertura' }],
      endColumns: ['saldoFinal'],
    },
  };
  const fila = (cuenta: string, saldoInicial: string, debito: string, credito: string, apertura: string, saldoFinal: string) => ({ cuenta, descripcion: `Cuenta ${cuenta}`, saldoInicial, debito, credito, apertura, saldoFinal });

  it('una sola fila por cuenta de registro: inicial con la apertura, importes sumados sin repetirla y saldo final del último', () => {
    const filas = [
      fila('A', '0.00', '0.00', '10,000.00', '10,000.00', '10,000.00'), // apertura
      fila('A', '10,000.00', '0.00', '9,000.00', '0.00', '19,000.00'),
      fila('A', '19,000.00', '4,000.00', '0.00', '0.00', '15,000.00'),
      fila('B', '0.00', '0.00', '500.00', '500.00', '500.00'),
    ];

    const resultado = consolidarPorCuenta(filas, agg);

    expect(resultado.length).toBe(2);
    expect(resultado[0]).toEqual(jasmine.objectContaining({ cuenta: 'A', descripcion: 'Cuenta A', saldoInicial: '10,000.00', debito: '4,000.00', credito: '9,000.00', saldoFinal: '15,000.00' }));
    // La fórmula cuadra: saldo inicial + crédito − débito = saldo final.
    expect(10000 + 9000 - 4000).toBe(15000);
    expect(resultado[1]).toEqual(jasmine.objectContaining({ cuenta: 'B', saldoInicial: '500.00', credito: '0.00', saldoFinal: '500.00' }));
  });

  it('sin configuración de consolidación devuelve las filas tal cual', () => {
    const filas = [fila('A', '0.00', '0.00', '1.00', '0.00', '1.00')];
    expect(consolidarPorCuenta(filas, { runningBalance: agg.runningBalance })).toEqual(filas);
  });
});
