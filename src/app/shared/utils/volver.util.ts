import type { Location } from '@angular/common';
import type { Router } from '@angular/router';

/**
 * «Regresar» de una pantalla de detalle: vuelve a la pantalla desde la que se entró (el paso previo del historial,
 * con su pestaña); si la pantalla se abrió directo (enlace, pestaña nueva) no hay paso previo en la app y en vez de
 * salirse del sitio lleva a `rutaAlterna`.
 */
export function volverAlOrigen(location: Location, router: Router, rutaAlterna: string): void {
  const estado = window.history.state as { navigationId?: number } | null;
  if (typeof estado?.navigationId === 'number' && estado.navigationId > 1) {
    location.back();
    return;
  }
  void router.navigateByUrl(rutaAlterna);
}
