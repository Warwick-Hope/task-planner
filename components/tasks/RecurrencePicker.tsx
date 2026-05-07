'use client'

import type { Frequency, RecurrenceOptions } from '@/lib/recurrence'

const WEEKDAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

interface Props {
  value: RecurrenceOptions
  onChange: (opts: RecurrenceOptions) => void
}

export default function RecurrencePicker({ value, onChange }: Props) {
  function set<K extends keyof RecurrenceOptions>(key: K, val: RecurrenceOptions[K]) {
    onChange({ ...value, [key]: val })
  }

  function toggleWeekday(i: number) {
    const current = value.weekdays ?? []
    const next = current.includes(i) ? current.filter(d => d !== i) : [...current, i].sort()
    set('weekdays', next)
  }

  return (
    <div className="space-y-3">
      {/* Frequency + interval */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-600">Every</span>
        <input
          type="number"
          min={1}
          max={99}
          value={value.interval}
          onChange={e => set('interval', Math.max(1, parseInt(e.target.value) || 1))}
          className="w-14 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 text-center focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={value.frequency}
          onChange={e => {
            const f = e.target.value as Frequency
            onChange({ ...value, frequency: f, weekdays: f === 'weekly' ? [0,1,2,3,4] : [] })
          }}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="daily">{value.interval === 1 ? 'day' : 'days'}</option>
          <option value="weekly">{value.interval === 1 ? 'week' : 'weeks'}</option>
          <option value="monthly">{value.interval === 1 ? 'month' : 'months'}</option>
          <option value="yearly">{value.interval === 1 ? 'year' : 'years'}</option>
        </select>
      </div>

      {/* Weekday selector (weekly only) */}
      {value.frequency === 'weekly' && (
        <div className="flex items-center gap-1">
          {WEEKDAY_LABELS.map((label, i) => {
            const active = (value.weekdays ?? []).includes(i)
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleWeekday(i)}
                className={`w-9 h-9 rounded-full text-xs font-medium transition-colors
                  ${active
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* End date */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Until</span>
        <input
          type="date"
          value={value.endDate ?? ''}
          onChange={e => set('endDate', e.target.value || null)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {value.endDate && (
          <button
            type="button"
            onClick={() => set('endDate', null)}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            clear
          </button>
        )}
        {!value.endDate && (
          <span className="text-xs text-gray-400">no end date</span>
        )}
      </div>
    </div>
  )
}
