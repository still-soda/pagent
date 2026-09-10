import { assert, assertEqual, unknown } from '../oracle/checks'
import type { CheckOutcome } from '../oracle/types'

export interface PreferenceSnapshot {
  language: string
  theme: string
  timezone: string
  notifyProduct: boolean
  notifyMarketing: boolean
  notifyWeekly: boolean
  quietStart: string
  quietEnd: string
  digestDay: string
  verifyState: 'idle' | 'ok' | 'error'
  deviceLocations: string[]
  labEnabled: boolean
  autoSummary: boolean
  saved: boolean
  logTimes: string[]
}

export function verifyPreferences(snapshot: PreferenceSnapshot): CheckOutcome[] {
  const notifyOk =
    !snapshot.notifyProduct && snapshot.notifyMarketing && !snapshot.notifyWeekly
  const beijingOnline = snapshot.deviceLocations.some((location) => location.includes('北京'))
  const sawSept2 = snapshot.logTimes.some((time) => time.startsWith('09-02'))

  return [
    assertEqual('language', '界面语言为 English', 'English', snapshot.language),
    assertEqual('theme', '主题为深色', '深色', snapshot.theme),
    assert(
      'timezone',
      '时区为东京时间',
      snapshot.timezone.includes('东京'),
      'GMT+9 东京',
      snapshot.timezone,
    ),
    assert(
      'notify',
      '通知仅保留营销活动',
      notifyOk,
      '产品关 / 营销开 / 每周摘要关',
      `产品${snapshot.notifyProduct ? '开' : '关'} / 营销${snapshot.notifyMarketing ? '开' : '关'} / 每周摘要${snapshot.notifyWeekly ? '开' : '关'}`,
    ),
    assert(
      'quiet',
      '静默时段 23:00 至 07:00',
      snapshot.quietStart === '23:00' && snapshot.quietEnd === '07:00',
      '23:00 / 07:00',
      `${snapshot.quietStart} / ${snapshot.quietEnd}`,
    ),
    assertEqual('digest', '摘要推送改为每周一', '每周一', snapshot.digestDay),
    assertEqual('verify', '完成一次安全验证', 'ok', snapshot.verifyState),
    assert(
      'device',
      '已下线北京登录设备',
      !beijingOnline,
      '无北京设备',
      beijingOnline ? snapshot.deviceLocations.join('、') : '无北京设备',
    ),
    assert(
      'lab',
      '已开启实验功能「自动摘要」',
      snapshot.labEnabled && snapshot.autoSummary,
      '实验功能已开启且自动摘要打开',
      `实验功能${snapshot.labEnabled ? '已开启' : '未开启'} / 自动摘要${snapshot.autoSummary ? '开' : '关'}`,
    ),
    sawSept2
      ? assert('logs', '已加载 09-02 账户操作记录', true, undefined, '日志已包含 09-02')
      : unknown('logs', '汇报 09-02 的账户操作记录', '口头汇报无法由页面判定；日志尚未加载到该日'),
    assert('saved', '已保存以上设置', snapshot.saved, '已保存', snapshot.saved ? '已保存' : '未保存'),
  ]
}
