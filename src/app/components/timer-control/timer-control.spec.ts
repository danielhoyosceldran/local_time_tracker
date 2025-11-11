import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimerControl } from './timer-control';

describe('TimerControl', () => {
  let component: TimerControl;
  let fixture: ComponentFixture<TimerControl>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimerControl]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TimerControl);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
