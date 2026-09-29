import { ApiError } from "../api/client";

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "發生未預期的錯誤。";
}

/** 載入失敗：說明發生什麼，並提供重試；不以空白畫面代替。 */
export function ErrorState({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div className="empty" role="alert">
      <h2>{title}</h2>
      <p>{errorMessage(error)}</p>
      <button type="button" onClick={onRetry}>
        重試
      </button>
    </div>
  );
}
