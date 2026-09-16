import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { PolicyListResponse, PolicyItem } from "@expense-review-agent/shared";

/**
 * PoliciesService — 費用規範列表（對應 API #7）。
 *
 * 回傳 Agent **當前會評估的全部檢查**，分兩層（見 specs/review-api「規範列表」）：
 *
 *   1. 組織條文型：ACTIVE 版本底下啟用中的 PolicyRule，帶條文參照與條文原文。
 *      條文原文是組織擁有的內容，原樣回傳、不 i18n。
 *   2. 產品內建型：isGuardrail 的 RuleDefinition。這類檢查**沒有 PolicyRule**
 *      （seed 的 GUARD_ELIGIBILITY 在案件檢查中以 policyRuleId: null 出現），
 *      但確實會被評估。只查 PolicyRule 會永遠漏掉它們，而一個宣稱列出「檢查依據」
 *      的回應漏掉會被評估的檢查，就是在誤導呼叫端。
 *
 * isSuspicionOnly / isGuardrail 一律取自 RuleDefinition（產品擁有）。**不得**由
 * clauseText 的字面推斷——那是組織後台可編輯的內容，拿它當產品層 guardrail 的依據，
 * 等於讓客戶改一行條文就把「不指控」原則關掉。
 *
 * 型錄中沒有 ACTIVE 條文、又不是內建檢查的 definition（例如 R5）不會出現在回應中：
 * 它們不會被評估，列出來會讓人以為那些檢查正在生效。
 */
@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(category?: string): Promise<PolicyListResponse> {
    const [rules, guardrails] = await Promise.all([
      this.prisma.policyRule.findMany({
        // 只有 ACTIVE 版本才是「當前生效」。單看 isActive 會在出現第二個
        // PolicyVersion（DRAFT／ARCHIVED）的那天，把非生效版本的規則混進來。
        where: { isActive: true, policyVersion: { status: "ACTIVE" } },
        orderBy: { orderIndex: "asc" },
        include: { ruleDefinition: true },
      }),
      this.prisma.ruleDefinition.findMany({
        where: { isGuardrail: true, isActive: true },
        orderBy: { code: "asc" },
      }),
    ]);

    const clauseItems: PolicyItem[] = rules.map((r) => {
      const params = (r.params as Record<string, unknown>) ?? {};
      return {
        ruleKey: r.ruleKey,
        ruleCode: r.ruleDefinition.code,
        nameKey: r.ruleDefinition.nameKey,
        descKey: r.ruleDefinition.descKey,
        clauseRef: r.clauseRef,
        clauseText: r.clauseText,
        // 類別可能存在 params.category；沒有就 null。
        category: (params.category as string) ?? null,
        params,
        violationHandling: null, // schema 未單獨存處理方式
        isSuspicionOnly: r.ruleDefinition.isSuspicionOnly,
        isGuardrail: r.ruleDefinition.isGuardrail,
      };
    });

    // 依規則代碼去重。模型上 guardrail 不該有 PolicyRule，但 schema 並未禁止；
    // 真的同時存在時以條文型為準（資訊較完整），不重複列出同一個檢查。
    const seenCodes = new Set(clauseItems.map((item) => item.ruleCode));
    const guardrailItems: PolicyItem[] = guardrails
      .filter((d) => !seenCodes.has(d.code))
      .map((d) => ({
        // guardrail 沒有 PolicyRule，因此沒有 ruleKey；以代碼作為穩定識別。
        ruleKey: d.code,
        ruleCode: d.code,
        nameKey: d.nameKey,
        descKey: d.descKey,
        // 沒有條文可引用。不以系統文案填補成條文。
        clauseRef: null,
        clauseText: null,
        category: null,
        params: {},
        violationHandling: null,
        isSuspicionOnly: d.isSuspicionOnly,
        isGuardrail: true,
      }));

    const items = [...clauseItems, ...guardrailItems];
    // category 篩選只對得上條文型項目（內建檢查不屬任何費用類別，category 為 null）。
    const filtered = category ? items.filter((i) => i.category === category) : items;
    return { items: filtered };
  }
}
