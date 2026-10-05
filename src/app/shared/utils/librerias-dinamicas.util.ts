/**
 * Carga perezosa de librerías CommonJS que el build de producción empaqueta solo con export `default` (Vite en
 * desarrollo sí les expone los nombres): desestructurar `await import('exceljs')` funcionaba en local y fallaba en la
 * versión desplegada con «Workbook is not a constructor». Estas funciones aceptan las dos formas.
 */
export async function cargarWorkbook(): Promise<typeof import('exceljs').Workbook> {
  const modulo = (await import('exceljs')) as unknown as { Workbook?: typeof import('exceljs').Workbook; default?: { Workbook: typeof import('exceljs').Workbook } };
  const Workbook = modulo.Workbook ?? modulo.default?.Workbook;
  if (!Workbook) throw new Error('No se pudo cargar exceljs');
  return Workbook;
}

export async function cargarToDataURL(): Promise<typeof import('qrcode').toDataURL> {
  const modulo = (await import('qrcode')) as unknown as { toDataURL?: typeof import('qrcode').toDataURL; default?: { toDataURL: typeof import('qrcode').toDataURL } };
  const toDataURL = modulo.toDataURL ?? modulo.default?.toDataURL;
  if (!toDataURL) throw new Error('No se pudo cargar qrcode');
  return toDataURL;
}
