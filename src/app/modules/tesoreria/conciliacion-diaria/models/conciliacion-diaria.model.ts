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

const dos = (n: number): string => String(n).padStart(2, '0');
const aTexto = (dia: Date): string => `${dos(dia.getDate())}/${dos(dia.getMonth() + 1)}/${dia.getFullYear()}`;

/**
 * Día de las operaciones de una conciliación creada el día `creacion`: siempre el anterior. La inconsistencia se procesa al
 * cierre del día y el usuario crea el ajuste de conciliación al día siguiente.
 */
export function diaDeOperacion(creacion: Date): Date {
  const dia = new Date(creacion);
  dia.setDate(dia.getDate() - 1);
  return dia;
}

/** «dd/mm/aaaa hh:mm:ss» de una operación del día anterior a `creacion`. */
export function fechaDeOperacion(creacion: Date, hora: string): string {
  return `${aTexto(diaDeOperacion(creacion))} ${hora}`;
}

/** Fecha en que se creó la conciliación manual aprobada de ejemplo (la que dio origen a los registros activos del taller). */
export const FECHA_CONCILIACION_APROBADA = '2026-08-18';

/**
 * Cuándo se elaboró, verificó y aprobó una solicitud de ejemplo creada el día `creada` (aaaa-mm-dd): el día, el siguiente y el
 * subsiguiente. Son las mismas fechas del historial que siembra el backend simulado y de la trazabilidad de sus registros.
 */
export function trazabilidadDeEjemplo(creada: string): { elaborado: string; verificado: string; aprobado: string } {
  const en = (horas: number, dias: number): string => {
    const fecha = new Date(`${creada}T00:00:00`);
    fecha.setDate(fecha.getDate() + dias);
    fecha.setHours(horas, 15 + dias * 7, 0, 0);
    return `${aTexto(fecha)} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}`;
  };
  return { elaborado: en(9, 0), verificado: en(10, 1), aprobado: en(11, 2) };
}

/** Los registros no conciliados de la jornada anterior a `creacion` (por defecto, hoy): lo que se ofrece para ajustar a mano. */
export function registrosNoConciliados(creacion: Date = new Date()): RegistroNoConciliado[] {
  const f = (hora: string): string => fechaDeOperacion(creacion, hora);
  return [
    { id: 'nc-4', nro: '4', lbFecha: f('10:40:04'), lbNumero: '02698154', lbDescripcion: DESCRIPCION, lbEntidad: 'SUNAT', lbDebito: '0.00', lbCredito: '1,267.00', rbFecha: '', rbNumero: '', rbDescripcion: '', rbDebito: '', rbCredito: '', motivo: 'No existe OBO' },
    { id: 'nc-3', nro: '3', lbFecha: f('10:10:08'), lbNumero: '02698150', lbDescripcion: DESCRIPCION, lbEntidad: 'SUNAT', lbDebito: '0.00', lbCredito: '5,068.80', rbFecha: f('10:10:08'), rbNumero: '02698150', rbDescripcion: DESCRIPCION, rbDebito: '0.00', rbCredito: '5,068.00', motivo: 'Montos diferentes' },
    { id: 'nc-2', nro: '2', lbFecha: f('10:05:06'), lbNumero: '02698148', lbDescripcion: DESCRIPCION, lbEntidad: 'SUNAT', lbDebito: '0.00', lbCredito: '31,245.00', rbFecha: '', rbNumero: '', rbDescripcion: '', rbDebito: '', rbCredito: '', motivo: 'No existe OBO' },
    { id: 'nc-1', nro: '1', lbFecha: '', lbNumero: '', lbDescripcion: '', lbEntidad: '', lbDebito: '', lbCredito: '', rbFecha: f('10:00:13'), rbNumero: '02698147', rbDescripcion: DESCRIPCION, rbDebito: '0.00', rbCredito: '9,753.00', motivo: 'No existe RR' },
  ];
}

/** Los de hoy: las operaciones son siempre de ayer. */
export const REGISTROS_NO_CONCILIADOS: RegistroNoConciliado[] = registrosNoConciliados();

/** Un registro que el creador ya concilió a mano: montos completos en ambas fuentes. */
export function conciliarRegistro(base: RegistroNoConciliado, credito: string): RegistroNoConciliado {
  const propio = base.lbNumero ? 'lb' : 'rb';
  return {
    ...base,
    lbFecha: base.lbFecha || base.rbFecha,
    lbNumero: base.lbNumero || base.rbNumero,
    lbDescripcion: base.lbDescripcion || base.rbDescripcion,
    lbEntidad: base.lbEntidad || 'SUNAT',
    lbDebito: base.lbDebito || '0.00',
    lbCredito: base.lbCredito || credito,
    rbFecha: base.rbFecha || base.lbFecha,
    rbNumero: base.rbNumero || base.lbNumero,
    rbDescripcion: base.rbDescripcion || base.lbDescripcion,
    rbDebito: base.rbDebito || '0.00',
    rbCredito: base.rbCredito || (propio === 'lb' ? base.lbCredito : credito),
    motivo: '-',
    conciliado: true,
    sustentos: [{ tipo: 'Constancia', nombre: `Constancia registro ${base.nro}.pdf` }],
    justificacion: 'La operación bancaria coincide con el registro del libro banco.',
  };
}

/** Una operación bancaria (o, en el origen contrario, un registro del libro banco) que se puede elegir para conciliar. */
export interface OperacionConciliable {
  id: string;
  fecha: string;
  numero: string;
  descripcion: string;
  debito: string;
  credito: string;
}

/** Operaciones disponibles en el panel «Seleccionar registro de operaciones bancarias» (Figma 461:28376): las de la jornada anterior a `creacion`. */
export function operacionesConciliables(creacion: Date = new Date()): OperacionConciliable[] {
  return [
    { id: 'op-02698150', fecha: fechaDeOperacion(creacion, '10:10:08'), numero: '02698150', descripcion: 'Reporte de Recaudación', debito: '0.00', credito: '5,068.00' },
    { id: 'op-02698147', fecha: fechaDeOperacion(creacion, '10:00:13'), numero: '02698147', descripcion: 'Reporte de Recaudación', debito: '0.00', credito: '9,753.00' },
  ];
}

export const OPERACIONES_CONCILIABLES: OperacionConciliable[] = operacionesConciliables();
