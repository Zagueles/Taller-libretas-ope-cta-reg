import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../../../../core/config/app.config';
import { AprobacionConciliacion, ConciliacionManualDatos, ProcesamientoConciliacion, RegistroConciliado } from '../models/conciliacion-diaria.model';

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

  /** Aprueba el documento y los registros quedan conciliados; el procesamiento en los sistemas relacionados sigue en segundo plano. */
  aprobar(solicitudId: string): Observable<AprobacionConciliacion> {
    return this.http.post<AprobacionConciliacion>(`${this.base}/conciliaciones-manuales/${solicitudId}/aprobar`, {});
  }

  /** Cómo va la actualización de los sistemas relacionados tras la aprobación. */
  obtenerProcesamiento(solicitudId: string): Observable<ProcesamientoConciliacion> {
    return this.http.get<ProcesamientoConciliacion>(`${this.base}/conciliaciones-manuales/${solicitudId}/procesamiento`);
  }

  /** Los registros conciliados a mano (activos), de una cuenta o de todas. */
  listarRegistros(numeroCuenta?: string): Observable<RegistroConciliado[]> {
    const query = numeroCuenta ? `?cuenta=${encodeURIComponent(numeroCuenta)}` : '';
    return this.http.get<RegistroConciliado[]>(`${this.base}/conciliaciones-manuales/registros${query}`);
  }
}
