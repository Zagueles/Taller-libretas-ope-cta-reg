import { totalizarSaldos } from './saldos-agregados.util';

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
