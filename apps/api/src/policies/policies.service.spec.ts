// PoliciesService — 「Agent 當前檢查依據」的組成測試。
//
// 手寫 fake Prisma 注入，不連 DB、不加套件（同 cases.service.spec.ts 作法）。
// 重點：
// - 只有 ACTIVE 版本的條文算「當前生效」。這個條件必須下在 Prisma `where` 上，
//   不是撈回後過濾——否則多版本一出現就會混進非生效的規則。
// - isSuspicionOnly / isGuardrail 取自 RuleDefinition（產品擁有），
//   **不得**由 clauseText 的字面推斷（那是組織後台可編輯的內容）。
// - 沒有 PolicyRule 的內建 guardrail 會被評估，所以必須出現在回應中；
//   而型錄裡沒有 ACTIVE 條文又非內建的 definition 不會被評估，不得出現。

import { PoliciesService } from "./policies.service";
import type { PrismaService } from "../prisma/prisma.service";

interface DefinitionFixture {
  code: string;
  /** 型錄的 i18n key 不一定由代碼推導（guardrail 用 rule.guard.*），所以可覆寫。 */
  nameKey?: string;
  isSuspicionOnly?: boolean;
  isGuardrail?: boolean;
  isActive?: boolean;
  descKey?: string | null;
}

function definition(f: DefinitionFixture) {
  return {
    id: `def_${f.code}`,
    code: f.code,
    nameKey: f.nameKey ?? `rule.${f.code}.name`,
    descKey: f.descKey ?? null,
    isSuspicionOnly: f.isSuspicionOnly ?? false,
    isGuardrail: f.isGuardrail ?? false,
    isActive: f.isActive ?? true,
  };
}

interface RuleFixture {
  ruleKey: string;
  definition: ReturnType<typeof definition>;
  versionStatus?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  clauseRef?: string | null;
  clauseText?: string;
  params?: Record<string, unknown>;
  isActive?: boolean;
  orderIndex?: number;
}

function policyRule(f: RuleFixture) {
  return {
    id: `pr_${f.ruleKey}`,
    ruleKey: f.ruleKey,
    clauseRef: f.clauseRef === undefined ? "§1.1" : f.clauseRef,
    clauseText: f.clauseText ?? "條文原文",
    params: f.params ?? {},
    isActive: f.isActive ?? true,
    orderIndex: f.orderIndex ?? 0,
    ruleDefinition: f.definition,
    // fake 只保留測試需要的關聯欄位
    policyVersion: { status: f.versionStatus ?? "ACTIVE" },
  };
}

type Rule = ReturnType<typeof policyRule>;
type Definition = ReturnType<typeof definition>;

interface RuleWhere {
  isActive?: boolean;
  policyVersion?: { status?: string };
}
interface DefinitionWhere {
  isGuardrail?: boolean;
  isActive?: boolean;
}

function makeService(rules: Rule[], definitions: Definition[]) {
  const ruleCalls: { where?: RuleWhere }[] = [];
  const definitionCalls: { where?: DefinitionWhere }[] = [];
  const prisma = {
    policyRule: {
      findMany: (args: { where?: RuleWhere; orderBy?: unknown } = {}) => {
        ruleCalls.push(args);
        const where = args.where ?? {};
        // fake 只實作本測試用到的條件；未實作的條件會讓斷言失敗而非靜默通過。
        const matched = rules.filter(
          (r) =>
            (where.isActive === undefined || r.isActive === where.isActive) &&
            (where.policyVersion?.status === undefined ||
              r.policyVersion.status === where.policyVersion.status),
        );
        return Promise.resolve([...matched].sort((a, b) => a.orderIndex - b.orderIndex));
      },
    },
    ruleDefinition: {
      findMany: (args: { where?: DefinitionWhere; orderBy?: unknown } = {}) => {
        definitionCalls.push(args);
        const where = args.where ?? {};
        const matched = definitions.filter(
          (d) =>
            (where.isGuardrail === undefined || d.isGuardrail === where.isGuardrail) &&
            (where.isActive === undefined || d.isActive === where.isActive),
        );
        return Promise.resolve([...matched].sort((a, b) => a.code.localeCompare(b.code)));
      },
    },
  };
  return {
    service: new PoliciesService(prisma as unknown as PrismaService),
    ruleCalls,
    definitionCalls,
  };
}

const DEF_R1 = definition({ code: "R1" });
const DEF_R4 = definition({ code: "R4" });
const DEF_R5 = definition({ code: "R5" }); // 型錄有、組織未設條文、非內建 → 不會被評估
const DEF_R7 = definition({ code: "R7", isSuspicionOnly: true });
const DEF_GUARD = definition({
  code: "GUARD_ELIGIBILITY",
  nameKey: "rule.guard.eligibility.name", // 與 seed 一致
  isGuardrail: true,
  descKey: "rule.guard.eligibility.desc",
});

describe("PoliciesService active version scoping", () => {
  it("puts the ACTIVE version condition into the Prisma where clause", async () => {
    const { service, ruleCalls } = makeService(
      [policyRule({ ruleKey: "R1-lodging", definition: DEF_R1 })],
      [],
    );
    await service.list();

    expect(ruleCalls).toHaveLength(1);
    expect(ruleCalls[0]?.where).toMatchObject({
      isActive: true,
      policyVersion: { status: "ACTIVE" },
    });
  });

  it("excludes rules that belong to a non-active policy version", async () => {
    const { service } = makeService(
      [
        policyRule({ ruleKey: "R1-lodging", definition: DEF_R1, versionStatus: "ACTIVE" }),
        policyRule({ ruleKey: "R4-draft", definition: DEF_R4, versionStatus: "DRAFT" }),
        policyRule({ ruleKey: "R4-old", definition: DEF_R4, versionStatus: "ARCHIVED" }),
      ],
      [],
    );
    const { items } = await service.list();

    expect(items.map((i) => i.ruleKey)).toEqual(["R1-lodging"]);
  });

  it("excludes deactivated rules of the active version", async () => {
    const { service } = makeService(
      [
        policyRule({ ruleKey: "R1-lodging", definition: DEF_R1 }),
        policyRule({ ruleKey: "R4-off", definition: DEF_R4, isActive: false }),
      ],
      [],
    );
    const { items } = await service.list();

    expect(items.map((i) => i.ruleKey)).toEqual(["R1-lodging"]);
  });
});

describe("PoliciesService rule-catalogue flags", () => {
  it("carries isSuspicionOnly and isGuardrail on every item", async () => {
    const { service } = makeService(
      [
        policyRule({ ruleKey: "R1-lodging", definition: DEF_R1, orderIndex: 0 }),
        policyRule({ ruleKey: "R7-duplicate", definition: DEF_R7, orderIndex: 1 }),
      ],
      [DEF_GUARD],
    );
    const { items } = await service.list();

    expect(items.map((i) => [i.ruleCode, i.isSuspicionOnly, i.isGuardrail])).toEqual([
      ["R1", false, false],
      ["R7", true, false],
      ["GUARD_ELIGIBILITY", false, true],
    ]);
  });

  it("keeps isSuspicionOnly true even when the clause text never says 疑似", async () => {
    // clauseText 是組織後台可編輯的內容。產品層 guardrail 不得依賴它的字面——
    // 客戶把條文改成不含「疑似」的字句時，標記必須還在。
    const { service } = makeService(
      [
        policyRule({
          ruleKey: "R7-duplicate",
          definition: DEF_R7,
          clauseText: "同單號＋同額＋同日 一律退回",
        }),
      ],
      [],
    );
    const { items } = await service.list();

    expect(items[0]?.clauseText).toBe("同單號＋同額＋同日 一律退回");
    expect(items[0]?.isSuspicionOnly).toBe(true);
  });

  it("returns i18n keys for name and description, not localized text", async () => {
    const { service } = makeService(
      [policyRule({ ruleKey: "R1-lodging", definition: DEF_R1 })],
      [DEF_GUARD],
    );
    const { items } = await service.list();

    expect(items.map((i) => i.nameKey)).toEqual(["rule.R1.name", "rule.guard.eligibility.name"]);
    expect(items.map((i) => i.descKey)).toEqual([null, "rule.guard.eligibility.desc"]);
  });
});

describe("PoliciesService built-in guardrails", () => {
  it("includes guardrails that have no policy clause at all", async () => {
    const { service, definitionCalls } = makeService([], [DEF_GUARD]);
    const { items } = await service.list();

    expect(definitionCalls[0]?.where).toMatchObject({ isGuardrail: true, isActive: true });
    expect(items).toHaveLength(1);
    expect(items[0]?.ruleCode).toBe("GUARD_ELIGIBILITY");
    expect(items[0]?.isGuardrail).toBe(true);
  });

  it("leaves clause fields empty on guardrail items", async () => {
    const { service } = makeService([], [DEF_GUARD]);
    const { items } = await service.list();

    expect(items[0]?.clauseRef).toBeNull();
    expect(items[0]?.clauseText).toBeNull();
  });

  it("lists a rule once when it somehow has both a clause and the guardrail flag", async () => {
    // 模型上不該發生，但 schema 並未禁止。真的同時存在時以條文型為準。
    const bothDef = definition({ code: "GUARD_ELIGIBILITY", isGuardrail: true });
    const { service } = makeService(
      [
        policyRule({
          ruleKey: "GUARD-with-clause",
          definition: bothDef,
          clauseRef: "§9.9",
          clauseText: "組織自訂的適格性條文",
        }),
      ],
      [bothDef],
    );
    const { items } = await service.list();

    expect(items).toHaveLength(1);
    expect(items[0]?.ruleKey).toBe("GUARD-with-clause");
    expect(items[0]?.clauseText).toBe("組織自訂的適格性條文");
  });

  it("omits catalogue rules that have neither an active clause nor the guardrail flag", async () => {
    // R5 存在於型錄，但組織沒設條文、也不是內建檢查 → 不會被評估，不得列出。
    const { service } = makeService(
      [policyRule({ ruleKey: "R1-lodging", definition: DEF_R1 })],
      [DEF_GUARD, DEF_R5],
    );
    const { items } = await service.list();

    expect(items.map((i) => i.ruleCode)).toEqual(["R1", "GUARD_ELIGIBILITY"]);
    expect(items.some((i) => i.ruleCode === "R5")).toBe(false);
  });

  it("orders clause items before guardrail items", async () => {
    const { service } = makeService(
      [
        policyRule({ ruleKey: "R4-invoice", definition: DEF_R4, orderIndex: 1 }),
        policyRule({ ruleKey: "R1-lodging", definition: DEF_R1, orderIndex: 0 }),
      ],
      [DEF_GUARD],
    );
    const { items } = await service.list();

    expect(items.map((i) => i.ruleCode)).toEqual(["R1", "R4", "GUARD_ELIGIBILITY"]);
  });
});

describe("PoliciesService category filter", () => {
  it("filters clause items by category and drops category-less guardrails", async () => {
    const { service } = makeService(
      [
        policyRule({
          ruleKey: "R1-lodging",
          definition: DEF_R1,
          params: { category: "住宿" },
          orderIndex: 0,
        }),
        policyRule({
          ruleKey: "R4-invoice",
          definition: DEF_R4,
          params: { category: "交際" },
          orderIndex: 1,
        }),
      ],
      [DEF_GUARD],
    );
    const { items } = await service.list("住宿");

    // 內建檢查不屬任何費用類別，依類別查詢時本就不該出現。
    expect(items.map((i) => i.ruleCode)).toEqual(["R1"]);
  });
});
