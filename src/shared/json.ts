/** Parse standard JSON while refusing duplicate object keys, including escaped equivalents. */
export function parseJsonStrict(text: string): unknown {
  let result: unknown;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error("文件不是有效的 JSON，请检查文件格式。");
  }
  const stack: Array<{ keys: Set<string> | null; expectsKey: boolean }> = [];
  // Syntax is already validated by JSON.parse. Strings are matched whole, so
  // punctuation inside values cannot alter the structural stack.
  for (const match of text.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],:]/g)) {
    const token = match[0];
    if (token === "{" || token === "[")
      stack.push({
        keys: token === "{" ? new Set() : null,
        expectsKey: token === "{",
      });
    else if (token === "}" || token === "]") stack.pop();
    else {
      const current = stack.at(-1);
      if (!current?.keys) continue;
      if (token === ",") current.expectsKey = true;
      else if (token === ":") current.expectsKey = false;
      else if (current.expectsKey && token.startsWith('"')) {
        const key: string = JSON.parse(token);
        if (current.keys.has(key))
          throw new Error(`文件含重复字段或日期「${key}」，请修正后再导入。`);
        current.keys.add(key);
      }
    }
  }
  return result;
}
