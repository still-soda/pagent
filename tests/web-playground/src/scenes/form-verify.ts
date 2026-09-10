import { assert, assertEqual, fail, formatValue, pass } from '../oracle/checks'
import type { CheckOutcome } from '../oracle/types'

export interface FormSnapshot {
  submitted: {
    name: string
    email: string
    phone: string
    gender: string
    city: string
    role: string
    interests: string[]
    birthday: string
    arriveAt: string
    companions: number
    notify: boolean
    expectation: number
    budget: number
    note: string
  } | null
}

const EXPECTED = {
  name: '林晚晴',
  email: 'linwanqing@example.com',
  phone: '13912345678',
  gender: '女',
  city: '杭州',
  role: '设计',
  birthday: '1996-04-18',
  arriveAt: '14:30',
  companions: 3,
  notify: false,
  expectation: 5,
  budget: 600,
} as const

export function verifyForm(snapshot: FormSnapshot): CheckOutcome[] {
  const submitted = snapshot.submitted
  if (!submitted) {
    return [
      fail('submitted', '已提交报名', '已提交', '未提交'),
      fail('name', '姓名为林晚晴', EXPECTED.name, '未提交'),
      fail('email', '邮箱为 linwanqing@example.com', EXPECTED.email, '未提交'),
      fail('phone', '手机号为 13912345678', EXPECTED.phone, '未提交'),
      fail('profile', '城市杭州、岗位设计、性别女', '杭州 / 设计 / 女', '未提交'),
      fail('interests', '兴趣包含设计与产品', '设计、产品', '未提交'),
      fail('schedule', '出生日期 1996-04-18，到场 14:30', '1996-04-18 / 14:30', '未提交'),
      fail('companions', '同行 3 人且不接收通知', '3 / 否', '未提交'),
      fail('expectation', '期待程度 5 分，预算 600 元', '5 / 600', '未提交'),
      fail('note', '备注包含「素食」', '包含素食', '未提交'),
    ]
  }

  const interestOk =
    submitted.interests.includes('设计') && submitted.interests.includes('产品')

  return [
    pass('submitted', '已提交报名', '已提交'),
    assertEqual('name', '姓名为林晚晴', EXPECTED.name, submitted.name),
    assertEqual('email', '邮箱为 linwanqing@example.com', EXPECTED.email, submitted.email),
    assertEqual('phone', '手机号为 13912345678', EXPECTED.phone, submitted.phone),
    assert(
      'profile',
      '城市杭州、岗位设计、性别女',
      submitted.city === EXPECTED.city &&
        submitted.role === EXPECTED.role &&
        submitted.gender === EXPECTED.gender,
      '杭州 / 设计 / 女',
      `${submitted.city} / ${submitted.role} / ${submitted.gender}`,
    ),
    assert(
      'interests',
      '兴趣包含设计与产品',
      interestOk,
      '设计、产品',
      formatValue(submitted.interests),
    ),
    assert(
      'schedule',
      '出生日期 1996-04-18，到场 14:30',
      submitted.birthday === EXPECTED.birthday && submitted.arriveAt === EXPECTED.arriveAt,
      '1996-04-18 / 14:30',
      `${submitted.birthday} / ${submitted.arriveAt}`,
    ),
    assert(
      'companions',
      '同行 3 人且不接收通知',
      submitted.companions === EXPECTED.companions && submitted.notify === EXPECTED.notify,
      '3 / 否',
      `${submitted.companions} / ${formatValue(submitted.notify)}`,
    ),
    assert(
      'expectation',
      '期待程度 5 分，预算 600 元',
      submitted.expectation === EXPECTED.expectation && submitted.budget === EXPECTED.budget,
      '5 / 600',
      `${submitted.expectation} / ${submitted.budget}`,
    ),
    assert('note', '备注包含「素食」', submitted.note.includes('素食'), '包含素食', submitted.note || '无'),
  ]
}
