import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

import { ManualEntryFormComponent } from './manual-entry-form';

describe('ManualEntryFormComponent', () => {
  let component: ManualEntryFormComponent;
  let fixture: ComponentFixture<ManualEntryFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManualEntryFormComponent],
      // Kendo pickers inject AnimationBuilder.
      providers: [provideNoopAnimations()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManualEntryFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
