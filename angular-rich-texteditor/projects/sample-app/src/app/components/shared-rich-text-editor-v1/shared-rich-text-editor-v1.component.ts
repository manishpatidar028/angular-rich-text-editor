import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  forwardRef,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  NG_VALIDATORS,
  Validator,
  AbstractControl,
  ValidationErrors,
  FormControl,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';

// Import your RTE package components
import { 
  RichTextEditorComponent, 
  RichTextEditorConfig, 
  RTEPreset, 
  RTEImageTool ,
  RichTextEditorModule
} from 'angular-rich-text-editor';
import { CommonModule } from '@angular/common';

export interface WrapperConfig {
  height?: number;
  width?: number | string;
  placeholder?: string;
  maxLength?: number;
  showCharacterCount?: boolean;
  showWordCount?: boolean;
  theme?: 'light' | 'dark' | 'minimal';
  autoSave?: boolean;
  autoSaveInterval?: number; // in milliseconds
}

export interface ContentStats {
  characterCount: number;
  wordCount: number;
  isEmpty: boolean;
}

@Component({
  selector: 'app-rte-wrapper',
  template: `
    <div class="rte-wrapper" [class]="wrapperClasses">
      <!-- Header with stats and actions -->
      <div class="rte-header" *ngIf="showHeader">
        <div class="rte-stats" *ngIf="config.showCharacterCount || config.showWordCount">
          <span *ngIf="config.showCharacterCount" class="stat-item">
            Characters: {{ contentStats.characterCount }}
            <span *ngIf="config.maxLength" class="max-length">/ {{ config.maxLength }}</span>
          </span>
          <span *ngIf="config.showWordCount" class="stat-item">
            Words: {{ contentStats.wordCount }}
          </span>
        </div>
        
        <div class="rte-actions" *ngIf="showActions">
          <button 
            type="button" 
            class="action-btn"
            (click)="clearContent()"
            [disabled]="disabled || readonly || contentStats.isEmpty"
            title="Clear content">
            <i class="icon-clear"></i> Clear
          </button>
          
          <button 
            type="button" 
            class="action-btn"
            (click)="copyContent()"
            [disabled]="contentStats.isEmpty"
            title="Copy content">
            <i class="icon-copy"></i> Copy
          </button>
          
          <button 
            type="button" 
            class="action-btn"
            (click)="toggleFullscreen()"
            title="Toggle fullscreen">
            <i [class]="fullscreenIcon"></i> {{ isFullscreen ? 'Exit' : 'Fullscreen' }}
          </button>
        </div>
      </div>

      <!-- Main Editor -->
      <div class="rte-editor-container" #editorContainer>
        <lib-rich-text-editor
          #richTextEditor
          [config]="editorConfig"
          [rtePreset]="preset"
          [imageToolbarItems]="imageTools"
          [excludedToolbarItems]="excludedTools"
          [initialContent]="value"
          [errorMessages]="errorMessages"
          [fileUploadHandler]="fileUploadHandler"
          [enableImageUpload]="enableImageUpload"
          [enableVideoEmbed]="enableVideoEmbed"
          [readonly]="disabled || readonly"
          [licenseKey]="licenseKey"
          (ngModelChange)="onContentChange($event)">
        </lib-rich-text-editor>
        
        <!-- Placeholder overlay -->
        <div 
          class="rte-placeholder" 
          *ngIf="showPlaceholder && config.placeholder"
          (click)="focusEditor()">
          {{ config.placeholder }}
        </div>
      </div>

      <!-- Footer -->
      <div class="rte-footer" *ngIf="showFooter">
        <div class="validation-messages" *ngIf="showValidationErrors">
          <div class="error-message" *ngFor="let error of validationErrors">
            {{ error }}
          </div>
        </div>
        
        <div class="auto-save-status" *ngIf="config.autoSave">
          <span [class]="autoSaveStatusClass">{{ autoSaveStatus }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .rte-wrapper {
      border: 1px solid #ddd;
      border-radius: 4px;
      background: white;
      transition: all 0.2s ease;
    }

    .rte-wrapper:focus-within {
      border-color: #377dff;
      box-shadow: 0 0 0 2px rgba(55, 125, 255, 0.1);
    }

    .rte-wrapper.theme-dark {
      background: #2d3748;
      border-color: #4a5568;
      color: white;
    }

    .rte-wrapper.theme-minimal {
      border: none;
      border-bottom: 2px solid #e2e8f0;
      border-radius: 0;
      background: transparent;
    }

    .rte-wrapper.disabled {
      opacity: 0.6;
      pointer-events: none;
    }

    .rte-wrapper.error {
      border-color: #e53e3e;
    }

    .rte-wrapper.fullscreen {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 9999;
      border-radius: 0;
      margin: 0;
    }

    .rte-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
      background: #f7fafc;
      font-size: 12px;
    }

    .theme-dark .rte-header {
      background: #1a202c;
      border-color: #4a5568;
    }

    .rte-stats {
      display: flex;
      gap: 16px;
      color: #718096;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .max-length {
      font-weight: 500;
    }

    .rte-actions {
      display: flex;
      gap: 8px;
    }

    .action-btn {
      padding: 4px 8px;
      border: 1px solid #e2e8f0;
      background: white;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .action-btn:hover:not(:disabled) {
      background: #f7fafc;
      border-color: #cbd5e0;
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .rte-editor-container {
      position: relative;
      min-height: 200px;
    }

    .rte-placeholder {
      position: absolute;
      top: 12px;
      left: 12px;
      color: #a0aec0;
      pointer-events: none;
      font-style: italic;
      z-index: 1;
    }

    .rte-footer {
      padding: 8px 12px;
      border-top: 1px solid #e2e8f0;
      background: #f7fafc;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }

    .theme-dark .rte-footer {
      background: #1a202c;
      border-color: #4a5568;
    }

    .validation-messages {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .error-message {
      color: #e53e3e;
      font-size: 11px;
    }

    .auto-save-status {
      color: #718096;
      font-size: 11px;
    }

    .auto-save-status.saving {
      color: #3182ce;
    }

    .auto-save-status.saved {
      color: #38a169;
    }

    .auto-save-status.error {
      color: #e53e3e;
    }

    /* Icon classes - you can replace with your preferred icon library */
    .icon-clear::before { content: '🗑️'; }
    .icon-copy::before { content: '📋'; }
    .icon-fullscreen::before { content: '⛶'; }
    .icon-exit-fullscreen::before { content: '⤓'; }

    /* Responsive adjustments */
    @media (max-width: 768px) {
      .rte-header {
        flex-direction: column;
        gap: 8px;
        align-items: stretch;
      }

      .rte-stats {
        justify-content: center;
      }

      .rte-actions {
        justify-content: center;
      }
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RteWrapperComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => RteWrapperComponent),
      multi: true,
    },
  ],
  standalone: true,
  imports: [RichTextEditorModule, CommonModule, ReactiveFormsModule, FormsModule],
})
export class RteWrapperComponent 
  implements OnInit, AfterViewInit, OnDestroy, ControlValueAccessor, Validator {

  @ViewChild('richTextEditor') richTextEditor!: RichTextEditorComponent;
  @ViewChild('editorContainer') editorContainer!: ElementRef;

  // Basic Configuration
  @Input() config: WrapperConfig = {};
  @Input() preset: RTEPreset = 'FULL';
  @Input() licenseKey: string = '';
  @Input() imageTools: (RTEImageTool | '/')[] | null = null;
  @Input() excludedTools: string[] = [];

  // Content & Validation
  @Input() errorMessages: { [key: string]: string } = {
    required: 'This field is required.',
    maxlength: 'Content exceeds maximum length.',
  };
  @Input() validators: any[] = [];

  // File Upload
  @Input() enableImageUpload: boolean = false;
  @Input() enableVideoEmbed: boolean = false;
  @Input() fileUploadHandler: (
    file: File,
    callback: (url: string | null, errorCode?: string) => void,
    optionalIndex?: number,
    optionalFiles?: File[]
  ) => void = () => {};

  // UI Configuration
  @Input() showHeader: boolean = true;
  @Input() showFooter: boolean = true;
  @Input() showActions: boolean = true;
  @Input() readonly: boolean = false;
  @Input() disabled: boolean = false;

  // Events
  @Output() contentChange = new EventEmitter<string>();
  // @Output() contentStats = new EventEmitter<ContentStats>();
  @Output() validationChange = new EventEmitter<ValidationErrors | null>();
  @Output() focus = new EventEmitter<void>();
  @Output() blur = new EventEmitter<void>();
  @Output() autoSave = new EventEmitter<string>();

  // Internal state
  public value: string = '';
  public contentStats: ContentStats = {
    characterCount: 0,
    wordCount: 0,
    isEmpty: true
  };
  public validationErrors: string[] = [];
  public isFullscreen: boolean = false;
  public autoSaveStatus: string = '';

  private destroy$ = new Subject<void>();
  private contentChange$ = new Subject<string>();
  private autoSaveTimer: any;

  // Form integration
  private onChange = (value: any) => {};
  private onTouched = () => {};

  constructor() {}

  ngOnInit() {
    this.setupAutoSave();
    this.setupContentTracking();
  }

  ngAfterViewInit() {
    // Additional setup after view init if needed
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
  }

  // ControlValueAccessor implementation
  writeValue(value: any): void {
    this.value = value || '';
    this.updateContentStats();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // Validator implementation
  validate(control: AbstractControl): ValidationErrors | null {
    const errors: ValidationErrors = {};

    // Required validation
    if (this.isRequired(control) && this.contentStats.isEmpty) {
      errors['required'] = true;
    }

    // Max length validation
    if (this.config.maxLength && this.contentStats.characterCount > this.config.maxLength) {
      errors['maxlength'] = {
        requiredLength: this.config.maxLength,
        actualLength: this.contentStats.characterCount
      };
    }

    // Custom validators
    if (this.validators && this.validators.length > 0) {
      for (const validator of this.validators) {
        const result = validator(control);
        if (result) {
          Object.assign(errors, result);
        }
      }
    }

    const finalErrors = Object.keys(errors).length > 0 ? errors : null;
    this.updateValidationErrors(finalErrors);
    this.validationChange.emit(finalErrors);

    return finalErrors;
  }

  // Content management
  onContentChange(content: any): void {
    console.log('Content changed:', content);
    this.value = content;
    this.updateContentStats();
    this.onChange(content);
    this.onTouched();
    this.contentChange.emit(content);
    this.contentChange$.next(content);
  }

  private updateContentStats(): void {
    const div = document.createElement('div');
    div.innerHTML = this.value || '';
    const textContent = div.textContent || div.innerText || '';
    
    console.log(this.value, textContent);
    this.contentStats = {
      characterCount: textContent.length,
      wordCount: textContent.trim() ? textContent.trim().split(/\s+/).length : 0,
      isEmpty: textContent.trim().length === 0
    };

    // this.contentStats.emit(this.contentStats);
  }

  private updateValidationErrors(errors: ValidationErrors | null): void {
    this.validationErrors = [];
    
    if (errors) {
      for (const [key, value] of Object.entries(errors)) {
        if (this.errorMessages[key]) {
          this.validationErrors.push(this.errorMessages[key]);
        } else {
          this.validationErrors.push(`Validation error: ${key}`);
        }
      }
    }
  }

  // Auto-save functionality
  private setupAutoSave(): void {
    if (!this.config.autoSave) return;

    const interval = this.config.autoSaveInterval || 5000;

    this.contentChange$
      .pipe(
        debounceTime(interval),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(content => {
        this.performAutoSave(content);
      });
  }

  private performAutoSave(content: string): void {
    this.autoSaveStatus = 'Saving...';
    this.autoSave.emit(content);
    
    // Simulate save completion - replace with actual save logic
    setTimeout(() => {
      this.autoSaveStatus = 'Saved';
      setTimeout(() => {
        this.autoSaveStatus = '';
      }, 2000);
    }, 500);
  }

  private setupContentTracking(): void {
    this.contentChange$
      .pipe(
        debounceTime(100),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.updateContentStats();
      });
  }

  // UI Actions
  clearContent(): void {
    if (this.disabled || this.readonly) return;
    
    this.value = '';
    this.richTextEditor.writeValue('');
    this.onContentChange('');
  }

  async copyContent(): Promise<void> {
    if (this.contentStats.isEmpty) return;

    try {
      await navigator.clipboard.writeText(this.value);
      // You might want to show a toast notification here
    } catch (err) {
      console.error('Failed to copy content:', err);
    }
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
    
    if (this.isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  focusEditor(): void {
    if (this.richTextEditor) {
      // Focus the editor - you may need to adjust this based on your RTE implementation
      this.focus.emit();
    }
  }

  // Utility methods
  public insertContent(content: string): void {
    if (this.richTextEditor && this.richTextEditor.insertContentAtCursor) {
      this.richTextEditor.insertContentAtCursor(content);
    }
  }

  public getContent(): string {
    return this.value;
  }

  public setContent(content: string): void {
    this.writeValue(content);
    this.onContentChange(content);
  }

  // Computed properties
  get editorConfig(): RichTextEditorConfig {
    return {
      height: this.config.height || 300,
      width: this.config.width || '100%',
      ...this.config
    };
  }

  get wrapperClasses(): string {
    const classes = [];
    
    if (this.config.theme) {
      classes.push(`theme-${this.config.theme}`);
    }
    
    if (this.disabled) {
      classes.push('disabled');
    }
    
    if (this.validationErrors.length > 0) {
      classes.push('error');
    }
    
    if (this.isFullscreen) {
      classes.push('fullscreen');
    }
    
    return classes.join(' ');
  }

  get showPlaceholder(): boolean {
    return this.contentStats.isEmpty && !this.disabled && !this.readonly;
  }

  get showValidationErrors(): boolean {
    return this.validationErrors.length > 0;
  }

  get fullscreenIcon(): string {
    return this.isFullscreen ? 'icon-exit-fullscreen' : 'icon-fullscreen';
  }

  get autoSaveStatusClass(): string {
    if (this.autoSaveStatus.includes('Saving')) return 'saving';
    if (this.autoSaveStatus.includes('Saved')) return 'saved';
    if (this.autoSaveStatus.includes('Error')) return 'error';
    return '';
  }

  // Helper methods
  private isRequired(control: AbstractControl | null): boolean {
    console.log('Checking if control is required:', control, control?.value);
    if (!control || !control.validator) return false;
    const result = control.validator({ value: null } as AbstractControl);
    return !!(result && result['required']);
  }
}