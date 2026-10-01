import type * as Sentry from "@sentry/nextjs"

type DataCollection = NonNullable<Parameters<typeof Sentry.init>[0]["dataCollection"]>

// Opciones comunes a server, edge y cliente. Por defecto el SDK v11 envía
// bodies, cookies, headers y datos de consultas; aquí van contraseñas (login,
// registro, reset), el JWT en cookie y datos de clientes, así que todo eso se
// desactiva y solo se manda el error con su stack.
export const dataCollection: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  stackFrameVariables: false,
  genAI: { inputs: false, outputs: false },
}

export const tracesSampleRate = 0.1
