// src/app/utils/format.ts

/**
 * Formats a duration in milliseconds to HH:MM:SS format.
 * @param ms Duration in milliseconds.
 * @returns Formatted string "HH:MM:SS".
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const pad = (num: number): string => num.toString().padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Formats decimal hours to HH:MM:SS format.
 * @param hours Duration in decimal hours.
 * @returns Formatted string "HH:MM:SS".
 */
export function formatHoursToTime(hours: number): string {
  const ms = hours * 60 * 60 * 1000;
  return formatDuration(ms);
}

/**
 * Converts a Date object or timestamp to the local datetime-local format string.
 * Format: YYYY-MM-DDTHH:mm (used by the input type="datetime-local")
 */
export function toDatetimeLocal(date: Date | number): string {
  const d = new Date(date);
  // Get the local ISO string slice (eliminates seconds and timezone info)
  const offset = d.getTimezoneOffset() * 60000;
  const localIsoString = new Date(d.getTime() - offset).toISOString().slice(0, 16);
  return localIsoString;
}
