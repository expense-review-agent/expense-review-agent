// =============================================================================
// Demo 案例（模擬資料）
//
// 內容對齊 CheckMate Prototype 的 src/data/cases.ts：8 筆案件、預置的審查結果、
// 展示用模擬憑證。審查結果是「預置」的（source = PRESET），不是引擎算出來的。
// 所有案例使用同一套資料結構；寫入前由 seed 驗證與 shared 的產品規則一致。
// =============================================================================

import type { CheckResultData, FindingData } from "../../../../packages/shared/src/domain/types.ts";
import type { Recommendation } from "../../../../packages/shared/src/domain/vocabulary.ts";

export interface ReceiptFixture {
  key: string;
  vendor: string;
  amount: string;
  issueDate: string;
  hasTaxId: boolean;
}

export interface LineFixture {
  key: string;
  category: string;
  description: string;
  expenseDate: string;
  amount: string;
  receiptKeys: string[];
}

export interface ReviewFixture {
  key: string;
  /** 台北時間 YYYY-MM-DDTHH:mm */
  reviewedAt: string;
  recommendation: Recommendation;
  checks: CheckResultData[];
  findings: FindingData[];
  /** 當次審查時已提供的憑證 */
  receiptKeys: string[];
}

export interface CaseFixture {
  caseNumber: string;
  applicantName: string;
  employeeId: string;
  department: string;
  category: string;
  amount: string;
  expenseDate: string;
  submittedAt: string;
  summary: string;
  description: string;
  paymentMethod: string;
  scenario: string;
  lines: LineFixture[];
  receipts: ReceiptFixture[];
  /** 由舊到新 */
  reviews: ReviewFixture[];
}

// ---- 共用片段 ---------------------------------------------------------------

const receipt = (key: string, vendor: string, amount: string, hasTaxId = true): ReceiptFixture => ({
  key,
  vendor,
  amount,
  issueDate: "2026-09-18",
  hasTaxId,
});

const finding = (
  f: Omit<FindingData, "relatedCaseNumber" | "nextStep"> & Partial<FindingData>,
): FindingData => ({
  relatedCaseNumber: null,
  nextStep: null,
  ...f,
});

const missingReceipt = finding({
  key: "missing-receipt",
  dimension: "EVIDENCE_MATCH",
  kind: "MISSING",
  title: "缺少必要的住宿憑證",
  explanation: "申請資料中沒有住宿憑證，尚無法核對實際支出金額。",
  ruleCode: "P-02",
  ruleText: "模擬企業規範 P-02｜住宿費須檢附住宿憑證。",
  comparison: [
    ["必要附件", "住宿憑證"],
    ["目前附件", "0 份"],
  ],
  nextStep: "請補充住宿憑證。",
});

const EVIDENCE_OK: CheckResultData = {
  dimension: "EVIDENCE_MATCH",
  status: "PASS",
  summary: "申請與憑證金額一致",
};
const POLICY_OK: CheckResultData = {
  dimension: "CORPORATE_POLICY",
  status: "PASS",
  summary: "金額符合此類別示範上限",
};
const COMPLIANCE_NA: CheckResultData = {
  dimension: "COMPLIANCE",
  status: "NOT_APPLICABLE",
  summary: "不適用：申請金額未達 NT$3,000 示範門檻，未執行憑證格式檢查。",
};
const RISK_OK: CheckResultData = {
  dimension: "RISK_SIGNAL",
  status: "PASS",
  summary: "示範比對資料中未發現重複訊號",
};

/** 有 Finding 的面向，檢核結論顯示 Finding 標題。 */
const failed = (f: FindingData): CheckResultData => ({
  dimension: f.dimension,
  status: f.kind === "UNDETERMINED" ? "UNDETERMINED" : "FAIL",
  summary: f.title,
});

const missingLodgingChecks = (): CheckResultData[] => [
  failed(missingReceipt),
  { dimension: "CORPORATE_POLICY", status: "PASS", summary: "申請金額符合住宿費上限 NT$3,000" },
  {
    dimension: "COMPLIANCE",
    status: "NOT_APPLICABLE",
    summary: "不適用：申請金額未達示範格式檢查門檻",
  },
  RISK_OK,
];

/** 單筆費用的案件：以案件本身作為唯一一筆明細，對應案件所有憑證。 */
function singleLine(
  c: Pick<CaseFixture, "caseNumber" | "category" | "description" | "expenseDate" | "amount">,
  receiptKeys: string[],
): LineFixture[] {
  return [
    {
      key: c.caseNumber,
      category: c.category,
      description: c.description,
      expenseDate: c.expenseDate,
      amount: c.amount,
      receiptKeys,
    },
  ];
}

/** 列表「申報項目」：沒有另外提供摘要時，取用途說明去掉標點。 */
const summaryOf = (description: string) => description.replace(/[，。]/g, "");

const REVIEWED_AT = "2026-09-21T09:30";
const PERSONAL_CARD = "員工代墊／個人信用卡";

function simpleCase(
  base: Omit<CaseFixture, "lines" | "summary" | "paymentMethod" | "submittedAt" | "expenseDate"> & {
    paymentMethod?: string;
  },
): CaseFixture {
  const expenseDate = "2026-09-18";
  return {
    ...base,
    expenseDate,
    submittedAt: "2026-09-21",
    summary: summaryOf(base.description),
    paymentMethod: base.paymentMethod ?? PERSONAL_CARD,
    lines: singleLine(
      { ...base, expenseDate },
      base.receipts.map((r) => r.key),
    ),
  };
}

// ---- 8 筆案例 ---------------------------------------------------------------

const amountMismatch = finding({
  key: "amount-mismatch",
  dimension: "EVIDENCE_MATCH",
  kind: "ANOMALY",
  title: "申請金額比憑證多 NT$200",
  explanation: "申請為 NT$1,680，憑證為 NT$1,480。金額不一致，需由人工確認差異原因。",
  ruleCode: "E-01",
  ruleText: "模擬比對規則 E-01｜申請金額須與憑證金額一致；本階段不設容許誤差。",
  comparison: [
    ["申請金額", "NT$1,680"],
    ["憑證金額", "NT$1,480"],
    ["差額", "NT$200"],
  ],
});

const policyLimit = finding({
  key: "policy-limit",
  dimension: "CORPORATE_POLICY",
  kind: "ANOMALY",
  title: "住宿費超出示範上限 NT$1,200",
  explanation: "本次一晚住宿費 NT$4,200，超出每晚 NT$3,000 的企業示範上限。",
  ruleCode: "P-01",
  ruleText: "模擬企業規範 P-01｜國內住宿費每晚以 NT$3,000 為上限。",
  comparison: [
    ["本次住宿費", "NT$4,200／晚"],
    ["企業示範上限", "NT$3,000／晚"],
  ],
});

const duplicate = finding({
  key: "duplicate",
  dimension: "RISK_SIGNAL",
  kind: "ANOMALY",
  title: "與既有案件 EXP-2026-018 疑似重複",
  explanation: "申請人、供應商、金額與費用日期皆相同。這是待確認的風險訊號，不代表已認定重複申報。",
  ruleCode: "R-01",
  ruleText: "模擬風險規則 R-01｜比對申請人、供應商、金額與日期，標示相同的既有案件。",
  comparison: [
    ["申請人", "兩案皆為李承恩"],
    ["供應商", "兩案皆為城際鐵路（模擬）"],
    ["金額／日期", "兩案皆為 NT$1,490／2026-09-18"],
  ],
  relatedCaseNumber: "EXP-2026-018",
});

const receiptFormat = finding({
  key: "receipt-format",
  dimension: "COMPLIANCE",
  kind: "ANOMALY",
  title: "憑證缺少統一編號欄位",
  explanation: "申請金額達到示範門檻，憑證未具備示範規則要求的統一編號欄位，需人工確認格式。",
  ruleCode: "C-01",
  ruleText:
    "示範格式規則 C-01｜金額達 NT$3,000 時檢查統一編號欄位。這是 Mock Policy，不代表真實法定門檻或稅務認定。",
  comparison: [
    ["申請金額", "NT$3,600"],
    ["示範門檻", "NT$3,000"],
    ["統一編號欄位", "缺少"],
  ],
});

const unknownCategory = finding({
  key: "unknown-category",
  dimension: "CORPORATE_POLICY",
  kind: "UNDETERMINED",
  title: "此費用類別尚無對應規範，需人工確認",
  explanation:
    "系統無法將「其他：研究材料」對應到規範，沒有對此項作出符合或違規判斷。請人工直接查閱原始申請與佐證。",
  ruleCode: null,
  ruleText: "輸入邊界｜此 Prototype 的示範類別僅包含交通費、住宿費、辦公用品。",
  comparison: [
    ["申請類別原始值", "其他：研究材料"],
    ["可套用的類別規範", "無法對應"],
  ],
});

const missingTransport = finding({
  key: "missing-transport",
  dimension: "EVIDENCE_MATCH",
  kind: "MISSING",
  title: "交通費 NT$480 未附憑證",
  explanation: "住宿憑證已提供，交通費尚無對應憑證。",
  ruleCode: "P-02",
  ruleText: "模擬企業規範 P-02｜住宿及交通費須檢附對應憑證。",
  comparison: [
    ["缺少附件", "09/19 交通憑證"],
    ["申請金額", "NT$480"],
  ],
  nextStep: "請補充 09/19 交通費 NT$480 的憑證。",
});

export const CASES: CaseFixture[] = [
  simpleCase({
    caseNumber: "EXP-2026-001",
    applicantName: "陳怡安",
    employeeId: "E-021",
    department: "業務部",
    category: "住宿費",
    amount: "2400",
    description: "台中客戶拜訪，出差住宿一晚。",
    scenario: "正常案件・曾重新審查",
    receipts: [receipt("EV-001", "晴川商旅（模擬）", "2400")],
    reviews: [
      {
        key: "REV-001-1",
        reviewedAt: "2026-09-20T15:10",
        recommendation: "REQUEST_INFO",
        checks: missingLodgingChecks(),
        findings: [missingReceipt],
        receiptKeys: [],
      },
      {
        key: "REV-001-2",
        reviewedAt: REVIEWED_AT,
        recommendation: "APPROVE",
        checks: [
          EVIDENCE_OK,
          {
            dimension: "CORPORATE_POLICY",
            status: "PASS",
            summary: "P-01｜住宿費 NT$2,400，未超過每晚 NT$3,000 上限",
          },
          COMPLIANCE_NA,
          RISK_OK,
        ],
        findings: [],
        receiptKeys: ["EV-001"],
      },
    ],
  }),
  simpleCase({
    caseNumber: "EXP-2026-002",
    applicantName: "林子晴",
    employeeId: "E-028",
    department: "行銷部",
    category: "住宿費",
    amount: "2800",
    description: "高雄展會支援，出差住宿一晚。",
    scenario: "缺少必要附件",
    receipts: [],
    reviews: [
      {
        key: "REV-002-1",
        reviewedAt: REVIEWED_AT,
        recommendation: "REQUEST_INFO",
        checks: missingLodgingChecks(),
        findings: [missingReceipt],
        receiptKeys: [],
      },
    ],
  }),
  simpleCase({
    caseNumber: "EXP-2026-003",
    applicantName: "王柏翰",
    employeeId: "E-032",
    department: "產品部",
    category: "交通費",
    amount: "1680",
    description: "新竹供應商會議，往返交通費。",
    scenario: "申請與憑證金額不一致",
    receipts: [receipt("EV-003", "城際客運（模擬）", "1480")],
    reviews: [
      {
        key: "REV-003-1",
        reviewedAt: REVIEWED_AT,
        recommendation: "MANUAL_REVIEW",
        checks: [failed(amountMismatch), POLICY_OK, COMPLIANCE_NA, RISK_OK],
        findings: [amountMismatch],
        receiptKeys: ["EV-003"],
      },
    ],
  }),
  simpleCase({
    caseNumber: "EXP-2026-004",
    applicantName: "張雅婷",
    employeeId: "E-041",
    department: "業務部",
    category: "住宿費",
    amount: "4200",
    description: "台南客戶專案訪談，出差住宿一晚。",
    scenario: "超出企業費用上限",
    receipts: [receipt("EV-004", "南方旅店（模擬）", "4200")],
    reviews: [
      {
        key: "REV-004-1",
        reviewedAt: REVIEWED_AT,
        recommendation: "MANUAL_REVIEW",
        checks: [
          EVIDENCE_OK,
          // 詳情的檢查清單以「企業上限」稱呼，與 CheckMate 畫面一致
          { ...failed(policyLimit), summary: "住宿費超出企業上限 NT$1,200" },
          { dimension: "COMPLIANCE", status: "PASS", summary: "已核對示範統一編號欄位，格式完整" },
          RISK_OK,
        ],
        findings: [policyLimit],
        receiptKeys: ["EV-004"],
      },
    ],
  }),
  simpleCase({
    caseNumber: "EXP-2026-005",
    applicantName: "李承恩",
    employeeId: "E-052",
    department: "設計部",
    category: "交通費",
    amount: "1490",
    description: "台中設計工作坊，出差交通費。",
    scenario: "疑似重複申報",
    receipts: [receipt("EV-005", "城際鐵路（模擬）", "1490")],
    reviews: [
      {
        key: "REV-005-1",
        reviewedAt: REVIEWED_AT,
        recommendation: "MANUAL_REVIEW",
        checks: [EVIDENCE_OK, POLICY_OK, COMPLIANCE_NA, failed(duplicate)],
        findings: [duplicate],
        receiptKeys: ["EV-005"],
      },
    ],
  }),
  simpleCase({
    caseNumber: "EXP-2026-006",
    applicantName: "許家瑜",
    employeeId: "E-063",
    department: "行政部",
    category: "辦公用品",
    amount: "3600",
    description: "辦公室文具及耗材採購。",
    scenario: "憑證格式不完整",
    paymentMethod: "公司公務卡",
    receipts: [receipt("EV-006", "日常文具（模擬）", "3600", false)],
    reviews: [
      {
        key: "REV-006-1",
        reviewedAt: REVIEWED_AT,
        recommendation: "MANUAL_REVIEW",
        checks: [EVIDENCE_OK, POLICY_OK, failed(receiptFormat), RISK_OK],
        findings: [receiptFormat],
        receiptKeys: ["EV-006"],
      },
    ],
  }),
  simpleCase({
    caseNumber: "EXP-2026-007",
    applicantName: "周宇辰",
    employeeId: "E-071",
    department: "研發部",
    category: "其他：研究材料",
    amount: "1800",
    description: "研究專案材料採購，費用類別尚未對應企業規範。",
    scenario: "系統無法判斷",
    receipts: [receipt("EV-007", "創研材料（模擬）", "1800")],
    reviews: [
      {
        key: "REV-007-1",
        reviewedAt: REVIEWED_AT,
        recommendation: "MANUAL_REVIEW",
        checks: [EVIDENCE_OK, failed(unknownCategory), COMPLIANCE_NA, RISK_OK],
        findings: [unknownCategory],
        receiptKeys: ["EV-007"],
      },
    ],
  }),
  {
    caseNumber: "EXP-2026-008",
    applicantName: "林子晴",
    employeeId: "E-028",
    department: "業務部",
    category: "差旅費",
    amount: "3280",
    expenseDate: "2026-09-18",
    submittedAt: "2026-09-21",
    summary: "台中客戶拜訪住宿及交通",
    description: "台中客戶年度合作會議，住宿一晚及隔日前往客戶公司之交通費。",
    paymentMethod: PERSONAL_CARD,
    scenario: "多筆費用缺少一份憑證",
    lines: [
      {
        key: "L008-1",
        category: "住宿費",
        description: "晴川商旅住宿一晚",
        expenseDate: "2026-09-18",
        amount: "2800",
        receiptKeys: ["EV-008"],
      },
      {
        key: "L008-2",
        category: "交通費",
        description: "飯店至客戶公司計程車",
        expenseDate: "2026-09-19",
        amount: "480",
        receiptKeys: [],
      },
    ],
    receipts: [receipt("EV-008", "晴川商旅（模擬）", "2800")],
    reviews: [
      {
        key: "REV-008-1",
        reviewedAt: REVIEWED_AT,
        recommendation: "REQUEST_INFO",
        checks: [
          failed(missingTransport),
          {
            dimension: "CORPORATE_POLICY",
            status: "PASS",
            summary: "住宿費未超過每晚 NT$3,000 上限",
          },
          {
            dimension: "COMPLIANCE",
            status: "NOT_APPLICABLE",
            summary: "不適用：各筆費用未達示範格式檢查門檻",
          },
          { dimension: "RISK_SIGNAL", status: "PASS", summary: "比對資料中未發現重複訊號" },
        ],
        findings: [missingTransport],
        receiptKeys: ["EV-008"],
      },
    ],
  },
];
