import { datosLibretasIniciales } from '../../../../mock/libretas-backend';
import { MovimientoLibretaRegistro } from '../models/registro-libretas.model';
import { claveMovimiento, importesMN, saldosMNPorMovimiento, saldosPorCuentaRegistro } from './registro-libretas-saldos.util';

/** Reglas de saldos del Anexo 14 (RN-036 a RN-047 y RN-069) sobre las libretas de ejemplo y sobre casos armados. */
describe('registro-libretas-saldos', () => {
  const mov = (sec: string, cuenta: string, si: number, debito: number, credito: number): MovimientoLibretaRegistro =>
    ({ id: `${cuenta}-${sec}`, sec, fecha: '2026-10-01T00:00:00', cuentaBancariaId: 'cb', numeroCuentaRegistro: cuenta, saldoInicial: si, debito, credito, saldoFinal: si + credito - debito } as MovimientoLibretaRegistro);

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

    it('RN-036/044: en cada libreta, ordenada por su secuencia, el saldo inicial es el final del registro anterior', () => {
      porLibreta.forEach((lista, clave) => {
        lista.forEach((m, i) => {
          if (i > 0) expect(m.saldoInicial).withContext(`${clave} sec ${m.sec}`).toBe(lista[i - 1].saldoFinal);
        });
      });
    });

    it('RN-025: la secuencia es correlativa dentro de cada libreta (000001, 000002…) en orden cronológico, y el id es único', () => {
      porLibreta.forEach((lista, clave) => {
        expect(lista.map((m) => m.sec)).withContext(clave).toEqual(lista.map((_, i) => String(i + 1).padStart(6, '0')));
      });
      expect(new Set(libretas.map((m) => m.id)).size).toBe(libretas.length);
    });

    it('el saldo inicial de cada cuenta bancaria es el de sus libretas: apertura (con su crédito) y ningún saldo inicial huérfano', () => {
      const cut = saldosPorCuentaRegistro(libretas.filter((m) => m.cuentaBancariaId === 'mef-dgtp-cut'));
      // Cada libreta parte de 0.00 y su apertura entra como crédito: 10,000 + 0 + 3,000 + 15,000 + 1,000,000.
      expect(cut.saldoInicial).toBe(1028000);
    });

    it('cuadra por cuenta bancaria: saldo inicial + créditos (sin la apertura) − débitos = saldo final', () => {
      ['mef-dgtp-cut', 'mef-dgtp'].forEach((cuenta) => {
        const movs = libretas.filter((m) => m.cuentaBancariaId === cuenta);
        const totales = saldosPorCuentaRegistro(movs);
        const creditos = movs.filter((m) => m.tipoOperacionCodigo !== '3').reduce((t, m) => t + m.credito, 0);
        const debitos = movs.reduce((t, m) => t + m.debito, 0);
        expect(totales.saldoInicial + creditos - debitos).withContext(cuenta).toBe(totales.saldoFinal);
      });
    });

    it('RN-037: el registro de apertura (Saldos Iniciales) parte de saldo inicial 0.00 y entra como crédito', () => {
      libretas.filter((m) => m.tipoOperacionCodigo === '3').forEach((m) => {
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

  describe('crédito del movimiento interno «Saldo inicial»', () => {
    it('forma parte del saldo inicial total y no del abono del periodo; el saldo final no cambia', () => {
      const apertura = { ...mov('000001', 'A', 0, 0, 1000), tipoOperacionCodigo: '3' } as MovimientoLibretaRegistro; // 0 → 1,000
      const abono = { ...mov('000002', 'A', 1000, 0, 200), tipoOperacionCodigo: '1' } as MovimientoLibretaRegistro; // 1,000 → 1,200
      expect(saldosPorCuentaRegistro([apertura, abono])).toEqual({ saldoInicial: 1000, saldoFinal: 1200, saldoInicialMN: 1000, saldoFinalMN: 1200 });
      // Sin la apertura en el resultado, el saldo inicial es el del primer registro.
      expect(saldosPorCuentaRegistro([abono]).saldoInicial).toBe(1000);
    });
  });

  describe('RN-044/045: moneda nacional encadenada', () => {
    it('el saldo inicial MN de cada registro es el final MN del anterior, aunque cambie el tipo de cambio', () => {
      const a = mov('000001', 'A', 100, 0, 10); // TC 3.0 → SI 300, SF 330
      const b = mov('000002', 'A', 110, 0, 10); // TC 4.0 → SI 330 (no 110 × 4), SF 370
      const tc = (m: MovimientoLibretaRegistro): number => (m.sec === '000001' ? 3 : 4);
      const mn = saldosMNPorMovimiento([a, b], tc);
      expect(mn.get('cb|A-000001')).toEqual({ saldoInicialMN: 300, saldoFinalMN: 330 });
      expect(mn.get('cb|A-000002')).toEqual({ saldoInicialMN: 330, saldoFinalMN: 370 });
      expect(saldosPorCuentaRegistro([a, b], tc)).toEqual(jasmine.objectContaining({ saldoInicialMN: 300, saldoFinalMN: 370 }));
    });

    it('RN-032/033: el crédito en moneda nacional usa el tipo de compra y el débito el de venta', () => {
      const m = { ...mov('000001', 'A', 1000, 50_000, 180_000), cuentaBancariaId: 'mef-dgtp' } as MovimientoLibretaRegistro;
      // Compra 3.35 y venta 3.32: 180,000 × 3.35 = 603,000 y 50,000 × 3.32 = 166,000.
      expect(importesMN(m)).toEqual({ debito: 166_000, credito: 603_000, disponible: 437_000 });
      const mn = saldosMNPorMovimiento([m], () => ({ compra: 3.35, venta: 3.32 })).get(claveMovimiento(m))!;
      expect(mn.saldoFinalMN).toBeCloseTo(1000 * 3.35 + 603_000 - 166_000, 2);
    });
  });
});
