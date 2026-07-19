export type StudyHistorySeed = {
  id: string;
  language: "en" | "ja";
  date?: string;
  title: string;
  scope: string;
  status: "completed" | "in_progress";
  scoreLabel?: string;
  notes: string;
  nextReview?: string;
  source: "对话迁移";
};

export const CONVERSATION_PROGRESS: StudyHistorySeed[] = [
  {
    id: "history-en-foundation",
    language: "en",
    title: "Week 1 Day 1–Day 3 词汇学习",
    scope: "abandon 至 apprehend 的多组 TOEIC 词汇",
    status: "completed",
    scoreLabel: "历史成绩未完整记录",
    notes: "已完成单词讲解、搭配和多轮回忆；原对话无法确认每一组的准确学习日期，因此不补写虚假日期。",
    source: "对话迁移",
  },
  {
    id: "history-en-day2-check",
    language: "en",
    date: "2026-07-13",
    title: "Day 2 到期词汇抽测",
    scope: "adversity、affidavit、affordable、allergic、aftershock、aggressively 等",
    status: "completed",
    scoreLabel: "两轮均 6/6",
    notes: "两轮词义检查均全部正确；已按到期复习记录迁移。",
    nextReview: "2026-07-20",
    source: "对话迁移",
  },
  {
    id: "history-en-day2-part2",
    language: "en",
    date: "2026-07-13",
    title: "Day 2 Part 2 综合检测",
    scope: "当天 TOEIC 词汇综合应用",
    status: "completed",
    scoreLabel: "14/15 · 93.3%",
    notes: "该成绩来自对话中的明确检测结果。",
    nextReview: "2026-07-20",
    source: "对话迁移",
  },
  {
    id: "history-en-day4-day5",
    language: "en",
    date: "2026-07-16",
    title: "Week 1 Day 4–Day 5 词汇学习",
    scope: "arraignment 至 attentive / attentively",
    status: "completed",
    scoreLabel: "未记录统一成绩",
    notes: "已学习纵火、传讯、暗杀、组装、资产、同化、哮喘、天文学、达到和周到服务等词组。",
    nextReview: "2026-07-19",
    source: "对话迁移",
  },
  {
    id: "history-ja-lesson1",
    language: "ja",
    date: "2026-07-13",
    title: "《新日本语教程》第一课复习",
    scope: "第一课语法、替换句与口语听力",
    status: "completed",
    scoreLabel: "6/6",
    notes: "语法输出与替换句检查全部正确，后续口语与听力练习也已完成。",
    nextReview: "2026-07-20",
    source: "对话迁移",
  },
  {
    id: "history-ja-lesson5-start",
    language: "ja",
    date: "2026-07-15",
    title: "第五课单词学习",
    scope: "位置词、设施词、あります／います",
    status: "completed",
    scoreLabel: "分组练习已完成",
    notes: "完成小组记忆、位置表达造句和即时纠错；音调继续显示，但后续测试不要求填写音调编号。",
    nextReview: "2026-07-18",
    source: "对话迁移",
  },
  {
    id: "history-ja-lesson5-review",
    language: "ja",
    date: "2026-07-16",
    title: "第五课综合复习",
    scope: "地点＋方位词＋に＋あります／います",
    status: "completed",
    scoreLabel: "当日复习完成",
    notes: "已完成第五课语法和位置表达复习，代表句包括「郵便局の隣にコンビニがあります」。",
    nextReview: "2026-07-19",
    source: "对话迁移",
  },
  {
    id: "history-ja-lesson6-start",
    language: "ja",
    date: "2026-07-16",
    title: "第六课单词开始",
    scope: "一つ、三つ、八つ、しか、クラス、二人、五歳、枚、台、三枚",
    status: "in_progress",
    scoreLabel: "当前学习中",
    notes: "已经进入第六课数量词与助数词阶段；这些词作为当前新词导入。",
    nextReview: "2026-07-17",
    source: "对话迁移",
  },
];
