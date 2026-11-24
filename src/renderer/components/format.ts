const amounts = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const money = (cents: number) => amounts.format(cents / 100);
export function nativeMoney(cents: number, currency: "CNY" | "USD") {
  return (currency === "USD" ? "US$" : "¥") + money(cents);
}
export function combinedMoney(cnyCents: number, pendingUsdCents: number) {
  return pendingUsdCents
    ? `¥${money(cnyCents)} + US$${money(pendingUsdCents)} 待折算`
    : `¥${money(cnyCents)}`;
}
export const time = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export const toMinutes = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};
export function countdown(seconds: number) {
  return [
    Math.floor(seconds / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ].map((n) => String(n).padStart(2, "0"));
}
export const statusLabels = {
  unconfigured: "待设置",
  rest: "今天休息",
  before: "尚未上班",
  working: "努力赚薪中",
  break: "午休充电中",
  finished: "今日已下班",
};
export const countdownLabels = {
  lunch: "距离午休还有",
  resume: "距离下午上班还有",
  offwork: "距离下班还有",
};
