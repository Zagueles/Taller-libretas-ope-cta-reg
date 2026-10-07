import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../../../../core/config/app.config';
import {
  CuentaRegistroCatalogo,
  DetalleDocumentoLibreta,
  DetalleMovimientoLibreta,
  DocumentoLibreta,
  EstadoDocumentoLibreta,
  FiltrosMovimientos,
  MovimientoLibretaRegistro,
} from '../models/registro-libretas.model';

/**
 * Endpoints de «Registro de operaciones en las libretas de las cuentas de registro». En el taller los responde el
 * backend simulado (`src/app/mock/mock-backend.interceptor.ts`, reglas en `mock/libretas-backend.ts`); con un backend
 * real serían las mismas URLs. Los filtros de la consulta los resuelve el servidor.
 */
@Injectable({ providedIn: 'root' })
export class RegistroLibretasApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_CONFIG.api.baseUrl}/libretas`;

  /** Movimientos de la libreta que cumplen los filtros (sin filtros, todos: la pestaña Registros). */
  listarMovimientos(filtros: FiltrosMovimientos = {}): Observable<MovimientoLibretaRegistro[]> {
    let params = new HttpParams();
    const texto: [string, string | undefined][] = [['desde', filtros.desde], ['hasta', filtros.hasta]];
    const listas: [string, string[] | undefined][] = [
      ['cuentasBancarias', filtros.cuentasBancarias],
      ['tiposOperacion', filtros.tiposOperacion],
      ['entidades', filtros.entidades],
      ['unidadesEjecutoras', filtros.unidadesEjecutoras],
      ['beneficiarios', filtros.beneficiarios],
    ];
    for (const [clave, valor] of texto) if (valor) params = params.set(clave, valor);
    for (const [clave, valores] of listas) if (valores?.length) params = params.set(clave, valores.join(','));
    return this.http.get<MovimientoLibretaRegistro[]>(`${this.base}/movimientos`, { params });
  }

  /** Documentos que generó el sistema (pestaña Documentos). */
  listarDocumentos(filtros: { estado?: EstadoDocumentoLibreta; search?: string } = {}): Observable<DocumentoLibreta[]> {
    let params = new HttpParams();
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.search) params = params.set('search', filtros.search);
    return this.http.get<DocumentoLibreta[]>(`${this.base}/documentos`, { params });
  }

  obtenerDocumento(numero: string): Observable<DetalleDocumentoLibreta> {
    return this.http.get<DetalleDocumentoLibreta>(`${this.base}/documentos/${encodeURIComponent(numero)}`);
  }

  obtenerRegistro(sec: string): Observable<DetalleMovimientoLibreta> {
    return this.http.get<DetalleMovimientoLibreta>(`${this.base}/registros/${encodeURIComponent(sec)}`);
  }

  /** Cuentas de registro de la libreta: opciones del filtro predeterminado y cards del agregado. */
  listarCuentasRegistro(): Observable<CuentaRegistroCatalogo[]> {
    return this.http.get<CuentaRegistroCatalogo[]>(`${this.base}/cuentas-registro`);
  }
}
