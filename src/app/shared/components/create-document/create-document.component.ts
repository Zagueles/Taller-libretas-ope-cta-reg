import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, inject, Input, OnChanges, Output } from '@angular/core';

import { ButtonComponent } from '../../ui/button/button.component';
import { IconComponent } from '../../ui/icon/icon.component';
import { DEFAULT_PROCESS_TREE, ProcessMenuNode } from '../../utils/process-tree.util';
import { SelectOption, SelectOptionsComponent } from '../../ui/select-options/select-options.component';
import { TooltipDirective } from '../../ui/tooltip/tooltip.directive';
import { FocoDirective } from '../../ui/foco/foco.directive';
import { ProcessMenuTreeComponent } from '../../../layout/process-menu-tree/process-menu-tree.component';

export type CreateDocumentVariant = 'sidepanel' | 'dropdown';

export type CreateDocumentField = {
  placeholder: string;
  type?: 'search' | 'select';
  value?: string;
  required?: boolean;
  options?: string[];
  disabled?: boolean;
};

export type CreateDocumentSelection = {
  placeholder: string;
  value: string;
};

export type CreateDocumentAccepted = {
  processId?: string;
  processLabel?: string;
  document?: string;
  actionType?: string;
  route?: string;
};

export type CreateDocumentOption = {
  label: string;
  route?: string;
  actionTypes?: string[];
};

export type CreateDocumentProcessOption = {
  id: string;
  label: string;
  route?: string;
  documents: string[];
  documentOptions?: CreateDocumentOption[];
  actionTypes: string[];
};

// Las opciones del buscador salen del arbol de procesos para no duplicar catalogos a mano.
const CREATE_DOCUMENT_PROCESSES: CreateDocumentProcessOption[] = collectProcessOptions(DEFAULT_PROCESS_TREE);

/**
 * Formulario «Crear documento»: pide proceso, documento y tipo de acción y emite `accepted` con esa selección y la ruta
 * de la solicitud a abrir. La variante `sidepanel` (panel del shell) elige el proceso en el mismo árbol de procesos del menú (se abre al
 * tocar el buscador, con flecha para regresar); el árbol se poda a los procesos de `processOptions` (los que tienen creación habilitada), abiertos y como hojas; `dropdown` (popover) solo pide documento y tipo de acción.
 * Con `fields` el padre controla los campos y recibe cada cambio por `fieldValueChange`.
 *
 * @usar
 * - Desde «Crear» del sidebar o del menú móvil: el shell lo abre como `sidepanel` con las opciones que arma de los tipos
 *   de documento del API.
 * - En la bandeja, como popover del botón «Crear documento» de `siaf-documents-records-page` (`dropdown` con `fields`
 *   controlados para Documento y Tipo de acción).
 * @evitar
 * - Pintar otro `sidepanel` en una página: pedir el del shell con `ShellNavigationService.openCreateDocument()`.
 * - Para los campos de la solicitud misma: usar `siaf-input` dentro de `siaf-solicitude-page-layout`.
 * - Para elegir un registro de un catálogo con columnas: usar `siaf-selection-side-nav`.
 * - Copiar a mano la lista de procesos: sale de `DEFAULT_PROCESS_TREE` o de `processOptions`.
 * @teclado
 * - **Tab**: recorre el buscador de procesos (en `sidepanel`), Documento, Tipo de acción y Cancelar / Aceptar;
 *   Documento y Tipo de acción siguen deshabilitados hasta elegir el campo anterior.
 * - **Enter / Espacio** en Documento o Tipo de acción: abre o cierra sus opciones; al abrir, el foco entra en la
 *   opción elegida, que sigue `siaf-select-options` (flechas, Inicio, Fin, Enter o Espacio). Escape o salir con Tab
 *   las cierra y el foco vuelve al campo.
 * - **Enter / Flecha abajo / clic** en el buscador de procesos: abre el árbol; ahí se navega como en el menú de procesos y la
 *   flecha «Regresar» vuelve al formulario.
 * - **Enter / Espacio** en Cancelar y Aceptar: emiten `canceled` y `accepted`.
 * @accesibilidad
 * - **2.1.1 Teclado (A)**: el buscador abre el árbol con Enter, flecha abajo o clic; el árbol y su botón «Regresar» se usan con teclado.
 * - **2.4.7 Foco visible (AA)**: Documento, Tipo de acción y el buscador muestran el borde azul de 2 px
 *   (`border-states-focus`, 5.35:1 claro / 10.15:1 oscuro) al recibir el foco, también si ya tienen valor.
 * - **2.4.3 Orden del foco (A)**: con `siafFoco`, las opciones de Documento y Tipo de acción reciben el foco al abrir y
 *   al elegir, cerrar con Escape o salir con Tab vuelve al campo; al elegir un proceso el foco vuelve al buscador.
 * - **4.1.2 Nombre, función y valor (A)**: el buscador es de solo lectura con `aria-haspopup="tree"`; Documento y Tipo de acción
 *   publican `aria-expanded` y `aria-haspopup="listbox"`. El botón de regresar del árbol lleva `aria-label="Regresar"`.
 * - **Pendiente · 1.4.11 Contraste no textual (AA)**: el borde de los campos en reposo es `border-states-enabled`
 *   (2.44:1 / 2.59:1); el de foco, `border-states-focus` (5.35:1 / 10.15:1), sí cumple.
 * - **3.3.2 Etiquetas o instrucciones (A)**: cada campo muestra su nombre (en el placeholder o como etiqueta flotante)
 *   con asterisco en los obligatorios; no llevan `aria-required`.
 * - **1.3.1 Información y relaciones (A)**: sección con `aria-label="Crear documento"` (fijo aunque cambie `title`) y
 *   título `h2`; cada campo va dentro de su `<label>`.
 * - **1.4.3 Contraste mínimo (AA)**: texto `text-neutral-medium` (14.53:1 / 12.87:1) y placeholder `text-neutral-low`
 *   (5.01:1 / 8.86:1) sobre el `bg-surface` de los campos.
 */
@Component({
  selector: 'siaf-create-document',
  standalone: true,
  imports: [FocoDirective, ButtonComponent, IconComponent, NgClass, ProcessMenuTreeComponent, SelectOptionsComponent, TooltipDirective],
  template: `
    @if (treeOpen) {
      <siaf-process-menu-tree [nodes]="treeNodes" [showBack]="true" [expandAll]="true" (back)="cerrarArbol()" (nodeSelected)="onTreeNode($event)" />
    } @else {
    <section
      class="flex flex-col items-start bg-[var(--sys-color-bg-surfaces-field,var(--sys-color-bg-surfaces-surface))]"
      [ngClass]="variantClass"
      aria-label="Crear documento"
    >
      <header class="flex min-h-14 w-full items-center gap-siaf-xs p-siaf-md">
        <h2 class="m-0 min-h-6 text-base font-bold uppercase leading-6 tracking-[0.02px] text-[var(--sys-color-text-neutral-high)]">
          {{ title }}
        </h2>
      </header>

      <div
        class="flex w-full items-start"
        [ngClass]="variant === 'sidepanel' ? 'min-h-0 flex-1' : 'bg-[var(--sys-color-bg-surfaces-field,var(--sys-color-bg-surfaces-surface))]'"
      >
        <div
          class="flex min-w-0 flex-1 flex-col px-siaf-md"
          [ngClass]="variant === 'sidepanel' ? 'h-full py-siaf-xs' : 'pb-siaf-xs'"
        >
          <div class="flex w-full flex-col gap-siaf-lg">
            @for (field of resolvedFields; track field.placeholder) {
              <label class="relative block h-10 w-full">
                @if (isFieldFloating(field)) {
                  <span
                    class="absolute -top-2.5 left-3 z-[1] rounded-siaf-sm bg-surface px-siaf-xxs text-xs font-medium leading-normal"
                    [class.text-[var(--sys-color-text-neutral-activated)]]="focusedField === field.placeholder"
                    [class.text-[var(--sys-color-text-neutral-low)]]="focusedField !== field.placeholder"
                  >
                    {{ field.placeholder }}@if (field.required) { <span class="text-[var(--sys-color-text-feedback-danger)]">*</span> }
                  </span>
                }

                @if (field.type === 'select') {
                  <div class="relative">
                    <button
                      class="flex min-h-10 w-full items-center rounded-siaf-md bg-surface py-siaf-xs pl-siaf-md pr-siaf-sm text-left text-sm font-normal tracking-[0.025px] text-[var(--sys-color-text-neutral-medium)] outline-none transition focus:border-2 focus:border-[var(--sys-color-border-states-focus)] disabled:cursor-not-allowed disabled:border disabled:border-[var(--sys-color-border-states-disabled)] disabled:bg-[var(--sys-color-bg-surfaces-disabled)] disabled:text-[var(--sys-color-text-neutral-disabled)]"
                      [ngClass]="fieldControlClass(field)"
                      type="button"
                      [disabled]="field.disabled"
                      [attr.aria-expanded]="openedSelectField === field.placeholder"
                      aria-haspopup="listbox"
                      (click)="toggleSelect(field)"
                    >
                      <span class="min-w-0 flex-1 truncate" siafTooltip [class.text-[var(--sys-color-text-neutral-low)]]="!field.value">
                        {{ field.value || field.placeholder }}@if (!field.value && field.required) { <span class="text-[var(--sys-color-text-feedback-danger)]">*</span> }
                      </span>
                      <siaf-icon class="shrink-0 text-text transition" [class.rotate-180]="openedSelectField === field.placeholder" name="expand_more" [size]="24" />
                    </button>

                    @if (openedSelectField === field.placeholder) {
                      <button class="fixed inset-0 z-40 cursor-default bg-transparent" type="button" data-capa-cierre tabindex="-1" aria-hidden="true" (mousedown)="$event.preventDefault()" (click)="closeSelect()"></button>
                      <div class="absolute left-0 right-0 top-[calc(100%+4px)] z-50" siafFoco [siafFocoAtrapar]="false" (siafFocoEscape)="closeSelect()" (siafFocoSalida)="closeSelect()">
                        <siaf-select-options
                          [options]="fieldOptions(field)"
                          [selectedValue]="field.value || ''"
                          (selected)="onOptionSelected(field, $event)"
                        />
                      </div>
                    }
                  </div>
                } @else {
                  <div class="relative">
                    <input
                      class="min-h-10 w-full rounded-siaf-md bg-surface px-siaf-md py-siaf-xs text-sm font-normal tracking-[0.025px] text-[var(--sys-color-text-neutral-medium)] outline-none transition placeholder:text-[var(--sys-color-text-neutral-low)] disabled:cursor-not-allowed disabled:border disabled:border-[var(--sys-color-border-states-disabled)] disabled:bg-[var(--sys-color-bg-surfaces-disabled)] disabled:text-[var(--sys-color-text-neutral-disabled)]"
                      [ngClass]="fieldControlClass(field)"
                      type="search"
                      autocomplete="off"
                      [placeholder]="isFieldFloating(field) ? '' : optionPlaceholder(field)"
                      [value]="field.value || ''"
                      [disabled]="field.disabled"
                      readonly
                      aria-haspopup="tree"
                      (focus)="onSearchFocus(field)"
                      (blur)="focusedField = ''"
                      (click)="abrirArbol()"
                      (keydown.enter)="abrirArbol()"
                      (keydown.arrowDown)="abrirArbol()"
                    />
                  </div>
                }
              </label>
            }

            <div class="flex h-10 w-full items-start justify-end gap-siaf-sm">
              <siaf-button variant="secondary" size="md" (click)="canceled.emit()">Cancelar</siaf-button>
              <siaf-button variant="accent" size="md" [disabled]="resolvedAcceptDisabled" (click)="accept()">Aceptar</siaf-button>
            </div>
          </div>
        </div>
      </div>
    </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateDocumentComponent implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() variant: CreateDocumentVariant = 'sidepanel';
  @Input() title = 'Crear documento';
  @Input() acceptDisabled = false;
  @Input() fields: CreateDocumentField[] = [];
  @Input() processOptions: CreateDocumentProcessOption[] = CREATE_DOCUMENT_PROCESSES;
  focusedField = '';
  openedSelectField = '';
  treeOpen = false;
  treeNodes: ProcessMenuNode[] = this.armarArbol();
  private readonly internalValues = new Map<string, string>();

  @Output() canceled = new EventEmitter<void>();
  @Output() accepted = new EventEmitter<CreateDocumentAccepted>();
  @Output() fieldSelected = new EventEmitter<string>();
  @Output() fieldValueChange = new EventEmitter<CreateDocumentSelection>();

  get resolvedFields(): CreateDocumentField[] {
    if (this.fields.length > 0) {
      return this.fields;
    }

    // Si no llegan campos externos, el componente arma el flujo base de Crear documento.
    return this.variant === 'dropdown'
      ? [
          {
            placeholder: 'Documento',
            type: 'select',
            required: true,
            value: this.internalValues.get('Documento') || '',
            options: this.defaultProcessDocuments
          },
          {
            placeholder: 'Tipo de acci\u00f3n',
            type: 'select',
            required: true,
            value: this.internalValues.get('Tipo de acci\u00f3n') || '',
            options: this.defaultProcessActionTypes,
            disabled: this.defaultProcessActionTypes.length === 0
          }
        ]
      : [
          {
            placeholder: 'Buscar proceso o procedimiento',
            type: 'search',
            required: true,
            value: this.internalValues.get('Buscar proceso o procedimiento') || ''
          },
          {
            placeholder: 'Documento',
            type: 'select',
            required: true,
            value: this.internalValues.get('Documento') || '',
            options: this.selectedProcessDocuments,
            disabled: !this.selectedProcessDocuments.length
          },
          {
            placeholder: 'Tipo de acci\u00f3n',
            type: 'select',
            required: true,
            value: this.internalValues.get('Tipo de acci\u00f3n') || '',
            options: this.selectedProcessActionTypes,
            disabled: !this.selectedProcessActionTypes.length
          }
        ];
  }

  get selectedProcess(): CreateDocumentProcessOption | null {
    const selectedProcessId = this.internalValues.get('processId');
    return this.processOptions.find((process) => process.id === selectedProcessId) || null;
  }

  get resolvedAcceptDisabled(): boolean {
    return this.acceptDisabled || this.resolvedFields.some((field) => field.required && !field.value);
  }

  get variantClass(): string {
    return this.variant === 'dropdown'
      ? 'w-full max-w-[360px] rounded-siaf-md py-siaf-xs shadow-siaf-elevation-1'
      : 'h-[calc(100vh-56px)] w-screen border-r border-[var(--sys-color-divider-default)] shadow-siaf-elevation-1 lg:max-w-[370px]';
  }

  toggleSelect(field: CreateDocumentField): void {
    if (field.disabled) {
      return;
    }

    this.fieldSelected.emit(field.placeholder);
    this.openedSelectField = this.openedSelectField === field.placeholder ? '' : field.placeholder;
    this.focusedField = this.openedSelectField;
  }

  closeSelect(): void {
    this.openedSelectField = '';
    this.focusedField = '';
    this.cdr.markForCheck();
  }

  onOptionSelected(field: CreateDocumentField, value: string): void {
    this.openedSelectField = '';
    this.focusedField = '';

    if (this.fields.length === 0) {
      this.internalValues.set(field.placeholder, value);

      if (field.placeholder === 'Documento') {
        this.internalValues.delete('Tipo de acci\u00f3n');
      }
    }

    this.fieldValueChange.emit({
      placeholder: field.placeholder,
      value
    });
  }

  onSearchFocus(field: CreateDocumentField): void {
    this.focusedField = field.placeholder;
    this.openedSelectField = '';
  }

  selectProcess(process: CreateDocumentProcessOption): void {
    this.internalValues.set('processId', process.id);
    this.internalValues.set('Buscar proceso o procedimiento', process.label);
    this.internalValues.delete('Documento');
    this.internalValues.delete('Tipo de acci\u00f3n');
    this.focusedField = '';
    this.cdr.markForCheck();

    this.fieldValueChange.emit({
      placeholder: 'Buscar proceso o procedimiento',
      value: process.label
    });
  }

  /** El buscador de proceso abre el mismo árbol del menú de procesos, con la flecha para regresar al formulario. */
  abrirArbol(): void {
    if (this.fields.length > 0) return;
    this.treeOpen = true;
    this.focusedField = '';
    this.cdr.markForCheck();
  }

  cerrarArbol(): void {
    this.treeOpen = false;
    this.cdr.markForCheck();
  }

  /** Solo una hoja con algo por crear elige el proceso; las demás ramas se abren o cierran dentro del árbol. */
  onTreeNode(node: ProcessMenuNode): void {
    if (node.children?.length) return;
    const proceso = this.processOptions.find((p) => p.id === node.id);
    if (!proceso) return;
    this.selectProcess(proceso);
    this.treeOpen = false;
  }

  ngOnChanges(): void {
    this.treeNodes = this.armarArbol();
  }

  /**
   * El árbol de procesos podado a lo que se puede crear: solo quedan las ramas que llevan a un proceso de `processOptions`,
   * y ese proceso se muestra como hoja aunque en el menú tenga pantallas debajo.
   */
  private armarArbol(): ProcessMenuNode[] {
    const podar = (nodos: ProcessMenuNode[]): ProcessMenuNode[] =>
      nodos.flatMap((n) => {
        if (this.processOptions.some((p) => p.id === n.id)) return [{ id: n.id, label: n.label }];
        const hijos = n.children ? podar(n.children) : [];
        return hijos.length ? [{ id: n.id, label: n.label, children: hijos }] : [];
      });
    return podar(DEFAULT_PROCESS_TREE);
  }

  accept(): void {
    const selectedProcess = this.selectedProcess || this.defaultProcess;
    const document = this.internalValues.get('Documento') || this.externalFieldValue('Documento');
    const documentOption = this.findDocumentOption(selectedProcess, document);

    this.accepted.emit({
      processId: selectedProcess?.id,
      processLabel: this.internalValues.get('Buscar proceso o procedimiento') || selectedProcess?.label,
      document,
      actionType: this.internalValues.get('Tipo de acci\u00f3n') || this.externalFieldValue('Tipo de acción'),
      route: documentOption?.route || selectedProcess?.route
    });
  }

  fieldOptions(field: CreateDocumentField): SelectOption[] {
    const options = field.options || [];
    const normalizedOptions = field.value && !options.includes(field.value) ? [...options, field.value] : options;

    return normalizedOptions.map((option) => ({
      label: option,
      value: option
    }));
  }

  optionPlaceholder(field: CreateDocumentField): string {
    return `${field.placeholder}${field.required ? ' *' : ''}`;
  }

  isFieldFloating(field: CreateDocumentField): boolean {
    return this.focusedField === field.placeholder || this.openedSelectField === field.placeholder || Boolean(field.value);
  }

  isFieldSuccess(field: CreateDocumentField): boolean {
    return Boolean(field.value) && this.focusedField !== field.placeholder;
  }

  fieldControlClass(field: CreateDocumentField): string {
    if (field.disabled) {
      return 'border border-[var(--sys-color-border-states-disabled)]';
    }

    if (this.focusedField === field.placeholder || this.openedSelectField === field.placeholder) {
      return 'border-2 border-[var(--sys-color-border-states-focus)]';
    }

    if (this.isFieldSuccess(field)) {
      return 'border-2 border-[var(--sys-color-border-feedback-success)]';
    }

    return 'border border-[var(--sys-color-border-states-enabled)] hover:border-2 hover:border-[var(--sys-color-border-states-hover)]';
  }

  private get defaultProcess(): CreateDocumentProcessOption | null {
    return this.processOptions.find((process) => this.documentLabels(process).length > 0 && this.actionTypesForProcess(process).length > 0) || this.processOptions[0] || null;
  }

  private get defaultProcessDocuments(): string[] {
    return this.documentLabels(this.defaultProcess);
  }

  private get defaultProcessActionTypes(): string[] {
    return this.actionTypesForProcess(this.defaultProcess);
  }

  private get selectedProcessDocuments(): string[] {
    return this.documentLabels(this.selectedProcess);
  }

  private get selectedProcessActionTypes(): string[] {
    return this.actionTypesForProcess(this.selectedProcess);
  }

  private documentLabels(process: CreateDocumentProcessOption | null): string[] {
    if (!process) {
      return [];
    }

    return process.documentOptions?.map((document) => document.label) || process.documents;
  }

  private actionTypesForProcess(process: CreateDocumentProcessOption | null): string[] {
    if (!process) {
      return [];
    }

    const selectedDocument = this.internalValues.get('Documento') || this.externalFieldValue('Documento');

    if (process.documentOptions?.length && !selectedDocument) {
      return [];
    }

    const documentOption = this.findDocumentOption(process, selectedDocument);

    return documentOption?.actionTypes || process.actionTypes;
  }

  private findDocumentOption(process: CreateDocumentProcessOption | null | undefined, document: string): CreateDocumentOption | undefined {
    return process?.documentOptions?.find((option) => option.label === document);
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private externalFieldValue(placeholder: string): string {
    return this.fields.find((field) => field.placeholder === placeholder)?.value || '';
  }
}

function collectProcessOptions(nodes: ProcessMenuNode[]): CreateDocumentProcessOption[] {
  return nodes.flatMap((node) => {
    const children = node.children ? collectProcessOptions(node.children) : [];

    if (node.children?.length) {
      return children;
    }

    // Solo los nodos hoja aparecen como resultados; los que tienen metadata habilitan el flujo completo.
    return [
      ...children,
      {
        id: node.id,
        label: node.label,
        route: node.createRoute,
        documents: node.documentOptions || [],
        documentOptions: node.documentCreateOptions,
        actionTypes: node.actionTypeOptions || []
      }
    ];
  });
}
