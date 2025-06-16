import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RichTextEditorModule, RTE_LICENSE_KEY } from 'angular-rich-text-editor';
import { SharedRichTextEditorComponent } from '../components/shared-rich-text-editor/shared-rich-text-editor.component';

@Component({
  selector: 'app-rte-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, RichTextEditorModule, SharedRichTextEditorComponent],
  providers: [{ provide: RTE_LICENSE_KEY, useValue: 'your-license-key' }],
  templateUrl: './rte-modal.component.html',
  styleUrls: ['./rte-modal.component.scss'],
})
export class RteModalComponent {
  @Input() initialContent = '';
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<string>();

  content = '';

  ngOnInit() {
    this.content = this.initialContent;
    console.log('RTE Modal initialized with content:', this.content);
  }

  valueChange(){
    console.log('Content changed:', this.content);
  }

  injectSignature() {
    const html = '${Hello}';
    this.content += html; // simple append, you can enhance using ViewChild if needed
  }
  injectSignature2() {
    const html = '${HIEEEEEEEEE MANISH}';
    this.content += html; // simple append, you can enhance using ViewChild if needed
  }

  onFileUpload(file: File, callback: (url: string | null) => void) {
    console.log('Fake file upload', file);
    // callback('https://dummyimage.com/600x400/000/fff'); // mock URL
  }

  onSave() {
    this.save.emit(this.content);
  }
}
