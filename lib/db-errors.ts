import { NextResponse } from "next/server"

const MISSING_SCHEMA_CODES = new Set(["42P01", "42703", "42883", "PGRST200", "PGRST202", "PGRST204", "PGRST205"])

// True when a query failed because a table, column, or function from a pending migration does not exist yet.
export function isMissingSchema(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  if (error.code && MISSING_SCHEMA_CODES.has(error.code)) return true
  return /does not exist|could not find the (table|function|column)|schema cache/i.test(error.message ?? "")
}

export function migrationPending(feature: string) {
  return NextResponse.json(
    { error: `${feature} is not available yet: the database migration has not been applied.`, code: "migration_pending" },
    { status: 503 }
  )
}
