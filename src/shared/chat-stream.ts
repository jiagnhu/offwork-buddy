// Line parsing works across arbitrary TCP chunks and multi-byte UTF-8 characters.
export async function readSse(
  response: Response,
  onData: (data: string) => void,
) {
  if (!response.body) throw new Error("回复流不可用");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    data: string[] = [];
  const line = (value: string) => {
    if (value === "") {
      if (data.length) onData(data.join("\n"));
      data = [];
    } else if (value.startsWith("data:"))
      data.push(value.slice(5).replace(/^ /, ""));
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      if (buffer.length > 256000) throw new Error("回复流格式异常");
      let n;
      while ((n = buffer.indexOf("\n")) >= 0) {
        line(buffer.slice(0, n).replace(/\r$/, ""));
        buffer = buffer.slice(n + 1);
      }
      if (done) {
        if (buffer) line(buffer.replace(/\r$/, ""));
        line("");
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
