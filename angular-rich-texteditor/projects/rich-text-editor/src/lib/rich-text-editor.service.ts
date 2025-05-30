import { Inject, Injectable } from '@angular/core';
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
  }

  // Content manipulation methods
  insertContentAtCursor(content: string): boolean {
    if (!this.currentEditor) {
      console.warn('[RTE Service] No editor is currently active');
      return false;
    }

    try {
      this.currentEditor.insertContentAtCursor(content);
      return true;
    } catch (error) {
      console.error('[RTE Service] Failed to insert content:', error);
      return false;
    }
  }

  // Get content from current editor
  getContent(): string | null {
    if (!this.currentEditor?.editorInstance) {
      console.warn('[RTE Service] No active editor found');
      return null;
    }

    try {
      return this.currentEditor.editorInstance.getHTMLCode();
    } catch (error) {
      console.error('[RTE Service] Failed to get content:', error);
      return null;
    }
  }

  // Set content for current editor
  setContent(content: string): boolean {
    if (!this.currentEditor?.editorInstance) {
      console.warn('[RTE Service] No active editor found');
      return false;
    }

    try {
      this.currentEditor.editorInstance.setHTMLCode(content);
      this.currentEditor.value = content;
      this.currentEditor.onChange(content);
      return true;
    } catch (error) {
      console.error('[RTE Service] Failed to set content:', error);
      return false;
    }
  }

  // Focus current editor
  focus(): boolean {
    if (!this.currentEditor) {
      console.warn('[RTE Service] No active editor found');
      return false;
    }

    try {
      const iframe = this.currentEditor.editorContainer.nativeElement.querySelector('iframe');
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

  // Check if editor is readonly
  isReadonly(): boolean {
    return this.currentEditor?.readonly || false;
  }

  // Check if editor is available
  isAvailable(): boolean {
    return !!this.currentEditor;
  }
  
}
