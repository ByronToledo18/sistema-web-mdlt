import { describe, expect, test } from "vitest"
import { urlRastreoPublico } from "@/lib/servientrega"
import {
  decodificarEntidades,
  decodificarRespuesta,
  parsearTrazabilidad,
  sobreConsulta,
  valorEtiqueta,
} from "@/server/integraciones/servientrega/trazabilidad"

const sobre = (result: string) =>
  `<?xml version="1.0" encoding="ISO-8859-1"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">` +
  `<SOAP-ENV:Body><ns1:ConsultarGuiaImagenResponse xmlns:ns1="https://servientrega-ecuador.appsiscore.com/app/ws/">` +
  `<Result xsi:type="xsd:string">${result}</Result></ns1:ConsultarGuiaImagenResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>`

// Ejemplo de la documentación oficial (Result con CDATA).
const EJEMPLO_DOC = sobre(`<![CDATA[<ConsultarGuiaImagenResult>
<FechaProbable>2020 -06-23</FechaProbable>
<NumGui>701239153</NumGui>
<FecEnv>2020-06-17</FecEnv>
<NumPie>1</NumPie>
<CiuRem>CUENCA -AZUAY</CiuRem>
<NomRem>TIENDACUENCA.122   CUENCA</NomRem>
<DirRem>AV. LAS AMERICAS SN Y AMAZONAS</DirRem>
<CiuDes>GUAYAQUIL -GUAYAS</CiuDes>
<NomDes>DANIXA</NomDes>
<DirDes>PARQUE EMPRESARIAL COLON</DirDes>
<IdEstAct>3</IdEstAct>
<EstAct>Generado Cliente Corporativo</EstAct>
<FecEst>2020-06-17</FecEst>
<NomRec/>
<NumCun>0</NumCun>
<Regime></Regime>
<Mov>
<InformacionMov>
<IdProc>6</IdProc>
<IdConc>0</IdConc>
<NomConc></NomConc>
<NomMov>Generado Cliente Corporativo</NomMov>
<OriMov>CUENCA -AZUAY</OriMov>
<DesMov>Generado Cliente Corporativo</DesMov>
<FecMov>2020-06-17 15:24</FecMov>
<IdViewCliente>1</IdViewCliente>
<TipoMov>0</TipoMov>
<FechaProb/>
<DesTipoMov/>
</InformacionMov>
<InformacionMov>
<NomMov>En Distribución a Cliente</NomMov>
<OriMov>GUAYAQUIL -GUAYAS</OriMov>
<DesMov>Ruta 4</DesMov>
<FecMov>2020-06-18 09:10</FecMov>
</InformacionMov>
</Mov>
<Placa></Placa>
<IdGPS>0</IdGPS>
<MensajeBuscarImagen>Esta guía no tiene prueba de entrega digitalizada...</MensajeBuscarImagen>
</ConsultarGuiaImagenResult>]]>`)

// Respuesta real de QA (2026-10-20): XML escapado con entidades y vacío.
const VACIA_QA = sobre(
  `&lt;ConsultarGuiaImagenResult&gt;
&lt;FechaProbable&gt;&lt;/FechaProbable&gt;
&lt;NumGui&gt;709533700&lt;/NumGui&gt;
&lt;FecEnv&gt;&lt;/FecEnv&gt;
&lt;IdEstAct&gt;3&lt;/IdEstAct&gt;
&lt;EstAct&gt;&lt;/EstAct&gt;
&lt;FecEst&gt;&lt;/FecEst&gt;
&lt;NomRec/&gt;
&lt;quienrecibe&gt;&lt;/quienrecibe&gt;
&lt;Mov&gt;
&lt;/Mov&gt;
&lt;MensajeBuscarImagen&gt;&lt;/MensajeBuscarImagen&gt;
&lt;/ConsultarGuiaImagenResult&gt;
`,
)

describe("parsearTrazabilidad", () => {
  test("ejemplo de la documentación (CDATA): estado, fechas, receptor y movimientos", () => {
    expect(parsearTrazabilidad(EJEMPLO_DOC, "701239153")).toEqual({
      numeroGuia: "701239153",
      estadoActual: "Generado Cliente Corporativo",
      idEstado: 3,
      fechaEstado: "2020-06-17",
      fechaProbable: "2020-06-23",
      fechaEnvio: "2020-06-17",
      ciudadOrigen: "CUENCA -AZUAY",
      ciudadDestino: "GUAYAQUIL -GUAYAS",
      receptor: null,
      movimientos: [
        {
          nombre: "Generado Cliente Corporativo",
          origen: "CUENCA -AZUAY",
          descripcion: "Generado Cliente Corporativo",
          fecha: "2020-06-17 15:24",
        },
        { nombre: "En Distribución a Cliente", origen: "GUAYAQUIL -GUAYAS", descripcion: "Ruta 4", fecha: "2020-06-18 09:10" },
      ],
      mensajeImagen: "Esta guía no tiene prueba de entrega digitalizada...",
      sinDatos: false,
    })
  })

  test("el mismo contenido escapado con entidades (formato real de QA) da el mismo resultado", () => {
    const interior = /<!\[CDATA\[([\s\S]*)\]\]>/.exec(EJEMPLO_DOC)![1]
    const escapado = sobre(interior.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
    expect(parsearTrazabilidad(escapado, "701239153")).toEqual(parsearTrazabilidad(EJEMPLO_DOC, "701239153"))
  })

  test("guía sin datos (QA responde IdEstAct=3 sin estado ni movimientos): sinDatos", () => {
    expect(parsearTrazabilidad(VACIA_QA, "709533700")).toMatchObject({
      numeroGuia: "709533700",
      estadoActual: null,
      idEstado: null,
      movimientos: [],
      sinDatos: true,
    })
  })

  test("con receptor y sin movimientos: no es sinDatos", () => {
    const xml = sobre(
      `<![CDATA[<ConsultarGuiaImagenResult><NumGui>1</NumGui><EstAct>Entregado</EstAct><IdEstAct>5</IdEstAct><NomRec>ANA P&#201;REZ</NomRec><Mov></Mov></ConsultarGuiaImagenResult>]]>`,
    )
    expect(parsearTrazabilidad(xml, "1")).toMatchObject({
      estadoActual: "Entregado",
      idEstado: 5,
      // Dentro del XML interno las entidades sí se decodifican.
      receptor: "ANA PÉREZ",
      movimientos: [],
      sinDatos: false,
    })
  })

  test("SOAP Fault → rechazada con el faultstring", () => {
    const fault =
      `<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body><SOAP-ENV:Fault>` +
      `<faultcode>SOAP-ENV:Client</faultcode><faultstring>Operation &apos;X&apos; is not defined</faultstring>` +
      `</SOAP-ENV:Fault></SOAP-ENV:Body></SOAP-ENV:Envelope>`
    expect(() => parsearTrazabilidad(fault, "1")).toThrow("Trazabilidad: Operation 'X' is not defined")
  })

  test("sin <Result> → respuesta_invalida; Result con texto plano → rechazada", () => {
    expect(() => parsearTrazabilidad("<html>error</html>", "1")).toThrow(/inesperada/)
    try {
      parsearTrazabilidad(sobre("GUIA NO EXISTE"), "1")
      expect.unreachable()
    } catch (error) {
      expect(error).toMatchObject({ tipo: "rechazada", message: "Trazabilidad: GUIA NO EXISTE" })
    }
    expect(parsearTrazabilidad(sobre(""), "1")).toMatchObject({ sinDatos: true })
  })
})

describe("utilidades SOAP", () => {
  test("el sobre lleva el número de guía escapado", () => {
    const xml = sobreConsulta("709533700")
    expect(xml).toContain('<guia xsi:type="xsd:string">709533700</guia>')
    expect(xml).toContain("<ws:ConsultarGuiaImagen")
    expect(sobreConsulta("1<2")).toContain("1&lt;2")
  })

  test("valorEtiqueta: vacía, autocerrada, ausente, con prefijo", () => {
    expect(valorEtiqueta("<a><B></B></a>", "B")).toBe("")
    expect(valorEtiqueta("<a><B/></a>", "B")).toBe("")
    expect(valorEtiqueta("<a></a>", "B")).toBeNull()
    expect(valorEtiqueta("<x:B>hola</x:B>", "B")).toBe("hola")
    expect(valorEtiqueta("<BB>no</BB><B>si</B>", "B")).toBe("si")
  })

  test("decodificarEntidades", () => {
    expect(decodificarEntidades("&lt;a&gt; &amp; &quot;&apos; &#201; &#xC9;")).toBe(`<a> & "' É É`)
  })

  test("charset: Content-Type, si no la declaración XML, si no UTF-8", () => {
    const latin = Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><a>ó</a>', "latin1")
    expect(decodificarRespuesta(latin, "text/xml")).toContain("<a>ó</a>")
    expect(decodificarRespuesta(Buffer.from("<a>ó</a>", "latin1"), "text/xml; charset=ISO-8859-1")).toBe("<a>ó</a>")
    expect(decodificarRespuesta(Buffer.from("<a>ó</a>", "utf8"), "text/xml")).toBe("<a>ó</a>")
  })

  test("enlace público de rastreo", () => {
    expect(urlRastreoPublico("709533700")).toBe("https://www.servientrega.com.ec/Tracking/?guia=709533700&tipo=GUIA")
  })
})
