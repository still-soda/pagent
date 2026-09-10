import { describe, expect, it } from 'vitest'
import { verifyPreferences, type PreferenceSnapshot } from './preferences-verify'

const complete: PreferenceSnapshot = {
  language: 'English',
  theme: '深色',
  timezone: 'GMT+9 东京',
  notifyProduct: false,
  notifyMarketing: true,
  notifyWeekly: false,
  quietStart: '23:00',
  quietEnd: '07:00',
  digestDay: '每周一',
  verifyState: 'ok',
  deviceLocations: ['上海', '杭州'],
  labEnabled: true,
  autoSummary: true,
  saved: true,
  logTimes: ['09-06 11:20', '09-02 20:03'],
}

describe('verifyPreferences', () => {
  it('passes a complete matching snapshot', () => {
    const outcomes = verifyPreferences(complete)
    expect(outcomes.filter((item) => item.status === 'fail')).toEqual([])
    expect(outcomes.find((item) => item.id === 'logs')?.status).toBe('pass')
  })

  it('marks 09-02 logs unknown when they were never loaded', () => {
    const outcomes = verifyPreferences({ ...complete, logTimes: ['09-06 11:20'] })
    expect(outcomes.find((item) => item.id === 'logs')?.status).toBe('unknown')
  })

  it('fails when the Beijing device is still online', () => {
    const outcomes = verifyPreferences({
      ...complete,
      deviceLocations: ['上海', '北京'],
    })
    expect(outcomes.find((item) => item.id === 'device')?.status).toBe('fail')
  })
})
