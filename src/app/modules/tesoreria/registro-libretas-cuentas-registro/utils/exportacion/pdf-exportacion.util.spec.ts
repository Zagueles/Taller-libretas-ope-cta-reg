import { datosLibretasIniciales, detalleDocumento } from '../../../../../mock/libretas-backend';
import { construirDetalleRegistro } from '../registro-libretas-detalle.util';
import { fechaHoraVisible, fechaVisible, monto } from './formato-exportacion.util';
import { generarPdfDocumento, nombrePdfDocumento } from './pdf-documento.util';
import { generarPdfRegistro, nombrePdfRegistro } from './pdf-registro.util';

/** Se cuentan las páginas del PDF en sus bytes (jsPDF no comprime el contenido): cada página es un objeto «/Type /Page». */
const paginasDe = async (blob: Blob): Promise<number> => {
  const texto = new TextDecoder('latin1').decode(await blob.arrayBuffer());
  return (texto.match(/\/Type \/Page(?![s\w])/g) ?? []).length;
};

describe('formato de las exportaciones', () => {
  it('los montos van en formato peruano con dos decimales y las fechas como dd/mm/aaaa', () => {
    expect(monto(1234567.5)).toBe('1,234,567.50');
    expect(monto(0)).toBe('0.00');
    expect(fechaVisible('2026-10-01T10:15:00')).toBe('01/10/2026');
    expect(fechaHoraVisible('2026-10-01T10:15:00')).toBe('01/10/2026 10:15:00');
  });
});

describe('PDF del registro y del documento', () => {
  const libretas = datosLibretasIniciales();
  const registro = libretas.movimientos.find((m) => m.cuentaBancariaId === 'mef-dgtp')!;

  it('el PDF del registro es un PDF con el nombre del detalle y al menos una página', async () => {
    const detalle = construirDetalleRegistro(registro);
    const generado = await generarPdfRegistro(detalle);

    expect(generado.blob.type).toBe('application/pdf');
    expect(generado.blob.size).toBeGreaterThan(1000);
    expect(generado.nombre).toBe(nombrePdfRegistro(detalle));
    expect(generado.nombre).toContain(registro.numeroDocumento);
    expect(generado.paginas).toBeGreaterThanOrEqual(1);
    expect(await paginasDe(generado.blob)).toBe(generado.paginas);
  });

  it('el PDF del documento lleva una hoja por cada cuenta bancaria que referencia', async () => {
    const dosCuentas = detalleDocumento(libretas, '000011-2026')!;
    const unaCuenta = detalleDocumento(libretas, '000016-2026')!;
    expect(new Set(dosCuentas.movimientos.map((m) => m.cuentaBancariaId)).size).toBe(2);
    expect(new Set(unaCuenta.movimientos.map((m) => m.cuentaBancariaId)).size).toBe(1);

    const con2 = await generarPdfDocumento(dosCuentas);
    const con1 = await generarPdfDocumento(unaCuenta);

    expect(con2.blob.type).toBe('application/pdf');
    expect(con2.nombre).toBe(nombrePdfDocumento('000011-2026'));
    expect(await paginasDe(con2.blob)).toBeGreaterThan(await paginasDe(con1.blob));
    expect(await paginasDe(con1.blob)).toBeGreaterThanOrEqual(1);
  });
});
