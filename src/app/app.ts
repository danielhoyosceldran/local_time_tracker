// src/app/app.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';

// Import all stand-alone components
import { TimerControlComponent } from './components/timer-control/timer-control';
import { ManualEntryFormComponent } from './components/manual-entry-form/manual-entry-form';
import { TimeEntryListComponent } from './components/time-entry-list/time-entry-list';
import { DailySummaryComponent } from './components/daily-summary/daily-summary'; // Afegir

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    TimerControlComponent,
    ManualEntryFormComponent,
    TimeEntryListComponent,
    DailySummaryComponent
  ],
  template: `
    <header class="bg-primary text-white p-6 shadow-lg mb-8">
      <div class="container mx-auto">
        <h1 class="text-4xl font-extrabold tracking-tight">⏱️ Angular Time Tracker</h1>
        <p class="text-sm opacity-80 mt-1">Standalone Component Demo (Angular 19+)</p>
      </div>
    </header>

    <main class="container mx-auto p-4 sm:p-6 lg:p-8">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div class="lg:col-span-2">
          <app-timer-control />
        </div>
        <div class="lg:col-span-1">
          <app-manual-entry-form />
        </div>
      </div>

      <div class="lg:col-span-3">
        <app-daily-summary />
      </div>
      
      <div class="lg:col-span-3">
        <app-time-entry-list />
      </div>
    </main>
  `,
})
export class AppComponent { }
