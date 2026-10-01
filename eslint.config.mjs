import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

// eslint-config-next 16 ya exporta flat config: no hace falta FlatCompat.
const eslintConfig = defineConfig([
  globalIgnores([".next/**", "node_modules/**", "graphify-out/**", "next-env.d.ts"]),
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Temporal: los ~100 `any` se eliminan en la Fase 2 (Zod + Drizzle). Volver a "error" al terminarla.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Reglas nuevas del React Compiler (react-hooks v7, llegan con eslint-config-next 16).
      // Marcan patrones que ya existían (funciones declaradas después del useEffect que las
      // llama, setState síncrono en efectos, refs leídos en render). Quedan como warning
      // hasta corregir esos componentes en su propio PR.
      "react-hooks/immutability": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
])

export default eslintConfig
