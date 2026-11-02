import { ProcesamientoConciliacion, bannerDeProcesamiento, tituloDeIncidencia } from './conciliacion-diaria.model';

describe('bannerDeProcesamiento', () => {
  const procesamiento = (parcial: Partial<ProcesamientoConciliacion>): ProcesamientoConciliacion => ({
    estado: 'EN_PROCESO',
    actualizadoEn: '2026-10-30T10:00:00Z',
    sistemasConError: [],
    reintentosAgotados: false,
    ...parcial,
  });
  const libretas = { codigo: 'LIBRETAS', nombre: 'Libretas' };
  const contabilidad = { codigo: 'CONTABILIDAD', nombre: 'Contabilidad' };

  it('sin procesamiento no hay banner', () => {
    expect(bannerDeProcesamiento(null, '000001-2026')).toBeNull();
  });

  it('«en proceso»: informativo, que el usuario no puede cerrar', () => {
    expect(bannerDeProcesamiento(procesamiento({}), '000001-2026')).toEqual({
      tono: 'info',
      cerrable: false,
      titulo: 'Procesando la conciliación',
      mensaje: 'Se están actualizando los sistemas relacionados. Puedes salir de esta pantalla; te avisaremos al terminar.',
    });
  });

  it('«aplicado»: éxito que se puede cerrar', () => {
    expect(bannerDeProcesamiento(procesamiento({ estado: 'APLICADO' }), '000001-2026')).toEqual(
      jasmine.objectContaining({ tono: 'success', cerrable: true, titulo: 'Conciliación aplicada', mensaje: 'Los sistemas relacionados se actualizaron correctamente.' }),
    );
  });

  it('«con incidencias»: error que nombra el sistema y promete el reintento automático', () => {
    const b = bannerDeProcesamiento(procesamiento({ estado: 'CON_INCIDENCIAS', sistemasConError: [contabilidad] }), '000001-2026');
    expect(b).toEqual(jasmine.objectContaining({ tono: 'error', cerrable: false, titulo: 'No se pudo actualizar Contabilidad', mensaje: 'El documento sigue aprobado. El sistema volverá a intentarlo automáticamente.' }));
  });

  it('con varios sistemas dice cuántos y cuáles', () => {
    expect(tituloDeIncidencia([libretas, contabilidad])).toBe('No se pudo actualizar 2 sistemas: Libretas y Contabilidad.');
  });

  it('si se agotan los reintentos, manda a la mesa de ayuda con el número del documento', () => {
    const b = bannerDeProcesamiento(procesamiento({ estado: 'CON_INCIDENCIAS', sistemasConError: [libretas], reintentosAgotados: true }), '000001-2026');
    expect(b?.mensaje).toBe('El documento sigue aprobado. Comunícate con la mesa de ayuda e indica el documento 000001-2026.');
  });
});
