# 文字聊天开发与百炼接入

首版无需账号。客户端只访问本机产品聊天服务，不向用户提供模型配置，也不内置供应商密钥。服务端为独立开发进程，不包含在 Electron 安装包内。

## 启动

在项目目录，用本机开发环境设置以下环境变量（不要把密钥写进源码、截图或聊天）：

- `DASHSCOPE_API_KEY`：百炼 API Key。
- `BAILIAN_BASE_URL`：与该 Key 和地域匹配的官方 OpenAI 兼容 API 基址，以 `/compatible-mode/v1` 结尾。使用百炼控制台提供的实际地址，不加 `/chat/completions`。
- `BAILIAN_MODEL`：该空间已开通且支持 `enable_thinking: false` 的千问模型标识。
- `BUDDY_CHAT_PORT`：可选，默认 17863。

运行 `npm run chat:server`，再启动软件。开发服务只监听 `127.0.0.1`。默认客户端地址为 `http://127.0.0.1:17863`，更改开发端口时在启动 Electron 前设置 `BUDDY_CHAT_SERVICE` 为对应本机地址。它是开发环境变量，不是最终用户设置。

没有配置百炼时，服务仍可启动，但聊天会明确提示尚未配置。不要用模拟回复代替真实验证。服务已配置时发送消息会产生实际 API 费用。

官方参考：
- https://docs.bailian.console.aliyun.com/zh/model-studio/deep-thinking
- https://docs.bailian.console.aliyun.com/zh/model-studio/text-generation

使用流式 Chat Completions，固定非思考模式，单次最多 1024 输出 token。实际费用、模型可用性与地域以百炼控制台为准。

## 数据和行为

- `chat.json` 位于 Electron 用户数据目录，与工资文件分离；测试使用独立临时目录。
- 每角色保留最近 500 条，最近 20 条已完成消息且总计不超过 16000 字作为上下文。单条输入最多 2000 字。
- 中止、失败回复不会作为完整回复发送到上游；失败重试复用原用户消息。
- 切换普通页面继续生成，切换当前伙伴停止；退出程序时保存已生成片段。
- 仅聊天上下文和角色设定被发送；不会自动发送工资或计划。聊天文件独立存储，当前工资备份导出不包含它。
- 损坏/不兼容历史保留原文件，下一次写入前额外保存 `chat-preserved-*.json`。

## 发布边界

本版用于本机开发验证，未提供公开匿名服务。正式分发 AI 能力前需要部署产品服务并加入访问控制、额度与防滥用机制。不要把供应商密钥或本机开发服务改成公网无认证端点。
