import type { PostgrestError } from "@supabase/supabase-js"

// PostgREST caps every response at 1000 rows, so whole-table reads must walk the pages.
export const PAGE_SIZE = 1000
const MAX_PAGES = 40

type PageResult<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>

export class QueryError extends Error {
  constructor(readonly cause: PostgrestError) {
    super(cause.message)
  }
}

// page(from, to) must apply a stable order (ideally on a unique column) before .range(from, to).
export async function fetchAllRows<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = []
  for (let index = 0; index < MAX_PAGES; index++) {
    const from = index * PAGE_SIZE
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new QueryError(error)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  return rows
}

// Rows inserted while paging can shift a page boundary and repeat a row: keep the first copy of each id.
export function uniqueBy<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Set<string>()
  return rows.filter((row) => {
    const id = key(row)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}
