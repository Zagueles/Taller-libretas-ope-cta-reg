/** Paleta, bordes y fechas comunes de los libros de Excel del proceso (la consulta y las descargas). */

export const AZUL = 'FF014899';

export const CELESTE = 'FFDDEBF7';

export const GRIS = 'FFF2F2F2';

export const BLANCO = 'FFFFFFFF';

export const NEGRO = 'FF000000';

export const BORDE_FINO = { style: 'thin' as const, color: { argb: NEGRO } };

export const BORDES = { top: BORDE_FINO, bottom: BORDE_FINO, left: BORDE_FINO, right: BORDE_FINO };

export const relleno = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });


export const aFecha = (iso: string): Date | string => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : '';
};
