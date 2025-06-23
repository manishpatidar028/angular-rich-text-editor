import {
  Component,
  ElementRef,
  forwardRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  AfterViewInit,
  Injector,
  Inject,
  Optional,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  NG_VALIDATORS,
  NgControl,
  Validator,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { RichTextEditorService } from './rich-text-editor.service';
import {
  RTE_TOOLBAR_PRESETS,
  RTEImageTool,
  RTEPreset,
} from './rich-text-editor.constant';
import { RTE_LICENSE_KEY } from './rich-text-editor-license.token';
import { cleanToolbarString } from './utils/toolbar-cleaner';
import { EditorEventManager } from './utils/editor-event-manager';
import {
  patchRemoveChildIfDetached,
  safeCleanupFloatingPanels,
} from './utils/dom-cleanup';
import { hasRequiredValidator, isTrulyEmpty } from './utils/validation-utils';

declare var RichTextEditor: any;

/**
 * Configuration options for the toolbar
 */
export interface RichTextEditorConfig {
  height?: number;
  width?: number | string;
  toolbar?: string;
  toolbar_custom?: string;
  [key: string]: any;
}

@Component({
  selector: 'lib-rich-text-editor',
  template: `
    <div #editorContainer [class.invalid]="showError"></div>
    <div class="error-message" *ngIf="showError">
      {{ currentErrorMessage }}
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        position: relative;
      }
      .invalid {
        border: 1px solid red;
      }
      .error-message {
        color: red;
        font-size: 12px;
        margin-top: 4px;
      }
    `,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true,
    },
  ],
})
export class RichTextEditorComponent
  implements OnInit, AfterViewInit, OnDestroy, ControlValueAccessor, Validator
{
  @ViewChild('editorContainer', { static: true }) editorContainer!: ElementRef;
  @Input() licenseKey: string = '';
  @Input() config: RichTextEditorConfig = {};
  @Input() rtePreset: RTEPreset | null = null;
  @Input() imageToolbarItems: (RTEImageTool | '/')[] | null = null;
  @Input() excludedToolbarItems: string[] = [];
  @Input() initialContent: string = '';

  @Input() errorMessages: { [key: string]: string } = {
    required: 'This field is required.',
  };

  @Input()
  fileUploadHandler: (
    file: File,
    callback: (url: string | null, errorCode?: string) => void,
    optionalIndex?: number,
    optionalFiles?: File[]
  ) => void = () => {};

  @Input() enableImageUpload: boolean = false;
  @Input() enableVideoEmbed: boolean = false;
  @Input() readonly: boolean = false;

  private eventManager: EditorEventManager | null = null;
  private editorInstance: any;
  private value: string = '';
  private ngControl: NgControl | null = null;
  private changeTimer: any;
  private isDestroyed: boolean = false;
  private cleanupAttempts: number = 0;
  private eventListeners: Array<{ event: string; handler: any }> = [];
  private domCleanupTimer: any;

  onChange = (value: any) => {};
  onTouched = () => {};

  constructor(
    private injector: Injector,
    private rteService: RichTextEditorService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    @Optional() @Inject(RTE_LICENSE_KEY) private globalLicenseKey: string
  ) {}

  ngOnInit() {
    patchRemoveChildIfDetached();
    this.rteService.setCurrentEditor(this);
    try {
      this.ngControl = this.injector.get(NgControl);
      if (this.ngControl) {
        this.ngControl.valueAccessor = this;
      }
    } catch {
      // Safe fallback
    }
  }

  ngAfterViewInit() {
    // Run outside Angular zone to prevent change detection issues
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.initEditor();
        }
      }, 100);
    });
  }

  private initEditor() {
    try {
      // Clean up any existing instance first
      this.cleanupExistingEditor();

      const fullConfig = this.prepareConfiguration();
      this._applyCustomStyles();

      // Create editor instance
      this.editorInstance = new RichTextEditor(
        this.editorContainer.nativeElement,
        fullConfig
      );

      // Set initial content
      if (this.value) {
        this.editorInstance.setHTMLCode(this.value);
      } else if (this.initialContent) {
        this.value = this.initialContent;
        this.editorInstance.setHTMLCode(this.initialContent);
        this.ngZone.run(() => {
          this.onChange(this.initialContent);
          this.onTouched();
        });
      }

      if (this.readonly && this.editorInstance?.setReadOnly) {
        this.editorInstance.setReadOnly(true);
      }

      this.setupEventListeners();

      // Update image toolbar if needed
      if (this.imageToolbarItems && this.editorInstance) {
        this.updateImageToolbar();
      }
    } catch (error) {
      console.error('[RTE] Failed to initialize editor:', error);
    }
  }

  private cleanupExistingEditor() {
    if (this.editorInstance) {
      try {
        // Remove all event listeners first
        this.removeAllEventListeners();

        // Try to destroy the editor instance
        if (typeof this.editorInstance.destroy === 'function') {
          this.editorInstance.destroy();
        }
      } catch (e) {
        console.warn('[RTE] Error during editor cleanup:', e);
      }
      this.editorInstance = null;
    }
  }

  private setupEventListeners() {
    if (!this.editorInstance) return;

    this.eventManager = new EditorEventManager(this.editorInstance);

    const triggerUpdate = () => {
      if (this.changeTimer) clearTimeout(this.changeTimer);

      this.changeTimer = setTimeout(() => {
        if (this.isDestroyed || !this.editorInstance) return;

        this.ngZone.run(() => {
          try {
            const html = this.editorInstance.getHTMLCode() || '';
            this.value = html;

            this.onChange(html);
            this.onTouched();

            if (this.ngControl?.control) {
              const finalValue = isTrulyEmpty(html) ? '' : html;
              this.ngControl.control.setValue(finalValue, { emitEvent: false });
              this.ngControl.control.updateValueAndValidity();
            }
          } catch (error) {
            console.error('[RTE] Error in update handler:', error);
          }
        });
      }, 150);
    };

    // Change-related events
    this.eventManager.attachMany(
      ['change', 'keyup', 'paste', 'input'],
      triggerUpdate
    );

    // Blur
    this.eventManager.attach('blur', () => {
      this.ngZone.run(() => {
        this.onTouched();
        const control = this.ngControl?.control;
        if (control) {
          control.markAsTouched();
          control.updateValueAndValidity();
        }
      });
    });

    // Selection change (image toolbar)
    this.eventManager.attach('selectionchange', () => {
      setTimeout(() => this.checkImageSelection(), 100);
    });
  }

  private removeAllEventListeners() {
    this.eventManager?.detachAll();
    this.eventManager = null;
  }

  private updateImageToolbar() {
    if (this.editorInstance && this.imageToolbarItems) {
      const hasSlash = this.imageToolbarItems.includes('/');
      let imageToolbarString = '';

      if (hasSlash) {
        imageToolbarString = this.imageToolbarItems.join('');
      } else {
        imageToolbarString = `{${this.imageToolbarItems.join(',')}}`;
      }

      if (this.editorInstance.config) {
        this.editorInstance.config.controltoolbar_IMG = imageToolbarString;
      }

      try {
        if (typeof this.editorInstance.setConfig === 'function') {
          this.editorInstance.setConfig(
            'controltoolbar_IMG',
            imageToolbarString
          );
        }
      } catch (e) {
        // Some versions might not have setConfig
      }
    }
  }

  private checkImageSelection() {
    if (!this.editorInstance || this.isDestroyed) return;

    try {
      const iframe = this.editorContainer.nativeElement.querySelector('iframe');
      if (iframe?.contentWindow && iframe.contentDocument) {
        const selection = iframe.contentWindow.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const container = range.commonAncestorContainer;

          let imgElement = null;
          if (container.nodeType === Node.ELEMENT_NODE) {
            imgElement = (container as Element).querySelector('img');
          } else if (container.parentElement) {
            imgElement = container.parentElement.closest('img');
          }

          if (imgElement && this.imageToolbarItems) {
            this.editorInstance.updateToolbar &&
              this.editorInstance.updateToolbar();
          }
        }
      }
    } catch (e) {
      // Ignore errors during selection check
    }
  }

  writeValue(value: any): void {
    const incomingValue = value ?? this.initialContent ?? '';
    this.value = incomingValue;
    if (this.editorInstance && !this.isDestroyed) {
      const current = this.editorInstance.getHTMLCode() || '';

      if (this.normalizeHtml(current) !== this.normalizeHtml(incomingValue)) {
        try {
          this.editorInstance.setHTMLCode(incomingValue);
        } catch (e) {
          console.warn('[RTE] Error setting HTML code:', e);
        }
      }
    }
  }

  private normalizeHtml(html: string): string {
    return (html || '')
      .replace(/\u00A0/g, '')
      .replace(/\s+/g, ' ')
      .replace(/<br\s*\/?>/gi, '')
      .replace(/<p>\s*<\/p>/gi, '')
      .trim();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    const shouldDisable = isDisabled || this.readonly;
    if (this.editorInstance?.setReadOnly && !this.isDestroyed) {
      try {
        this.editorInstance.setReadOnly(shouldDisable);
      } catch (e) {
        console.warn('[RTE] Error setting disabled state:', e);
      }
    }
  }

  ngOnDestroy() {
    this.isDestroyed = true;

    // Clear timers
    if (this.changeTimer) {
      clearTimeout(this.changeTimer);
    }
    if (this.domCleanupTimer) {
      clearTimeout(this.domCleanupTimer);
    }

    // Clear service reference
    this.rteService.clearCurrentEditor();

    // Schedule cleanup outside Angular zone
    this.ngZone.runOutsideAngular(() => {
      // Immediate cleanup attempt
      this.performCleanup();

      // Schedule additional cleanup attempts
      this.domCleanupTimer = setTimeout(() => {
        this.performCleanup();
      }, 100);
    });
  }

  private performCleanup() {
    // Remove event listeners
    this.removeAllEventListeners();

    // Clean up editor instance
    if (this.editorInstance) {
      try {
        if (typeof this.editorInstance.destroy === 'function') {
          this.editorInstance.destroy();
        }
      } catch (error) {
        // Silently ignore destroy errors
      }
      this.editorInstance = null;
    }

    // Clean up floating panels with safe DOM manipulation
    safeCleanupFloatingPanels();
  }

  validate(control: AbstractControl): ValidationErrors | null {
    const value = control?.value || '';
    const isEmpty = isTrulyEmpty(value);

    if (hasRequiredValidator(control) && isEmpty) {
      return { required: true };
    }

    return null;
  }

  private fixCharacterCount() {
    if (!this.editorInstance || this.isDestroyed) return;

    try {
      const html = this.editorInstance.getHTMLCode() || '';
      const div = document.createElement('div');
      div.innerHTML = html;

      const text = div.textContent || '';
      const count = text.replace(/\u00A0/g, '').trim().length;

      const counter =
        this.editorContainer.nativeElement.querySelector('.character-count');
      if (counter) {
        counter.textContent = `characters: ${count}`;
      }
    } catch (e) {
      // Ignore character count errors
    }
  }

  getCharacterCount(): number {
    try {
      const html = this.editorInstance?.getHTMLCode?.() || '';
      const div = document.createElement('div');
      div.innerHTML = html;

      const text = div.textContent || '';
      return text.replace(/\u00A0/g, '').trim().length;
    } catch (e) {
      return 0;
    }
  }

  get showError(): boolean {
    const control = this.ngControl?.control;
    if (!control) return false;

    const isRequired = hasRequiredValidator(control);
    return !!(
      control.invalid &&
      control.touched &&
      (isRequired || control.errors?.['required'])
    );
  }

  get currentErrorMessage(): string | null {
    const errors = this.ngControl?.control?.errors;
    if (!errors) return null;
    const firstKey = Object.keys(errors)[0];
    return this.errorMessages[firstKey] || 'Invalid field';
  }

  private getMobileExpandedToolbar(): string {
    const basicMobileTools = [
      'paragraphs:dropdown',
      'paragraphs:toggle',
      'fontname:toggle',
      'fontsize:toggle',
      'bold',
      'italic',
      'underline',
      'fontname',
      'fontsize',
      'insertlink',
      'insertemoji',
      'insertimage',
      'insertvideo',
      'removeformat',
      'code',
      'toggleborder',
      'fullscreenenter',
      'fullscreenexit',
      'undo',
      'redo',
      'togglemore',
      'fontname:dropdown',
      'fontsize:dropdown',
    ];

    if (this.rtePreset && RTE_TOOLBAR_PRESETS[this.rtePreset]) {
      let fullToolbar = RTE_TOOLBAR_PRESETS[this.rtePreset];

      for (const tool of basicMobileTools) {
        const escapedTool = tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const toolPattern = new RegExp(`\\b${escapedTool}\\b`, 'g');
        fullToolbar = fullToolbar.replace(toolPattern, '');
      }

      // 🧼 Clean both desktop/mobile exclusions
      fullToolbar = this.excludeToolbarItems(fullToolbar);

      return fullToolbar || this.getDefaultMobileExpandedToolbar();
    }

    return this.getDefaultMobileExpandedToolbar();
  }

  private getDefaultMobileExpandedToolbar(): string {
    return `{strike,subscript,superscript}|{forecolor,backcolor}|
          {justifyleft,justifycenter,justifyright,justifyfull}|
          {insertorderedlist,insertunorderedlist}|{outdent,indent}|
          {inserthorizontalrule,insertblockquote,inserttable}|
          {cut,copy,paste,pastetext,pasteword}|
          {find,replace}|{selectall,print,spellcheck}|{help}`;
  }

  private prepareConfiguration(): any {
    const baseConfig = { ...this.config };

    if (!baseConfig.height) {
      baseConfig.height = 300;
    }

    const enhancedConfig: any = {
      ...baseConfig,
      license: this.globalLicenseKey || this.licenseKey,
      enableObjectResizing: true,
      enableImageUpload: this.enableImageUpload,
      enableVideoEmbed: this.enableVideoEmbed,
      file_upload_handler: (
        file: File,
        callback: (url: string | null, errorCode?: string) => void,
        optionalIndex?: number,
        optionalFiles?: File[]
      ) => {
        const wrappedCallback = (url: string | null, errorCode?: string) => {
          if (!url) {
            // 🚨 Upload failed — clean up placeholder
            this.rteService.removeLastPlaceholderImage();
            console.warn('[RTE] Upload failed. Placeholder removed.');
          }
          callback(url, errorCode);
        };
        this.fileUploadHandler(
          file,
          wrappedCallback,
          optionalIndex,
          optionalFiles
        );
      },
      content_changed_callback: () => this.fixCharacterCount(),
      showFloatingToolbar: false,
      forceDesktopMode: true,
      disableMobileMode: true,
      toolbarModeViewport: 'always-desktop',
      showBottomToolbar: false,
      contentCssUrl: '',
      toolbarMobile: 'basic',
      subtoolbar_more_mobile: this.getMobileExpandedToolbar(),
      showControlBoxOnImageSelection: true,
      enableImageFloatStyle: true,
      contentCSSText: `
      /* Custom styles */
      body {
        overflow-y: hidden;
        padding: 0px;
        margin: 0px;
      }

      body, table, p, div {
        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        color: #414141;
        font-size: 14px;
        line-height: 1.6;
      }

      img {
        cursor: default;
      }
      `,
    };

    if (this.imageToolbarItems && Array.isArray(this.imageToolbarItems)) {
      const hasSlash = this.imageToolbarItems.includes('/');
      let imageToolbarString = '';

      if (hasSlash) {
        imageToolbarString = this.imageToolbarItems.join('');
      } else {
        imageToolbarString = `{${this.imageToolbarItems.join(',')}}`;
      }

      enhancedConfig.controltoolbar_IMG = imageToolbarString;
      enhancedConfig.imagecontrolbar = imageToolbarString;
      enhancedConfig.image_toolbar = imageToolbarString;
    }

    if (this.rtePreset && RTE_TOOLBAR_PRESETS[this.rtePreset]) {
      let fullToolbar = RTE_TOOLBAR_PRESETS[this.rtePreset];

      fullToolbar = this.excludeToolbarItems(fullToolbar);

      enhancedConfig.toolbar = 'custom';
      enhancedConfig.toolbar_custom = fullToolbar;
    }

    return enhancedConfig;
  }

  private _applyCustomStyles() {
    if (!document.getElementById('rte-consistent-toolbar-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'rte-consistent-toolbar-styles';
      styleEl.innerHTML = `
        /* Custom mobile styles to fix toolbar */
        @media (max-width: 992px) {
          .rte-toolbar-desktop,
          .rte-toolbar {
            display: flex !important;
            flex-wrap: wrap !important;
            overflow-x: auto !important;
            white-space: nowrap !important;
            -webkit-overflow-scrolling: touch !important;
            max-width: 100% !important;
            padding: 4px 0 !important;
          }
     
          .rte-toolbar button,
          .rte-toolbar .rte-dropdown {
            flex-shrink: 0 !important;
            min-width: 28px !important;
            height: 28px !important;
            margin: 2px !important;
          }
          
          .rte-toolbar-desktop {
            display: flex !important;
          }
        }

        /* Force image toolbar visibility */
        .rte-image-controlbox {
          display: block !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        /* Prevent orphaned floating panels */
        rte-floatpanel {
          z-index: 10000;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }

  public insertContentAtCursor(content: string) {
    if (this.readonly || this.isDestroyed) return;

    try {
      if (!content || typeof content !== 'string' || !content.trim()) {
        console.warn(
          '[RTE] Empty or invalid content passed to insertContentAtCursor'
        );
        return;
      }

      const iframe = this.editorContainer.nativeElement.querySelector('iframe');
      if (!iframe?.contentWindow || !iframe.contentDocument) {
        console.warn('[RTE] iframe not found or inaccessible');
        return;
      }

      const iframeDoc = iframe.contentDocument;
      const editableBody = iframeDoc.body;

      if (!editableBody?.isContentEditable) {
        console.warn('[RTE] iframe body is not editable');
        return;
      }

      editableBody.focus();

      const selection = iframe.contentWindow.getSelection();
      if (!selection || selection.rangeCount === 0) {
        const fallbackRange = iframeDoc.createRange();
        fallbackRange.selectNodeContents(editableBody);
        fallbackRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(fallbackRange);
      }

      const range = selection.getRangeAt(0);
      range.deleteContents();

      // ✅ Append a zero-width span to keep cursor inline
      const enhancedContent = `${content}<span class="caret-spot">&#8203;</span>`;

      // ✅ Insert as inline HTML fragment
      const fragment = range.createContextualFragment(enhancedContent);
      const lastNode = fragment.lastChild;

      range.insertNode(fragment);

      // ✅ Move caret after the inserted zero-width span
      if (lastNode && lastNode.nodeType === Node.ELEMENT_NODE) {
        const newRange = iframeDoc.createRange();
        newRange.setStartAfter(lastNode);
        newRange.setEndAfter(lastNode);

        selection.removeAllRanges();
        selection.addRange(newRange);
      }

      // Update Angular model
      const html = this.editorInstance.getHTMLCode();
      this.value = html;

      this.ngZone.run(() => {
        this.onChange(html);
        this.onTouched();

        if (this.ngControl?.control) {
          this.ngControl.control.setValue(html, { emitEvent: false });
          this.ngControl.control.updateValueAndValidity();
        }
      });
    } catch (error) {
      console.error('[RTE] Failed to inject content into iframe:', error);
    }
  }

  public hideAllFloatPanels(): void {
    safeCleanupFloatingPanels();
  }

  public excludeToolbarItems(toolbar: string): string {
    if (!toolbar || !this.excludedToolbarItems?.length) return toolbar;

    for (const tool of this.excludedToolbarItems) {
      const escapedTool = tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const toolPattern = new RegExp(`\\b${escapedTool}\\b`, 'g');
      toolbar = toolbar.replace(toolPattern, '');
    }

    return cleanToolbarString(toolbar);
  }
}
