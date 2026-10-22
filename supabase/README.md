# Sincronización en la nube con Supabase

La app funciona 100 % en local por defecto. Si inicias sesión en un proyecto de
Supabase, tus fichajes y ajustes se sincronizan entre todos tus dispositivos.
`localStorage` sigue siendo la caché, así que la app funciona sin conexión y sube
los cambios al recuperarla.

Nadie puede registrarse desde la app: **los usuarios los crea el administrador
del proyecto** desde el dashboard de Supabase. Un mismo proyecto puede alojar a
varias personas. Cada una solo ve sus propios datos (Row Level Security).

## 1. Crear el proyecto (una sola vez)

1. Crea una cuenta en <https://supabase.com> y un proyecto nuevo. El plan
   gratuito es suficiente; elige una región cercana (p. ej. UE).
2. Abre **SQL Editor → New query** y pega y ejecuta, en orden, los ficheros de
   [`migrations/`](migrations/) (`0001_init.sql`, `0002_…`, `0003_…`).
   - El mismo SQL se puede copiar desde la app: *Ajustes → Nube → Copiar SQL
     de instalación*.
   - Con la Supabase CLI también vale `supabase db push`.
   - El script es idempotente: ejecutarlo dos veces no rompe nada.
3. Ve a **Authentication → Sign In / Providers → Email** y **desactiva "Allow new
   users to sign up"**. Es lo que impide que alguien se registre usando tu clave
   pública.
4. Ve a **Project Settings → API Keys** (o **Connect**). Copia:
   - la **Project URL** (`https://xxxx.supabase.co`)
   - la **publishable key** (`sb_publishable_…`). En proyectos antiguos se
     llama *anon key*; sirve igual.

## 2. Crear usuarios

**Authentication → Users → Add user → Create new user**

- Email y contraseña.
- Marca **Auto Confirm User** para que no haga falta verificar el email.

Repite este paso para cada persona a la que quieras dar acceso.

## 3. Conectar la app

En la app, abre **Ajustes → Nube**:

1. Pega la Project URL y la publishable key y guarda.
2. Inicia sesión con tu email y contraseña.
3. La primera vez, si este dispositivo ya tenía datos, la app te ofrece subirlos
   o fusionarlos con lo que haya en la nube. Nunca se pierde nada: los fichajes
   se unen por `id`.

### Dar acceso a otra persona

Con la sesión iniciada, pulsa **Generar código de conexión** en *Ajustes → Nube*.
El código incluye la URL y la clave pública, **nunca** tu contraseña. Envíale ese
código junto con el email y la contraseña que le creaste. Esa persona solo tiene
que:

1. pegar el código en *Ajustes → Nube*,
2. iniciar sesión,
3. (opcional) cambiar su contraseña desde la propia app.

## Seguridad

- La publishable/anon key es **pública por diseño**: va en el navegador. La
  protección real la dan:
  - **RLS**: cada fila lleva `user_id` y solo su dueño puede leerla o escribirla.
  - **Registro desactivado**: con la clave no se pueden crear cuentas.
- Nunca pegues en la app la `service_role` / *secret key*.

## Pausa por inactividad (plan gratuito)

Supabase pausa los proyectos gratuitos tras **7 días sin actividad**. Para
evitarlo, el despliegue en Vercel incluye un **cron diario**
(`crons` en [`vercel.json`](../vercel.json) →
[`api/keepalive.ts`](../api/keepalive.ts)) que hace una petición inofensiva
(`rpc/schema_version`) cada día a las 06:17 UTC. Configúralo una vez en
**Vercel → Project → Settings → Environment Variables** (entorno *Production*) y
vuelve a desplegar:

- `SUPABASE_URL`: la Project URL.
- `SUPABASE_PUBLISHABLE_KEY`: la publishable/anon key (nunca la secret key).
- `CRON_SECRET`: una cadena aleatoria larga. Vercel la envía al cron como
  `Authorization: Bearer …`, así que nadie más puede invocar el endpoint.

Los crons solo se ejecutan en el despliegue de producción. Puedes ver cada
ejecución en **Vercel → Project → Settings → Cron Jobs** (botón *Run* para
probarlo) y sus logs en **Logs**. Un fallo no envía email en el plan Hobby;
con un ping diario hacen falta 7 fallos seguidos para que el proyecto se pause.

Si aun así se pausa:

- La app sigue funcionando en local y marca la sincronización como "sin conexión".
- Entra en el dashboard y pulsa **Restore project**. Al volver, la app sube lo
  pendiente automáticamente.

## Copias de seguridad (plan gratuito)

El plan gratuito **no hace backups automáticos** de la base de datos. Dos
opciones, compatibles entre sí:

- **Desde la app:** *Ajustes → Datos → Exportar* descarga un JSON con todos los
  fichajes y ajustes. La sección muestra cuándo exportaste por última vez desde
  ese dispositivo y avisa si han pasado más de 30 días.
- **Desde la base de datos** (copia completa, con la
  [Supabase CLI](https://supabase.com/docs/guides/cli)):

  ```bash
  supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f backup.sql
  ```

  `SUPABASE_DB_URL` es la *connection string* de **Project Settings → Database**.
  Contiene la contraseña de la base de datos: no la guardes en el repo.

### Backup automático semanal (GitHub Actions)

[`.github/workflows/supabase-backup.yml`](../.github/workflows/supabase-backup.yml)
vuelca roles, esquema y datos cada lunes, los **cifra con una contraseña** y
los guarda como artefacto del workflow durante 90 días. Se cifra antes de subir
porque cualquiera con acceso de lectura al repo (todo el mundo, si es público)
puede descargar los artefactos.

1. En GitHub: **Settings → Secrets and variables → Actions → New repository
   secret**:
   - `SUPABASE_DB_URL`: en Supabase, **Connect → Session pooler** (no la
     *direct connection*: en el plan gratuito es solo IPv6 y los runners de
     GitHub son IPv4). Sustituye `[YOUR-PASSWORD]` por la contraseña de la base
     de datos.
   - `BACKUP_PASSPHRASE`: una contraseña larga y aleatoria. **Guárdala en tu
     gestor de contraseñas**: sin ella el backup no sirve.
2. **Actions → Supabase backup → Run workflow** para probarlo una vez.

Restaurar (en tu equipo, con la Supabase CLI y `psql`):

```bash
gpg --decrypt supabase-AAAA-MM-DD.tar.gz.gpg | tar -xzf - -C restore/
psql --single-transaction --variable ON_ERROR_STOP=1 --file restore/roles.sql --file restore/schema.sql --command 'SET session_replication_role = replica' --file restore/data.sql --dbname "$NUEVA_DB_URL"
```

Avisos:

- GitHub **desactiva los workflows programados** de un repo público tras 60
  días sin commits. Te avisa por email; basta con reactivarlo en *Actions*.
- El dump incluye el esquema `auth` (emails y hashes de contraseñas): otra
  razón para que vaya cifrado.

## Cabeceras de seguridad (Vercel)

`vercel.json` define una CSP que solo permite conexiones a `https://*.supabase.co`
y `wss://*.supabase.co`. Si usas un dominio propio para Supabase, añádelo a
`connect-src` o el login y la sincronización fallarán.

## Mantenimiento opcional

Los borrados se guardan como *tombstones* (`deleted = true`) para propagarse al
resto de dispositivos. Para limpiar los que tengan más de 90 días:

```sql
select public.purge_tombstones();
```

## Nuevas migraciones (para desarrolladores)

1. Crea `migrations/000N_descripcion.sql`.
2. Actualiza en ella `public.schema_version()` para que devuelva `N`.
3. Sube `CLOUD_SCHEMA_VERSION` en
   [`src/app/services/cloud/cloud-schema.ts`](../src/app/services/cloud/cloud-schema.ts)
   y añade el fichero a `CLOUD_MIGRATIONS`.

La app detecta los esquemas antiguos tras el login y ofrece el SQL que falta.
