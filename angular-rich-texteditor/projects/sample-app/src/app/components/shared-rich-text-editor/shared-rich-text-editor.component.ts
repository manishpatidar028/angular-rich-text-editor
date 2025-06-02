import { Component, EventEmitter, forwardRef, Injector, Input, OnInit, Output, OnDestroy, ChangeDetectionStrategy, NgZone } from '@angular/core';
import { AbstractControl, ControlValueAccessor, FormControl, FormsModule, NG_VALIDATORS, NG_VALUE_ACCESSOR, NgControl, ReactiveFormsModule, ValidationErrors, Validator } from '@angular/forms';
import { RichTextEditorModule, RichTextEditorService, RTEImageTool, RTEPreset } from '../../../../../rich-text-editor/src/public-api';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-shared-rich-text-editor',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RichTextEditorModule, CommonModule],
  templateUrl: './shared-rich-text-editor.component.html',
  styleUrl: './shared-rich-text-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush, // ✅ Reduce change detection cycles
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SharedRichTextEditorComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => SharedRichTextEditorComponent),
      multi: true,
    },
  ],
})
export class SharedRichTextEditorComponent implements OnInit, OnDestroy, ControlValueAccessor, Validator
{
  // 💡 Common Inputs
  @Input() public name = ''; // Required for ngModel
  @Input() public label = '';
  @Input() public configType?: RTEPreset;
  @Input() public placeholder = '';
  @Input() public initialContent = '';
  @Input() public readOnly = false;

  @Input() public formControls!: AbstractControl;
  @Input() public errorMessage: { [key: string]: string } = {};

  @Input() public imageToolbarItems: Array<RTEImageTool | '/'> = [];
  @Input() public excludedToolbarItems: string[] = [
    'paragraphs',
    'html2pdf',
    'strike',
    'toggle_paragraphop',
    'menu_paragraphop',
    'insertcode',
  ];
  @Input() public enableImageUpload = true;
  @Input() public enableVideoEmbed = false;

  // 🔁 Two-way binding for template-driven forms
  @Input() public ngModel = '';
  @Output() public ngModelChange = new EventEmitter<string>();

  @Output() public contentChanged = new EventEmitter<void>();
  @Output() public blurEvent = new EventEmitter<void>();
  @Output() public focusEvent = new EventEmitter<void>();

  public value = '';
  public isInvalid = false;
  protected _isTemplateDriven = false;

  private _ngControl: NgControl | null = null;
  protected _isDestroyed = false; // ✅ Track component destruction
  private _updateTimer: any; // ✅ Debounce updates
  private _isUpdating = false; // ✅ Prevent concurrent updates

  constructor(
    private _injector: Injector,
    private _richTextEditorService: RichTextEditorService,
    private _ngZone: NgZone // ✅ For running operations outside Angular zone
  ) {}

  ngOnInit(): void {
    this._ngControl = this._injector.get(NgControl, null, { optional: true });

    if (this._ngControl?.control) {
      this._ngControl.valueAccessor = this;
    }

    // Determine if template-driven (i.e. no FormGroup around it)
    this._isTemplateDriven = !this._ngControl?.control;
  }

  ngOnDestroy(): void {
    this._isDestroyed = true;
    
    // ✅ Clear any pending timers
    if (this._updateTimer) {
      clearTimeout(this._updateTimer);
    }
    
    // ✅ Run cleanup outside Angular zone to prevent interference
    this._ngZone.runOutsideAngular(() => {
      // Give the editor time to finish any pending operations
      setTimeout(() => {
        // Additional cleanup if needed
      }, 100);
    });
  }

  public get getConfigType(): RTEPreset {
    return this.configType || 'FULL';
  }
  
  public get safeFormControl(): FormControl | null {
    const ctrl = this.formControls || this._ngControl?.control;
    return ctrl instanceof FormControl ? ctrl : null;
  }

  public writeValue(val: string | null | undefined): void {
    // ✅ Prevent updates if component is destroyed or currently updating
    if (this._isDestroyed || this._isUpdating) {
      return;
    }

    const newValue = val || this.initialContent || '';
    
    // ✅ Prevent unnecessary updates that can cause DOM sync issues
    if (this.value === newValue) {
      return;
    }
    
    this._isUpdating = true;
    
    // ✅ Run outside Angular zone to prevent change detection interference
    this._ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        if (!this._isDestroyed) {
          this.value = newValue;
          this.ngModel = newValue;
          this._isUpdating = false;
        }
      }, 0);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public onChange: (value: string) => void = () => {};

  public registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public onTouched: () => void = () => {};

  public onContentChanged(html: string): void {
    console.log('Content changed:', html);
    // ✅ Prevent updates if component is destroyed or currently updating
    if (this._isDestroyed || this._isUpdating) {
      return;
    }

    // ✅ Prevent unnecessary updates if value hasn't actually changed
    if (this.value === html) {
      return;
    }
    
    // ✅ Clear any pending updates
    if (this._updateTimer) {
      clearTimeout(this._updateTimer);
    }
    
    this._isUpdating = true;
    
    // ✅ Debounce rapid updates to prevent DOM conflicts
    this._updateTimer = setTimeout(() => {
      if (this._isDestroyed) {
        return;
      }

      this._ngZone.run(() => {
        this.value = html;

        if (!this._isTemplateDriven) {
          this.onChange(html); // 🔁 reactive
        } else {
          this.ngModel = html;
          this.ngModelChange.emit(html); // 🔁 template-driven
        }

        this.contentChanged.emit();
        this._isUpdating = false;
      });
    }, 150); // ✅ Debounce for 150ms to prevent rapid fire updates
  }

  public onBlur(): void {
    if (this._isDestroyed) {
      return;
    }
    
    this.onTouched();
    this.blurEvent.emit();
  }

  // ✅ FIXED: Updated validation logic to handle images and other content properly
  public validate(control: AbstractControl): ValidationErrors | null {
    // ✅ Skip validation if component is destroyed or updating
    if (this._isDestroyed || this._isUpdating) {
      return null;
    }

    // Get the actual value from the control or use this.value
    const value = control?.value || this.value || '';
    
    // ✅ Prevent validation during rapid content changes to avoid DOM conflicts
    if (!value && !this.value) {
      return null; // Let the underlying editor handle empty state validation
    }
    
    // Use the same logic as the underlying RichTextEditorComponent
    const isEmpty = this.isTrulyEmpty(value);
    
    // Only return required error if the content is truly empty AND the field has required validator
    if (this.hasRequiredValidator(control) && isEmpty) {
      return { required: true };
    }

    return null;
  }

  // ✅ Helper method to check if control has required validator
  private hasRequiredValidator(control: AbstractControl | null): boolean {
    if (!control || !control.validator) return false;
    
    try {
      const result = control.validator({ value: null } as AbstractControl);
      return !!(result && result['required']);
    } catch (error) {
      // ✅ Safe fallback if validator check fails
      return false;
    }
  }

  // ✅ Proper empty check that considers images and other content
  private isTrulyEmpty(html: string): boolean {
    if (!html || html.trim() === '') return true;
    
    try {
      const div = document.createElement('div');
      div.innerHTML = html;

      // Get text content (excluding &nbsp; entities)
      const text = div.textContent?.replace(/\u00A0/g, '').trim() || '';

      // Get cleaned HTML (removing empty tags but keeping content tags like images)
      const cleaned = div.innerHTML
        .replace(/<br\s*\/?>/gi, '')
        .replace(/<div>(\s|&nbsp;)*<\/div>/gi, '')
        .replace(/<p>(\s|&nbsp;)*<\/p>/gi, '')
        .replace(/&nbsp;/gi, '')
        .trim();

      // Content is truly empty only if there's no text AND no meaningful HTML content
      return !text && cleaned.length === 0;
    } catch (error) {
      // ✅ Safe fallback
      return !html || html.trim() === '';
    }
  }

  public insertVariable(variable: string): void {
    if (this._isDestroyed || this.readOnly) {
      return;
    }

    let formatted: string;
    if (variable === '${BUSINESS_LOGO}') {
      formatted = `<img src="${variable}" width="250" height="120" />`;
    } else {
      const safeVariable = variable.replace(/ /g, '_');
      formatted = `<span class="rte-variable-token" contenteditable="false">${safeVariable}</span>`;
    }
    
    // ✅ Run outside Angular zone to prevent interference
    this._ngZone.runOutsideAngular(() => {
      try {
        this._richTextEditorService.insertContentAtCursor(formatted);
        // ✅ Run the emission back in Angular zone
        this._ngZone.run(() => {
          this.contentChanged.emit();
        });
      } catch (error) {
        console.warn('Failed to insert variable:', error);
      }
    });
  }

  public getErrorMessage(): string | null {
    const errors = this.formControls?.errors || this._ngControl?.control?.errors;
    if (!errors) {
      return null;
    }
    const firstKey = Object.keys(errors)[0];
    return this.errorMessage[firstKey] || 'Invalid field';
  }

  public get formControl(): FormControl | null {
    return this.formControls instanceof FormControl ? this.formControls : null;
  }
}