import type { ReactNode } from "react";

function ClipboardIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

/** 本月標籤（例：2026 年 9 月）。 */
function monthLabel(date = new Date()): string {
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

/** 頂列 + 側邊主選單。M1 本輪只開放「案件總覽」，其他入口標示即將推出。 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="topbar__logo">
          <ClipboardIcon />
          AI 費用單據初審 Agent
        </div>
        <div className="topbar__right">
          <span>{monthLabel()}</span>
          <span
            className="avatar"
            title="財務初審人員（示範帳號）"
            aria-label="財務初審人員（示範帳號）"
          >
            審
          </span>
        </div>
      </header>

      <div className="layout">
        <nav className="side" aria-label="主選單">
          <div className="side__label">主選單</div>
          <a className="side__item side__item--on" href="#/cases" aria-current="page">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="5" height="5" rx="1" />
              <rect x="9" y="2" width="5" height="5" rx="1" />
              <rect x="2" y="9" width="5" height="5" rx="1" />
              <rect x="9" y="9" width="5" height="5" rx="1" />
            </svg>
            案件總覽
          </a>
          <span className="side__item side__item--off" aria-disabled="true">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M2 4h12M2 8h12M2 12h8" />
            </svg>
            費用規範<span className="side__soon">即將推出</span>
          </span>
          <span className="side__item side__item--off" aria-disabled="true">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M4 2v12M12 2v12M2 8h12" />
            </svg>
            稽核紀錄<span className="side__soon">即將推出</span>
          </span>
        </nav>

        <main className="content">{children}</main>
      </div>
    </>
  );
}
