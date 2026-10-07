import type { Worksheet } from 'exceljs';

import { datosLibretasIniciales } from '../../../../../mock/libretas-backend';
import { MovimientoLibretaRegistro } from '../../models/registro-libretas.model';
import { construirLibroDocumentos, construirLibroRegistros } from './excel-descargas.util';

/** Los Excel de «Descargar» de la selección en Documentos y en Registros (plantillas «Documentos_existentes» y «Registros_existentes»). */
describe('descargas de Excel', () => {
  const libretas = datosLibretasIniciales();
  const cut = libretas.movimientos.find((m) => m.cuentaBancariaId === 'mef-dgtp-cut')!;
  const usd = libretas.movimientos.find((m) => m.cuentaBancariaId === 'mef-dgtp')!;
  const FILTROS = [
    { label: 'Estado', value: 'Procesado' },
    { label: 'Fecha de registro', value: '01/10/2026' },
    { label: 'Otro que no cabe', value: 'x' },
  ];

  const fila = (hoja: Worksheet, n: number): string[] => (hoja.getRow(n).values as unknown[]).slice(1).map((v) => String(v ?? ''));
  const columnas = (hoja: Worksheet): { grupo: string[]; sub: string[] } => ({ grupo: fila(hoja, 1), sub: fila(hoja, 2) });

  describe('resumen', () => {
    it('lleva el título, la sección y solo los dos primeros filtros rápidos', async () => {
      const libro = await construirLibroDocumentos([], FILTROS);
      const resumen = libro.getWorksheet('Resumen')!;

      expect(String(resumen.getCell('B2').value)).toBe('DOCUMENTOS DE OPERACIONES EN LAS LIBRETAS DE LAS CUENTAS DE REGISTRO');
      expect(String(resumen.getCell('B3').value)).toMatch(/^Creado \d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}$/);
      expect(String(resumen.getCell('B7').value)).toBe('DOCUMENTOS EXISTENTES');
      expect([resumen.getCell(9, 2).value, resumen.getCell(10, 2).value]).toEqual(['Estado', 'Procesado']);
      expect([resumen.getCell(9, 6).value, resumen.getCell(10, 6).value]).toEqual(['Fecha de registro', '01/10/2026']);
      expect(resumen.getCell(9, 7).value).toBeNull();
    });
  });

  describe('documentos', () => {
    it('una fila por documento con la fecha como fecha de Excel', async () => {
      const libro = await construirLibroDocumentos(
        [
          { document: 'Registro', number: '000011-2026', actionType: 'Creación', status: 'Procesado', system: 'Tesorería', dateIso: '2026-07-08', entity: 'MEF' },
          { document: 'Registro', number: '000016-2026', actionType: 'Creación', status: 'Rechazado', system: 'Tesorería', dateIso: '2026-07-15', entity: 'MEF' },
        ],
        FILTROS,
      );
      const hoja = libro.getWorksheet('Resultado')!;

      expect(fila(hoja, 1).slice(0, 7)).toEqual(['Documento', 'Número', 'Tipo de acción', 'Estado', 'Sistema', 'Fecha de registro', 'Entidad']);
      expect(hoja.rowCount).toBe(3);
      expect(hoja.getCell(2, 2).value).toBe('000011-2026');
      expect(hoja.getCell(3, 4).value).toBe('Rechazado');
      const fecha = hoja.getCell(2, 6).value as Date;
      expect(fecha instanceof Date && fecha.toISOString().slice(0, 10)).toBe('2026-07-08');
    });
  });

  describe('registros', () => {
    const libro = (movs: MovimientoLibretaRegistro[], visibles?: string[]) => construirLibroRegistros(movs, FILTROS, visibles);

    it('sin columnas visibles lleva las predeterminadas y deja fuera las de «Más columnas»', async () => {
      const hoja = (await libro([cut])).getWorksheet('Resultado')!;
      const { grupo, sub } = columnas(hoja);
      const todas = [...grupo, ...sub].join('|');

      expect(todas).toContain('Importe en moneda de la cuenta');
      expect(todas).toContain('Documento');
      expect(todas).not.toContain('Fecha de registro');
      expect(todas).not.toContain('Número de operación');
      expect(todas).not.toContain('Descripción detallada');
    });

    it('lleva las columnas visibles que se piden, incluidas las de «Más columnas»', async () => {
      const hoja = (await libro([cut], ['saldoInicial', 'debito', 'credito', 'saldoFinal', 'fechaRegistro', 'descripcionDetallada'])).getWorksheet('Resultado')!;
      const { grupo, sub } = columnas(hoja);

      expect([...grupo, ...sub]).toEqual(jasmine.arrayContaining(['Fecha de registro', 'Descripción detallada', 'Saldo inicial', 'Saldo final']));
      expect([...grupo, ...sub].join('|')).not.toContain('Número de operación');
    });

    it('una fila por movimiento con los importes como números y el estado de registro «Activo»', async () => {
      const hoja = (await libro([cut, usd], ['saldoInicial', 'debito', 'credito', 'saldoFinal', 'status'])).getWorksheet('Resultado')!;

      expect(hoja.rowCount).toBe(4);
      expect(hoja.getCell(3, 1).value).toBe(cut.saldoInicial);
      expect(hoja.getCell(3, 2).value).toBe(cut.debito);
      expect(hoja.getCell(3, 3).value).toBe(cut.credito);
      expect(hoja.getCell(4, 4).value).toBe(usd.saldoFinal);
      expect(hoja.getCell(3, 5).value).toBe('Activo');
      expect(hoja.getCell(3, 1).numFmt).toBe('#,##0.00');
    });

    it('la cuenta bancaria se descompone en número, denominación y moneda', async () => {
      const hoja = (await libro([usd], ['cuentaBancariaNumero', 'cuentaBancariaDenominacion', 'moneda'])).getWorksheet('Resultado')!;

      expect(fila(hoja, 3)).toEqual(['12073303572000000003', 'MEF - DGTP', 'USD']);
      // «Cuenta bancaria» agrupa número y denominación (celdas combinadas); «Moneda» ocupa las dos filas de cabecera.
      expect(fila(hoja, 1)).toEqual(['Cuenta bancaria', 'Cuenta bancaria', 'Moneda']);
    });
  });
});
