# 下班搭子 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付具有精致双角色、置顶信息卡、排班识别和可靠收入累计的 Windows Electron 安装包。

**Architecture:** Electron 主进程统一管理本地数据、窗口和结算，通过类型化 preload 桥连接 React 界面。日期、排班、工资和账本为纯函数模块，界面共享主进程发布的快照。角色资源本地打包，核心功能无需联网。

**Tech Stack:** Electron、React、TypeScript、Vite、Vitest、Playwright Electron、electron-builder、decimal.js、Zod。执行时核对官方文档和 Node 兼容性并锁定依赖版本；当前 Node 为 20.20.2。

**Spec:** `docs/superpowers/specs/2026-10-21-desktop-companion-design.md`（用户已于 2026-10-21 批准）。

## Global Constraints

- 用户明确优先选择视觉和交互效果，不以安装包体积最小化为目标。
- 默认时区为 Asia/Shanghai。
- 日期优先级：用户对某日的手动指定 > 已导入的官方节假日/调休记录 > 每周排班。
- 工资与作息修改默认次日生效，保留历史版本。
- 历史结算默认冻结；用户主动选择重算历史时展示日期范围与覆盖含义，确认后才重算。
- 启用 contextIsolation，关闭渲染层 Node 集成，不加载远程网页内容。
- 数据写入 Electron userData 目录。
- 使用 electron-builder 生成 Windows x64 NSIS 安装包，支持用户级安装和桌面快捷方式。
- 第一版采用固定原创角色和预设动作，不含实时对话、语音、Live2D 模型导入或角色商城。

## Review Focus

1. 非上海系统时区与跨年日期：上海零点正确切日，大小周不随年份重置（任务 1）。
2. 同日重复修改工资：明日版本更新不生成冲突版本，今日和历史金额不变（任务 2）。
3. 写盘中断或主文件损坏：保留原始证据和有效备份，界面显示恢复或保存错误（任务 3）。
4. 副显示器移除或 DPI 改变：角色仍可见，按钮可点击（任务 4、7）。
5. 导入不受信任 JSON：拒绝无效日期、非有限金额、未知版本和重复记录，原数据不变（任务 3、5）。

## 文件与契约

- `src/shared/model.ts`：DateKey 为 YYYY-MM-DD 字符串；RuleVersion 包含 id、effectiveFrom、工资模式与金额字符串、上下班/午休分钟数、排班模式、单休日、大周周一和官方覆盖开关。
- `src/shared/schema.ts`：Zod 校验结构与跨字段约束；State 包含 schemaVersion:1、configured、startDate、rules、calendar、overrides、ledger、preferences。LedgerEntry 包含 date、ruleId、workday、amountCents（安全整数）和结算时使用的完整规则与日历快照。
- `src/core/`：日期、排班、工资、结算；以显式传入 now 为准，不在函数内部读取系统时间。
- `src/main/`：Electron 生命周期、文件存储、窗口和 IPC；`src/preload/index.ts`：窄范围桥；`src/shared/bridge.ts`：参数和返回值类型。
- `src/renderer/`：App、页面、组件、主题与两个角色；`resources/`：图标、年度日历。
- `tests/`：单元和 Electron 集成测试；`docs/verification.md`：真实验证结果；`README.md`：运行、构建、备份和日历格式。

## Task 1: 可验证的日期与排班引擎

**Files:** 创建 `package.json`、`tsconfig.json`、`vite.config.ts`、`vitest.config.ts`、`.gitignore`、`src/shared/model.ts`、`src/shared/schema.ts`、`src/core/date.ts`、`src/core/calendar.ts`、`tests/calendar.test.ts`。

**Interfaces:** `dateKey(now: Date, zone?: string): DateKey`；`resolveDay(date: DateKey, rule: RuleVersion, calendar: CalendarData, overrides: Record<DateKey, boolean>): DayInfo`，返回 workday、source、calendarMissing；`countWorkdays(month: string, rule: RuleVersion, calendar: CalendarData, overrides: Record<DateKey, boolean>): number`。CalendarData 按年份保存来源、更新时间及日期布尔映射，true 为工作日。

- [ ] 建立工具配置与 npm scripts：test、typecheck、dev、build、test:e2e、dist；依赖选型核对官方资料并写入 lockfile。
- [ ] 在 `tests/calendar.test.ts` 写失败用例：`expect(dateKey(new Date('2026-10-20T16:00:00Z'))).toBe('2026-10-21')`；大周锚点 2026-12-28 时 2027-01-02 为工作日、2027-01-09 为休息日；手动 false 覆盖官方 true；缺失年份 calendarMissing 为 true；关闭官方覆盖后使用周排班。
- [ ] 运行 `npm test -- tests/calendar.test.ts`，确认因未实现接口失败。
- [ ] 实现上述接口、严格日期校验及分钟区间校验；以自然日差除以 7 判断大小周，支持锚点之前的日期。
- [ ] 再运行该测试与 `npm run typecheck`，预期全部通过，提交 `feat: add calendar and schedule engine`。

## Task 2: 工资进度与幂等结算

**Files:** 创建 `src/core/earnings.ts`、`src/core/ledger.ts`、`tests/earnings.test.ts`、`tests/ledger.test.ts`。

**Interfaces:** 消费任务 1 类型与日历函数。提供 `calculateDay(date: DateKey, now: Date, rule: RuleVersion, calendar: CalendarData, overrides: Record<DateKey, boolean>): DayProgress`（status、countdownSeconds、earnedCents、budgetCents）；`settleThrough(state: State, now: Date): State`；`scheduleRule(state: State, input: RuleInput, now: Date): State`；`recalculateRange(state: State, from: DateKey, to: DateKey, now: Date): State`。历史重算使用对应日期生效规则与当前日历，之后冻结结果。

- [ ] 写失败测试：09–18 点、12–13 午休、日薪 800 元在 12 点和 13 点都为 30000 分，18 点为 80000 分；时薪 100 元全天 80000 分；月薪 22000 元、22 个工作日预算 100000 分；零工作日不除零；休息日为零。
- [ ] 增加账本测试：同一 now 两次结算结果深度相等；跨 3 个日期只补缺失日期；今天不进入历史账本；同日修改两次仅保留一个明日版本；时钟回退不删除旧账；历史修改只在显式重算后生效；累计等于账本总和加今日进度。
- [ ] 运行 `npm test -- tests/earnings.test.ts tests/ledger.test.ts`，确认失败。
- [ ] 使用 decimal.js 做计算并在展示/结算时转分；实现日期版本选择、补算、重算和状态转换。无配置时返回待设置结果；月中变更月薪按各自版本计算该日预算，不声称两种月薪混合月份总额等于某一整月月薪。
- [ ] 运行两个测试文件和类型检查，通过后提交 `feat: add income progress and durable daily ledger`。

## Task 3: 本地持久化与恢复

**Files:** 创建 `src/main/store.ts`、`src/main/backup.ts`、`tests/store.test.ts`、`tests/schema.test.ts`；完善 `src/shared/schema.ts`。

**Interfaces:** `loadState(directory: string): Promise<LoadResult>`（state、可选 recoveryNotice）；`saveState(directory: string, state: State): Promise<void>`；`validateBackup(input: unknown): State`；`importBackup(directory: string, input: unknown): Promise<State>`。主进程串行执行写入，load 不静默覆盖坏文件。

- [ ] 写失败测试：保存后重读等价；主文件损坏时从有效备份恢复且保留坏文件；模拟 rename 失败仍可读取旧数据；未知 schemaVersion、2026-02-30、负金额、非有限值、重复日期和大于安全整数金额拒绝导入；导入失败原数据不变。
- [ ] 运行 `npm test -- tests/store.test.ts tests/schema.test.ts` 确认失败。
- [ ] 实现临时文件、有效备份、串行写入和完整状态校验；首次无文件生成未配置状态，恢复失败返回显式错误。校验时间为同日区间，午休须完全在班次内且小于班次，锚点须周一。
- [ ] 测试全部通过并运行类型检查，提交 `feat: persist and recover local user data`。

## Task 4: Electron 桌面生命周期与双窗口

**Files:** 创建 `src/main/index.ts`、`src/main/windows.ts`、`src/main/ipc.ts`、`src/preload/index.ts`、`src/shared/bridge.ts`、`src/renderer/index.html`、`src/renderer/main.tsx`、`resources/tray.png`、`tests/window-bounds.test.ts`、`tests/electron.spec.ts`。

**Interfaces:** 桥提供 `getSnapshot()`、`saveSettings(input)`、`setPreferences(input)`、`setDayOverride(date,value)`、`recalculate(from,to)`、`exportBackup()`、`importBackup()`、`importCalendar()`、`openPanel()`、`hideCompanion()` 和 `onSnapshot(listener)`（返回取消订阅函数）。请求均返回 Promise，失败含可展示错误；文件路径由主进程原生对话框决定。Snapshot 包含 State、DayProgress、settledCents、totalCents、notice。`clampBounds(bounds: Rectangle, workAreas: Rectangle[]): Rectangle` 单独导出测试。

- [ ] 写边界测试：已移除副屏上的窗口返回主屏工作区；大于屏幕的尺寸收缩后仍可见。写 Electron 冒烟测试断言主面板与伙伴窗口存在、渲染器 `typeof require` 为 undefined、置顶切换实际改变 BrowserWindow 状态。
- [ ] 运行单元和 Electron 测试，确认尚未实现时失败。
- [ ] 实现单实例锁、透明无边框伙伴、独立主面板、托盘菜单、关闭隐藏、显式退出、默认关闭的开机启动、位置保存和移屏恢复。IPC 逐项验证来源和输入，禁止任意文件/命令执行；设置修改后广播快照，恢复休眠和按秒刷新时重算，只有结算/设置变化时落盘。
- [ ] 执行 `npm test -- tests/window-bounds.test.ts`、`npm run test:e2e` 和类型检查，确认通过，提交 `feat: add desktop windows tray and secure bridge`。

## Task 5: 精致主面板与可操作设置

**Files:** 创建 `src/renderer/App.tsx`、`src/renderer/styles/theme.css`、`src/renderer/pages/{Overview,Calendar,Ledger,Settings,Onboarding}.tsx`、`src/renderer/components/{Navigation,StatCard,ConfirmDialog,Notice}.tsx`、`src/renderer/hooks/useSnapshot.ts`；扩展 `tests/electron.spec.ts`。

**Interfaces:** 消费任务 4 桥与快照；组件只渲染与收集输入，不独立计算账本。设置区区分立即生效的外观与明日生效的工资/作息。

- [ ] 增加失败集成测试：首次显示待设置；填写日薪和作息后概览更新；无效午休显示错误且不保存；取消历史重算无变化；导入损坏文件出现错误且累计不变；设置重启后保留。
- [ ] 运行集成测试确认失败。
- [ ] 实现首启引导、导航、收入主卡、日历格、按月账本和完整设置。提供单双休/大小周、起始日期、日期覆盖、官方覆盖开关、角色/主题/动画/比例/置顶/自启控制；导入和历史重算展示范围确认，错误在相关表单附近显示。使用统一主题 token、清晰数字排版、状态提示与键盘焦点；收起/窄尺寸时避免溢出。
- [ ] 运行集成测试、类型检查和生产构建；检查两种主题在 960×720 和 1280×900 下的截图，修复遮挡后提交 `feat: add polished dashboard and settings`。

## Task 6: 双角色与悬浮卡

**Files:** 创建 `src/renderer/pages/Companion.tsx`、`src/renderer/characters/{Pet,Assistant}.tsx`、`src/renderer/styles/companion.css`、`src/renderer/components/CountdownCard.tsx`；扩展 `tests/electron.spec.ts`。

**Interfaces:** `Pet` 和 `Assistant` 均消费 `{status: DayProgress['status'], reducedMotion: boolean, onInteract: () => void}`；Companion 消费现有快照和 setPreferences，角色切换后保持窗口位置。

- [ ] 增加失败集成测试：切换两个角色、收起卡片、改变比例和减少动画设置，重启后保留；减少动画时角色不持续播放动画。
- [ ] 运行集成测试确认失败。
- [ ] 绘制原创本地分层 SVG 萌宠和看板娘；实现眨眼、呼吸、摆动、点击反馈及上下班提示气泡。提供专用拖动区域，将按钮与交互区域设为不可拖动；根据角色/比例和卡片状态调整窗口边界。视觉上让卡片与角色成为统一构图。
- [ ] 运行集成测试并实际检查透明边缘、拖动、点击、两主题及 75%/100%/125% 比例，保存截图；修复问题后提交 `feat: add animated desktop companions`。

## Task 7: 官方日历、安装包与交付验证

**Files:** 创建 `resources/calendar/2026.json`、`electron-builder.yml`、`resources/icon.ico`、`README.md`、`docs/verification.md`、`tests/calendar-data.test.ts`；更新 package scripts 和日历加载入口。

**Interfaces:** 内置年度数据与 importCalendar 使用任务 1 的 CalendarData 格式；年度 JSON 带官方来源链接及更新时间，仅覆盖明确发布的日期。

- [ ] 浏览中国政府官方网站查证 2026 年节假日及调休安排；若执行时已有下一年官方安排可一并加入，未发布则保留缺失提示。逐条核对工作日/休息日，不依赖第三方猜测。
- [ ] 创建数据校验测试：所有键属于声明年份、日期有效、来源为官方页面；从已查证安排选择至少一组放假日与补班日，断言 resolveDay 得到对应布尔值。
- [ ] 加入已核对数据，运行 `npm test`、`npm run typecheck`、`npm run test:e2e`、`npm run build`，全部通过后构建 `npm run dist`，生成用户级 NSIS 安装包。
- [ ] 用独立测试 userData 启动打包应用验证首启、托盘、重启持久化、置顶、离线资源；在支持的控制工具下检查 DPI 和屏幕工作区。测试数据不得写入用户正式账本。若某项真实设备检查无法执行，在验证文档明确记录，不能声称已通过。
- [ ] 验证安装器输出存在且可启动；记录安装包路径、大小、SHA256、未签名状态和执行过的测试。README 写明工资估算口径、未来日历更新、备份格式、运行/构建步骤。交付安装包链接，提交 `build: package Windows companion and document verification`。

## 自检与执行交接

设计的角色、窗口、作息、工资、日历、离线持久化和安装包分别对应以上任务，五项 Review Focus 均有对应测试。先完成任务 1–4 的可靠核心，再完成任务 5–6 的视觉和交互，最后以任务 7 的真实打包验证收口。

推荐本会话顺序执行：接口依赖紧密，由当前助手连续实现减少交接，完成后做一次独立整体审查。另一选择是逐任务由子代理实施及独立审查，检查更频繁，但消耗更多上下文。等待用户审阅计划并选择执行方式后开始产品实现。
