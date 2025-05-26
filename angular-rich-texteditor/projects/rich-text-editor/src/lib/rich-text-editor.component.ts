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

  private editorInstance: any;
  private value: string = '';
  private ngControl: NgControl | null = null;
  private changeTimer: any;

  onChange = (value: any) => {};
  onTouched = () => {};

  constructor(
    private injector: Injector,
    private configService: RichTextEditorService
  ) {}

  ngOnInit() {
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
    // this.loadExternalAssets()
    //   .then(() => {
    //     this.initEditor();
    //   })
    //   .catch((err) => {
    //     console.error('[RTE] Failed to load assets:', err);
    //   });
    // this.initEditor();

    // Add a small delay to ensure DOM is fully rendered
    setTimeout(() => {
      this.initEditor();
    }, 100);
  }

  private initEditor() {
    // Prepare the final configuration with our custom settings
    const fullConfig = this.prepareConfiguration();
    this._applyCustomStyles();

    this.editorInstance = new RichTextEditor(
      this.editorContainer.nativeElement,
      fullConfig
    );

    if (this.value) {
      this.editorInstance.setHTMLCode(this.value);
    }

    const triggerUpdate = () => {
      if (this.changeTimer) clearTimeout(this.changeTimer);

      this.changeTimer = setTimeout(() => {
        const html = this.editorInstance.getHTMLCode() || '';
        const cleaned = html
          .replace(/\u00A0/g, '')
          .replace(/<[^>]+>/g, '')
          .trim();

        const prevValue = this.value;
        this.value = html;

        // ✅ Always trigger form update, even if content looks same
        this.onChange(html);
        this.onTouched();

        // ✅ Force validation cycle
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
          this.editorInstance.setHTMLCode('<p><br></p>');
        }
      }, 150);
    };

    ['change', 'keyup', 'paste', 'input'].forEach((event) => {
      this.editorInstance.attachEvent(event, triggerUpdate);
    });

    this.editorInstance.attachEvent('blur', () => this.onTouched());
  }

  writeValue(value: any): void {
    const incomingValue = value || '';
    this.value = incomingValue;
    if (this.editorInstance) {
      const current = this.editorInstance.getHTMLCode() || '';

      // ✅ Only call setHTMLCode if content has *meaningfully* changed
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
    if (this.editorInstance?.setReadOnly) {
      this.editorInstance.setReadOnly(isDisabled);
    }
  }

  ngOnDestroy() {
    if (this.editorInstance?.destroy) {
      this.editorInstance.destroy();
    }
    clearTimeout(this.changeTimer);
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
    if (!this.editorInstance) return;

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

  private loadExternalAssets(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const doc = document;

      const existingScript = doc.querySelector(
        'script[src*="node_modules/angular-rich-text-editor/src/assets/richtexteditor/rte.js"]'
      );
      if (existingScript) {
        resolve();
        return;
      }

      const cssLink = doc.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href =
        'node_modules/angular-rich-text-editor/src/assets/richtexteditor/rte_theme_default.css';
      doc.head.appendChild(cssLink);

      const rteScript = doc.createElement('script');
      rteScript.src =
        'node_modules/angular-rich-text-editor/src/assets/richtexteditor/rte.js';
      rteScript.onload = () => {
        const pluginScript = doc.createElement('script');
        pluginScript.src =
          'node_modules/angular-rich-text-editor/src/assets/richtexteditor/plugins/all_plugins.js';
        pluginScript.onload = () => resolve();
        pluginScript.onerror = () => reject('Failed to load all_plugins.js');
        doc.body.appendChild(pluginScript);
      };
      rteScript.onerror = () => reject('Failed to load rte.js');

      doc.body.appendChild(rteScript);
    });
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
      license: this.licenseKey,
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
      forceDesktopMode: true,
      disableMobileMode: true,
      toolbarModeViewport: 'always-desktop',
      showFloatingToolbar: false,
      showBottomToolbar: false,
      contentCssUrl: '',
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

    if (this.rtePreset && RTE_TOOLBAR_PRESETS[this.rtePreset]) {
      let fullToolbar = RTE_TOOLBAR_PRESETS[this.rtePreset];

      if (this.excludedToolbarItems.length) {
        for (const tool of this.excludedToolbarItems) {
          const toolPattern = new RegExp(`\\b${tool}\\b`, 'g');
          fullToolbar = fullToolbar.replace(toolPattern, '');
        }

        // Clean double pipes, commas, or braces
        fullToolbar = fullToolbar
          .replace(/,+/g, ',')
          .replace(/\|+/g, '|')
          .replace(/,{2,}/g, ',')
          .replace(/\{,/, '{')
          .replace(/,\}/, '}')
          .replace(/\|,/g, '|')
          .replace(/,\|/g, '|')
          .replace(/,\s*}/g, '}')
          .replace(/{\s*}/g, '')
          .replace(/\|\|/g, '|')
          .replace(/^(\||,)+|(\||,)+$/g, '')
          .trim();
      }
      if (this.imageToolbarItems && Array.isArray(this.imageToolbarItems)) {
        const hasSlash = this.imageToolbarItems.includes('/');
        let imageToolbarString = '';

        if (hasSlash) {
          imageToolbarString = this.imageToolbarItems.join('');
        } else {
          imageToolbarString = `{${this.imageToolbarItems.join(',')}}`;
        }

        enhancedConfig.controltoolbar_IMG = imageToolbarString;
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
          
          /* Hide any mobile-specific UI the library might add */
          .rte-toolbar-mobile,
          .rte-mobile-menu-toggle {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(styleEl);
    }
  }

public insertContentAtCursor(content: string) {
  try {
    const iframe = this.editorContainer.nativeElement.querySelector('iframe');

    if (!iframe?.contentWindow || !iframe.contentDocument) {
      console.warn('[RTE] iframe not found or inaccessible');
      return;
    }

    // Focus the iframe's editor body
    const iframeDoc = iframe.contentDocument;
    const editableBody = iframeDoc.body;

    if (!editableBody?.isContentEditable) {
      console.warn('[RTE] iframe body is not editable');
      return;
    }

    // Set focus into the iframe document
    editableBody.focus();

    // Inject content at cursor position using iframe document
    iframeDoc.execCommand('insertHTML', false, content);

    // Sync model with new content
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


}
