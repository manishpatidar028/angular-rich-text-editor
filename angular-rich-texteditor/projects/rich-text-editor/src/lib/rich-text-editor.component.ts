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

  /**
   * If provided, RichTextEditor will call this instead of its
   * default image‐upload logic.
   *
   * Should call `callback(url)` on success, or
   * `callback(null, errorCode)` on failure.
   */
  @Input()
  fileUploadHandler: (
    file: File,
    callback: (url: string | null, errorCode?: string) => void,
    optionalIndex?: number,
    optionalFiles?: File[]
  ) => void = () => {};

  /**
   * Enable or disable image upload functionality
   */
  @Input() enableImageUpload: boolean = false;

  /**
   * Enable or disable video embed functionality
   */
  @Input() enableVideoEmbed: boolean = false;
  @Input() readonly: boolean = false;

  private editorInstance: any;
  private value: string = '';
  private ngControl: NgControl | null = null;
  private changeTimer: any;
  private isDestroyed: boolean = false;
  private floatPanelCleanupAttempts: number = 0;

  onChange = (value: any) => {};
  onTouched = () => {};

  constructor(
    private injector: Injector,
    private rteService: RichTextEditorService,
    private cdr: ChangeDetectorRef,
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
    // Add a small delay to ensure DOM is fully rendered
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.initEditor();
      }
    }, 100);
  }

  private initEditor() {
    // Prepare the final configuration with our custom settings
    const fullConfig = this.prepareConfiguration();
    this._applyCustomStyles();

    try {
      this.editorInstance = new RichTextEditor(
        this.editorContainer.nativeElement,
        fullConfig
      );

      // Ensure image toolbar is properly configured after initialization
      if (this.imageToolbarItems && this.editorInstance) {
        this.updateImageToolbar();
      }

      if (this.value) {
        this.editorInstance.setHTMLCode(this.value);
      } else if (this.initialContent) {
        this.value = this.initialContent;
        this.editorInstance.setHTMLCode(this.initialContent);
        this.onChange(this.initialContent);
        this.onTouched();
      }

      if (this.readonly && this.editorInstance?.setReadOnly) {
        this.editorInstance.setReadOnly(true);
      }

      this.setupEventListeners();
    } catch (error) {
      console.error('[RTE] Failed to initialize editor:', error);
    }
  }

  private updateImageToolbar() {
    // Force update image toolbar configuration
    if (this.editorInstance && this.imageToolbarItems) {
      const hasSlash = this.imageToolbarItems.includes('/');
      let imageToolbarString = '';

      if (hasSlash) {
        imageToolbarString = this.imageToolbarItems.join('');
      } else {
        imageToolbarString = `{${this.imageToolbarItems.join(',')}}`;
      }

      // Try multiple ways to set the image toolbar
      if (this.editorInstance.config) {
        this.editorInstance.config.controltoolbar_IMG = imageToolbarString;
      }
      
      // Also try setting it directly
      try {
        this.editorInstance.setConfig('controltoolbar_IMG', imageToolbarString);
      } catch (e) {
        // Some versions might not have setConfig
      }
    }
  }

  private setupEventListeners() {
    const triggerUpdate = () => {
      if (this.changeTimer) clearTimeout(this.changeTimer);

      this.changeTimer = setTimeout(() => {
        if (this.isDestroyed || !this.editorInstance) return;

        const html = this.editorInstance.getHTMLCode() || '';
        const cleaned = html
          .replace(/\u00A0/g, '')
          .replace(/<[^>]+>/g, '')
          .trim();

        const prevValue = this.value;
        this.value = html;

        // Always trigger form update, even if content looks same
        this.onChange(html);
        this.onTouched();

        // Force validation cycle
        if (this.ngControl?.control) {
          const control = this.ngControl.control;
          const finalValue = this.isTrulyEmpty(html) ? '' : html;
          control.setValue(finalValue, { emitEvent: false }); // don't double emit
          control.updateValueAndValidity();
        }

        if (prevValue && cleaned.length === 0) {
          const control = this.ngControl?.control;
          if (control) {
            control.markAsTouched(); // Triggers UI error display
            control.updateValueAndValidity(); // Forces validator re-run
          }
          if (this.editorInstance) {
            this.editorInstance.setHTMLCode('<p><br></p>');
          }
        }
      }, 150);
    };

    ['change', 'keyup', 'paste', 'input'].forEach((event) => {
      if (this.editorInstance && this.editorInstance.attachEvent) {
        this.editorInstance.attachEvent(event, triggerUpdate);
      }
    });

    if (this.editorInstance && this.editorInstance.attachEvent) {
      this.editorInstance.attachEvent('blur', () => {
        this.onTouched();

        const control = this.ngControl?.control;
        if (control) {
          control.markAsTouched(); // Mark as touched for UI error display
          control.updateValueAndValidity(); // Trigger validation re-run
        }
      });

      // Listen for image selection to ensure toolbar appears
      this.editorInstance.attachEvent('selectionchange', () => {
        setTimeout(() => {
          this.checkImageSelection();
        }, 100);
      });
    }
  }

  private checkImageSelection() {
    // Check if an image is selected and force toolbar update
    if (!this.editorInstance || this.isDestroyed) return;

    try {
      const iframe = this.editorContainer.nativeElement.querySelector('iframe');
      if (iframe?.contentWindow && iframe.contentDocument) {
        const selection = iframe.contentWindow.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const container = range.commonAncestorContainer;
          
          // Check if we have an image selected
          let imgElement = null;
          if (container.nodeType === Node.ELEMENT_NODE) {
            imgElement = (container as Element).querySelector('img');
          } else if (container.parentElement) {
            imgElement = container.parentElement.closest('img');
          }

          if (imgElement && this.imageToolbarItems) {
            // Force the editor to recognize the image selection
            this.editorInstance.updateToolbar && this.editorInstance.updateToolbar();
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

      // Only call setHTMLCode if content has *meaningfully* changed
      if (this.normalizeHtml(current) !== this.normalizeHtml(incomingValue)) {
        this.editorInstance.setHTMLCode(incomingValue);
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
      this.editorInstance.setReadOnly(shouldDisable);
    }
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.rteService.clearCurrentEditor();
    
    // Clear any pending timers
    if (this.changeTimer) {
      clearTimeout(this.changeTimer);
    }

    // Safely destroy the editor instance
    this.safelyDestroyEditor();
    
    // Clean up floating panels with retry mechanism
    this.cleanupFloatingPanels();
  }

  private safelyDestroyEditor() {
    if (this.editorInstance) {
      try {
        // First try to properly destroy the editor
        if (this.editorInstance.destroy) {
          this.editorInstance.destroy();
        }
      } catch (error) {
        console.warn('[RTE] Error during editor destroy:', error);
      }
      
      // Clear the reference
      this.editorInstance = null;
    }
  }

  private cleanupFloatingPanels() {
    // Use requestAnimationFrame to ensure DOM operations happen at the right time
    requestAnimationFrame(() => {
      this.hideAllFloatPanels();
      
      // Retry cleanup after a short delay if needed
      if (this.floatPanelCleanupAttempts < 3) {
        this.floatPanelCleanupAttempts++;
        setTimeout(() => {
          this.hideAllFloatPanels();
        }, 100 * this.floatPanelCleanupAttempts);
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

  private isTrulyEmpty(html: string): boolean {
    const div = document.createElement('div');
    div.innerHTML = html;

    const text = div.textContent?.replace(/\u00A0/g, '').trim() || '';

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
  }

  getCharacterCount(): number {
    const html = this.editorInstance?.getHTMLCode?.() || '';
    const div = document.createElement('div');
    div.innerHTML = html;

    const text = div.textContent || '';
    return text.replace(/\u00A0/g, '').trim().length;
  }

  get showError(): boolean {
    return (
      (!!this.ngControl?.control?.invalid &&
        !!this.ngControl?.control?.touched) ||
      !!(this.ngControl?.control?.touched && this.value.length === 0)
    );
  }

  get currentErrorMessage(): string | null {
    const errors = this.ngControl?.control?.errors;
    if (!errors) return null;
    const firstKey = Object.keys(errors)[0];
    return this.errorMessages[firstKey] || 'Invalid field';
  }

  // More comprehensive toolbar cleanup method
  private cleanToolbarString(toolbar: string): string {
    let cleaned = toolbar;

    // Step 1: Remove :toggle and :dropdown (including any that might be attached to words)
    cleaned = cleaned.replace(/:toggle/g, '').replace(/:dropdown/g, '');

    // Step 2: Fix spacing issues that may have been created
    cleaned = cleaned
      // Remove multiple commas
      .replace(/,+/g, ',')
      // Remove commas at start/end of groups
      .replace(/\{,+/g, '{')
      .replace(/,+\}/g, '}')
      // Remove multiple pipes
      .replace(/\|+/g, '|')
      // Remove pipes at start/end of groups
      .replace(/\{\s*\|/g, '{')
      .replace(/\|\s*\}/g, '}')
      // Remove empty groups
      .replace(/\{\s*\}/g, '')
      // Clean up spaces
      .replace(/\s*,\s*/g, ',')
      .replace(/\s*\|\s*/g, '|')
      .replace(/\{\s+/g, '{')
      .replace(/\s+\}/g, '}');

    // Step 3: Fix letter separation issue
    // This regex finds patterns like "b,o,l,d" and converts them back to "bold"
    cleaned = cleaned.replace(/\b([a-z]),(?=[a-z],|[a-z]\b)/g, '$1');

    // Keep applying the fix until no more single-letter separations exist
    let previousCleaned = '';
    while (previousCleaned !== cleaned) {
      previousCleaned = cleaned;
      cleaned = cleaned.replace(/\b([a-z]),(?=[a-z],|[a-z]\b)/g, '$1');
    }

    // Step 4: Process each section to fix missing commas between tools
    const sections = cleaned.split(/([/#])/);
    const processedSections: string[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      if (section === '/' || section === '#') {
        processedSections.push(section);
        continue;
      }

      if (!section.trim()) continue;

      // Process groups within sections
      const groups = section.split('|');
      const processedGroups: string[] = [];

      for (let group of groups) {
        // Remove braces temporarily to process content
        const hasBraces = group.includes('{') || group.includes('}');
        let content = group.replace(/[{}]/g, '').trim();

        if (!content) continue;

        // Fix tools that got concatenated (e.g., "fontnamefontsizeinlinestyle")
        // This happens when we remove :toggle between them
        content = content
          // Add commas between known concatenated tool names
          .replace(/(?<=fontname)(?=fontsize)/g, ',')
          .replace(/(?<=fontsize)(?=inlinestyle)/g, ',')
          .replace(/(?<=inlinestyle)(?=lineheight)/g, ',')
          .replace(/(?<=paragraphs)(?=fontname)/g, ',')
          .replace(/(?<=paragraphstyle)(?=menu_)/g, ',')
          // Fix specific concatenations
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

        // Clean up any double commas that might have been created
        content = content.replace(/,+/g, ',').trim();

        if (content) {
          processedGroups.push(hasBraces ? `{${content}}` : content);
        }
      }

      if (processedGroups.length > 0) {
        processedSections.push(processedGroups.join('|'));
      }
    }

    // Step 5: Reassemble and do final cleanup
    cleaned = processedSections.join('');

    // Final cleanup pass
    cleaned = cleaned
      // Remove any remaining empty groups
      .replace(/\{\s*\}/g, '')
      // Remove duplicate separators
      .replace(/\|+/g, '|')
      .replace(/\/+/g, '/')
      .replace(/#+/g, '#')
      // Remove trailing/leading separators
      .replace(/^[|/#]+|[|/#]+$/g, '')
      // Final whitespace cleanup
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  }

  private getMobileExpandedToolbar(): string {
    // Define tools that are already in the basic mobile toolbar
    // Based on RTE_DefaultConfig.toolbar_basic
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

      // Remove basic mobile tools from the preset toolbar
      for (const tool of basicMobileTools) {
        // Escape special regex characters in tool name
        const escapedTool = tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const toolPattern = new RegExp(`\\b${escapedTool}\\b`, 'g');
        fullToolbar = fullToolbar.replace(toolPattern, '');
      }

      // Apply additional exclusions if any
      if (this.excludedToolbarItems.length) {
        for (const tool of this.excludedToolbarItems) {
          const escapedTool = tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const toolPattern = new RegExp(`\\b${escapedTool}\\b`, 'g');
          fullToolbar = fullToolbar.replace(toolPattern, '');
        }
      }

      // Clean up the toolbar string with improved regex
      fullToolbar = this.cleanToolbarString(fullToolbar);

      // Return the filtered toolbar, or fallback if empty
      return fullToolbar || this.getDefaultMobileExpandedToolbar();
    }

    return this.getDefaultMobileExpandedToolbar();
  }

  // Separate method for default mobile expanded toolbar
  private getDefaultMobileExpandedToolbar(): string {
    // Default expanded mobile toolbar - excluding tools already in basic toolbar
    return `{strike,subscript,superscript}|{forecolor,backcolor}|
          {justifyleft,justifycenter,justifyright,justifyfull}|
          {insertorderedlist,insertunorderedlist}|{outdent,indent}|
          {inserthorizontalrule,insertblockquote,inserttable}|
          {cut,copy,paste,pastetext,pasteword}|
          {find,replace}|{selectall,print,spellcheck}|{help}`;
  }

  /**
   * Prepare the final configuration for the editor instance
   */
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
        // delegate to the parent‐supplied handler
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
      // Image selection configuration
      showControlBoxOnImageSelection: true,
      enableImageFloatStyle: true,
      contentCSSText: `
      /* TODO: use @import for your css */

      body {
        overflow-y: hidden;
        padding: 0px;
        margin: 0px
      }

      body, table, p, div {
        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        color: #414141;
        font-size: 14px;
        line-height: 1.6;
      }

      a {
        color: #377dff;
        text-decoration: none;
        -webkit-transition: color 0.2s ease 0s, text-decoration 0.2s ease 0s;
        -moz-transition: color 0.2s ease 0s, text-decoration 0.2s ease 0s;
        -o-transition: color 0.2s ease 0s, text-decoration 0.2s ease 0s;
        transition: color 0.2s ease 0s, text-decoration 0.2s ease 0s;
      }

      ::selection {
        background: #b5d6fd;
        color: #000030;
      }

      /*RTE_DefaultConfig.items_InlineClasses*/
      .my-cls-mark {
        background-color: yellow;
        font-weight: bold;
      }

      .my-cls-warning {
        background-color: orange;
        color: white;
        font-weight: bold;
      }
      /*RTE_DefaultConfig.items_ParagraphClasses*/
      .my-cls-quote {
        margin: 10px;
        padding-left: 10px;
        border-left: dashed 1px red;
        font-style: italic;
      }

      .my-cls-largecenter {
        font-size: 1.5em;
        font-weight: bold;
        text-align: center;
        margin: 10px;
      }

      * {
        box-sizing: border-box;
      }

      [__rte_selected_hover__] {
        background-color: #b5d6fd;
      }

      [__rte_selected_cell] {
        background-color: #b5d6fd;
      }

      [__rte_selected_hover] {
        background: #b5d6fd;
        color: #000;
      }

      .rte-toggleborder [__rte_selected_block] {
        /*box-shadow: 0 0 0 0.5px #377dff;*/ /*not work well for FireFox*/
        /*border-radius: 1px;*/
        /*outline: 0.5px solid #377dff99;*/
        border-right:solid 1px #377dff;
      }

      .rte-toggleborder blockquote[__rte_selected_block] {
        /*box-shadow: 0 0 0 0.5px #377dff;*/ /*not work well for FireFox*/
        /*border-radius: 1px;*/
        outline: none;
      }

      .rte-toggleborder td[__rte_selected_block] {
        box-shadow: none !important;
      }

      table {
        border-spacing: 0;
        border-collapse: collapse;
      }

        table:not([width]) {
          width: 100%;
        }

        table[border="0"] td, table:not([border]) td, table[border="0"] th, table:not([border]) th {
          border: 1px solid #ddd;
        }

      thead {
        background-color: #eee;
      }

      .table > tbody > tr > td, .table > tbody > tr > th, .table > tfoot > tr > td, .table > tfoot > tr > th, .table > thead > tr > td, .table > thead > tr > th {
        padding: 8px;
        line-height: 1.42857143;
        vertical-align: top;
        border-top: 1px solid #ddd;
      }

      video-container {
        position: relative
      }

        video-container:after {
          content: '';
          display: block;
          position: absolute;
          z-index: 1;
          left: 0px;
          top: 0px;
          right: 0px;
          bottom: 0px;
          background-color: rgba(128,128,128,0.2);
        }

      blockquote {
        border-left: 3px solid #ddd;
        padding: 5px 0 5px 10px;
        margin: 15px 0 15px 15px;
      }


      img {
        cursor: default;
      }




      .dp-highlighter {
        font-family: "Consolas", "Courier New", Courier, mono, serif;
        font-size: 12px;
        background-color: #E7E5DC;
        width: 99%;
        overflow: auto;
        margin: 18px 0 18px 0 !important;
        padding-top: 1px; /* adds a little border on top when controls are hidden */
      }

        /* clear styles */
        .dp-highlighter ol,
        .dp-highlighter ol li,
        .dp-highlighter ol li span {
          margin: 0;
          padding: 0;
          border: none;
        }

        .dp-highlighter a,
        .dp-highlighter a:hover {
          background: none;
          border: none;
          padding: 0;
          margin: 0;
        }

        .dp-highlighter .bar {
          padding-left: 45px;
        }

        .dp-highlighter.collapsed .bar,
        .dp-highlighter.nogutter .bar {
          padding-left: 0px;
        }

        .dp-highlighter ol {
          list-style: decimal; /* for ie */
          background-color: #fff;
          margin: 0px 0px 1px 45px !important; /* 1px bottom margin seems to fix occasional Firefox scrolling */
          padding: 0px;
          color: #5C5C5C;
        }

        .dp-highlighter.nogutter ol,
        .dp-highlighter.nogutter ol li {
          list-style: none !important;
          margin-left: 0px !important;
        }

        .dp-highlighter ol li,
        .dp-highlighter .columns div {
          list-style: decimal-leading-zero; /* better look for others, override cascade from OL */
          list-style-position: outside !important;
          border-left: 3px solid #6CE26C;
          background-color: #F8F8F8;
          color: #5C5C5C;
          padding: 0 3px 0 10px !important;
          margin: 0 !important;
        }

        .dp-highlighter.nogutter ol li,
        .dp-highlighter.nogutter .columns div {
          border: 0;
        }

        .dp-highlighter .columns {
          background-color: #F8F8F8;
          color: gray;
          overflow: hidden;
          width: 100%;
        }

          .dp-highlighter .columns div {
            padding-bottom: 5px;
          }

        .dp-highlighter ol li.alt {
          background-color: #FFF;
          color: inherit;
        }

        .dp-highlighter ol li span {
          color: black;
          background-color: inherit;
        }

        /* Adjust some properties when collapsed */

        .dp-highlighter.collapsed ol {
          margin: 0px;
        }

          .dp-highlighter.collapsed ol li {
            display: none;
          }

        /* Additional modifications when in print-view */

        .dp-highlighter.printing {
          border: none;
        }

          .dp-highlighter.printing .tools {
            display: none !important;
          }

          .dp-highlighter.printing li {
            display: list-item !important;
          }

        /* Styles for the tools */

        .dp-highlighter .tools {
          padding: 3px 8px 3px 10px;
          font: 9px Verdana, Geneva, Arial, Helvetica, sans-serif;
          color: silver;
          background-color: #f8f8f8;
          padding-bottom: 10px;
          border-left: 3px solid #6CE26C;
        }

        .dp-highlighter.nogutter .tools {
          border-left: 0;
        }

        .dp-highlighter.collapsed .tools {
          border-bottom: 0;
        }

        .dp-highlighter .tools a {
          font-size: 9px;
          color: #a0a0a0;
          background-color: inherit;
          text-decoration: none;
          margin-right: 10px;
        }

          .dp-highlighter .tools a:hover {
            color: red;
            background-color: inherit;
            text-decoration: underline;
          }

      /* About dialog styles */

      .dp-about {
        background-color: #fff;
        color: #333;
        margin: 0px;
        padding: 0px;
      }

        .dp-about table {
          width: 100%;
          height: 100%;
          font-size: 11px;
          font-family: Tahoma, Verdana, Arial, sans-serif !important;
        }

        .dp-about td {
          padding: 10px;
          vertical-align: top;
        }

        .dp-about .copy {
          border-bottom: 1px solid #ACA899;
          height: 95%;
        }

        .dp-about .title {
          color: red;
          background-color: inherit;
          font-weight: bold;
        }

        .dp-about .para {
          margin: 0 0 4px 0;
        }

        .dp-about .footer {
          background-color: #ECEADB;
          color: #333;
          border-top: 1px solid #fff;
          text-align: right;
        }

        .dp-about .close {
          font-size: 11px;
          font-family: Tahoma, Verdana, Arial, sans-serif !important;
          background-color: #ECEADB;
          color: #333;
          width: 60px;
          height: 22px;
        }

      /* Language specific styles */

      .dp-highlighter .comment, .dp-highlighter .comments {
        color: #008200;
        background-color: inherit;
      }

      .dp-highlighter .string {
        color: blue;
        background-color: inherit;
      }

      .dp-highlighter .keyword {
        color: #069;
        font-weight: bold;
        background-color: inherit;
      }

      .dp-highlighter .preprocessor {
        color: gray;
        background-color: inherit;
      }
`,
    };

    // Configure the image toolbar
    if (this.imageToolbarItems && Array.isArray(this.imageToolbarItems)) {
      const hasSlash = this.imageToolbarItems.includes('/');
      let imageToolbarString = '';

      if (hasSlash) {
        imageToolbarString = this.imageToolbarItems.join('');
      } else {
        imageToolbarString = `{${this.imageToolbarItems.join(',')}}`;
      }

      enhancedConfig.controltoolbar_IMG = imageToolbarString;
      // Also try alternative property names that might be used by different RTE versions
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

        // Clean double pipes, commas, or braces
        fullToolbar = this.cleanToolbarString(fullToolbar);
      }

      enhancedConfig.toolbar = 'custom';
      enhancedConfig.toolbar_custom = fullToolbar;
    }

    return enhancedConfig;
  }

  /**
   * Apply custom styles to improve mobile experience
   */
  private _applyCustomStyles() {
    // Add a custom stylesheet to fix mobile issues if it doesn't exist yet
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
            /* Hide mobile toolbar, always show desktop toolbar */
           
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
      this.onChange(html);
      this.onTouched();

      if (this.ngControl?.control) {
        this.ngControl.control.setValue(html, { emitEvent: false });
        this.ngControl.control.updateValueAndValidity();
      }
    } catch (error) {
      console.error('[RTE] Failed to inject content into iframe:', error);
    }
  }

  // Method to hide all floating panels
  public hideAllFloatPanels(): void {
    try {
      // Hide all float panels
      const floatPanels = document.querySelectorAll('rte-floatpanel');
      floatPanels.forEach((panel) => {
        if (panel && panel.parentNode) {
          try {
            panel.parentNode.removeChild(panel);
          } catch (e) {
            // If removal fails, just hide it
            if (panel instanceof HTMLElement) {
              panel.style.display = 'none';
            }
          }
        }
      });

      // Also try removing the specific paragraph operations panel
      const paragraphOpPanel = document.querySelector(
        '.rte-floatpanel-paragraphop'
      );
      if (paragraphOpPanel && paragraphOpPanel.parentNode) {
        try {
          paragraphOpPanel.parentNode.removeChild(paragraphOpPanel);
        } catch (e) {
          if (paragraphOpPanel instanceof HTMLElement) {
            paragraphOpPanel.style.display = 'none';
          }
        }
      }

      // Clean up any other RTE-related floating elements
      const rteFloatingElements = document.querySelectorAll('[class*="rte-float"], [class*="rte-popup"]');
      rteFloatingElements.forEach((el) => {
        if (el && el.parentNode) {
          try {
            el.parentNode.removeChild(el);
          } catch (e) {
            if (el instanceof HTMLElement) {
              el.style.display = 'none';
            }
          }
        }
      });
    } catch (error) {
      console.warn('[RTE] Error cleaning up float panels:', error);
    }
  }
}