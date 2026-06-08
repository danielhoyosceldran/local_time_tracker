import type { TranslationKey } from './en';

export const es: Record<TranslationKey, string> = {
  // App / nav
  'app.title': 'Control horario',
  'nav.calendar': 'Calendario',
  'nav.intervals': 'Intervalos',
  'nav.settings': 'Ajustes',
  'nav.whatsNew': 'Novedades',
  'nav.menu': 'Menú',
  'mobile.views': 'Vistas',
  'view.timer': 'Temporizador',
  'view.daily': 'Resumen diario',
  'view.weekly': 'Resumen semanal',
  'view.calendar': 'Calendario',
  'view.intervals': 'Intervalos',
  'view.pomodoro': 'Pomodoro',
  'view.chart': 'Gráfico mensual',
  'view.reminder': 'Recordatorio',
  'view.tenure': 'Antigüedad',

  // Common
  'common.cancel': 'Cancelar',
  'common.save': 'Guardar cambios',
  'common.close': 'Cerrar',
  'common.delete': 'Eliminar',
  'common.edit': 'Editar',
  'common.add': 'Añadir',
  'common.start': 'Iniciar',
  'common.stop': 'Parar',
  'common.reset': 'Restablecer',
  'common.confirm': 'Confirmar',
  'common.yes': 'Sí',
  'common.no': 'No',
  'common.today': 'Hoy',
  'common.yesterday': 'Ayer',
  'common.hours': 'horas',
  'common.minutes': 'minutos',
  'common.hoursShort': 'h',
  'common.minutesShort': 'min',
  'common.optional': 'Opcional',

  // Timer
  'timer.title': 'Control horario',
  'timer.tracking': 'En curso',
  'timer.noTitle': '(Sin título)',
  'timer.titleLabel': 'Título (opcional)',
  'timer.titlePlaceholder': 'Ej. Desarrollar componente Angular',
  'timer.start': 'INICIAR',
  'timer.stop': 'PARAR',
  'timer.compactTitle': 'Temporizador',

  // Quick interval
  'quickInterval.title': 'Añadir intervalo',
  'quickInterval.from': 'Desde',
  'quickInterval.to': 'Hasta',
  'quickInterval.titleLabel': 'Título',
  'quickInterval.titlePlaceholder': 'Título opcional',
  'quickInterval.add': 'Añadir',
  'quickInterval.invalidRange': 'El final debe ser posterior al inicio',

  // Daily summary
  'daily.title': 'Hoy',
  'daily.worked': 'Trabajado',
  'daily.target': 'Objetivo',
  'daily.remaining': 'Restante',
  'daily.over': 'Extra',
  'daily.estimatedEnd': 'Hora estimada de salida',
  'daily.noEntries': 'Aún no hay registros hoy',

  // Weekly summary
  'weekly.title': 'Esta semana',
  'weekly.worked': 'Trabajado',
  'weekly.target': 'Objetivo',
  'weekly.remaining': 'Restante',
  'weekly.over': 'Extra',
  'weekly.average': 'Media diaria',

  // Monthly chart
  'monthly.title': 'Resumen mensual',
  'monthly.worked': 'Trabajado',
  'monthly.expected': 'Previsto',
  'monthly.previous': 'Mes anterior',
  'monthly.next': 'Mes siguiente',

  // Pomodoro
  'pomodoro.title': 'Pomodoro',
  'pomodoro.work': 'Trabajo',
  'pomodoro.break': 'Descanso',
  'pomodoro.start': 'Iniciar',
  'pomodoro.pause': 'Pausar',
  'pomodoro.resume': 'Reanudar',
  'pomodoro.reset': 'Reiniciar',
  'pomodoro.skip': 'Saltar',

  // Reminder
  'reminder.title': 'Recordatorio',
  'reminder.message': 'Hora de descansar',
  'reminder.dismiss': 'Descartar',
  'reminder.snooze': 'Posponer',

  // Intervals view
  'intervals.title': 'Intervalos',
  'intervals.empty': 'Sin intervalos',
  'intervals.duration': 'Duración',
  'intervals.start': 'Inicio',
  'intervals.end': 'Fin',

  // Calendar / holidays
  'calendar.title': 'Calendario',
  'calendar.holidays': 'Festivos',
  'calendar.workday': 'Laborable',
  'calendar.weekend': 'Fin de semana',
  'calendar.holiday': 'Festivo',

  // Settings modal
  'settings.title': 'Ajustes',
  'settings.tab.schedule': 'Horario laboral',
  'settings.tab.scheduleDesc': 'Jornada y semana',
  'settings.tab.tracking': 'Seguimiento',
  'settings.tab.trackingDesc': 'Redondeo y comida',
  'settings.tab.focus': 'Concentración',
  'settings.tab.focusDesc': 'Pomodoro',
  'settings.tab.data': 'Datos',
  'settings.tab.dataDesc': 'Exportar, importar, restablecer',
  'settings.tab.general': 'General',
  'settings.tab.generalDesc': 'Idioma y apariencia',

  // Workday section
  'workday.title': 'Jornada',
  'workday.targetHours': 'Horas objetivo / día',
  'workday.targetHoursHint': 'Usado por el redondeo automático y el progreso diario.',
  'workday.weeklyTarget': 'Objetivo semanal (h)',
  'workday.weeklyTargetHint': 'Base para el resumen semanal.',
  'workday.workdays': 'Días laborables',
  'workday.workdaysHint': 'Días contados como laborables.',
  'workday.firstDay': 'Primer día de la semana',
  'workday.timeFormat': 'Formato de hora',
  'workday.showExpected': 'Mostrar línea de horas previstas',
  'workday.showExpectedHint': 'Superpone las horas previstas por periodo en el gráfico.',
  'workday.truncateToday': 'Truncar línea trabajada en hoy',
  'workday.truncateTodayHint': 'Detiene la línea de horas trabajadas en hoy en lugar de dibujar días futuros.',

  // Auto-round section
  'autoround.title': 'Redondeo automático',
  'autoround.enable': 'Activar redondeo automático',
  'autoround.enableHint': 'Redondea el intervalo en curso al detenerlo cerca del límite de la jornada.',
  'autoround.margin': 'Margen (minutos)',
  'autoround.marginHint': 'Cuán cerca del límite para activar el redondeo.',

  // Lunch section
  'lunch.title': 'Comida',
  'lunch.enable': 'Activar pausa para comer',
  'lunch.enableHint': 'Resta una pausa para comer del tiempo trabajado.',
  'lunch.hour': 'Hora de la comida',
  'lunch.duration': 'Duración (minutos)',

  // Pomodoro section
  'pomoSection.title': 'Pomodoro',
  'pomoSection.work': 'Duración trabajo (min)',
  'pomoSection.break': 'Duración descanso (min)',
  'pomoSection.workSound': 'Sonido fin de trabajo',
  'pomoSection.breakSound': 'Sonido fin de descanso',

  // Data section
  'data.title': 'Datos',
  'data.export': 'Exportar datos',
  'data.exportHint': 'Descarga todos tus registros como JSON.',
  'data.import': 'Importar datos',
  'data.importHint': 'Sube un archivo JSON exportado previamente.',
  'data.reset': 'Borrar todos los datos',
  'data.resetHint': 'Elimina permanentemente todos los registros y ajustes.',
  'data.resetConfirm': 'Esto eliminará todos tus datos. ¿Continuar?',

  // General / language section
  'general.title': 'General',
  'general.language': 'Idioma',
  'general.languageHint': 'Elige el idioma de la aplicación.',
  'general.lang.en': 'Inglés',
  'general.lang.es': 'Español',
  'general.lang.ca': 'Catalán',
  'general.theme': 'Tema',
  'general.themeHint': 'Usa un tema claro, oscuro o sigue la preferencia del sistema.',
  'general.theme.light': 'Claro',
  'general.theme.dark': 'Oscuro',
  'general.theme.system': 'Sistema',

  // Days
  'day.0': 'Domingo', 'day.1': 'Lunes', 'day.2': 'Martes', 'day.3': 'Miércoles',
  'day.4': 'Jueves', 'day.5': 'Viernes', 'day.6': 'Sábado',
  'day.short.0': 'D', 'day.short.1': 'L', 'day.short.2': 'M', 'day.short.3': 'X',
  'day.short.4': 'J', 'day.short.5': 'V', 'day.short.6': 'S',
  'day.abbr.0': 'Dom', 'day.abbr.1': 'Lun', 'day.abbr.2': 'Mar', 'day.abbr.3': 'Mié',
  'day.abbr.4': 'Jue', 'day.abbr.5': 'Vie', 'day.abbr.6': 'Sáb',

  // Months
  'month.0': 'Enero', 'month.1': 'Febrero', 'month.2': 'Marzo', 'month.3': 'Abril',
  'month.4': 'Mayo', 'month.5': 'Junio', 'month.6': 'Julio', 'month.7': 'Agosto',
  'month.8': 'Septiembre', 'month.9': 'Octubre', 'month.10': 'Noviembre', 'month.11': 'Diciembre',

  // Release notes
  'release.title': 'Notas de versión',
  'release.empty': 'Aún no hay notas de versión.',
  'release.markRead': 'Marcar todo como leído',

  // Sound picker
  'sound.title': 'Elige un sonido',
  'sound.preview': 'Previsualizar',
  'sound.select': 'Seleccionar',
  'sound.done': 'Hecho',
  'sound.reminderTitle': 'Sonido del recordatorio',
  'sound.workTitle': 'Sonido de trabajo',
  'sound.breakTitle': 'Sonido de descanso',

  // Timer extras
  'timer.active': 'ACTIVO',
  'timer.taskName': 'Nombre de la tarea...',
  'timer.startBtn': 'INICIAR',
  'timer.stopBtn': 'PARAR',

  // Quick interval extras
  'quickInterval.taskName': 'Nombre de la tarea...',
  'quickInterval.startReq': 'Inicio',
  'quickInterval.endReq': 'Fin',
  'quickInterval.endAfterStart': 'La hora de fin debe ser posterior a la de inicio',
  'quickInterval.addBtn': 'AÑADIR',

  // Daily summary extras
  'daily.progress': 'Progreso diario',
  'daily.of': 'de',
  'daily.remainingLabel': 'Restante:',
  'daily.estFinish': 'Salida estim.:',
  'daily.targetReached': '¡Objetivo diario alcanzado!',
  'daily.noEntriesShort': 'Sin registros hoy',

  // Weekly summary extras
  'weekly.progress': 'Progreso semanal',
  'weekly.of': 'de',
  'weekly.remainingLabel': 'Restante:',
  'weekly.totalBalance': 'Balance total',
  'weekly.noEntries': 'Sin registros esta semana',

  // Monthly chart extras
  'monthly.weeklyHours': 'Horas semanales',
  'monthly.monthlyHours': 'Horas mensuales',
  'monthly.yearlyHours': 'Horas anuales',
  'monthly.week': 'Semana',
  'monthly.month': 'Mes',
  'monthly.year': 'Año',
  'monthly.workedArea': 'Horas trabajadas (área)',
  'monthly.expectedHours': 'Horas esperadas',
  'monthly.firstEntry': 'Primer registro',

  // Pomodoro extras
  'pomodoro.working': 'Trabajando',
  'pomodoro.breakTitle': 'Pomodoro - ¡Hora del descanso!',
  'pomodoro.breakBody': 'Toma un descanso de {min} min.',
  'pomodoro.focusTitle': 'Pomodoro - ¡Hora de concentrarse!',
  'pomodoro.focusBody': 'Sesión de trabajo iniciada: {min} min.',

  // Reminder extras
  'reminder.subtitle': 'Envía una notificación del navegador a la hora configurada cada día.',
  'reminder.time': 'Hora',
  'reminder.messageLabel': 'Mensaje',
  'reminder.placeholder': '¡Recordatorio!',
  'reminder.sound': 'Sonido',

  // Intervals view extras
  'intervals.expand': 'Expandir',
  'intervals.collapse': 'Colapsar',
  'intervals.expandAll': 'Expandir todas las semanas',
  'intervals.collapseAll': 'Colapsar todo',
  'intervals.exportCsv': 'Exportar CSV',
  'intervals.noEntries': 'Aún no hay registros.',
  'intervals.weekLabel': 'Semana',
  'intervals.daySingular': 'día',
  'intervals.dayPlural': 'días',
  'intervals.intervalSingular': 'intervalo',
  'intervals.intervalPlural': 'intervalos',
  'intervals.titlePlaceholder': 'Título',
  'intervals.descriptionPlaceholder': 'Descripción',
  'intervals.cancelBtn': 'Cancelar',
  'intervals.saveBtn': 'Guardar',
  'intervals.noTitle': '(Sin título)',
  'intervals.editTitle': 'Editar',
  'intervals.deleteTitle': 'Eliminar',
  'intervals.fillTimes': 'Por favor rellena todos los campos de hora',
  'intervals.endAfterStart': 'La hora de fin debe ser posterior a la de inicio',
  'intervals.failedUpdate': 'Error al actualizar el registro',
  'intervals.deleteConfirm': '¿Seguro que quieres eliminar este registro?',

  // Holiday calendar extras
  'holiday.title': 'Calendario de festivos',
  'holiday.personal': 'Personal',
  'holiday.public': 'Público',
  'holiday.loadPreset': 'Cargar preset…',
  'holiday.left': 'restantes',
  'holiday.total': 'Total',
  'holiday.used': 'Usados',
  'holiday.publicLabel': 'Público',
  'holiday.typeTooltip': 'Tipo a añadir al hacer clic en un día',
  'holiday.presetTooltip': 'Cargar festivos públicos de una ciudad para un año',
  'holiday.saveTitle': 'Guardar',
  'holiday.cancelTitle': 'Cancelar',
  'holiday.editTotal': 'Editar total',

  // Release notes extras
  'release.gotIt': 'Entendido',

  // Agenda calendar
  'agenda.title': 'Google Calendar',
  'agenda.empty': 'No hay URL de calendario configurada. Haz clic en ajustes para añadir una.',
  'agenda.settings': 'Ajustes',
  'agenda.modalTitle': 'Ajustes del calendario',
  'agenda.urlLabel': 'URL de inserción de Google Calendar',
  'agenda.urlPlaceholder': 'https://calendar.google.com/...',

  // Data section extras
  'data.exportBtn': 'Exportar',
  'data.importBtn': 'Importar',
  'data.resetBtn': 'Restablecer',
  'data.exported': 'Exportado.',
  'data.imported': 'Importado.',
  'data.importFailed': 'Error al importar: archivo no válido.',
  'data.resetDone': 'Restablecido.',
  'data.importConfirm': 'Importar sobrescribirá los datos actuales. ¿Continuar?',
  'data.resetAllConfirm': 'Esto eliminará TODOS los datos (registros, ajustes, festivos). ¿Continuar?',

  // Lunch section extras
  'lunch.sectionTitle': 'Pausa para comer',
  'lunch.hourLabel': 'Hora',
  'lunch.hourHint': 'Se añade a la hora de salida estimada si aún no ha pasado.',
  'lunch.durationLabel': 'Duración (min)',

  // Pomodoro section extras
  'pomoSection.workMin': 'Trabajo (min)',
  'pomoSection.breakMin': 'Descanso (min)',
  'pomoSection.workSoundLabel': 'Sonido de trabajo',
  'pomoSection.breakSoundLabel': 'Sonido de descanso',

  // Auto-round section extras
  'autoround.marginHintLong': 'Si el total de hoy está dentro del margen respecto a las horas objetivo, el intervalo se ajusta para alcanzarlas exactamente.',
  'autoround.window': 'Limitar a franja horaria',
  'autoround.windowHint': 'Solo se redondea el tiempo trabajado dentro de la franja; el de antes o después cuenta entero.',
  'autoround.windowStart': 'Inicio de la franja',
  'autoround.windowEnd': 'Fin de la franja',

  // Company tenure
  'tenure.title': 'En la empresa',
  'tenure.prompt': 'Configura tu fecha de inicio para ver cuánto tiempo llevas en la empresa.',
  'tenure.startDate': 'Fecha de inicio',
  'tenure.future': 'La fecha de inicio está en el futuro.',
  'tenure.years': 'años',
  'tenure.yearOne': 'año',
  'tenure.months': 'meses',
  'tenure.monthOne': 'mes',
  'tenure.days': 'días',
  'tenure.dayOne': 'día',
  'tenure.totalDays': 'días en total',
  'tenure.since': 'Desde',

  // Tenure milestone celebration
  'celebrate.title': '¡Felicidades!',
  'celebrate.sub.6m': 'Ya llevas 6 meses en la empresa',
  'celebrate.sub.1y': 'Hoy cumples tu primer año en la empresa',
  'celebrate.sub.years': '¡Ya son {years} años en la empresa!',
  'celebrate.message': 'Gracias por todo este tiempo. ¡Que vengan muchos más! 🎉',
  'celebrate.button': '¡Gracias!',

  // Cloud sync (GitHub Gist)
  'gistSync.notifTitle': 'La copia en la nube tiene más datos',
  'gistSync.notifBody': 'La copia en la nube tiene {remote} registros frente a {local} aquí. ¿Traerlos?',
  'gistSync.bringBtn': 'Bajar de la nube',
  'gistSync.dismissBtn': 'Descartar',
  'gistSync.sectionTitle': 'Sincronización en la nube',
  'gistSync.sectionHint': 'Opcional. Sincroniza tus datos mediante tu propio Gist privado de GitHub.',
  'gistSync.tokenLabel': 'Token de acceso',
  'gistSync.tokenHint': 'Personal Access Token (classic) con el scope mínimo "gist".',
  'gistSync.gistLabel': 'ID o URL del gist',
  'gistSync.fileLabel': 'Nombre del fichero',
  'gistSync.saveConfigBtn': 'Guardar ajustes',
  'gistSync.configSaved': 'Ajustes de sincronización guardados.',
  'gistSync.pushBtn': 'Subir a la nube',
  'gistSync.pullBtn': 'Bajar de la nube',
  'gistSync.pushed': 'Subido a la nube.',
  'gistSync.pulled': 'Descargado de la nube.',
  'gistSync.pulledEmpty': 'El fichero de la nube está vacío; nada que importar.',
  'gistSync.pullConfirm': 'Esto reemplaza los datos locales por la copia de la nube. ¿Continuar?',
  'gistSync.busy': 'Sincronizando…',
  'gistSync.errNoConfig': 'Configura primero el token y el ID del gist.',
  'gistSync.errUnauthorized': 'Token inválido o caducado, o falta el scope "gist" (401).',
  'gistSync.errNotFound': 'Gist no encontrado, o el token no puede acceder (404).',
  'gistSync.errValidation': 'GitHub rechazó la petición (422).',
  'gistSync.errParse': 'El fichero de la nube no es un JSON válido.',
  'gistSync.errNetwork': 'Error de red. Comprueba tu conexión e inténtalo de nuevo.',
  // Typed-confirmation modal for manual upload/download
  'gistSync.confirmTitle': 'Confirma esta acción',
  'gistSync.confirmPushBody': 'Esto sobrescribe la copia en la nube con tus datos locales. Escribe {word} para confirmar.',
  'gistSync.confirmPullBody': 'Esto sobrescribe tus datos locales con la copia en la nube. Escribe {word} para confirmar.',
  'gistSync.confirmPlaceholder': 'Escribe {word}',
  'gistSync.confirmBtn': 'Confirmar',
  'gistSync.cancelBtn': 'Cancelar',
};
