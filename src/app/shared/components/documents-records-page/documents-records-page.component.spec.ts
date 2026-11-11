import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { NotificationsStateService } from '../../../core/realtime/notifications-state.service';
import {
  BANDEJA_CONFIG_DE_MUESTRA,
  EstadoNotificacionesDeMuestra,
  HISTORIAL_DOCUMENTO_DE_MUESTRA,
  PROVEEDORES_BANDEJA_DE_MUESTRA,
} from '../../../features/ui-kit/ejemplos/datos-de-muestra';
import type { DocumentsRecordsConfig, DocumentsRecordsRow } from '../../types/documents-records.types';
import { PaginationComponent } from '../pagination/pagination.component';
import { DocumentsRecordsPageComponent } from './documents-records-page.component';

/** Filas de la pestaña Documentos: `desde` permite simular que el refresco de la bandeja trae otra primera fila. */
function filas(cantidad: number, desde = 1): DocumentsRecordsRow[] {
  return Array.from({ length: cantidad }, (_, i) => {
    const n = String(desde + i).padStart(5, '0');
    return {
      document: 'Solicitud de Creación de Cuenta Contable',
      documentId: `doc-${n}`,
      number: `PCC-SCC-${n}-2026-MEF-DGCP`,
      linkRoute: `/ui-kit/solicitud/doc-${n}`,
      actionType: 'Creación',
      status: 'Elaborado',
      date: '15/01/2026',
      creator: 'Juan Carlos Pérez',
    };
  });
}

describe('DocumentsRecordsPageComponent', () => {
  let fixture: ComponentFixture<DocumentsRecordsPageComponent>;
  let pagina: DocumentsRecordsPageComponent;
  const el = (): HTMLElement => fixture.nativeElement;

  function configurar(config: DocumentsRecordsConfig): void {
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();
  }

  /** Contadores de los dos paginadores de la pestaña: el de `siaf-table-controls` arriba y el de abajo. */
  const contadores = (): string[] =>
    fixture.debugElement.queryAll(By.directive(PaginationComponent)).map((d) => (d.componentInstance as PaginationComponent).counterText);

  const panelHistorial = (): HTMLElement | null => el().querySelector('siaf-document-history-panel');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentsRecordsPageComponent],
      providers: [
        ...PROVEEDORES_BANDEJA_DE_MUESTRA,
        { provide: NotificationsStateService, useClass: EstadoNotificacionesDeMuestra },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DocumentsRecordsPageComponent);
    pagina = fixture.componentInstance;
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  describe('paginadores de la pestaña Documentos', () => {
    it('en modo servidor, la paginación (solo abajo) muestra el total del backend, no las filas de la página', () => {
      // La bandeja trae la primera página (10 filas) de 12 documentos.
      configurar({ ...BANDEJA_CONFIG_DE_MUESTRA, documentRows: filas(10), serverQuery: { total: 12 } });

      // La paginación superior ya no es parte del estándar: solo queda el contador de abajo.
      expect(contadores()).toEqual(['1-10 de 12']);
    });

    it('sin serverQuery, la paginación (solo abajo) cuenta las filas cargadas', () => {
      configurar({ ...BANDEJA_CONFIG_DE_MUESTRA, documentRows: filas(12) });

      // La paginación superior ya no es parte del estándar: solo queda el contador de abajo.
      expect(contadores()).toEqual(['1-10 de 12']);
    });
  });

  describe('estado vacío sin resultados', () => {
    const vacio = (): HTMLElement | null => el().querySelector('[data-sin-resultados]');
    const texto = (): string => vacio()!.textContent!.replace(/\s+/g, ' ').trim();
    /** El componente es OnPush: tras cambiar un filtro o la búsqueda directo en la instancia hay que marcarlo. */
    const refrescar = (): void => {
      fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
      fixture.detectChanges();
    };

    it('con una búsqueda sin coincidencias muestra el estado vacío con «la búsqueda ingresada»', () => {
      configurar({ ...BANDEJA_CONFIG_DE_MUESTRA, documentRows: filas(3) });
      pagina.searchTerm = 'zzzz-no-existe';
      refrescar();

      expect(texto()).toContain('No se encontraron resultados');
      expect(texto()).toContain('No pudimos hallar coincidencias con la búsqueda ingresada');
      expect(vacio()!.querySelector('siaf-empty-state')).not.toBeNull();
      // Sin filas no hay nada que paginar: ni «Filas por página» ni «0-0 de 0».
      expect(el().querySelector('siaf-pagination')).toBeNull();
    });

    it('con filtros sin coincidencias dice «los filtros ingresados», también si además hay búsqueda', () => {
      configurar({ ...BANDEJA_CONFIG_DE_MUESTRA, documentRows: filas(3) });
      pagina.selectedDocumentFilter1 = 'Aprobado';
      refrescar();
      expect(texto()).toContain('No pudimos hallar coincidencias con los filtros ingresados');
      expect(el().querySelector('siaf-pagination')).toBeNull();

      pagina.searchTerm = 'zzzz';
      refrescar();
      expect(texto()).toContain('con los filtros ingresados');
    });

    it('con coincidencias no hay estado vacío, y una lista vacía sin filtros ni búsqueda conserva su aviso de siempre', () => {
      configurar({ ...BANDEJA_CONFIG_DE_MUESTRA, documentRows: filas(3) });
      expect(vacio()).toBeNull();
      expect(el().querySelector('siaf-pagination')).not.toBeNull();

      configurar({ ...BANDEJA_CONFIG_DE_MUESTRA, documentRows: [] });
      expect(vacio()).toBeNull();
      expect(el().textContent).toContain('Aún no se encontraron resultados.');
      expect(el().querySelector('siaf-pagination')).not.toBeNull();
    });
  });

  describe('historial del documento', () => {
    const conAtributos: Partial<DocumentsRecordsConfig> = {
      buildDocumentHistory: (fila) => ({
        attributesTitle: 'Atributos del asiento',
        attributes: [{ label: 'N° documento contable', value: `DC-${fila['documentId']}` }],
        staticRows: HISTORIAL_DOCUMENTO_DE_MUESTRA,
      }),
    };

    function abrirHistorial(indice: number): void {
      el().querySelectorAll<HTMLButtonElement>('siaf-documents-records-table button[aria-label="Historial de documento"]')[indice].click();
      fixture.detectChanges();
    }

    it('abierto, un refresco de la configuración (polling) no le cambia el número, la solicitud ni los atributos', () => {
      const config: DocumentsRecordsConfig = { ...BANDEJA_CONFIG_DE_MUESTRA, ...conAtributos, documentRows: filas(10), serverQuery: { total: 12 } };
      configurar(config);
      abrirHistorial(2);
      expect(panelHistorial()?.textContent).toContain('PCC-SCC-00003-2026-MEF-DGCP');

      // El refresco trae la bandeja de nuevo (objetos nuevos) y con otra primera fila.
      configurar({ ...config, documentRows: filas(10, 20) });

      expect(pagina.documentHistoryOpen).toBeTrue();
      expect(pagina.selectedHistorySummary.solicitudId).toBe('doc-00003');
      expect(pagina.selectedHistorySummary.number).toBe('PCC-SCC-00003-2026-MEF-DGCP');
      const texto = panelHistorial()?.textContent ?? '';
      expect(texto).toContain('PCC-SCC-00003-2026-MEF-DGCP');
      expect(texto).not.toContain('PCC-SCC-00020-2026-MEF-DGCP');
      expect(texto).toContain('Atributos del asiento');
      expect(texto).toContain('DC-doc-00003');
    });

    it('cerrado, el resumen se sigue actualizando con la primera fila de la configuración nueva', () => {
      const config: DocumentsRecordsConfig = { ...BANDEJA_CONFIG_DE_MUESTRA, ...conAtributos, documentRows: filas(10), serverQuery: { total: 12 } };
      configurar(config);
      abrirHistorial(2);
      pagina.closeDocumentHistory();
      fixture.detectChanges();

      configurar({ ...config, documentRows: filas(10, 20) });

      expect(pagina.selectedHistorySummary).toEqual({
        solicitudId: '',
        document: 'Solicitud de Creación de Cuenta Contable',
        number: 'PCC-SCC-00020-2026-MEF-DGCP',
        actionType: 'Creación',
      });
    });
  });
});
