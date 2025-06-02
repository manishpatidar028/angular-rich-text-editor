import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharedRichTextEditorV1Component } from './shared-rich-text-editor-v1.component';

describe('SharedRichTextEditorV1Component', () => {
  let component: SharedRichTextEditorV1Component;
  let fixture: ComponentFixture<SharedRichTextEditorV1Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedRichTextEditorV1Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SharedRichTextEditorV1Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
