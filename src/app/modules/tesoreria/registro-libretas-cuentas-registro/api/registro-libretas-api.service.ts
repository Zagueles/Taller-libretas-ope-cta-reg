import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { MOVIMIENTOS_LIBRETA_REGISTRO, MovimientoLibretaRegistro } from '../models/registro-libretas.model';

/**
 * Solo la consulta de este proceso está armada; «Documentos y registros» y la solicitud todavía no tienen diseño.
 * Por eso los movimientos no pasan por el backend simulado (`mock-backend.interceptor.ts` + `mock-db.ts`) como en
 * `cuentas-bancarias`: cuando se sume el resto del proceso, esta consulta también deberá leer de `mock-db.ts`.
 */
@Injectable({ providedIn: 'root' })
export class RegistroLibretasApiService {
  listarMovimientos(): Observable<MovimientoLibretaRegistro[]> {
    return of(MOVIMIENTOS_LIBRETA_REGISTRO);
  }
}
