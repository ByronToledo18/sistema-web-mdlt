# API de Servientrega (Servicli) — resumen

Resumen de los documentos oficiales *"API para integración de Clientes Corporativos con Servicli"* (MEST 17062024-1, v02) y *"Servicio web – Trazabilidad de envíos"* (MEST 17062024, v02), más el formato real de las respuestas observado en QA en octubre de 2026. La integración vive en `server/integraciones/servientrega/` y `server/services/servientrega.ts`; la arquitectura está en `ARQUITECTURA.md`, sección "Integración Servientrega".

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

### IP fija (producción) y proxy de salida

Producción (la API de guías y la trazabilidad) solo responde a IPs públicas registradas en Servientrega. QA respondió desde la PC de desarrollo; no está verificado si responde desde las IPs de Vercel.

Con `SERVIENTREGA_PROXY_URL` (`http(s)://usuario:clave@host:puerto`, p. ej. QuotaGuard Static o Fixie) **todas** las llamadas (guías, PDFs y trazabilidad) salen por ese proxy con `HTTP CONNECT`, y se registra en Servientrega la IP fija del proxy. El túnel es TCP: el TLS sigue siendo de punta a punta con Servientrega y se valida igual que sin proxy (en QA, contra `servientrega.com.ec`). La URL del proxy lleva credenciales: nunca se loguea. Sin la variable, la conexión es directa. Detalle y alternativas en `ARQUITECTURA.md`.

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

## Trazabilidad (servicio SOAP)

Servicio aparte, en otro host (certificado propio `*.appsiscore.com`, validación TLS normal). No usa usuario ni contraseña, pero en producción también exige la IP registrada.

| Ambiente | Endpoint (WSDL con `?wsdl`) |
|---|---|
| Pruebas | `https://servientrega-ecuador-prueba.appsiscore.com/app/ws/server_trazabilidad.php` |
| Producción | `https://servientrega-ecuador.appsiscore.com/app/ws/server_trazabilidad.php` |

`SERVIENTREGA_TRAZABILIDAD_URL` reemplaza el endpoint del ambiente (se acepta con o sin `?wsdl`).

- **Método**: `ConsultarGuiaImagen` (RPC/encoded), con un parámetro `guia` (`xsd:string`, el número de guía). `SOAPAction`: `<endpoint>/ConsultarGuiaImagen`. Namespace: `https://servientrega-ecuador.appsiscore.com/app/ws/` (el mismo en pruebas y producción).
- **Respuesta**: `<Result>` con el XML de la guía (`ConsultarGuiaImagenResult`). La documentación lo muestra en CDATA; QA lo devuelve **escapado con entidades** (`&lt;NumGui&gt;…`), en `text/xml; charset=ISO-8859-1`. El sistema acepta las dos formas.
- **Campos usados**: `NumGui`, `FecEnv`, `FechaProbable`, `CiuRem`, `CiuDes`, `IdEstAct`, `EstAct`, `FecEst`, `NomRec` (o `quienrecibe`, que aparece en QA) y los movimientos `Mov/InformacionMov` (`NomMov`, `OriMov`, `DesMov`, `FecMov`). También trae `NomRem`/`DirRem`, `NomDes`/`DirDes`, `NumPie`, `Placa`, `IdGPS` y `MensajeBuscarImagen` (sobre la imagen de la prueba de entrega en base64, que el sistema no usa).
- **Sin datos**: en QA (2026-10-20) cualquier número, exista o no (incluido el ejemplo de la documentación), devuelve la estructura vacía con `IdEstAct` = 3 y `EstAct`, `FecEnv` y `Mov` vacíos. El sistema lo trata como "sin datos" y conserva el último estado conocido.
- **Errores**: un SOAP Fault (`faultstring`) se muestra como rechazo.

Ejemplo de la documentación (resumido):

```xml
<ConsultarGuiaImagenResult>
  <FechaProbable>2020-06-23</FechaProbable>
  <NumGui>701239153</NumGui>
  <FecEnv>2020-06-17</FecEnv>
  <CiuRem>CUENCA -AZUAY</CiuRem>
  <CiuDes>GUAYAQUIL -GUAYAS</CiuDes>
  <IdEstAct>3</IdEstAct>
  <EstAct>Generado Cliente Corporativo</EstAct>
  <FecEst>2020-06-17</FecEst>
  <NomRec/>
  <Mov>
    <InformacionMov>
      <NomMov>Generado Cliente Corporativo</NomMov>
      <OriMov>CUENCA -AZUAY</OriMov>
      <DesMov>Generado Cliente Corporativo</DesMov>
      <FecMov>2020-06-17 15:24</FecMov>
    </InformacionMov>
  </Mov>
  <MensajeBuscarImagen>Esta guía no tiene prueba de entrega digitalizada...</MensajeBuscarImagen>
</ConsultarGuiaImagenResult>
```

Estados de trazabilidad que lista la documentación (texto de `EstAct`/`NomMov`): Reportado entregado en app; Inventario en centro logístico; Ingreso interno a centro logístico; Ingresando operativo a centro logístico; Ingresando de recolección; Generado en {ciudad} agencia {agencia}; Entregado a remitente; En ruta a centro logístico; En distribución a cliente; Devolución de distribución {motivo}; Certificación de prueba de entrega.

### Rastreo público

Sin API ni credenciales, para el cliente (portal) y el admin:

- Por guía: `https://www.servientrega.com.ec/Tracking/?guia=<numero>&tipo=GUIA`
- Por guía de referencia: `https://www.servientrega.com.ec/Tracking/?guia=<referencia>&tipo=REFERENCIA`
