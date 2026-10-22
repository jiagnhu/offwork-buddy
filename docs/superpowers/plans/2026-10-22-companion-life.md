# 安静的桌面伙伴 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付包含无声提醒、固定桌面待办、可解释工资、底部散步和轻量成长的 Windows 安装包。

**Architecture:** 保留主进程为状态和持久化唯一写入方，将桌面角色与固定信息卡拆为两个小窗口。提醒、成长和动作规划使用可测试纯函数，主进程仅负责时钟、鼠标、原生窗口和事件分发；计薪明细共享现有计算内核。按下面顺序完成，各阶段独立可验证，最后一起发布 1.2.0。

**Tech Stack:** 现有 Electron 45、React 19、TypeScript、Vite、Zod、decimal.js、Vitest、Playwright、electron-builder；不新增运行时依赖。

**Spec:** `docs/superpowers/specs/2026-10-22-companion-life-design.md`（用户已确认）。

## Global Constraints

- 「所有提醒均无声音」；应用内气泡，不调用系统通知和音频，不抢焦点。
- 「双屏不会自主跨屏」；角色只在当前显示器工作区底部活动，保留手动拖动与找回。
- 「角色窗口与信息卡窗口独立」，「不恢复累计金额或英文装饰标签」。
- 「工资算法本身不变」，「历史明细以保存的规则、排班快照、分母、金额为准」。
- 「计划完成与成长奖励放在同一次串行保存中」，旧工资、计划、偏好完整保留。
- 「已有减少动画设置优先」，隐藏、休眠停止行为；无高频磁盘写入。
- 原地停留 20–45 秒；行走 4–8 秒、80–160 DIP；脚底距工作区下沿约 12 DIP；鼠标距离 60 DIP 内停止，离开 2 秒后继续；手动拖动或叫回后停留 60 秒。
- 首次每日互动 +1；当天计划首次完成每项 +2，每天最多 5 项；无离线惩罚。10/30/60 点分别解锁星星、抱枕及其姿态、额外庆祝动作。
- 所有自动化测试使用独立临时数据，不操作用户已安装应用或真实工资记录。

## Review Focus

1. 导入旧备份不能伪造算法版本、修改旧金额或补发成长奖励——Task 1/2/3。
2. 主面板与桌面卡片并发勾选不能互相覆盖；取消、重启、删除再建不能绕过每日上限——Task 3/4。
3. 启动、睡眠恢复、时间回拨、调整作息不能堆积或重复提醒——Task 5。
4. 跨屏拖动、负坐标、混合 DPI、屏幕拔除、看板占满底边不能让角色消失或不断写盘——Task 6。
5. 已隐藏、减少动画或正在点待办时，后台动作和反馈不能强制显窗、抢焦点或继续走动——Task 4/5/6/7。

## 文件与接口地图

- `src/shared/model.ts`, `schema.ts`, `defaults.ts`, 新增 `migration.ts`：schema v2、默认值与兼容迁移。
- `src/core/earnings.ts`, 新增 `earnings-detail.ts`：统一金额分解与历史说明；`ledger.ts` 保存算法标签。
- 新增 `src/core/growth.ts`, `plans.ts`：奖励、解锁、按 ID 操作计划。
- 新增 `src/core/reminders.ts`：触发条件与去重；新增 `src/main/reminder-controller.ts` 驱动提醒。
- 新增 `src/core/companion-behavior.ts`：纯动作状态机；新增 `src/main/companion-controller.ts` 执行移动。
- `src/main/windows.ts`, `index.ts`, `ipc.ts`, `src/preload/index.ts`, `src/shared/bridge.ts`：窗口、受限 IPC 与串行提交集成。
- `src/renderer/App.tsx`, 新增 `pages/DesktopCard.tsx`, `components/EarningsDetail.tsx`, `pages/Growth.tsx`, `components/CompanionControls.tsx`：用户入口与界面。
- `src/renderer/pages/Companion.tsx`, `Calendar.tsx`, `Overview.tsx`, `Ledger.tsx`, `Settings.tsx`, `characters/*`：使用新接口和新状态；角色页面不再包含固定卡片。
- `src/main/store.ts`, `backup.ts`：迁移前原始备份、失败恢复及旧备份导入。

## Task 1: 安全迁移到 schema v2

**Files:** 修改上述 shared 文件、store、backup；新增 `tests/migration.test.ts`，扩展 `tests/store.test.ts`, `schema.test.ts`。

**Interfaces:**
- `parseState(input: unknown): State` 保持调用接口，返回 `schemaVersion: 2`。
- `migrateState(input: unknown): State`：验证 v1 再补默认值，拒绝未知未来版本；纯函数不写盘。v1 验证器与 v2 验证器放在 schema 模块，migration 只调用，不引入循环依赖。
- Preferences 新增 `movementMode: 'bottom'|'stationary'`, `cardHidden: boolean`, `cardPosition?: {x:number;y:number}`, `reminders: {lunch:boolean;offwork:boolean;leadMinutes:0|5|10}`, `accessory: 'none'|'star'|'pillow'`；旧 position 保留为角色稳定位置，新增 `displayId?: number` 仅作提示，失效时按位置选择屏幕。
- State 新增 `growth: {points:number;days:Record<DateKey,{interacted:boolean;rewardedPlanIds:string[];planRewardCount:number}>}`, `reminderHistory: Record<string,number>`（值为触发点毫秒）。保留历史奖励 ID，避免重建相同 ID 绕过限制。
- LedgerEntry 新增可选 `algorithm: 'normal-schedule-v1'`；v1 迁移不填算法标签。

- [ ] 写失败测试：v1 16000 月薪、84211 分历史记录和完成计划迁移后逐项不变；成长为 0；减少动画 true 保留；v2 导出再导入等价；未来版本拒绝。断言 `migrateState(v1).ledger[d].amountCents === 84211`、`growth.points === 0`。
- [ ] 运行 `npx vitest run tests/migration.test.ts tests/store.test.ts tests/schema.test.ts`，确认新行为缺失导致失败。
- [ ] 实现迁移与 Zod 约束。loadState 在迁移前保存只创建不覆盖的 `state.pre-v2.json` 原文；若备份不能创建，停止升级且保持原文件。备份恢复路径同样遵守；导入继续保留导入前用户数据，并保留所导入的原始 v1 内容。初始提醒 true/true/5、底部模式、配饰 none、空成长与去重历史。
- [ ] 测试只读目录迁移失败时原文件原文未变；运行上述命令和 `npm run typecheck`，预期通过；更新现有 fixture 到 v2 并保留独立 v1 fixture。
- [ ] 提交：`feat: migrate companion preferences and history safely`。

## Task 2: 工资计算明细与账本溯源

**Files:** core earnings/ledger、shared model/schema/bridge、main index、preload、三个收入页面；新增 earnings-detail.ts、EarningsDetail.tsx、`tests/earnings-detail.test.ts`, `tests/earnings-detail.spec.ts`。

**Interfaces:**
- `calculateDayDetail(date: DateKey, now: Date, rule: RuleVersion, calendar: CalendarData, overrides: Record<DateKey,boolean>): {progress: DayProgress; denominator: number|null; totalSeconds:number; elapsedSeconds:number; dailyBudgetDecimal:string; dayInfo:DayInfo}`；calculateDay 委托其 progress，避免两套公式。
- `explainLedger(entry: LedgerEntry): {amountCents:number; storedDenominator:number; normalDenominator:number; algorithm: 'normal-schedule-v1'|'historical'; differs:boolean}`。
- `getEarningsDetail(date: string): Promise<EarningsDetail>` IPC：主进程选历史快照或当天生效规则，拒绝无效日期；EarningsDetail 为带 `kind:'day'|'historical'|'unconfigured'` 的联合类型，字段由以上结果组成。
- `openPanel(target?: {page:'calendar';date:string}|{page:'earnings';date:string}|{page:'growth'}): Promise<void>`；主进程经 `onNavigate(listener)` 发送校验后的导航指令，渲染订阅 ready 后主进程保存的最后导航可读取一次，避免首次加载丢入口。已有无参数调用保持可用。

- [ ] 写失败测试：16000/24 完整日为 66667 分，3 日逐日和 200001 分；9:30–18:30 午休 12:00–13:30 总工时 27000 秒，12:00 已计 9000 秒；今日明细与实际 progress 相等。旧分母19记录显示84211且 differs true，分母24无标签仍为 historical。
- [ ] 运行 `npx vitest run tests/earnings-detail.test.ts`，确认失败。
- [ ] 抽取统一计算分解、新结算保存标签、实现明细弹窗和累计拆分；支持未配置、未入职、休息、日薪、时薪。现有重算入口可从历史差异提示到达，不自动执行。
- [ ] 增加 Electron 测试：点击今日金额打开公式、点击历史金额显示原值、关闭弹窗不改变账本。运行 `npm test`、`npm run typecheck`、`npm run build`、`npx playwright test tests/earnings-detail.spec.ts`，预期全部通过。
- [ ] 提交：`feat: explain daily and historical earnings`。

## Task 3: 按 ID 操作计划及原子成长奖励

**Files:** 新增 core plans/growth；修改 main index、shared bridge/model/schema、preload、Calendar；新增 `tests/growth.test.ts`, `tests/plans-actions.test.ts`。

**Interfaces:**
- `PlanAction = {type:'add';id:string;text:string}|{type:'complete';id:string;completed:boolean}|{type:'delete';id:string}`。
- `applyPlanAction(state:State,date:DateKey,action:PlanAction,now:Date): State`；只作用目标 ID，不整体替换他人更新；不存在的完成/删除目标返回明确错误。
- `updatePlan(date:string,action:PlanAction): Promise<Snapshot>` 替代界面 savePlans；删除旧整体写入 IPC，旧外部接口不作兼容承诺。
- `rewardInteraction(state:State,now:Date): State`, `unlocks(points:number): {star:boolean;pillow:boolean;celebration:boolean}`；`interact(): Promise<Snapshot>` IPC；反馈只有持久化成功后发出。
- `CompanionEvent = {id:string;kind:'interaction'|'plan-complete'|'reminder';text:string;createdAt:number;durationMs:number}`，共用受限 `onCompanionEvent` 订阅。主进程负责各类事件优先级和交互冷却。

- [ ] 写失败测试：当天首次互动1点；同日重复互动仍1；完成5个不同今日计划后11点；第6个不奖励；撤销重勾仍11；重启状态和删除再建不突破上限；过去/未来/导入已完成不奖励。并发请求完成 A/B 后两者皆完成。
- [ ] 运行 `npx vitest run tests/growth.test.ts tests/plans-actions.test.ts`，确认失败。
- [ ] 实现串行提交的 action 和成长，完成记录中的目标日期只接受有效 DateKey；接入日历，重复 complete(true) 幂等；奖励和计划同一 state 保存，失败不发成功动画。拒绝选择未解锁配饰，10/30/60 阈值由 unlocks 唯一计算。
- [ ] 测试保存失败无奖励、schema 拒绝负值和超每日5计数；运行 `npm test` 与类型检查，预期通过。
- [ ] 提交：`feat: update plans atomically with companion growth`。

## Task 4: 拆分桌面窗口与今日计划卡

**Files:** windows/index/preload/bridge、App、Companion、DesktopCard、CompanionControls、companion.css；修改原窗口测试，新增 `tests/desktop-card.spec.ts`。

**Interfaces:**
- windows 导出 panel、companion、desktopCard；角色路由 `#companion`，卡片 `#desktop-card`。测试根据确切路由选窗口，不再假定非 companion 就是主面板。
- `showCompanion(): void` 找回角色，并按 collapsed/cardHidden 恢复卡片；`hideCompanion(): void` 隐藏两者；`setCardHidden(hidden:boolean): Promise<Snapshot>`、`recallCompanion(): Promise<void>`；工具条区分隐藏卡片和隐藏整个伙伴。
- Snapshot 增加运行时 `desktop: {visible:boolean;paused:boolean}`，不持久化瞬时隐藏状态；主进程窗口事件及时广播；位置保存分别走各自 preference 字段。

- [ ] 写 Electron 失败测试：启动3窗口，角色移动不移动卡片；卡片勾选 A 与主面板勾选 B 后均完成；下一未完成项推进；展开/收起可用；空列表入口选中今天；所有完成显示成功文案。
- [ ] 运行 `npm run build` 与 `npx playwright test tests/desktop-card.spec.ts`，确认新入口不存在或窗口数不符导致失败。
- [ ] 拆分窗口并保持原有安全参数和紧凑 bounds。卡片独立拖动，不使用全屏透明层；缩放和小屏约束覆盖二者；显示/隐藏统一处理，金额点击使用 Task 2 导航。
- [ ] 回归隐藏恢复、旧位置迁移、缩放、暗色、减少动画、两窗保存失败；运行 `npm test`、类型检查、构建及全部 Electron 测试，预期通过。
- [ ] 提交：`feat: separate fixed daily card from desktop character`。

## Task 5: 静音提醒与统一气泡队列

**Files:** 新增 core reminders、main reminder-controller；修改 main index、Settings、Companion、DesktopCard；新增 `tests/reminders.test.ts`, `tests/reminders.spec.ts`。

**Interfaces:**
- `ReminderCandidate = {key:string;kind:'lunch-before'|'lunch-now'|'offwork-before'|'offwork-now';at:number;text:string}`。
- `dueReminders(state:State,previous:Date,now:Date): ReminderCandidate[]` 纯函数；返回 `(previous, now]` 跨越且延迟<=60000ms、未在 history 的候选。当天无规则、未入职、休息日不返回。
- `startReminderController(deps:{getState:()=>State;commit:(s:State)=>Promise<unknown>;isVisible:()=>boolean;emit:(event:CompanionEvent)=>void;now:()=>Date}): {resume():void;stop():void}`。启动 previous=now；resume 重新检查短延迟候选，绝不补播久远提醒；事件标记优先保存，保存失败使用内存去重并告警。

- [ ] 写失败测试：12:00午休，11:55仅提前提醒、12:00仅到点；18:30下班，18:25/18:30对应提醒；提前量0不重复生成提前事件；缺午休无午休事件；61秒延迟跳过、60秒允许；回拨、重启、同日反复开关不重发。
- [ ] 运行 `npx vitest run tests/reminders.test.ts`，确认失败。
- [ ] 实现主进程一次性调度、最近30天去重清理、隐藏事件标记跳过；气泡8秒可关闭，提醒优先于闲聊，完成反馈排队至提醒结束。设置暴露两个开关与提前量0/5/10。不创建 Notification、不使用 Audio 或系统蜂鸣。
- [ ] Electron 验证触发后当前焦点未变、整体隐藏后未显窗、卡片隐藏只角色提示；save失败不重复提示。运行 `npm test`、类型检查、构建与对应 spec，预期通过。
- [ ] 提交：`feat: add silent schedule reminders`。

## Task 6: 底部散步与用户接管

**Files:** 新增 core companion-behavior、main companion-controller；修改 windows、index、Settings、CompanionControls；新增 `tests/companion-behavior.test.ts`, `tests/roaming.spec.ts`。

**Interfaces:**
- `BehaviorState`：phase(idle/walking/resting/reacting/dragging/paused)、position、target、direction(left/right)、phaseUntil、lastTick、pointerLeftAt、manualHoldUntil；数值均为可注入时间戳。
- `BehaviorInput`：now、random(0..1)、workArea、windowSize、cardBounds|null、pointer、visible、suspended、reducedMotion、mode(bottom/stationary)、dragging、reactionUntil。几何类型复用 bounds.Rectangle。
- `stepBehavior(current:BehaviorState,input:BehaviorInput): BehaviorState`；`holdAt(position,now):BehaviorState` 设置60000ms停留。
- `startCompanionController(deps:{window:BrowserWindow;getInput:()=>BehaviorInput;publish:(state:BehaviorState)=>void}): {pause():void;resume():void;recall():void;stop():void}`；runtime Snapshot 新增 `behavior: {phase;direction}`，变化时广播，不每帧广播。

- [ ] 写失败测试固定随机源：行走4–8秒、80–160DIP，停留20–45秒；脚底12DIP；鼠标59DIP处停，离开1999ms仍停、2000ms可继续；手拖59999ms不归位、60000ms可开始归底。负坐标屏内所有路径合法；底边被卡片占满则原地等待；reducedMotion/hidden/suspended不变坐标。
- [ ] 运行 `npx vitest run tests/companion-behavior.test.ts`，确认失败。
- [ ] 实现纯状态机和分段路径；按优先级执行。工作区用窗口主要面积确定，移动过程中锁定活动屏；手动拖动跨屏才切换。大时间跳跃重新 idle，不跨屏瞬移。30Hz仅行走时开启，静止低频检查。用户拖动使用原生用户移动事件接管，自主setPosition不调用持久化；休眠和退出清理所有 timer。
- [ ] Electron 验证自主走动期间磁盘 state 不变、鼠标/拖动暂停、card bounds不变、隐藏不恢复、拔屏找回；断言计数 native setBounds/setAlwaysOnTop 不逐帧调用。运行 `npm test`、类型检查、构建与 roaming/movement 测试，预期通过。
- [ ] 提交：`feat: add controlled bottom-edge roaming`。

## Task 7: 角色动作、成长页面与配饰

**Files:** characters/types/Character/Pet/Assistant、companion.css、Growth、App、Settings；新增 `tests/growth-ui.spec.ts`。

**Interfaces:** CharacterProps 扩展 `pose:'idle'|'walk'|'sit'|'stretch'|'sleep'|'celebrate'|'pillow'`, `direction:'left'|'right'`, `accessory:'none'|'star'|'pillow'`。行为状态和事件决定姿态；业务奖励只在 Task 3 主进程发生。

- [ ] 写 Electron 失败测试：成长值9不可选星星、10可选；30可选抱枕并保留到重启；60显示额外庆祝；切换角色成长不变；reducedMotion 下动作循环关闭但气泡与解锁仍可见。
- [ ] 构建并运行 `npx playwright test tests/growth-ui.spec.ts`，确认失败。
- [ ] 为两种SVG实现姿态、方向与配饰，保持可点击范围一致；增加成长页和设置入口，展示数值、已解锁和下个阈值。按行为状态切换，提醒/交互冷却与队列复用 Task 5，不增加第二套计时奖励。
- [ ] 截图检查两角色的走路/坐下/抱枕、暗色、75%和125%缩放；运行 `npm test`、类型检查、构建与对应 Electron 测试，预期通过。
- [ ] 提交：`feat: add companion poses and unlockable accessories`。

## Task 8: 完整验收与可安装交付

**Files:** package.json/lock、README、版本展示、`docs/verification-1.2.0.md`、测试与安装配置（只在必要时修改）。

- [ ] 全链路验证：v1副本升级→保持旧金额→查看明细→桌面勾选→成长加分→底边散步→提醒暂停→隐藏/叫回→备份导入→重启，记录结果。独立 reviewer 检查迁移、奖励防重、窗口生命周期和提醒边界，修正重要发现。
- [ ] 执行 `npm test`、`npm run typecheck`、`npm run build`、`npm run test:e2e`；全部通过才记录完成。每个失败说明原因与修正，不以单项通过代替整套。
- [ ] 更新版本为1.2.0并构建 NSIS。沿用Node24 PATH、现有本地electronDist及已验证的构建缓存配置，不安装到用户账户。
- [ ] 使用 `BUDDY_EXECUTABLE=release/win-unpacked/下班搭子.exe` 再跑关键桌面流程；记录安装包路径、大小、SHA256、签名状态。
- [ ] 在实际可用环境下检查物理双屏拖动、DPI和睡眠恢复；不能实际操作的项目明确标注未验证，交付时请用户确认，不声称模拟覆盖实体操作。
- [ ] 更新使用说明：固定卡片、散步暂停/叫回、无声提醒设置、明细与历史重算区别、成长上限。提交源码及说明，保留用户旧数据与安装包。

## 自检与执行建议

- 已覆盖设计的五组功能、数据迁移、双屏稳定性和交付要求；每个模块提供明确输入输出与失败测试。
- Task 1 是共同基础；2/3 可独立验收；4统一窗口和事件入口；5/6/7依赖同一数据和窗口接口，按序执行减少冲突。
- 推荐延续本会话由主代理逐项实现，阶段测试后继续，最后做一次独立代码审查。若用户改选逐任务子代理审查，再使用 subagent-driven-development。
- 当前仅完成计划，未修改产品代码；计划经用户确认后才进入执行。
