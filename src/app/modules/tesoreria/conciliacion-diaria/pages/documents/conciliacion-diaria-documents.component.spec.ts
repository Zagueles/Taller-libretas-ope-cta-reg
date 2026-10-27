import { leerDatos, reiniciarDatosDemo } from '../../../../../mock/mock-db';
import { FECHA_CONCILIACION_APROBADA, diaDeOperacion, trazabilidadDeEjemplo } from '../../models/conciliacion-diaria.model';
import { DOCUMENTOS_DEL_SISTEMA, REGISTROS_DE_EJEMPLO } from './conciliacion-diaria-documents.component';

const soloDia = (fecha: string): string => fecha.split(' ')[0];
const hora = (fecha: string): string => fecha.split(' ')[1] ?? '';

/** «dd/mm/aaaa hh:mm:ss» de una fecha ISO del historial, en hora local. */
const visible = (iso: string): string => {
  const d = new Date(iso);
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
};

describe('datos de ejemplo de Conciliación diaria: consistencia de fechas, números y trazabilidad', () => {
  beforeAll(() => reiniciarDatosDemo());
  afterAll(() => reiniciarDatosDemo());

  const manualAprobada = () => leerDatos().solicitudes.find((s) => s.estado === 'APROBADO' && s.catDocumento?.nombre === 'Conciliación manual diaria')!;
  const diaD = (): string => {
    const d = diaDeOperacion(new Date(`${FECHA_CONCILIACION_APROBADA}T00:00:00`));
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  it('cada registro activo lleva el número de un documento que existe: el aprobado del usuario o uno del sistema', () => {
    const numeroManual = manualAprobada().numero;
    const delSistema = new Set(DOCUMENTOS_DEL_SISTEMA.map((d) => `${d['document']}|${d['number']}`));

    expect(numeroManual).toBe('000001-2026');
    for (const registro of REGISTROS_DE_EJEMPLO.filter((r) => r['status'] === 'Activo')) {
      const clave = `${registro['document']}|${registro['number']}`;
      const existe = registro['document'] === 'Conciliación manual diaria' ? registro['number'] === numeroManual : delSistema.has(clave);
      expect(existe).withContext(clave).toBeTrue();
    }
  });

  it('las operaciones de los registros son siempre del día anterior al de los documentos que las ajustan', () => {
    const creacionManual = visible(manualAprobada().createdAt!);
    const dia = diaD();
    for (const registro of REGISTROS_DE_EJEMPLO) {
      for (const clave of ['lbFecha', 'rbFecha']) {
        const fecha = String(registro[clave] ?? '');
        if (fecha) expect(soloDia(fecha)).withContext(`${registro['document']} ${registro['nro']} ${clave}`).toBe(dia);
      }
    }
    for (const documento of DOCUMENTOS_DEL_SISTEMA) expect(soloDia(String(documento['date']))).toBe(dia);
    // La conciliación manual se crea al día siguiente del de las operaciones.
    expect(soloDia(creacionManual)).not.toBe(dia);
    expect(creacionManual.split(' ')[0].split('/').reverse().join('-')).toBe(FECHA_CONCILIACION_APROBADA);
  });

  it('la fecha de registro y la trazabilidad de los registros manuales son las del historial del documento aprobado', () => {
    const historial = manualAprobada().historialEstados!;
    const fecha = (estado: string): string => visible(historial.find((h) => h.estadoNuevo === estado)!.createdAt);
    const traza = trazabilidadDeEjemplo(FECHA_CONCILIACION_APROBADA);

    expect(traza).toEqual({ elaborado: fecha('ELABORADO'), verificado: fecha('VERIFICADO'), aprobado: fecha('APROBADO') });
    for (const registro of REGISTROS_DE_EJEMPLO.filter((r) => r['document'] === 'Conciliación manual diaria')) {
      expect(registro['elaboradoFecha']).toBe(traza.elaborado);
      expect(registro['verificadoFecha']).toBe(traza.verificado);
      expect(registro['aprobadoFecha']).toBe(traza.aprobado);
      expect(registro['fechaRegistro']).toBe(traza.aprobado);
      expect(registro['aprobadoPor']).not.toBe(registro['elaboradoPor']);
      expect(registro['aprobadoPor']).not.toBe(registro['verificadoPor']);
    }
  });

  it('los registros manuales son los mismos de la solicitud aprobada, con su fecha de operación del día anterior', () => {
    const delDocumento = manualAprobada().detalleConciliacionManual!.registros;
    const manuales = REGISTROS_DE_EJEMPLO.filter((r) => r['document'] === 'Conciliación manual diaria');

    expect(manuales.map((r) => r['nro'])).toEqual(delDocumento.map((r) => r.nro));
    expect(manuales.map((r) => r['lbNumero'])).toEqual(delDocumento.map((r) => r.lbNumero));
    expect(manuales.map((r) => r['lbFecha'])).toEqual(delDocumento.map((r) => r.lbFecha));
  });

  it('lo que genera el sistema lo elabora SIAF RP al cierre del día de las operaciones, a las 19:00', () => {
    const delSistema = REGISTROS_DE_EJEMPLO.filter((r) => r['document'] !== 'Conciliación manual diaria');
    expect(delSistema.length).toBeGreaterThan(0);
    for (const registro of delSistema) {
      expect(registro['elaboradoPor']).toBe('SIAF RP');
      expect(soloDia(String(registro['fechaRegistro']))).toBe(diaD());
      expect(hora(String(registro['fechaRegistro']))).toBe('19:00:00');
    }
  });
});
