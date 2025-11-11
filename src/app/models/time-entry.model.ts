// src/app/models/time-entry.model.ts

export interface TimeEntry {
  id: string;
  title: string | null;
  description: string | null;
  startTime: number; // timestamp
  endTime: number; // timestamp
  duration: number; // in milliseconds
}

// Model per a l'entrada que s'està executant (endTime i duration són fixos o calculats)
export type RunningTimeEntry = Omit<TimeEntry, 'endTime' | 'duration'> & {
  endTime: null;
  duration: 0; 
};

// Type guard
export function isRunningEntry(entry: TimeEntry | RunningTimeEntry): entry is RunningTimeEntry {
  return entry.endTime === null;
}

export interface DailySummary {
  date: string; // Format 'YYYY-MM-DD'
  totalDurationMs: number;
}