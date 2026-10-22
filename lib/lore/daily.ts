export interface DailyQuote {
  title: string
  body: (username: string) => string
  dismiss: string
}

export const DAILY_STIPEND = 5
