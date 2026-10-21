import { describe, it, expect } from "vitest";
import { dateKey } from "../src/core/date";
import { resolveDay, countWorkdays } from "../src/core/calendar";
const rule = {
  id: "r1",
  effectiveFrom: "2026-01-01",
  mode: "daily" as const,
  amount: "800",
  start: 540,
  end: 1080,
  breakStart: 720,
  breakEnd: 780,
  schedule: "alternating" as const,
  restDay: 0,
  bigWeekMonday: "2026-12-28",
  official: true,
};
describe("calendar", () => {
  it("uses Shanghai midnight", () =>
    expect(dateKey(new Date("2026-10-20T16:00:00Z"))).toBe("2026-10-21"));
  it("carries alternating weeks across year boundary", () => {
    expect(resolveDay("2027-01-02", rule, {}, {}).workday).toBe(true);
    expect(resolveDay("2027-01-09", rule, {}, {}).workday).toBe(false);
  });
  it("manual overrides win and missing years are explicit", () => {
    const calendar = {
      "2026": {
        source: "https://www.gov.cn",
        updated: "2026-10-21",
        days: { "2026-10-10": true },
      },
    };
    expect(
      resolveDay("2026-10-10", rule, calendar, { "2026-10-10": false }).workday,
    ).toBe(false);
    expect(resolveDay("2027-01-02", rule, calendar, {}).calendarMissing).toBe(
      true,
    );
  });
  it("can disable official override", () =>
    expect(
      resolveDay(
        "2026-10-11",
        { ...rule, schedule: "double", official: false },
        {
          "2026": {
            source: "https://www.gov.cn",
            updated: "2026-10-21",
            days: { "2026-10-11": true },
          },
        },
        {},
      ).workday,
    ).toBe(false));
  it("counts 22 weekdays in January 2026 without holidays", () =>
    expect(
      countWorkdays("2026-01", { ...rule, schedule: "double" }, {}, {}),
    ).toBe(22));
});
