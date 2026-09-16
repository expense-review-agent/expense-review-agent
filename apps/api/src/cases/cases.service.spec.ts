// CasesService — 列表篩選、詳情處置人與申請紀錄查詢的測試。
//
// 手寫 fake Prisma 注入，不連 DB、不加套件（同 review.service.spec.ts 作法）。
// 重點：
// - Agent 分類（status）與案件流程狀態（caseStatus）是兩個獨立欄位，
//   前端靠 caseStatus 決定是否顯示處置按鈕；新增欄位不得改變既有 status 的值。
// - caseStatus 篩選必須下在 Prisma `where` 上（DB 層篩），不是撈回後過濾。
// - 詳情的一致性徽章必須是處置寫入時的固化值，不得在讀取時重算。

import { Prisma } from "@prisma/client";
import { CasesService } from "./cases.service";
import type { PrismaService } from "../prisma/prisma.service";

interface DispositionFixture {
  actorName: string;
  action: string;
  consistencyFlag: string;
  createdAt: string;
}

interface CaseFixture {
  id: string;
  caseNumber: string;
  status: string;
  classification: string | null;
  recommendedAction: string | null;
  department?: string | null;
  applicantName?: string;
  applicantCode?: string | null;
  applicationDate?: string | null;
  dispositions?: DispositionFixture[];
}

function caseRow(f: CaseFixture) {
  return {
    id: f.id,
    organizationId: "org_1",
    caseNumber: f.caseNumber,
    status: f.status,
    applicantName: f.applicantName ?? "測試申請人",
    applicantCode: f.applicantCode ?? null,
    applicantDepartment: f.department === undefined ? "業務部" : f.department,
    applicationDate:
      f.applicationDate === undefined
        ? new Date("2026-08-20")
        : f.applicationDate === null
          ? null
          : new Date(f.applicationDate),
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
    // 詳情固定 include 最新一筆處置（orderBy desc + take 1），fake 直接給已排序的結果。
    dispositions: (f.dispositions ?? []).map((d, index) => ({
      id: `disp_${f.id}_${index}`,
      action: d.action,
      consistencyFlag: d.consistencyFlag,
      createdAt: new Date(d.createdAt),
      actor: { displayName: d.actorName },
    })),
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

type Row = ReturnType<typeof caseRow>;

type OrderBy = Record<string, "asc" | "desc">;

interface FindManyArgs {
  where?: {
    status?: string;
    organizationId?: string;
    applicantName?: string;
    applicantCode?: string;
    applicantDepartment?: string;
  };
  orderBy?: OrderBy | OrderBy[];
}

/** fake 實作 orderBy，否則「依申請日期由新到舊」這種 DB 層行為根本測不到。 */
function applyOrderBy(rows: Row[], orderBy: FindManyArgs["orderBy"]): Row[] {
  if (!orderBy) return rows;
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const clause of clauses) {
      for (const [field, direction] of Object.entries(clause)) {
        const rawA = (a as unknown as Record<string, unknown>)[field];
        const rawB = (b as unknown as Record<string, unknown>)[field];
        // null 一律排末尾（與 Prisma 的預設不同，但本測試沒有混用 null 與排序的案例）
        if (rawA == null && rawB == null) continue;
        if (rawA == null) return 1;
        if (rawB == null) return -1;
        const valueA = rawA instanceof Date ? rawA.getTime() : String(rawA);
        const valueB = rawB instanceof Date ? rawB.getTime() : String(rawB);
        if (valueA === valueB) continue;
        const cmp = valueA < valueB ? -1 : 1;
        return direction === "desc" ? -cmp : cmp;
      }
    }
    return 0;
  });
}

function makeService(rows: Row[]) {
  const calls: FindManyArgs[] = [];
  const prisma = {
    expenseCase: {
      findMany: (args: FindManyArgs = {}) => {
        calls.push(args);
        const where = args.where ?? {};
        // fake 只實作本測試用到的等值條件；未實作的條件會讓斷言失敗而非靜默通過。
        const matched = rows.filter(
          (r) =>
            (where.status === undefined || r.status === where.status) &&
            (where.organizationId === undefined || r.organizationId === where.organizationId) &&
            (where.applicantName === undefined || r.applicantName === where.applicantName) &&
            (where.applicantCode === undefined || r.applicantCode === where.applicantCode) &&
            (where.applicantDepartment === undefined ||
              r.applicantDepartment === where.applicantDepartment),
        );
        return Promise.resolve(applyOrderBy(matched, args.orderBy));
      },
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
    },
  };
  return { service: new CasesService(prisma as unknown as PrismaService), calls };
}

/** 舊測試的便利包裝（只要 service）。 */
function serviceOf(rows: Row[]) {
  return makeService(rows).service;
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
  classification: "NORMAL",
  recommendedAction: "APPROVE",
});

describe("CasesService caseStatus", () => {
  it("list returns classification and workflow status as independent fields", async () => {
    const { items } = await serviceOf([MISSING_AWAITING, REFERENCE_CLOSED]).list();
    const missing = items.find((i) => i.id === "c_missing");
    expect(missing?.status).toBe("MISSING");
    expect(missing?.caseStatus).toBe("AWAITING_INFO");
  });

  it("list reports REVIEW_CLOSED for a reference case without a run", async () => {
    const withoutRun = caseRow({
      id: "c_ref_norun",
      caseNumber: "EXP-2026-1042",
      status: "REVIEW_CLOSED",
      classification: null,
      recommendedAction: null,
    });
    const { items } = await serviceOf([withoutRun]).list();
    expect(items[0]?.status).toBe("REVIEW_CLOSED");
    expect(items[0]?.caseStatus).toBe("REVIEW_CLOSED");
  });

  it("status filter still matches on classification, unchanged by caseStatus", async () => {
    const service = serviceOf([MISSING_AWAITING, REFERENCE_CLOSED]);
    expect((await service.list("MISSING")).items.map((i) => i.id)).toEqual(["c_missing"]);
    expect((await service.list("AWAITING_INFO")).items).toEqual([]);
  });

  it("detail returns classification and workflow status as independent fields", async () => {
    const detail = await serviceOf([MISSING_AWAITING]).detail("c_missing");
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
    const detail = await serviceOf([disposed]).detail("c_disposed");
    expect(detail.status).toBe("NORMAL");
    expect(detail.caseStatus).toBe("DISPOSED");
  });
});

describe("CasesService caseStatus filter", () => {
  it("pushes caseStatus into the Prisma where clause instead of filtering in memory", async () => {
    const { service, calls } = makeService([MISSING_AWAITING, REFERENCE_CLOSED]);
    await service.list(undefined, "REVIEW_CLOSED");
    expect(calls[0]?.where).toEqual({ status: "REVIEW_CLOSED" });
  });

  it("finds a REVIEW_CLOSED case that carries an agent run (the old status filter could not)", async () => {
    const service = serviceOf([MISSING_AWAITING, REFERENCE_CLOSED]);
    // 舊參數比對合併值，帶 NORMAL run 的已結案案件會被分類覆蓋而取不到
    expect((await service.list("REVIEW_CLOSED")).items).toEqual([]);
    // 新參數直接比對流程狀態
    const byCaseStatus = await service.list(undefined, "REVIEW_CLOSED");
    expect(byCaseStatus.items.map((i) => i.caseNumber)).toEqual(["EXP-2026-1043"]);
  });

  it("applies both filters as AND", async () => {
    const service = serviceOf([MISSING_AWAITING, REFERENCE_CLOSED]);
    expect((await service.list("MISSING", "AWAITING_INFO")).items.map((i) => i.id)).toEqual([
      "c_missing",
    ]);
    expect((await service.list("MISSING", "DISPOSED")).items).toEqual([]);
  });

  it("omits the where clause entirely when no caseStatus is given", async () => {
    const { service, calls } = makeService([MISSING_AWAITING]);
    await service.list();
    expect(calls[0]?.where).toBeUndefined();
  });

  it("list carries department and application date", async () => {
    const noDept = caseRow({
      id: "c_nodept",
      caseNumber: "EXP-2026-2004",
      status: "QUEUED",
      classification: "HUMAN",
      recommendedAction: "MANUAL_REVIEW",
      department: null,
    });
    const { items } = await serviceOf([MISSING_AWAITING, noDept]).list();
    expect(items.find((i) => i.id === "c_missing")?.department).toBe("業務部");
    expect(items.find((i) => i.id === "c_nodept")?.department).toBeNull();
    expect(items[0]?.applicationDate).toBe("2026-08-20");
    // 消費日期沒有被申請日期取代
    expect(items[0]?.expenseDate).toBe("2026-08-18");
  });
});

describe("CasesService detail disposition", () => {
  const CONSISTENT = {
    actorName: "陳初審",
    action: "ACCEPT",
    consistencyFlag: "CONSISTENT",
    createdAt: "2026-08-21T09:00:00.000Z",
  };

  it("returns the acting reviewer, timestamp, action and persisted badge", async () => {
    const disposed = caseRow({
      id: "c_disposed",
      caseNumber: "EXP-2026-2001",
      status: "DISPOSED",
      classification: "NORMAL",
      recommendedAction: "APPROVE",
      dispositions: [CONSISTENT],
    });
    const detail = await serviceOf([disposed]).detail("c_disposed");
    expect(detail.disposition).toEqual({
      actorName: "陳初審",
      decidedAt: "2026-08-21T09:00:00.000Z",
      action: "ACCEPT",
      consistencyFlag: "CONSISTENT",
    });
  });

  it("returns the badge as persisted, not recomputed from the current suggestion", async () => {
    // Agent 現在建議 APPROVE，但處置紀錄固化的是 OVERRIDDEN（當時建議不同）。
    // 若實作改成重算，這裡會變成 CONSISTENT。
    const disposed = caseRow({
      id: "c_overridden",
      caseNumber: "EXP-2026-2005",
      status: "DISPOSED",
      classification: "NORMAL",
      recommendedAction: "APPROVE",
      dispositions: [{ ...CONSISTENT, consistencyFlag: "OVERRIDDEN" }],
    });
    const detail = await serviceOf([disposed]).detail("c_overridden");
    expect(detail.disposition?.consistencyFlag).toBe("OVERRIDDEN");
  });

  it("takes the latest disposition when a case has more than one", async () => {
    const twice = caseRow({
      id: "c_twice",
      caseNumber: "EXP-2026-2006",
      status: "DISPOSED",
      classification: "NORMAL",
      recommendedAction: "APPROVE",
      // Prisma 已用 orderBy desc + take 1 排好，較晚那筆在最前
      dispositions: [
        {
          actorName: "林複審",
          action: "MANUAL_JUDGEMENT",
          consistencyFlag: "HUMAN_ASSUMED",
          createdAt: "2026-08-22T10:00:00.000Z",
        },
      ],
    });
    const detail = await serviceOf([twice]).detail("c_twice");
    expect(detail.disposition?.actorName).toBe("林複審");
    expect(detail.disposition?.decidedAt).toBe("2026-08-22T10:00:00.000Z");
  });

  it("returns null for a case that has not been disposed", async () => {
    const queued = caseRow({
      id: "c_queued",
      caseNumber: "EXP-2026-2004",
      status: "QUEUED",
      classification: "HUMAN",
      recommendedAction: "MANUAL_REVIEW",
    });
    const detail = await serviceOf([queued]).detail("c_queued");
    expect(detail.disposition).toBeNull();
  });

  it("exposes the recorded department on the detail applicant block", async () => {
    const detail = await serviceOf([MISSING_AWAITING]).detail("c_missing");
    expect(detail.applicant.department).toBe("業務部");
  });
});

describe("CasesService history", () => {
  const WANG_A = caseRow({
    id: "c_a",
    caseNumber: "EXP-2026-2001",
    status: "DISPOSED",
    classification: "NORMAL",
    recommendedAction: "APPROVE",
    applicantName: "王小明",
    department: "業務部",
    applicationDate: "2026-08-20",
  });
  const WANG_B = caseRow({
    id: "c_b",
    caseNumber: "EXP-2026-2002",
    status: "QUEUED",
    classification: "EXCEPTION",
    recommendedAction: "MANUAL_REVIEW",
    applicantName: "王小明",
    department: "業務部",
    applicationDate: "2026-08-25",
  });
  const LI_NO_DEPT = caseRow({
    id: "c_c",
    caseNumber: "EXP-2026-2003",
    status: "QUEUED",
    classification: "HUMAN",
    recommendedAction: "MANUAL_REVIEW",
    applicantName: "李美華",
    department: null,
    applicationDate: "2026-08-10",
  });

  it("returns the applicant's cases newest first and includes the starting case", async () => {
    const res = await serviceOf([WANG_A, WANG_B, LI_NO_DEPT]).history("c_b", "applicant");
    expect(res.scope).toBe("applicant");
    expect(res.subject).toBe("王小明");
    expect(res.items.map((i) => i.caseNumber)).toEqual(["EXP-2026-2002", "EXP-2026-2001"]);
    expect(res.items.filter((i) => i.isCurrent).map((i) => i.id)).toEqual(["c_b"]);
  });

  it("scopes an applicant query to the same organization", async () => {
    const { service, calls } = makeService([WANG_A, WANG_B]);
    await service.history("c_a", "applicant");
    expect(calls[0]?.where?.organizationId).toBe("org_1");
    expect(calls[0]?.where?.applicantName).toBe("王小明");
  });

  it("asks the database for newest-first ordering rather than sorting in memory", async () => {
    const { service, calls } = makeService([WANG_A, WANG_B]);
    await service.history("c_a", "applicant");
    expect(calls[0]?.orderBy).toEqual([{ applicationDate: "desc" }, { caseNumber: "asc" }]);
  });

  it("prefers applicantCode over the name when the case has one", async () => {
    const coded = caseRow({
      id: "c_coded",
      caseNumber: "EXP-2026-2009",
      status: "QUEUED",
      classification: "NORMAL",
      recommendedAction: "APPROVE",
      applicantName: "王小明",
      applicantCode: "EMP-001",
    });
    const { service, calls } = makeService([coded]);
    await service.history("c_coded", "applicant");
    expect(calls[0]?.where?.applicantCode).toBe("EMP-001");
    expect(calls[0]?.where?.applicantName).toBeUndefined();
  });

  it("returns the department's cases", async () => {
    const res = await serviceOf([WANG_A, WANG_B, LI_NO_DEPT]).history("c_a", "department");
    expect(res.subject).toBe("業務部");
    expect(res.items.map((i) => i.caseNumber)).toEqual(["EXP-2026-2002", "EXP-2026-2001"]);
  });

  it("rejects a department query for a case with no department recorded", async () => {
    await expect(serviceOf([LI_NO_DEPT]).history("c_c", "department")).rejects.toThrow(
      /no department/i,
    );
  });

  it("returns a list of one (not 404) when the applicant has no other cases", async () => {
    const res = await serviceOf([LI_NO_DEPT]).history("c_c", "applicant");
    expect(res.items).toHaveLength(1);
    expect(res.items[0]?.isCurrent).toBe(true);
  });

  it("404s for an unknown case id", async () => {
    await expect(serviceOf([WANG_A]).history("nope", "applicant")).rejects.toThrow(/not found/i);
  });

  it("exposes only case fields — no risk score, frequency or verdict", async () => {
    const res = await serviceOf([WANG_A, WANG_B]).history("c_a", "applicant");
    expect(Object.keys(res).sort()).toEqual(["items", "scope", "subject"]);
    expect(Object.keys(res.items[0] ?? {}).sort()).toEqual([
      "amount",
      "applicationDate",
      "caseNumber",
      "caseStatus",
      "currency",
      "id",
      "isCurrent",
      "status",
    ]);
  });
});
