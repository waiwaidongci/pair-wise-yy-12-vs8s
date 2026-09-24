import type { HoofPos } from "../types";
import { HOOF_POSITIONS, STATUS_TEXT } from "../types";
import type { ReviewItem } from "../lib";

interface Props {
  items: ReviewItem[];
  onOpen: (horseId: string) => void;
}

const GROUP_LABEL: Record<ReviewItem["group"], string> = {
  overdue: "逾期",
  due: "3天内到期",
  upcoming: "之后复查",
};

function hoofShort(pos: HoofPos): string {
  return HOOF_POSITIONS.find((p) => p.value === pos)?.short ?? pos;
}

export default function ReviewPanel({ items, onOpen }: Props) {
  const overdue = items.filter((i) => i.group === "overdue");
  const due = items.filter((i) => i.group === "due");
  const upcoming = items.filter((i) => i.group === "upcoming");
  const groups: ReviewItem["group"][] = ["overdue", "due", "upcoming"];
  const map: Record<ReviewItem["group"], ReviewItem[]> = { overdue, due, upcoming };

  return (
    <section className="panel review-panel">
      <div className="heading">
        <div>
          <p>复查提醒</p>
          <h2>到期与逾期优先</h2>
        </div>
        <span className="review-count">
          逾期 <b>{overdue.length}</b> · 到期 <b>{due.length}</b>
        </span>
      </div>

      {items.length === 0 && <p className="empty">暂无复查安排，先新增一条修蹄记录。</p>}

      {groups.map((g) =>
        map[g].length === 0 ? null : (
          <div key={g} className={"review-group review-" + g}>
            <h5>{GROUP_LABEL[g]}</h5>
            {map[g].map(({ record, days, abnormal }) => (
              <button
                key={record.id}
                className="review-item"
                onClick={() => onOpen(record.horseId)}
                title="打开档案详情"
              >
                <span className="review-horse">{record.horseId}</span>
                <span className="review-date">
                  复查日 {record.reviewDate}
                  <em>
                    {days < 0 ? `已逾期 ${-days} 天` : days === 0 ? "今天到期" : `还剩 ${days} 天`}
                  </em>
                </span>
                {abnormal.length > 0 ? (
                  <span className="review-abn">
                    {STATUS_TEXT.abnormal}/观察：{abnormal.map(hoofShort).join("、")}
                  </span>
                ) : (
                  <span className="review-ok">四蹄正常</span>
                )}
              </button>
            ))}
          </div>
        )
      )}
    </section>
  );
}
