import type { ReactNode } from "react";
import { ApiError } from "../api/client";

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "發生未預期的錯誤。";
}

export function ErrorState({
  title = "資料載入失敗",
  error,
  onRetry,
  inline = false,
}: {
  title?: string;
  error: unknown;
  onRetry?: () => void;
  inline?: boolean;
}) {
  return (
    <div className={`state state--error${inline ? " state--inline" : ""}`} role="alert">
      <div className="state__title">{title}</div>
      <div>{errorMessage(error)}</div>
      {onRetry && (
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          重試
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  /** 脫離入口（例如清除篩選／搜尋），避免使用者停在無法脫離的空列表。 */
  action?: { label: string; onClick: () => void } | undefined;
}) {
  return (
    <div className="state">
      <div className="state__title">{title}</div>
      {children && <div>{children}</div>}
      {action && (
        <button type="button" className="btn btn--secondary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="載入中">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ padding: "12px 14px" }}>
          <div className="skeleton" style={{ width: `${70 - i * 8}%` }} />
        </div>
      ))}
    </div>
  );
}
