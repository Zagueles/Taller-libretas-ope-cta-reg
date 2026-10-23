/**
 * Anchos estándar de las columnas del listado de documentos: los usa la pestaña «Documentos» de «Documentos y registros» y
 * la Bandeja de documentos, para que la misma tabla tenga las mismas medidas en los dos sitios.
 */
// Las clases van escritas completas: Tailwind no detecta las que se arman por interpolación.
export const ANCHO_LISTADO_DOCUMENTOS = {
  documento: 'w-[300px]',
  numero: 'w-[160px]',
  tipoAccion: 'w-[140px]',
  estado: 'w-[120px]',
  sistema: 'w-[150px]',
  fechaRegistro: 'w-[186px]',
  entidad: 'w-[280px]',
  idEntidad: 'w-[131px]',
} as const;

/** Ancho en px de una clase `w-[Npx]` de este listado. */
export const anchoEnPx = (clase: string): number => Number(/w-\[(\d+)px\]/.exec(clase)?.[1] ?? 0);

/** Casilla de selección (48 px) y columna del historial (56 px) que acompañan a las columnas del listado. */
export const ANCHO_CASILLA_Y_ACCION = 48 + 56;
