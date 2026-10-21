# API de Servientrega (Servicli) — resumen

Resumen del documento oficial *"API para integración de Clientes Corporativos con Servicli"* (MEST 17062024-1, v02), más el formato real de las respuestas observado en QA en octubre de 2026. La integración vive en `server/integraciones/servientrega/` y `server/services/servientrega.ts`; la arquitectura está en `ARQUITECTURA.md`, sección "Integración Servientrega".

Las credenciales de QA las entrega el facilitador comercial corporativo de Servientrega. **Nunca van en el repositorio**: solo en variables de entorno (ver `README.md`).

## Endpoints

Los parámetros entre corchetes forman parte de la ruta y van URL-encoded, por ejemplo `['USUARIO','CONTRASEÑA']` → `%5B'USUARIO'%2C'CONTRASE%C3%91A'%5D`. Por eso **las URLs contienen la contraseña y nunca se loguean**.

| Operación | Método | QA | Producción |
|---|---|---|---|
| Ciudades | GET | `https://181.39.87.158:8021/api/ciudades/['USUARIO','CONTRASEÑA']` | `https://swservicli.servientrega.com.ec:5052/api/ciudades/[…]` |
| Generar guía | POST | `https://181.39.87.158:8021/api/guiawebs/` | `https://swservicli.servientrega.com.ec:5052/api/guiawebs` |
| Consultar guía | GET | `https://181.39.87.158:8021/api/guiawebs/['GUIA','USUARIO','CONTRASEÑA']` | (no documentado) |
| Anular guía | DELETE | `https://181.39.87.158:8021/api/guiawebs/['GUIA','USUARIO','CONTRASEÑA']` | `https://swservicli.servientrega.com.ec:5052/api/guiawebs/[…]` |
| Guía PDF A4 | GET | `https://181.39.87.158:7777/api/GuiasWeb/['GUIA','USUARIO','CONTRASEÑA','1']` | `https://swservicli.servientrega.com.ec:5001/api/GuiasWeb/[…]` |
| Rótulo PDF | GET | `https://181.39.87.158:7777/api/ImprimeRotulos/['GUIA','USUARIO','CONTRASEÑA']` | `https://swservicli.servientrega.com.ec:5001/api/ImprimeRotulos/[…]` |

Otros endpoints documentados y no usados por el sistema: `GuiaRetornoNacional` (POST, guía de retorno), `GuiaRecaudo` (POST, guía con recaudo), `GuiaDigital` (GET, guía en formato sticker), `ImprimeRotulosA4` (GET) y `Manifiestos` (GET, `['AAAA-MM-DD','USUARIO','CONTRASEÑA','T']`).

### TLS

- **QA** se publica por IP, pero su certificado (Sectigo) es válido para `servientrega.com.ec`. El cliente se conecta con SNI `servientrega.com.ec` y valida el certificado contra ese nombre (`checkServerIdentity`). La verificación TLS **no** se desactiva.
- **Producción** (`swservicli.servientrega.com.ec`) valida de forma normal (certificado con `*.servientrega.com.ec`; verificado el 2026-10-20).

### IP fija (producción)

Producción solo responde a IPs públicas registradas en Servientrega. QA respondió desde la PC de desarrollo; no está verificado si responde desde las IPs de Vercel. Ver en `ARQUITECTURA.md` el problema con Vercel Hobby y las opciones.

## Generar guía (POST guiawebs)

JSON con los campos en minúsculas (la tabla oficial los muestra en mayúsculas):

| Campo | Tipo | Oblig. | Uso en el sistema |
|---|---|---|---|
| `id_tipo_logistica` | int | Sí | Siempre `1` |
| `detalle_envio_1`, `detalle_envio_2`, `detalle_envio_3` | texto | No | `Pedido TUTU-…`, guía interna `SER-…`, vacío |
| `id_ciudad_origen` | int | Sí | `SERVIENTREGA_REMITENTE_CIUDAD_ID` |
| `id_ciudad_destino` | int | Sí | Elegida por el admin (sugerida desde el pedido) |
| `id_destinatario_ne_cl` | texto | Sí | Cédula/RUC del cliente |
| `razon_social_desti_ne` | texto | Sí | Nombre completo del cliente |
| `nombre_destinatario_ne`, `apellido_destinatar_ne` | texto | Sí | Nombre del cliente dividido en nombre y apellido |
| `direccion1_destinat_ne` | texto | Sí | Dirección del cliente |
| `sector_destinat_ne` | texto | No | Vacío |
| `telefono1_destinat_ne` | texto | Sí | Teléfono del cliente |
| `telefono2_destinat_ne`, `codigo_postal_dest_ne` | | No | Vacío |
| `id_remitente_cl`, `razon_social_remite`, `nombre_remitente`, `apellido_remite`, `direccion1_remite`, `telefono1_remite` | texto | Sí | Variables `SERVIENTREGA_REMITENTE_*` |
| `sector_remite` | texto | No | `SERVIENTREGA_REMITENTE_SECTOR` |
| `telefono2_remite`, `codigo_postal_remi` | | No | Vacío |
| `id_producto` | int | Sí | Ver productos; por defecto `2` |
| `contenido` | texto | Sí | Por defecto "Tutú / prendas" |
| `numero_piezas` | int | Sí | Por defecto `1` |
| `valor_mercancia` | número | Sí | Por defecto el subtotal de productos del pedido (acepta decimales) |
| `valor_asegurado` | número | Sí | `0` |
| `largo`, `ancho`, `alto` | número | Sí | `0` |
| `peso_fisico` | número | Sí | Peso en kg, por defecto `0.5` |
| `login_creacion`, `password` | texto | Sí | Credenciales de Servicli |

## Respuestas reales (QA, 2026-10-20)

Todas responden `Content-Type: application/json`.

| Operación | Respuesta |
|---|---|
| Ciudades | `200` `[{"id":2,"nombre":"QUITO (PICHINCHA)"}, …]` (596 ciudades; el nombre incluye la provincia entre paréntesis) |
| Generar guía OK | `201` `{"id":709533698,"msj":"GUÍA REGISTRADA CORRECTAMENTE"}`. `id` es el número de guía |
| Generar guía con datos inválidos o credenciales erróneas | `500` sin cuerpo |
| Anular | `201` `{"id":<guía>,"msj":"…"}` **también cuando la rechaza**: el resultado va en `msj`. En QA todas las anulaciones respondieron `"LA GUÍA NO PUEDE SER ANULADA, PORQUE ESTA SIENDO PROCESADA"`, impresas o no |
| Guía A4 | `201` `{"guia":<guía>,"mensaje":"LA GUÍA FUE GENERADA CORRECTAMENTE","archivoEncriptado":"JVBERi0…"}`. `archivoEncriptado` es el PDF en base64 (≈85 KB). Se puede volver a pedir (`"mensaje":"LA GUÍA YA FUE IMPRESA"`, con archivo) |
| Rótulo | `201` `{"guia":0,"mensaje":"","archivoEncriptado":"JVBERi0…"}` (≈58 KB). **Solo se entrega una vez**: la siguiente vez responde `"mensaje":"LA GUÍA #… YA SE ENCUENTRA IMPRESA POR RÓTULO"` sin archivo. Por eso el sistema guarda el primer rótulo en `servientrega_rotulos` |
| PDF de una guía inexistente | `201` con `archivoEncriptado` vacío y un mensaje de error en `mensaje` |
| Consultar guía | `200` `[{numero_guia, destino, origen, producto, contenido, valor_mercancia, peso_fisico, fecha, estado, …}]`. Una guía recién creada aparece `INGRESADA`; tras descargar el PDF, `GENERADA` |

## Productos

| id | Producto |
|---|---|
| 1 | Documento unitario |
| 2 | Mercancía Premier (por defecto) |
| 3 | Documento masivo |
| 6 | Mercancía industrial |
| 8 | Valija empresarial |
| 71 | Farma |

## Estados de la guía (Servicli)

| id | Estado |
|---|---|
| 1 | Ingresada |
| 2 | Generada |
| 3 | Anulada |
| 4 | En procesamiento |
| 5 | Reportado como entregado |
| 6 | Reportado como devuelto |
| 7 | Pendiente proc. logístico |
| 8 | En procesamiento (histórico) |
| 9 | Devuelto al remitente |
| 99 | Generado por API |
