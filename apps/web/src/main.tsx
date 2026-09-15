import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles/tokens.css";
import "./styles/app.css";
import { App } from "./app/App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 404 / 契約錯誤重試也沒用；網路錯誤交給使用者按「重試」
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
