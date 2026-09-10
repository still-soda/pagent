import { describe, expect, it } from 'vitest'
import { verifyForm, type FormSnapshot } from './form-verify'

const complete: NonNullable<FormSnapshot['submitted']> = {
  name: '林晚晴',
  email: 'linwanqing@example.com',
  phone: '13912345678',
  gender: '女',
  city: '杭州',
  role: '设计',
  interests: ['设计', '产品'],
  birthday: '1996-04-18',
  arriveAt: '14:30',
  companions: 3,
  notify: false,
  expectation: 5,
  budget: 600,
  note: '素食餐食',
}

describe('verifyForm', () => {
  it('fails every check when the form was not submitted', () => {
    const outcomes = verifyForm({ submitted: null })
    expect(outcomes.every((item) => item.status === 'fail')).toBe(true)
    expect(outcomes[0]?.id).toBe('submitted')
  })

  it('passes a complete matching submission', () => {
    const outcomes = verifyForm({ submitted: complete })
    expect(outcomes.every((item) => item.status === 'pass')).toBe(true)
  })

  it('allows extra interests as long as 设计 and 产品 are present', () => {
    const outcomes = verifyForm({
      submitted: { ...complete, interests: ['前端', '设计', '产品'] },
    })
    expect(outcomes.find((item) => item.id === 'interests')?.status).toBe('pass')
  })

  it('fails when the note does not mention 素食', () => {
    const outcomes = verifyForm({ submitted: { ...complete, note: '靠窗' } })
    expect(outcomes.find((item) => item.id === 'note')?.status).toBe('fail')
  })
})
