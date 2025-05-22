import { Inject, Injectable } from '@angular/core';
import { RICHTEXTEDITOR_ASSETS_PATH } from './paths';

@Injectable({
  providedIn: 'root'
})
export class RichTextEditorService {
 constructor(
    @Inject(RICHTEXTEDITOR_ASSETS_PATH) private assetsPath: string
  ) {}

  getContentCssUrl(): string {
    return `${this.assetsPath}/runtime/richtexteditor_content.css`;
  }

  getPreviewCssUrl(): string {
    return `${this.assetsPath}/runtime/richtexteditor_preview.css`;
  }

  getPreviewScriptUrl(): string {
    return `${this.assetsPath}/runtime/richtexteditor_preview.js`;
  }
}
