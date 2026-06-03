// src/app/services/tenure-celebration.service.ts
import { Injectable } from '@angular/core';

export type MilestoneKind = 'months' | 'years';

export interface TenureMilestone {
  /** Stable identifier persisted in localStorage: '6m', '1y', '5y', '10y'… */
  key: string;
  kind: MilestoneKind;
  /** 6 (months) or 1/5/10/15… (years). */
  value: number;
}

const LS_KEY = 'tt.tenureCelebrations';

/** Add `months` to a date, clamping the day to the target month's length. */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const target = d.getMonth() + months;
  d.setMonth(target);
  const normalized = ((target % 12) + 12) % 12;
  if (d.getMonth() !== normalized) d.setDate(0); // rolled over → last day of intended month
  return d;
}

function parseStart(raw: string): Date | null {
  if (!raw) return null;
  const [y, m, d] = raw.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Decides when to congratulate the worker on their company tenure.
 *
 * Milestones: 6 months, 1 year, then every 5 years (5, 10, 15…). The set of
 * milestones already celebrated is persisted as a string[] in localStorage, so
 * each one fires exactly once — even across reloads and devices using the same
 * browser.
 */
@Injectable({ providedIn: 'root' })
export class TenureCelebrationService {
  /** All milestones whose date is on or before `today`, ascending by tenure length. */
  private reachedMilestones(start: Date, today: Date): TenureMilestone[] {
    const reached: TenureMilestone[] = [];
    if (addMonths(start, 6) <= today) reached.push({ key: '6m', kind: 'months', value: 6 });
    if (addMonths(start, 12) <= today) reached.push({ key: '1y', kind: 'years', value: 1 });
    for (let y = 5; ; y += 5) {
      if (addMonths(start, y * 12) <= today) {
        reached.push({ key: `${y}y`, kind: 'years', value: y });
      } else break;
    }
    return reached;
  }

  private loadCelebrated(): Set<string> {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const arr = raw ? (JSON.parse(raw) as unknown) : [];
      return new Set(Array.isArray(arr) ? (arr as string[]) : []);
    } catch {
      return new Set();
    }
  }

  private saveCelebrated(keys: Set<string>): void {
    localStorage.setItem(LS_KEY, JSON.stringify([...keys]));
  }

  /**
   * Returns the milestone to celebrate right now (the highest newly-reached
   * one), or null if there is nothing new. Every reached milestone is marked as
   * celebrated as a side effect, so lower ones never fire later and we only ever
   * surface a single modal at a time.
   */
  checkPending(startDate: string, now: Date = new Date()): TenureMilestone | null {
    const start = parseStart(startDate);
    if (!start) return null;

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (start.getTime() > today.getTime()) return null;

    const reached = this.reachedMilestones(start, today);
    if (!reached.length) return null;

    const celebrated = this.loadCelebrated();
    const newly = reached.filter(m => !celebrated.has(m.key));

    let changed = false;
    for (const m of reached) {
      if (!celebrated.has(m.key)) {
        celebrated.add(m.key);
        changed = true;
      }
    }
    if (changed) this.saveCelebrated(celebrated);

    return newly.length ? newly[newly.length - 1] : null;
  }
}
