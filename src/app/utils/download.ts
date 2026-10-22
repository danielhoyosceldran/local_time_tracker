// src/app/utils/download.ts

/** Save an exportAll() JSON as `time-tracker-YYYY-MM-DD.json`. */
export function downloadBackup(json: string, at: Date = new Date()): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `time-tracker-${at.toISOString().slice(0, 10)}.json`;
  a.click();
  // Revoking right after click() can cancel the download in Firefox/Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
