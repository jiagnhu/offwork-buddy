import { expect, it } from "vitest";
import { splitReplyPages } from "../src/renderer/components/reply-pages";
it("fits full text without dropping Unicode or newlines", () => {
  const text = "你好🙂\n".repeat(50);
  const pages = splitReplyPages(text, 20, (s) => Array.from(s).length);
  expect(pages.join("")).toBe(text);
  expect(pages.every((p) => Array.from(p).length <= 20)).toBe(true);
});
it("keeps short replies on one page", () => {
  expect(splitReplyPages("你好", 100, (s) => s.length)).toEqual(["你好"]);
  expect(splitReplyPages("", 100, (s) => s.length)).toEqual([""]);
});
