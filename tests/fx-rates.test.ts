import { expect, it, vi } from "vitest";
import { emptyFxBook, quoteForDate, toCnyCents } from "../src/core/fx";
import { parseSafeRates, refreshFxRates } from "../src/main/fx-rates";

const dataPage = (date: string, price: string) =>
  `<table id="InfoTable"><tr><th>日期</th><th>欧元</th><th><!-- currency --> 美元</th></tr><tr><td>${date}</td><td>760</td><td>${price}</td></tr></table>`;
const noData = '<div id="menu2">没有查询到符合条件的数据!</div>';

it("uses the published USD column and the CNY per 100 USD convention", () => {
  const rates = parseSafeRates(
    dataPage("2026-11-20", "671.31"),
    "2026-11-01",
    "2026-11-21",
  );
  expect(rates).toEqual({ "2026-11-20": 6.7131 });
  expect(toCnyCents(14000, rates["2026-11-20"])).toBe(93983);
  expect(() =>
    parseSafeRates(dataPage("2026-11-20", "bad"), "2026-11-01", "2026-11-21"),
  ).toThrow();
  expect(() =>
    parseSafeRates(
      dataPage("2026-11-25", "671.11"),
      "2026-11-01",
      "2026-11-21",
    ),
  ).toThrow();
  expect(() =>
    parseSafeRates("<html>暂时维护</html>", "2026-11-01", "2026-11-21"),
  ).toThrow();
});

it("carries the preceding publication through confirmed holidays and retries today's pending quote", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(dataPage("2026-11-20", "671.31")))
    .mockResolvedValueOnce(new Response(noData))
    .mockResolvedValueOnce(new Response(dataPage("2026-11-23", "671.20")));
  const today = "2026-11-23";
  const book = await refreshFxRates(
    emptyFxBook(),
    "2026-11-20",
    "2026-12-20",
    today,
    fetcher,
  );
  expect(quoteForDate(book, "2026-11-19", today)).toBeNull();
  expect(quoteForDate(book, "2026-11-22", today)).toEqual({
    rateDate: "2026-11-20",
    rate: 6.7131,
    estimated: false,
  });
  expect(quoteForDate(book, today, today)?.estimated).toBe(true);
  const unchanged = await refreshFxRates(
    book,
    "2026-11-20",
    today,
    today,
    fetcher,
  );
  expect(unchanged).toBe(book);
  const updated = await refreshFxRates(
    book,
    "2026-11-20",
    today,
    today,
    fetcher,
  );
  expect(quoteForDate(updated, today, today)).toEqual({
    rateDate: today,
    rate: 6.712,
    estimated: false,
  });
  expect(quoteForDate(updated, "2026-12-20", today)).toEqual({
    rateDate: today,
    rate: 6.712,
    estimated: true,
  });
  expect(quoteForDate(updated, "2026-11-22", today)?.rate).toBe(6.7131);
  expect(
    await refreshFxRates(updated, "2026-11-20", today, today, fetcher),
  ).toBe(updated);
  expect(fetcher).toHaveBeenCalledTimes(3);
  const next = new URL(String(fetcher.mock.calls[1][0]));
  expect(next.searchParams.get("startDate")).toBe(today);
  expect(next.searchParams.get("endDate")).toBe(today);
});

it("does not finalize a fallback across an unverified gap or lose a cache on a bad response", async () => {
  const book = {
    rates: { "2026-11-11": 6.72 },
    coverage: { "2026-11-10": "2026-11-12", "2026-11-20": "2026-11-22" },
  };
  expect(quoteForDate(book, "2026-11-20", "2026-11-23")?.estimated).toBe(true);
  await expect(
    refreshFxRates(
      book,
      "2026-11-17",
      "2026-11-21",
      "2026-11-23",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 503 })),
    ),
  ).rejects.toThrow();
  expect(book.rates).toEqual({ "2026-11-11": 6.72 });
});
