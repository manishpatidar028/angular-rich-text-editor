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
  Validators,
} from '@angular/forms';
import { RichTextEditorService } from './rich-text-editor.service';

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

  @Input() imageUploadHandler: (file: File) => Promise<string> = async () => '';

  @Input() errorMessages: { [key: string]: string } = {
    required: 'This field is required.',
  };

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
  private isSystemUpdate = false;
  private wasInitialValueSet = false;

  onChange = (value: any) => {};
  onTouched = () => {};

  constructor(private injector: Injector, private configService: RichTextEditorService) {}

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
    this.loadExternalAssets()
      .then(() => {
        this.initEditor();
      })
      .catch((err) => {
        console.error('[RTE] Failed to load assets:', err);
      });
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
          control.setValue(html, { emitEvent: false }); // don't double emit
          control.updateValueAndValidity();
        }

        if (prevValue && cleaned.length === 0) {
          const control = this.ngControl?.control;
          console.log(control);
          console.log('[RTE] Full clear detected after initial value');
        }
      }, 150);
    };

    ['change', 'keyup', 'paste', 'input'].forEach((event) => {
      this.editorInstance.attachEvent(event, triggerUpdate);
    });

    this.editorInstance.attachEvent('blur', () => this.onTouched());

    this.editorInstance.attachEvent('imageUpload', async (file: File) => {
      if (this.imageUploadHandler) {
        try {
          const url = await this.imageUploadHandler(file);
          this.editorInstance.insertImage(url);
        } catch (error) {
          console.error('[RTE] Image upload failed:', error);
        }
      }
    });
  }

  writeValue(value: any): void {
    const incomingValue = value || '';
    this.value =  incomingValue ;
    this.wasInitialValueSet = true;

    console.log(incomingValue);
    if (this.editorInstance) {
      const current = this.editorInstance.getHTMLCode() || '';

      // ✅ Only call setHTMLCode if content has *meaningfully* changed
      if (this.normalizeHtml(current) !== this.normalizeHtml(incomingValue)) {
        this.isSystemUpdate = true;
        this.editorInstance.setHTMLCode( incomingValue );
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
  }

  hasRequiredValidator(control: AbstractControl | null): boolean {
  if (!control || !control.validator) return false;
  const result = control.validator({ value: null } as AbstractControl);
  return !!(result && result['required']);
}
  validate(control: AbstractControl): ValidationErrors | null {
    const value = control?.value || '';
    const isEmpty = this.isTrulyEmpty(value);

    const isRequired = control?.hasValidator
      ? control.hasValidator(Validators.required)
      : !!control.validator?.({} as AbstractControl)?.['required'];

    if (isRequired && isEmpty) {
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
    this.getCharacterCount(); // debug
    return (
      (!!this.ngControl?.control?.invalid && !!this.ngControl?.control?.touched) || !!(this.ngControl?.control?.touched && this.value.length === 0)
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

      const existingScript = doc.querySelector('script[src*="rte.js"]');
      if (existingScript) {
        resolve();
        return;
      }

      const cssLink = doc.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'assets/richtexteditor/rte_theme_default.css';
      doc.head.appendChild(cssLink);

      const rteScript = doc.createElement('script');
      rteScript.src = 'assets/richtexteditor/rte.js';
      rteScript.onload = () => {
        const pluginScript = doc.createElement('script');
        pluginScript.src = 'assets/richtexteditor/plugins/all_plugins.js';
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
    // Set default height if not specified
    if (!this.config.height) {
      this.config.height = 300;
    }
    
    // Start with a base configuration that forces desktop mode
    const enhancedConfig = {
      ...this.config,
      license: this.licenseKey,
      content_changed_callback: () => {
        this.fixCharacterCount();
      },
      enableObjectResizing: true,
      enableImageUpload: this.enableImageUpload,
      enableVideoEmbed: this.enableVideoEmbed,
      
      // Disable any automatic mobile detection/adjustments
      forceDesktopMode: true,
      disableMobileMode: true,
      toolbarModeViewport: 'always-desktop',
      showFloatingToolbar: false,
      showBottomToolbar: false,
      contentCssUrl: this.configService.getContentCssUrl(),
    };
    
    // If custom toolbar isn't specified, create one based on enabled features
    if (!enhancedConfig.toolbar) {
      const toolbarItems = ['bold', 'italic', 'underline', 'fontname', 'fontsize', 'forecolor', 'backcolor'];
      
      if (this.enableImageUpload) {
        toolbarItems.push('insertimage');
      }
      
      if (this.enableVideoEmbed) {
        toolbarItems.push('insertvideo');
      }
      
      toolbarItems.push('removeformat', 'undo', 'redo');
      
      enhancedConfig.toolbar = 'custom';
      enhancedConfig.toolbar_custom = toolbarItems.join(',');
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
}
