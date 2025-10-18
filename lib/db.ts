import { neon } from "@neondatabase/serverless"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set")
}

export const sql = neon(process.env.DATABASE_URL)

export async function executeQuery(queryText: string, params: any[]) {
  try {
    console.log("[v0] Executing query:", queryText)
    console.log("[v0] With params:", params)

    const result = await sql.query(queryText, params)
    console.log("[v0] Query result type:", typeof result)
    console.log("[v0] Query result is array:", Array.isArray(result))
    console.log("[v0] Query result has rows:", result && "rows" in result)

    if (Array.isArray(result)) {
      console.log("[v0] Returning array directly, length:", result.length)
      return result
    } else if (result && "rows" in result) {
      console.log("[v0] Returning result.rows, length:", result.rows.length)
      return result.rows
    } else {
      console.log("[v0] Unexpected result format:", result)
      return []
    }
  } catch (error) {
    console.error("[v0] Database query error:", error)
    throw error
  }
}
