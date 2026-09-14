import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { PolicyListResponse, PolicyItem } from "@expense-review-agent/shared";

/**
 * PoliciesService — 費用規範列表（對應 API #7）。
 *
 * DEMO 級：讀目前 ACTIVE 版本底下的 PolicyRule。category 篩選為選用。
 */
@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(category?: string): Promise<PolicyListResponse> {
    const rules = await this.prisma.policyRule.findMany({
      where: { isActive: true },
      orderBy: { orderIndex: "asc" },
      include: { ruleDefinition: true },
    });

    const items: PolicyItem[] = rules.map((r) => {
      const params = (r.params as Record<string, unknown>) ?? {};
      return {
        ruleKey: r.ruleKey,
        ruleCode: r.ruleDefinition.code,
        name: r.ruleDefinition.nameKey, // i18n key；前端組字。DEMO 可直接顯示。
        clauseRef: r.clauseRef,
        clauseText: r.clauseText,
        // 類別可能存在 params.category；沒有就 null。
        category: (params.category as string) ?? null,
        params,
        violationHandling: null, // schema 未單獨存處理方式；DEMO 留 null 或之後補
      };
    });

    const filtered = category ? items.filter((i) => i.category === category) : items;
    return { items: filtered };
  }
}
