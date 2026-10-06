import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../../../../core/config/app.config';
import { ConciliacionManualDatos } from '../models/conciliacion-diaria.model';

/**
 * Endpoints propios de la conciliación manual diaria. En el taller los responde el backend simulado
 * (`src/app/mock/mock-backend.interceptor.ts`); con un backend real serían las mismas URLs.
 */
@Injectable({ providedIn: 'root' })
export class ConciliacionDiariaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.api.baseUrl;

  /** Guarda (o reemplaza) la cuenta y los registros conciliados de la solicitud. */
  guardarDetalle(solicitudId: string, datos: ConciliacionManualDatos): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/solicitudes/${solicitudId}/conciliacion-manual`, datos);
  }
}
