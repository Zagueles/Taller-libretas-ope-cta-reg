import type { Row, Worksheet } from 'exceljs';

import type { QueryReportParameters } from '../../../../../shared/types/query-report.types';
import { datosLibretasIniciales, filtrarMovimientos } from '../../../../../mock/libretas-backend';
import { CUENTAS_BANCARIAS_INFO, MovimientoLibretaRegistro, TIPO_CAMBIO } from '../../models/registro-libretas.model';
import { AgrupacionExcel, construirLibroConsulta } from './excel-consulta.util';

/**
 * El Excel de la consulta (plantilla «reporte detallado», «agrupado» y «agregado»): qué pestañas arma, qué columnas lleva
 * cada cuenta y cómo anida, subtotaliza y totaliza cada agrupación. Se prueba el libro que arma `construirLibroConsulta`,
 * no la descarga.
 */
describe('construirLibroConsulta', () => {
  const libretas = datosLibretasIniciales();
  const PARAMETROS = { desde: '2026-10-01', hasta: '2026-10-01' } as unknown as QueryReportParameters;
  const CUT = 'mef-dgtp-cut';
  const USD = 'mef-dgtp';

  const octubre = filtrarMovimientos(libretas, { desde: '2026-10-01', hasta: '2026-10-01' });
  const deCuenta = (id: string, movs: MovimientoLibretaRegistro[] = octubre) => movs.filter((m) => m.cuentaBancariaId === id);
  // Los saldos de junio vienen tal cual del Figma; desde julio se encadenan (cada saldo inicial es el final anterior).
  const desdeJulioCut = filtrarMovimientos(libretas, { cuentasBancarias: [CUT], desde: '2026-07-01' });

  /** El texto de cada celda de una fila (los valores con fórmula, por su resultado). */
  const textos = (fila: Row): string[] =>
    (fila.values as unknown[]).slice(1).map((v) => {
      if (v && typeof v === 'object' && 'result' in (v as object)) return String((v as { result: unknown }).result);
      return String(v ?? '');
    });
  const filas = (hoja: Worksheet, desde = 1): Row[] => {
    const lista: Row[] = [];
    hoja.eachRow({ includeEmpty: false }, (fila, n) => {
      if (n >= desde) lista.push(fila);
    });
    return lista;
  };
  const primerTexto = (fila: Row): string => textos(fila).find((t) => t !== '') ?? '';
  const cabeceras = (hoja: Worksheet): string[] => textos(hoja.getRow(7));
  const grupos = (hoja: Worksheet): string[] => [...new Set(textos(hoja.getRow(6)).filter(Boolean))];

  describe('plantilla «reporte detallado»', () => {
    it('arma «Resumen» y un «Resultado N» por cuenta bancaria consultada', async () => {
      const libro = await construirLibroConsulta(PARAMETROS, [
        { id: CUT, movimientos: deCuenta(CUT) },
        { id: USD, movimientos: deCuenta(USD) },
      ]);

      expect(libro.worksheets.map((h) => h.name)).toEqual(['Resumen', 'Resultado 1', 'Resultado 2']);
    });

    it('con una sola cuenta, solo hay «Resultado 1»', async () => {
      const libro = await construirLibroConsulta(PARAMETROS, [{ id: CUT, movimientos: deCuenta(CUT) }]);

      expect(libro.worksheets.map((h) => h.name)).toEqual(['Resumen', 'Resultado 1']);
    });

    it('el resumen lista cada cuenta con su entidad, unidad ejecutora y beneficiarios, y trae la nota «Importante»', async () => {
      const libro = await construirLibroConsulta(PARAMETROS, [
        { id: CUT, movimientos: deCuenta(CUT) },
        { id: USD, movimientos: deCuenta(USD) },
      ]);
      const resumen = libro.getWorksheet('Resumen')!;
      const todo = filas(resumen).map((f) => textos(f).join(' | '));

      expect(todo.some((t) => t.includes('MEF-DGTP-CUT - 11040103570200000000 - PEN') && t.includes('MINCETUR'))).toBeTrue();
      expect(todo.some((t) => t.includes('MEF-DGTP - 12073303572000000003 - USD') && t.includes('IPD'))).toBeTrue();
      expect(todo.some((t) => t.includes('Importante'))).toBeTrue();
      expect(todo.some((t) => t.includes('Cada pestaña de resultado contiene el detalle correspondiente a una cuenta bancaria'))).toBeTrue();
    });

    it('cada resultado abre con su cuenta y sus saldos, y lleva una fila por movimiento', async () => {
      const movimientos = deCuenta(CUT);
      const libro = await construirLibroConsulta(PARAMETROS, [{ id: CUT, movimientos }]);
      const hoja = libro.getWorksheet('Resultado 1')!;
      const cuenta = CUENTAS_BANCARIAS_INFO.find((c) => c.id === CUT)!;

      expect(textos(hoja.getRow(2))[0]).toBe('Cta. Bancaria:');
      expect(textos(hoja.getRow(2))[1]).toContain(cuenta.numeroCuenta);
      expect(hoja.getRow(3).getCell(2).value).toBe(cuenta.saldoInicial);
      expect(hoja.getRow(4).getCell(2).value).toBe(cuenta.saldoFinal);
      const datos = filas(hoja, 8);
      expect(datos.length).toBe(movimientos.length);
      expect(datos.map((f) => String(f.getCell(1).value))).toEqual(movimientos.map((m) => m.sec));
    });

    it('la cuenta en soles no lleva tipo de cambio ni importes en moneda nacional; la de dólares sí', async () => {
      const libro = await construirLibroConsulta(PARAMETROS, [
        { id: CUT, movimientos: deCuenta(CUT) },
        { id: USD, movimientos: deCuenta(USD) },
      ]);

      expect(grupos(libro.getWorksheet('Resultado 1')!)).not.toContain('TIPO DE CAMBIO');
      expect(grupos(libro.getWorksheet('Resultado 1')!)).not.toContain('IMPORTE EN MONEDA NACIONAL');
      expect(grupos(libro.getWorksheet('Resultado 2')!)).toContain('TIPO DE CAMBIO');
      expect(grupos(libro.getWorksheet('Resultado 2')!)).toContain('IMPORTE EN MONEDA NACIONAL');
    });

    it('en dólares, cada importe en moneda nacional es el importe de la cuenta por el tipo de cambio de compra', async () => {
      const movimientos = deCuenta(USD);
      const libro = await construirLibroConsulta(PARAMETROS, [{ id: USD, movimientos }]);
      const hoja = libro.getWorksheet('Resultado 1')!;
      const rotulos = cabeceras(hoja);
      const col = (rotulo: string, desde = 0): number => rotulos.indexOf(rotulo, desde) + 1;
      const creditoCuenta = col('CRÉDITO');
      const creditoNacional = col('CRÉDITO', creditoCuenta);

      filas(hoja, 8).forEach((fila, i) => {
        const celda = fila.getCell(creditoNacional).value as { formula: string; result: number };
        expect(celda.formula).toContain('*');
        // Con importe 0 la fórmula no guarda su resultado (Excel lo recalcula al abrir).
        expect(celda.result ?? 0).toBeCloseTo(movimientos[i].credito * TIPO_CAMBIO.compra, 2);
        expect(fila.getCell(creditoCuenta).value).toBe(movimientos[i].credito);
      });
    });
  });

  describe('agrupado y agregado', () => {
    const agrupacion = (tipo: AgrupacionExcel['tipo'], claves: string[], ocultas: string[]): AgrupacionExcel => ({
      tipo,
      niveles: claves.map((key) => ({ key, label: key, labelPrefix: { entidad: 'Ent.', unidadEjecutora: 'UE.', ffSubFf: 'FF/Sub FF' }[key] ?? key })),
      columnasOcultas: ocultas,
      gruposOcultos: [],
    });
    const hojaDe = async (movs: MovimientoLibretaRegistro[], a: AgrupacionExcel): Promise<Worksheet> =>
      (await construirLibroConsulta(PARAMETROS, [{ id: CUT, movimientos: movs }], a)).getWorksheet('Resultado 1')!;
    const resumenFilas = (hoja: Worksheet) => filas(hoja, 8).map((f) => ({ nivel: f.outlineLevel, texto: primerTexto(f) }));

    it('las columnas que la agrupación oculta no salen en la cabecera', async () => {
      const hoja = await hojaDe(deCuenta(CUT), agrupacion('agrupado', ['entidad', 'unidadEjecutora'], ['entidad', 'unidadEjecutora']));

      expect(cabeceras(hoja)).not.toContain('ENTIDAD');
      expect(cabeceras(hoja)).not.toContain('UNIDAD EJECUTORA');
      expect(cabeceras(hoja)).toContain('GRUPO');
    });

    it('agrupado de dos niveles: título por grupo, movimientos en el nivel más profundo, «Subtotal» al cerrar el segundo y «TOTAL» al cerrar el primero', async () => {
      const hoja = await hojaDe(deCuenta(CUT), agrupacion('agrupado', ['entidad', 'unidadEjecutora'], ['entidad', 'unidadEjecutora']));
      const estructura = resumenFilas(hoja);

      expect(estructura[0]).toEqual({ nivel: 0, texto: 'Ent.: MINCETUR (2 Registros)' });
      expect(estructura[1]).toEqual({ nivel: 1, texto: 'UE.: COMERCIO EXTERIOR TURISMO (2 Registros)' });
      expect(estructura.filter((e) => e.nivel === 2).length).toBe(deCuenta(CUT).length);
      expect(estructura.map((e) => e.texto)).toEqual(
        jasmine.arrayContaining(['Subtotal UE.: COMERCIO EXTERIOR TURISMO', 'TOTAL Ent.: MINCETUR', 'Subtotal UE.: ADMIN CENTRAL - OGA', 'TOTAL Ent.: MEF']),
      );
      // El cierre de cada grupo va después de sus movimientos y en su mismo nivel de esquema.
      const posicion = (texto: string) => estructura.findIndex((e) => e.texto === texto);
      expect(posicion('Subtotal UE.: COMERCIO EXTERIOR TURISMO')).toBeGreaterThan(posicion('UE.: COMERCIO EXTERIOR TURISMO (2 Registros)'));
      expect(estructura[posicion('TOTAL Ent.: MINCETUR')].nivel).toBe(0);
      expect(estructura[posicion('Subtotal UE.: COMERCIO EXTERIOR TURISMO')].nivel).toBe(1);
    });

    it('un grupo de un solo movimiento dice «1 Registro» (en singular)', async () => {
      const unico = deCuenta(CUT).slice(0, 1);
      const hoja = await hojaDe(unico, agrupacion('agrupado', ['entidad'], ['entidad']));

      expect(primerTexto(filas(hoja, 8)[0])).toMatch(/\(1 Registro\)$/);
    });

    it('agregado de tres niveles: la entidad no cierra; el segundo nivel cierra con «TOTAL» y el tercero con «Subtotal»', async () => {
      const hoja = await hojaDe(deCuenta(CUT), agrupacion('agregado', ['entidad', 'unidadEjecutora', 'ffSubFf'], ['entidad', 'unidadEjecutora', 'ffSubFf']));
      const textosFilas = resumenFilas(hoja).map((e) => e.texto);

      expect(textosFilas.some((t) => t.startsWith('TOTAL Ent.'))).withContext('la entidad va como tarjeta y no cierra').toBeFalse();
      expect(textosFilas.some((t) => t.startsWith('Subtotal Ent.'))).toBeFalse();
      expect(textosFilas).toContain('TOTAL UE.: COMERCIO EXTERIOR TURISMO');
      expect(textosFilas).toContain('Subtotal FF/Sub FF: Recursos directamente recaudados');
      expect(textosFilas).toContain('FF/Sub FF: Recursos Ordinarios (2 Registros)');
    });

    it('el FF/Sub FF se escribe sin su código («Recursos Ordinarios», no «1.00 Recursos Ordinarios»)', async () => {
      const hoja = await hojaDe(deCuenta(CUT), agrupacion('agrupado', ['ffSubFf'], ['ffSubFf']));

      const titulos = resumenFilas(hoja).map((e) => e.texto).filter((t) => t.startsWith('FF/Sub FF:'));
      expect(titulos.length).toBeGreaterThan(0);
      expect(titulos.every((t) => !/FF\/Sub FF: \d/.test(t))).toBeTrue();
    });

    it('el saldo inicial y final de cada cuenta de registro cierra con sus movimientos (saldo final − inicial = créditos − débitos)', async () => {
      const hoja = await hojaDe(desdeJulioCut, agrupacion('agrupado', ['numeroCuentaRegistro'], ['numeroCuentaRegistro', 'descripcionCuentaRegistro']));
      const rotulos = cabeceras(hoja);
      const colInicial = rotulos.indexOf('SALDO INICIAL') + 1;
      const colDebito = rotulos.indexOf('DÉBITO') + 1;
      const colCredito = rotulos.indexOf('CRÉDITO') + 1;
      const colFinal = rotulos.indexOf('SALDO FINAL') + 1;

      // Con un solo nivel y más de un grupo, cada cuenta de registro trae su título (con saldos) y sus movimientos.
      let revisados = 0;
      let movimientosDelGrupo: Row[] = [];
      let titulo: Row | null = null;
      const cerrar = (): void => {
        if (!titulo || !movimientosDelGrupo.length) return;
        const inicial = Number(titulo.getCell(colInicial).value);
        const final = Number(titulo.getCell(colFinal).value);
        const debitos = movimientosDelGrupo.reduce((n, f) => n + Number(f.getCell(colDebito).value), 0);
        const creditos = movimientosDelGrupo.reduce((n, f) => n + Number(f.getCell(colCredito).value), 0);
        if (inicial || final) {
          expect(final - inicial).withContext(primerTexto(titulo)).toBeCloseTo(creditos - debitos, 2);
          revisados++;
        }
      };
      for (const fila of filas(hoja, 8)) {
        if (fila.outlineLevel === 0) {
          cerrar();
          titulo = fila;
          movimientosDelGrupo = [];
        } else {
          movimientosDelGrupo.push(fila);
        }
      }
      cerrar();

      expect(revisados).toBeGreaterThan(1);
    });
  });
});
