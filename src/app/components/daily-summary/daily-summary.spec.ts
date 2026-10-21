import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailySummaryComponent } from './daily-summary';

describe('DailySummaryComponent', () => {
  let component: DailySummaryComponent;
  let fixture: ComponentFixture<DailySummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DailySummaryComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DailySummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
