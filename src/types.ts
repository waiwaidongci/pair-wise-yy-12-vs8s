// 修蹄档案核心数据模型

export type HoofPos = "LF" | "RF" | "LH" | "RH";

export const HOOF_POSITIONS: { value: HoofPos; label: string; short: string }[] = [
  { value: "LF", label: "左前蹄", short: "左前" },
  { value: "RF", label: "右前蹄", short: "右前" },
  { value: "LH", label: "左后蹄", short: "左后" },
  { value: "RH", label: "右后蹄", short: "右后" },
];

export const HOOF_LABEL: Record<HoofPos, string> = {
  LF: "左前蹄",
  RF: "右前蹄",
  LH: "左后蹄",
  RH: "右后蹄",
};

// normal 恢复正常 / watch 持续观察（上次仍异常）/ abnormal 本次新发现异常
export type HoofStatus = "normal" | "abnormal" | "watch";

export const STATUS_TEXT: Record<HoofStatus, string> = {
  normal: "正常",
  abnormal: "异常",
  watch: "持续观察",
};

export interface HoofEntry {
  gaitAbnormal: boolean; // 步态异常
  gaitNote: string; // 步态异常说明
  shapeEval: string; // 蹄形评估
  shoeType: string; // 蹄铁类型
  nailPositions: string; // 钉位
}

export interface TrimRecord {
  id: string;
  horseId: string;
  trimDate: string; // 修蹄日期 yyyy-mm-dd
  reviewDate: string; // 下次复查日期 yyyy-mm-dd
  note: string; // 备注（照片编号等）
  hooves: Record<HoofPos, HoofEntry>;
  createdAt: number; // 保存时间，用于同日期排序
}

export type RecordDraft = Omit<TrimRecord, "id" | "createdAt">;
