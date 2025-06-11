import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharedRichTextEditorComponent } from './shared-rich-text-editor.component';

describe('SharedRichTextEditorComponent', () => {
  let component: SharedRichTextEditorComponent;
  let fixture: ComponentFixture<SharedRichTextEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedRichTextEditorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SharedRichTextEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
