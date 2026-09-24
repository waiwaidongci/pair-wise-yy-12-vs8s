import type { HoofPos, TrimRecord } from "../types";
import { HOOF_POSITIONS, HOOF_LABEL, STATUS_TEXT } from "../types";
import { hoofStatusAt, shoeChanges, todayStr } from "../lib";

interface Props {
  horseId: string;
  history: TrimRecord[]; // 时间正序
  onClose: () => void;
}

const BADGE_CLASS = {
  normal: "badge badge-normal",
  abnormal: "badge badge-abnormal",
  watch: "badge badge-watch",
} as const;

function HoofLine({ history, record, pos }: { history: TrimRecord[]; record: TrimRecord; pos: HoofPos }) {
  const h = record.hooves[pos];
  const status = hoofStatusAt(history, record.id, pos);
  const prev = history[history.findIndex((r) => r.id === record.id) - 1];
  const changed = prev && prev.hooves[pos].shoeType.trim() !== h.shoeType.trim();
  return (
    <div className={"detail-hoof " + (status !== "normal" ? "is-flagged" : "")}>
      <div className="detail-hoof-head">
        <b>{HOOF_LABEL[pos]}</b>
        <span className={BADGE_CLASS[status]}>{STATUS_TEXT[status]}</span>
        {changed && (
          <span className="change-tag">
            更换：{prev!.hooves[pos].shoeType} → {h.shoeType}
          </span>
        )}
      </div>
      <ul>
        <li>蹄铁：{h.shoeType}</li>
        <li>钉位：{h.nailPositions}</li>
        {h.shapeEval && <li>蹄形评估：{h.shapeEval}</li>}
        {h.gaitAbnormal && <li>步态异常：{h.gaitNote || "（未填说明）"}</li>}
      </ul>
    </div>
  );
}

export default function HorseDetail({ horseId, history, onClose }: Props) {
  const today = todayStr();
  const chronological = history;
  const timeline = [...chronological].reverse(); // 最新在上
  const latest = chronological[chronological.length - 1];

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal-head">
          <div>
            <p>马匹修蹄档案</p>
            <h2>{horseId}</h2>
            <small>
              共 {history.length} 次记录 · 最近复查日 {latest?.reviewDate}
              {latest && latest.reviewDate < today ? "（已逾期）" : ""}
            </small>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>

        <div className="timeline">
          {timeline.map((record) => {
            const changes = shoeChanges(
              chronological[chronological.findIndex((r) => r.id === record.id) - 1],
              record
            );
            return (
              <article key={record.id} className="timeline-item">
                <div className="timeline-date">
                  <b>{record.trimDate}</b>
                  <span>修蹄</span>
                  <span>
                    复查 {record.reviewDate}
                    {record.reviewDate < today && record.id === latest.id && <em className="overdue"> 逾期</em>}
                  </span>
                </div>
                <div className="timeline-body">
                  {changes.length > 0 && (
                    <p className="shoe-change-note">
                      本次更换蹄铁：
                      {changes.map((c) => (
                        <span key={c.pos} className="chip-change">
                          {HOOF_LABEL[c.pos]} {c.from} → {c.to}
                        </span>
                      ))}
                    </p>
                  )}
                  <div className="detail-grid">
                    {HOOF_POSITIONS.map((p) => (
                      <HoofLine key={p.value} history={chronological} record={record} pos={p.value} />
                    ))}
                  </div>
                  {record.note && <p className="detail-note">备注：{record.note}</p>}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
