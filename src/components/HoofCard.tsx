import type { HoofEntry, HoofStatus } from "../types";
import { STATUS_TEXT } from "../types";
import { draftHoofStatus } from "../lib";

export const SHOE_OPTIONS = ["普通钢蹄铁", "铝蹄铁", "加护蹄垫", "塑料蹄铁", "治疗蹄铁", "裸蹄休牧"];

interface Props {
  label: string;
  entry: HoofEntry;
  prevEntry?: HoofEntry;
  prevDate?: string;
  onChange: (patch: Partial<HoofEntry>) => void;
}

const BADGE_CLASS: Record<HoofStatus, string> = {
  normal: "badge badge-normal",
  abnormal: "badge badge-abnormal",
  watch: "badge badge-watch",
};

export default function HoofCard({ label, entry, prevEntry, prevDate, onChange }: Props) {
  const status = draftHoofStatus(prevEntry, entry);
  const shoeChanged =
    !!prevEntry &&
    prevEntry.shoeType.trim() !== "" &&
    entry.shoeType.trim() !== "" &&
    prevEntry.shoeType.trim() !== entry.shoeType.trim();

  return (
    <article className={"hoof-card " + (status !== "normal" ? "is-flagged" : "")}>
      <header className="hoof-head">
        <h4>{label}</h4>
        <span className={BADGE_CLASS[status]}>{STATUS_TEXT[status]}</span>
      </header>

      {prevEntry && (
        <p className="hoof-prev">
          上次{prevDate ? `（${prevDate}）` : ""}：{prevEntry.shoeType || "—"} · 钉位
          {prevEntry.nailPositions || "—"}
          {prevEntry.shapeEval ? ` · ${prevEntry.shapeEval}` : ""}
        </p>
      )}

      <label className="check">
        <input
          type="checkbox"
          checked={entry.gaitAbnormal}
          onChange={(e) => onChange({ gaitAbnormal: e.target.checked })}
        />
        <span>步态异常</span>
      </label>

      {entry.gaitAbnormal && (
        <label className="field">
          <span>异常表现</span>
          <input
            value={entry.gaitNote}
            placeholder="如：硬地点头、转弯拖步"
            onChange={(e) => onChange({ gaitNote: e.target.value })}
          />
        </label>
      )}

      <label className="field">
        <span>蹄形评估{!entry.shapeEval.trim() && <em>（正常可留空）</em>}</span>
        <input
          value={entry.shapeEval}
          placeholder="如：外侧壁磨耗、蹄尖过长"
          onChange={(e) => onChange({ shapeEval: e.target.value })}
        />
      </label>

      <label className="field">
        <span>
          蹄铁类型
          {shoeChanged && <em className="change-tag">更换</em>}
        </span>
        <input
          list="shoe-options"
          value={entry.shoeType}
          placeholder="必填，选择或输入"
          onChange={(e) => onChange({ shoeType: e.target.value })}
        />
      </label>

      <label className="field">
        <span>钉位</span>
        <input
          value={entry.nailPositions}
          placeholder="必填，如：内外各4钉"
          onChange={(e) => onChange({ nailPositions: e.target.value })}
        />
      </label>
    </article>
  );
}
