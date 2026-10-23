import type { LeaveInterval, RuleVersion } from "../shared/model";
export function normalizeLeave(intervals: LeaveInterval[]): LeaveInterval[] {
  if (
    intervals.length > 24 ||
    intervals.some(
      (p) =>
        !Number.isInteger(p.start) ||
        !Number.isInteger(p.end) ||
        p.start < 0 ||
        p.end > 1440 ||
        p.start >= p.end,
    )
  )
    throw new Error("请假时段须在同一天内，结束晚于开始，每天最多 24 段");
  const result: LeaveInterval[] = [];
  for (const p of [...intervals].sort((a, b) => a.start - b.start)) {
    const last = result.at(-1);
    if (last && p.start <= last.end) last.end = Math.max(last.end, p.end);
    else result.push({ ...p });
  }
  return result;
}
export function leaveSeconds(
  rule: RuleVersion,
  intervals: LeaveInterval[],
  until = 86400,
): number {
  const segments =
    rule.breakStart === null
      ? [[rule.start, rule.end]]
      : [
          [rule.start, rule.breakStart],
          [rule.breakEnd!, rule.end],
        ];
  return normalizeLeave(intervals).reduce(
    (sum, p) =>
      sum +
      segments.reduce(
        (n, [start, end]) =>
          n +
          Math.max(
            0,
            Math.min(p.end * 60, end * 60, until) -
              Math.max(p.start * 60, start * 60),
          ),
        0,
      ),
    0,
  );
}
