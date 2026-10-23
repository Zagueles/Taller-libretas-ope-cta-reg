import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';

import { IconComponent } from '../../shared/ui/icon/icon.component';
import { DEFAULT_PROCESS_TREE, ProcessMenuNode } from '../../shared/utils/process-tree.util';
import { TextFieldComponent } from '../../shared/ui/text-field/text-field.component';

// El árbol/tipo/utilidad de búsqueda viven en shared/utils/process-tree.util
// (shared no puede depender de layout). Se re-exportan acá para no romper a
// los consumidores existentes que ya importan desde este archivo.
export type { ProcessMenuNode };
export { DEFAULT_PROCESS_TREE, findProcessPathById } from '../../shared/utils/process-tree.util';

/**
 * Árbol canónico de procesos del shell: el menú jerárquico que abre la opción "Procesos" del sidebar.
 *
 * Sus datos por defecto son `DEFAULT_PROCESS_TREE` de `shared/utils/process-tree.util` (este archivo solo
 * re-exporta el tipo y las utilidades). Es el único menú en árbol: el shell también lo usa para "Ajustes" con
 * `ADMIN_MENU_TREE` y otros textos, así que un árbol nuevo es solo otro arreglo de nodos. El campo de búsqueda
 * funciona como paleta de comandos: filtra la navegación en vivo, sin ir al servidor, y expande las ramas
 * con coincidencias, resalta en negrita el texto buscado (sin distinguir tildes ni mayúsculas) y, sin coincidencias, muestra
 * «Sin resultados» con el texto buscado. Los nodos `comingSoon` solo expanden — nunca emiten `nodeSelected`.
 *
 * @usar
 * - Para el panel Procesos del armazón: `siaf-app-shell` lo abre desde el rail y navega a la `moduleRoute` o
 *   `createRoute` del nodo emitido (plan de cuentas contables, catálogo de eventos, asientos de ajuste, apertura
 *   contable…).
 * - Para el menú Ajustes: el mismo componente con `ADMIN_MENU_TREE` y sus textos (`title`, `subtitle`, `placeholder`,
 *   `searchLabel`), con gestión de usuarios, entidades y auditoría.
 * - Para cualquier menú jerárquico nuevo del armazón: basta otro arreglo de `ProcessMenuNode`.
 * @evitar
 * - Para envolverlo o copiarlo en otro componente de menú: por eso se retiró `siaf-admin-menu`; basta pasarle otros
 *   `nodes` y textos.
 * - Para mostrar datos jerárquicos de solo lectura dentro de una pantalla: usar `siaf-tree-view`.
 * - Para buscar registros en el servidor: usar `siaf-form-table-search` (en Documentos y registros y la bandeja, su
 *   variante `siaf-records-search-toolbar`); este buscador solo filtra la navegación en memoria.
 * @teclado
 * - **Tab**: pasa por el buscador y su lupa, y luego por los nodos visibles en orden. La lupa no hace nada: el filtro
 *   se aplica al escribir.
 * - **Escribir en el buscador**: filtra el árbol en vivo, sin distinguir tildes ni mayúsculas, y abre las ramas con
 *   coincidencias.
 * - **Enter / Espacio** en un nodo: lo marca y emite `nodeSelected`; si tiene hijos, además los muestra u oculta. Los
 *   nodos `comingSoon` solo expanden.
 * @accesibilidad
 * - **Pendiente · 1.3.1 Información y relaciones (A)**: es un `<aside>` con `h2` y `h3`, pero la jerarquía solo se ve
 *   (sangría y línea a la izquierda): los nodos son botones en `div` anidados, sin `ul`/`li` ni `role="tree"`, y el
 *   lector no anuncia nivel ni cantidad. Además, el `aria-label` del `aside` es fijo («Menu de procesos») y también se
 *   lee en Ajustes.
 * - **1.4.1 Uso del color (A)**: el nodo elegido se distingue por el fondo `bg-states-light-selected`, el color de
 *   texto e ícono y, además, la negrita — no solo por el color.
 * - **1.4.3 Contraste mínimo (AA)**: en claro, título `text-neutral-high` 16.29:1 y nodos `text-neutral-medium` 14.53:1
 *   sobre blanco; en oscuro el panel usa `bg-surfaces-field` y falta medirlo.
 * - **1.4.11 Contraste no textual (AA)**: el contorno de foco es el azul del kit (`border-states-focus`, 5.35:1 claro
 *   / 10.15:1 oscuro sobre la superficie).
 * - **Pendiente · 2.4.3 Orden del foco (A)**: no toma el foco al abrirse ni cierra con Escape. El armazón lo pinta
 *   después del rail: desde Procesos el Tab pasa antes por Ayuda y Ajustes, y si lo pide una página
 *   (`ShellNavigationService`) queda antes que el botón que lo abrió.
 * - **2.4.7 Foco visible (AA)**: cada nodo muestra un contorno azul de 2 px con `focus-visible`.
 * - **Pendiente · 4.1.2 Nombre, función y valor (A)**: los nodos con hijos publican `aria-expanded`, pero el elegido no
 *   publica `aria-current`.
 * - **Pendiente · 4.1.3 Mensajes de estado (AA)**: al filtrar no se anuncia cuántos nodos quedan. Sin coincidencias se
 *   muestra «Sin resultados» (`role="status"`) con el texto buscado.
 */
@Component({
  selector: 'siaf-process-menu-tree',
  standalone: true,
  imports: [TextFieldComponent, IconComponent, NgTemplateOutlet],
  template: `
    <aside
      class="flex h-[calc(100vh-56px)] w-screen flex-col bg-[var(--sys-color-bg-surfaces-field,var(--sys-color-bg-surfaces-surface))] text-text shadow-siaf-elevation-1 lg:max-w-[370px]"
      aria-label="Menu de procesos"
    >
      <header class="sticky top-0 z-[2] flex min-h-14 w-full items-center gap-siaf-xs p-siaf-md bg-[var(--sys-color-bg-surfaces-field,var(--sys-color-bg-surfaces-surface))]">
        @if (showBack) {
          <button class="inline-flex size-6 shrink-0 items-center justify-center rounded-siaf-sm text-[var(--sys-color-text-neutral-high)] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]" type="button" aria-label="Regresar" (click)="back.emit()">
            <siaf-icon name="arrow_back" [size]="24" />
          </button>
        }
        <h2 class="m-0 min-h-6 text-base font-bold uppercase leading-6 tracking-[0.02px] text-[var(--sys-color-text-neutral-high)]">
          {{ title }}
        </h2>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto bg-[var(--sys-color-bg-surfaces-field,var(--sys-color-bg-surfaces-surface-highest))] px-siaf-md py-siaf-xs">
        <!-- Campo del design system: etiqueta flotante y borde de éxito, igual
             que el resto de inputs. A diferencia de los buscadores de datos,
             este filtra la NAVEGACIÓN al teclear (paleta de comandos): el
             tecleo filtra en vivo y no hay viaje al servidor que ahorrar. -->
        <siaf-input
          class="block w-full"
          [label]="placeholder"
          [value]="query"
          trailingIcon="search"
          [trailingButtonLabel]="searchLabel"
          (valueChange)="onQuery($any($event))"
        />

        <section class="flex w-full flex-col gap-siaf-md overflow-hidden pt-siaf-lg">
          <h3 class="m-0 text-[11px] font-medium uppercase leading-normal tracking-[0.66px] text-[var(--sys-color-text-neutral-medium)]">
            {{ subtitle }}
          </h3>

          @if (query.trim() && filteredNodes.length === 0) {
            <!-- Sin coincidencias (Figma 20687:3137): ícono de búsqueda tachada, «Sin resultados» y el texto buscado. -->
            <div class="flex h-[200px] w-full flex-col items-center justify-center gap-siaf-md text-center" role="status" data-sin-resultados>
              <siaf-icon class="text-[var(--sys-color-text-neutral-medium)]" name="search_off" [size]="48" />
              <p class="m-0 flex flex-col gap-siaf-md text-sm text-[var(--sys-color-text-neutral-medium)]">
                <strong class="font-bold tracking-[-0.02px] text-[var(--sys-color-text-neutral-medium)]">Sin resultados</strong>
                <span class="tracking-[0.0249px]">No hay coincidencias para "{{ query.trim() }}"</span>
              </p>
            </div>
          } @else {
            <div class="flex w-full flex-col gap-siaf-xxs">
              <ng-container *ngTemplateOutlet="treeTemplate; context: { $implicit: filteredNodes, level: 0 }" />
            </div>
          }
        </section>
      </div>
    </aside>

    <!-- Árbol según Figma 268:68981: cada fila es un «summary-item» (8 px de relleno, 8 px entre ícono de 20 px y texto);
         los hijos van sangrados 16 px con una línea guía a su izquierda y 4 px antes de su primera fila; 4 px entre filas. -->
    <ng-template #treeTemplate let-items let-level="level">
      @for (node of items; track node.id) {
        <div class="flex w-full flex-col">
          <button
            class="group flex w-full items-center gap-siaf-xs rounded-siaf-sm p-siaf-xs text-left transition duration-150 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)] active:scale-[0.995]"
            type="button"
            [class.bg-[var(--sys-color-bg-states-light-selected)]]="isNodeHighlighted(node)"
            [class.hover:bg-[var(--sys-color-bg-states-light-hover)]]="!isNodeHighlighted(node)"
            [class.active:bg-[var(--sys-color-bg-states-light-pressed)]]="!isNodeHighlighted(node)"
            [attr.aria-expanded]="hasChildren(node) ? isExpanded(node) : null"
            (click)="activate(node)"
          >
            @if (hasChildren(node)) {
              <siaf-icon
                class="h-5 shrink-0 leading-none transition-transform duration-150"
                [class.text-[var(--sys-color-icon-states-active)]]="isNodeHighlighted(node)"
                [class.text-[var(--sys-color-icon-states-enabled)]]="!isNodeHighlighted(node)"
                name="arrow_drop_down"
                [size]="20"
                [class.-rotate-90]="!isExpanded(node)"
              />
            } @else if (!node.moduleRoute && !node.hideIcon) {
              <!-- Los nodos «Próximamente» (sin hijos ni pantalla) muestran la misma flecha que Figma, solo
                   decorativa. -->
              <siaf-icon
                class="h-5 shrink-0 leading-none"
                [class.text-[var(--sys-color-icon-states-active)]]="isNodeHighlighted(node)"
                [class.text-[var(--sys-color-icon-states-enabled)]]="!isNodeHighlighted(node)"
                name="arrow_right"
                [size]="20"
              />
            } @else {
              <!-- Una hoja con pantalla es el último nivel: sin flecha, pero con su hueco de 20 px para alinear el texto. -->
              <span class="w-5 shrink-0 self-stretch" aria-hidden="true"></span>
            }

            <span
              class="min-w-0 flex-1 text-sm leading-5"
              [class.font-bold]="isNodeHighlighted(node)"
              [class.font-normal]="!isNodeHighlighted(node)"
              [class.tracking-[-0.02px]]="isNodeHighlighted(node)"
              [class.tracking-[0.0249px]]="!isNodeHighlighted(node)"
              [class.text-[var(--sys-color-text-neutral-activated)]]="isNodeHighlighted(node)"
              [class.text-[var(--sys-color-text-neutral-medium)]]="!isNodeHighlighted(node)"
            >
              @for (parte of partes(node.label); track $index) {@if (parte.resaltada) {<strong class="font-bold tracking-[-0.02px]" data-coincidencia>{{ parte.texto }}</strong>} @else {{{ parte.texto }}}}
            </span>
          </button>

          @if (hasChildren(node) && isExpanded(node)) {
            <div class="w-full pl-siaf-md">
              <div class="flex w-full flex-col gap-siaf-xxs border-l pl-siaf-xxs" style="border-color: var(--sys-color-divider-strong)">
                <ng-container *ngTemplateOutlet="treeTemplate; context: { $implicit: node.children || [], level: level + 1 }" />
              </div>
            </div>
          }
        </div>
      }
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProcessMenuTreeComponent implements OnChanges, OnInit {
  @Input() title = 'Procesos';
  @Input() subtitle = 'Seleccionar proceso o procedimiento';
  @Input() placeholder = 'Buscar proceso o procedimiento';
  @Input() searchLabel = 'Buscar proceso o procedimiento';
  @Input() nodes: ProcessMenuNode[] = DEFAULT_PROCESS_TREE;

  /** Muestra la flecha para regresar junto al título (cuando el árbol se abre desde otro formulario). */
  @Input() showBack = false;
  /** Arranca con todas las ramas abiertas (el árbol podado de «Crear documento» es corto). */
  @Input() expandAll = false;

  @Output() nodeSelected = new EventEmitter<ProcessMenuNode>();
  @Output() back = new EventEmitter<void>();

  query = '';
  selectedId = '';
  private readonly expandedIds = new Set<string>();

  ngOnInit(): void {
    this.initializeState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nodes']) {
      this.initializeState();
    }
  }

  get filteredNodes(): ProcessMenuNode[] {
    const search = this.normalize(this.query);

    if (!search) {
      return this.nodes;
    }

    return this.filterNodes(this.nodes, search);
  }

  activate(node: ProcessMenuNode): void {
    // Los nodos marcados como pendientes solo expanden/colapsan si
    // tienen hijos. No se selecciona ni se emite navegacion para evitar
    // que el shell intente abrir una ruta inexistente.
    if (node.comingSoon) {
      if (this.hasChildren(node)) {
        this.toggle(node);
      }
      return;
    }

    this.selectedId = node.id;

    if (this.hasChildren(node)) {
      this.toggle(node);
    }

    this.nodeSelected.emit(node);
  }

  hasChildren(node: ProcessMenuNode): boolean {
    return Boolean(node.children?.length);
  }

  isExpanded(node: ProcessMenuNode): boolean {
    return Boolean(this.query) || this.expandedIds.has(node.id);
  }

  /** Solo el último nivel elegido queda resaltado (fondo, texto e ícono en azul y negrita): nunca sus ancestros. */
  isNodeHighlighted(node: ProcessMenuNode): boolean {
    return this.selectedId === node.id;
  }

  /** El texto de un nodo partido en tramos: lo que coincide con la búsqueda (sin tildes ni mayúsculas) va en negrita. */
  partes(label: string): { texto: string; resaltada: boolean }[] {
    const buscado = this.normalize(this.query);
    if (!buscado) return [{ texto: label, resaltada: false }];
    // `normalize` conserva el largo del texto (quita solo las marcas de tilde), así que los índices valen para `label`.
    const base = this.normalize(label.normalize('NFC'));
    const original = label.normalize('NFC');
    const tramos: { texto: string; resaltada: boolean }[] = [];
    let desde = 0;
    for (let i = base.indexOf(buscado); i !== -1; i = base.indexOf(buscado, desde)) {
      if (i > desde) tramos.push({ texto: original.slice(desde, i), resaltada: false });
      tramos.push({ texto: original.slice(i, i + buscado.length), resaltada: true });
      desde = i + buscado.length;
    }
    if (desde < original.length) tramos.push({ texto: original.slice(desde), resaltada: false });
    return tramos.length ? tramos : [{ texto: label, resaltada: false }];
  }

  onQuery(value: string): void {
    this.query = String(value ?? '');
  }

  onSearch(event: Event): void {
    this.query = (event.target as HTMLInputElement).value;
  }

  private toggle(node: ProcessMenuNode): void {
    if (this.expandedIds.has(node.id)) {
      this.expandedIds.delete(node.id);
      return;
    }

    this.expandedIds.add(node.id);
  }

  private initializeState(): void {
    this.expandedIds.clear();
    this.selectedId = '';
    this.collectState(this.nodes);
  }

  private collectState(nodes: ProcessMenuNode[], parentId = ''): void {
    for (const node of nodes) {
      // Evita que hijos profundos arranquen abiertos aunque alguien agregue expanded por error.
      if ((node.expanded && !parentId) || (this.expandAll && node.children?.length)) {
        this.expandedIds.add(node.id);
      }

      if (node.selected) {
        this.selectedId = node.id;
      }

      if (node.children?.length) {
        this.collectState(node.children, node.id);
      }
    }
  }

  private filterNodes(nodes: ProcessMenuNode[], search: string): ProcessMenuNode[] {
    const result: ProcessMenuNode[] = [];

    for (const node of nodes) {
      const children = node.children ? this.filterNodes(node.children, search) : [];
      const matches = this.normalize(node.label).includes(search);

      if (!matches && children.length === 0) {
        continue;
      }

      result.push({
        ...node,
        // Durante la busqueda se abren las ramas que contienen coincidencias para mostrar contexto.
        expanded: true,
        children: children.length > 0 ? children : node.children
      });
    }

    return result;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
