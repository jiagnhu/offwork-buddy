import Decimal from "decimal.js";
import { addDays, validDate } from "../core/date";
import type { FxBook } from "../core/fx";

// SAFE's public USD column quotes CNY per 100 USD (source: CFETS).
const queryURL = "https://www.safe.gov.cn/AppStructured/hlw/RMBQuery.do";
const sourceError = "汇率来源暂时不可用，请稍后再试";

function cells(row: string, tag: "th" | "td"): string[] {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  return Array.from(row.matchAll(pattern), ([, value]) =>
    value
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim(),
  );
}

export function parseSafeRates(
  html: string,
  from: string,
  to: string,
): Record<string, number> {
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  const table = clean.match(
    /<table\b[^>]*\bid\s*=\s*["']InfoTable["'][^>]*>([\s\S]*?)<\/table>/i,
  )?.[1];
  if (!table) {
    if (
      /<div\s+id=["']menu2["']\s*>\s*没有查询到符合条件的数据[!！]?\s*<\/div>/i.test(
        clean,
      )
    )
      return {};
    throw new Error(sourceError);
  }
  const rows = Array.from(
    table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi),
    ([, row]) => row,
  );
  const headers = cells(rows[0] ?? "", "th");
  const usdColumn = headers.indexOf("美元");
  const dateColumn = headers.indexOf("日期");
  if (usdColumn < 0 || dateColumn < 0 || rows.length < 2)
    throw new Error(sourceError);
  const rates: Record<string, number> = {};
  for (const row of rows.slice(1)) {
    const values = cells(row, "td");
    const date = values[dateColumn];
    const price = values[usdColumn];
    if (
      !validDate(date) ||
      date < from ||
      date > to ||
      Object.hasOwn(rates, date) ||
      !/^\d+(?:\.\d+)?$/.test(price) ||
      Number(price) <= 0 ||
      !Number.isFinite(Number(price))
    ) {
      throw new Error(sourceError);
    }
    rates[date] = new Decimal(price).div(100).toNumber();
  }
  return rates;
}

type Range = [string, string];

function mergingRanges(ranges: Range[]): Range[] {
  const merged: Range[] = [];
  for (const [start, end] of ranges.sort(([a], [b]) => a.localeCompare(b))) {
    const last = merged.at(-1);
    if (last && start <= addDays(last[1], 1)) {
      if (end > last[1]) last[1] = end;
    } else merged.push([start, end]);
  }
  return merged;
}

function missingRanges(
  from: string,
  to: string,
  coverage: FxBook["coverage"],
): Range[] {
  let cursor = from;
  const missing: Range[] = [];
  for (const [start, end] of mergingRanges(Object.entries(coverage))) {
    if (end < cursor) continue;
    if (start > to) break;
    if (start > cursor) missing.push([cursor, addDays(start, -1)]);
    cursor = addDays(end, 1);
  }
  if (cursor <= to) missing.push([cursor, to]);
  return missing;
}

export async function refreshFxRates(
  book: FxBook,
  from: string,
  to: string,
  today: string,
  fetcher: typeof fetch = fetch,
): Promise<FxBook> {
  if (![from, to, today].every(validDate) || from > to)
    throw new Error("汇率日期范围无效");
  // Include publications before the first earning day for holidays and future estimates.
  const lookback = addDays(from < today ? from : today, -14);
  const start = lookback < "2000-01-01" ? "2000-01-01" : lookback;
  const end = to < today ? to : today;
  const missing = missingRanges(start, end, book.coverage);
  if (!missing.length) return book;
  const rates = { ...book.rates };
  const coverage: Range[] = Object.entries(book.coverage);
  let changed = false;
  for (const [first, last] of missing) {
    // SAFE accepts at most a year per request. Smaller chunks bound response size.
    for (let cursor = first; cursor <= last;) {
      const limit = addDays(cursor, 89);
      const until = limit < last ? limit : last;
      const url = new URL(queryURL);
      url.search = new URLSearchParams({
        startDate: cursor,
        endDate: until,
        queryYN: "true",
      }).toString();
      const response = await fetcher(url.toString(), {
        signal: AbortSignal.timeout(12000),
        redirect: "error",
      });
      if (!response.ok) throw new Error(sourceError);
      const batch = parseSafeRates(await response.text(), cursor, until);
      for (const [date, rate] of Object.entries(batch)) {
        if (!Object.hasOwn(rates, date)) {
          rates[date] = rate;
          changed = true;
        }
      }
      // Today's missing publication is provisional: retry later, even if a holiday.
      const confirmedEnd =
        until === today && !Object.hasOwn(rates, today)
          ? addDays(today, -1)
          : until;
      if (confirmedEnd >= cursor) {
        coverage.push([cursor, confirmedEnd]);
        changed = true;
      }
      cursor = addDays(until, 1);
    }
  }
  return changed
    ? { rates, coverage: Object.fromEntries(mergingRanges(coverage)) }
    : book;
}
