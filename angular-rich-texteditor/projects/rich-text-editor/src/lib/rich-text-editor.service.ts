import { Inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { RICHTEXTEDITOR_ASSETS_PATH } from './paths';

// Interface for editor instance management
export interface RTEInstance {
  id: string;
  component: any; // Reference to the RichTextEditorComponent
  element: HTMLElement;
}

@Injectable({
  providedIn: 'root',
})
export class RichTextEditorService {
  private currentEditor: any = null; // Reference to the current RTE component
  private contentSubject = new BehaviorSubject<string>('');

  // Observable for content changes
  public content$: Observable<string> = this.contentSubject.asObservable();

  constructor(@Inject(RICHTEXTEDITOR_ASSETS_PATH) private assetsPath: string) {}

  getContentCssUrl(): string {
    return `${this.assetsPath}/runtime/richtexteditor_content.css`;
  }

  getPreviewCssUrl(): string {
    return `${this.assetsPath}/runtime/richtexteditor_preview.css`;
  }

  getPreviewScriptUrl(): string {
    return `${this.assetsPath}/runtime/richtexteditor_preview.js`;
  }

  // Simple editor management
  setCurrentEditor(component: any): void {
    this.currentEditor = component;
  }

  clearCurrentEditor(): void {
    this.currentEditor = null;
    this.contentSubject.next('');
  }

  // Content manipulation methods
  insertContentAtCursor(content: string): boolean {
    if (!this.currentEditor) {
      console.warn('[RTE Service] No editor is currently active');
      return false;
    }

    try {
      this.currentEditor.insertContentAtCursor(content);
      // Update the observable after insertion
      const newContent = this.getContent();
      this.contentSubject.next(newContent);
      return true;
    } catch (error) {
      console.error('[RTE Service] Failed to insert content:', error);
      return false;
    }
  }

  /**
   * Get HTML content from current editor
   * @returns HTML string (empty string if no content/editor)
   */
  getContent(): string {
    if (!this.currentEditor?.editorInstance) {
      console.warn('[RTE Service] No active editor found');
      return '';
    }

    try {
      const htmlContent = this.currentEditor.editorInstance.getHTMLCode();

      // Handle null/undefined cases
      if (htmlContent === null || htmlContent === undefined) {
        return this.getContentFallback();
      }

      return htmlContent;
    } catch (error) {
      console.error('[RTE Service] Failed to get content:', error);
      return this.getContentFallback();
    }
  }

  /**
   * Fallback method to retrieve content
   */
  private getContentFallback(): string {
    try {
      // Try to get from iframe directly
      const iframe =
        this.currentEditor?.editorContainer?.nativeElement?.querySelector(
          'iframe'
        );
      if (iframe?.contentDocument?.body) {
        return iframe.contentDocument.body.innerHTML || '';
      }

      // Try to get from component's value
      if (this.currentEditor?.value) {
        return this.currentEditor.value;
      }

      return '';
    } catch (error) {
      console.error('[RTE Service] Fallback retrieval failed:', error);
      return '';
    }
  }

  /**
   * Set HTML content for current editor
   */
  setContent(content: string): boolean {
    if (!this.currentEditor?.editorInstance) {
      console.warn('[RTE Service] No active editor found');
      return false;
    }

    try {
      this.currentEditor.editorInstance.setHTMLCode(content);

      // Ensure component state is synced
      if (this.currentEditor.value !== content) {
        this.currentEditor.value = content;
      }

      // Trigger change event if needed
      if (this.currentEditor.onChange) {
        this.currentEditor.onChange(content);
      }

      // Update observable
      this.contentSubject.next(content);

      return true;
    } catch (error) {
      console.error('[RTE Service] Failed to set content:', error);
      return false;
    }
  }

  /**
   * Clear editor content
   */
  clearContent(): boolean {
    return this.setContent('<p><br></p>');
  }

  /**
   * Focus current editor
   */
  focus(): boolean {
    if (!this.currentEditor) {
      console.warn('[RTE Service] No active editor found');
      return false;
    }

    try {
      // Try editor's focus method first
      if (this.currentEditor.editorInstance?.focus) {
        this.currentEditor.editorInstance.focus();
        return true;
      }

      // Fallback to iframe focus
      const iframe =
        this.currentEditor.editorContainer?.nativeElement?.querySelector(
          'iframe'
        );
      if (iframe?.contentDocument?.body) {
        iframe.contentDocument.body.focus();
        return true;
      }

      return false;
    } catch (error) {
      console.error('[RTE Service] Failed to focus editor:', error);
      return false;
    }
  }

  /**
   * Execute command on the editor
   */
  executeCommand(command: string, value?: any): boolean {
    if (!this.currentEditor?.editorInstance) {
      console.warn('[RTE Service] No active editor found');
      return false;
    }

    try {
      // Try editor's execCommand if available
      if (typeof this.currentEditor.editorInstance.execCommand === 'function') {
        this.currentEditor.editorInstance.execCommand(command, false, value);
        return true;
      }

      // Fallback to iframe execCommand
      const iframe =
        this.currentEditor.editorContainer?.nativeElement?.querySelector(
          'iframe'
        );
      if (iframe?.contentDocument) {
        iframe.contentDocument.execCommand(command, false, value);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[RTE Service] Failed to execute command:', error);
      return false;
    }
  }

  /**
   * Get selected text from editor
   */
  getSelectedText(): string {
    if (!this.currentEditor?.editorContainer) {
      return '';
    }

    try {
      const iframe =
        this.currentEditor.editorContainer.nativeElement.querySelector(
          'iframe'
        );
      if (iframe?.contentWindow) {
        const selection = iframe.contentWindow.getSelection();
        return selection ? selection.toString() : '';
      }
      return '';
    } catch (error) {
      console.error('[RTE Service] Failed to get selected text:', error);
      return '';
    }
  }

  /**
   * Check if content is empty
   */
  isContentEmpty(): boolean {
    const content = this.getContent();

    if (!content) return true;

    // Create a temporary div to parse HTML
    const div = document.createElement('div');
    div.innerHTML = content;

    // Get text content and clean it
    const text = div.textContent?.replace(/\u00A0/g, '').trim() || '';

    // Check if only contains empty tags
    const cleaned = div.innerHTML
      .replace(/<br\s*\/?>/gi, '')
      .replace(/<div>(\s|&nbsp;)*<\/div>/gi, '')
      .replace(/<p>(\s|&nbsp;)*<\/p>/gi, '')
      .replace(/&nbsp;/gi, '')
      .trim();

    return !text && cleaned.length === 0;
  }

  /**
   * Get character count
   */
  getCharacterCount(): number {
    const content = this.getContent();
    if (!content) return 0;

    const div = document.createElement('div');
    div.innerHTML = content;
    const text = div.textContent?.replace(/\u00A0/g, '').trim() || '';

    return text.length;
  }

  /**
   * Get word count
   */
  getWordCount(): number {
    const content = this.getContent();
    if (!content) return 0;

    const div = document.createElement('div');
    div.innerHTML = content;
    const text = div.textContent?.replace(/\u00A0/g, '').trim() || '';

    if (!text) return 0;

    const words = text.match(/\b\w+\b/g);
    return words ? words.length : 0;
  }

  // Check if editor is readonly
  isReadonly(): boolean {
    return this.currentEditor?.readonly || false;
  }

  // Check if editor is available
  isAvailable(): boolean {
    return !!this.currentEditor?.editorInstance;
  }

  /**
   * Hide all floating panels (useful for cleanup)
   */
  hideFloatingPanels(): void {
    if (this.currentEditor?.hideAllFloatPanels) {
      this.currentEditor.hideAllFloatPanels();
    }
  }

  /**
   * Removes the last inserted image with a temporary blob or data URL.
   */
  removeLastPlaceholderImage(): boolean {
    if (!this.currentEditor) return false;

    const iframe =
      this.currentEditor?.editorContainer?.nativeElement?.querySelector(
        'iframe'
      );
    const body = iframe?.contentDocument?.body;

    if (!body) return false;

    const images = Array.from(body.querySelectorAll('img'));

    for (let i = images.length - 1; i >= 0; i--) {
      const img = images[i] as HTMLImageElement;
      if (img.src.startsWith('blob:') || img.src.startsWith('data:')) {
        img.parentElement?.removeChild(img);
        console.debug('[RTE Service] Removed temporary placeholder image.');
        return true;
      }
    }

    return false;
  }
}
