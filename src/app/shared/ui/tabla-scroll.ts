/**
 * Sombra de la columna fija de una tabla con scroll horizontal: un degradado continuo (no una sombra por celda, que se corta en
 * cada separador de fila) que solo se ve cuando hay contenido por desplazar hacia la izquierda de la columna fija. Va con
 * `group/tabla` y `data-sombra-der` del contenedor, que mantiene `medirSombras`.
 */
// Las clases van escritas completas: Tailwind no detecta las que se arman por interpolación.
export const SOMBRA_DER =
  "after:pointer-events-none after:absolute after:-bottom-px after:right-full after:top-0 after:w-3 after:bg-gradient-to-l after:from-[color-mix(in_srgb,var(--sys-color-text-neutral-high)_14%,transparent)] after:to-transparent after:opacity-0 after:transition-opacity after:content-[''] group-data-[sombra-der=true]/tabla:after:opacity-100";

/** Ancho en px de una columna sin `width`: el mismo que usa la tabla de documentos y registros. */
export const ANCHO_COLUMNA_POR_DEFECTO = 180;

/**
 * Ancho que necesita la cabecera de una columna para leerse completa: el texto en mayúsculas (≈ 9 px por letra, en negrita de
 * 12 px) y el relleno de la celda (32 px). La flecha de orden no suma: va en el relleno derecho de la celda. El ancho de una
 * columna nunca baja de eso.
 */
export function anchoDeColumna(etiqueta: string, anchoConfigurado: number | undefined): number {
  const minimo = etiqueta.length * 9 + 32;
  return Math.max(anchoConfigurado ?? ANCHO_COLUMNA_POR_DEFECTO, minimo);
}

/** Marca en el contenedor si queda contenido por desplazar a cada lado (`data-sombra-izq` / `data-sombra-der`). */
export function medirSombras(contenedor: HTMLElement): void {
  contenedor.dataset['sombraIzq'] = String(contenedor.scrollLeft > 1);
  contenedor.dataset['sombraDer'] = String(contenedor.scrollLeft + contenedor.clientWidth < contenedor.scrollWidth - 1);
}

/** Vuelve a medir las sombras cuando cambia el tamaño del contenedor o de su tabla (otras columnas, otras filas). */
export function observarSombras(contenedor: HTMLElement | undefined): ResizeObserver | null {
  if (!contenedor || typeof ResizeObserver === 'undefined') return null;
  const observador = new ResizeObserver(() => medirSombras(contenedor));
  observador.observe(contenedor);
  const tabla = contenedor.querySelector('table');
  if (tabla) observador.observe(tabla);
  medirSombras(contenedor);
  return observador;
}
