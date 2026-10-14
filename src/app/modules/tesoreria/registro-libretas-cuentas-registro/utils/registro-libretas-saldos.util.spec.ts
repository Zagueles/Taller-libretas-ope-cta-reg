import { datosLibretasIniciales } from '../../../../mock/libretas-backend';
import { MovimientoLibretaRegistro } from '../models/registro-libretas.model';
import { saldosMNPorMovimiento, saldosPorCuentaRegistro } from './registro-libretas-saldos.util';

/** Reglas de saldos del Anexo 14 (RN-036 a RN-047 y RN-069) sobre las libretas de ejemplo y sobre casos armados. */
describe('registro-libretas-saldos', () => {
  const mov = (sec: string, cuenta: string, si: number, debito: number, credito: number): MovimientoLibretaRegistro =>
    ({ sec, fecha: '2026-10-01T00:00:00', cuentaBancariaId: 'cb', numeroCuentaRegistro: cuenta, saldoInicial: si, debito, credito, saldoFinal: si + credito - debito } as MovimientoLibretaRegistro);

  describe('datos de ejemplo (libretas del taller)', () => {
    const libretas = datosLibretasIniciales().movimientos;
    const porLibreta = new Map<string, MovimientoLibretaRegistro[]>();
    libretas.forEach((m) => {
      const k = `${m.cuentaBancariaId}|${m.numeroCuentaRegistro}`;
      porLibreta.set(k, [...(porLibreta.get(k) ?? []), m].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.sec.localeCompare(b.sec)));
    });

    it('RN-039/041: saldo final = saldo inicial + crédito − débito en cada registro', () => {
      libretas.forEach((m) => expect(m.saldoInicial + m.credito - m.debito).withContext(`sec ${m.sec}`).toBe(m.saldoFinal));
    });

    it('RN-043: un débito nunca supera el saldo inicial del registro', () => {
      libretas.forEach((m) => expect(m.debito).withContext(`sec ${m.sec}`).toBeLessThanOrEqual(m.saldoInicial));
    });

    it('RN-036/044: desde julio (lo que se encadena) el saldo inicial es el final del registro anterior de la libreta', () => {
      // Junio viene tal cual del Figma, con saldos que no se encadenan por fecha; del primer registro nuevo en adelante sí.
      porLibreta.forEach((lista, clave) => {
        lista.forEach((m, i) => {
          if (i > 0 && m.fecha >= '2026-07-01') expect(m.saldoInicial).withContext(`${clave} sec ${m.sec}`).toBe(lista[i - 1].saldoFinal);
        });
      });
    });

    it('RN-037: el registro de apertura (Saldos Iniciales) parte de saldo inicial 0.00 y entra como crédito', () => {
      libretas.filter((m) => m.tipoOperacionCodigo === '1').forEach((m) => {
        expect(m.saldoInicial).withContext(`sec ${m.sec}`).toBe(0);
        expect(m.debito).toBe(0);
      });
    });
  });

  describe('RN-069: una sola vez el saldo de cada cuenta de registro', () => {
    it('suma el inicial del primer registro y el final del último de cada libreta, sin sumar las secuencias intermedias', () => {
      const movs = [
        mov('000002', 'A', 100, 0, 50), // A: 100 → 150
        mov('000005', 'A', 150, 30, 0), // A: 150 → 120
        mov('000003', 'B', 10, 0, 5), //   B: 10 → 15
      ];
      expect(saldosPorCuentaRegistro(movs)).toEqual({ saldoInicial: 110, saldoFinal: 135, saldoInicialMN: 110, saldoFinalMN: 135 });
    });

    it('ordena por fecha y secuencia aunque lleguen desordenados', () => {
      const movs = [mov('000009', 'A', 150, 0, 10), mov('000001', 'A', 100, 0, 50)];
      expect(saldosPorCuentaRegistro(movs).saldoInicial).toBe(100);
      expect(saldosPorCuentaRegistro(movs).saldoFinal).toBe(160);
    });
  });

  describe('RN-044/045: moneda nacional encadenada', () => {
    it('el saldo inicial MN de cada registro es el final MN del anterior, aunque cambie el tipo de cambio', () => {
      const a = mov('000001', 'A', 100, 0, 10); // TC 3.0 → SI 300, SF 330
      const b = mov('000002', 'A', 110, 0, 10); // TC 4.0 → SI 330 (no 110 × 4), SF 370
      const tc = (m: MovimientoLibretaRegistro): number => (m.sec === '000001' ? 3 : 4);
      const mn = saldosMNPorMovimiento([a, b], tc);
      expect(mn.get('cb|000001')).toEqual({ saldoInicialMN: 300, saldoFinalMN: 330 });
      expect(mn.get('cb|000002')).toEqual({ saldoInicialMN: 330, saldoFinalMN: 370 });
      expect(saldosPorCuentaRegistro([a, b], tc)).toEqual(jasmine.objectContaining({ saldoInicialMN: 300, saldoFinalMN: 370 }));
    });
  });
});
