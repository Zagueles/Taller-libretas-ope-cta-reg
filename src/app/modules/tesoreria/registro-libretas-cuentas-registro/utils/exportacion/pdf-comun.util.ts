import { cargarToDataURL } from '../../../../../shared/utils/librerias-dinamicas.util';

export interface Logo {
  dataUrl: string;
  /** Ancho / alto del SVG original: el PNG que trae embebido es un recorte cuadrado de una hoja de íconos, pasarlo
   *  directo a `addImage` con un ancho y alto fijos lo deformaba; se dibuja primero en un `<canvas>` del tamaño real
   *  del SVG (donde el navegador ya resuelve el patrón/recorte) y de ahí sale la proporción correcta. */
  proporcion: number;
}

/** Logo SIAF·RP de las cabeceras del PDF (`assets/img/LogoSIAF.svg`), rasterizado una sola vez. */
let logoPromesa: Promise<Logo | null> | null = null;

export function cargarLogo(): Promise<Logo | null> {
  logoPromesa ??= new Promise<Logo | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const escala = 4;
      const ancho = img.naturalWidth || 105;
      const alto = img.naturalHeight || 28;
      const canvas = document.createElement('canvas');
      canvas.width = ancho * escala;
      canvas.height = alto * escala;
      const contexto = canvas.getContext('2d');
      if (!contexto) {
        resolve(null);
        return;
      }
      contexto.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({ dataUrl: canvas.toDataURL('image/png'), proporcion: ancho / alto });
    };
    img.onerror = () => resolve(null);
    img.src = 'assets/img/LogoSIAF.svg';
  });
  return logoPromesa;
}

/** QR de verificación del documento (Figma nodo 440:84666), con el enlace para comprobarlo. */
export async function cargarQr(contenido: string): Promise<string | null> {
  try {
    const toDataURL = await cargarToDataURL();
    return await toDataURL(contenido, { margin: 0, width: 240, color: { dark: '#202020', light: '#ffffff' } });
  } catch {
    return null;
  }
}

/** Sin tildes ni eñe: evita que cada lector decodifique los acentos con una página de códigos distinta (en el
 *  lector nativo de iPhone se veían como símbolos sueltos, aunque Google Lens sí los mostraba bien). */
export const sinTildes = (texto: string): string => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Texto plano del QR: para la trazabilidad, no un enlace, así se lee igual sin conexión al escanearlo.
 *  El guion de «000001-2026» se cambia por un punto: la cámara nativa de iPhone matchea «dígitos-dígitos» como
 *  teléfono y ofrece llamar en vez de mostrar el texto. */
export const textoTrazabilidadQr = (numeroDocumento: string, fechaHora: string): string =>
  sinTildes(
    [
      'REGISTRO DE OPERACIONES EN LAS LIBRETAS DE LAS CUENTAS DE REGISTRO',
      '',
      `NÚMERO DE DOCUMENTO: ${numeroDocumento.replace(/-/g, '.')}`,
      'ESTADO DEL DOCUMENTO: PROCESADO',
      `FECHA Y HORA: ${fechaHora}`,
    ].join('\n'),
  );

/** Lado del QR de verificación y aire que se le deja a su izquierda, en mm. */
export const ANCHO_QR = 24;

export const MARGEN_QR = 6;
