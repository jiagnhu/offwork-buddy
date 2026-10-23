import { createChatServer } from "./chat-server";
const baseURL = process.env.BAILIAN_BASE_URL;
if (baseURL) {
  const url = new URL(baseURL);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".aliyuncs.com") ||
    url.username ||
    url.password
  )
    throw Error("百炼地址必须为官方 HTTPS API 地址");
}
const port = Number(process.env.BUDDY_CHAT_PORT ?? 17863);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error("聊天服务端口不正确");
const server = createChatServer({
  key: process.env.DASHSCOPE_API_KEY,
  baseURL,
  model: process.env.BAILIAN_MODEL,
});
server.requestTimeout = 65000;
server.headersTimeout = 10000;
server.listen(port, "127.0.0.1", () =>
  console.log(`伙伴聊天开发服务已启动：127.0.0.1:${port}（仅本机）`),
);
server.on("error", () => {
  console.error("聊天服务启动失败，请检查端口是否被占用。");
  process.exitCode = 1;
});
