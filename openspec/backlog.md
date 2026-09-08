# Backlog — 已知但現在不做的事

> 依 `CLAUDE.md` 規定：看到任何 M2/M3、或超出當前階段範圍的東西，
> **不要順手實作，寫進這裡。** 要做時再開 OpenSpec proposal。
>
> 本檔只記錄「刻意延後」的項目，不是 M1 的待辦（M1 待辦在各 change 的 tasks.md）。

## Phase 2（M1 之後才接）

### OCR 單據擷取

- **現況**：M1 完全不做 OCR，以 `ExtractionSource.STRUCTURED_FIXTURE` / `MANUAL_FORM` 為判斷依據。
- **延後原因**：`CLAUDE.md` 明訂「Phase 2 才接 OCR，不要提前引入 OCR 相依套件」。
- **做的時候要注意**：只換 runner 實作，**不改 API 契約**（`POST /cases/:id/runs` 維持非同步）。
  `ExtractionSource` 已預留 `OCR` 值、`ExtractedField` 已預留 `anchor { page, bbox }` grounding 欄位。

### 串接 LLM API（影像/文字辨識）

- **現況**：未做。M1 用結構化 fixture，不呼叫任何外部 LLM。
- **延後原因**：不在 M1 範圍；且引入外部 API key 牽涉密鑰管理與成本，需另行評估。
- **做的時候要注意**：密鑰走 `.env`（勿進 git）；呼叫需可離線測試（mock），不可讓判定流程硬依賴外部服務可用性。

## M2 — Risk Intelligence（風險情報）

- 語意檢索（pgvector）、情境感知風險偵測。
- **相依**：docker-compose 已備 pgvector 的 Postgres 映像，但 M1 不使用。

## M3 — Autonomous Review（自動處置）

- Policy 控制的自動化 + 人類監督、重試/升級。
- **相依**：docker-compose 已備 Redis，但 M1 不引入 Redis / BullMQ。

## 其他延後項目

- （日後把「想做但現在不該做」的點子記在這裡，附一句延後原因，避免遺忘也避免提前實作。）
