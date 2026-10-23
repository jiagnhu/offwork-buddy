# Desktop Chat Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 从桌面角色旁直接输入并阅读 AI 回复。
**Architecture:** 按需创建一个轻量聊天窗口，跟随角色定位；共享现有主进程聊天状态，不增加模型实例。
**Tech Stack:** Electron、React、TypeScript、Vitest、Playwright。
**Spec:** docs/superpowers/specs/2026-10-23-desktop-chat-design.md（用户已确认）

## Global Constraints
- 点击展开，关闭不取消请求，切角色沿用现有取消规则。
- 最多 2000 字，兼容中文输入；密钥入口仅主面板可用。
- 不更改工资或模型加载逻辑；测试使用模拟服务。

## Review Focus
- 负坐标显示器与小工作区：定位测试验证边界。
- 隐藏后收到回复：端到端验证不重新显示或抢焦点。
- 主面板和桌面同时发送：共享控制器保护仍有效。
- 拖动与缩放：浮窗跟随，原模型大小不变。
- 中文输入与切角色：组合输入不发送，草稿与回复不串角色。

### Task 1: 窗口与定位
- [x] 新增 tests/desktop-chat-position.test.ts：右侧空间足够、左侧回退、负坐标与小屏均在工作区内。
- [x] 运行测试确认缺少实现失败。
- [x] 新增 src/main/desktop-chat-position.ts，导出 desktopChatBounds(anchor, area) 返回矩形。
- [x] 在 windows.ts 按需创建 #desktop-chat 窗口，跟随移动、缩放、显示器变化；随角色隐藏，关闭仅隐藏。
- [x] bridge/preload/index 注册 openDesktopChat、closeDesktopChat；复用现有 IPC 来源验证。
- [x] 定位测试通过。

### Task 2: 聊天浮窗
- [x] 新增 tests/desktop-chat.spec.ts，模拟流服务验证展开、中文输入、流式回复、收起恢复、主面板同步、隐藏及角色切换。
- [x] 确认旧版本无法展开桌面聊天。
- [x] 新增 DesktopChat.tsx 与 desktop-chat.css，接入共享聊天状态，输入、停止、重试、草稿、Esc、滚动。
- [x] App.tsx/main.tsx 增加轻量浮窗路由，CompanionControls 改为展开浮窗。
- [x] 执行类型检查、单元测试和桌面聊天/原聊天回归；查看截图。

### Task 3: 交付
- [x] 更新版本与开发文档，构建开发版安装包。
- [x] 完成独立代码审查，修复实质问题；记录验证结果，提交实现。

## 执行记录
- 按用户已确认设计直接执行，由当前代理完成实现。

