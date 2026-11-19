# CRM NATU — Export · Gran Consumo

Diseño y asistente alineados con la plataforma NPD (`DESIGN.md` de NPD: paleta NATU, Montserrat, cabecera oscura).

CRM comercial sencillo y visual que **lee y escribe en un Excel de SharePoint**. El acceso es con las cuentas corporativas de Microsoft 365 y hay permisos por rol.

## Qué hace
- **Panel** con KPIs y gráficas: embudo por estado, canal de procedencia, calidad, actividad semanal, importe por mes, desglose por comercial y una lista de prospectos que necesitan atención. Se puede filtrar por grupo y por comercial.
- **Clientes**: buscador sin tener en cuenta acentos, y filtros por estado, calidad, canal, grupo, comercial y prospecto/cliente.
- **Ficha**:
  - Bitácora con fecha, tipo y autor. Los cambios de estado, calidad y responsable se registran solos.
  - Próxima acción con fecha.
  - Botón **Pasar a Ganado** con el primer proyecto e importe opcional.
  - **Proyectos** adicionales para clientes que ya existían.
- **Roles** (hoja *Usuarios*):

  | Rol | Ve |
  |---|---|
  | Comercial | Solo sus clientes |
  | Responsable de grupo | Todo su grupo (Export o Gran Consumo), y puede reasignar |
  | Administrador | Todo, y gestiona usuarios |

- **Alexia**, la misma asistente de la plataforma NPD (OpenAI, botón flotante en todas las pantallas):
  - Responde preguntas sobre clientes y pipeline.
  - Apunta acciones en la bitácora y programa la próxima acción.
  - Si estás en la ficha de un cliente, sabe de cuál le hablas.
  - Admite voz: dictado y lectura en voz alta.
  - Sus herramientas reciben los datos **ya filtrados por permisos**, así que nunca ve clientes que el usuario no pueda ver.

Valores configurados (`lib/types.ts`):
- **Calidad**: A · Caliente, B · Templado, C · Frío.
- **Canales**: Feria, Prospección, Email, Web, Ads, LinkedIn, Otro.
- **Estados**: Nuevo, Contactado, Propuesta enviada, Negociación, Ganado, Perdido.
- **Tipos de acción**: Llamada, Email, Reunión, Visita, Muestra enviada, Oferta, Nota.

## El Excel
`npm run workbook` genera `CRM_Natu.xlsx` con 4 **tablas de Excel** (Clientes, Acciones, Proyectos, Usuarios) y una hoja *Listas*.
> ⚠️ Este repositorio es **público**: los datos reales de clientes (CSV, `data/seed.real.json`, `.xlsx`) están en `.gitignore` y no deben subirse. `data/seed.json` contiene solo datos de demostración inventados.
- La app localiza cada dato por **nombre de tabla** (`tblClientes`…) y por **cabecera**. Puedes reordenar columnas o añadir otras: la app conserva las columnas extra.
- No cambies los nombres de las tablas ni de las cabeceras que usa la app (`lib/store/schema.ts`).
- Migrar desde el CSV antiguo: `npm run seed -- archivo.csv` (crea `data/seed.real.json`) y después `npm run workbook`.

## Puesta en marcha (IT / admin)

### 1. Subir el Excel a SharePoint
Súbelo a un **sitio de SharePoint del equipo comercial**, no a un OneDrive personal. Copia el enlace del archivo y ponlo en `EXCEL_SHARE_URL`.

### 2. Registrar la app en Entra ID (portal de Azure → *App registrations* → *New*)
1. **Name**: `CRM Natu`. **Supported account types**: *Single tenant*.
2. **Redirect URI** (Web):
   - `https://<dominio-del-crm>/api/auth/callback/microsoft-entra-id`
   - Para pruebas en local: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
3. **Certificates & secrets** → *New client secret*. Guarda el valor.
4. **API permissions** → Microsoft Graph:
   - *Delegated*: `User.Read`, `openid`, `profile`, `email` (para el login).
   - *Application*: `Sites.Selected` (recomendado, da acceso solo a ese sitio) o `Files.ReadWrite.All`.
   - Después pulsa **Grant admin consent**.
   - Con `Sites.Selected` hay que conceder además acceso `write` de la app al sitio concreto (`POST /sites/{site-id}/permissions`).
5. Copia el **Application (client) ID** y el **Directory (tenant) ID**.

### 3. Variables de entorno
Copia `.env.example` a `.env.local` (o configúralas en el hosting):

```
DATA_SOURCE=excel
EXCEL_SHARE_URL=<enlace del Excel>
AUTH_SECRET=<npx auth secret>
AUTH_MICROSOFT_ENTRA_ID_ID=<client id>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<client secret>
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=<tenant id>
AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<tenant id>/v2.0
BOOTSTRAP_ADMIN_EMAILS=<tu email>
OPENAI_API_KEY=<la misma clave de OpenAI que usa NPD>
```

### 4. Desplegar
Es una app Next.js estándar: Vercel, Azure App Service o Azure Static Web Apps.
```bash
npm install
npm run build
npm start
```

## Desarrollo local sin Microsoft 365
```bash
cp .env.example .env.local
```
En `.env.local` pon `DATA_SOURCE=local`, `AUTH_DEV_LOGIN=true` y `AUTH_SECRET=cualquier-cosa`. Después:
```bash
npm install
npm run dev
```
En /login puedes entrar como cualquier usuario de la hoja Usuarios. Se usan los datos de `data/seed.real.json` si existe y, si no, la demo de `data/seed.json`. Los cambios se guardan en `data/local-db.json`. **No actives `AUTH_DEV_LOGIN` en producción.**

## Estructura
- `lib/types.ts`: modelo y listas de valores.
- `lib/permissions.ts`: reglas de visibilidad. Todo pasa por `filtrarDatos`.
- `lib/store/`: almacenamiento. `graph.ts` (Excel vía Microsoft Graph) y `local.ts` (JSON).
- `lib/actions.ts`: escrituras (server actions) con comprobación de permisos.
- `lib/ai.ts`, `lib/voice.ts`, `app/api/assistant/*` y `components/assistant/`: Alexia (mismo patrón que NPD).
- `app/(crm)/`: páginas (panel, clientes, ficha, asistente, usuarios).
