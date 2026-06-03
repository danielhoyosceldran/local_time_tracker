# CLAUDE.md

Local-first time tracker (Angular 21, standalone components, signals). All state
lives in the browser's `localStorage` — there is no backend.

## Persistencia y export/import (IMPORTANTE)

**Toda configuración nueva debe poder exportarse e importarse.** Cuando añadas un
ajuste o preferencia que se guarde en `localStorage`:

1. **Registra su clave** en `KNOWN_STORAGE_KEYS` en
   [src/app/services/time-entry.ts](src/app/services/time-entry.ts). Esa lista es
   la única fuente de verdad que usan `exportAll()`, `importAll()` y `resetAll()`.
   Si la clave no está en la lista, el ajuste **no** viaja en el backup y **no** se
   borra al hacer reset.
2. **Asegura que se aplique en vivo tras importar.** El import escribe en
   `localStorage` y luego llama a `refreshAll()` en
   [data-section.ts](src/app/components/settings-modal/sections/data-section.ts).
   El servicio dueño de la clave debe exponer un `reloadFromStorage()` (o
   equivalente) que reestablezca sus signals desde `localStorage`, y `refreshAll()`
   debe invocarlo. Si no, la clave se importa pero la UI no cambia hasta recargar
   la página.
3. **Convención de claves:** los ajustes nuevos usan el prefijo `tt.`
   (p. ej. `tt.companyStartDate`). Hay claves antiguas con prefijo `timeTracker*`
   que se mantienen por compatibilidad.

**Qué SÍ se incluye:** datos (fichajes, festivos) y todas las preferencias del
usuario (jornada, comida, redondeo, pomodoro, recordatorio, calendario, idioma,
tema, antigüedad y sus felicitaciones…).

**Qué NO se incluye (estado de vista / interno, no es configuración):** el periodo
del gráfico (`monthlyChart.period`), el seguimiento de release notes
(`release-notes-*`) y el estado en memoria de pestañas.

## Internacionalización

Tres idiomas (`en`, `es`, `ca`) en
[src/app/i18n/translations/](src/app/i18n/translations/). `en.ts` define
`TranslationKey`, así que **cada clave nueva debe añadirse a los tres diccionarios**
o el build falla. Uso en plantilla: `{{ 'clave' | t }}`; admite parámetros con
`{{ 'clave' | t: { years: 5 } }}` interpolando `{years}`.

## Tema oscuro

Se activa con la clase `dark` en `<html>` (via `ThemeService`). En vez de anotar
cada plantilla con variantes `dark:`, [src/styles.css](src/styles.css) reescribe el
conjunto de utilidades Tailwind que usa la app. Si usas clases estándar
(`bg-white/95`, `bg-slate-900/40`, `text-slate-800`…) el modo oscuro funciona solo.

## Comandos

- `npm start` — servidor de desarrollo (`ng serve`).
- `npm run build` — build de producción.
- `npm test` — tests unitarios (Karma + Jasmine).
- Verificación rápida de tipos: `npx tsc --noEmit -p tsconfig.app.json`.
