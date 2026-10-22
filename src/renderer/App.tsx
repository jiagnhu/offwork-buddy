import DesktopCard from './pages/DesktopCard';
import Companion from "./pages/Companion";
import EarningsDetail from './components/EarningsDetail';
import type {NavigateTarget} from '../shared/bridge';
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Wallet,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Moon,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { useSnapshot } from "./hooks/useSnapshot";
import Overview from "./pages/Overview";
import Calendar from "./pages/Calendar";
import Ledger from "./pages/Ledger";
import Settings from "./pages/Settings";
import Onboarding from "./pages/Onboarding";
import "./styles/theme.css";
const navigation = [
  { id: "overview", label: "今日概览", icon: LayoutDashboard },
  { id: "calendar", label: "工作日历", icon: CalendarDays },
  { id: "ledger", label: "收入记录", icon: Wallet },
  { id: "settings", label: "偏好设置", icon: SettingsIcon },
];
export default function App() {
  const { snapshot, error } = useSnapshot();
  const [page, setPage] = useState("overview");
  const [actionError, setActionError] = useState("");
  const [detailDate,setDetailDate]=useState<string|null>(null),[calendarDate,setCalendarDate]=useState<string|undefined>();
  useEffect(()=>{
    if(location.hash) return;
    const navigate=(target:NavigateTarget)=>{if(target.page==='earnings')setDetailDate(target.date);else {setPage(target.page);if(target.page==='calendar')setCalendarDate(target.date)}};
    const off=window.buddy.onNavigate(target=>{navigate(target);void window.buddy.takeNavigation()});
    void window.buddy.takeNavigation().then(t=>{if(t)navigate(t)});return off;
  },[]);
  useEffect(() => {
    if (snapshot) {
      document.documentElement.dataset.theme = snapshot.state.preferences.theme;
      document.documentElement.dataset.motion = snapshot.state.preferences
        .reducedMotion
        ? "reduced"
        : "full";
    }
  }, [
    snapshot?.state.preferences.theme,
    snapshot?.state.preferences.reducedMotion,
  ]);
  if (!snapshot)
    return (
      <div className="loading">
        <Sparkles />
        <p>{error || "搭子正在赶来…"}</p>
      </div>
    );
  if (location.hash === "#desktop-card") return <DesktopCard snapshot={snapshot}/>;
  if (location.hash === "#companion") return <Companion snapshot={snapshot} />;
  if (!snapshot.state.configured) return <Onboarding snapshot={snapshot} />;
  const title =
    page === "overview"
      ? "今天，也在慢慢变富。"
      : page === "calendar"
        ? "工作有节奏，生活有盼头。"
        : page === "ledger"
          ? "每一份努力，都算数。"
          : "你的节奏，你来定义。";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandmark">
            <Sparkles size={24} />
          </div>
          <div>
            <strong>下班搭子</strong>
          </div>
        </div>
        <nav>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
            >
              <Icon size={19} />
              {label}
              {page === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>✳</span>
          <strong>
            上班认真，
            <br />
            下班快乐。
          </strong>
          <p>日子不只是进度条。</p>
        </div>
        <div className="sidebar-bottom">
          <ShieldCheck size={15} />
          <span>本地存储 · 安心陪伴</span>
          <small>v1.1.2</small>
        </div>
      </aside>
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1>{title}</h1>
            <p>
              {page === "overview"
                ? new Intl.DateTimeFormat("zh-CN", {
                    timeZone: "Asia/Shanghai",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "long",
                  }).format(new Date())
                : "把工作安排好，把生活留给自己。"}
            </p>
          </div>
          <div className="header-actions">
            <button
              aria-label="切换主题"
              className="icon-button"
              onClick={() =>
                window.buddy
                  .setPreferences({
                    theme:
                      snapshot.state.preferences.theme === "light"
                        ? "dark"
                        : "light",
                  })
                  .then(() => setActionError(""))
                  .catch((e) => setActionError(e.message))
              }
            >
              {snapshot.state.preferences.theme === "light" ? (
                <Moon size={19} />
              ) : (
                <Sun size={19} />
              )}
            </button>
            <button
              className="secondary"
              onClick={() => window.buddy.showCompanion()}
            >
              桌面模式
              <ArrowUpRight size={16} />
            </button>
          </div>
        </header>
        {(snapshot.notice || actionError) && (
          <div className="notice" role="alert">
            {snapshot.notice || actionError}
          </div>
        )}
        {snapshot.progress.calendarMissing && (
          <div className="notice">
            节假日数据缺失，当前按常规排班。可在工作日历中导入年度数据。
          </div>
        )}
        {page === "overview" ? (
          <Overview snapshot={snapshot} navigate={setPage} />
        ) : page === "calendar" ? (
          <Calendar snapshot={snapshot} initialDate={calendarDate} />
        ) : page === "ledger" ? (
          <Ledger snapshot={snapshot} />
        ) : (
          <Settings snapshot={snapshot} />
        )}
      </main>
      {detailDate&&<EarningsDetail date={detailDate} snapshot={snapshot} onClose={()=>setDetailDate(null)} onLedger={()=>{setDetailDate(null);setPage('ledger')}}/>}
    </div>
  );
}
