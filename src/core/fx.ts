import Decimal from "decimal.js";
import { addDays } from "./date";

export interface FxBook {
  /** Published CNY for one USD, keyed by publication date in China. */
  rates: Record<string, number>;
  /** Inclusive intervals verified against the provider, including non-trading days. */
  coverage: Record<string, string>;
}

export interface FxQuote {
  rate: number;
  rateDate: string;
  estimated: boolean;
}

export function emptyFxBook(): FxBook {
  return { rates: {}, coverage: {} };
}

const sortedDates = new WeakMap<FxBook["rates"], string[]>();
function lastPublished(
  rates: FxBook["rates"],
  cutoff: string,
): string | undefined {
  if (Object.hasOwn(rates, cutoff)) return cutoff;
  let dates = sortedDates.get(rates);
  if (!dates) {
    dates = Object.keys(rates).sort();
    sortedDates.set(rates, dates);
  }
  let low = 0;
  let high = dates.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (dates[mid] <= cutoff) low = mid + 1;
    else high = mid;
  }
  return dates[low - 1];
}

export function quoteForDate(
  book: FxBook,
  date: string,
  today: string,
): FxQuote | null {
  const cutoff = date < today ? date : today;
  const rateDate = lastPublished(book.rates, cutoff);
  if (!rateDate) return null;
  const exact = rateDate === date;
  const verifiedCarry =
    !exact &&
    date < today &&
    Object.entries(book.coverage).some(
      ([start, end]) => start <= addDays(rateDate, 1) && date <= end,
    );
  return {
    rate: book.rates[rateDate],
    rateDate,
    estimated: !(exact || verifiedCarry),
  };
}

export function toCnyCents(usdCents: number, rate: number): number {
  return new Decimal(usdCents)
    .times(rate)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}
