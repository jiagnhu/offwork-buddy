import { test, expect } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { AISettings } from "../src/main/ai-settings";
import { aiSettingsSchema } from "../src/shared/ai-settings";
const crypto = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from(s.split("").reverse().join("")),
  decryptString: (b: Buffer) => b.toString().split("").reverse().join(""),
};
const input = {
  key: "secret-test-123",
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  model: "test-model",
};
test("connection test uses managed settings, does not save and redacts provider errors", async () => {
  let body: any;
  const a = new AISettings("", true, crypto, (async (_url, options) => {
    body = JSON.parse(String(options?.body));
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "连接成功" } }] }),
    );
  }) as typeof fetch);
  expect(await a.test(input)).toContain("连接成功");
  expect(body).toMatchObject({
    model: "test-model",
    enable_thinking: false,
    stream: false,
  });
  expect(a.view().hasKey).toBe(false);
  const b = new AISettings(
    "",
    true,
    crypto,
    (async () => new Response(input.key, { status: 401 })) as typeof fetch,
  );
  await expect(b.test(input)).rejects.toThrow("密钥无效");
});
test("encrypted settings start service, keep stored key on blank and restart automatically", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "buddy-ai-"));
  const a = new AISettings(dir, true, crypto);
  const b = new AISettings(dir, true, crypto);
  try {
    await a.save(input);
    expect(a.view().running).toBe(true);
    expect(JSON.stringify(a.view())).not.toContain(input.key);
    expect(
      await readFile(path.join(dir, "ai-settings.json"), "utf8"),
    ).not.toContain(input.key);
    await a.save({ ...input, key: "", model: "next-model" });
    await a.close();
    await b.load();
    expect(b.view()).toMatchObject({
      hasKey: true,
      running: true,
      model: "next-model",
    });
  } finally {
    await a.close();
    await b.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("release build and unavailable encryption fail closed", async () => {
  const a = new AISettings("", false, crypto);
  await expect(a.save(input)).rejects.toThrow("开发版");
  const b = new AISettings("", true, {
    ...crypto,
    isEncryptionAvailable: () => false,
  });
  await expect(b.save(input)).rejects.toThrow("加密");
  expect(
    aiSettingsSchema.safeParse({
      ...input,
      baseURL: "https://evil.oss.aliyuncs.com/compatible-mode/v1",
    }).success,
  ).toBe(false);
});
