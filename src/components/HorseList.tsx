import type { HoofPos, TrimRecord } from "../types";
import { HOOF_POSITIONS, STATUS_TEXT } from "../types";
import { historyOf, latestAbnormalHooves, reviewList } from "../lib";

interface Props {
  records: TrimRecord[];
  onOpen: (horseId: string) => void;
}

function hoofShort(pos: HoofPos): string {
  return HOOF_POSITIONS.find((p) => p.value === pos)?.short ?? pos;
}

export default function HorseList({ records, onOpen }: Props) {
  const reviewMap = new Map(reviewList(records).map((i) => [i.record.horseId, i]));
  const ids = Array.from(
    new Set(records.map((r) => r.horseId.trim().toUpperCase()))
  ).sort();

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>马匹档案</p>
          <h2>马匹列表（{ids.length}）</h2>
        </div>
      </div>
      {ids.length === 0 && <p className="empty">暂无马匹，保存第一条修蹄记录后出现在这里。</p>}
      <div className="horse-list">
        {ids.map((id) => {
          const hist = historyOf(records, id);
          const latest = hist[hist.length - 1];
          const abnormal = latestAbnormalHooves(records, id);
          const review = reviewMap.get(id);
          return (
            <button key={id} className="horse-item" onClick={() => onOpen(id)}>
              <div className="horse-main">
                <b>{id}</b>
                <span>
                  上次修蹄 {latest.trimDate} · 复查 {latest.reviewDate}
                </span>
              </div>
              <div className="horse-tags">
                {abnormal.length > 0 ? (
                  <span className="tag tag-abn">
                    {STATUS_TEXT.abnormal}/观察 {abnormal.map(hoofShort).join("、")}
                  </span>
                ) : (
                  <span className="tag tag-ok">四蹄正常</span>
                )}
                {review?.group === "overdue" && <span className="tag tag-overdue">逾期{-review.days}天</span>}
                {review?.group === "due" && (
                  <span className="tag tag-due">{review.days === 0 ? "今日复查" : `${review.days}天后`}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
