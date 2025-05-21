import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { RichTextEditorModule } from 'rich-text-editor';
import { RTE_TOOLBAR_PRESETS, RTEPreset } from '../../../rich-text-editor/src/lib/rich-text-editor.constant';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, FormsModule, RichTextEditorModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  toolbarGroup = RTE_TOOLBAR_PRESETS;
  title = 'sample-app';
    content = '<p>Initial content goes here</p>';

    onRteFileUpload(
  file: File,
  callback: (url: string|null, err?: string) => void,
  optionalIndex?: number,
  optionalFiles?: File[]
): void {
  // call your API & pipe the result back
  console.log('Function hget called on update');
  
}

}
