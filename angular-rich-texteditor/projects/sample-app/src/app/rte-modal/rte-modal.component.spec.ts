import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RteModalComponent } from './rte-modal.component';

describe('RteModalComponent', () => {
  let component: RteModalComponent;
  let fixture: ComponentFixture<RteModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RteModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RteModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
