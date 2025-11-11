import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManualEntryForm } from './manual-entry-form';

describe('ManualEntryForm', () => {
  let component: ManualEntryForm;
  let fixture: ComponentFixture<ManualEntryForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManualEntryForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManualEntryForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
