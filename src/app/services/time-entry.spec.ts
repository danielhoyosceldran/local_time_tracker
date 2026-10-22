import { TestBed } from '@angular/core/testing';

import { RUNNING_KEY, STORAGE_KEY, TimeEntryService, parseBackup, parseEntries, parseImportedEntries } from './time-entry';
import { StorageHealthService } from './storage-health.service';
import { normalizeRunningEntry, normalizeTimeEntry } from '../models/time-entry.model';

describe('TimeEntryService', () => {
  let service: TimeEntryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimeEntryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

describe('TimeEntryService with storage full', () => {
  let service: TimeEntryService;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(RUNNING_KEY);
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimeEntryService);
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(RUNNING_KEY);
  });

  it('keeps the timer running and warns when the stop cannot be saved', () => {
    service.startTracking('task', null);
    const running = service.snapshot().running;
    expect(running).not.toBeNull();

    const realSetItem = Storage.prototype.setItem;
    spyOn(Storage.prototype, 'setItem').and.callFake(function (this: Storage, key: string, value: string) {
      if (key === STORAGE_KEY) throw new DOMException('full', 'QuotaExceededError');
      realSetItem.call(this, key, value);
    });

    expect(service.stopTracking()).toBeNull();
    expect(service.snapshot().running?.id).toBe(running!.id);
    expect(service.snapshot().entries.length).toBe(0);
    expect(localStorage.getItem(RUNNING_KEY)).not.toBeNull();
    expect(TestBed.inject(StorageHealthService).full()).toBeTrue();
  });
});

describe('backup parsing', () => {
  const ok = { id: 'a', title: 't', description: null, startTime: 1000, endTime: 5000, duration: 4000 };

  it('repairs entries instead of dropping them', () => {
    expect(normalizeTimeEntry({ ...ok, startTime: 1000.4, title: 42 })).toEqual({ ...ok, title: null });
  });

  it('skips only unusable entries', () => {
    const entries = parseEntries([ok, null, 'x', { ...ok, id: '' }, { ...ok, endTime: null }, { ...ok, id: 'b' }]);
    expect(entries.map(e => e.id)).toEqual(['a', 'b']);
  });

  it('rejects entries that are not an array', () => {
    expect(() => parseEntries({})).toThrow();
  });

  it('accepts a running timer and rejects a broken one', () => {
    expect(normalizeRunningEntry({ id: 'r', startTime: 1, endTime: null, duration: 0 })?.endTime).toBeNull();
    expect(normalizeRunningEntry({ id: 'r' })).toBeNull();
  });

  it('parses only the requested keys and validates value types', () => {
    const file = JSON.stringify({ data: { [STORAGE_KEY]: '[]', 'tt.timeFormat': '24h', other: 'x', 'tt.workdays': 5 } });
    expect(parseBackup(file, [STORAGE_KEY, 'tt.timeFormat', 'tt.workdays'])).toEqual({
      [STORAGE_KEY]: '[]',
      'tt.timeFormat': '24h',
      'tt.workdays': '5',
    });
    expect(() => parseBackup(JSON.stringify({ data: { 'tt.timeFormat': {} } }), ['tt.timeFormat'])).toThrow();
    expect(() => parseBackup('{"nope":1}', [STORAGE_KEY])).toThrow();
    expect(() => parseBackup('not json', [STORAGE_KEY])).toThrow();
  });

  it('skips inconsistent entries from a backup but keeps them when loading storage', () => {
    const backwards = { ...ok, id: 'b', startTime: 5000, endTime: 1000, duration: 0 };
    const negative = { ...ok, id: 'c', duration: -1 };
    expect(parseImportedEntries([ok, backwards, negative]).map(e => e.id)).toEqual(['a']);
    expect(parseEntries([ok, backwards, negative]).map(e => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps only the known string fields of startedBy', () => {
    const origin = { deviceId: 'd1', deviceName: 'PC', browser: 'Chrome' };
    expect(normalizeTimeEntry({ ...ok, startedBy: { ...origin, extra: { big: 'x' } } })?.startedBy).toEqual(origin);
    expect(normalizeTimeEntry({ ...ok, startedBy: { deviceName: 'no id' } })?.startedBy).toBeUndefined();
    expect(normalizeTimeEntry({ ...ok, startedBy: ['d1'] })?.startedBy).toBeUndefined();
  });
});
