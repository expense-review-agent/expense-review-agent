// CasesService — 列表與詳情的 caseStatus 欄位測試。
//
// 手寫 fake Prisma 注入，不連 DB、不加套件（同 review.service.spec.ts 作法）。
// 重點：Agent 分類（status）與案件流程狀態（caseStatus）是兩個獨立欄位，
// 前端靠 caseStatus 決定是否顯示處置按鈕；新增欄位不得改變既有 status 的值。

import { Prisma } from "@prisma/client";
import { CasesService } from "./cases.service";
import type { PrismaService } from "../prisma/prisma.service";

interface CaseFixture {
  id: string;
  caseNumber: string;
  status: string;
  classification: string | null;
  recommendedAction: string | null;
}

function caseRow(f: CaseFixture) {
  return {
    id: f.id,
    caseNumber: f.caseNumber,
    status: f.status,
    applicantName: "測試申請人",
    applicationDate: new Date("2026-08-20"),
    declaredTotal: new Prisma.Decimal("6200"),
    currency: "TWD",
    createdAt: new Date("2026-08-20"),
    lines: [
      {
        lineNo: 1,
        category: "辦公用品",
        description: "辦公設備採購",
        expenseDate: new Date("2026-08-18"),
      },
    ],
    currentRun: f.classification
      ? {
          id: `run_${f.id}`,
          classification: f.classification,
          recommendedAction: f.recommendedAction,
          confidenceLevel: "HIGH",
          engineVersion: "m1-review-engine@0.1.0",
          policyVersion: { version: "v0.1" },
          summaryKey: null,
          summaryParams: null,
          ruleResults: [],
        }
      : null,
  };
}

function makeService(rows: ReturnType<typeof caseRow>[]) {
  const prisma = {
    expenseCase: {
      findMany: () => Promise.resolve(rows),
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
    },
  };
  return new CasesService(prisma as unknown as PrismaService);
}

const MISSING_AWAITING = caseRow({
  id: "c_missing",
  caseNumber: "EXP-2026-2003",
  status: "AWAITING_INFO",
  classification: "MISSING",
  recommendedAction: "REQUEST_INFO",
});
const REFERENCE_CLOSED = caseRow({
  id: "c_ref",
  caseNumber: "EXP-2026-1043",
  status: "REVIEW_CLOSED",
  classification: null,
  recommendedAction: null,
});

describe("CasesService caseStatus", () => {
  it("list returns classification and workflow status as independent fields", async () => {
    const { items } = await makeService([MISSING_AWAITING, REFERENCE_CLOSED]).list();
    const missing = items.find((i) => i.id === "c_missing");
    expect(missing?.status).toBe("MISSING");
    expect(missing?.caseStatus).toBe("AWAITING_INFO");
  });

  it("list reports REVIEW_CLOSED for a reference case without a run", async () => {
    const { items } = await makeService([REFERENCE_CLOSED]).list();
    expect(items[0]?.status).toBe("REVIEW_CLOSED");
    expect(items[0]?.caseStatus).toBe("REVIEW_CLOSED");
  });

  it("status filter still matches on classification, unchanged by caseStatus", async () => {
    const service = makeService([MISSING_AWAITING, REFERENCE_CLOSED]);
    expect((await service.list("MISSING")).items.map((i) => i.id)).toEqual(["c_missing"]);
    expect((await service.list("AWAITING_INFO")).items).toEqual([]);
  });

  it("detail returns classification and workflow status as independent fields", async () => {
    const detail = await makeService([MISSING_AWAITING]).detail("c_missing");
    expect(detail.status).toBe("MISSING");
    expect(detail.caseStatus).toBe("AWAITING_INFO");
  });

  it("detail of a disposed case keeps its classification", async () => {
    const disposed = caseRow({
      id: "c_disposed",
      caseNumber: "EXP-2026-2001",
      status: "DISPOSED",
      classification: "NORMAL",
      recommendedAction: "APPROVE",
    });
    const detail = await makeService([disposed]).detail("c_disposed");
    expect(detail.status).toBe("NORMAL");
    expect(detail.caseStatus).toBe("DISPOSED");
  });
});
