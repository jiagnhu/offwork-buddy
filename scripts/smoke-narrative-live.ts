// Opt-in developer smoke. Reads an existing encrypted configuration through the app;
// never prints credentials or reads the user's conversations/settings.
import { app, safeStorage } from "electron";
import { writeFile } from "node:fs/promises";
import { AISettings } from "../src/main/ai-settings";
import { chatTransport } from "../src/main/chat-controller";
import { extractMemories, suggestChoice } from "../src/main/narrative-ai";
import { emptyNarrative } from "../src/shared/narrative";
import { storyCatalog } from "../src/shared/story-catalog";
import type { Live2dKind } from "../src/shared/characters";
async function main() {
  const directory = process.env.BUDDY_LIVE_CONFIG_DIR;
  if (!directory)
    throw Error(
      "Set BUDDY_LIVE_CONFIG_DIR explicitly to opt into using the existing AI service.",
    );
  app.setName("下班搭子");
  app.setPath("userData", directory);
  await app.whenReady();
  const settings = new AISettings(directory, true, safeStorage);
  try {
    await settings.load();
    if (!settings.view().running)
      throw Error(
        "Configured AI service is unavailable; no credentials printed.",
      );
    const transport: typeof chatTransport = (body, signal, delta) =>
      chatTransport(body, signal, delta, settings.endpoint);
    const replies: Record<string, string> = {};
    for (const kind of ["mao", "miara", "rice"] as Live2dKind[]) {
      let output = "";
      await transport(
        {
          kind,
          name: kind,
          messages: [
            {
              role: "user",
              content:
                "你怎么看为了保全多数人而牺牲少数？直接说你的想法，不用列提纲。",
            },
          ],
        },
        AbortSignal.timeout(60000),
        (text) => (output += text),
      );
      replies[kind] = output;
    }
    const candidates = await extractMemories(
      transport,
      "haru",
      "Haru",
      [
        {
          id: "synthetic-user",
          role: "user",
          status: "complete",
          at: 1,
          content: "我不喝咖啡，平时喜欢红茶。",
        },
        {
          id: "synthetic-friend",
          role: "user",
          status: "complete",
          at: 2,
          content: "我的朋友喜欢猫。如果我也养猫，那只是个假设。",
        },
      ],
      emptyNarrative(),
      AbortSignal.timeout(60000),
    );
    const choice = await suggestChoice(
      transport,
      "haru",
      "Haru",
      "我想先把签收时间和完整附件核实一遍。",
      storyCatalog.haru.nodes.inspect.choices,
      AbortSignal.timeout(60000),
    );
    let recall = "";
    await transport(
      {
        kind: "haru",
        name: "Haru",
        context: {
          memories: [
            {
              text: "我不喝咖啡，平时喜欢红茶。",
              at: 1,
              category: "preference",
            },
          ],
        },
        messages: [{ role: "user", content: "待会儿休息时，帮我选杯喝的吧。" }],
      },
      AbortSignal.timeout(60000),
      (text) => (recall += text),
    );
    await writeFile(
      "test-results/narrative-live.json",
      JSON.stringify(
        { replies, candidates, choice: choice?.id ?? null, recall },
        null,
        2,
      ),
      "utf8",
    );
    console.log(
      JSON.stringify({
        completed: true,
        roles: Object.keys(replies),
        candidates: candidates.length,
        choice: choice?.id ?? null,
      }),
    );
  } catch (e) {
    console.error(e instanceof Error ? e.message : "Live smoke failed");
    process.exitCode = 1;
  } finally {
    await settings.close();
    app.exit(process.exitCode === 1 ? 1 : 0);
  }
}
void main();
