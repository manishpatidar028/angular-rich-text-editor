import { ModuleWithProviders, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RichTextEditorComponent } from './rich-text-editor.component';
import { RTE_LICENSE_KEY } from './rich-text-editor-license.token';

@NgModule({
  declarations: [RichTextEditorComponent],
  imports: [CommonModule],
  exports: [RichTextEditorComponent]
})
export class RichTextEditorModule {
   static forRoot(licenseKey: string): ModuleWithProviders<RichTextEditorModule> {
    return {
      ngModule: RichTextEditorModule,
      providers: [
        { provide: RTE_LICENSE_KEY, useValue: licenseKey }
      ]
    };
  }
}
