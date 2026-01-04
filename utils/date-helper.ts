// Helper to handle date logic for Pick Dates
// Assumes Asia/Taipei timezone context

export interface DateInfo {
  dateStr: string // YYYY-MM-DD
  dayName: string // (六), (日) etc
  isWeekend: boolean
  isHoliday: boolean
  holidayName?: string
}

export interface HolidayData {
  date: string // YYYY-MM-DD or YYYY/MM/DD
  name: string
  isHoliday: boolean
}

// Weekday names in Chinese
const WEEKDAYS = ['(日)', '(一)', '(二)', '(三)', '(四)', '(五)', '(六)']

export function getNextMonthTargets(holidays: HolidayData[] = []): DateInfo[] {
  // 1. Determine Next Month
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-11

  // Next month calculation
  let targetYear = year
  let targetMonth = month + 1
  if (targetMonth > 11) {
    targetYear++
    targetMonth = 0
  }

  const targets: DateInfo[] = []

  // 2. Iterate Days
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate()

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(targetYear, targetMonth, d)
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // Check Holiday
    // Format YYYY-MM-DD
    const dateStr = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    // Holiday data might be YYYY/MM/DD or YYYY-MM-DD, sanitize
    const holiday = holidays.find(h => {
      const hDate = h.date.replace(/\//g, '-')
      return hDate === dateStr && h.isHoliday
    })

    const isHoliday = !!holiday

    if (isWeekend || isHoliday) {
      targets.push({
        dateStr,
        dayName: WEEKDAYS[dayOfWeek] || '',
        isWeekend,
        isHoliday,
        holidayName: holiday?.name
      })
    }
  }

  return targets
}

export function getVotingPeriodStatus(now = new Date(), startDay = 24, endDay = 30): 'OPEN' | 'CLOSED' {
  const day = now.getDate()
  const start = Number(startDay)
  const end = Number(endDay)

  // Rules: Custom range (Inclusive)
  // Handle crossing month boundary? e.g. 25 - 5
  if (start <= end) {
    if (day >= start && day <= end) return 'OPEN'
  } else {
    // Cross month, e.g. 25 to 5
    // Open if day >= 25 OR day <= 5
    if (day >= start || day <= end) return 'OPEN'
  }

  return 'CLOSED'
}
