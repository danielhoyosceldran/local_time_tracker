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

## Formato de hora (12h / 24h)

El ajuste `tt.timeFormat` (`SettingsService.timeFormat()`, valores `'12h'`/`'24h'`)
gobierna cómo se muestra **cualquier hora de reloj** (hora del día), nunca las
duraciones/temporizadores (esos usan `formatDuration`/`formatHoursToTime`).

**Cuando muestres o edites una hora de reloj nueva, no la formatees a mano.** Usa
los helpers centralizados de [src/app/utils/format.ts](src/app/utils/format.ts):

- **En plantilla:** `{{ valor | clockTime }}`
  ([ClockTimePipe](src/app/pipes/clock-time.pipe.ts), impuro, lee el signal).
- **En TypeScript:** `formatClockTime(valor, this.settings.timeFormat())`.
- **En pickers de Kendo** (`kendo-timepicker` / `kendo-datetimepicker`): enlaza
  `[format]` a un `computed` con `kendoTimeFormat(fmt)` o `kendoDateTimeFormat(fmt)`
  en vez de codificar `'HH:mm'`. Dentro del modal de ajustes usa
  `draft.timeFormat()` para que el cambio se refleje en vivo.

El almacenamiento interno de horas sigue en `"HH:mm"` 24h; el ajuste solo afecta a
la presentación.

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

## Deuda técnica: escenarios de pérdida de datos (PENDIENTE)

Riesgos de pérdida de información detectados en el sync con gist y en
`localStorage`. La raíz de la mayoría es la misma: **el sync sube/baja un snapshot
completo con "último que escribe gana", sin merge, y compara por conteo de
entries**. Probabilidad = estimación cualitativa (no medida); los casos de sync
asumen gist configurado y uso multi-dispositivo. Al resolver un punto, actualiza
la columna **Solucionado** y referencia el commit/PR.

| # | Problema | Solución propuesta | Prob. | Solucionado |
| --- | --- | --- | :---: | :---: |
| 3 | Heurística por **conteo** ciega a ediciones/borrados y a conjuntos divergentes del mismo tamaño → divergencia silenciosa y pisado | Comparar por **unión de `id`** (no por número) y **merge por `id`** en vez de reemplazo | 55% | ❌ No |
| 6 | **Borrar/editar no disparan push** → la nube queda con datos viejos; otro dispositivo los "trae" y resucita lo borrado | ~~Disparar `syncToCloud()` en cada mutación~~ → **Resuelto:** el sync se centralizó en la capa de persistencia (`saveEntries`/`saveRunningEntry`), por la que pasan TODAS las mutaciones; las llamadas se agrupan en un microtask (un push por operación, con el estado final). Import/reload no pasan por ahí, así que traer de la nube no rebota. | 50% | ✅ Sí |
| 2 | **Pull/import/"traer del cloud" = reemplazo total**, no merge → entries locales únicas se pierden | **Merge por `id`** (conservar la versión más reciente por `endTime`/edición) en lugar de sobreescribir | 45% | ❌ No |
| 1 | Play en dispositivo vacío/reseteado **sube snapshot pobre y borra la nube entera** (last-writer-wins) | **Pull-then-merge antes del primer push** de la sesión; bloquear push que reduzca drásticamente el nº de entries sin confirmación | 40% | ❌ No |
| 4 | **Multi-pestaña** mismo navegador: la 2ª pestaña pisa el running entry de la 1ª (sesión en curso perdida) | Escuchar evento `window.storage` y recargar signals con `reloadFromStorage()` | 35% | ❌ No |
| 5 | **Running entry compartido** (feature de identidad de dispositivo) bloquea al otro: no puede pararlo ni arrancar el suyo; si el dueño desaparece, queda irrecuperable | Permitir **"forzar parada / tomar control"** de un timer ajeno; no bloquear el inicio de uno nuevo si el running entry es de otro dispositivo | 30% | ❌ No |
| 8 | Sin gist configurado, el navegador **vacía `localStorage`** (incógnito, "borrar al cerrar", presión de almacenamiento) → pérdida total | Backup opt-in más visible / aviso de respaldo; export automático periódico | 25% | ❌ No |
| 9 | `reset` deja `gistConfig` vivo → el siguiente play **pushea vacío y borra la nube** | Misma guardia anti-reducción del #1; o pedir confirmación de re-sync tras reset | 15% | ❌ No |
| 7 | `localStorage` **corrupto/truncado** → `JSON.parse` sin try/catch en el arranque → app no bootea | Envolver los `JSON.parse` de carga ([time-entry.ts](src/app/services/time-entry.ts) `loadEntries`/`loadRunningEntry`) en **try/catch** (degradar a vacío + avisar) | 8% | ❌ No |
| 10 | **Cuota de `localStorage` excedida** → `setItem` lanza y un stop falla a medias | try/catch en `saveEntries` + aviso | 3% | ❌ No |

**Nota:** #1, #2, #3 y #6 comparten núcleo — un único cambio de fondo (**merge por
`id` + comparación por unión de ids + push en todas las mutaciones**) los resuelve
de golpe. #7 es trivial y conviene atacarlo pronto (evita pantallazos en blanco).
