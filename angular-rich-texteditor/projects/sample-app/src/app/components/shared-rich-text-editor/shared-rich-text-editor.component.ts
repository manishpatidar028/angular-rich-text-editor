import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  forwardRef,
  Injector,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import {
  NG_VALUE_ACCESSOR,
  NG_VALIDATORS,
  ControlValueAccessor,
  Validator,
  AbstractControl,
  NgControl,
  FormControl,
  ValidationErrors,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { RichTextEditorModule, RichTextEditorService, RTEImageTool, RTEPreset } from 'angular-rich-text-editor';
1
@Component({
  selector: 'app-shared-rich-text-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RichTextEditorModule,
    ReactiveFormsModule,
  ],
  templateUrl: './shared-rich-text-editor.component.html',
  styleUrl: './shared-rich-text-editor.component.scss',
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
export class SharedRichTextEditorComponent
  implements OnInit, ControlValueAccessor, Validator
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
@Input() fileUploadHandler!: (
  file: File,
  callback: (url: string | null, errorCode?: string) => void,
  optionalIndex?: number,
  optionalFiles?: File[]
) => void;

  @Input() public imageToolbarItems: Array<RTEImageTool | '/'> = ['menu_controljustify', 'delete', 'imagestyle'];
  @Input() public excludedToolbarItems: string[] = [
    'paragraphs',
    'html2pdf',
    'strike',
    'toggle_paragraphop',
    'menu_paragraphop',
    'insertcode',
    'insertgallery'
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

  constructor(
    private _injector: Injector,
    private _richTextEditorService: RichTextEditorService
  ) {}

  ngOnInit(): void {
    this._ngControl = this._injector.get(NgControl, null, { optional: true });

    if (this._ngControl?.control) {
      this._ngControl.valueAccessor = this;
    }

    // Determine if template-driven (i.e. no FormGroup around it)
    this._isTemplateDriven = !this._ngControl?.control;
  }

  public get getConfigType(): RTEPreset {
    return this.configType || 'FULL';
  }
  public get safeFormControl(): FormControl | null {
    const ctrl = this.formControls || this._ngControl?.control;
    return ctrl instanceof FormControl ? ctrl : null;
  }

  public get safeUploadHandler() {
  return this.fileUploadHandler ?? (() => {});
}


  public writeValue(val: string | null | undefined): void {
    this.value = val || this.initialContent || '';
    this.ngModel = this.value;
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
    this.value = html;

    if (!this._isTemplateDriven) {
      this.onChange(html); // 🔁 reactive
    } else {
      this.ngModel = html;
      this.ngModelChange.emit(html); // 🔁 template-driven
    }

    this.contentChanged.emit();
  }

  public onBlur(): void {
    this.onTouched();
    this.blurEvent.emit();
  }

  public validate(): ValidationErrors | null {
    const container = document.createElement('div');
    container.innerHTML = this.value || '';

    const text = container.textContent?.trim() || '';
    const hasImage = container.querySelector('img') !== null;
    const hasVideo = container.querySelector('video') !== null;

    const isEmpty = text.length === 0 && !hasImage && !hasVideo;

    return isEmpty ? { required: true } : null;
  }

  public insertVariable(variable: string): void {
    let formatted: string;
    if (variable === '${BUSINESS_LOGO}') {
      formatted = `<img src="${variable}" width="250" height="120" />`;
    } else {
      const safeVariable = variable.replace(/ /g, '_');
      formatted = `<span class="rte-variable-token" contenteditable="false">${safeVariable}</span>`;
    }
    this._richTextEditorService.insertContentAtCursor(formatted);
    this.contentChanged.emit();
  }

  public get formControl(): FormControl | null {
    return this.formControls instanceof FormControl ? this.formControls : null;
  }
  private _stripHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
  }

  public simulateFailingUpload = (
  file: File,
  callback: (url: string | null, errorCode?: string) => void
): void => {
  console.log('[TEST] Simulating image upload failure...');
  setTimeout(() => {
    callback(null, 'mock-upload-error');
  }, 1500);
};

}
