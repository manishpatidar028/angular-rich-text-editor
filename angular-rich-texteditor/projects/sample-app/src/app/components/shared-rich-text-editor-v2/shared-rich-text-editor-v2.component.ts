import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  forwardRef,
  ViewChild,
  AfterViewInit,
  Injector,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  NG_VALIDATORS,
  Validator,
  AbstractControl,
  ValidationErrors,
  FormsModule,
  ReactiveFormsModule,
  NgControl,
} from '@angular/forms';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import { RichTextEditorComponent, RichTextEditorConfig, RichTextEditorModule, RTEImageTool, RTEPreset } from '../../../../../rich-text-editor/src/public-api';

export interface AppRteConfig {
  height?: number;
  width?: number | string;
  placeholder?: string;
  maxLength?: number;
  showCharacterCount?: boolean;
  showWordCount?: boolean;
  theme?: 'default' | 'bordered' | 'minimal';
  autoFocus?: boolean;
}

@Component({
  selector: 'app-rte-wrapper-v2',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CommonModule, RichTextEditorModule],
  template: `
    <div class="app-rte-container" [ngClass]="containerClasses">
      <div class="rte-header" *ngIf="showStats && (wrapperConfig.showCharacterCount || wrapperConfig.showWordCount)">
        <div class="stats-container">
          <span *ngIf="wrapperConfig.showCharacterCount" class="stat-item">
            Characters: {{ characterCount }}<span *ngIf="wrapperConfig.maxLength">/{{ wrapperConfig.maxLength }}</span>
          </span>
          <span *ngIf="wrapperConfig.showWordCount" class="stat-item">
            Words: {{ wordCount }}
          </span>
        </div>
      </div>
      <lib-rich-text-editor
        #richTextEditor
        [config]="editorConfig"
        [rtePreset]="preset"
        [imageToolbarItems]="imageToolbarItems"
        [excludedToolbarItems]="excludedToolbarItems"
        [initialContent]="initialValue"
        [errorMessages]="customErrorMessages"
        [fileUploadHandler]="fileUploadHandler"
        [enableImageUpload]="enableImageUpload"
        [enableVideoEmbed]="enableVideoEmbed"
        [readonly]="readonly"
        [licenseKey]="licenseKey"
        (ngModelChange)="onEditorChange($event)">
      </lib-rich-text-editor>
      <div 
        class="placeholder-overlay" 
        *ngIf="showPlaceholder"
        (click)="focusEditor()">
        {{ wrapperConfig.placeholder }}
      </div>
      <div 
        class="character-warning" 
        *ngIf="wrapperConfig.maxLength && isNearLimit">
        {{ wrapperConfig.maxLength - characterCount }} characters remaining
      </div>
    </div>
  `,
  styles: [/* ...existing styles... */],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppRteWrapperComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => AppRteWrapperComponent),
      multi: true,
    },
  ],
})
export class AppRteWrapperComponent
  implements OnInit, AfterViewInit, OnDestroy, ControlValueAccessor, Validator {

  @ViewChild('richTextEditor') richTextEditor!: RichTextEditorComponent;

  @Input() wrapperConfig: AppRteConfig = {};
  @Input() preset: RTEPreset = 'STANDARD';
  @Input() licenseKey: string = '';
  @Input() public formControls!: AbstractControl | null;
  @Input() imageToolbarItems: (RTEImageTool | '/')[] | null = null;
  @Input() excludedToolbarItems: string[] = [];
  @Input() enableImageUpload: boolean = false;
  @Input() enableVideoEmbed: boolean = false;
  @Input() readonly: boolean = false;
  @Input() showStats: boolean = true;
  @Input() fileUploadHandler: (
    file: File,
    callback: (url: string | null, errorCode?: string) => void,
    optionalIndex?: number,
    optionalFiles?: File[]
  ) => void = this.defaultFileUploadHandler.bind(this);
  @Input() errorMessages: { [key: string]: string } = {};

  @Output() contentChange = new EventEmitter<string>();
  @Output() focus = new EventEmitter<void>();
  @Output() blur = new EventEmitter<void>();

  public value: string = '';
  public characterCount: number = 0;
  public wordCount: number = 0;
  public validationMessages: string[] = [];
  
  private destroy$ = new Subject<void>();
  private contentUpdate$ = new Subject<string>();

  private _ngControl: NgControl | null = null;

  private _onChange: (value: string) => void = () => {};
  private _onTouched: () => void = () => {};

  constructor(private _injector: Injector) {}

  ngOnInit() {
    this._ngControl = this._injector.get(NgControl, null, { optional: true });
    if (this._ngControl?.control) {
      this._ngControl.valueAccessor = this;
    }
    this.setupContentTracking();
    this.setInitialValue();
  }

  ngAfterViewInit() {
    // Listen to value changes from the inner editor
    if (this.richTextEditor) {
      // Patch: Listen to value changes from the editor and propagate to Angular
      const origOnChange = this.richTextEditor.onChange;
      this.richTextEditor.registerOnChange((val: string) => {
        this.value = val;
        this.updateContentStats();
        this._onChange(val);
        this.contentChange.emit(val);
        if (origOnChange) origOnChange(val);
      });
      // Patch: Listen to touched
      const origOnTouched = this.richTextEditor.onTouched;
      this.richTextEditor.registerOnTouched(() => {
        this._onTouched();
        if (origOnTouched) origOnTouched();
      });
    }
    if (this.wrapperConfig.autoFocus) {
      setTimeout(() => this.focusEditor(), 100);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ControlValueAccessor implementation
writeValue(value: any): void {
  this.value = value || '';
  if (this.richTextEditor && this.richTextEditor.writeValue) {
    // Only update if value is different to avoid loops
    if (this.richTextEditor['value'] !== this.value) {
      this.richTextEditor.writeValue(this.value);
    }
  }
}

 registerOnChange(fn: any): void {
  this._onChange = fn;
  if (this.richTextEditor && this.richTextEditor.registerOnChange) {
    this.richTextEditor.registerOnChange(fn);
  }
}

registerOnTouched(fn: any): void {
  this._onTouched = fn;
  if (this.richTextEditor && this.richTextEditor.registerOnTouched) {
    this.richTextEditor.registerOnTouched(fn);
  }
}

  setDisabledState(isDisabled: boolean): void {
    this.readonly = isDisabled;
    if (this.richTextEditor) {
      this.richTextEditor.setDisabledState?.(isDisabled);
    }
  }

  // Validator implementation
  validate(control: AbstractControl): any{
    const errors: ValidationErrors = {};
    if (this.isRequired(control) && this.isEmpty) {
      errors['required'] = true;
    }
    if (this.wrapperConfig.maxLength && this.characterCount > this.wrapperConfig.maxLength) {
      errors['maxlength'] = {
        requiredLength: this.wrapperConfig.maxLength,
        actualLength: this.characterCount
      };
    }
    this.updateValidationMessages(errors);
    return Object.keys(errors).length > 0 ? errors : null;
  }

  // Content handling
  onEditorChange(content: any): void {
    console.log('asdfv', content);
    // This is only for (ngModelChange), but real value sync is handled in ngAfterViewInit
    this.value = content;
    this.updateContentStats();
    this._onChange(content);
    this._onTouched();
    this.contentChange.emit(content);
    this.contentUpdate$.next(content);
  }

  private setupContentTracking(): void {
    this.contentUpdate$
      .pipe(
        debounceTime(100),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.updateContentStats();
      });
  }

  private updateContentStats(): void {
    const div = document.createElement('div');
    div.innerHTML = this.value || '';
    const textContent = div.textContent || div.innerText || '';
    this.characterCount = textContent.length;
    this.wordCount = textContent.trim() ? textContent.trim().split(/\s+/).length : 0;
  }

  private updateValidationMessages(errors: ValidationErrors): void {
    this.validationMessages = [];
    const messages: any = {
      required: 'This field is required',
      maxlength: `Maximum ${this.wrapperConfig.maxLength} characters allowed`,
      ...this.errorMessages
    };
    for (const [key] of Object.entries(errors)) {
      if (messages[key]) {
        this.validationMessages.push(messages[key]);
      }
    }
  }

  private setInitialValue(): void {
    if (this.value) {
      this.updateContentStats();
    }
  }

  // Utility methods
  public focusEditor(): void {
    if (this.richTextEditor) {
      // You might need to access the internal editor instance
      this.focus.emit();
    }
  }

  public insertContent(content: string): void {
    if (this.richTextEditor && this.richTextEditor.insertContentAtCursor) {
      this.richTextEditor.insertContentAtCursor(content);
    }
  }

  public getContent(): string {
    return this.value;
  }

  public clearContent(): void {
    console.log('Clearing content');
    this.writeValue('');
    this.onEditorChange('');
  }

  // Default file upload handler
  private defaultFileUploadHandler(
    file: File,
    callback: (url: string | null, errorCode?: string) => void
  ): void {
    console.warn('No file upload handler provided');
    callback(null, 'No upload handler configured');
  }

  // Helper methods
  private isRequired(control: AbstractControl | null): boolean {
    if (!control || !control.validator) return false;
    const result = control.validator({ value: null } as AbstractControl);
    return !!(result && result['required']);
  }

  // Computed properties
  get editorConfig(): RichTextEditorConfig {
    return {
      height: this.wrapperConfig.height || 300,
      width: this.wrapperConfig.width || '100%',
      ...this.wrapperConfig
    };
  }

  get initialValue(): string {
    return this.value;
  }

  get customErrorMessages(): { [key: string]: string } {
    return {
      required: 'This field is required',
      maxlength: 'Content exceeds maximum length',
      ...this.errorMessages
    };
  }

  get containerClasses(): string {
    const classes = [];
    if (this.wrapperConfig.theme) {
      classes.push(`theme-${this.wrapperConfig.theme}`);
    }
    if (this.validationMessages.length > 0) {
      classes.push('has-error');
    }
    if (this.readonly) {
      classes.push('disabled');
    }
    return classes.join(' ');
  }

  get showPlaceholder(): boolean {
    return !!(this.wrapperConfig.placeholder && this.isEmpty && !this.readonly);
  }

  get showValidationErrors(): boolean {
    return this.validationMessages.length > 0;
  }

  get isEmpty(): boolean {
    // Use the same logic as the inner editor for "truly empty"
    const div = document.createElement('div');
    div.innerHTML = this.value || '';
    // If there is any image, video, iframe, embed, object, or audio, it's not empty
    if (div.querySelector('img,video,iframe,embed,object,audio')) {
      return false;
    }
    const textContent = div.textContent || div.innerText || '';
    return textContent.replace(/\u00A0/g, '').trim().length === 0;
  }

  get isNearLimit(): boolean {
    if (!this.wrapperConfig.maxLength) return false;
    const remaining = this.wrapperConfig.maxLength - this.characterCount;
    return remaining <= 50 && remaining >= 0;
  }
}