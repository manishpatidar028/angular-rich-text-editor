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
              const control = this.ngControl.control;
              const finalValue = this.isTrulyEmpty(html) ? '' : html;
              control.setValue(finalValue, { emitEvent: false });
              control.updateValueAndValidity();
            }
          } catch (error) {
            console.error('[RTE] Error in update handler:', error);
          }
        });
      }, 150);
    };

    // Store event handlers for cleanup
    ['change', 'keyup', 'paste', 'input'].forEach((event) => {
      if (this.editorInstance && this.editorInstance.attachEvent) {
        const handler = triggerUpdate;
        this.editorInstance.attachEvent(event, handler);
        this.eventListeners.push({ event, handler });
      }
    });

    if (this.editorInstance && this.editorInstance.attachEvent) {
      const blurHandler = () => {
        this.ngZone.run(() => {
          this.onTouched();
          const control = this.ngControl?.control;
          if (control) {
            control.markAsTouched();
            control.updateValueAndValidity();
          }
        });
      };

      this.editorInstance.attachEvent('blur', blurHandler);
      this.eventListeners.push({ event: 'blur', handler: blurHandler });

      const selectionHandler = () => {
        setTimeout(() => {
          this.checkImageSelection();
        }, 100);
      };

      this.editorInstance.attachEvent('selectionchange', selectionHandler);
      this.eventListeners.push({
        event: 'selectionchange',
        handler: selectionHandler,
      });
    }
  }

  private removeAllEventListeners() {
    if (this.editorInstance && this.editorInstance.detachEvent) {
      this.eventListeners.forEach(({ event, handler }) => {
        try {
          this.editorInstance.detachEvent(event, handler);
        } catch (e) {
          // Ignore errors during event cleanup
        }
      });
    }
    this.eventListeners = [];
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
    this.safeCleanupFloatingPanels();
  }

  private safeCleanupFloatingPanels() {
    try {
      // Use querySelectorAll to find all floating panels
      const selectors = [
        'rte-floatpanel',
        '.rte-floatpanel',
        '.rte-floatpanel-paragraphop',
        '[class*="rte-float"]',
        '[class*="rte-popup"]',
        '.rte-toolbar-float',
        '.rte-dropdown-panel',
      ];

      selectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
          try {
            // Check if element still has a parent before removing
            if (
              element &&
              element.parentNode &&
              document.body.contains(element)
            ) {
              element.parentNode.removeChild(element);
            }
          } catch (e) {
            // If removal fails, hide the element
            if (element instanceof HTMLElement) {
              element.style.display = 'none';
              element.style.visibility = 'hidden';
            }
          }
        });
      });

      // Also clean up any orphaned RTE elements
      this.cleanupOrphanedElements();
    } catch (error) {
      // Silently ignore cleanup errors
    }
  }

  private cleanupOrphanedElements() {
    // Clean up any RTE-related elements that might be orphaned
    const rteElements = document.querySelectorAll(
      '[id*="rte_"], [class*="rte_"]'
    );
    rteElements.forEach((element) => {
      try {
        // Check if element is orphaned (not in the document body)
        if (!document.body.contains(element)) {
          element.remove();
        }
      } catch (e) {
        // Ignore removal errors
      }
    });
  }

  hasRequiredValidator(control: AbstractControl | null): boolean {
    if (!control || !control.validator) return false;
    const result = control.validator({ value: null } as AbstractControl);
    return !!(result && result['required']);
  }

  validate(control: AbstractControl): ValidationErrors | null {
    const value = control?.value || '';
    const isEmpty = this.isTrulyEmpty(value);

    if (this.hasRequiredValidator(control) && isEmpty) {
      return { required: true };
    }

    return null;
  }

  /**
   * Enhanced empty check that considers images as content
   */
  private isTrulyEmpty(html: string): boolean {
    if (!html || html.trim() === '') return true;

    const div = document.createElement('div');
    div.innerHTML = html;

    // Check for images
    const hasImages = div.querySelectorAll('img').length > 0;
    if (hasImages) return false;

    // Check for videos
    const hasVideos = div.querySelectorAll('video, iframe').length > 0;
    if (hasVideos) return false;

    // Check for other embedded content
    const hasEmbeds = div.querySelectorAll('embed, object, audio').length > 0;
    if (hasEmbeds) return false;

    // Check for text content
    const text = div.textContent?.replace(/\u00A0/g, '').trim() || '';

    // Clean HTML to check if only empty tags remain
    const cleaned = div.innerHTML
      .replace(/<br\s*\/?>/gi, '')
      .replace(/<div>(\s|&nbsp;)*<\/div>/gi, '')
      .replace(/<p>(\s|&nbsp;)*<\/p>/gi, '')
      .replace(/&nbsp;/gi, '')
      .trim();

    return !text && cleaned.length === 0;
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
    return (
      (!!this.ngControl?.control?.invalid &&
        !!this.ngControl?.control?.touched) ||
      !!(
        this.ngControl?.control?.touched &&
        this.value.length === 0 &&
        this.isTrulyEmpty(this.value)
      )
    );
  }

  get currentErrorMessage(): string | null {
    const errors = this.ngControl?.control?.errors;
    if (!errors) return null;
    const firstKey = Object.keys(errors)[0];
    return this.errorMessages[firstKey] || 'Invalid field';
  }

  private cleanToolbarString(toolbar: string): string {
    let cleaned = toolbar;

    // Remove :toggle and :dropdown
    cleaned = cleaned.replace(/:toggle/g, '').replace(/:dropdown/g, '');

    // Fix spacing issues
    cleaned = cleaned
      .replace(/,+/g, ',')
      .replace(/\{,+/g, '{')
      .replace(/,+\}/g, '}')
      .replace(/\|+/g, '|')
      .replace(/\{\s*\|/g, '{')
      .replace(/\|\s*\}/g, '}')
      .replace(/\{\s*\}/g, '')
      .replace(/\s*,\s*/g, ',')
      .replace(/\s*\|\s*/g, '|')
      .replace(/\{\s+/g, '{')
      .replace(/\s+\}/g, '}');

    // Fix letter separation issue
    cleaned = cleaned.replace(/\b([a-z]),(?=[a-z],|[a-z]\b)/g, '$1');

    let previousCleaned = '';
    while (previousCleaned !== cleaned) {
      previousCleaned = cleaned;
      cleaned = cleaned.replace(/\b([a-z]),(?=[a-z],|[a-z]\b)/g, '$1');
    }

    // Process sections
    const sections = cleaned.split(/([/#])/);
    const processedSections: string[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      if (section === '/' || section === '#') {
        processedSections.push(section);
        continue;
      }

      if (!section.trim()) continue;

      const groups = section.split('|');
      const processedGroups: string[] = [];

      for (let group of groups) {
        const hasBraces = group.includes('{') || group.includes('}');
        let content = group.replace(/[{}]/g, '').trim();

        if (!content) continue;

        // Fix concatenated tool names
        content = content
          .replace(/(?<=fontname)(?=fontsize)/g, ',')
          .replace(/(?<=fontsize)(?=inlinestyle)/g, ',')
          .replace(/(?<=inlinestyle)(?=lineheight)/g, ',')
          .replace(/(?<=paragraphs)(?=fontname)/g, ',')
          .replace(/(?<=paragraphstyle)(?=menu_)/g, ',')
          .replace(/underlinefore/g, 'underline,fore')
          .replace(/forecolorback/g, 'forecolor,back')
          .replace(/backcolor/g, 'backcolor')
          .replace(/outdentsuperscript/g, 'outdent,superscript')
          .replace(/insertlinkun/g, 'insertlink,un')
          .replace(/unlinkinsert/g, 'unlink,insert')
          .replace(/insertblockquote/g, 'insertblockquote')
          .replace(/inserttable/g, 'inserttable')
          .replace(/insertimage/g, 'insertimage')
          .replace(/removeformat/g, 'removeformat');

        content = content.replace(/,+/g, ',').trim();

        if (content) {
          processedGroups.push(hasBraces ? `{${content}}` : content);
        }
      }

      if (processedGroups.length > 0) {
        processedSections.push(processedGroups.join('|'));
      }
    }

    cleaned = processedSections.join('');

    // Final cleanup
    cleaned = cleaned
      .replace(/\{\s*\}/g, '')
      .replace(/\|+/g, '|')
      .replace(/\/+/g, '/')
      .replace(/#+/g, '#')
      .replace(/^[|/#]+|[|/#]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
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

      if (this.excludedToolbarItems.length) {
        for (const tool of this.excludedToolbarItems) {
          const escapedTool = tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const toolPattern = new RegExp(`\\b${escapedTool}\\b`, 'g');
          fullToolbar = fullToolbar.replace(toolPattern, '');
        }
      }

      fullToolbar = this.cleanToolbarString(fullToolbar);

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
        this.fileUploadHandler(file, callback, optionalIndex, optionalFiles);
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

      if (this.excludedToolbarItems.length) {
        for (const tool of this.excludedToolbarItems) {
          const toolPattern = new RegExp(`\\b${tool}\\b`, 'g');
          fullToolbar = fullToolbar.replace(toolPattern, '');
        }

        fullToolbar = this.cleanToolbarString(fullToolbar);
      }

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
      iframeDoc.execCommand('insertHTML', false, content);

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
    this.safeCleanupFloatingPanels();
  }
}
