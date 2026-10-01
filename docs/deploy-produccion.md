# Despliegue a producción desde cero

Procedimiento para publicar la rama `integracion` (Fases 0–6) con una base de
datos de producción **nueva y vacía**. Los datos actuales de las bases son de
prueba y no se migran.

## Estado de partida

| Recurso | Uso actual | Después del corte |
|---|---|---|
| Neon `prueba` | `DATABASE_URL` de `mdlt` en Production. También está conectado a `adminfront-mdlt` en todos sus entornos | Se desconecta de `mdlt`. **No se borra**: `adminfront-mdlt` lo sigue usando |
| Neon `mdlt-preview` | `mdlt` en Preview y Development | Sin cambios |
| Neon `mdlt-prod` (creado el 2026-10-01, sin conectar) | — | `mdlt` en Production |
| `JWT_SECRET` | Production: valor original (Sensitive). Preview y Development: secreto propio | Sin cambios |
| Upstash KV (`KV_REST_API_*`) | Solo en Production | Sin cambios: el rate limiting de producción depende de esto |
| Sentry | Todas las variables, en todos los entornos | Sin cambios |

## Pasos

Todos los comandos se corren desde la raíz del repo, con la rama
`integracion` y el CLI enlazado al proyecto `mdlt`.

### 1. Crear la base nueva, sin conectarla

```bash
npx -y vercel integration add neon --name mdlt-prod --no-connect --no-claim --non-interactive
```

### 2. Cambiar la base de Production

El deploy activo no se ve afectado: conserva las variables con las que se
publicó hasta el próximo deploy.

```bash
npx -y vercel integration resource disconnect prueba mdlt --yes
npx -y vercel integration resource connect mdlt-prod mdlt -e production --yes
```

### 3. Aplicar el schema y los datos de referencia

```bash
npx -y vercel env pull .env.prod.local --environment=production --yes
node --env-file=.env.prod.local node_modules/drizzle-kit/bin.cjs migrate
```

`migrate` aplica `0000_baseline` (schema completo, con `token_version`) y
`0001_datos_referencia` (roles, tarifas de envío y el servicio "Envío"). En una
base nueva **no** se usa `db:baseline`: ese script solo registra el baseline en
bases que ya tenían las tablas.

### 4. Crear los usuarios internos

```bash
node --env-file=.env.prod.local --import tsx scripts/create-admin.ts
```

Muestra una sola vez las contraseñas aleatorias de `admin@` y `soporte@`.
Guárdalas en un gestor de contraseñas. Después, borra el archivo:

```bash
rm .env.prod.local
```

### 5. Publicar

Mergear el PR `integracion → main`. Vercel despliega `main` a Production.

### 6. Verificación posterior

- `/catalogo` carga (vacío hasta que se creen productos) y `/login` funciona
  con el admin nuevo.
- Crear un producto con imagen. Verifica Blob, `productos/update` y la
  revalidación de `/catalogo`.
- Pedido de prueba desde el catálogo → pago → envío automático. Anúlalo después.
- 11 logins fallidos seguidos → 429 (Upstash).
- Aparece un error de prueba en Sentry.

## Notas

- **Todas las sesiones se cierran:** los tokens nuevos llevan `aud` y `tv`.
- **Upload** ahora exige el permiso `productos/update`.
- **Vercel Blob** conserva las imágenes de prueba anteriores. No estorban,
  pero se pueden limpiar desde el dashboard.
- **Rollback:** reconectar `prueba` a Production (`resource disconnect
  mdlt-prod` + `resource connect prueba mdlt -e production`) y hacer redeploy
  del deploy anterior desde el dashboard. La base `prueba` no se modifica en
  ningún paso.
- **Fin de línea de las migraciones:** Drizzle registra el hash del archivo SQL
  tal como está en disco. Corre `migrate` siempre desde un checkout con la
  misma configuración de fin de línea.
