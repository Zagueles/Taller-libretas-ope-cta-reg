/** Modelo de la «Conciliación manual diaria» (SCMD): datos simulados del Figma 284:8135 y 284:8153. */

/** Código y nombre del tipo de documento (`/tipos-documento`). */
export const CODIGO_DOCUMENTO = 'SCMD';
export const NOMBRE_DOCUMENTO = 'Conciliación manual diaria';


export interface CuentaBancariaConciliacion {
  numeroCuenta: string;
  denominacion: string;
  moneda: 'PEN' | 'USD';
  entidadFinanciera: string;
}

export const CUENTAS_CONCILIACION: CuentaBancariaConciliacion[] = [
  { numeroCuenta: '11040103570200000000', denominacion: 'MEF - DGTP - CUT', moneda: 'PEN', entidadFinanciera: 'Banco Central de Reserva del Perú' },
  { numeroCuenta: '0214039323444348812', denominacion: 'MEF - DGTP', moneda: 'USD', entidadFinanciera: 'Banco Central de Reserva del Perú' },
  { numeroCuenta: '0124034993444340012', denominacion: 'MEF - DGTP - CUT', moneda: 'PEN', entidadFinanciera: 'Banco Central de Reserva del Perú' },
  { numeroCuenta: '0144034397124343998', denominacion: 'MEF - DGTP - CUT', moneda: 'PEN', entidadFinanciera: 'Banco Central de Reserva del Perú' },
  { numeroCuenta: '0294039987124343901', denominacion: 'MEF - DGTP', moneda: 'USD', entidadFinanciera: 'Banco Central de Reserva del Perú' },
  { numeroCuenta: '0199834993454240015', denominacion: 'MEF - DGTP - CUT', moneda: 'PEN', entidadFinanciera: 'Banco Central de Reserva del Perú' },
];

/** Un registro que no concilió: lo del libro banco frente a lo del registro de operaciones bancarias (vacío si no existe). */
export interface RegistroNoConciliado {
  id: string;
  nro: string;
  lbFecha: string;
  lbNumero: string;
  lbDescripcion: string;
  lbEntidad: string;
  lbDebito: string;
  lbCredito: string;
  rbFecha: string;
  rbNumero: string;
  rbDescripcion: string;
  rbDebito: string;
  rbCredito: string;
  motivo: string;
  /** Queda en `true` cuando el creador completa el registro y concilia. */
  conciliado?: boolean;
  /** Documentos de sustento que el creador adjunta al conciliar el registro (el taller guarda solo el nombre del archivo). */
  sustentos?: SustentoRegistro[];
  justificacion?: string;
}

/** Un documento de sustento del registro, con su tipo («Constancia», «Captura de pantalla»…). */
export interface SustentoRegistro {
  tipo: string;
  nombre: string;
  /** Tamaño en bytes (solo se conoce de los archivos cargados en esta sesión). */
  tamano?: number;
}

export const TIPOS_DOCUMENTO_SUSTENTO = ['Constancia', 'Captura de pantalla', 'Correo electrónico', 'Oficio', 'Otro'];

/** Lo que guarda la solicitud: la cuenta elegida y los registros que se concilian a mano. */
export interface ConciliacionManualDatos {
  numeroCuenta: string;
  registros: RegistroNoConciliado[];
}

/** Un registro está listo para elaborar cuando concilió, tiene débito y crédito en ambas fuentes y al menos un documento de sustento y su justificación. */
export function registroCompleto(r: RegistroNoConciliado): boolean {
  const monto = (v: string): boolean => v.trim() !== '' && Number.isFinite(Number(v.replace(/,/g, '')));
  return (
    !!r.conciliado &&
    monto(r.lbDebito) &&
    monto(r.lbCredito) &&
    monto(r.rbDebito) &&
    monto(r.rbCredito) &&
    !!r.sustentos?.length &&
    (r.justificacion ?? '').trim().length >= 3
  );
}

const DESCRIPCION = 'Reporte de Recaudación';

export const REGISTROS_NO_CONCILIADOS: RegistroNoConciliado[] = [
  { id: 'nc-4', nro: '4', lbFecha: '01/12/2025 10:40:04', lbNumero: '02698154', lbDescripcion: DESCRIPCION, lbEntidad: 'SUNAT', lbDebito: '0.00', lbCredito: '1,267.00', rbFecha: '', rbNumero: '', rbDescripcion: '', rbDebito: '', rbCredito: '', motivo: 'No existe OBO' },
  { id: 'nc-3', nro: '3', lbFecha: '01/12/2025 10:10:08', lbNumero: '02698150', lbDescripcion: DESCRIPCION, lbEntidad: 'SUNAT', lbDebito: '0.00', lbCredito: '5,068.80', rbFecha: '01/12/2025 10:10:08', rbNumero: '02698150', rbDescripcion: DESCRIPCION, rbDebito: '0.00', rbCredito: '5,068.00', motivo: 'Montos diferentes' },
  { id: 'nc-2', nro: '2', lbFecha: '01/12/2025 10:05:06', lbNumero: '02698148', lbDescripcion: DESCRIPCION, lbEntidad: 'SUNAT', lbDebito: '0.00', lbCredito: '31,245.00', rbFecha: '', rbNumero: '', rbDescripcion: '', rbDebito: '', rbCredito: '', motivo: 'No existe OBO' },
  { id: 'nc-1', nro: '1', lbFecha: '', lbNumero: '', lbDescripcion: '', lbEntidad: '', lbDebito: '', lbCredito: '', rbFecha: '01/12/2025 10:00:13', rbNumero: '02698147', rbDescripcion: DESCRIPCION, rbDebito: '0.00', rbCredito: '9,753.00', motivo: 'No existe RR' },
];
