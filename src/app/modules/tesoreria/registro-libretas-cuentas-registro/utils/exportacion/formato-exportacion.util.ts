export const formatoMonto = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const monto = (valor: number): string => formatoMonto.format(valor);

export const fechaVisible = (iso: string): string => iso.slice(0, 10).split('-').reverse().join('/');

export const fechaHoraVisible = (iso: string): string => `${fechaVisible(iso)} ${iso.slice(11, 19)}`;

/** Fecha y hora de este instante (pie de página «Creado …»): cuándo se arma el PDF, no la fecha del registro. */
export const fechaHoraActual = (): string => {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}  ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
};

/** Descarga un Blob como archivo. */
export function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Revocar al instante cancela la descarga en algunos navegadores: se deja un momento.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
