// src/app/components/time-entry-list/time-entry-list.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimeEntryService } from '../../services/time-entry';
import { TimeEntry } from '../../models/time-entry.model';
import { Observable, take } from 'rxjs';
import { formatDuration } from '../../utils/format';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-time-entry-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 bg-white shadow-xl rounded-lg border border-gray-100">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-2xl font-bold text-gray-800">Tracking History</h2>
        <button
          (click)="downloadCSV()"
          class="py-2 px-4 bg-gray-700 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg shadow transition duration-150"
        >
          Download CSV
        </button>
      </div>

      @if ((entries$ | async)?.length === 0) {
        <div class="text-center py-10 text-gray-500">
          No tracking entries yet. Start a new task or add a manual entry!
        </div>
      } @else {
        <div class="space-y-4">
          @for (entry of entries$ | async; track entry.id) {
            <div class="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
              <div class="flex justify-between items-start">
                <div class="flex-grow min-w-0">
                  @if (editingId !== entry.id) {
                    <div>
                      <p class="text-lg font-semibold truncate text-gray-900">{{ entry.title || '(No Title)' }}</p>
                      <p class="text-sm text-gray-600 truncate mb-2">{{ entry.description || '(No Description)' }}</p>
                    </div>
                  } @else {
                    <div class="mt-2 space-y-2 p-3 bg-white border border-indigo-200 rounded-md">
                        <input [(ngModel)]="editTitle" type="text" placeholder="New Title" 
                            class="w-full border border-gray-300 rounded-md p-1.5 text-sm focus:ring-primary focus:border-primary"
                        >
                        <textarea [(ngModel)]="editDescription" rows="2" placeholder="New Description" 
                            class="w-full border border-gray-300 rounded-md p-1.5 text-sm focus:ring-primary focus:border-primary"
                        ></textarea>
                        <div class="flex justify-end space-x-2">
                            <button (click)="cancelEdit()" class="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                            <button (click)="saveEdit(entry.id)" 
                                class="text-sm py-1 px-3 bg-primary text-white rounded-md hover:bg-indigo-700">Save</button>
                        </div>
                    </div>
                  }
                  

                  <div class="text-xs text-gray-500 space-x-2 mt-2">
                    <span>Start: {{ entry.startTime | date:'medium' }}</span>
                    <span class="font-bold text-primary">|</span>
                    <span>End: {{ entry.endTime | date:'medium' }}</span>
                  </div>
                </div>

                <div class="flex-shrink-0 text-right ml-4">
                  <p class="text-2xl font-mono font-bold text-secondary">{{ formatDuration(entry.duration) }}</p>
                  <div class="flex space-x-2 mt-1 justify-end">
                    <button (click)="startEdit(entry)" class="text-primary hover:text-indigo-700 text-sm" [disabled]="editingId === entry.id">Edit</button>
                    <button (click)="deleteEntry(entry.id)" class="text-red-500 hover:text-red-700 text-sm">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class TimeEntryListComponent {
  private timeEntryService = inject(TimeEntryService);

  entries$: Observable<TimeEntry[]> = this.timeEntryService.entries$;
  formatDuration = formatDuration;

  editingId: string | null = null;
  editTitle: string | null = null;
  editDescription: string | null = null;

  deleteEntry(id: string): void {
    if (confirm('Are you sure you want to delete this entry?')) {
      this.timeEntryService.deleteEntry(id);
    }
  }

  startEdit(entry: TimeEntry): void {
    this.editingId = entry.id;
    this.editTitle = entry.title;
    this.editDescription = entry.description;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editTitle = null;
    this.editDescription = null;
  }

  saveEdit(id: string): void {
    const finalTitle = this.editTitle ? this.editTitle.trim() : null;
    const finalDescription = this.editDescription ? this.editDescription.trim() : null;

    this.timeEntryService.updateEntry(id, finalTitle, finalDescription);
    this.cancelEdit();
  }

  // src/app/components/time-entry-list/time-entry-list.component.ts

  downloadCSV(): void {
    // Ens subscrivim i ens desubscrivim immediatament per obtenir les dades actuals
    this.entries$.pipe(take(1)).subscribe(entries => {
      if (!entries.length) return;

      // --- (Generació del CSV, es manté igual) ---
      const headers = ['Title', 'Description', 'Start Time', 'End Time', 'Duration (HH:MM:SS)', 'Duration (ms)'];
      const rows = entries.map(e => [
        // ... (mapeig de files)
        `"${e.title || 'No Title'}"`,
        `"${e.description || 'No Description'}"`,
        new Date(e.startTime).toLocaleString(),
        new Date(e.endTime).toLocaleString(),
        formatDuration(e.duration),
        e.duration.toString(),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', 'time_tracker_export.csv');
      link.style.visibility = 'hidden';

      // 💥 NOU: Utilitzem setTimeout(..., 0) per assegurar que la neteja es fa després de la descàrrega
      // Això desencobla l'acció del cicle de l'esdeveniment actual
      setTimeout(() => {
        document.body.appendChild(link);
        link.click();

        // Neteja immediata de la referència i el DOM
        URL.revokeObjectURL(url);
        document.body.removeChild(link);
      }, 0);
    });
  }
}