import { useEffect, useRef } from "react";

/** 目前開啟中的 modal（後開的在最後）；鍵盤事件只交給最上層處理。 */
const modalStack: object[] = [];

/**
 * 抽屜與對話框共用的互動行為：
 * - 開啟時把焦點移到 `focusRef`（通常是標題），關閉時還給原本的觸發元素
 * - Esc 關閉（抽屜上再開對話框時，只關最上層）
 * - Tab 焦點限制在容器內
 * - 鎖住背景捲動
 */
export function useModalBehavior<C extends HTMLElement, F extends HTMLElement>(
  onClose: () => void,
  { escapeEnabled = true }: { escapeEnabled?: boolean } = {},
) {
  const containerRef = useRef<C>(null);
  const focusRef = useRef<F>(null);
  const onCloseRef = useRef(onClose);
  const escapeRef = useRef(escapeEnabled);

  useEffect(() => {
    onCloseRef.current = onClose;
    escapeRef.current = escapeEnabled;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    focusRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const token = {};
    modalStack.push(token);

    function onKeyDown(event: KeyboardEvent) {
      if (modalStack[modalStack.length - 1] !== token) return;
      if (event.key === "Escape") {
        if (escapeRef.current) onCloseRef.current();
        return;
      }
      if (event.key === "Tab" && containerRef.current) {
        const focusables = containerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      modalStack.splice(modalStack.indexOf(token), 1);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return { containerRef, focusRef };
}
