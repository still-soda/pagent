export const USAGE_TOPICS = [
  'overview',
  'workflow',
  'list_tabs',
  'dispatch_task',
  'get_session',
  'collaboration',
] as const;

export type UsageTopic = (typeof USAGE_TOPICS)[number];

const SECTIONS: Record<UsageTopic, string> = {
  overview: `你是本地 Agent；Pagent 是跑在用户浏览器里的页面 Agent。
你负责拆任务、选标签页、决定何时派发、根据会话结果继续推理。
Pagent 负责打开网页、观察 DOM、点击、输入、滚动、导航。不要自己去“猜页面长什么样”，把浏览操作交给 Pagent。

可用工具：
- get_usage：查询本服务的用法（本工具）。Pagent 扩展未连接时也能调用。
- list_tabs：查看全部标签页，以及是否已有 Agent 在该页工作。
- dispatch_task：向某个标签页派发任务。立即返回 sessionId，不等待任务完成。
- get_session：按 sessionId / tabId / conversationId 查看进度、思考、最近消息。

先 list_tabs，再 dispatch_task，再轮询 get_session。不确定协议时先 get_usage。`,

  collaboration: `分工：
- 本地 Agent：规划、选择目标页、撰写给 Pagent 的 prompt、根据 get_session 的结果做下一步决策。
- Pagent：在真实标签页里操作网页。同一标签页同一时刻只有一个 Agent 在跑；再次 dispatch_task 会打断当前任务。

协作原则：
1. 不要对 agent.working = true 的标签页派发，除非你就是要打断它。
2. 不要对 protected = true 的标签页派发（chrome://、扩展页等受保护页面）。
3. prompt 写成 Pagent 能直接执行的页面操作，避免空泛的“帮我处理一下”。
4. dispatch_task 成功只代表“已接手”，不代表网页任务完成。用 get_session 看到 running = false 再下结论。
5. 需要接着同一段对话时，把上次返回的 conversationId 传回 dispatch_task；省略则会新建会话。
6. 扩展未连接时，list_tabs / dispatch_task / get_session 会失败。此时只能 get_usage；请提示用户打开浏览器并加载 Pagent 扩展。`,

  workflow: `推荐流程：
1. list_tabs，记录 tabId、url、title、protected、agent.working、agent.sessionId。
2. 选定目标：
   - 已有合适标签页：dispatch_task({ prompt, tabId })
   - 需要打开新地址：dispatch_task({ prompt, url })  （会新建标签页）
   - 已有标签页要先跳转：dispatch_task({ prompt, tabId, url })
   - 都不传：派到当前活动标签页
3. 保存返回的 tabId、sessionId、conversationId。
4. 隔几秒调用 get_session({ sessionId })：
   - running = true：仍在工作，可读 thinking / tasks / messages 判断是否卡住
   - running = false 且 found = true：本轮结束，根据 messages 和 error 决定是否再派发
   - found = false：会话已不可见（标签页可能关了），重新 list_tabs
5. 同一站点的后续步骤，带上 conversationId 继续，而不是每次都开新会话。`,

  list_tabs: `list_tabs()
无参数。返回 { tabs: HostTab[] }。

HostTab 关键字段：
- tabId, title, url, active, windowId, status, pinned
- protected：true 时无法注入 Agent，不能派发
- agent.working：该页是否有 Agent 正在跑
- agent.sessionId / conversationId / title / thinking / error：最近一次会话摘要

用法：选目标页、避开冲突、发现可续上的 sessionId。`,

  dispatch_task: `dispatch_task({ prompt, tabId?, url?, conversationId? })
立即启动 Pagent，不等待页面任务完成。

参数：
- prompt（必填）：交给 Pagent 的任务。写具体操作和成功标准。
- tabId：已有标签页。省略且无 url 时用当前活动标签页。
- url：无 tabId 时新建并打开；与 tabId 同时出现则先导航再执行。
- conversationId：续上已有会话；省略则新建。

成功返回：{ ok: true, tabId, sessionId, conversationId }

注意：
- 对正在工作的标签页再派发会打断旧任务。
- 受保护页面、非法 URL、扩展未连接会失败。
- 拿到 sessionId 后用 get_session 跟踪，不要假设已经做完。`,

  get_session: `get_session({ sessionId?, tabId?, conversationId? })
至少提供一个查询键，多个同时给时按 AND 匹配。

返回：
- found / running
- tabId, url, title
- sessionId, conversationId, conversationTitle
- thinking, error, updatedAt, budget
- tasks[]：Pagent 内部步骤
- messages[]：最近至多 8 条（内容截断）

running = true 表示仍在跑；false 且 found = true 表示本轮已结束。
优先用 dispatch_task 返回的 sessionId 查询。`,
};

const ORDER: UsageTopic[] = [
  'overview',
  'collaboration',
  'workflow',
  'list_tabs',
  'dispatch_task',
  'get_session',
];

export function getUsageGuide(topic?: UsageTopic): string {
  if (topic) {
    return `# ${topic}\n\n${SECTIONS[topic].trim()}`;
  }
  return [
    '# Pagent MCP 用法',
    '',
    `可按 topic 查询某一段：${USAGE_TOPICS.join(', ')}。省略 topic 返回全文。`,
    '',
    ...ORDER.flatMap((name) => [`## ${name}`, '', SECTIONS[name].trim(), '']),
  ].join('\n');
}
