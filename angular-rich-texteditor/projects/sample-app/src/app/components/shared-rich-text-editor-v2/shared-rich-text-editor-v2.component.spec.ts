import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SharedRichTextEditorV2Component } from './shared-rich-text-editor-v2.component';

describe('SharedRichTextEditorV2Component', () => {
  let component: SharedRichTextEditorV2Component;
  let fixture: ComponentFixture<SharedRichTextEditorV2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SharedRichTextEditorV2Component]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SharedRichTextEditorV2Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
