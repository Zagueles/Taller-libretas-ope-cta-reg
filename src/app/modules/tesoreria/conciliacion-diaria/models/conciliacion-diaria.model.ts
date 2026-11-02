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
  /** Los registros del libro banco (RR) y de operaciones bancarias que concilian este registro: uno por lado, o varios en un grupo. */
  lbLineas?: LineaConciliacion[];
  rbLineas?: LineaConciliacion[];
  /** Bitácora: cada campo corregido con su valor anterior y el nuevo. */
  ediciones?: EdicionRegistro[];
  /** En una modificación: el registro conciliado ya se corrigió (sin cambios no se puede verificar). */
  modificado?: boolean;
}

/** Los campos de una línea que el usuario puede corregir en el formulario. */
export interface DatosLinea {
  fecha: string;
  numero: string;
  descripcion: string;
  entidad: string;
  debito: string;
  credito: string;
  secuencia: string;
}

/** Un registro de una de las dos fuentes dentro de la conciliación; `original` guarda lo que traía para marcar lo editado. */
export interface LineaConciliacion extends DatosLinea {
  id: string;
  original: DatosLinea;
}

/** Un campo corregido en la conciliación: qué registro, qué campo, el valor anterior y el nuevo. */
export interface EdicionRegistro {
  lado: 'Libro banco' | 'Operaciones bancarias';
  numero: string;
  campo: string;
  antes: string;
  despues: string;
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
  /** Solo en una modificación: qué se corrige de los registros conciliados. */
  tipoModificacion?: TipoModificacion;
}

/** Qué corrige una modificación: los datos del registro (fecha, número, descripción, entidad, secuencia) o sus montos (débito y crédito). */
export type TipoModificacion = 'Datos' | 'Montos';
export const TIPOS_MODIFICACION: TipoModificacion[] = ['Datos', 'Montos'];

/** Los campos de una línea que se pueden editar según el tipo de modificación; en una creación, todos. */
export function camposEditables(tipo: TipoModificacion | null | undefined): (keyof DatosLinea)[] {
  if (tipo === 'Datos') return ['fecha', 'numero', 'descripcion', 'entidad', 'secuencia'];
  if (tipo === 'Montos') return ['debito', 'credito'];
  return ['fecha', 'numero', 'descripcion', 'entidad', 'debito', 'credito', 'secuencia'];
}

/** Un documento de la vida de un registro conciliado: el que lo creó y los que lo modificaron. */
/** Los datos del registro tal como los dejó un documento al aprobarse: lo que se ve al elegir esa versión en su historial. */
export type DatosDeRegistro = Pick<
  RegistroNoConciliado,
  'lbFecha' | 'lbNumero' | 'lbDescripcion' | 'lbEntidad' | 'lbDebito' | 'lbCredito' | 'rbFecha' | 'rbNumero' | 'rbDescripcion' | 'rbDebito' | 'rbCredito' | 'lbLineas' | 'rbLineas'
>;

export const datosDeRegistro = (r: RegistroNoConciliado): DatosDeRegistro => ({
  lbFecha: r.lbFecha, lbNumero: r.lbNumero, lbDescripcion: r.lbDescripcion, lbEntidad: r.lbEntidad, lbDebito: r.lbDebito, lbCredito: r.lbCredito,
  rbFecha: r.rbFecha, rbNumero: r.rbNumero, rbDescripcion: r.rbDescripcion, rbDebito: r.rbDebito, rbCredito: r.rbCredito,
  lbLineas: r.lbLineas, rbLineas: r.rbLineas,
});

export interface DocumentoDeRegistro {
  documentoId: string;
  numero: string;
  tipoAccion: 'Creación' | 'Modificación';
  tipoModificacion?: TipoModificacion;
  /** Quién elaboró, verificó y aprobó el documento y cuándo (ISO); la fecha de la aprobación es la del documento en la vida del registro. */
  elaboradoPor: string;
  elaboradoFecha: string;
  verificadoPor: string;
  verificadoFecha: string;
  aprobadoPor: string;
  aprobadoFecha: string;
  /** Cómo quedó el registro al aprobarse este documento: la creación guarda lo conciliado; la modificación, lo corregido. */
  datos: DatosDeRegistro;
  ediciones?: EdicionRegistro[];
  /** El sustento y la justificación de ese documento. */
  sustentos?: SustentoRegistro[];
  justificacion?: string;
}

/** Un registro conciliado a mano (activo), con los documentos que lo crearon y modificaron: es lo que lista la pestaña Registros. */
export interface RegistroConciliado extends RegistroNoConciliado {
  numeroCuenta: string;
  documentos: DocumentoDeRegistro[];
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

/**
 * Un registro que el creador ya concilió a mano: ambas fuentes con el mismo monto. Si la otra fuente traía un monto
 * distinto («Montos diferentes»), se corrige y queda en la bitácora. El motivo de inconsistencia se conserva hasta que el
 * documento se aprueba (`aprobado`): entonces pasa a «-».
 */
export function conciliarRegistro(base: RegistroNoConciliado, credito: string, aprobado = false): RegistroNoConciliado {
  const origenLB = !!base.lbNumero;
  const debitoFinal = (origenLB ? base.lbDebito : base.rbDebito) || '0.00';
  const creditoFinal = (origenLB ? base.lbCredito : base.rbCredito) || credito;
  const fecha = base.lbFecha || base.rbFecha;
  const numero = base.lbNumero || base.rbNumero;
  const descripcion = base.lbDescripcion || base.rbDescripcion;
  const ediciones: EdicionRegistro[] = [];
  const otroCredito = origenLB ? base.rbCredito : base.lbCredito;
  if (otroCredito && otroCredito !== creditoFinal) {
    ediciones.push({ lado: origenLB ? 'Operaciones bancarias' : 'Libro banco', numero, campo: 'Crédito', antes: otroCredito, despues: creditoFinal });
  }
  return {
    ...base,
    lbFecha: fecha,
    lbNumero: numero,
    lbDescripcion: descripcion,
    lbEntidad: base.lbEntidad || 'SUNAT',
    lbDebito: debitoFinal,
    lbCredito: creditoFinal,
    rbFecha: base.rbFecha || fecha,
    rbNumero: base.rbNumero || numero,
    rbDescripcion: base.rbDescripcion || descripcion,
    rbDebito: debitoFinal,
    rbCredito: creditoFinal,
    motivo: aprobado ? '-' : base.motivo,
    conciliado: true,
    sustentos: [{ tipo: 'Constancia', nombre: `Constancia registro ${base.nro}.pdf` }],
    justificacion: 'La operación bancaria coincide con el registro del libro banco.',
    ...(ediciones.length ? { ediciones } : {}),
  };
}

/** Un registro que se puede elegir para conciliar: una operación bancaria o, en el lado contrario, un RR del libro banco. */
export interface OperacionConciliable {
  id: string;
  fecha: string;
  numero: string;
  descripcion: string;
  debito: string;
  credito: string;
  entidad?: string;
}

/**
 * Operaciones del panel «Seleccionar registro de operaciones bancarias» (Figma 461:28376), las de la jornada anterior a
 * `creacion`: una con el número mal informado (caso 2) y tres que, juntas, cubren dos RR con números distintos (caso 3).
 */
export function operacionesConciliables(creacion: Date = new Date()): OperacionConciliable[] {
  const op = (id: string, hora: string, numero: string, credito: string): OperacionConciliable => ({ id, fecha: fechaDeOperacion(creacion, hora), numero, descripcion: DESCRIPCION, debito: '0.00', credito });
  return [
    op('op-02698145', '10:40:04', '02698145', '1,267.00'),
    op('op-02698148-a', '10:05:06', '02698148', '20,000.00'),
    op('op-02698148-b', '10:05:07', '02698148', '8,000.00'),
    op('op-02698157', '10:05:08', '02698157', '6,490.00'),
  ];
}

export const OPERACIONES_CONCILIABLES: OperacionConciliable[] = operacionesConciliables();

/** RR del libro banco que se pueden elegir cuando el registro nace de una operación bancaria: uno con la fecha de un día antes (caso 2) y otro para el grupo (caso 3). */
export function libroBancoConciliable(creacion: Date = new Date()): OperacionConciliable[] {
  const antes = new Date(creacion);
  antes.setDate(antes.getDate() - 1);
  const rr = (id: string, creada: Date, hora: string, numero: string, credito: string): OperacionConciliable => ({ id, fecha: fechaDeOperacion(creada, hora), numero, descripcion: DESCRIPCION, debito: '0.00', credito, entidad: 'SUNAT' });
  return [rr('rr-02698147', antes, '10:00:13', '02698147', '9,753.00'), rr('rr-02698149', creacion, '10:20:00', '02698149', '3,245.00')];
}

export const LIBRO_BANCO_CONCILIABLE: OperacionConciliable[] = libroBancoConciliable();

/** Un documento aprobado de creación o modificación, tal como queda en la vida del registro. */
export type DocumentoAprobado = Pick<DocumentoDeRegistro, 'documentoId' | 'numero' | 'elaboradoPor' | 'elaboradoFecha' | 'verificadoPor' | 'verificadoFecha' | 'aprobadoPor' | 'aprobadoFecha'> & { numeroCuenta: string };

/** «dd/mm/aaaa hh:mm:ss» de una fecha ISO. */
export function fechaHoraTexto(iso: string): string {
  const d = new Date(iso);
  return `${aTexto(d)} ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}

const documentoDe = ({ numeroCuenta: _cuenta, ...doc }: DocumentoAprobado): Omit<DocumentoDeRegistro, 'tipoAccion' | 'datos'> => doc;

/** Al aprobar una creación: el registro conciliado pasa a Registros con su primer documento. */
export function registroConciliadoDeCreacion(r: RegistroNoConciliado, doc: DocumentoAprobado): RegistroConciliado {
  const { modificado: _modificado, ...registro } = r;
  return {
    ...registro,
    id: `rc-${doc.documentoId}-${r.id}`,
    motivo: '-',
    numeroCuenta: doc.numeroCuenta,
    documentos: [{ ...documentoDe(doc), tipoAccion: 'Creación', datos: datosDeRegistro(r), ediciones: r.ediciones, sustentos: r.sustentos, justificacion: r.justificacion }],
  };
}

/** Al aprobar una modificación: el registro toma sus datos nuevos y su historial suma el documento de modificación (trazabilidad). */
export function aplicarModificacion(actual: RegistroConciliado, modificado: RegistroNoConciliado, tipo: TipoModificacion, doc: DocumentoAprobado): RegistroConciliado {
  return {
    ...actual,
    lbFecha: modificado.lbFecha,
    lbNumero: modificado.lbNumero,
    lbDescripcion: modificado.lbDescripcion,
    lbEntidad: modificado.lbEntidad,
    lbDebito: modificado.lbDebito,
    lbCredito: modificado.lbCredito,
    rbFecha: modificado.rbFecha,
    rbNumero: modificado.rbNumero,
    rbDescripcion: modificado.rbDescripcion,
    rbDebito: modificado.rbDebito,
    rbCredito: modificado.rbCredito,
    lbLineas: modificado.lbLineas,
    rbLineas: modificado.rbLineas,
    ediciones: [...(actual.ediciones ?? []), ...(modificado.ediciones ?? [])],
    documentos: [
      ...actual.documentos,
      { ...documentoDe(doc), tipoAccion: 'Modificación', tipoModificacion: tipo, datos: datosDeRegistro(modificado), ediciones: modificado.ediciones, sustentos: modificado.sustentos, justificacion: modificado.justificacion },
    ],
  };
}

// ─── Procesamiento posterior a la aprobación ─────────────────────────

/** El estado del documento (Aprobado) y el del procesamiento son datos distintos: una falla externa no reabre el documento. */
export type EstadoProcesamiento = 'EN_PROCESO' | 'APLICADO' | 'CON_INCIDENCIAS';

export interface SistemaConError {
  codigo: string;
  nombre: string;
}

/** `GET /conciliaciones-manuales/{id}/procesamiento`. */
export interface ProcesamientoConciliacion {
  estado: EstadoProcesamiento;
  actualizadoEn: string;
  sistemasConError: SistemaConError[];
  reintentosAgotados: boolean;
}

/** `POST /conciliaciones-manuales/{id}/aprobar`. */
export interface AprobacionConciliacion {
  estadoDocumento: 'APROBADO';
  procesamiento: EstadoProcesamiento;
}

/** Los sistemas de un error en lenguaje corrido: «Contabilidad» o «Libretas y Contabilidad». */
export function listaDeSistemas(sistemas: SistemaConError[]): string {
  const nombres = sistemas.map((x) => x.nombre);
  return nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}` : (nombres[0] ?? '');
}

/** Cómo se avisa que el procesamiento falló: «No se pudo actualizar Contabilidad» o «No se pudo actualizar 2 sistemas: Libretas y Contabilidad.». */
export function tituloDeIncidencia(sistemas: SistemaConError[]): string {
  return sistemas.length > 1 ? `No se pudo actualizar ${sistemas.length} sistemas: ${listaDeSistemas(sistemas)}.` : `No se pudo actualizar ${listaDeSistemas(sistemas)}`;
}

/** El banner que va bajo la cabecera del documento aprobado; sin procesamiento, no hay banner. */
export interface BannerProcesamiento {
  tono: 'info' | 'success' | 'error';
  titulo: string;
  mensaje: string;
  /** En proceso o con error no se cierra; el aplicado, sí. */
  cerrable: boolean;
}

export function bannerDeProcesamiento(p: ProcesamientoConciliacion | null, numero: string): BannerProcesamiento | null {
  if (!p) return null;
  switch (p.estado) {
    case 'EN_PROCESO':
      return { tono: 'info', cerrable: false, titulo: 'Procesando la conciliación', mensaje: 'Se están actualizando los sistemas relacionados. Puedes salir de esta pantalla; te avisaremos al terminar.' };
    case 'APLICADO':
      return { tono: 'success', cerrable: true, titulo: 'Conciliación aplicada', mensaje: 'Los sistemas relacionados se actualizaron correctamente.' };
    case 'CON_INCIDENCIAS':
      return {
        tono: 'error',
        cerrable: false,
        titulo: tituloDeIncidencia(p.sistemasConError),
        mensaje: p.reintentosAgotados
          ? `El documento sigue aprobado. Comunícate con la mesa de ayuda e indica el documento ${numero}.`
          : 'El documento sigue aprobado. El sistema volverá a intentarlo automáticamente.',
      };
  }
}

