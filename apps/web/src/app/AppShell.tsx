import { useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, ClipboardList, Menu, PanelLeftClose } from "lucide-react";
import { Modal } from "../components/Modal";
import { closeCase } from "./router";

/**
 * 左側導覽 + 頂列帳號選單。開啟案件詳情時導覽自動收合（product-scope.md 本輪 Prototype）。
 */
export function AppShell({ caseOpen, children }: { caseOpen: boolean; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [about, setAbout] = useState(false);
  const narrow = collapsed || caseOpen;

  return (
    <div className={`app-shell ${narrow ? "nav-collapsed" : ""}`}>
      <nav className="sidebar" aria-label="主要導覽">
        <a className="brand" href="#/" aria-label="CheckMate 首頁">
          <span className="brand-mark">
            <Check size={22} strokeWidth={3} aria-hidden="true" />
          </span>
          {!narrow && <span>CheckMate</span>}
        </a>
        <div className="nav-group">
          {!narrow && <span className="nav-caption">工作空間</span>}
          <button
            type="button"
            className="nav-item active"
            aria-current="page"
            title="案件初審"
            onClick={closeCase}
          >
            <ClipboardList size={21} aria-hidden="true" />
            {!narrow && "案件初審"}
          </button>
        </div>
        <button
          type="button"
          className="nav-toggle"
          title={narrow ? "展開導覽" : "收合導覽"}
          onClick={() => {
            if (caseOpen) closeCase();
            setCollapsed(!narrow);
          }}
        >
          {narrow ? (
            <Menu size={20} aria-label="展開導覽" />
          ) : (
            <>
              <PanelLeftClose size={20} aria-hidden="true" />
              收合導覽
            </>
          )}
        </button>
      </nav>

      <div className="workspace">
        <header className="topbar">
          <span>財務工作台</span>
          <details className="account">
            <summary>
              <span className="avatar">財</span>
              <span>財務初審人員</span>
              <ChevronDown size={15} aria-hidden="true" />
            </summary>
            <div className="account-menu">
              <strong>財務初審人員</strong>
              <p>CheckMate 工作空間</p>
              <button
                type="button"
                onClick={(e) => {
                  setAbout(true);
                  e.currentTarget.closest("details")?.removeAttribute("open");
                }}
              >
                關於此展示
              </button>
            </div>
          </details>
        </header>
        {children}
      </div>

      {about && (
        <Modal title="關於此展示" onClose={() => setAbout(false)}>
          <p>CheckMate 費用案件初審工作台。</p>
          <p>
            所有案件、規範與初審結果皆為預置模擬資料，尚未串接 OCR、AI 分析、通知或審核系統。
            處理紀錄會保存在資料庫中，重新整理後仍會保留。
          </p>
          <p>初審建議僅供財務人員判斷，不代表最終核准、付款或稅務認定。</p>
          <div className="modal-actions">
            <button type="button" className="primary" onClick={() => setAbout(false)}>
              知道了
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
