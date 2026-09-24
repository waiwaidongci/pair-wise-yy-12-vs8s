import type {
  HoofEntry,
  HoofPos,
  HoofStatus,
  RecordDraft,
  TrimRecord,
} from "./types";
import { HOOF_POSITIONS } from "./types";

const STORAGE_KEY = "farrier-records-v1";

/* ---------------- 日期工具（按本地日期，避免 UTC 偏移） ---------------- */

export function todayStr(): string {
  const d = new Date();
  return toDateStr(d);
}

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

// b - a 的天数差
export function dayDiff(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  return Math.round((db - da) / 86400000);
}

/* ---------------- 本地持久化 ---------------- */

export function loadRecords(): TrimRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrimRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecords(records: TrimRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/* ---------------- 查询 ---------------- */

// 该马匹全部档案，时间正序（旧 → 新）
export function historyOf(records: TrimRecord[], horseId: string): TrimRecord[] {
  const id = horseId.trim().toUpperCase();
  return records
    .filter((r) => r.horseId.trim().toUpperCase() === id)
    .sort((a, b) =>
      a.trimDate === b.trimDate
        ? a.createdAt - b.createdAt
        : a.trimDate < b.trimDate
          ? -1
          : 1
    );
}

// 最近一次修蹄记录
export function latestOf(records: TrimRecord[], horseId: string): TrimRecord | undefined {
  const list = historyOf(records, horseId);
  return list[list.length - 1];
}

// 全部马匹编号
export function allHorseIds(records: TrimRecord[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of records) {
    const id = r.horseId.trim().toUpperCase();
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out.sort();
}

// 表单编辑中：本次填写相对上一次同蹄位结果的状态（用于实时徽标）
export function draftHoofStatus(prevEntry: HoofEntry | undefined, entry: HoofEntry): HoofStatus {
  const abnormalNow = entry.gaitAbnormal || entry.shapeEval.trim() !== "";
  if (!abnormalNow) return "normal";
  if (!prevEntry) return "abnormal";
  const abnormalPrev = prevEntry.gaitAbnormal || prevEntry.shapeEval.trim() !== "";
  return abnormalPrev ? "watch" : "abnormal";
}

// 某次记录中某蹄的状态：仍异常=持续观察，恢复=正常，首次异常=异常
export function hoofStatusAt(
  history: TrimRecord[],
  recordId: string,
  pos: HoofPos
): HoofStatus {
  const idx = history.findIndex((r) => r.id === recordId);
  const cur = history[idx]?.hooves[pos];
  if (!cur) return "normal";
  const abnormalNow = cur.gaitAbnormal || cur.shapeEval.trim() !== "";
  if (!abnormalNow) return "normal";
  if (idx === 0) return "abnormal";
  const prev = history[idx - 1].hooves[pos];
  const abnormalPrev = prev.gaitAbnormal || prev.shapeEval.trim() !== "";
  return abnormalPrev ? "watch" : "abnormal";
}

// 最近一次档案中仍处于异常/持续观察的蹄位
export function latestAbnormalHooves(
  records: TrimRecord[],
  horseId: string
): HoofPos[] {
  const list = historyOf(records, horseId);
  const last = list[list.length - 1];
  if (!last) return [];
  return HOOF_POSITIONS.filter(
    (p) => hoofStatusAt(list, last.id, p.value) !== "normal"
  ).map((p) => p.value);
}

/* ---------------- 复查提醒 ---------------- */

export type ReviewGroup = "overdue" | "due" | "upcoming";

export interface ReviewItem {
  record: TrimRecord;
  group: ReviewGroup;
  days: number; // 距今天数（负数为逾期）
  abnormal: HoofPos[];
}

export function reviewList(records: TrimRecord[], today = todayStr()): ReviewItem[] {
  // 每匹马以最近一次修蹄记录的复查日期为准
  const byHorse = new Map<string, TrimRecord>();
  for (const r of records) {
    const key = r.horseId.trim().toUpperCase();
    const old = byHorse.get(key);
    if (!old || r.trimDate > old.trimDate || (r.trimDate === old.trimDate && r.createdAt > old.createdAt)) {
      byHorse.set(key, r);
    }
  }
  const items: ReviewItem[] = [];
  for (const record of byHorse.values()) {
    const days = dayDiff(today, record.reviewDate);
    const group: ReviewGroup = days < 0 ? "overdue" : days <= 3 ? "due" : "upcoming";
    items.push({
      record,
      group,
      days,
      abnormal: latestAbnormalHooves(records, record.horseId),
    });
  }
  const rank: Record<ReviewGroup, number> = { overdue: 0, due: 1, upcoming: 2 };
  return items.sort(
    (a, b) => rank[a.group] - rank[b.group] || a.days - b.days || a.record.horseId.localeCompare(b.record.horseId)
  );
}

/* ---------------- 蹄铁更换 ---------------- */

export interface ShoeChange {
  pos: HoofPos;
  from: string;
  to: string;
}

// 本次记录相对上次更换了蹄铁类型的蹄位
export function shoeChanges(prev: TrimRecord | undefined, draft: RecordDraft): ShoeChange[] {
  if (!prev) return [];
  const out: ShoeChange[] = [];
  for (const p of HOOF_POSITIONS) {
    const from = prev.hooves[p.value].shoeType.trim();
    const to = draft.hooves[p.value].shoeType.trim();
    if (from && to && from !== to) {
      out.push({ pos: p.value, from, to });
    }
  }
  return out;
}

/* ---------------- 表单 ---------------- */

export function emptyHoof(): HoofEntry {
  return { gaitAbnormal: false, gaitNote: "", shapeEval: "", shoeType: "", nailPositions: "" };
}

export function emptyDraft(trimDate = todayStr()): RecordDraft {
  return {
    horseId: "",
    trimDate,
    reviewDate: addDays(trimDate, 28),
    note: "",
    hooves: {
      LF: emptyHoof(),
      RF: emptyHoof(),
      LH: emptyHoof(),
      RH: emptyHoof(),
    },
  };
}

// 再修同一蹄位：带出上次结果
export function prefillFrom(record: TrimRecord, trimDate = todayStr()): RecordDraft {
  const hooves = {} as Record<HoofPos, HoofEntry>;
  for (const p of HOOF_POSITIONS) {
    hooves[p.value] = { ...record.hooves[p.value] };
  }
  return {
    horseId: record.horseId,
    trimDate,
    reviewDate: addDays(trimDate, 28),
    note: "",
    hooves,
  };
}

export function validateDraft(draft: RecordDraft): string[] {
  const errors: string[] = [];
  if (!draft.horseId.trim()) errors.push("请填写马匹编号");
  if (!draft.trimDate) errors.push("请选择修蹄日期");
  if (!draft.reviewDate) errors.push("请选择复查日期");
  if (draft.trimDate && draft.reviewDate && draft.reviewDate < draft.trimDate) {
    errors.push("复查日期不能早于修蹄日期");
  }
  for (const p of HOOF_POSITIONS) {
    const h = draft.hooves[p.value];
    if (!h.shoeType.trim()) errors.push(`${p.label}蹄铁类型未填写`);
    if (!h.nailPositions.trim()) errors.push(`${p.label}钉位未填写`);
    if (h.gaitAbnormal && !h.gaitNote.trim()) {
      errors.push(`${p.label}勾选了步态异常，请填写异常表现`);
    }
  }
  return errors;
}

export function makeRecord(draft: RecordDraft): TrimRecord {
  return { ...draft, horseId: draft.horseId.trim().toUpperCase(), id: uid(), createdAt: Date.now() };
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------------- 示例数据（仅首次打开写入） ---------------- */

export function seedRecords(): TrimRecord[] {
  const mk = (
    id: string,
    horseId: string,
    trimDate: string,
    reviewDate: string,
    note: string,
    hooves: Partial<Record<HoofPos, Partial<HoofEntry>>>
  ): TrimRecord => ({
    id,
    horseId,
    trimDate,
    reviewDate,
    note,
    createdAt: new Date(`${trimDate}T09:00:00`).getTime(),
    hooves: {
      LF: { ...emptyHoof(), ...hooves.LF },
      RF: { ...emptyHoof(), ...hooves.RF },
      LH: { ...emptyHoof(), ...hooves.LH },
      RH: { ...emptyHoof(), ...hooves.RH },
    },
  });

  const steel = "普通钢蹄铁";
  const aluminum = "铝蹄铁";
  const pad = "加护蹄垫";

  return [
    mk(
      "seed-18a",
      "HORSE-18",
      addDays(todayStr(), -42),
      addDays(todayStr(), -14),
      "右前蹄外侧磨耗明显，缩短外侧钉距",
      {
        RF: {
          gaitAbnormal: true,
          gaitNote: "硬地快步时点头，右前外侧着地偏重",
          shapeEval: "右前外侧壁磨耗过快，蹄尖略长",
          shoeType: steel,
          nailPositions: "内侧4钉 / 外侧3钉",
        },
        LF: { shapeEval: "", shoeType: steel, nailPositions: "内外各4钉" },
        LH: { shapeEval: "", shoeType: steel, nailPositions: "内外各4钉" },
        RH: { shapeEval: "", shoeType: steel, nailPositions: "内外各4钉" },
      }
    ),
    mk(
      "seed-18b",
      "HORSE-18",
      addDays(todayStr(), -20),
      addDays(todayStr(), 8),
      "复查调整角度，换铝蹄铁减负，继续观察右前",
      {
        RF: {
          gaitAbnormal: true,
          gaitNote: "点头减轻，仍有轻微外侧偏磨",
          shapeEval: "角度改善，外侧壁仍偏薄",
          shoeType: aluminum,
          nailPositions: "内侧4钉 / 外侧3钉",
        },
        LF: { shapeEval: "", shoeType: aluminum, nailPositions: "内外各4钉" },
        LH: { shapeEval: "", shoeType: steel, nailPositions: "内外各4钉" },
        RH: { shapeEval: "", shoeType: steel, nailPositions: "内外各4钉" },
      }
    ),
    mk(
      "seed-27",
      "HORSE-27",
      addDays(todayStr(), -10),
      addDays(todayStr(), 2),
      "左后裂纹加护蹄垫，照片已归档 P-27-09",
      {
        LF: { shapeEval: "", shoeType: steel, nailPositions: "内外各4钉" },
        RF: { shapeEval: "", shoeType: steel, nailPositions: "内外各4钉" },
        LH: {
          gaitAbnormal: false,
          gaitNote: "",
          shapeEval: "蹄侧壁纵向裂纹约2cm，未达白线",
          shoeType: pad,
          nailPositions: "内侧3钉 / 外侧4钉，避裂纹",
        },
        RH: { shapeEval: "", shoeType: steel, nailPositions: "内外各4钉" },
      }
    ),
    mk(
      "seed-31",
      "HORSE-31",
      addDays(todayStr(), -5),
      addDays(todayStr(), 23),
      "步态轻微不稳，需教练复核后反馈",
      {
        LF: { shapeEval: "", shoeType: steel, nailPositions: "内外各4钉" },
        RF: { shapeEval: "", shoeType: steel, nailPositions: "内外各4钉" },
        LH: { shapeEval: "", shoeType: steel, nailPositions: "内外各4钉" },
        RH: {
          gaitAbnormal: true,
          gaitNote: "转弯时右后跟进不稳，偶有拖步",
          shapeEval: "蹄踵略低，右后蹄底轻度扁平",
          shoeType: steel,
          nailPositions: "内外各4钉，踵钉上移",
        },
      }
    ),
  ];
}
