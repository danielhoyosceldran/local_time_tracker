# Time Tracker

Registro de jornada laboral y vacaciones: temporizador start/stop, intervalos
manuales, resúmenes diario y semanal, gráfico mensual, calendario de festivos,
agenda, Pomodoro, recordatorios y antigüedad en la empresa. En inglés, español
y catalán, con formato 12h/24h y tema claro/oscuro.

Angular 21 (componentes standalone, signals), Tailwind y Kendo UI. Se despliega
en Vercel como PWA instalable.

## Datos

- **Sin cuenta (por defecto):** todo vive en el `localStorage` del navegador.
  Ajustes → Datos permite exportar e importar un backup JSON completo.
- **Con cuenta (opcional):** los datos se sincronizan entre dispositivos con un
  proyecto de Supabase. La nube pasa a ser la copia de referencia y el
  `localStorage` es la copia de trabajo, que sigue funcionando sin conexión.
  - **Un solo dispositivo editando a la vez:** el primero que abre la app coge
    el mutex de edición; el resto queda en solo lectura hasta que se cierre o
    pasen 2 minutos sin actividad. Se puede "tomar el control" en cualquier momento.
  - **Al conectar un dispositivo con datos**, eliges qué copia conservar
    (nube → local o local → nube). Nunca se mezclan.
  - Instalación, usuarios, seguridad, backups y mantenimiento:
    [supabase/README.md](supabase/README.md).

## Desarrollo

```bash
npm start
```

Servidor de desarrollo en `http://localhost:4200/`.

```bash
npm test
```

Tests unitarios (Karma + Jasmine).

```bash
npm run build
```

Build de producción en `dist/`.

```bash
npx tsc --noEmit -p tsconfig.app.json
```

Comprobación rápida de tipos.

Las convenciones del proyecto (export/import de ajustes, traducciones, formato
de hora, tema oscuro, sync y migraciones) están en [CLAUDE.md](CLAUDE.md).

## Despliegue

- **Vercel:** cabeceras de seguridad (CSP) y cron de keepalive en
  [vercel.json](vercel.json). El cron necesita las variables `SUPABASE_URL`,
  `SUPABASE_PUBLISHABLE_KEY` y `CRON_SECRET` (ver
  [supabase/README.md](supabase/README.md#pausa-por-inactividad-plan-gratuito)).
- **Supabase:** cada cambio de esquema es un fichero en
  [supabase/migrations/](supabase/migrations/). Tras desplegar una versión que
  necesita una migración nueva, la app lo detecta al iniciar sesión y ofrece
  copiar el SQL que falta.
- **Backup semanal** cifrado de la base de datos:
  [.github/workflows/supabase-backup.yml](.github/workflows/supabase-backup.yml).
