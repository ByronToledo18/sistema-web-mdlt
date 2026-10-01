import { neon } from "@neondatabase/serverless"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set")
}

export const sql = neon(process.env.DATABASE_URL)

export async function executeQuery(queryText: string, params: any[]) {
  try {
    const result: any = await sql.query(queryText, params)

    if (Array.isArray(result)) {
      return result
    } else if (result && "rows" in result) {
      return result.rows
    } else {
      return []
    }
  } catch (error) {
    console.error("[v0] Database query error:", error)
    throw error
  }
}
