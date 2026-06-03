import type { TranslationKey } from './en';

export const ca: Record<TranslationKey, string> = {
  // App / nav
  'app.title': 'Control horari',
  'nav.calendar': 'Calendari',
  'nav.intervals': 'Intervals',
  'nav.settings': 'Configuració',
  'nav.whatsNew': 'Novetats',

  // Common
  'common.cancel': 'Cancel·lar',
  'common.save': 'Desar canvis',
  'common.close': 'Tancar',
  'common.delete': 'Eliminar',
  'common.edit': 'Editar',
  'common.add': 'Afegir',
  'common.start': 'Iniciar',
  'common.stop': 'Aturar',
  'common.reset': 'Restablir',
  'common.confirm': 'Confirmar',
  'common.yes': 'Sí',
  'common.no': 'No',
  'common.today': 'Avui',
  'common.yesterday': 'Ahir',
  'common.hours': 'hores',
  'common.minutes': 'minuts',
  'common.hoursShort': 'h',
  'common.minutesShort': 'min',
  'common.optional': 'Opcional',

  // Timer
  'timer.title': 'Control horari',
  'timer.tracking': 'En curs',
  'timer.noTitle': '(Sense títol)',
  'timer.titleLabel': 'Títol (opcional)',
  'timer.titlePlaceholder': 'Ex. Desenvolupar component Angular',
  'timer.start': 'INICIAR',
  'timer.stop': 'ATURAR',
  'timer.compactTitle': 'Temporitzador',

  // Quick interval
  'quickInterval.title': 'Afegir interval',
  'quickInterval.from': 'Des de',
  'quickInterval.to': 'Fins a',
  'quickInterval.titleLabel': 'Títol',
  'quickInterval.titlePlaceholder': 'Títol opcional',
  'quickInterval.add': 'Afegir',
  'quickInterval.invalidRange': 'El final ha de ser posterior a l\'inici',

  // Daily summary
  'daily.title': 'Avui',
  'daily.worked': 'Treballat',
  'daily.target': 'Objectiu',
  'daily.remaining': 'Restant',
  'daily.over': 'Extra',
  'daily.estimatedEnd': 'Hora estimada de sortida',
  'daily.noEntries': 'Encara no hi ha registres avui',

  // Weekly summary
  'weekly.title': 'Aquesta setmana',
  'weekly.worked': 'Treballat',
  'weekly.target': 'Objectiu',
  'weekly.remaining': 'Restant',
  'weekly.over': 'Extra',
  'weekly.average': 'Mitjana diària',

  // Monthly chart
  'monthly.title': 'Resum mensual',
  'monthly.worked': 'Treballat',
  'monthly.expected': 'Previst',
  'monthly.previous': 'Mes anterior',
  'monthly.next': 'Mes següent',

  // Pomodoro
  'pomodoro.title': 'Pomodoro',
  'pomodoro.work': 'Treball',
  'pomodoro.break': 'Descans',
  'pomodoro.start': 'Iniciar',
  'pomodoro.pause': 'Pausar',
  'pomodoro.resume': 'Reprendre',
  'pomodoro.reset': 'Reiniciar',
  'pomodoro.skip': 'Saltar',

  // Reminder
  'reminder.title': 'Recordatori',
  'reminder.message': 'Hora de descansar',
  'reminder.dismiss': 'Descartar',
  'reminder.snooze': 'Posposar',

  // Intervals view
  'intervals.title': 'Intervals',
  'intervals.empty': 'Sense intervals',
  'intervals.duration': 'Durada',
  'intervals.start': 'Inici',
  'intervals.end': 'Fi',

  // Calendar / holidays
  'calendar.title': 'Calendari',
  'calendar.holidays': 'Festius',
  'calendar.workday': 'Laborable',
  'calendar.weekend': 'Cap de setmana',
  'calendar.holiday': 'Festiu',

  // Settings modal
  'settings.title': 'Configuració',
  'settings.tab.schedule': 'Horari laboral',
  'settings.tab.scheduleDesc': 'Jornada i setmana',
  'settings.tab.tracking': 'Seguiment',
  'settings.tab.trackingDesc': 'Arrodoniment i àpat',
  'settings.tab.focus': 'Concentració',
  'settings.tab.focusDesc': 'Pomodoro',
  'settings.tab.data': 'Dades',
  'settings.tab.dataDesc': 'Exportar, importar, restablir',
  'settings.tab.general': 'General',
  'settings.tab.generalDesc': 'Idioma i aparença',

  // Workday section
  'workday.title': 'Jornada',
  'workday.targetHours': 'Hores objectiu / dia',
  'workday.targetHoursHint': 'Utilitzat per l\'arrodoniment automàtic i el progrés diari.',
  'workday.weeklyTarget': 'Objectiu setmanal (h)',
  'workday.weeklyTargetHint': 'Base per al resum setmanal.',
  'workday.workdays': 'Dies laborables',
  'workday.workdaysHint': 'Dies comptats com a laborables.',
  'workday.firstDay': 'Primer dia de la setmana',
  'workday.timeFormat': 'Format d\'hora',
  'workday.showExpected': 'Mostrar línia d\'hores previstes',
  'workday.showExpectedHint': 'Superposa les hores previstes per període al gràfic.',
  'workday.truncateToday': 'Truncar línia treballada a avui',
  'workday.truncateTodayHint': 'Atura la línia d\'hores treballades a avui en lloc de dibuixar dies futurs.',

  // Auto-round section
  'autoround.title': 'Arrodoniment automàtic',
  'autoround.enable': 'Activar arrodoniment automàtic',
  'autoround.enableHint': 'Arrodoneix l\'interval en curs en aturar-lo prop del límit de la jornada.',
  'autoround.margin': 'Marge (minuts)',
  'autoround.marginHint': 'Quanta proximitat al límit per activar l\'arrodoniment.',

  // Lunch section
  'lunch.title': 'Àpat',
  'lunch.enable': 'Activar pausa per dinar',
  'lunch.enableHint': 'Resta una pausa per dinar del temps treballat.',
  'lunch.hour': 'Hora de l\'àpat',
  'lunch.duration': 'Durada (minuts)',

  // Pomodoro section
  'pomoSection.title': 'Pomodoro',
  'pomoSection.work': 'Durada treball (min)',
  'pomoSection.break': 'Durada descans (min)',
  'pomoSection.workSound': 'So fi de treball',
  'pomoSection.breakSound': 'So fi de descans',

  // Data section
  'data.title': 'Dades',
  'data.export': 'Exportar dades',
  'data.exportHint': 'Descarrega tots els teus registres com a JSON.',
  'data.import': 'Importar dades',
  'data.importHint': 'Puja un fitxer JSON exportat prèviament.',
  'data.reset': 'Esborrar totes les dades',
  'data.resetHint': 'Elimina permanentment tots els registres i la configuració.',
  'data.resetConfirm': 'Això eliminarà totes les teves dades. Continuar?',

  // General / language section
  'general.title': 'General',
  'general.language': 'Idioma',
  'general.languageHint': 'Tria l\'idioma de l\'aplicació.',
  'general.lang.en': 'Anglès',
  'general.lang.es': 'Espanyol',
  'general.lang.ca': 'Català',
  'general.theme': 'Tema',
  'general.themeHint': 'Fes servir un tema clar, fosc o segueix la preferència del sistema.',
  'general.theme.light': 'Clar',
  'general.theme.dark': 'Fosc',
  'general.theme.system': 'Sistema',

  // Days
  'day.0': 'Diumenge', 'day.1': 'Dilluns', 'day.2': 'Dimarts', 'day.3': 'Dimecres',
  'day.4': 'Dijous', 'day.5': 'Divendres', 'day.6': 'Dissabte',
  'day.short.0': 'Dg', 'day.short.1': 'Dl', 'day.short.2': 'Dt', 'day.short.3': 'Dc',
  'day.short.4': 'Dj', 'day.short.5': 'Dv', 'day.short.6': 'Ds',
  'day.abbr.0': 'Diu', 'day.abbr.1': 'Dll', 'day.abbr.2': 'Dim', 'day.abbr.3': 'Dmc',
  'day.abbr.4': 'Dij', 'day.abbr.5': 'Div', 'day.abbr.6': 'Dis',

  // Months
  'month.0': 'Gener', 'month.1': 'Febrer', 'month.2': 'Març', 'month.3': 'Abril',
  'month.4': 'Maig', 'month.5': 'Juny', 'month.6': 'Juliol', 'month.7': 'Agost',
  'month.8': 'Setembre', 'month.9': 'Octubre', 'month.10': 'Novembre', 'month.11': 'Desembre',

  // Release notes
  'release.title': 'Notes de versió',
  'release.empty': 'Encara no hi ha notes de versió.',
  'release.markRead': 'Marcar tot com a llegit',

  // Sound picker
  'sound.title': 'Tria un so',
  'sound.preview': 'Previsualitzar',
  'sound.select': 'Seleccionar',
  'sound.done': 'Fet',
  'sound.reminderTitle': 'So del recordatori',
  'sound.workTitle': 'So de treball',
  'sound.breakTitle': 'So de descans',

  // Timer extras
  'timer.active': 'ACTIU',
  'timer.taskName': 'Nom de la tasca...',
  'timer.startBtn': 'INICIAR',
  'timer.stopBtn': 'ATURAR',

  // Quick interval extras
  'quickInterval.taskName': 'Nom de la tasca...',
  'quickInterval.startReq': 'Inici',
  'quickInterval.endReq': 'Fi',
  'quickInterval.endAfterStart': 'L\'hora de fi ha de ser posterior a la d\'inici',
  'quickInterval.addBtn': 'AFEGIR',

  // Daily summary extras
  'daily.progress': 'Progrés diari',
  'daily.of': 'de',
  'daily.remainingLabel': 'Restant:',
  'daily.estFinish': 'Sortida est.:',
  'daily.targetReached': 'Objectiu diari assolit!',
  'daily.noEntriesShort': 'Sense registres avui',

  // Weekly summary extras
  'weekly.progress': 'Progrés setmanal',
  'weekly.of': 'de',
  'weekly.remainingLabel': 'Restant:',
  'weekly.totalBalance': 'Balanç total',
  'weekly.noEntries': 'Sense registres aquesta setmana',

  // Monthly chart extras
  'monthly.weeklyHours': 'Hores setmanals',
  'monthly.monthlyHours': 'Hores mensuals',
  'monthly.yearlyHours': 'Hores anuals',
  'monthly.week': 'Setmana',
  'monthly.month': 'Mes',
  'monthly.year': 'Any',
  'monthly.workedArea': 'Hores treballades (àrea)',
  'monthly.expectedHours': 'Hores esperades',
  'monthly.firstEntry': 'Primer registre',

  // Pomodoro extras
  'pomodoro.working': 'Treballant',
  'pomodoro.breakTitle': 'Pomodoro - Hora de descansar!',
  'pomodoro.breakBody': 'Fes un descans de {min} min.',
  'pomodoro.focusTitle': 'Pomodoro - Hora de concentrar-se!',
  'pomodoro.focusBody': 'Sessió de treball iniciada: {min} min.',

  // Reminder extras
  'reminder.subtitle': 'Envia una notificació del navegador a l\'hora configurada cada dia.',
  'reminder.time': 'Hora',
  'reminder.messageLabel': 'Missatge',
  'reminder.placeholder': 'Recordatori!',
  'reminder.sound': 'So',

  // Intervals view extras
  'intervals.expand': 'Expandir',
  'intervals.collapse': 'Col·lapsar',
  'intervals.expandAll': 'Expandir totes les setmanes',
  'intervals.collapseAll': 'Col·lapsar tot',
  'intervals.exportCsv': 'Exportar CSV',
  'intervals.noEntries': 'Encara no hi ha registres.',
  'intervals.weekLabel': 'Setmana',
  'intervals.daySingular': 'dia',
  'intervals.dayPlural': 'dies',
  'intervals.intervalSingular': 'interval',
  'intervals.intervalPlural': 'intervals',
  'intervals.titlePlaceholder': 'Títol',
  'intervals.descriptionPlaceholder': 'Descripció',
  'intervals.cancelBtn': 'Cancel·lar',
  'intervals.saveBtn': 'Desar',
  'intervals.noTitle': '(Sense títol)',
  'intervals.editTitle': 'Editar',
  'intervals.deleteTitle': 'Eliminar',
  'intervals.fillTimes': 'Si us plau, omple tots els camps d\'hora',
  'intervals.endAfterStart': 'L\'hora de fi ha de ser posterior a la d\'inici',
  'intervals.failedUpdate': 'Error en actualitzar el registre',
  'intervals.deleteConfirm': 'Segur que vols eliminar aquest registre?',

  // Holiday calendar extras
  'holiday.title': 'Calendari de festius',
  'holiday.personal': 'Personal',
  'holiday.public': 'Públic',
  'holiday.loadPreset': 'Carregar preset…',
  'holiday.left': 'restants',
  'holiday.total': 'Total',
  'holiday.used': 'Usats',
  'holiday.publicLabel': 'Públic',
  'holiday.typeTooltip': 'Tipus a afegir en clicar un dia',
  'holiday.presetTooltip': 'Carregar festius públics d\'una ciutat per a un any',
  'holiday.saveTitle': 'Desar',
  'holiday.cancelTitle': 'Cancel·lar',
  'holiday.editTotal': 'Editar total',

  // Release notes extras
  'release.gotIt': 'Entesos',

  // Agenda calendar
  'agenda.title': 'Google Calendar',
  'agenda.empty': 'No hi ha URL de calendari configurada. Fes clic a configuració per afegir-ne una.',
  'agenda.settings': 'Configuració',
  'agenda.modalTitle': 'Configuració del calendari',
  'agenda.urlLabel': 'URL d\'inserció de Google Calendar',
  'agenda.urlPlaceholder': 'https://calendar.google.com/...',

  // Data section extras
  'data.exportBtn': 'Exportar',
  'data.importBtn': 'Importar',
  'data.resetBtn': 'Restablir',
  'data.exported': 'Exportat.',
  'data.imported': 'Importat.',
  'data.importFailed': 'Error en importar: fitxer no vàlid.',
  'data.resetDone': 'Restablert.',
  'data.importConfirm': 'Importar sobreescriurà les dades actuals. Continuar?',
  'data.resetAllConfirm': 'Això eliminarà TOTES les dades (registres, configuració, festius). Continuar?',

  // Lunch section extras
  'lunch.sectionTitle': 'Pausa per dinar',
  'lunch.hourLabel': 'Hora',
  'lunch.hourHint': 'S\'afegeix a l\'hora de sortida estimada si encara no ha passat.',
  'lunch.durationLabel': 'Durada (min)',

  // Pomodoro section extras
  'pomoSection.workMin': 'Treball (min)',
  'pomoSection.breakMin': 'Descans (min)',
  'pomoSection.workSoundLabel': 'So de treball',
  'pomoSection.breakSoundLabel': 'So de descans',

  // Auto-round section extras
  'autoround.marginHintLong': 'Si el total d\'avui està dins del marge respecte a les hores objectiu, l\'interval s\'ajusta per assolir-les exactament.',
  'autoround.window': 'Limitar a franja horària',
  'autoround.windowHint': 'Només s\'arrodoneix el temps treballat dins de la franja; el d\'abans o després compta sencer.',
  'autoround.windowStart': 'Inici de la franja',
  'autoround.windowEnd': 'Fi de la franja',

  // Company tenure
  'tenure.title': 'A l\'empresa',
  'tenure.prompt': 'Configura la teva data d\'inici per veure quant temps fa que ets a l\'empresa.',
  'tenure.startDate': 'Data d\'inici',
  'tenure.future': 'La data d\'inici és en el futur.',
  'tenure.years': 'anys',
  'tenure.yearOne': 'any',
  'tenure.months': 'mesos',
  'tenure.monthOne': 'mes',
  'tenure.days': 'dies',
  'tenure.dayOne': 'dia',
  'tenure.totalDays': 'dies en total',
  'tenure.since': 'Des de',

  // Tenure milestone celebration
  'celebrate.title': 'Felicitats!',
  'celebrate.sub.6m': 'Ja fa 6 mesos que ets a l\'empresa',
  'celebrate.sub.1y': 'Avui fas el teu primer any a l\'empresa',
  'celebrate.sub.years': 'Ja són {years} anys a l\'empresa!',
  'celebrate.message': 'Gràcies per tot aquest temps. Que en vinguin molts més! 🎉',
  'celebrate.button': 'Gràcies!',
};
