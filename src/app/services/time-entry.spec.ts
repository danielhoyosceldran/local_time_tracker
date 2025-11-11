import { TestBed } from '@angular/core/testing';

import { TimeEntry } from './time-entry';

describe('TimeEntry', () => {
  let service: TimeEntry;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimeEntry);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
