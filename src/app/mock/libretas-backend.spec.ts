import { cuentasRegistro, datosLibretasIniciales, detalleDocumento, detalleMovimiento, filtrarMovimientos, listarDocumentos, saldosCuentasBancarias } from './libretas-backend';
import { saldosPorCuentaRegistro } from '../modules/tesoreria/registro-libretas-cuentas-registro/utils/registro-libretas-saldos.util';

/** Las reglas del backend simulado de libretas: lo que el servidor resuelve y las pantallas ya no calculan. */
describe('libretas-backend', () => {
  const libretas = datosLibretasIniciales();

  describe('filtrarMovimientos', () => {
    it('sin filtros devuelve todos los movimientos de la libreta (no los de documentos rechazados)', () => {
      const todos = filtrarMovimientos(libretas, {});
      expect(todos.length).toBe(libretas.movimientos.length);
      expect(todos.some((m) => libretas.rechazados.some((r) => r.sec === m.sec))).toBeFalse();
    });

    it('filtra por período inclusivo y por cuenta bancaria', () => {
      const septiembreCut = filtrarMovimientos(libretas, { desde: '2026-09-01', hasta: '2026-09-30', cuentasBancarias: ['mef-dgtp-cut'] });
      expect(septiembreCut.length).toBeGreaterThan(0);
      expect(septiembreCut.every((m) => m.fecha >= '2026-09-01' && m.fecha < '2026-10-01' && m.cuentaBancariaId === 'mef-dgtp-cut')).toBeTrue();

      const unDia = filtrarMovimientos(libretas, { desde: '2026-09-05', hasta: '2026-09-05' });
      expect(unDia.every((m) => m.fecha.startsWith('2026-09-05'))).toBeTrue();
    });

    it('combina tipo de operación, entidad, unidad ejecutora y beneficiario (una lista vacía no filtra)', () => {
      const devoluciones = filtrarMovimientos(libretas, { tiposOperacion: ['5'], entidades: [] });
      expect(devoluciones.length).toBeGreaterThan(0);
      expect(devoluciones.every((m) => m.tipoOperacionCodigo === '5')).toBeTrue();

      const ipd = filtrarMovimientos(libretas, { entidades: ['IPD'], beneficiarios: ['000193'] });
      expect(ipd.every((m) => m.entidad === 'IPD' && m.beneficiarioCodigo === '000193')).toBeTrue();
      expect(filtrarMovimientos(libretas, { cuentasBancarias: ['no-existe'] })).toEqual([]);
    });
  });

  describe('saldosCuentasBancarias', () => {
    it('los totales de la cuenta bancaria cuadran: saldo inicial + créditos (sin la apertura) − débitos = saldo final', () => {
      saldosCuentasBancarias(libretas).forEach((x) => {
        expect(Math.round((x.saldoInicial + x.totalCreditos - x.totalDebitos) * 100) / 100).withContext(x.cuentaBancariaId).toBe(x.saldoFinal);
      });
    });

    it('son el total de todas las libretas de la cuenta, sin importar el período de la consulta', () => {
      const saldos = saldosCuentasBancarias(libretas);
      expect(saldos.map((x) => x.cuentaBancariaId).sort()).toEqual(['mef-dgtp', 'mef-dgtp-cut']);
      saldos.forEach((x) => {
        const total = saldosPorCuentaRegistro(libretas.movimientos.filter((m) => m.cuentaBancariaId === x.cuentaBancariaId));
        expect(x.saldoInicial).toBe(total.saldoInicial);
        expect(x.saldoFinal).toBe(total.saldoFinal);
      });
      // Un período acotado da otro resultado: los saldos de la cuenta no deben usarlo.
      const soloOctubre = saldosPorCuentaRegistro(filtrarMovimientos(libretas, { cuentasBancarias: ['mef-dgtp-cut'], desde: '2026-10-01', hasta: '2026-10-01' }));
      expect(soloOctubre.saldoInicial).not.toBe(saldos.find((x) => x.cuentaBancariaId === 'mef-dgtp-cut')!.saldoInicial);
    });
  });

  describe('documentos', () => {
    it('lista un documento por número, ordenado, con su estado y el motivo si fue rechazado', () => {
      const documentos = listarDocumentos(libretas);
      const numeros = documentos.map((d) => d.numero);
      expect(numeros).toEqual([...new Set(numeros)].sort());

      const pendiente = documentos.find((d) => d.numero === '000016-2026')!;
      expect(pendiente.estado).toBe('Pendiente');
      expect(pendiente.codigoError).toBe('P-001');
      expect(pendiente.descripcionError).toContain('saldo');
      const rechazado = documentos.find((d) => d.numero === '000017-2026')!;
      expect(rechazado.estado).toBe('Rechazado');
      expect(rechazado.codigoError).toBe('E-001');
      expect(documentos.find((d) => d.numero === '000011-2026')!.codigoError).toBeNull();
      expect(documentos.find((d) => d.numero === '000011-2026')!.estado).toBe('Procesado');
    });

    it('filtra por estado y por texto', () => {
      expect(listarDocumentos(libretas, { estado: 'Rechazado' }).map((d) => d.numero)).toEqual(['000017-2026']);
      expect(listarDocumentos(libretas, { estado: 'Pendiente' }).map((d) => d.numero)).toEqual(['000016-2026', '000018-2026']);
      expect(listarDocumentos(libretas, { search: '000011' }).map((d) => d.numero)).toEqual(['000011-2026']);
    });

    it('el detalle de un documento rechazado trae los movimientos que traía; uno que no existe es null', () => {
      const detalle = detalleDocumento(libretas, '000016-2026')!;
      expect(detalle.documento.estado).toBe('Pendiente');
      expect(detalle.movimientos.length).toBe(2);
      expect(detalleDocumento(libretas, 'inexistente')).toBeNull();
    });
  });

  describe('detalleMovimiento', () => {
    it('marca como rechazado el movimiento de un documento rechazado y devuelve su documento', () => {
      const rechazado = detalleMovimiento(libretas, libretas.rechazados[0].sec)!;
      expect(rechazado.rechazado).toBeTrue();
      expect(rechazado.documento.estado).toBe('Pendiente');

      const normal = detalleMovimiento(libretas, libretas.movimientos[0].sec)!;
      expect(normal.rechazado).toBeFalse();
      expect(detalleMovimiento(libretas, 'zzz')).toBeNull();
    });
  });

  it('cuentasRegistro entrega las cuentas de registro distintas con su FF/SUB FF', () => {
    const cuentas = cuentasRegistro(libretas);
    expect(cuentas.length).toBeGreaterThan(0);
    expect(new Set(cuentas.map((c) => c.numero)).size).toBe(cuentas.length);
    expect(cuentas.every((c) => !!c.ffSubFf && !!c.descripcion)).toBeTrue();
  });
});
