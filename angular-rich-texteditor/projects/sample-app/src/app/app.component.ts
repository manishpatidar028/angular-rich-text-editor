import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // ✅ ADD THIS
import { RteModalComponent } from './rte-modal/rte-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RteModalComponent], // ✅ INCLUDE CommonModule
  templateUrl: './app.component.html',
})
export class AppComponent {
  content = '<p>Initial content goes here</p>';
  showModal = false;

  openEditorModal() {
    this.showModal = true;
  }

  handleModalSave(updated: string) {
    this.content = updated;
    this.showModal = false;
  }

  handleModalClose() {
    this.showModal = false;
  }
}
