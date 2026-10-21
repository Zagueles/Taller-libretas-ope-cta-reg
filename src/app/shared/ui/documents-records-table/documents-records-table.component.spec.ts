import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ESPERA_AL_SALIR_MS } from '../tooltip/tooltip.directive';
import { DocumentsRecordsTableComponent } from './documents-records-table.component';
import type { DocumentsRecordsColumn, DocumentsRecordsRow } from '../../types/documents-records.types';

/** N° de documento largo: el formato real del sistema, que se corta en la columna. */
const NUMERO_LARGO = 'SCMPC-SPC-0001-2026-MEF-DGCP-UNIDAD-EJECUTORA-DE-PRUEBA-MUY-LARGA';

describe('DocumentsRecordsTableComponent — tooltip de textos truncados', () => {
  let fixture: ComponentFixture<DocumentsRecordsTableComponent>;

  const columns: DocumentsRecordsColumn[] = [
    { key: 'document', label: 'N° Documento', visibility: 'visible', group: 'default', widthClass: 'w-[440px]', kind: 'document-link' },
    { key: 'entidad', label: 'Entidad', visibility: 'visible', group: 'default' }
  ];

  const rows: DocumentsRecordsRow[] = [{ number: '1', document: NUMERO_LARGO, entidad: NUMERO_LARGO }];

  beforeEach(async () => {
    // El tooltip por hover solo actúa en dispositivos con hover real, y un
    // Chrome headless sin puntero (el del CI en Linux) reporta `hover: none`.
    // Forzamos la consulta para que estos specs no dependan del entorno.
    spyOn(window, 'matchMedia').and.returnValue({ matches: true } as MediaQueryList);

    await TestBed.configureTestingModule({
      imports: [DocumentsRecordsTableComponent],
      providers: [provideRouter([]), provideHttpClient()]
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentsRecordsTableComponent);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('documentRoute', () => '/');
    // El host debe estar en el layout real para que scrollWidth/clientWidth midan.
    fixture.nativeElement.style.width = '320px';
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.querySelectorAll('[role="tooltip"]').forEach((t) => t.remove());
    fixture.nativeElement.remove();
  });

  function tooltipVisible(): HTMLElement | null {
    return document.body.querySelector('[role="tooltip"]');
  }

  it('muestra el N° de documento completo al pasar el mouse sobre el enlace truncado', () => {
    const enlace: HTMLElement = fixture.nativeElement.querySelector('a');
    expect(enlace.scrollWidth).toBeGreaterThan(enlace.clientWidth);

    enlace.dispatchEvent(new MouseEvent('mouseenter'));

    expect(tooltipVisible()?.textContent).toBe(NUMERO_LARGO);
  });

  it('muestra el contenido completo de una celda de texto truncada', () => {
    // La celda muestra hasta 3 líneas y recién ahí se recorta (line-clamp): el texto largo de la columna estrecha pasa de 3.
    const celda: HTMLElement = fixture.nativeElement.querySelector('tbody span.line-clamp-3');
    (celda.closest('td') as HTMLElement).style.maxWidth = '80px';

    celda.dispatchEvent(new MouseEvent('mouseenter'));

    expect(tooltipVisible()?.textContent).toBe(NUMERO_LARGO);
  });

  it('un texto de hasta 3 líneas se muestra completo, sin recorte ni tooltip', () => {
    fixture.componentRef.setInput('rows', [{ number: '1', document: 'A-1', entidad: 'Ministerio de Comercio Exterior y Turismo' }]);
    fixture.detectChanges();
    const celda: HTMLElement = fixture.nativeElement.querySelector('tbody span.line-clamp-3');

    expect(celda.scrollHeight).toBeLessThanOrEqual(celda.clientHeight + 1);
    celda.dispatchEvent(new MouseEvent('mouseenter'));
    expect(tooltipVisible()).toBeNull();
  });

  it('no muestra tooltip cuando el texto entra completo', () => {
    fixture.componentRef.setInput('rows', [{ number: '1', document: 'A-1', entidad: 'B' }]);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('a').dispatchEvent(new MouseEvent('mouseenter'));

    expect(tooltipVisible()).toBeNull();
  });

  it('oculta el tooltip al salir el mouse, tras la espera que permite llevar el puntero al globo', fakeAsync(() => {
    const enlace: HTMLElement = fixture.nativeElement.querySelector('a');

    enlace.dispatchEvent(new MouseEvent('mouseenter'));
    enlace.dispatchEvent(new MouseEvent('mouseleave'));
    tick(ESPERA_AL_SALIR_MS);

    expect(tooltipVisible()).toBeNull();
  }));
});

describe('DocumentsRecordsTableComponent — orden', () => {
  const columnas: DocumentsRecordsColumn[] = [
    { key: 'sec', label: 'Sec.', headerGroup: 'Acreditación', visibility: 'visible', group: 'default', sortable: true },
    { key: 'fecha', label: 'Fecha', headerGroup: 'Acreditación', visibility: 'visible', group: 'default' },
    { key: 'tipo', label: 'Tipo', visibility: 'visible', group: 'default', sortable: true },
  ];
  const crear = (sort: { key: string; direction: 'asc' | 'desc' } | null = null) => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(DocumentsRecordsTableComponent);
    fixture.componentRef.setInput('activeTab', 'records');
    fixture.componentRef.setInput('columns', columnas);
    fixture.componentRef.setInput('rows', []);
    fixture.componentRef.setInput('sort', sort);
    fixture.detectChanges();
    return fixture;
  };
  const botones = (f: ReturnType<typeof crear>) => Array.from<HTMLButtonElement>((f.nativeElement as HTMLElement).querySelectorAll('thead th button'));

  it('solo las columnas sortable llevan botón en su título, sean de un grupo o sueltas', () => {
    const f = crear();
    expect(botones(f).map((b) => b.textContent!.replace(/arrow_\w+/, '').trim())).toEqual(['Tipo', 'Sec.']);
    expect(botones(f).map((b) => b.getAttribute('aria-label'))).toEqual(['Ordenar por Tipo', 'Ordenar por Sec.']);
  });

  it('marca aria-sort en la columna ordenada y emite el siguiente orden al pulsar', () => {
    const f = crear({ key: 'sec', direction: 'asc' });
    const emitidos: unknown[] = [];
    f.componentInstance.sortChange.subscribe((o) => emitidos.push(o));
    const ths = Array.from((f.nativeElement as HTMLElement).querySelectorAll('thead th'));
    expect(ths.filter((th) => th.getAttribute('aria-sort') === 'ascending').length).toBe(1);
    botones(f).find((b) => b.textContent!.includes('Sec.'))!.click();
    botones(f).find((b) => b.textContent!.includes('Tipo'))!.click();
    expect(emitidos).toEqual([{ key: 'sec', direction: 'desc' }, { key: 'tipo', direction: 'asc' }]);
  });
});
