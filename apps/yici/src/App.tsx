"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import {
  BarChart3,
  BookMarked,
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  CircleAlert,
  ChevronRight,
  Clock3,
  Cloud,
  CloudOff,
  DatabaseBackup,
  Download,
  FileDown,
  FileText,
  FileBarChart,
  Flame,
  Highlighter,
  Headphones,
  House,
  Import,
  Languages,
  LibraryBig,
  Moon,
  Mic,
  MoreHorizontal,
  Newspaper,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Sun,
  SunMoon,
  Target,
  ListChecks,
  Smartphone,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { createClient, type User } from "@supabase/supabase-js";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STUDY_VOCABULARY } from "./initial-data";
import { CONVERSATION_PROGRESS, StudyHistorySeed } from "./initial-progress";

type Language = "en" | "ja";
type WordStatus = "new" | "learning" | "mastered";
type Tab = "today" | "library" | "stories" | "mistakes" | "stats";
type Rating = "again" | "hard" | "good" | "easy";
type ThemeSetting = "dark" | "light" | "system";

type Word = {
  id: string;
  language: Language;
  term: string;
  reading: string;
  accent?: number;
  pitch?: string;
  accentVerified?: boolean;
  meaning: string;
  partOfSpeech: string;
  example: string;
  translation: string;
  tags: string[];
  status: WordStatus;
  dueDate: string;
  interval: number;
  stability: number;
  reviewCount: number;
  lapseCount: number;
  lastReviewed?: string;
  createdAt: string;
  favorite?: boolean;
};

type ReviewLog = {
  id: string;
  wordId: string;
  timestamp: string;
  rating: Rating;
  correct: boolean;
  nextDue: string;
  interval: number;
};

type PracticeLog = {
  id: string;
  language: Language;
  type: "listening" | "pronunciation";
  timestamp: string;
  wordId: string;
  correct: boolean;
  score: number;
};

type TrainingMode = "listening" | "pronunciation";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Story = {
  id: string;
  language: Language;
  title: string;
  content: string;
  translation: string;
  targetWords: string[];
  tags: string[];
  createdAt: string;
};

type StoryProgress = {
  completed: boolean;
  unfamiliar: string[];
  clozeScore?: number;
  updatedAt: string;
};

type ImportError = { row: number; term: string; reason: string };
type ImportPreview = {
  words: Word[];
  errors: ImportError[];
  newCount: number;
  duplicateCount: number;
  internalDuplicateCount: number;
  sourceName: string;
};

type SyncStatus = "loading" | "synced" | "saving" | "offline" | "signed-out" | "error";

type StoredState = {
  words: Word[];
  logs: ReviewLog[];
  history?: StudyHistorySeed[];
  dailyNewLimit?: number;
  dailyNewLimits?: Record<Language, number>;
  studyLanguage?: Language;
  stories?: Story[];
  storyProgress?: Record<string, StoryProgress>;
  practiceLogs?: PracticeLog[];
  schemaVersion?: number;
  savedAt?: string;
};

const STORAGE_KEY = "yici-learning-state-v1";
const THEME_KEY = "yici-theme";
const LANGUAGE_KEY = "yici-study-language";
const PROGRESS_MIGRATION_KEY = "yici-conversation-progress-v1";
const SNAPSHOTS_KEY = "yici-learning-snapshots-v1";
const CLOUD_OWNER_KEY = "yici-cloud-owner-v1";
const MIGRATION_DATE = "2026-07-17";
const APP_BASE_URL = import.meta.env.BASE_URL;
const BLOG_URL = APP_BASE_URL.replace(/yici\/?$/, "") || "/";
const ACCOUNT_URL = `${BLOG_URL}account/`;
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const SUPABASE_PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
const supabase = SUPABASE_CONFIGURED
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "pkce" },
    })
  : null;

function shiftIsoDay(base: string, days: number) {
  const date = new Date(`${base}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const INITIAL_STORIES: Story[] = [
  {
    id: "story-en-day4",
    language: "en",
    title: "A Report from the Courthouse",
    content: "After the arraignment, the assailant was questioned about an arson case. Investigators found that the fire had started near a warehouse filled with artificial materials. The report helped the legal team understand the sequence of events.",
    translation: "传讯结束后，袭击者因一起纵火案接受询问。调查人员发现，大火从一座存放人造材料的仓库附近开始。这份报告帮助法律团队了解了事件的先后顺序。",
    targetWords: ["arraignment", "assailant", "arson", "artificial"],
    tags: ["TOEIC", "Week 1 Day 4", "综合复习"],
    createdAt: "2026-07-16",
  },
  {
    id: "story-ja-lesson5",
    language: "ja",
    title: "駅の近く",
    content: "駅の近くに郵便局があります。郵便局の隣にコンビニがあり、向こうには自転車屋があります。公園のベンチのそばに犬がいます。男の人は店員にトイレの入り口を聞きました。",
    translation: "车站附近有邮局。邮局旁边有便利店，对面有自行车店。公园长椅旁边有一只狗。那位男士向店员询问了洗手间的入口。",
    targetWords: ["駅", "郵便局", "隣", "コンビニ", "向こう", "自転車屋", "公園", "ベンチ", "そば", "犬", "男の人", "店員", "トイレ", "入り口"],
    tags: ["日语初级", "第5课", "位置表达"],
    createdAt: "2026-07-16",
  },
];

function isoDay(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function shiftDay(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return isoDay(date);
}

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEMO_WORDS: Word[] = [
  {
    id: "ja-yuubinkyoku",
    language: "ja",
    term: "郵便局",
    reading: "ゆうびんきょく",
    accent: 0,
    pitch: "LHHHHH",
    meaning: "邮局",
    partOfSpeech: "名词",
    example: "郵便局の隣にコンビニがあります。",
    translation: "邮局旁边有便利店。",
    tags: ["日语初级", "第5课"],
    status: "learning",
    dueDate: shiftDay(0),
    interval: 2,
    stability: 4.2,
    reviewCount: 3,
    lapseCount: 0,
    lastReviewed: shiftDay(-2),
    createdAt: shiftDay(-8),
    favorite: true,
  },
  {
    id: "ja-uriba",
    language: "ja",
    term: "売り場",
    reading: "うりば",
    accent: 0,
    pitch: "LHH",
    meaning: "柜台；售货处",
    partOfSpeech: "名词",
    example: "靴の売り場は二階です。",
    translation: "鞋类柜台在二楼。",
    tags: ["日语初级", "第5课"],
    status: "learning",
    dueDate: shiftDay(0),
    interval: 1,
    stability: 2.5,
    reviewCount: 2,
    lapseCount: 1,
    lastReviewed: shiftDay(-1),
    createdAt: shiftDay(-6),
  },
  {
    id: "ja-tenin",
    language: "ja",
    term: "店員",
    reading: "てんいん",
    accent: 0,
    pitch: "LHHH",
    meaning: "店员",
    partOfSpeech: "名词",
    example: "店員に聞きました。",
    translation: "我问了店员。",
    tags: ["日语初级", "第5课"],
    status: "new",
    dueDate: shiftDay(0),
    interval: 0,
    stability: 1,
    reviewCount: 0,
    lapseCount: 0,
    createdAt: shiftDay(-2),
  },
  {
    id: "ja-zasshi",
    language: "ja",
    term: "雑誌",
    reading: "ざっし",
    accent: 0,
    pitch: "LHH",
    meaning: "杂志",
    partOfSpeech: "名词",
    example: "机の上に雑誌があります。",
    translation: "桌子上有杂志。",
    tags: ["日语初级", "第5课"],
    status: "new",
    dueDate: shiftDay(0),
    interval: 0,
    stability: 1,
    reviewCount: 0,
    lapseCount: 0,
    createdAt: shiftDay(-2),
  },
  {
    id: "en-accessible",
    language: "en",
    term: "accessible",
    reading: "/əkˈsesəbəl/",
    meaning: "可进入的；易获得的",
    partOfSpeech: "adj.",
    example: "The station is easily accessible by bus.",
    translation: "乘公交可以方便地到达车站。",
    tags: ["TOEIC", "Day 2"],
    status: "learning",
    dueDate: shiftDay(0),
    interval: 4,
    stability: 6.8,
    reviewCount: 4,
    lapseCount: 1,
    lastReviewed: shiftDay(-4),
    createdAt: shiftDay(-12),
  },
  {
    id: "en-adjacent",
    language: "en",
    term: "adjacent",
    reading: "/əˈdʒeɪsənt/",
    meaning: "邻近的；毗连的",
    partOfSpeech: "adj.",
    example: "The meeting room is adjacent to the lobby.",
    translation: "会议室紧邻大厅。",
    tags: ["TOEIC", "Day 2"],
    status: "learning",
    dueDate: shiftDay(-1),
    interval: 2,
    stability: 3.2,
    reviewCount: 3,
    lapseCount: 2,
    lastReviewed: shiftDay(-3),
    createdAt: shiftDay(-10),
  },
  {
    id: "en-accountant",
    language: "en",
    term: "accountant",
    reading: "/əˈkaʊntənt/",
    meaning: "会计师；会计",
    partOfSpeech: "n.",
    example: "The accountant prepared the annual report.",
    translation: "会计编制了年度报告。",
    tags: ["TOEIC", "Day 2"],
    status: "new",
    dueDate: shiftDay(0),
    interval: 0,
    stability: 1,
    reviewCount: 0,
    lapseCount: 0,
    createdAt: shiftDay(-1),
  },
  {
    id: "en-accumulate",
    language: "en",
    term: "accumulate",
    reading: "/əˈkjuːmjəleɪt/",
    meaning: "积累；积聚",
    partOfSpeech: "v.",
    example: "Employees accumulate paid leave each month.",
    translation: "员工每月累积带薪休假。",
    tags: ["TOEIC", "Day 2"],
    status: "new",
    dueDate: shiftDay(0),
    interval: 0,
    stability: 1,
    reviewCount: 0,
    lapseCount: 0,
    createdAt: shiftDay(-1),
  },
];

const INITIAL_WORDS: Word[] = STUDY_VOCABULARY.map((seed, index) => {
  const learned = seed.phase === "learned";
  return {
    id: `seed-${seed.language}-${index}`,
    language: seed.language,
    term: seed.term,
    reading: seed.reading ?? "",
    accent: seed.accent,
    pitch: seed.pitch,
    accentVerified: seed.accentVerified,
    meaning: seed.meaning,
    partOfSpeech: seed.partOfSpeech,
    example: seed.example ?? "",
    translation: seed.translation ?? "",
    tags: [...seed.tags, "对话迁移"],
    status: learned ? "learning" : "new",
    dueDate: learned ? shiftIsoDay(MIGRATION_DATE, index % 7) : MIGRATION_DATE,
    interval: learned ? 1 : 0,
    stability: learned ? 2 : 1,
    reviewCount: learned ? 1 : 0,
    lapseCount: 0,
    createdAt: MIGRATION_DATE,
  };
});

const navItems: { id: Tab; label: string; icon: typeof CalendarDays }[] = [
  { id: "today", label: "今日学习", icon: CalendarDays },
  { id: "library", label: "词库", icon: LibraryBig },
  { id: "stories", label: "词汇短文", icon: Newspaper },
  { id: "mistakes", label: "错词本", icon: BookMarked },
  { id: "stats", label: "学习数据", icon: BarChart3 },
];

const ratingConfig: Record<Rating, { label: string; hint: string }> = {
  again: { label: "忘记", hint: "当天重现" },
  hard: { label: "困难", hint: "缩短间隔" },
  good: { label: "记住", hint: "正常间隔" },
  easy: { label: "简单", hint: "延长间隔" },
};

function daysBetween(from?: string, to = new Date()) {
  if (!from) return 0;
  const start = new Date(from.length === 10 ? `${from}T00:00:00` : from);
  return Math.max(0, (to.getTime() - start.getTime()) / 86_400_000);
}

function retention(word: Word) {
  if (!word.lastReviewed) return word.status === "new" ? 100 : 70;
  return Math.max(10, Math.round(100 * Math.exp(-daysBetween(word.lastReviewed) / Math.max(1, word.stability))));
}

function getMora(reading: string) {
  const small = "ゃゅょぁぃぅぇぉャュョァィゥェォ";
  const result: string[] = [];
  for (const char of reading.replace(/[・\s]/g, "")) {
    if (small.includes(char) && result.length) result[result.length - 1] += char;
    else result.push(char);
  }
  return result;
}

function pitchLevels(reading: string, accent = 0, manual?: string) {
  const mora = getMora(reading);
  if (manual && manual.length >= mora.length) {
    return mora.map((_, index) => manual[index]?.toUpperCase() === "H");
  }
  if (accent === 0) return mora.map((_, index) => index > 0);
  if (accent === 1) return mora.map((_, index) => index === 0);
  return mora.map((_, index) => index > 0 && index < accent);
}

function PitchAccent({ word, compact = false }: { word: Word; compact?: boolean }) {
  if (word.language !== "ja") return null;
  if (word.accent === undefined) {
    return <span className="accent-pending">语调待校对</span>;
  }
  const mora = getMora(word.reading);
  const levels = pitchLevels(word.reading, word.accent, word.pitch);
  return (
    <div className={`pitch-accent ${compact ? "compact" : ""}`} aria-label={`${word.accent ?? 0}型语调：${word.reading}`}>
      {mora.map((item, index) => (
        <span className={`mora ${levels[index] ? "high" : "low"}`} key={`${item}-${index}`}>
          <i />
          <b>{item}</b>
        </span>
      ))}
    </div>
  );
}

function MemoryCurve({ word, large = false }: { word: Word; large?: boolean }) {
  const r = retention(word);
  const points = large
    ? "8,18 58,70 96,80 98,40 150,75 192,88 194,52 246,84 292,99"
    : "4,12 40,50 66,57 68,28 105,52 140,64 142,38 180,62 210,72";
  return (
    <div className={`curve-wrap ${large ? "large" : ""}`}>
      <svg viewBox={large ? "0 0 300 110" : "0 0 214 80"} role="img" aria-label={`当前预计记忆保持率 ${r}%`}>
        <defs>
          <linearGradient id={`curveFill-${word.id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity=".24" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="curve-grid" d={large ? "M0 28H300M0 56H300M0 84H300" : "M0 20H214M0 40H214M0 60H214"} />
        <polyline className="curve-line" points={points} />
        <circle className="curve-point" cx={large ? 194 : 142} cy={large ? 52 : 38} r="4" />
      </svg>
      <div className="curve-meta">
        <span>预计保持率</span>
        <strong>{r}%</strong>
      </div>
    </div>
  );
}

function StatRing({ value }: { value: number }) {
  return (
    <div className="stat-ring" style={{ "--value": `${Math.min(100, value) * 3.6}deg` } as React.CSSProperties}>
      <span>{value}%</span>
    </div>
  );
}

function speak(word: Word) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word.language === "ja" ? word.reading || word.term : word.term);
  utterance.lang = word.language === "ja" ? "ja-JP" : "en-US";
  utterance.rate = word.language === "ja" ? 0.78 : 0.86;
  window.speechSynthesis.speak(utterance);
}

function mergeStoredWords(stored: Word[]) {
  const merged = new Map(INITIAL_WORDS.map((word) => [`${word.language}:${word.term.toLowerCase()}`, word]));
  const legacyDemoIds = new Set(["ja-yuubinkyoku", "ja-uriba", "ja-tenin", "ja-zasshi", "en-accessible", "en-adjacent", "en-accountant", "en-accumulate"]);
  for (const saved of stored) {
    if (legacyDemoIds.has(saved.id)) continue;
    const key = `${saved.language}:${saved.term.toLowerCase()}`;
    merged.set(key, { ...merged.get(key), ...saved });
  }
  return Array.from(merged.values());
}

function applyConversationProgress(items: Word[]) {
  const seedByKey = new Map(STUDY_VOCABULARY.map((seed, index) => [`${seed.language}:${seed.term.toLowerCase()}`, { seed, index }]));
  return items.map((word) => {
    const entry = seedByKey.get(`${word.language}:${word.term.toLowerCase()}`);
    if (!entry) return word;
    const tags = Array.from(new Set([...entry.seed.tags, ...word.tags, "对话迁移"]));
    if (entry.seed.phase === "learned" && word.status === "new" && word.reviewCount === 0) {
      return { ...word, tags, status: "learning" as WordStatus, dueDate: shiftDay(entry.index % 7), interval: 1, stability: 2, reviewCount: 1 };
    }
    return { ...word, tags };
  });
}

function userStorageKey(userId: string) {
  return `${STORAGE_KEY}:${userId}`;
}

function isStoredState(value: unknown): value is StoredState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as StoredState;
  return Array.isArray(candidate.words) && Array.isArray(candidate.logs);
}

function parseStoredState(key: string) {
  try {
    const value = localStorage.getItem(key);
    if (!value) return null;
    const parsed = JSON.parse(value) as unknown;
    return isStoredState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function mergeById<T extends { id: string }>(older: T[] = [], newer: T[] = []) {
  const merged = new Map(older.map((item) => [item.id, item]));
  newer.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
}

function mergeStoryProgress(older: Record<string, StoryProgress> = {}, newer: Record<string, StoryProgress> = {}) {
  const merged = { ...older };
  Object.entries(newer).forEach(([key, value]) => {
    const current = merged[key];
    if (!current || new Date(value.updatedAt).getTime() >= new Date(current.updatedAt).getTime()) merged[key] = value;
  });
  return merged;
}

function stateTimestamp(state: StoredState | null) {
  const timestamp = state?.savedAt ? new Date(state.savedAt).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergeStoredStates(local: StoredState, remote: StoredState) {
  const remoteIsNewer = stateTimestamp(remote) >= stateTimestamp(local);
  const older = remoteIsNewer ? local : remote;
  const newer = remoteIsNewer ? remote : local;
  return {
    words: mergeStoredWords([...(older.words ?? []), ...(newer.words ?? [])]),
    logs: mergeById(older.logs, newer.logs),
    practiceLogs: mergeById(older.practiceLogs, newer.practiceLogs),
    history: mergeById(older.history, newer.history),
    stories: mergeById(older.stories, newer.stories),
    storyProgress: mergeStoryProgress(older.storyProgress, newer.storyProgress),
    dailyNewLimits: newer.dailyNewLimits ?? older.dailyNewLimits,
    studyLanguage: newer.studyLanguage ?? older.studyLanguage,
    schemaVersion: 4,
    savedAt: new Date(Math.max(stateTimestamp(local), stateTimestamp(remote), Date.now())).toISOString(),
  } satisfies StoredState;
}

function syncFingerprint(state: StoredState) {
  const { savedAt: _savedAt, ...content } = state;
  return JSON.stringify(content);
}

function starterStoredState() {
  return {
    words: INITIAL_WORDS,
    logs: [],
    practiceLogs: [],
    history: CONVERSATION_PROGRESS,
    stories: INITIAL_STORIES,
    storyProgress: {},
    dailyNewLimits: { en: 10, ja: 10 },
    studyLanguage: "en",
    schemaVersion: 4,
  } satisfies StoredState;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [words, setWords] = useState<Word[]>(INITIAL_WORDS);
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [history, setHistory] = useState<StudyHistorySeed[]>(CONVERSATION_PROGRESS);
  const [stories, setStories] = useState<Story[]>(INITIAL_STORIES);
  const [storyProgress, setStoryProgress] = useState<Record<string, StoryProgress>>({});
  const [dailyNewLimits, setDailyNewLimits] = useState<Record<Language, number>>({ en: 10, ja: 10 });
  const [studyLanguage, setStudyLanguage] = useState<Language>("en");
  const [hydrated, setHydrated] = useState(false);
  const [theme, setTheme] = useState<ThemeSetting>("dark");
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [duplicateMode, setDuplicateMode] = useState<"update" | "skip">("update");
  const [storyImportOpen, setStoryImportOpen] = useState(false);
  const [storyImportStatus, setStoryImportStatus] = useState("");
  const [storyDraft, setStoryDraft] = useState({ title: "", targetWords: "", tags: "", content: "", translation: "" });
  const [reviewQueue, setReviewQueue] = useState<Word[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const [greeting, setGreeting] = useState("下午好");
  const [today, setToday] = useState(MIGRATION_DATE);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [backupStatus, setBackupStatus] = useState("");
  const [trainingMode, setTrainingMode] = useState<TrainingMode | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [appInstalled, setAppInstalled] = useState(false);
  const activeStorageKeyRef = useRef(STORAGE_KEY);
  const localSnapshotRef = useRef<StoredState | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const identityInitializedRef = useRef(false);
  const lastSyncedFingerprintRef = useRef("");

  const applyStoredState = useCallback((saved: StoredState) => {
    if (Array.isArray(saved.words)) setWords(applyConversationProgress(mergeStoredWords(saved.words)));
    if (Array.isArray(saved.logs)) setLogs(saved.logs);
    if (Array.isArray(saved.practiceLogs)) setPracticeLogs(saved.practiceLogs);
    if (Array.isArray(saved.history)) {
      const mergedHistory = new Map(CONVERSATION_PROGRESS.map((item) => [item.id, item]));
      saved.history.forEach((item) => mergedHistory.set(item.id, item));
      setHistory(Array.from(mergedHistory.values()));
    }
    if (Array.isArray(saved.stories)) {
      const mergedStories = new Map(INITIAL_STORIES.map((story) => [story.id, story]));
      saved.stories.forEach((story) => mergedStories.set(story.id, story));
      setStories(Array.from(mergedStories.values()));
    }
    setStoryProgress(saved.storyProgress ?? {});
    if (saved.dailyNewLimits) setDailyNewLimits(saved.dailyNewLimits);
    else if (saved.dailyNewLimit) setDailyNewLimits({ en: saved.dailyNewLimit, ja: saved.dailyNewLimit });
    if (saved.studyLanguage) setStudyLanguage(saved.studyLanguage);
  }, []);

  const currentStoredState = () => ({
    words,
    logs,
    practiceLogs,
    history,
    stories,
    storyProgress,
    dailyNewLimits,
    studyLanguage,
    schemaVersion: 4,
    savedAt: new Date().toISOString(),
  } satisfies StoredState);

  useEffect(() => {
    const saved = parseStoredState(STORAGE_KEY);
    localSnapshotRef.current = saved;
    if (saved) applyStoredState(saved);
    const savedTheme = localStorage.getItem(THEME_KEY) as ThemeSetting | null;
    if (savedTheme) setTheme(savedTheme);
    const savedLanguage = localStorage.getItem(LANGUAGE_KEY) as Language | null;
    if (savedLanguage === "en" || savedLanguage === "ja") setStudyLanguage(savedLanguage);
    const hour = new Date().getHours();
    setGreeting(hour < 6 ? "夜深了" : hour < 12 ? "上午好" : hour < 18 ? "下午好" : "晚上好");
    setToday(isoDay());
    setHydrated(true);
    localStorage.setItem(PROGRESS_MIGRATION_KEY, "completed");
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${APP_BASE_URL}sw.js`).catch(() => undefined);
  }, [applyStoredState]);

  useEffect(() => {
    if (!hydrated) return;
    if (!supabase) {
      setSyncStatus("offline");
      setCloudReady(true);
      return;
    }
    let cancelled = false;
    const syncForUser = async (user: User | null) => {
      if (cancelled) return;
      const nextUserId = user?.id ?? null;
      if (identityInitializedRef.current && currentUserIdRef.current === nextUserId) return;
      identityInitializedRef.current = true;
      currentUserIdRef.current = nextUserId;
      setCloudUser(user);
      setCloudReady(false);
      lastSyncedFingerprintRef.current = "";

      if (!user) {
        activeStorageKeyRef.current = STORAGE_KEY;
        const anonymous = parseStoredState(STORAGE_KEY);
        if (anonymous) applyStoredState(anonymous);
        else applyStoredState(starterStoredState());
        setSyncStatus("signed-out");
        setCloudReady(true);
        return;
      }

      setSyncStatus("loading");
      const scopedKey = userStorageKey(user.id);
      activeStorageKeyRef.current = scopedKey;
      const scopedState = parseStoredState(scopedKey);
      const legacyOwner = localStorage.getItem(CLOUD_OWNER_KEY);
      const legacyState = !scopedState && (!legacyOwner || legacyOwner === user.id) ? localSnapshotRef.current : null;
      const localState = scopedState ?? legacyState ?? starterStoredState();
      if (scopedState || legacyState) applyStoredState(localState);

      try {
        const { data, error } = await supabase
          .from("yici_states")
          .select("state,updated_at")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (error) throw error;
        const remoteState = isStoredState(data?.state)
          ? { ...data.state, savedAt: data.state.savedAt ?? data.updated_at }
          : null;
        const merged = remoteState ? mergeStoredStates(localState, remoteState) : { ...localState, schemaVersion: 4, savedAt: new Date().toISOString() };
        const { error: saveError } = await supabase.from("yici_states").upsert({
          owner_id: user.id,
          state: merged,
          schema_version: 4,
        }, { onConflict: "owner_id" });
        if (saveError) throw saveError;
        if (cancelled) return;
        applyStoredState(merged);
        localStorage.setItem(scopedKey, JSON.stringify(merged));
        localSnapshotRef.current = merged;
        lastSyncedFingerprintRef.current = syncFingerprint(merged);
        if (legacyState && !scopedState) {
          localStorage.setItem(CLOUD_OWNER_KEY, user.id);
          localStorage.removeItem(STORAGE_KEY);
        }
        setSyncStatus("synced");
        setBackupStatus("已连接账户，学习进度会自动跨设备同步。");
      } catch (error) {
        if (cancelled) return;
        applyStoredState(localState);
        localStorage.setItem(scopedKey, JSON.stringify(localState));
        localSnapshotRef.current = localState;
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        setSyncStatus(code === "42P01" || code === "PGRST205" ? "error" : "offline");
        setBackupStatus(code === "42P01" || code === "PGRST205" ? "云端数据表尚未创建，请先执行 Supabase 迁移。" : "云端暂时不可用，进度已安全保存在本机，联网后会再次同步。");
      } finally {
        if (!cancelled) setCloudReady(true);
      }
    };
    void supabase.auth.getSession().then(({ data }) => syncForUser(data.session?.user ?? null));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (nextUserId !== currentUserIdRef.current) window.setTimeout(() => void syncForUser(session?.user ?? null), 0);
    });
    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [applyStoredState, hydrated]);

  useEffect(() => {
    if (!hydrated || !cloudReady) return;
    const state = currentStoredState();
    localStorage.setItem(activeStorageKeyRef.current, JSON.stringify(state));
    localStorage.setItem(LANGUAGE_KEY, studyLanguage);
    localSnapshotRef.current = state;
    if (!supabase || !cloudUser) return;
    const fingerprint = syncFingerprint(state);
    if (fingerprint === lastSyncedFingerprintRef.current) return;
    const timer = window.setTimeout(async () => {
      setSyncStatus("saving");
      try {
        const { error } = await supabase.from("yici_states").upsert({ owner_id: cloudUser.id, state, schema_version: 4 }, { onConflict: "owner_id" });
        if (error) throw error;
        lastSyncedFingerprintRef.current = fingerprint;
        setSyncStatus("synced");
        const snapshotKey = `${SNAPSHOTS_KEY}:${cloudUser.id}`;
        const snapshots = JSON.parse(localStorage.getItem(snapshotKey) || "[]") as StoredState[];
        const last = snapshots.at(-1)?.savedAt;
        if (!last || Date.now() - new Date(last).getTime() > 300_000) {
          localStorage.setItem(snapshotKey, JSON.stringify([...snapshots, state].slice(-5)));
        }
      } catch {
        setSyncStatus("offline");
        setBackupStatus("云端保存失败，最新进度仍保留在本机，将在下次修改时重试。");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [words, logs, practiceLogs, history, stories, storyProgress, dailyNewLimits, studyLanguage, hydrated, cloudReady, cloudUser]);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setAppInstalled(standalone);
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const installed = () => { setAppInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };
    applyTheme();
    localStorage.setItem(THEME_KEY, theme);
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  const selectedWords = useMemo(() => words.filter((word) => word.language === studyLanguage), [words, studyLanguage]);
  const selectedWordIds = useMemo(() => new Set(selectedWords.map((word) => word.id)), [selectedWords]);
  const selectedLogs = useMemo(() => logs.filter((log) => selectedWordIds.has(log.wordId)), [logs, selectedWordIds]);
  const selectedPracticeLogs = useMemo(() => practiceLogs.filter((log) => log.language === studyLanguage), [practiceLogs, studyLanguage]);
  const selectedStories = useMemo(() => stories.filter((story) => story.language === studyLanguage), [stories, studyLanguage]);
  const selectedHistory = useMemo(() => history.filter((item) => item.language === studyLanguage), [history, studyLanguage]);
  const dailyNewLimit = dailyNewLimits[studyLanguage];
  const languageName = studyLanguage === "en" ? "TOEIC 英语" : "日语 N3";
  const learnerName = cloudUser?.user_metadata?.full_name
    || cloudUser?.user_metadata?.user_name
    || cloudUser?.email?.split("@")[0]
    || "学习者";
  const dueWords = useMemo(
    () => selectedWords.filter((word) => word.status !== "new" && word.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [selectedWords, today],
  );
  const newWords = useMemo(() => selectedWords.filter((word) => word.status === "new"), [selectedWords]);
  const mistakeWords = useMemo(() => selectedWords.filter((word) => word.lapseCount > 0).sort((a, b) => b.lapseCount - a.lapseCount), [selectedWords]);
  const todayLogs = useMemo(() => selectedLogs.filter((log) => isoDay(new Date(log.timestamp)) === today), [selectedLogs, today]);
  const todayCorrect = todayLogs.filter((log) => log.correct).length;
  const todayAccuracy = todayLogs.length ? Math.round((todayCorrect / todayLogs.length) * 100) : 0;
  const todayTarget = Math.max(1, dueWords.length + Math.min(dailyNewLimit, newWords.length) + todayLogs.length);
  const todayProgress = Math.min(100, Math.round((todayLogs.length / todayTarget) * 100));
  const featured = studyLanguage === "ja"
    ? selectedWords.find((word) => word.term === "郵便局") ?? selectedWords[0]
    : selectedWords.find((word) => word.term === "arraignment") ?? selectedWords[0];

  const filteredWords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return selectedWords.filter((word) => {
      const haystack = `${word.term} ${word.reading} ${word.meaning} ${word.tags.join(" ")}`.toLowerCase();
      return !query || haystack.includes(query);
    });
  }, [selectedWords, search]);

  const switchLanguage = (language: Language) => {
    setStudyLanguage(language);
    setActiveTab("today");
    setSearch("");
    setReviewQueue([]);
    setSessionDone(false);
  };

  const startReview = () => {
    const overdueMistakes = mistakeWords.filter((word) => word.dueDate <= today);
    const combined = [...overdueMistakes, ...dueWords, ...newWords.slice(0, dailyNewLimit)];
    const queue = Array.from(new Map(combined.map((word) => [word.id, word])).values());
    if (!queue.length) {
      setSessionDone(true);
      setSessionTotal(0);
      return;
    }
    setReviewQueue(queue);
    setSessionTotal(queue.length);
    setShowAnswer(false);
    setSessionDone(false);
  };

  const startQueue = (queue: Word[]) => {
    const unique = Array.from(new Map(queue.map((word) => [word.id, word])).values());
    setReviewQueue(unique);
    setSessionTotal(unique.length);
    setShowAnswer(false);
    setSessionDone(!unique.length);
  };

  const rateWord = (rating: Rating) => {
    const current = reviewQueue[0];
    if (!current) return;
    const oldInterval = current.interval;
    const nextInterval =
      rating === "again"
        ? 0
        : rating === "hard"
          ? Math.max(1, Math.round(Math.max(1, oldInterval) * 1.3))
          : rating === "good"
            ? oldInterval === 0
              ? 1
              : Math.max(oldInterval + 1, Math.round(oldInterval * 2.1))
            : oldInterval === 0
              ? 3
              : Math.max(oldInterval + 2, Math.round(oldInterval * 3));
    const nextDue = shiftDay(nextInterval);
    const stabilityFactor = { again: 0.65, hard: 1.2, good: 1.85, easy: 2.6 }[rating];
    const updated: Word = {
      ...current,
      status: nextInterval >= 15 ? "mastered" : "learning",
      dueDate: nextDue,
      interval: nextInterval,
      stability: Math.max(0.7, Number((Math.max(1, current.stability) * stabilityFactor).toFixed(2))),
      reviewCount: current.reviewCount + 1,
      lapseCount: current.lapseCount + (rating === "again" ? 1 : 0),
      lastReviewed: new Date().toISOString(),
    };
    setWords((items) => items.map((word) => (word.id === current.id ? updated : word)));
    setLogs((items) => [
      ...items,
      {
        id: uid("log"),
        wordId: current.id,
        timestamp: new Date().toISOString(),
        rating,
        correct: rating !== "again",
        nextDue,
        interval: nextInterval,
      },
    ]);
    const rest = reviewQueue.slice(1);
    const nextQueue = rating === "again" ? [...rest, updated] : rest;
    setReviewQueue(nextQueue);
    setShowAnswer(false);
    if (!nextQueue.length) setSessionDone(true);
  };

  const closeReview = () => {
    setReviewQueue([]);
    setSessionDone(false);
    setSessionTotal(0);
    setShowAnswer(false);
  };

  const rowsToWords = (rows: Record<string, unknown>[], sourceName = "粘贴内容") => {
    const get = (row: Record<string, unknown>, keys: string[]) => {
      for (const key of keys) if (row[key] !== undefined && row[key] !== null) return String(row[key]).trim();
      return "";
    };
    const errors: ImportError[] = [];
    const seen = new Set<string>();
    let internalDuplicateCount = 0;
    const imported = rows
      .map((row, index): Word | null => {
        const term = get(row, ["term", "单词", "词汇", "日语", "英语"]);
        if (!term) {
          errors.push({ row: index + 2, term: "—", reason: "term 为空（必填）" });
          return null;
        }
        const language: Language = studyLanguage;
        const rawAccent = get(row, ["accent", "语调", "声调", "音调型"]);
        if (language === "ja" && rawAccent && !/^\d+$/.test(rawAccent)) {
          errors.push({ row: index + 2, term, reason: "accent 必须是 0、1、2…等数字" });
          return null;
        }
        const key = `${language}:${term.toLowerCase()}`;
        if (seen.has(key)) {
          internalDuplicateCount += 1;
          errors.push({ row: index + 2, term, reason: "文件内重复，已保留第一次出现" });
          return null;
        }
        seen.add(key);
        const accentValue = rawAccent.replace(/[^0-9]/g, "");
        return {
          id: uid(language),
          language,
          term,
          reading: get(row, ["reading", "pronunciation", "读音", "假名", "音标"]),
          accent: language === "ja" && accentValue ? Number(accentValue) : undefined,
          pitch: get(row, ["pitch", "高低音", "pitch_pattern"]) || undefined,
          accentVerified: language === "ja" ? Boolean(accentValue) : undefined,
          meaning: get(row, ["meaning", "释义", "中文", "意思"]),
          partOfSpeech: get(row, ["part_of_speech", "pos", "词性"]),
          example: get(row, ["example", "例句"]),
          translation: get(row, ["translation", "例句翻译", "翻译"]),
          tags: get(row, ["tags", "标签"]).split(/[,，;；]/).map((tag) => tag.trim()).filter(Boolean),
          status: "new",
          dueDate: today,
          interval: 0,
          stability: 1,
          reviewCount: 0,
          lapseCount: 0,
          createdAt: today,
        };
      })
      .filter((word): word is Word => Boolean(word));
    if (!imported.length) {
      setImportStatus("没有识别到单词，请检查表头或内容。可先下载模板。");
      setImportPreview({ words: [], errors, newCount: 0, duplicateCount: 0, internalDuplicateCount, sourceName });
      return;
    }
    const keys = new Set(words.map((word) => `${word.language}:${word.term.toLowerCase()}`));
    const duplicateCount = imported.filter((word) => keys.has(`${word.language}:${word.term.toLowerCase()}`)).length;
    const preview = { words: imported, errors, newCount: imported.length - duplicateCount, duplicateCount, internalDuplicateCount, sourceName };
    setImportPreview(preview);
    setImportStatus(`预检完成：新增 ${preview.newCount}，已有 ${duplicateCount}，错误 ${errors.length}。确认后才会写入词库。`);
  };

  const confirmImport = () => {
    if (!importPreview?.words.length) return;
    setWords((existing) => {
      const index = new Map(existing.map((word) => [`${word.language}:${word.term.toLowerCase()}`, word]));
      for (const incoming of importPreview.words) {
        const key = `${incoming.language}:${incoming.term.toLowerCase()}`;
        const saved = index.get(key);
        if (!saved) index.set(key, incoming);
        else if (duplicateMode === "update") index.set(key, {
          ...saved,
          reading: incoming.reading || saved.reading,
          accent: incoming.accent ?? saved.accent,
          pitch: incoming.pitch || saved.pitch,
          accentVerified: incoming.accent !== undefined ? true : saved.accentVerified,
          meaning: incoming.meaning || saved.meaning,
          partOfSpeech: incoming.partOfSpeech || saved.partOfSpeech,
          example: incoming.example || saved.example,
          translation: incoming.translation || saved.translation,
          tags: Array.from(new Set([...saved.tags, ...incoming.tags])),
        });
      }
      return Array.from(index.values());
    });
    setImportStatus(`导入完成：新增 ${importPreview.newCount} 个，${duplicateMode === "update" ? `更新 ${importPreview.duplicateCount} 个且保留学习进度` : `跳过 ${importPreview.duplicateCount} 个`}。`);
    setImportPreview(null);
    setImportText("");
  };

  const downloadImportErrors = () => {
    if (!importPreview?.errors.length) return;
    const csv = ["row,term,reason", ...importPreview.errors.map((item) => `${item.row},"${item.term.replaceAll('"', '""')}","${item.reason.replaceAll('"', '""')}"`)].join("\n");
    downloadBlob("忆词-导入错误报告.csv", `\ufeff${csv}`, "text/csv;charset=utf-8");
  };

  const parseWorkbook = async (input: ArrayBuffer | string, type: "array" | "string", sourceName = "粘贴内容") => {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(input, { type });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    rowsToWords(rows, sourceName);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportStatus(`正在读取 ${file.name}…`);
    try {
      await parseWorkbook(await file.arrayBuffer(), "array", file.name);
    } catch {
      setImportStatus("文件读取失败，请使用 .xlsx、.xls、.csv 或 .tsv 文件。");
    }
    event.target.value = "";
  };

  const importPasted = async () => {
    if (!importText.trim()) return setImportStatus("请先粘贴带表头的 CSV 或制表符内容。");
    try {
      await parseWorkbook(importText, "string", "粘贴内容");
    } catch {
      setImportStatus("内容解析失败，请检查首行表头和分隔符。");
    }
  };

  const downloadTemplate = () => {
    const content = studyLanguage === "ja"
      ? "term,reading,accent,pitch,meaning,part_of_speech,example,translation,tags\n郵便局,ゆうびんきょく,,,邮局,名词,郵便局の隣にコンビニがあります。,邮局旁边有便利店。,第5课"
      : "term,reading,meaning,part_of_speech,example,translation,tags\naccessible,/əkˈsesəbəl/,可进入的；易获得的,adj.,The station is accessible.,车站很容易到达。,TOEIC";
    downloadBlob(`忆词-${studyLanguage === "ja" ? "日语" : "英语"}-导入模板.csv`, `\ufeff${content}`, "text/csv;charset=utf-8");
  };

  const parseStoryTemplate = (raw: string) => {
    const normalized = raw.replace(/\r\n/g, "\n");
    const readField = (names: string[]) => {
      const line = normalized.split("\n").find((item) => names.some((name) => item.trim().toLowerCase().startsWith(`${name.toLowerCase()}:`) || item.trim().startsWith(`${name}：`)));
      return line?.replace(/^[^:：]+[:：]\s*/, "").trim() ?? "";
    };
    const bodyMatch = normalized.match(/(?:正文|content)[:：]\s*\n?([\s\S]*?)(?=\n(?:翻译|translation)[:：]|$)/i);
    const translationMatch = normalized.match(/(?:翻译|translation)[:：]\s*\n?([\s\S]*)$/i);
    return {
      title: readField(["标题", "title"]),
      targetWords: readField(["目标词", "target_words", "keywords"]),
      tags: readField(["标签", "tags"]),
      content: bodyMatch?.[1]?.trim() ?? "",
      translation: translationMatch?.[1]?.trim() ?? "",
    };
  };

  const handleStoryFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseStoryTemplate(await file.text());
      setStoryDraft(parsed);
      setStoryImportStatus(parsed.title && parsed.content ? `已读取 ${file.name}，请确认后保存。` : "文件已读取，但标题或正文为空，请按模板补充。");
    } catch {
      setStoryImportStatus("短文文件读取失败，请使用 UTF-8 编码的 .txt 文件。");
    }
    event.target.value = "";
  };

  const saveStory = () => {
    if (!storyDraft.title.trim() || !storyDraft.content.trim()) {
      setStoryImportStatus("标题和正文为必填项，请补充后再保存。");
      return;
    }
    const splitList = (value: string) => value.split(/[,，;；、\n]/).map((item) => item.trim()).filter(Boolean);
    const story: Story = {
      id: uid(`story-${studyLanguage}`),
      language: studyLanguage,
      title: storyDraft.title.trim(),
      content: storyDraft.content.trim(),
      translation: storyDraft.translation.trim(),
      targetWords: splitList(storyDraft.targetWords),
      tags: splitList(storyDraft.tags),
      createdAt: today,
    };
    setStories((items) => [...items, story]);
    setStoryImportStatus(`《${story.title}》已保存到${languageName}词汇短文。`);
    setStoryDraft({ title: "", targetWords: "", tags: "", content: "", translation: "" });
  };

  const downloadStoryTemplate = () => {
    const sample = studyLanguage === "ja"
      ? "标题：駅の近く\n目标词：駅、郵便局、隣、コンビニ\n标签：第5课、位置表达\n正文：\n駅の近くに郵便局があります。郵便局の隣にコンビニがあります。\n翻译：\n车站附近有邮局。邮局旁边有便利店。"
      : "标题：A Day at the Courthouse\n目标词：arraignment, arson, artificial, assailant\n标签：TOEIC, Week 1 Day 4\n正文：\nAfter the arraignment, the assailant answered questions about the arson case.\n翻译：\n传讯后，袭击者回答了有关纵火案的问题。";
    downloadBlob(`忆词-${studyLanguage === "ja" ? "日语" : "英语"}-短文模板.txt`, `\ufeff${sample}`, "text/plain;charset=utf-8");
  };

  const exportData = () => downloadBlob(`忆词-${languageName}-学习数据.json`, JSON.stringify({ words: selectedWords, logs: selectedLogs, practiceLogs: selectedPracticeLogs, history: selectedHistory, stories: selectedStories, dailyNewLimit }, null, 2), "application/json");

  const exportFullBackup = () => {
    const state: StoredState = { words, logs, practiceLogs, history, stories, storyProgress, dailyNewLimits, studyLanguage, schemaVersion: 3, savedAt: new Date().toISOString() };
    downloadBlob(`忆词-完整备份-${today}.json`, JSON.stringify(state, null, 2), "application/json");
    setBackupStatus("完整备份已下载，可用于换设备或数据恢复。");
  };

  const restoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const restored = JSON.parse(await file.text()) as StoredState;
      if (!Array.isArray(restored.words) || !Array.isArray(restored.logs)) throw new Error("invalid");
      setWords(applyConversationProgress(mergeStoredWords(restored.words)));
      setLogs(restored.logs);
      setPracticeLogs(Array.isArray(restored.practiceLogs) ? restored.practiceLogs : []);
      setHistory(Array.isArray(restored.history) ? restored.history : CONVERSATION_PROGRESS);
      setStories(Array.isArray(restored.stories) ? restored.stories : INITIAL_STORIES);
      setStoryProgress(restored.storyProgress ?? {});
      if (restored.dailyNewLimits) setDailyNewLimits(restored.dailyNewLimits);
      if (restored.studyLanguage) setStudyLanguage(restored.studyLanguage);
      setBackupStatus(`已从 ${file.name} 恢复到本机。`);
    } catch {
      setBackupStatus("恢复失败：请选择由本 APP 导出的完整 JSON 备份。");
    }
    event.target.value = "";
  };

  const flagStoryWord = (term: string) => {
    const target = selectedWords.find((word) => word.term.toLowerCase() === term.toLowerCase());
    if (!target) return;
    setWords((items) => items.map((word) => word.id === target.id ? { ...word, status: "learning", dueDate: today, lapseCount: word.lapseCount + 1 } : word));
  };

  const updateStoryProgress = (storyId: string, patch: Partial<StoryProgress>) => {
    setStoryProgress((items) => {
      const current = items[storyId] ?? { completed: false, unfamiliar: [] };
      return { ...items, [storyId]: { ...current, ...patch, updatedAt: new Date().toISOString() } };
    });
  };

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setAppInstalled(true);
    setInstallPrompt(null);
  };

  const recordPractice = (entry: Omit<PracticeLog, "id" | "timestamp" | "language">) => {
    setPracticeLogs((items) => [...items, { ...entry, id: uid("practice"), timestamp: new Date().toISOString(), language: studyLanguage }]);
  };

  const toggleFavorite = (id: string) => setWords((items) => items.map((word) => (word.id === id ? { ...word, favorite: !word.favorite } : word)));

  return (
    <main className={`app-shell language-${studyLanguage}`}>
      <aside className="sidebar">
        <button className="brand" onClick={() => setActiveTab("today")} aria-label="返回今日学习">
          <span className="brand-mark"><i /><i /></span>
          <span>忆词</span>
        </button>
        <div className="language-spaces" role="group" aria-label="选择学习语言">
          <button className={studyLanguage === "en" ? "active" : ""} onClick={() => switchLanguage("en")}>
            <span className="space-icon">EN</span><span><strong>TOEIC 英语</strong><small>{words.filter((word) => word.language === "en").length} 个词</small></span>
          </button>
          <button className={studyLanguage === "ja" ? "active" : ""} onClick={() => switchLanguage("ja")}>
            <span className="space-icon">日</span><span><strong>日语 N3</strong><small>{words.filter((word) => word.language === "ja").length} 个词</small></span>
          </button>
        </div>
        <nav aria-label="主要导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={activeTab === item.id ? "active" : ""} onClick={() => setActiveTab(item.id)}>
                <Icon size={21} />
                <span>{item.label}</span>
                {item.id === "mistakes" && selectedWords.some((word) => word.lapseCount > 0) && <em>{selectedWords.filter((word) => word.lapseCount > 0).length}</em>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <a className="back-blog-link" href={BLOG_URL}>
            <House size={18} />
            <span>返回博客</span>
          </a>
          <div className="streak-chip"><Flame size={17} /> 连续学习 4 天</div>
          <label className="theme-control">
            {theme === "dark" ? <Moon size={18} /> : theme === "light" ? <Sun size={18} /> : <SunMoon size={18} />}
            <span>主题</span>
            <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeSetting)} aria-label="切换主题">
              <option value="dark">深色</option>
              <option value="light">浅色</option>
              <option value="system">跟随系统</option>
            </select>
          </label>
        </div>
      </aside>

      <section className="content">
        <div className="mobile-head">
          <button className="brand" onClick={() => setActiveTab("today")}><span className="brand-mark"><i /><i /></span><span>忆词</span></button>
          <div className="mobile-language-switch"><button className={studyLanguage === "en" ? "active" : ""} onClick={() => switchLanguage("en")}>EN</button><button className={studyLanguage === "ja" ? "active" : ""} onClick={() => switchLanguage("ja")}>日</button></div>
          <div className="mobile-head-actions">
            <a className="mobile-blog-link" href={BLOG_URL} aria-label="返回博客" title="返回博客"><House size={17} /><span>博客</span></a>
            <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeSetting)} aria-label="切换主题"><option value="dark">深色</option><option value="light">浅色</option><option value="system">系统</option></select>
          </div>
        </div>

        {activeTab === "today" && featured && (
          <div className="dashboard-grid page-enter">
            <section className="dashboard-main">
              <header className="page-header hero-header">
                <div><p className="eyebrow"><Sparkles size={15} /> {studyLanguage === "en" ? "TOEIC 420 → 600+" : "新日本语教程 · N3目标"}</p><h1>{greeting}，{learnerName}</h1><p>{languageName}独立学习空间 · 先完成到期复习，再开始新词。</p></div>
                {syncStatus === "signed-out"
                  ? <a className="sync-pill signed-out" href={ACCOUNT_URL} aria-label="登录后同步"><CloudOff size={16} /><span>登录后同步</span></a>
                  : <div className={`sync-pill ${syncStatus}`}>{syncStatus === "offline" || syncStatus === "error" ? <CloudOff size={16} /> : <Cloud size={16} />}<span>{syncStatus === "loading" ? "正在读取云端" : syncStatus === "saving" ? "正在保存" : syncStatus === "synced" ? "已同步" : syncStatus === "error" ? "需要配置云端" : "离线缓存"}</span></div>}
              </header>

              <div className="section-title"><span />今日概览</div>
              <div className="metric-grid">
                <article className="metric-card due"><span className="metric-icon"><Clock3 /></span><div><p>今日到期复习</p><strong>{dueWords.length}</strong><small>{dueWords.some((word) => word.dueDate < today) ? `含 ${dueWords.filter((word) => word.dueDate < today).length} 个逾期词` : "按计划巩固词汇"}</small></div></article>
                <article className="metric-card new"><span className="metric-icon"><BookOpen /></span><div><p>今日可学新词</p><strong>{Math.min(dailyNewLimit, newWords.length)}</strong><small>词库中还有 {newWords.length} 个新词</small></div></article>
              </div>
              <button className="primary-action" onClick={startReview}><span><Play size={22} fill="currentColor" /></span>{dueWords.length || newWords.length ? "开始今日复习" : "今日任务已完成"}<ChevronRight size={22} /></button>

              <article className="daily-plan-card">
                <div className="card-head"><div><p className="eyebrow"><ListChecks size={15} /> 按顺序完成</p><h2>今日学习任务</h2></div><span>{todayLogs.length} 次复习已记录</span></div>
                <div className="daily-task-list">
                  <button onClick={() => startQueue(dueWords)} disabled={!dueWords.length}><i>1</i><span><strong>到期复习</strong><small>{dueWords.length ? `${dueWords.length} 个待复习词` : "今天已清空"}</small></span><ChevronRight /></button>
                  <button onClick={() => startQueue(mistakeWords)} disabled={!mistakeWords.length}><i>2</i><span><strong>错词强化</strong><small>{mistakeWords.length ? `${mistakeWords.length} 个重点词` : "暂无错词"}</small></span><ChevronRight /></button>
                  <button onClick={() => startQueue(newWords.slice(0, dailyNewLimit))} disabled={!newWords.length}><i>3</i><span><strong>当前新词</strong><small>本组最多 {Math.min(dailyNewLimit, newWords.length)} 个</small></span><ChevronRight /></button>
                  <button onClick={() => setActiveTab("stories")} disabled={!selectedStories.length}><i>4</i><span><strong>综合短文</strong><small>{selectedStories.length ? `${selectedStories.length} 篇可练习` : "完成阶段词汇后添加"}</small></span><ChevronRight /></button>
                </div>
              </article>

              <div className="phase-two-actions">
                <article><span><Headphones /></span><div><strong>听力辨义</strong><small>先听发音，再选择正确释义</small></div><button onClick={() => setTrainingMode("listening")}>开始</button></article>
                <article><span><Mic /></span><div><strong>跟读发音</strong><small>{studyLanguage === "ja" ? "显示音调提示，不测试编号" : "识别发音并给出匹配度"}</small></div><button onClick={() => setTrainingMode("pronunciation")}>开始</button></article>
                <article><span><Smartphone /></span><div><strong>{appInstalled ? "已安装到设备" : "离线学习"}</strong><small>{appInstalled ? "可从桌面直接打开" : "缓存词库与学习页面"}</small></div><button onClick={installApp} disabled={appInstalled || !installPrompt}>{appInstalled ? "已安装" : installPrompt ? "安装" : "已启用"}</button></article>
              </div>

              <article className="progress-card">
                <div className="card-head"><h2>今日学习进度</h2><strong>{todayProgress}%</strong></div>
                <div className="progress-body">
                  <StatRing value={todayProgress} />
                  <div className="progress-detail"><div className="progress-track"><span style={{ width: `${todayProgress}%` }} /></div><div className="progress-stats"><p><span>已复习</span><strong>{todayLogs.length}</strong></p><p><span>正确率</span><strong>{todayAccuracy || "—"}{todayAccuracy ? "%" : ""}</strong></p><p><span>预计完成</span><strong>{Math.max(5, (dueWords.length + Math.min(dailyNewLimit, newWords.length)) * 1.2).toFixed(0)}<small> 分钟</small></strong></p></div></div>
                </div>
              </article>
              <p className="focus-note"><Brain size={20} /> 每次复习都会更新单词的稳定性和下一次复习日期。</p>
              <article className="migration-summary">
                <div><span className="migration-icon"><Check /></span><div><p className="eyebrow">对话学习进度已迁移</p><h2>{selectedHistory.filter((item) => item.status === "completed").length} 条已完成记录</h2><small>历史日期不明确的内容保留为“未确认”，没有补写虚假成绩。</small></div></div>
                <button onClick={() => setActiveTab("stats")}>查看时间线 <ChevronRight size={16} /></button>
              </article>
            </section>

            <aside className="featured-column">
              <article className="featured-word">
                <div className="word-actions"><span className={`language-badge ${featured.language}`}>{featured.language === "ja" ? "日语" : "英语"}</span><div><button onClick={() => toggleFavorite(featured.id)} aria-label="收藏单词"><Star size={20} fill={featured.favorite ? "currentColor" : "none"} /></button><button aria-label="更多选项"><MoreHorizontal size={21} /></button></div></div>
                <div className="word-center"><h2>{featured.term}</h2><p>{featured.reading}</p>{featured.language === "ja" && <>{featured.accent !== undefined && <span className="accent-badge">【{featured.accent}型】</span>}<PitchAccent word={featured} /></>}</div>
                <button className="meaning-row" onClick={() => speak(featured)}><Volume2 size={24} /><span>{featured.meaning}</span><small>播放读音</small></button>
                <div className="curve-section"><div className="card-head"><h3>记忆曲线</h3><span>复习点会抬升曲线</span></div><MemoryCurve word={featured} large /><div className="next-review"><Clock3 size={18} /><span>下次复习</span><strong>{featured.dueDate === today ? "今天" : featured.dueDate}</strong></div></div>
              </article>
            </aside>
          </div>
        )}

        {activeTab === "library" && (
          <section className="page-section page-enter">
            <header className="page-header"><div><p className="eyebrow"><Languages size={15} /> {languageName}独立词库</p><h1>{languageName}词库</h1><p>{studyLanguage === "ja" ? "已导入此前基础词汇和当前第5课；未核实的语调会明确标为待校对。" : "已导入此前学习词汇和当前 Week 1 Day 4 词汇。"}</p></div><button className="solid-button" onClick={() => setImportOpen(true)}><Import size={18} />导入至当前词库</button></header>
            <div className="library-toolbar separated"><label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`搜索${studyLanguage === "ja" ? "日语" : "英语"}单词、释义或标签`} /></label><span className={`workspace-pill ${studyLanguage}`}>{languageName}</span><button className="outline-button" onClick={exportData}><Download size={17} />备份本词库</button></div>
            <div className="library-summary"><span><strong>{selectedWords.length}</strong>本词库词汇</span><span><strong>{selectedWords.filter((word) => word.status === "learning").length}</strong>学习中</span><span><strong>{selectedWords.filter((word) => word.status === "new").length}</strong>当前新词</span>{studyLanguage === "ja" && <span><strong>{selectedWords.filter((word) => word.accent === undefined).length}</strong>语调待校对</span>}<label>每日新词 <input type="number" min="1" max="100" value={dailyNewLimit} onChange={(event) => setDailyNewLimits((limits) => ({ ...limits, [studyLanguage]: Math.max(1, Number(event.target.value)) }))} /></label></div>
            <details className="format-guide">
              <summary><FileText size={17} />查看手动导入词汇的格式要求</summary>
              <div className="format-guide-body">
                <p>使用 Excel、CSV 或 TSV；第一行必须是表头，每行一个词。<strong>term（单词）</strong>为必填，建议同时填写 meaning（释义）。文件请保存为 UTF-8。</p>
                <div className="field-chips"><span><b>term</b> 必填·单词</span><span><b>reading</b> 读音/音标</span><span><b>meaning</b> 中文释义</span><span><b>part_of_speech</b> 词性</span><span><b>example</b> 例句</span><span><b>translation</b> 例句翻译</span><span><b>tags</b> 标签</span>{studyLanguage === "ja" && <><span><b>accent</b> 语调型数字</span><span><b>pitch</b> 高低音如 LHHH</span></>}</div>
                <code>{studyLanguage === "ja" ? "term,reading,accent,pitch,meaning,part_of_speech,example,translation,tags" : "term,reading,meaning,part_of_speech,example,translation,tags"}</code>
              </div>
            </details>
            <div className="word-list">
              {filteredWords.map((word) => <WordRow key={word.id} word={word} onSpeak={() => speak(word)} onFavorite={() => toggleFavorite(word.id)} />)}
              {!filteredWords.length && <div className="empty-state"><Search size={32} /><h3>没有找到匹配的单词</h3><p>换一个关键词试试。</p></div>}
            </div>
          </section>
        )}

        {activeTab === "stories" && (
          <section className="page-section stories-page page-enter">
            <header className="page-header"><div><p className="eyebrow"><Newspaper size={15} /> 独立短文复习</p><h1>{languageName}词汇短文</h1><p>导入包含目标词的短文，系统会高亮目标词；英语与日语短文互不混合。</p></div><button className="solid-button" onClick={() => { setStoryImportOpen(true); setStoryImportStatus(""); }}><Import size={18} />导入短文</button></header>
            <article className="story-format-card">
              <div><span className="format-icon"><FileText /></span><div><h2>短文导入格式</h2><p>支持直接填写，也支持导入 UTF-8 的 .txt 模板。标题和正文必填，目标词、标签和翻译选填。</p></div></div>
              <code>标题：…　目标词：word1, word2　标签：…　正文：…　翻译：…</code>
              <button className="outline-button" onClick={downloadStoryTemplate}><FileDown size={17} />下载短文模板</button>
            </article>
            <div className="stories-summary"><span><strong>{selectedStories.length}</strong>篇短文</span><span><strong>{new Set(selectedStories.flatMap((story) => story.targetWords.map((word) => word.toLowerCase()))).size}</strong>个目标词</span><span><Highlighter size={16} />目标词自动高亮</span></div>
            <div className="story-list">
              {selectedStories.map((story) => <StoryCard key={story.id} story={story} words={selectedWords} progress={storyProgress[story.id]} onFlagWord={flagStoryWord} onProgress={(patch) => updateStoryProgress(story.id, patch)} />)}
              {!selectedStories.length && <div className="empty-state wide"><Newspaper size={36} /><h3>还没有{languageName}短文</h3><p>导入一篇包含本阶段词汇的短文，开始综合复习。</p></div>}
            </div>
          </section>
        )}

        {activeTab === "mistakes" && (
          <section className="page-section page-enter">
            <header className="page-header"><div><p className="eyebrow"><RotateCcw size={15} /> {languageName}错词独立管理</p><h1>{languageName}错词本</h1><p>优先处理反复遗忘的词，降低相似词干扰。</p></div><button className="solid-button" onClick={() => startQueue(mistakeWords)}><Play size={18} />强化复习</button></header>
            <div className="mistake-grid">
              {selectedWords.filter((word) => word.lapseCount > 0).sort((a, b) => b.lapseCount - a.lapseCount).map((word) => <article className="mistake-card" key={word.id}><div><span className={`language-badge ${word.language}`}>{word.language === "ja" ? "日语" : "英语"}</span><em>错误 {word.lapseCount} 次</em></div><h2>{word.term}</h2><p>{word.reading}{word.language === "ja" ? word.accent === undefined ? " · 语调待校对" : ` · ${word.accent}型` : ""}</p><strong>{word.meaning}</strong><div className="mistake-footer"><span>当前保持率 {retention(word)}%</span><span>下次 {word.dueDate <= today ? "今天" : word.dueDate}</span></div></article>)}
              {!selectedWords.some((word) => word.lapseCount > 0) && <div className="empty-state wide"><Check size={36} /><h3>暂时没有错词</h3><p>继续保持，新的答题记录会自动同步到这里。</p></div>}
            </div>
          </section>
        )}

        {activeTab === "stats" && <StatsPage words={selectedWords} logs={selectedLogs} practiceLogs={selectedPracticeLogs} history={selectedHistory} languageName={languageName} syncStatus={syncStatus} backupStatus={backupStatus} onExport={exportFullBackup} onRestore={restoreBackup} />}
      </section>

      <nav className="mobile-nav" aria-label="移动端导航">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={activeTab === item.id ? "active" : ""} onClick={() => setActiveTab(item.id)}><Icon size={20} /><span>{item.label.replace("学习数据", "数据")}</span></button>; })}</nav>

      {importOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setImportOpen(false); }}>
          <section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
            <button className="modal-close" onClick={() => setImportOpen(false)} aria-label="关闭"><X /></button>
            <p className="eyebrow"><Upload size={15} /> {languageName}独立导入</p><h2 id="import-title">导入至{languageName}词库</h2><p className="modal-intro">支持 Excel、CSV、TSV。{studyLanguage === "ja" ? "语调未填写时会标记为待校对；可填写 accent（0、1、2…）和 pitch（如 LHHH）。" : "导入内容只会进入当前英语词库。"}</p>
            <label className="file-drop"><Upload size={28} /><strong>选择单词文件</strong><span>.xlsx · .xls · .csv · .tsv</span><input type="file" accept=".xlsx,.xls,.csv,.tsv" onChange={handleFile} /></label>
            <div className="or"><span>或者粘贴表格内容</span></div>
            <textarea value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={studyLanguage === "ja" ? "term\treading\taccent\tmeaning\n郵便局\tゆうびんきょく\t\t邮局" : "term\treading\tmeaning\naccessible\t/əkˈsesəbəl/\t可进入的"} />
            {importStatus && <p className="import-status">{importStatus}</p>}
            {importPreview && <section className="import-preview">
              <div className="preview-counts"><span className="ok"><strong>{importPreview.newCount}</strong>新增</span><span><strong>{importPreview.duplicateCount}</strong>已有</span><span className={importPreview.errors.length ? "bad" : "ok"}><strong>{importPreview.errors.length}</strong>错误</span></div>
              {importPreview.duplicateCount > 0 && <label>已有词处理<select value={duplicateMode} onChange={(event) => setDuplicateMode(event.target.value as "update" | "skip")}><option value="update">更新内容，保留学习进度</option><option value="skip">跳过已有词</option></select></label>}
              {importPreview.errors.length > 0 && <div className="preview-errors"><CircleAlert size={16} /><span>{importPreview.errors.slice(0, 3).map((item) => `第${item.row}行 ${item.term}：${item.reason}`).join("；")}</span><button onClick={downloadImportErrors}>下载错误报告</button></div>}
            </section>}
            <div className="modal-actions"><button className="outline-button" onClick={downloadTemplate}><FileDown size={17} />下载模板</button>{importPreview ? <button className="solid-button" onClick={confirmImport} disabled={!importPreview.words.length}><Check size={17} />确认导入</button> : <button className="solid-button" onClick={importPasted}><Import size={17} />开始预检</button>}</div>
          </section>
        </div>
      )}

      {storyImportOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setStoryImportOpen(false); }}>
          <section className="modal story-import-modal" role="dialog" aria-modal="true" aria-labelledby="story-import-title">
            <button className="modal-close" onClick={() => setStoryImportOpen(false)} aria-label="关闭短文导入"><X /></button>
            <p className="eyebrow"><Newspaper size={15} /> {languageName}独立导入</p>
            <h2 id="story-import-title">导入词汇短文</h2>
            <p className="modal-intro">保存后仅显示在当前{languageName}空间。目标词使用逗号、顿号或换行分隔，阅读时会自动高亮。</p>
            <label className="compact-file-drop"><Upload size={19} /><span><strong>读取 .txt 短文模板</strong><small>UTF-8 编码</small></span><input type="file" accept=".txt,text/plain" onChange={handleStoryFile} /></label>
            <div className="story-form-grid">
              <label><span>标题 <b>必填</b></span><input value={storyDraft.title} onChange={(event) => setStoryDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder={studyLanguage === "ja" ? "駅の近く" : "A Day at the Courthouse"} /></label>
              <label><span>目标词</span><input value={storyDraft.targetWords} onChange={(event) => setStoryDraft((draft) => ({ ...draft, targetWords: event.target.value }))} placeholder={studyLanguage === "ja" ? "駅、郵便局、隣" : "arraignment, arson, assailant"} /></label>
              <label className="full"><span>标签</span><input value={storyDraft.tags} onChange={(event) => setStoryDraft((draft) => ({ ...draft, tags: event.target.value }))} placeholder={studyLanguage === "ja" ? "第5课、位置表达" : "TOEIC, Week 1 Day 4"} /></label>
              <label className="full"><span>正文 <b>必填</b></span><textarea value={storyDraft.content} onChange={(event) => setStoryDraft((draft) => ({ ...draft, content: event.target.value }))} placeholder="粘贴或输入词汇短文正文" /></label>
              <label className="full"><span>中文翻译</span><textarea value={storyDraft.translation} onChange={(event) => setStoryDraft((draft) => ({ ...draft, translation: event.target.value }))} placeholder="可选：填写整篇短文的中文翻译" /></label>
            </div>
            {storyImportStatus && <p className="import-status">{storyImportStatus}</p>}
            <div className="modal-actions"><button className="outline-button" onClick={downloadStoryTemplate}><FileDown size={17} />下载模板</button><button className="solid-button" onClick={saveStory}><Import size={17} />保存到短文页</button></div>
          </section>
        </div>
      )}

      {(reviewQueue.length > 0 || sessionDone) && (
        <div className="modal-backdrop review-backdrop">
          <section className="modal review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
            <button className="modal-close" onClick={closeReview} aria-label="退出复习"><X /></button>
            {sessionDone ? (
              <div className="session-complete"><span className="complete-icon"><Check /></span><p className="eyebrow">今日学习记录已保存</p><h2>这一组完成了</h2><p>{sessionTotal ? `完成 ${sessionTotal} 张初始卡片，错词已重新安排复习。` : "目前没有到期词，可以导入新词继续学习。"}</p><button className="solid-button" onClick={closeReview}>返回首页</button></div>
            ) : (
              <ReviewCard word={reviewQueue[0]} index={Math.max(1, sessionTotal - reviewQueue.length + 1)} total={sessionTotal} showAnswer={showAnswer} onReveal={() => setShowAnswer(true)} onRate={rateWord} />
            )}
          </section>
        </div>
      )}
      {trainingMode && <TrainingModal mode={trainingMode} words={selectedWords} languageName={languageName} onClose={() => setTrainingMode(null)} onRecord={recordPractice} />}
    </main>
  );
}

function highlightStory(content: string, targetWords: string[], onWordClick?: (word: string) => void) {
  const targets = [...new Set(targetWords.map((word) => word.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!targets.length) return content;
  const escaped = targets.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const matcher = new RegExp(`(${escaped.join("|")})`, "gi");
  return content.split(matcher).map((part, index) => {
    const matched = targets.some((word) => word.toLowerCase() === part.toLowerCase());
    return matched ? <button type="button" className="story-word" onClick={() => onWordClick?.(part)} key={`${part}-${index}`}>{part}</button> : <span key={`${part}-${index}`}>{part}</span>;
  });
}

function StoryCard({ story, words, progress, onFlagWord, onProgress }: { story: Story; words: Word[]; progress?: StoryProgress; onFlagWord: (term: string) => void; onProgress: (patch: Partial<StoryProgress>) => void }) {
  const knownWords = new Map(words.map((word) => [word.term.toLowerCase(), word]));
  const matchedCount = story.targetWords.filter((word) => knownWords.has(word.toLowerCase())).length;
  const [selectedTerm, setSelectedTerm] = useState(story.targetWords[0] ?? "");
  const [clozeOpen, setClozeOpen] = useState(false);
  const [clozeAnswer, setClozeAnswer] = useState("");
  const [clozeResult, setClozeResult] = useState<"" | "correct" | "wrong">("");
  const clozeTarget = story.targetWords.find((term) => story.content.toLowerCase().includes(term.toLowerCase())) ?? story.targetWords[0] ?? "";
  const selectedWord = knownWords.get(selectedTerm.toLowerCase());
  const clozeText = clozeTarget ? story.content.replace(new RegExp(clozeTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "＿＿＿＿") : story.content;
  const speakStory = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(story.content);
    utterance.lang = story.language === "ja" ? "ja-JP" : "en-US";
    utterance.rate = story.language === "ja" ? 0.78 : 0.88;
    window.speechSynthesis.speak(utterance);
  };
  const markUnfamiliar = (term: string) => {
    const unfamiliar = Array.from(new Set([...(progress?.unfamiliar ?? []), term]));
    onFlagWord(term);
    onProgress({ unfamiliar });
  };
  const checkCloze = () => {
    const correct = clozeAnswer.trim().toLowerCase() === clozeTarget.toLowerCase();
    setClozeResult(correct ? "correct" : "wrong");
    onProgress({ clozeScore: correct ? 100 : 0 });
    if (!correct && clozeTarget) markUnfamiliar(clozeTarget);
  };
  return (
    <article className="story-card">
      <header><div><span className={`language-badge ${story.language}`}>{story.language === "ja" ? "日语短文" : "英语短文"}</span><h2>{story.title}</h2><p>{story.createdAt} · {story.targetWords.length} 个目标词 · {matchedCount} 个已在词库{progress?.completed ? " · 已完成" : ""}</p></div><button className="story-speak" onClick={speakStory} aria-label={`朗读短文 ${story.title}`}><Volume2 size={19} />朗读</button></header>
      <div className={`story-content ${story.language}`}>{highlightStory(story.content, story.targetWords, setSelectedTerm)}</div>
      {selectedWord && <div className="story-word-detail"><div><strong>{selectedWord.term}</strong><span>{selectedWord.reading}{selectedWord.language === "ja" && selectedWord.accent !== undefined ? ` · ${selectedWord.accent}型` : ""}</span><p>{selectedWord.meaning}</p></div><button onClick={() => markUnfamiliar(selectedWord.term)}>{progress?.unfamiliar.includes(selectedWord.term) ? "已加入重点词" : "仍不熟悉"}</button></div>}
      {story.targetWords.length > 0 && <div className="story-targets">{story.targetWords.map((target) => { const word = knownWords.get(target.toLowerCase()); return <button className={`${word ? "known" : ""} ${progress?.unfamiliar.includes(target) ? "unfamiliar" : ""}`} onClick={() => setSelectedTerm(target)} key={target}>{target}{word && <small>{word.meaning}</small>}</button>; })}</div>}
      {clozeOpen && clozeTarget && <div className="cloze-box"><p>{clozeText}</p><div><input value={clozeAnswer} onChange={(event) => { setClozeAnswer(event.target.value); setClozeResult(""); }} placeholder="填写被遮住的目标词" /><button onClick={checkCloze}>检查</button></div>{clozeResult && <small className={clozeResult}>{clozeResult === "correct" ? "回答正确，已记录本次短文练习。" : `正确答案：${clozeTarget}，已加入重点词。`}</small>}</div>}
      {story.translation && <details className="story-translation"><summary>查看中文翻译</summary><p>{story.translation}</p></details>}
      <div className="story-actions"><button onClick={() => setClozeOpen((value) => !value)}><Highlighter size={16} />{clozeOpen ? "关闭填空" : "目标词填空"}</button><button className={progress?.completed ? "complete" : ""} onClick={() => onProgress({ completed: !progress?.completed })}><Check size={16} />{progress?.completed ? "已完成" : "标记完成"}</button></div>
      {story.tags.length > 0 && <footer>{story.tags.map((tag) => <span key={tag}>#{tag}</span>)}</footer>}
    </article>
  );
}

function WordRow({ word, onSpeak, onFavorite }: { word: Word; onSpeak: () => void; onFavorite: () => void }) {
  return (
    <article className="word-row">
      <button className="word-sound" onClick={onSpeak} aria-label={`播放 ${word.term} 的读音`}><Volume2 size={19} /></button>
      <div className="word-primary"><div><h3>{word.term}</h3><span className={`language-dot ${word.language}`} /></div><p>{word.reading}{word.language === "ja" && <em>{word.accent === undefined ? "语调待校对" : `【${word.accent}型】`}</em>}</p></div>
      <div className="word-meaning"><strong>{word.meaning}</strong><span>{word.partOfSpeech || "未填写词性"}</span></div>
      {word.language === "ja" ? <PitchAccent word={word} compact /> : <div className="tag-stack">{word.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>}
      <div className="word-schedule"><span className={`status ${word.status}`}>{word.status === "new" ? "新词" : word.status === "learning" ? "学习中" : "已掌握"}</span><small>{word.dueDate <= isoDay() ? "今天复习" : word.dueDate}</small></div>
      <button className={`favorite ${word.favorite ? "active" : ""}`} onClick={onFavorite} aria-label="收藏"><Star size={18} fill={word.favorite ? "currentColor" : "none"} /></button>
    </article>
  );
}

function ReviewCard({ word, index, total, showAnswer, onReveal, onRate }: { word: Word; index: number; total: number; showAnswer: boolean; onReveal: () => void; onRate: (rating: Rating) => void }) {
  return (
    <div className="review-card">
      <div className="review-top"><span className={`language-badge ${word.language}`}>{word.language === "ja" ? "日语" : "英语"}</span><span>{Math.min(index, total)} / {total}</span></div>
      <div className="review-progress"><span style={{ width: `${Math.min(100, (index / Math.max(1, total)) * 100)}%` }} /></div>
      <div className="review-prompt"><p>{word.language === "ja" ? "回忆读音和中文释义" : "回忆中文释义和常用搭配"}</p><h2 id="review-title">{word.term}</h2>{!showAnswer && <button className="sound-circle" onClick={() => speak(word)} aria-label="播放读音"><Headphones size={22} /></button>}</div>
      {showAnswer ? (
        <div className="answer-panel"><div className="answer-reading"><button onClick={() => speak(word)}><Volume2 size={20} /></button><strong>{word.reading}</strong>{word.language === "ja" && <span className={`accent-badge ${word.accent === undefined ? "pending" : ""}`}>{word.accent === undefined ? "语调待校对" : `【${word.accent}型】`}</span>}</div>{word.language === "ja" && <PitchAccent word={word} />}<h3>{word.meaning}</h3>{word.partOfSpeech && <p className="part-of-speech">{word.partOfSpeech}</p>}{word.example && <blockquote>{word.example}<span>{word.translation}</span></blockquote>}<div className="rating-title"><span>这次记得怎么样？</span><small>评分后自动安排日期</small></div><div className="rating-grid">{(Object.keys(ratingConfig) as Rating[]).map((rating) => <button key={rating} className={rating} onClick={() => onRate(rating)}><strong>{ratingConfig[rating].label}</strong><span>{ratingConfig[rating].hint}</span></button>)}</div></div>
      ) : <button className="reveal-button" onClick={onReveal}>显示答案 <ChevronRight size={19} /></button>}
    </div>
  );
}

function textSimilarity(a: string, b: string) {
  const left = a.toLowerCase().replace(/[\s.,!?。、・]/g, "");
  const right = b.toLowerCase().replace(/[\s.,!?。、・]/g, "");
  if (!left || !right) return 0;
  const matrix = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) for (let j = 1; j <= right.length; j += 1) {
    matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
  }
  return Math.max(0, Math.round((1 - matrix[left.length][right.length] / Math.max(left.length, right.length)) * 100));
}

function TrainingModal({ mode, words, languageName, onClose, onRecord }: { mode: TrainingMode; words: Word[]; languageName: string; onClose: () => void; onRecord: (entry: Omit<PracticeLog, "id" | "timestamp" | "language">) => void }) {
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<"" | "correct" | "wrong">("");
  const [transcript, setTranscript] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognitionError, setRecognitionError] = useState("");
  const pool = words.filter((word) => word.meaning && word.term);
  const word = pool[index % Math.max(1, pool.length)];
  const baseChoices = word ? Array.from(new Set([word.meaning, ...pool.slice(index + 1).concat(pool).filter((item) => item.id !== word.id).slice(0, 3).map((item) => item.meaning)])) : [];
  const choiceOffset = baseChoices.length ? (index * 2 + 1) % baseChoices.length : 0;
  const choices = [...baseChoices.slice(choiceOffset), ...baseChoices.slice(0, choiceOffset)];

  const next = () => { setIndex((value) => value + 1); setResult(""); setTranscript(""); setScore(null); setRecognitionError(""); };
  const choose = (meaning: string) => {
    if (!word || result) return;
    const correct = meaning === word.meaning;
    setResult(correct ? "correct" : "wrong");
    onRecord({ type: "listening", wordId: word.id, correct, score: correct ? 100 : 0 });
  };
  const startRecognition = () => {
    if (!word) return;
    type RecognitionResult = { results: { 0: { 0: { transcript: string } } } };
    type Recognition = { lang: string; interimResults: boolean; maxAlternatives: number; onresult: (event: RecognitionResult) => void; onerror: () => void; onend: () => void; start: () => void };
    const speechWindow = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const RecognitionClass = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!RecognitionClass) { setRecognitionError("当前浏览器不支持语音识别，可使用播放按钮进行跟读练习。"); return; }
    const recognition = new RecognitionClass();
    recognition.lang = word.language === "ja" ? "ja-JP" : "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const heard = event.results[0][0].transcript;
      const targetScores = [word.term, word.reading].filter(Boolean).map((target) => textSimilarity(heard, target));
      const match = Math.max(...targetScores);
      setTranscript(heard);
      setScore(match);
      onRecord({ type: "pronunciation", wordId: word.id, correct: match >= 70, score: match });
    };
    recognition.onerror = () => setRecognitionError("没有识别到清晰发音，请靠近麦克风后重试。");
    recognition.onend = () => setRecognizing(false);
    setRecognizing(true);
    recognition.start();
  };
  if (!word) return null;
  return <div className="modal-backdrop training-backdrop">
    <section className="modal training-modal" role="dialog" aria-modal="true" aria-labelledby="training-title">
      <button className="modal-close" onClick={onClose} aria-label="退出训练"><X /></button>
      <p className="eyebrow">{mode === "listening" ? <><Headphones size={15} /> 听力辨义</> : <><Mic size={15} /> 跟读发音</>}</p>
      <h2 id="training-title">{languageName}{mode === "listening" ? "听力训练" : "发音训练"}</h2>
      <p className="modal-intro">第 {index + 1} 题 · {mode === "listening" ? "先播放读音，再选择正确中文释义。" : "先听标准发音，再朗读单词并查看识别匹配度。"}</p>
      <div className="training-word">
        {mode === "pronunciation" && <><h3>{word.term}</h3><p>{word.reading}</p>{word.language === "ja" && <><span className="accent-badge">{word.accent === undefined ? "语调待校对" : `【${word.accent}型】`}</span><PitchAccent word={word} /></>}</>}
        <button className="listen-main" onClick={() => speak(word)}><Volume2 />播放{mode === "listening" ? "题目" : "标准发音"}</button>
      </div>
      {mode === "listening" ? <>
        <div className="listening-choices">{choices.map((choice) => <button key={choice} className={result ? (choice === word.meaning ? "correct" : "muted") : ""} onClick={() => choose(choice)}>{choice}</button>)}</div>
        {result && <div className={`training-result ${result}`}><strong>{result === "correct" ? "回答正确" : `正确答案：${word.meaning}`}</strong><span>{word.term} · {word.reading}</span></div>}
      </> : <div className="pronunciation-panel">
        <button className="record-button" onClick={startRecognition} disabled={recognizing}><Mic />{recognizing ? "正在聆听…" : "开始录音识别"}</button>
        {transcript && <div className="speech-score"><span>识别结果：{transcript}</span><strong>{score}%</strong><small>{(score ?? 0) >= 70 ? "发音匹配良好" : "建议再听一次后重新跟读"}</small></div>}
        {recognitionError && <p className="recognition-error">{recognitionError}</p>}
      </div>}
      <div className="training-footer"><span>练习结果会计入周报和月报</span><button className="solid-button" onClick={next}>下一题 <ChevronRight size={16} /></button></div>
    </section>
  </div>;
}

function StatsPage({ words, logs, practiceLogs, history, languageName, syncStatus, backupStatus, onExport, onRestore }: { words: Word[]; logs: ReviewLog[]; practiceLogs: PracticeLog[]; history: StudyHistorySeed[]; languageName: string; syncStatus: SyncStatus; backupStatus: string; onExport: () => void; onRestore: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const mastered = words.filter((word) => word.status === "mastered").length;
  const averageRetention = words.length ? Math.round(words.reduce((sum, word) => sum + retention(word), 0) / words.length) : 0;
  const recentDays = Array.from({ length: 7 }, (_, index) => shiftDay(index - 6));
  const counts = recentDays.map((day) => logs.filter((log) => isoDay(new Date(log.timestamp)) === day).length);
  const maxCount = Math.max(1, ...counts);
  const activityDays = Array.from({ length: 84 }, (_, index) => shiftDay(index - 83));
  const activityCounts = activityDays.map((day) => logs.filter((log) => isoDay(new Date(log.timestamp)) === day).length + practiceLogs.filter((log) => isoDay(new Date(log.timestamp)) === day).length);
  const forecastDays = Array.from({ length: 7 }, (_, index) => shiftDay(index));
  const forecastCounts = forecastDays.map((day) => words.filter((word) => word.dueDate === day).length);
  const forecastTotal = forecastCounts.reduce((sum, count) => sum + count, 0);
  const peakIndex = forecastCounts.indexOf(Math.max(...forecastCounts));
  const periodStats = (days: number) => {
    const start = shiftDay(-(days - 1));
    const periodReviews = logs.filter((log) => isoDay(new Date(log.timestamp)) >= start);
    const periodPractice = practiceLogs.filter((log) => isoDay(new Date(log.timestamp)) >= start);
    const correct = periodReviews.filter((log) => log.correct).length + periodPractice.filter((log) => log.correct).length;
    const total = periodReviews.length + periodPractice.length;
    const active = new Set([...periodReviews.map((log) => isoDay(new Date(log.timestamp))), ...periodPractice.map((log) => isoDay(new Date(log.timestamp)))]).size;
    const learned = words.filter((word) => word.lastReviewed && isoDay(new Date(word.lastReviewed)) >= start).length;
    return { reviews: periodReviews.length, practice: periodPractice.length, accuracy: total ? Math.round(correct / total * 100) : 0, active, learned };
  };
  const weekly = periodStats(7);
  const monthly = periodStats(30);
  const reportAdvice = (stats: ReturnType<typeof periodStats>) => stats.reviews === 0
    ? "完成一次到期复习后，报告会开始积累趋势。"
    : stats.accuracy < 70
      ? "正确率偏低，建议优先完成错词强化，再进入新词。"
      : stats.active < 3
        ? "掌握表现稳定，可以增加学习天数，避免集中突击。"
        : "学习节奏稳定，继续按到期复习顺序推进。";
  const downloadReport = (kind: "周报" | "月报", stats: ReturnType<typeof periodStats>) => {
    const text = `${languageName}${kind}\n生成日期：${isoDay()}\n活跃天数：${stats.active}\n完成复习：${stats.reviews}\n听力/发音练习：${stats.practice}\n综合正确率：${stats.accuracy || "暂无"}${stats.accuracy ? "%" : ""}\n本期复习词汇：${stats.learned}\n建议：${reportAdvice(stats)}\n`;
    downloadBlob(`忆词-${languageName}-${kind}-${isoDay()}.txt`, `\ufeff${text}`, "text/plain;charset=utf-8");
  };
  return (
    <section className="page-section page-enter">
      <header className="page-header"><div><p className="eyebrow"><BarChart3 size={15} /> 看见记忆逐步变稳</p><h1>{languageName}学习数据</h1><p>当前页面只统计{languageName}，不与另一语言混合。</p></div></header>
      <div className="stats-overview"><article><span><BookOpen /></span><p>词汇总量<strong>{words.length}</strong></p></article><article><span><Target /></span><p>已掌握<strong>{mastered}</strong></p></article><article><span><Brain /></span><p>预计保持率<strong>{averageRetention}%</strong></p></article><article><span><Flame /></span><p>累计复习<strong>{logs.length}</strong></p></article></div>
      <article className="data-safety-card">
        <div className="safety-icon"><DatabaseBackup /></div>
        <div><p className="eyebrow">数据保护</p><h2>{syncStatus === "synced" ? "学习数据已保存到云端" : syncStatus === "signed-out" ? "登录后开启跨设备同步" : syncStatus === "offline" ? "当前使用离线缓存" : syncStatus === "error" ? "云端同步尚未启用" : syncStatus === "saving" ? "正在保存最新进度" : "正在读取云端数据"}</h2><p>{SUPABASE_CONFIGURED ? "登录后，云端记录会与本机进度合并；离线时仍可学习，恢复连接后继续同步。" : "当前构建未配置 Supabase，学习进度只保存在本机浏览器。"}</p>{backupStatus && <small>{backupStatus}</small>}</div>
        <div className="safety-actions">{syncStatus === "signed-out" && <a className="solid-button" href={ACCOUNT_URL}><Cloud size={17} />登录同步</a>}<button className="outline-button" onClick={onExport}><Download size={17} />下载完整备份</button><label className="solid-button"><Upload size={17} />恢复备份<input type="file" accept=".json,application/json" onChange={onRestore} /></label></div>
      </article>
      <div className="analytics-grid">
        <article className="analytics-card"><div className="card-head"><div><h2>近 7 天复习量</h2><p>每日完成的复习卡片</p></div><strong>{logs.length}</strong></div><div className="bar-chart">{counts.map((count, index) => <div className="bar-column" key={recentDays[index]}><span className="bar-value">{count || ""}</span><i style={{ height: `${Math.max(5, (count / maxCount) * 100)}%` }} /><small>{recentDays[index].slice(5).replace("-", "/")}</small></div>)}</div></article>
        <article className="analytics-card"><div className="card-head"><div><h2>掌握状态</h2><p>根据复习间隔动态更新</p></div></div><div className="mastery-list"><p><span><i className="new" />新词</span><strong>{words.filter((word) => word.status === "new").length}</strong></p><p><span><i className="learning" />学习中</span><strong>{words.filter((word) => word.status === "learning").length}</strong></p><p><span><i className="mastered" />已掌握</span><strong>{mastered}</strong></p></div><div className="stacked-bar"><span className="new" style={{ width: `${(words.filter((word) => word.status === "new").length / Math.max(1, words.length)) * 100}%` }} /><span className="learning" style={{ width: `${(words.filter((word) => word.status === "learning").length / Math.max(1, words.length)) * 100}%` }} /><span className="mastered" style={{ width: `${(mastered / Math.max(1, words.length)) * 100}%` }} /></div></article>
      </div>
      <article className="heatmap-card">
        <div className="card-head"><div><h2>近 12 周学习热力图</h2><p>复习、听力和发音练习均计入活跃度</p></div><strong>{activityCounts.reduce((sum, count) => sum + count, 0)} 次</strong></div>
        <div className="heatmap-wrap"><div className="heatmap-weekdays"><span>一</span><span>三</span><span>五</span><span>日</span></div><div className="heatmap-grid">{activityDays.map((day, index) => <span key={day} className={`level-${Math.min(4, activityCounts[index])}`} title={`${day}：${activityCounts[index]} 次学习`} />)}</div></div>
        <div className="heatmap-legend"><span>少</span>{[0,1,2,3,4].map((level) => <i className={`level-${level}`} key={level} />)}<span>多</span></div>
      </article>
      <div className="report-grid">
        {([{ title: "本周学习报告", kind: "周报" as const, stats: weekly }, { title: "本月学习报告", kind: "月报" as const, stats: monthly }]).map((report) => <article className="report-card" key={report.kind}>
          <header><span><FileBarChart /></span><div><p className="eyebrow">自动生成</p><h2>{report.title}</h2></div><button onClick={() => downloadReport(report.kind, report.stats)}><Download size={15} />导出</button></header>
          <div className="report-metrics"><p><strong>{report.stats.active}</strong><span>活跃天数</span></p><p><strong>{report.stats.reviews}</strong><span>复习次数</span></p><p><strong>{report.stats.practice}</strong><span>听说练习</span></p><p><strong>{report.stats.accuracy || "—"}{report.stats.accuracy ? "%" : ""}</strong><span>综合正确率</span></p></div>
          <p className="report-advice">{reportAdvice(report.stats)}</p>
        </article>)}
      </div>
      <article className="history-card">
        <div className="card-head"><div><h2>对话学习记录</h2><p>从此前多天学习对话迁移，成绩只记录明确出现过的数据</p></div><strong>{history.length} 条</strong></div>
        <div className="history-list">
          {history.map((item) => <section className="history-item" key={item.id}>
            <div className="history-date"><span>{item.date ? item.date.slice(5).replace("-", "/") : "日期"}</span><small>{item.date ? item.date.slice(0, 4) : "未确认"}</small></div>
            <i className={item.status} />
            <div className="history-main"><div><h3>{item.title}</h3><span className={`history-status ${item.status}`}>{item.status === "completed" ? "已完成" : "学习中"}</span></div><p>{item.scope}</p><small>{item.notes}</small></div>
            <div className="history-score"><strong>{item.scoreLabel ?? "未记录成绩"}</strong>{item.nextReview && <span>复习节点 {item.nextReview.slice(5).replace("-", "/")}</span>}</div>
          </section>)}
        </div>
      </article>
      <article className="future-card forecast-card"><div><p className="eyebrow"><CalendarDays size={15} /> 未来复习预测</p><h2>未来 7 天共 {forecastTotal} 个</h2><p>高峰在 {forecastDays[peakIndex].slice(5).replace("-", "/")}，约需 {Math.ceil(forecastCounts[peakIndex] * 1.2)} 分钟。评分后预测会自动更新。</p></div><div className="future-days seven">{forecastDays.map((date, index) => <div key={date} className={index === 0 ? "today" : ""}><span>{date.slice(5).replace("-", "/")}</span><i style={{ height: `${Math.max(4, forecastCounts[index] * 5)}px` }} /><small>{forecastCounts[index]} 个</small></div>)}</div></article>
    </section>
  );
}

function downloadBlob(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
