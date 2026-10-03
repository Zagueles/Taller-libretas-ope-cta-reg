import type { QueryReportParameters } from '../../../../shared/types/query-report.types';
import { CUENTAS_BANCARIAS_INFO, MOVIMIENTOS_LIBRETA_REGISTRO, MovimientoLibretaRegistro, nombreBeneficiario, nombreTipoOperacion } from '../models/registro-libretas.model';
import { construirDetalleRegistro, DetalleRegistro } from './registro-libretas-detalle.util';

const formatoMonto = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monto = (valor: number): string => formatoMonto.format(valor);
const fechaVisible = (iso: string): string => iso.slice(0, 10).split('-').reverse().join('/');
const fechaHoraVisible = (iso: string): string => `${fechaVisible(iso)} ${iso.slice(11, 19)}`;

/** Fecha y hora de este instante (pie de página «Creado …»): cuándo se arma el PDF, no la fecha del registro. */
const fechaHoraActual = (): string => {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}  ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
};

/** Descarga un Blob como archivo. */
function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/** Una cuenta bancaria consultada, con los movimientos ya filtrados que le tocan (Figma nodo «reporte detallado»). */
export interface CuentaConsultaExcel {
  id: string;
  movimientos: MovimientoLibretaRegistro[];
}

const AZUL = 'FF014899';
const CELESTE = 'FFDDEBF7';
const GRIS = 'FFF2F2F2';
const BLANCO = 'FFFFFFFF';
const NEGRO = 'FF000000';
const BORDE_FINO = { style: 'thin' as const, color: { argb: NEGRO } };
const BORDES = { top: BORDE_FINO, bottom: BORDE_FINO, left: BORDE_FINO, right: BORDE_FINO };
const relleno = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });

/** Anchos de columna de la plantilla «reporte detallado» (hoja Resultado), de la A en adelante. */
const ANCHOS_PEN = [17.5, 15.5, 12.5, 33.5, 37.8, 44.5, 28.8, 23.3, 16.5, 23.3, 23.5, 19.5, 19.5, 19.5, 16.5, 16, 49];
const ANCHOS_USD = [17.5, 15.5, 12.5, 33.5, 46.2, 44.5, 28.8, 23.3, 16.5, 23.3, 23.5, 25.7, 14.7, 12.8, 19.5, 19.5, 19.5, 19.5, 19.5, 19.5, 14.5, 16.5, 16, 49.5];

/** Tipo de cambio de ejemplo (el de la plantilla): la conversión a moneda nacional usa el de compra. */
const TIPO_CAMBIO_COMPRA = 3.35;
const TIPO_CAMBIO_VENTA = 3.32;

/** La plantilla escribe el nombre de la cuenta sin espacios alrededor de los guiones: «MEF-DGTP-CUT». */
const nombreCuentaExcel = (nombre: string): string => nombre.replace(/ - /g, '-');
const etiquetaCuenta = (c?: { nombre: string; numeroCuenta: string; moneda: string }): string =>
  c ? `${nombreCuentaExcel(c.nombre)} - ${c.numeroCuenta} - ${c.moneda}` : '';

/** Cabecera azul de dos filas (grupo + sub-encabezado): blanca, 14 pt en negrita, centrada y con borde fino. */
function estiloEncabezado(celda: { fill: unknown; font: unknown; alignment: unknown; border: unknown }): void {
  celda.fill = relleno(AZUL);
  celda.font = { name: 'Calibri', bold: true, size: 14, color: { argb: BLANCO } };
  celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  celda.border = BORDES;
}

const aFecha = (iso: string): Date | string => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : '';
};

/** Nota del recuadro «Importante» del Resumen (igual en el reporte detallado, agrupado y agregado). */
const NOTA_RESUMEN =
  'El resumen muestra las cuentas bancarias consultadas y su relación con entidades, unidades ejecutoras y beneficiarios.\n' +
  'Cada pestaña de resultado contiene el detalle correspondiente a una cuenta bancaria del resumen.';

/** Columnas (1 = A) donde el Resumen coloca NIVEL 1, 2, 3… del agrupado o agregado, como la plantilla (B, E, K). */
const COLUMNAS_NIVEL = [2, 5, 11, 14, 17, 20, 23];

/** El agrupado o agregado aplicado en pantalla: cómo se estructura cada «Resultado N» del Excel. */
export interface AgrupacionExcel {
  tipo: 'agrupado' | 'agregado';
  /** Niveles de anidado, de afuera hacia adentro (el primero es la «Entidad», por ejemplo). */
  niveles: { key: string; label: string; labelPrefix?: string; subtitleColumn?: string }[];
  /** Columnas que la tabla oculta con esos niveles (las de cada nivel y, con «Agregado», las de cada movimiento). */
  columnasOcultas: string[];
  /** Grupos de cabecera ocultos: si «Cuenta de registro» lo está, «FF/SUB FF» queda como columna suelta. */
  gruposOcultos: string[];
}

interface ColumnaAgrupada {
  key: string;
  grupo?: string;
  rotulo: string;
  ancho: number;
  alinea: 'center' | 'left' | 'right';
  /** Solo la cuenta en dólares. */
  soloDolares?: boolean;
}

/** Todas las columnas del reporte, en el orden de la plantilla; cada agrupación quita las suyas. */
const COLUMNAS_AGRUPADAS: ColumnaAgrupada[] = [
  { key: 'sec', grupo: 'ACREDITACIÓN', rotulo: 'SECUENCIA', ancho: 15, alinea: 'center' },
  { key: 'fecha', grupo: 'ACREDITACIÓN', rotulo: 'FECHA', ancho: 22, alinea: 'left' },
  { key: 'beneficiarioCodigo', grupo: 'BENEFICIARIO', rotulo: 'CÓDIGO', ancho: 12.5, alinea: 'center' },
  { key: 'beneficiario', grupo: 'BENEFICIARIO', rotulo: 'DESCRIPCIÓN', ancho: 36, alinea: 'left' },
  { key: 'numeroCuentaRegistro', grupo: 'CUENTA DE REGISTRO', rotulo: 'NÚMERO', ancho: 37, alinea: 'left' },
  { key: 'descripcionCuentaRegistro', grupo: 'CUENTA DE REGISTRO', rotulo: 'DESCRIPCIÓN', ancho: 44.5, alinea: 'left' },
  { key: 'ffSubFf', grupo: 'CUENTA DE REGISTRO', rotulo: 'FF/SUB FF', ancho: 34, alinea: 'left' },
  { key: 'tipoOperacion', rotulo: 'TIPO DE OPERACIÓN', ancho: 28, alinea: 'left' },
  { key: 'entidad', grupo: 'ÁMBITO INSTITUCIONAL', rotulo: 'ENTIDAD', ancho: 16.5, alinea: 'left' },
  { key: 'unidadEjecutora', grupo: 'ÁMBITO INSTITUCIONAL', rotulo: 'UNIDAD EJECUTORA', ancho: 26, alinea: 'left' },
  { key: 'grupo', grupo: 'ÁMBITO INSTITUCIONAL', rotulo: 'GRUPO', ancho: 23.5, alinea: 'left' },
  { key: 'tipoCotizacion', grupo: 'TIPO DE CAMBIO', rotulo: 'TIPO DE COTIZACIÓN', ancho: 24, alinea: 'left', soloDolares: true },
  { key: 'tipoCambioCompra', grupo: 'TIPO DE CAMBIO', rotulo: 'COMPRA', ancho: 13, alinea: 'left', soloDolares: true },
  { key: 'tipoCambioVenta', grupo: 'TIPO DE CAMBIO', rotulo: 'VENTA', ancho: 13, alinea: 'left', soloDolares: true },
  { key: 'saldoInicial', grupo: 'IMPORTE EN MONEDA DE LA CUENTA', rotulo: 'SALDO INICIAL', ancho: 19.5, alinea: 'right' },
  { key: 'debito', grupo: 'IMPORTE EN MONEDA DE LA CUENTA', rotulo: 'DÉBITO', ancho: 19.5, alinea: 'right' },
  { key: 'credito', grupo: 'IMPORTE EN MONEDA DE LA CUENTA', rotulo: 'CRÉDITO', ancho: 19.5, alinea: 'right' },
  { key: 'saldoFinal', grupo: 'IMPORTE EN MONEDA DE LA CUENTA', rotulo: 'SALDO FINAL', ancho: 19.5, alinea: 'right' },
  { key: 'saldoInicialMN', grupo: 'IMPORTE EN MONEDA NACIONAL', rotulo: 'SALDO INICIAL', ancho: 19.5, alinea: 'right', soloDolares: true },
  { key: 'debitoMN', grupo: 'IMPORTE EN MONEDA NACIONAL', rotulo: 'DÉBITO', ancho: 19.5, alinea: 'right', soloDolares: true },
  { key: 'creditoMN', grupo: 'IMPORTE EN MONEDA NACIONAL', rotulo: 'CRÉDITO', ancho: 19.5, alinea: 'right', soloDolares: true },
  { key: 'saldoFinalMN', grupo: 'IMPORTE EN MONEDA NACIONAL', rotulo: 'SALDO FINAL', ancho: 19.5, alinea: 'right', soloDolares: true },
  { key: 'numeroDocumento', grupo: 'DOCUMENTO', rotulo: 'NÚMERO', ancho: 16, alinea: 'right' },
  { key: 'descripcionDocumento', grupo: 'DOCUMENTO', rotulo: 'DESCRIPCIÓN', ancho: 49, alinea: 'left' },
];

const CLAVES_IMPORTE = new Set(['saldoInicial', 'debito', 'credito', 'saldoFinal', 'saldoInicialMN', 'debitoMN', 'creditoMN', 'saldoFinalMN']);
const GRIS_SUBTOTAL = 'FFE7E6E6';

/** Los valores que pueden ser nivel (y las columnas), por movimiento. Los importes en moneda nacional son importe × compra. */
function valoresMovimiento(m: MovimientoLibretaRegistro, enDolares: boolean): Record<string, string | number> {
  const compra = enDolares ? TIPO_CAMBIO_COMPRA : 1;
  return {
    sec: m.sec,
    fecha: fechaHoraVisible(m.fecha),
    fechaAcreditacion: fechaVisible(m.fecha),
    beneficiarioCodigo: m.beneficiarioCodigo,
    beneficiario: nombreBeneficiario(m.beneficiarioCodigo).toUpperCase(),
    numeroCuentaRegistro: m.numeroCuentaRegistro,
    descripcionCuentaRegistro: m.descripcionCuentaRegistro,
    cuentaRegistroResumen: `CR: ${m.numeroCuentaRegistro} - ${m.descripcionCuentaRegistro}`,
    ffSubFf: m.ffSubFf,
    tipoOperacion: nombreTipoOperacion(m.tipoOperacionCodigo),
    entidad: m.entidad,
    unidadEjecutora: m.unidadEjecutora,
    grupo: m.grupo,
    tipoCotizacion: '1. Compra / Venta',
    tipoCambioCompra: enDolares ? TIPO_CAMBIO_COMPRA : '-',
    tipoCambioVenta: enDolares ? TIPO_CAMBIO_VENTA : '-',
    saldoInicial: m.saldoInicial,
    debito: m.debito,
    credito: m.credito,
    saldoFinal: m.saldoFinal,
    saldoInicialMN: m.saldoInicial * compra,
    debitoMN: m.debito * compra,
    creditoMN: m.credito * compra,
    saldoFinalMN: m.saldoFinal * compra,
    numeroDocumento: m.numeroDocumento,
    descripcionDocumento: m.descripcionDocumento,
  };
}

/** El texto del nivel: «Ent.: MEF»; el FF/Sub FF va sin su código, como la plantilla («FF/Sub FF: Recursos Ordinarios»). */
const textoNivel = (key: string, valor: string): string => (key === 'ffSubFf' ? valor.replace(/^\d+(\.\d+)?\s+/, '') : valor);
const prefijoNivel = (n: AgrupacionExcel['niveles'][number]): string => (n.key === 'ffSubFf' ? 'FF/Sub FF' : (n.labelPrefix ?? n.label));
const cantidadRegistros = (n: number): string => `${n} ${n === 1 ? 'Registro' : 'Registros'}`;

/**
 * Cuerpo de un «Resultado N» con agrupado o agregado (plantillas «reporte agrupado» y «reporte agregado»): la misma
 * cabecera azul de dos filas pero solo con las columnas que la agrupación deja visibles, y los movimientos anidados
 * por nivel — cada grupo con su título («Ent.: MEF (2 Registros)»; el más interno trae además el saldo inicial y
 * final del grupo) y, al cerrar cada grupo menos el más interno, su «Subtotal» o «TOTAL» (el del primer nivel).
 */
function hojaAgrupada(
  hoja: import('exceljs').Worksheet,
  movimientos: MovimientoLibretaRegistro[],
  enDolares: boolean,
  agrupacion: AgrupacionExcel,
): void {
  const ocultas = new Set(agrupacion.columnasOcultas);
  const gruposOcultos = new Set(agrupacion.gruposOcultos.map((g) => g.toUpperCase()));
  const columnas = COLUMNAS_AGRUPADAS.filter((c) => !ocultas.has(c.key) && (!c.soloDolares || enDolares)).map((c) => ({
    ...c,
    // Sin su grupo de cabecera, la columna ocupa las dos filas (FF/SUB FF cuando «Cuenta de registro» queda oculta).
    grupo: c.grupo && !gruposOcultos.has(c.grupo) ? c.grupo : undefined,
  }));
  const total = columnas.length;
  const indice = (key: string): number => columnas.findIndex((c) => c.key === key) + 1;
  const letra = (c: number): string => String.fromCharCode(64 + c);
  columnas.forEach((c, i) => (hoja.getColumn(i + 1).width = c.ancho));

  // Cabecera de dos filas: los grupos contiguos se combinan y las columnas sin grupo ocupan las dos filas.
  const filaGrupo = 6;
  hoja.getRow(filaGrupo).height = 36;
  hoja.getRow(filaGrupo + 1).height = 36;
  for (let i = 0; i < total; ) {
    const c = columnas[i];
    let fin = i;
    if (c.grupo) while (fin + 1 < total && columnas[fin + 1].grupo === c.grupo) fin++;
    for (let k = i; k <= fin; k++) for (const f of [filaGrupo, filaGrupo + 1]) estiloEncabezado(hoja.getCell(f, k + 1));
    if (!c.grupo) {
      hoja.mergeCells(filaGrupo, i + 1, filaGrupo + 1, i + 1);
      hoja.getCell(filaGrupo, i + 1).value = c.rotulo;
    } else {
      if (fin > i) hoja.mergeCells(filaGrupo, i + 1, filaGrupo, fin + 1);
      hoja.getCell(filaGrupo, i + 1).value = c.grupo;
      for (let k = i; k <= fin; k++) hoja.getCell(filaGrupo + 1, k + 1).value = columnas[k].rotulo;
    }
    i = fin + 1;
  }

  const primerImporte = Math.min(...['saldoInicial', 'saldoInicialMN'].map(indice).filter((n) => n > 0));
  const colCompra = indice('tipoCambioCompra');
  const niveles = agrupacion.niveles;
  let f = filaGrupo + 2;

  // Niveles nativos de Excel (botones +/− del margen): el resumen de cada grupo va arriba y los movimientos quedan
  // en el nivel más profundo, como la plantilla.
  hoja.properties.outlineProperties = { summaryBelow: false, summaryRight: false };
  hoja.properties.outlineLevelRow = niveles.length;

  const pintar = (fila: number, relleno_: string | null, negrita: boolean, sangria: number, alto: number, esquema: number): void => {
    hoja.getRow(fila).height = alto;
    hoja.getRow(fila).outlineLevel = esquema;
    for (let c = 1; c <= total; c++) {
      const celda = hoja.getCell(fila, c);
      celda.border = BORDES;
      celda.fill = relleno(relleno_ ?? BLANCO);
      celda.font = { name: 'Calibri', size: 11, bold: negrita };
      const clave = columnas[c - 1].key;
      celda.alignment = { horizontal: CLAVES_IMPORTE.has(clave) ? 'right' : 'left', vertical: 'middle', wrapText: true, indent: c === 1 ? sangria : 0 };
      if (CLAVES_IMPORTE.has(clave)) celda.numFmt = '#,##0.00';
    }
  };

  /** Título (o pie) de un grupo: el texto combinado hasta los importes y, si aplica, los saldos del grupo en sus columnas. */
  const filaDeGrupo = (texto: string, filas: MovimientoLibretaRegistro[], nivel: number, tipo: 'titulo' | 'tituloInterno' | 'subtotal' | 'total', alto: number): void => {
    const fondo = tipo === 'subtotal' ? GRIS_SUBTOTAL : tipo === 'total' ? CELESTE : null;
    pintar(f, fondo, true, nivel, alto, nivel);
    const conSaldos = tipo !== 'titulo';
    const hasta = conSaldos ? Math.max(primerImporte - 1, 1) : total;
    if (hasta > 1) hoja.mergeCells(f, 1, f, hasta);
    hoja.getCell(f, 1).value = texto;
    hoja.getCell(f, 1).numFmt = '@';
    if (conSaldos) {
      const primero = valoresMovimiento(filas[0], enDolares);
      const ultimo = valoresMovimiento(filas[filas.length - 1], enDolares);
      [['saldoInicial', primero], ['saldoFinal', ultimo], ['saldoInicialMN', primero], ['saldoFinalMN', ultimo]].forEach(([clave, origen]) => {
        const c = indice(clave as string);
        if (c) hoja.getCell(f, c).value = (origen as Record<string, string | number>)[clave as string];
      });
    }
    f++;
  };

  const nivelar = (filas: MovimientoLibretaRegistro[], nivel: number): void => {
    const actual = niveles[nivel];
    if (!actual) {
      filas.forEach((m) => {
        pintar(f, null, false, 0, 40.5, niveles.length);
        const v = valoresMovimiento(m, enDolares);
        columnas.forEach((c, i) => {
          const celda = hoja.getCell(f, i + 1);
          if (enDolares && c.soloDolares) {
            const origen = c.key.replace('MN', '');
            celda.value = { formula: `${letra(indice(origen))}${f}*${letra(colCompra)}${f}`, result: v[c.key] as number };
          } else {
            celda.value = v[c.key];
          }
          celda.alignment = { horizontal: c.alinea, vertical: 'middle', wrapText: true };
          if (c.key === 'sec') celda.numFmt = '@';
        });
        f++;
      });
      return;
    }
    const grupos = new Map<string, MovimientoLibretaRegistro[]>();
    filas.forEach((m) => {
      const valor = String(valoresMovimiento(m, enDolares)[actual.key] ?? '');
      grupos.set(valor, [...(grupos.get(valor) ?? []), m]);
    });
    const esUltimo = nivel === niveles.length - 1;
    grupos.forEach((filasGrupo, valor) => {
      const prefijo = prefijoNivel(actual);
      let texto = `${prefijo}: ${textoNivel(actual.key, valor)} (${cantidadRegistros(filasGrupo.length)})`;
      if (actual.subtitleColumn) texto += `\n${valoresMovimiento(filasGrupo[0], enDolares)[actual.subtitleColumn]}`;
      filaDeGrupo(texto, filasGrupo, nivel, esUltimo ? 'tituloInterno' : 'titulo', actual.subtitleColumn ? 45 : 33);
      nivelar(filasGrupo, nivel + 1);
      // Agrupado: todos los niveles menos el más interno cierran con pie (con solo dos niveles, también el segundo),
      // el primero es el «TOTAL». Agregado: la
      // entidad (nivel 1) va como tarjeta y no cierra; desde el nivel 2 todos cierran, el nivel 2 con «TOTAL» y los
      // siguientes con «Subtotal» (como la pantalla).
      const agregado = agrupacion.tipo === 'agregado';
      if (agregado ? nivel >= 1 : !esUltimo || niveles.length === 2) {
        const esTotal = agregado ? nivel === 1 : nivel === 0;
        const pie = `${esTotal ? 'TOTAL' : 'Subtotal'} ${prefijo}: ${textoNivel(actual.key, valor)}`;
        filaDeGrupo(pie, filasGrupo, nivel, esTotal ? 'total' : 'subtotal', 33);
      }
    });
  };
  nivelar(movimientos, 0);
}

/**
 * Genera el Excel de «Exportar» de la consulta (plantilla «reporte detallado»): una pestaña «Resumen» con los
 * parámetros de búsqueda y, por cada cuenta bancaria elegida, una pestaña «Resultado N» con su detalle — con una sola
 * cuenta, solo hay «Resultado 1». Es el único formato que ofrece esta pantalla (`exportFormats: ['excel']`): CSV y
 * PDF no distinguen los grupos de columnas de esta tabla. Los estilos (azul de cabecera, bordes finos, anchos, filas
 * celestes para la cuenta en dólares) siguen la plantilla. Las librerías se cargan al exportar, así no pesan en la
 * pantalla hasta que se usan.
 */
export async function exportarConsultaExcel(
  parametros: QueryReportParameters,
  cuentas: CuentaConsultaExcel[],
  agrupacion?: AgrupacionExcel,
): Promise<void> {
  const { Workbook } = await import('exceljs');
  const libro = new Workbook();

  // ---------- Resumen ----------
  const resumen = libro.addWorksheet('Resumen', { pageSetup: { orientation: 'portrait' }, views: [{ zoomScale: 96, zoomScaleNormal: 96 }] });
  const COLS_RESUMEN = 14; // A..N (la nota «Importante» ocupa hasta la N)
  [3.5, 22.3, 10.3, 13, 11.8, 9.3, 8.3, 11.5, 11.2, 11.5, 37.7, 11.5, 11.5, 11.5].forEach((ancho, i) => (resumen.getColumn(i + 1).width = ancho));

  const desde = String(parametros['desde'] ?? '');
  const hasta = String(parametros['hasta'] ?? '');
  const tiposOperacion = (parametros['tipoOperacion'] as string[] | undefined) ?? [];
  const etiquetasTipoOperacion = (tiposOperacion.length ? tiposOperacion : ['1', '2', '3']).map((codigo) => nombreTipoOperacion(codigo));

  // Bloques de la tabla: una fila por (cuenta, entidad, unidad ejecutora), con los beneficiarios apilados.
  interface FilaResumen {
    cuenta: string;
    entidad: string;
    unidadEjecutora: string;
    beneficiarios: string[];
  }
  const bloques: FilaResumen[][] = cuentas.map(({ id, movimientos }) => {
    const cuenta = CUENTAS_BANCARIAS_INFO.find((c) => c.id === id);
    const grupos = new Map<string, FilaResumen>();
    movimientos.forEach((m) => {
      const clave = `${m.entidad}|${m.unidadEjecutora}`;
      const fila = grupos.get(clave) ?? { cuenta: etiquetaCuenta(cuenta), entidad: m.entidad, unidadEjecutora: m.unidadEjecutora, beneficiarios: [] };
      const beneficiario = nombreBeneficiario(m.beneficiarioCodigo).toUpperCase();
      if (!fila.beneficiarios.includes(beneficiario)) fila.beneficiarios.push(beneficiario);
      grupos.set(clave, fila);
    });
    return [...grupos.values()];
  });
  const totalFilas = bloques.reduce((n, b) => n + b.length, 0);
  const finTabla = 13 + totalFilas - 1;
  const filaNiveles = finTabla + 3; // «Agrupado por» / «Agregado por», 3 filas debajo de la tabla
  const filaNota = agrupacion ? finTabla + 10 : finTabla + 6; // «Importante»; la nota va 2 filas más abajo
  const ultimaFila = Math.max(24, filaNota + 3);

  // Fondo blanco de toda el área, como la plantilla.
  for (let f = 1; f <= ultimaFila; f++) {
    for (let c = 1; c <= COLS_RESUMEN; c++) resumen.getCell(f, c).fill = relleno(BLANCO);
  }

  resumen.getRow(2).height = 26.25;
  resumen.getCell('B2').value = 'Registro de operaciones en las libretas de las cuentas de registro';
  resumen.getCell('B2').font = { name: 'Calibri', bold: true, size: 20, color: { argb: AZUL } };

  resumen.getRow(7).height = 18.75;
  resumen.getCell('B7').value = 'Datos de la consulta';
  resumen.getCell('B7').font = { name: 'Calibri', bold: true, size: 14, color: { argb: AZUL } };
  for (let c = 2; c <= COLS_RESUMEN; c++) resumen.getCell(7, c).border = { bottom: { style: 'hair' } };

  const etiquetas: [string, string][] = [['B9', 'FECHA DE OPERACIÓN DESDE'], ['E9', 'FECHA DE OPERACIÓN HASTA'], ['K9', 'TIPO DE OPERACIÓN']];
  etiquetas.forEach(([ref, texto]) => {
    resumen.getCell(ref).value = texto;
    resumen.getCell(ref).font = { name: 'Calibri', bold: true, size: 11 };
  });
  const valores: [string, string | Date][] = [['B10', aFecha(desde)], ['E10', aFecha(hasta)], ['K10', etiquetasTipoOperacion.join(', ')]];
  valores.forEach(([ref, valor]) => {
    const celda = resumen.getCell(ref);
    celda.value = valor;
    celda.numFmt = 'mm-dd-yy';
    celda.alignment = { horizontal: 'left' };
  });

  const encabezadosResumen: [number, string][] = [[2, 'CUENTA BANCARIA'], [5, 'ENTIDAD'], [8, 'UNIDAD EJECUTORA'], [11, 'BENEFICIARIO']];
  for (let c = 2; c <= 12; c++) {
    const celda = resumen.getCell(12, c);
    celda.fill = relleno(AZUL);
    celda.font = { name: 'Calibri', bold: true, size: 11, color: { argb: BLANCO } };
  }
  encabezadosResumen.forEach(([col, texto]) => {
    resumen.getCell(12, col).value = texto;
    resumen.getCell(12, col).alignment = { vertical: 'top' };
  });

  let fila = 13;
  bloques.forEach((bloque, indice) => {
    const fondo = indice % 2 === 1 ? CELESTE : BLANCO; // la plantilla pinta de celeste la cuenta en dólares (la 2.ª)
    const filaInicio = fila;
    bloque.forEach((grupo, i) => {
      for (let c = 2; c <= 12; c++) {
        const celda = resumen.getCell(fila, c);
        celda.fill = relleno(fondo);
        celda.font = { name: 'Calibri', size: 11 };
        celda.alignment = { horizontal: 'left', vertical: 'top', wrapText: c >= 11 };
        celda.border = { bottom: { style: 'thin' }, ...(i > 0 && c >= 5 ? { top: { style: 'thin' as const } } : {}) };
      }
      resumen.getCell(fila, 2).value = grupo.cuenta;
      resumen.getCell(fila, 5).value = grupo.entidad;
      resumen.getCell(fila, 8).value = grupo.unidadEjecutora;
      resumen.getCell(fila, 11).value = grupo.beneficiarios.join('\n');
      resumen.getRow(fila).height = grupo.beneficiarios.length > 1 ? 15 * grupo.beneficiarios.length : 24;
      fila++;
    });
    if (bloque.length) resumen.mergeCells(filaInicio, 2, fila - 1, 4);
  });

  if (agrupacion) {
    const titulo = resumen.getCell(filaNiveles, 2);
    titulo.value = agrupacion.tipo === 'agrupado' ? 'Agrupado por' : 'Agregado por';
    titulo.font = { name: 'Calibri', bold: true, size: 14, color: { argb: AZUL } };
    for (let c = 2; c <= COLS_RESUMEN; c++) resumen.getCell(filaNiveles, c).border = { bottom: { style: 'hair' } };
    resumen.getRow(filaNiveles).height = 18.75;
    resumen.getRow(filaNiveles + 3).height = 38.25;
    agrupacion.niveles.forEach((nivel, i) => {
      const col = COLUMNAS_NIVEL[i] ?? COLUMNAS_NIVEL[COLUMNAS_NIVEL.length - 1] + 3 * (i - COLUMNAS_NIVEL.length + 1);
      resumen.getCell(filaNiveles + 2, col).value = `NIVEL ${i + 1}`;
      resumen.getCell(filaNiveles + 2, col).font = { name: 'Calibri', bold: true, size: 11 };
      const valor = resumen.getCell(filaNiveles + 3, col);
      valor.value = nivel.label;
      valor.font = { name: 'Calibri', size: 11 };
      valor.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    });
  }
  const rotuloNota = resumen.getCell(filaNota, 2);
  rotuloNota.value = 'Importante';
  rotuloNota.font = { name: 'Calibri', bold: true, size: 14, color: { argb: AZUL } };
  for (let c = 2; c <= COLS_RESUMEN; c++) resumen.getCell(filaNota, c).border = { bottom: { style: 'hair' } };
  resumen.getRow(filaNota).height = 18.75;
  resumen.mergeCells(filaNota + 2, 2, filaNota + 2, COLS_RESUMEN);
  const nota = resumen.getCell(filaNota + 2, 2);
  nota.value = NOTA_RESUMEN;
  nota.font = { name: 'Calibri', italic: true, size: 11 };
  nota.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
  resumen.getRow(filaNota + 2).height = 42.75;

  // ---------- Resultado N (una hoja por cuenta bancaria elegida) ----------
  cuentas.forEach(({ id, movimientos }, indice) => {
    const cuenta = CUENTAS_BANCARIAS_INFO.find((c) => c.id === id);
    const enDolares = cuenta?.moneda === 'USD';
    const hoja = libro.addWorksheet(`Resultado ${indice + 1}`, {
      pageSetup: { orientation: 'landscape' },
      views: [{ zoomScale: 75, zoomScaleNormal: 75 }],
    });
    if (!agrupacion) (enDolares ? ANCHOS_USD : ANCHOS_PEN).forEach((ancho, i) => (hoja.getColumn(i + 1).width = ancho));

    // Cabecera de la cuenta: «Cta. Bancaria» (gris), saldo inicial y saldo final (B:D combinadas).
    [2, 3, 4].forEach((f) => (hoja.getRow(f).height = 36));
    const cabecera: [number, string, string | number, boolean][] = [
      [2, 'Cta. Bancaria:', etiquetaCuenta(cuenta), true],
      [3, 'Saldo inicial', cuenta?.saldoInicial ?? 0, false],
      [4, 'Saldo final', cuenta?.saldoFinal ?? 0, false],
    ];
    cabecera.forEach(([f, rotulo, valor, esCuenta]) => {
      hoja.mergeCells(f, 2, f, 4);
      for (let c = 1; c <= 4; c++) {
        const celda = hoja.getCell(f, c);
        celda.border = BORDES;
        celda.fill = relleno(esCuenta ? GRIS : BLANCO);
        celda.font = { name: 'Calibri', bold: true, size: esCuenta ? 14 : 12 };
        celda.alignment = { horizontal: c === 1 && !esCuenta ? undefined : 'left', vertical: 'middle', wrapText: c !== 2 || !esCuenta };
      }
      hoja.getCell(f, 1).value = rotulo;
      hoja.getCell(f, 2).value = valor;
      if (!esCuenta) hoja.getCell(f, 2).numFmt = '#,##0.00';
    });

    if (agrupacion) {
      hojaAgrupada(hoja, movimientos, enDolares, agrupacion);
      return;
    }

    const grupos: { grupo: string; subs: ReadonlyArray<string | null> }[] = [
      { grupo: 'ACREDITACIÓN', subs: ['SECUENCIA', 'FECHA'] },
      { grupo: 'BENEFICIARIO', subs: ['CÓDIGO', 'DESCRIPCIÓN'] },
      { grupo: 'CUENTA DE REGISTRO', subs: ['NÚMERO', 'DESCRIPCIÓN', 'FF/SUB FF'] },
      { grupo: 'TIPO DE OPERACIÓN', subs: [null] },
      { grupo: 'ÁMBITO INSTITUCIONAL', subs: ['ENTIDAD', 'UNIDAD EJECUTORA', 'GRUPO'] },
      ...(enDolares ? [{ grupo: 'TIPO DE CAMBIO', subs: ['TIPO DE COTIZACIÓN', 'COMPRA', 'VENTA'] }] : []),
      { grupo: 'IMPORTE EN MONEDA DE LA CUENTA', subs: ['SALDO INICIAL', 'DÉBITO', 'CRÉDITO', 'SALDO FINAL'] },
      ...(enDolares ? [{ grupo: 'IMPORTE EN MONEDA NACIONAL', subs: ['SALDO INICIAL', 'DÉBITO', 'CRÉDITO', 'SALDO FINAL'] }] : []),
      { grupo: 'DOCUMENTO', subs: ['NÚMERO', 'DESCRIPCIÓN'] },
    ];

    const filaGrupo = 6;
    hoja.getRow(filaGrupo).height = 36;
    hoja.getRow(filaGrupo + 1).height = 36;
    let col = 1;
    grupos.forEach(({ grupo, subs }) => {
      const inicio = col;
      const fin = col + subs.length - 1;
      const sinSub = subs.length === 1 && subs[0] === null;
      if (fin > inicio) hoja.mergeCells(filaGrupo, inicio, filaGrupo, fin);
      if (sinSub) hoja.mergeCells(filaGrupo, inicio, filaGrupo + 1, inicio);
      for (let c = inicio; c <= fin; c++) {
        for (const f of [filaGrupo, filaGrupo + 1]) estiloEncabezado(hoja.getCell(f, c));
      }
      hoja.getCell(filaGrupo, inicio).value = grupo;
      if (!sinSub) subs.forEach((sub, i) => (hoja.getCell(filaGrupo + 1, inicio + i).value = sub));
      col = fin + 1;
    });

    // Columnas de la plantilla (1 = A): sin cuenta bancaria ni moneda (ya van en la cabecera); el tipo de cambio y el
    // importe en moneda nacional solo existen en la cuenta en dólares.
    const primerImporte = enDolares ? 15 : 12;
    const importes = new Set(enDolares ? [15, 16, 17, 18, 19, 20, 21, 22] : [12, 13, 14, 15]);
    const columnaDocumento = enDolares ? 23 : 16;
    const centradas = new Set([1, 3]);
    const textoPlano = new Set([1]); // formato «@»: secuencia
    const totalColumnas = columnaDocumento + 1;
    const letra = (c: number): string => String.fromCharCode(64 + c);

    movimientos.forEach((m, i) => {
      const f = filaGrupo + 2 + i;
      hoja.getRow(f).height = 40.5;
      const fijos: Array<string | number> = [
        m.sec,
        fechaHoraVisible(m.fecha),
        m.beneficiarioCodigo,
        nombreBeneficiario(m.beneficiarioCodigo).toUpperCase(),
        m.numeroCuentaRegistro,
        m.descripcionCuentaRegistro,
        m.ffSubFf,
        nombreTipoOperacion(m.tipoOperacionCodigo),
        m.entidad,
        m.unidadEjecutora,
        m.grupo,
        ...(enDolares ? ['1. Compra / Venta', TIPO_CAMBIO_COMPRA, TIPO_CAMBIO_VENTA] : []),
        m.saldoInicial,
        m.debito,
        m.credito,
        m.saldoFinal,
      ];
      fijos.forEach((valor, k) => (hoja.getCell(f, k + 1).value = valor));
      let siguiente = fijos.length + 1;
      if (enDolares) {
        // Moneda nacional = importe de la cuenta × tipo de cambio de compra (fórmula viva, como la plantilla).
        [m.saldoInicial, m.debito, m.credito, m.saldoFinal].forEach((importe, k) => {
          hoja.getCell(f, siguiente + k).value = { formula: `${letra(primerImporte + k)}${f}*M${f}`, result: importe * TIPO_CAMBIO_COMPRA };
        });
        siguiente += 4;
      }
      hoja.getCell(f, siguiente).value = m.numeroDocumento;
      hoja.getCell(f, siguiente + 1).value = m.descripcionDocumento;

      for (let c = 1; c <= totalColumnas; c++) {
        const celda = hoja.getCell(f, c);
        celda.border = BORDES;
        celda.fill = relleno(BLANCO);
        celda.font = { name: 'Calibri', size: 11 };
        const esImporte = importes.has(c);
        celda.alignment = {
          horizontal: centradas.has(c) ? 'center' : esImporte || c === columnaDocumento ? 'right' : c === 2 || c === 4 || c === 5 || (c >= 9 && c <= 11) || c === columnaDocumento + 1 ? 'left' : undefined,
          vertical: 'middle',
          wrapText: true,
        };
        if (esImporte) celda.numFmt = '#,##0.00';
        else if (textoPlano.has(c)) celda.numFmt = '@';
      }
    });
  });

  const nombreArchivo = `registro-libretas-cuentas-registro-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const buffer = await libro.xlsx.writeBuffer();
  descargar(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombreArchivo);
}

/** Nombre del PDF de «Ver documento PDF» de un registro: «{operación}-{documento} - detalle de registro...pdf», como en el Figma. */
export function nombrePdfRegistro(detalle: DetalleRegistro): string {
  return `${detalle.numeroOperacion}-${detalle.numeroDocumento} - detalle de registro de Movimiento de la libreta de cuenta de registro.pdf`;
}

interface Logo {
  dataUrl: string;
  /** Ancho / alto del SVG original: el PNG que trae embebido es un recorte cuadrado de una hoja de íconos, pasarlo
   *  directo a `addImage` con un ancho y alto fijos lo deformaba; se dibuja primero en un `<canvas>` del tamaño real
   *  del SVG (donde el navegador ya resuelve el patrón/recorte) y de ahí sale la proporción correcta. */
  proporcion: number;
}

/** Logo SIAF·RP de las cabeceras del PDF (`assets/img/LogoSIAF.svg`), rasterizado una sola vez. */
let logoPromesa: Promise<Logo | null> | null = null;
function cargarLogo(): Promise<Logo | null> {
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
async function cargarQr(contenido: string): Promise<string | null> {
  try {
    const { toDataURL } = await import('qrcode');
    return await toDataURL(contenido, { margin: 0, width: 240, color: { dark: '#202020', light: '#ffffff' } });
  } catch {
    return null;
  }
}

/** Sin tildes ni eñe: evita que cada lector decodifique los acentos con una página de códigos distinta (en el
 *  lector nativo de iPhone se veían como símbolos sueltos, aunque Google Lens sí los mostraba bien). */
const sinTildes = (texto: string): string => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Texto plano del QR: para la trazabilidad, no un enlace, así se lee igual sin conexión al escanearlo.
 *  El guion de «000001-2026» se cambia por un punto: la cámara nativa de iPhone matchea «dígitos-dígitos» como
 *  teléfono y ofrece llamar en vez de mostrar el texto. */
const textoTrazabilidadQr = (numeroDocumento: string, fechaHora: string): string =>
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
const ANCHO_QR = 24;
const MARGEN_QR = 6;

/**
 * Arma el PDF de «Ver documento PDF» de un registro de Registros (Figma nodo 440:84666, «PDF 600»): las mismas
 * secciones que `siaf-registro-libretas-registro`, en hojas A4 con la cabecera y el pie de SIAF·RP. Devuelve el Blob
 * para previsualizarlo en el visor nativo; no lo descarga (eso lo hace el visor con su propio botón).
 */
export async function generarPdfRegistro(sec: string): Promise<{ blob: Blob; nombre: string; paginas: number } | null> {
  const detalle = construirDetalleRegistro(sec);
  if (!detalle) return null;

  const [{ default: jsPDF }, logo, qr] = await Promise.all([
    import('jspdf'),
    cargarLogo(),
    cargarQr(textoTrazabilidadQr(detalle.numeroDocumento, detalle.fechaRegistro)),
  ]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const margen = 16;
  const anchoUtil = 210 - margen * 2;
  const altoPagina = 297;
  const altoPie = 12;
  let y = margen;

  const encabezado = (): void => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text('DETALLE DE REGISTRO DE OPERACIONES EN LAS', margen, y);
    pdf.text('LIBRETAS DE LAS CUENTAS DE REGISTRO', margen, y + 5.5);
    if (logo) {
      const anchoLogo = 24;
      pdf.addImage(logo.dataUrl, 'PNG', 210 - margen - anchoLogo, y - 3.5, anchoLogo, anchoLogo / logo.proporcion);
    }
    y += 12;
    pdf.setDrawColor(220);
    pdf.line(margen, y, 210 - margen, y);
    y += 8;
  };

  const salto = (alto: number): void => {
    if (y + alto > altoPagina - altoPie - margen) {
      pdf.addPage();
      y = margen;
      encabezado();
    }
  };

  const subtitulo = (texto: string): void => {
    salto(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(texto.toUpperCase(), margen, y);
    y += 5;
  };

  /** Etiquetas y valores en columnas, como `readonly-field`: 3 por fila (o `anchoCol` para una que ocupe dos). */
  const campos = (filas: { caption: string; value: string; ancho?: 1 | 2 }[], anchoDisponible = anchoUtil): void => {
    const columnas = 3;
    const anchoCol = anchoDisponible / columnas;
    let col = 0;
    for (const campo of filas) {
      const x = margen + col * anchoCol;
      salto(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(campo.caption.toUpperCase(), x, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      const lineas = pdf.splitTextToSize(campo.value || '-', (campo.ancho === 2 ? 2 : 1) * anchoCol - 4);
      pdf.text(lineas, x, y + 4.5);
      col += campo.ancho === 2 ? 2 : 1;
      if (col >= columnas) {
        col = 0;
        y += 4.5 + lineas.length * 4;
      }
    }
    if (col !== 0) y += 12;
    y += 3;
  };

  /** Fila de 4 montos resaltados (Figma «Importe en moneda de la cuenta»): caja celeste, etiqueta arriba y el valor en negrita a la derecha. */
  const importesDestacados = (filas: { caption: string; value: string }[]): void => {
    const alto = 11;
    salto(alto + 3);
    const gap = 4;
    const anchoCaja = (anchoUtil - gap * (filas.length - 1)) / filas.length;
    filas.forEach((campo, i) => {
      const x = margen + i * (anchoCaja + gap);
      pdf.setFillColor(1, 72, 153);
      pdf.setGState(pdf.GState({ opacity: 0.08 }));
      pdf.roundedRect(x, y, anchoCaja, alto, 1, 1, 'F');
      pdf.setGState(pdf.GState({ opacity: 1 }));
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.text(campo.caption, x + 2, y + 4);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.text(campo.value, x + anchoCaja - 2, y + 8.5, { align: 'right' });
    });
    y += alto + 3;
  };

  const linea = (): void => {
    salto(4);
    pdf.setDrawColor(210);
    pdf.line(margen, y, 210 - margen, y);
    y += 5;
  };

  encabezado();
  // QR de verificación (Figma 440:84666): solo en la primera hoja, a la altura de «Información de operaciones financieras».
  const yQr = y;
  if (qr) pdf.addImage(qr, 'PNG', 210 - margen - ANCHO_QR, yQr, ANCHO_QR, ANCHO_QR);
  subtitulo('Información de operaciones financieras:');
  // Área de seguridad: los campos de esta franja se reparten a la izquierda del QR, sin pasar por debajo de él.
  campos(
    [
      { caption: 'Fecha registro', value: detalle.fechaRegistro },
      { caption: 'Número de operación', value: detalle.numeroOperacion },
      { caption: 'Tipo de operación', value: detalle.tipoOperacion },
    ],
    qr ? anchoUtil - ANCHO_QR - MARGEN_QR : anchoUtil,
  );
  if (qr) y = Math.max(y, yQr + ANCHO_QR + 3);

  subtitulo('Información de la cuenta bancaria:');
  campos([
    { caption: 'Número de cuenta bancaria', value: detalle.cuenta.numeroCuenta },
    { caption: 'Denominación de la cuenta', value: detalle.cuenta.nombre },
    { caption: 'Entidad financiera', value: 'Banco Central de Reserva del Perú' },
    { caption: 'Moneda', value: detalle.cuenta.moneda },
    { caption: 'Entidad titular de la cuenta', value: 'Ministerio de Economía y Finanzas' },
    { caption: 'Unidad ejecutora', value: '-' },
    { caption: 'Unidad organizacional responsable de la cuenta', value: 'Dirección General del Tesoro Público' },
  ]);
  linea();

  subtitulo('Registro de operación de la libreta');
  for (const seccion of detalle.secciones) {
    subtitulo(seccion.titulo);
    campos(seccion.campos);
  }

  subtitulo('Importe en moneda de la cuenta');
  importesDestacados(detalle.importes);

  subtitulo('Descripción detallada del registro');
  campos([{ caption: 'Descripción', value: detalle.descripcionDetallada, ancho: 2 }]);
  linea();

  campos([
    { caption: 'Estado de conciliación', value: 'Conciliado' },
    { caption: 'Estado de registro', value: 'Activo' },
  ]);

  // Pie de página (Figma «Pie de página - Membrete»): divider + «Creado …» y «Página X de Y» en todas las hojas.
  const totalPaginas = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    pdf.setPage(p);
    const yPie = altoPagina - margen + 2;
    pdf.setDrawColor(230);
    pdf.line(margen, yPie - 4, 210 - margen, yPie - 4);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.text(`Creado ${fechaHoraActual()}`, margen, yPie);
    pdf.text(`Página ${p} de ${totalPaginas}`, 210 - margen, yPie, { align: 'right' });
  }

  return { blob: pdf.output('blob'), nombre: nombrePdfRegistro(detalle), paginas: totalPaginas };
}

/** Nombre del PDF de «Descargar» de un documento: «{número} - registro de operaciones...pdf». */
export function nombrePdfDocumento(numero: string): string {
  return `${numero} - registro de operaciones en las libretas de las cuentas de registro.pdf`;
}

/**
 * Arma el PDF de «Descargar» de un documento (Figma nodo 4990:17215, «PDF 603»): apaisado, una hoja por cada cuenta
 * bancaria que el documento referencia, con su tabla de movimientos (igual a `siaf-registro-libretas-documento`).
 * Se descarga directo, a diferencia de `generarPdfRegistro`, que solo se previsualiza.
 */
export async function generarPdfDocumento(numero: string): Promise<{ blob: Blob; nombre: string } | null> {
  const movimientos = MOVIMIENTOS_LIBRETA_REGISTRO.filter((m) => m.numeroDocumento === numero);
  if (!movimientos.length) return null;

  const [{ default: jsPDF }, { default: autoTable }, logo, qr] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    cargarLogo(),
    cargarQr(textoTrazabilidadQr(numero, `${fechaVisible(movimientos[0].fecha)}  18:01:00`)),
  ]);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const margen = 16;
  const anchoPagina = 297;
  const altoPagina = 210;
  const anchoUtil = anchoPagina - margen * 2;
  const fechaRegistro = `${fechaVisible(movimientos[0].fecha)}  18:01:00`;
  let y = margen;

  const encabezado = (): void => {
    const anchoLogo = 24;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text('REGISTRO DE OPERACIONES EN LAS LIBRETAS DE LAS CUENTAS DE REGISTRO', margen, y + 3);
    if (logo) pdf.addImage(logo.dataUrl, 'PNG', anchoPagina - margen - anchoLogo, y - 3.5, anchoLogo, anchoLogo / logo.proporcion);
    y += 12;
    pdf.setDrawColor(220);
    pdf.line(margen, y, anchoPagina - margen, y);
    y += 8;
  };

  const subtitulo = (texto: string): void => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(texto.toUpperCase(), margen, y);
    y += 6;
  };

  /** Etiquetas y valores en columnas, como `readonly-field`: hasta 3 por fila (o `ancho` para una que ocupe más de una). */
  const campos = (filas: { caption: string; value: string; ancho?: 1 | 2 }[]): void => {
    const columnas = 3;
    const anchoCol = anchoUtil / columnas;
    let col = 0;
    for (const campo of filas) {
      const x = margen + col * anchoCol;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(campo.caption.toUpperCase(), x, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      const lineas = pdf.splitTextToSize(campo.value || '-', (campo.ancho === 2 ? 2 : 1) * anchoCol - 4);
      pdf.text(lineas, x, y + 4.5);
      col += campo.ancho === 2 ? 2 : 1;
      if (col >= columnas) {
        col = 0;
        y += 4.5 + lineas.length * 4;
      }
    }
    if (col !== 0) y += 12;
    y += 4;
  };

  const idsCuentas = [...new Set(movimientos.map((m) => m.cuentaBancariaId))];
  idsCuentas.forEach((cuentaId, indice) => {
    if (indice > 0) {
      pdf.addPage();
      y = margen;
    }
    encabezado();
    // QR de trazabilidad (Figma 4990:17215): solo en la primera hoja, a la altura de «Información de operaciones financieras».
    const yQr = y;
    if (indice === 0 && qr) pdf.addImage(qr, 'PNG', anchoPagina - margen - 22, yQr, 22, 22);
    subtitulo('Información de operaciones financieras:');
    campos([
      { caption: 'Fecha registro', value: fechaRegistro },
      { caption: 'Número de operación', value: '12345678' },
      { caption: 'Tipo de operación', value: '1 - Saldos iniciales' },
    ]);
    if (indice === 0 && qr) y = Math.max(y, yQr + 22 + 3);

    const cuenta = CUENTAS_BANCARIAS_INFO.find((c) => c.id === cuentaId);
    subtitulo('Información de la cuenta bancaria:');
    campos([
      { caption: 'Cuenta bancaria', value: `${cuenta?.numeroCuenta ?? ''} ${cuenta?.nombre ?? ''}`, ancho: 2 },
      { caption: 'Moneda', value: cuenta?.moneda ?? '' },
    ]);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('REGISTROS DE OPERACIONES DE LAS LIBRETAS', margen, y);
    y += 7;

    const cuerpo = movimientos
      .filter((m) => m.cuentaBancariaId === cuentaId)
      .map((m) => [
        m.sec,
        fechaHoraVisible(m.fecha),
        m.beneficiarioCodigo,
        nombreBeneficiario(m.beneficiarioCodigo).toUpperCase(),
        m.numeroCuentaRegistro,
        m.descripcionCuentaRegistro,
        monto(m.saldoInicial),
        monto(m.debito),
        monto(m.credito),
        monto(m.saldoFinal),
      ]);

    // Límite de columna (0-based) tras el que termina cada grupo: ahí va el divisor vertical de la cabecera, nunca
    // dentro de un mismo grupo (Saldo inicial | Débito | Crédito | Saldo final no llevan raya entre sí).
    const limiteGrupos = new Set([1, 3, 5]);
    let yCabecera = y;
    autoTable(pdf, {
      startY: y,
      margin: { left: margen, right: margen },
      theme: 'plain',
      head: [
        [
          { content: 'ACREDITACIÓN', colSpan: 2 },
          { content: 'BENEFICIARIO', colSpan: 2 },
          { content: 'CUENTA DE REGISTRO', colSpan: 2 },
          { content: 'IMPORTE EN MONEDA DE LA CUENTA', colSpan: 4 },
        ],
        ['SEC.', 'FECHA', 'CÓDIGO', 'DESCRIPCIÓN', 'NÚMERO', 'DESCRIPCIÓN', 'SALDO INICIAL', 'DÉBITO', 'CRÉDITO', 'SALDO FINAL'],
      ],
      body: cuerpo,
      styles: { fontSize: 7.5, cellPadding: 1.5, lineWidth: 0 },
      // Sin borde propio en la cabecera (Figma): el grupo va centrado y la sub-cabecera, alineada como su columna
      // (texto a la izquierda, montos a la derecha); el divisor entre grupos se dibuja aparte, solo donde corresponde.
      headStyles: { fillColor: [1, 72, 153], textColor: 255, lineWidth: 0 },
      columnStyles: {
        // Número de cuenta de registro más ancho para que entre en una sola línea; su descripción cede ese espacio.
        4: { cellWidth: 52 },
        5: { cellWidth: 68 },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
      },
      didParseCell: (datos) => {
        // `columnStyles` de autoTable solo se aplica al cuerpo, no a la cabecera: la alineación de cada sub-columna
        // (montos a la derecha) hay que repetirla acá a mano.
        if (datos.section !== 'head') return;
        datos.cell.styles.halign = datos.row.index === 0 ? 'center' : datos.column.index >= 6 ? 'right' : 'left';
      },
      didDrawCell: (datos) => {
        if (datos.section === 'head' && datos.row.index === 0 && datos.column.index === 0) yCabecera = datos.cell.y;
        if (datos.section === 'head' && datos.row.index === 0) {
          // Raya blanca entre la fila de grupos y la de sub-cabeceras (Figma), a todo el ancho de la tabla.
          pdf.setDrawColor(255);
          const yBorde = datos.cell.y + datos.cell.height;
          pdf.line(margen, yBorde, anchoPagina - margen, yBorde);
        }
        if (datos.section === 'head' && datos.row.index === 1 && limiteGrupos.has(datos.column.index)) {
          pdf.setDrawColor(255);
          const xBorde = datos.cell.x + datos.cell.width;
          pdf.line(xBorde, yCabecera, xBorde, datos.cell.y + datos.cell.height);
        }
        if (datos.section !== 'body' || datos.column.index !== datos.table.columns.length - 1) return;
        pdf.setDrawColor(225);
        const yBorde = datos.cell.y + datos.cell.height;
        pdf.line(margen, yBorde, anchoPagina - margen, yBorde);
      },
    });
  });

  // Pie de página: divider + «Creado …» y «Página X de Y» en todas las hojas, como en `generarPdfRegistro`.
  const totalPaginas = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    pdf.setPage(p);
    const yPie = altoPagina - margen + 2;
    pdf.setDrawColor(230);
    pdf.line(margen, yPie - 4, anchoPagina - margen, yPie - 4);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.text(`Creado ${fechaHoraActual()}`, margen, yPie);
    pdf.text(`Página ${p} de ${totalPaginas}`, anchoPagina - margen, yPie, { align: 'right' });
  }

  return { blob: pdf.output('blob'), nombre: nombrePdfDocumento(numero) };
}
