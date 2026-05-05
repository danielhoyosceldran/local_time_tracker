// Add cities and years freely. Each entry: { date: 'YYYY-MM-DD', name: string }.
// Dates must fall in the specified year. The calendar UI will list every
// city/year pair declared here as a "Load preset" option.

export interface PublicHoliday {
  date: string;
  name: string;
}

export type PublicHolidaysByCity = Record<string, Record<string, PublicHoliday[]>>;

export const PUBLIC_HOLIDAYS: PublicHolidaysByCity = {
  Barcelona: {
    '2026': [
      { date: '2026-01-01', name: 'Año Nuevo' },
      { date: '2026-01-06', name: 'Reyes' },
      { date: '2026-04-03', name: 'Viernes Santo' },
      { date: '2026-04-06', name: 'Lunes de Pascua Florida' },
      { date: '2026-05-01', name: 'Fiesta del Trabajo' },
      { date: '2026-05-25', name: 'Lunes de Pascua Granada' },
      { date: '2026-06-24', name: 'San Juan' },
      { date: '2026-08-15', name: 'La Asunción' },
      { date: '2026-09-11', name: 'Diada Nacional de Cataluña' },
      { date: '2026-09-24', name: 'Mare de Déu de la Mercè' },
      { date: '2026-10-12', name: 'Día Nacional de España' },
      { date: '2026-12-08', name: 'La Inmaculada' },
      { date: '2026-12-25', name: 'Navidad' },
      { date: '2026-12-26', name: 'San Esteban' },
    ],
  },
};
