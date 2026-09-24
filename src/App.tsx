import { useEffect, useMemo, useState } from "react";
import "./styles.css";

/* ---------------- 类型与常量 ---------------- */

type HoofStatus = "normal" | "abnormal" | "watching";
type Side = "L" | "R";

interface Hoof {
  gaitAbnormal: boolean; // 步态异常
  shape: string; // 蹄形评估
  shoeType: string; // 蹄铁类型
  nails: string; // 钉位
  note: string; // 照片 / 备注
  status: HoofStatus; // 正常 / 异常 / 持续观察
}

interface ShoeRecord {
  id: string;
  date: string; // 修蹄日期
  reviewDate: string; // 复查日期
  hoofs: Record<Side, [Hoof, Hoof]>; // [前蹄, 后蹄]
  note: string;
}

interface Horse {
  id: string; // 马匹编号
  records: ShoeRecord[]; // 按时间保留，新记录只追加，旧记录不覆盖
}

const STORAGE_KEY = "farrier-archive-v1";

const POSITIONS: { key: "LF" | "RF" | "LH" | "RH"; side: Side; index: 0 | 1; label: string; short: string }[] = [
  { key: "LF", side: "L", index: 0, label: "左前蹄", short: "LF" },
  { key: "RF", side: "R", index: 0, label: "右前蹄", short: "RF" },
  { key: "LH", side: "L", index: 1, label: "左后蹄", short: "LH" },
  { key: "RH", side: "R", index: 1, label: "右后蹄", short: "RH" },
];

const SHOE_TYPES = ["普通铁蹄铁", "铝蹄铁", "塑料蹄铁", "加护蹄垫", "矫正蹄铁", "无蹄铁(裸蹄)"];

const STATUS_TEXT: Record<HoofStatus, string> = {
  normal: "正常",
  abnormal: "异常",
  watching: "持续观察",
};

const emptyHoof = (): Hoof => ({
  gaitAbnormal: false,
  shape: "",
  shoeType: "",
  nails: "",
  note: "",
  status: "normal",
});

const emptyHoofSet = (): Record<Side, [Hoof, Hoof]> => ({
  L: [emptyHoof(), emptyHoof()],
  R: [emptyHoof(), emptyHoof()],
});

const today = () => new Date().toISOString().slice(0, 10);
const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

/* ---------------- 种子数据 ---------------- */

function seedHorses(): Horse[] {
  const mkHoof = (
    gaitAbnormal: boolean,
    shape: string,
    shoeType: string,
    nails: string,
    note: string,
    status: HoofStatus
  ): Hoof => ({ gaitAbnormal, shape, shoeType, nails, note, status });

  return [
    {
      id: "HORSE-18",
      records: [
        {
          id: uid(),
          date: daysFromNow(-20),
          reviewDate: daysFromNow(-6), // 已逾期
          note: "运动马 · 右前蹄外侧磨耗（示例数据）",
          hoofs: {
            L: [
              mkHoof(false, "蹄形对称，蹄壁平整", "铝蹄铁", "1、2、3、4 钉", "", "normal"),
              mkHoof(false, "轻度斜蹄，可继续观察", "普通铁蹄铁", "1、2、3 钉", "", "normal"),
            ],
            R: [
              mkHoof(true, "外侧蹄壁磨耗明显，蹄底轻度塌陷", "矫正蹄铁", "1、2、3、5 钉", "照片：外侧磨耗特写", "abnormal"),
              mkHoof(false, "蹄形良好", "普通铁蹄铁", "1、2、3、4 钉", "", "normal"),
            ],
          },
        },
      ],
    },
    {
      id: "HORSE-27",
      records: [
        {
          id: uid(),
          date: daysFromNow(-8),
          reviewDate: daysFromNow(6),
          note: "休养马 · 后蹄裂纹加护蹄垫（示例数据）",
          hoofs: {
            L: [
              mkHoof(false, "正常", "铝蹄铁", "1、2、3、4 钉", "", "normal"),
              mkHoof(true, "蹄尖纵向裂纹约 2cm", "加护蹄垫", "1、2、4 钉，避开裂纹", "照片：裂纹记录", "abnormal"),
            ],
            R: [
              mkHoof(false, "正常", "铝蹄铁", "1、2、3、4 钉", "", "normal"),
              mkHoof(false, "轻微白线裂，已处理", "加护蹄垫", "1、2、3 钉", "", "normal"),
            ],
          },
        },
      ],
    },
  ];
}

function loadHorses(): Horse[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Horse[];
  } catch {
    /* 数据损坏时回落为种子数据 */
  }
  return seedHorses();
}

/* ---------------- 子组件 ---------------- */

function StatusBadge({ status }: { status: HoofStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_TEXT[status]}</span>;
}

/** 单个蹄位卡片：左右前/后蹄并排录入，并展示同蹄位上次结果 */
function HoofCard({
  cfg,
  hoof,
  prevHoof,
  onChange,
  onCarry,
}: {
  cfg: (typeof POSITIONS)[number];
  hoof: Hoof;
  prevHoof?: Hoof;
  onChange: (patch: Partial<Hoof>) => void;
  onCarry: () => void;
}) {
  const unresolved = prevHoof && prevHoof.status !== "normal";

  return (
    <article className={`hoof-card hoof-card-${cfg.key}`}>
      <header className="hoof-head">
        <h4>{cfg.label}</h4>
        <StatusBadge status={hoof.status} />
      </header>

      {prevHoof ? (
        <div className={`prev-box${unresolved ? " prev-warn" : ""}`}>
          <p className="prev-title">
            上次结果 <StatusBadge status={prevHoof.status} />
          </p>
          <p>蹄形：{prevHoof.shape || "—"}</p>
          <p>
            蹄铁：{prevHoof.shoeType || "—"} · 钉位：{prevHoof.nails || "—"}
          </p>
          {prevHoof.gaitAbnormal && <p className="prev-gait">步态异常：{prevHoof.note || "未填写备注"}</p>}
          <button type="button" className="mini" onClick={onCarry}>
            带出上次结果
          </button>
          {unresolved && hoof.status === "normal" && (
            <p className="prev-hint">仍异常请勾选步态异常 → 自动转「持续观察」；确认恢复再保持「正常」</p>
          )}
          {unresolved && hoof.status !== "normal" && (
            <p className="prev-hint watching-hint">已标记持续观察；本次确认恢复可取消勾选步态异常</p>
          )}
        </div>
      ) : (
        <div className="prev-box prev-empty">
          <p>该蹄位无上次记录</p>
        </div>
      )}

      <label className="check">
        <input
          type="checkbox"
          checked={hoof.gaitAbnormal}
          onChange={(e) => onChange({ gaitAbnormal: e.target.checked })}
        />
        <span>步态异常（跛行 / 步幅不均 / 落蹄异常）</span>
      </label>

      <label className="field">
        <span>蹄形评估 *</span>
        <textarea
          rows={2}
          placeholder="如：蹄壁平整、外侧磨耗、裂纹…"
          value={hoof.shape}
          onChange={(e) => onChange({ shape: e.target.value })}
        />
      </label>

      <label className="field">
        <span>蹄铁类型 *</span>
        <select value={hoof.shoeType} onChange={(e) => onChange({ shoeType: e.target.value })}>
          <option value="">请选择</option>
          {SHOE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>钉位 *</span>
        <input
          placeholder="如：1、2、3、4 钉"
          value={hoof.nails}
          onChange={(e) => onChange({ nails: e.target.value })}
        />
      </label>

      <label className="field">
        <span>照片 / 备注</span>
        <input
          placeholder="照片编号或文字备注"
          value={hoof.note}
          onChange={(e) => onChange({ note: e.target.value })}
        />
      </label>
    </article>
  );
}

/* ---------------- 主应用 ---------------- */

function App() {
  const [horses, setHorses] = useState<Horse[]>(loadHorses);
  const [horseId, setHorseId] = useState("");
  const [date, setDate] = useState(today());
  const [reviewDate, setReviewDate] = useState(daysFromNow(28));
  const [note, setNote] = useState("");
  const [hoofs, setHoofs] = useState(emptyHoofSet());
  const [errors, setErrors] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(horses));
  }, [horses]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const horseMap = useMemo(() => new Map(horses.map((h) => [h.id, h])), [horses]);
  const selectedHorse = horseId ? horseMap.get(horseId.trim().toUpperCase()) : undefined;
  const prevRecord = selectedHorse?.records[selectedHorse.records.length - 1];

  const getPrevHoof = (side: Side, index: 0 | 1): Hoof | undefined =>
    prevRecord?.hoofs[side][index];

  /* 复查队列：先到期，再按逾期天数排序（逾期在前） */
  const reviewQueue = useMemo(() => {
    const t = today();
    return horses
      .filter((h) => h.records.length > 0)
      .map((h) => {
        const latest = h.records[h.records.length - 1];
        const diff = daysBetween(t, latest.reviewDate); // 负数=逾期
        const watching = Object.values(latest.hoofs)
          .flat()
          .some((hf) => hf.status !== "normal");
        return { horse: h, latest, diff, watching };
      })
      .filter((x) => x.diff <= 0 || x.watching)
      .sort((a, b) => a.diff - b.diff);
  }, [horses]);

  /* 指标 */
  const watchingCount = horses.filter((h) =>
    h.records.length
      ? Object.values(h.records[h.records.length - 1].hoofs)
          .flat()
          .some((hf) => hf.status !== "normal")
      : false
  ).length;
  const shoeChangeCount = horses.reduce((sum, h) => {
    if (h.records.length < 2) return sum;
    const a = h.records[h.records.length - 2];
    const b = h.records[h.records.length - 1];
    return (
      sum +
      POSITIONS.filter(
        (p) => a.hoofs[p.side][p.index].shoeType !== b.hoofs[p.side][p.index].shoeType
      ).length
    );
  }, 0);

  /* ---- 表单操作 ---- */

  const patchHoof = (side: Side, index: 0 | 1, patch: Partial<Hoof>) => {
    setHoofs((prev) => {
      const next: Record<Side, [Hoof, Hoof]> = {
        L: [{ ...prev.L[0] }, { ...prev.L[1] }],
        R: [{ ...prev.R[0] }, { ...prev.R[1] }],
      };
      const target = { ...next[side][index], ...patch };
      // 勾选步态异常：上次同蹄位未恢复 → 持续观察；否则 → 异常
      // 取消勾选：恢复正常
      if (patch.gaitAbnormal !== undefined) {
        const ph = getPrevHoof(side, index);
        target.status = patch.gaitAbnormal
          ? ph && ph.status !== "normal"
            ? "watching"
            : "abnormal"
          : "normal";
      }
      next[side][index] = target;
      return next;
    });
  };

  const carryHoof = (side: Side, index: 0 | 1) => {
    const ph = getPrevHoof(side, index);
    if (!ph) return;
    setHoofs((prev) => {
      const next: Record<Side, [Hoof, Hoof]> = {
        L: [{ ...prev.L[0] }, { ...prev.L[1] }],
        R: [{ ...prev.R[0] }, { ...prev.R[1] }],
      };
      // 带出上次评估内容；仍异常的自动转持续观察，恢复则正常
      const status: HoofStatus = ph.gaitAbnormal
        ? ph.status !== "normal"
          ? "watching"
          : "abnormal"
        : "normal";
      next[side][index] = {
        gaitAbnormal: ph.gaitAbnormal,
        shape: ph.shape,
        shoeType: ph.shoeType,
        nails: ph.nails,
        note: ph.note,
        status,
      };
      return next;
    });
  };

  const resetForm = (id = "") => {
    setHorseId(id);
    setDate(today());
    setReviewDate(daysFromNow(28));
    setNote("");
    setHoofs(emptyHoofSet());
    setErrors([]);
  };

  const validate = (): string[] => {
    const errs: string[] = [];
    if (horseId.trim().length < 2) errs.push("马匹编号不全（至少 2 个字符）");
    if (!date) errs.push("修蹄日期未填写");
    if (!reviewDate) errs.push("复查日期未填写");
    if (date && reviewDate && reviewDate < date) errs.push("复查日期不能早于修蹄日期");
    POSITIONS.forEach((p) => {
      const h = hoofs[p.side][p.index];
      if (!h.shape.trim()) errs.push(`${p.label}：蹄形评估未填写`);
      if (!h.shoeType) errs.push(`${p.label}：蹄铁类型未选择`);
      if (!h.nails.trim()) errs.push(`${p.label}：钉位未填写`);
    });
    return errs;
  };

  const save = () => {
    const errs = validate();
    setErrors(errs);
    if (errs.length) {
      setToast("资料不全或日期有误，未保存");
      return;
    }

    const id = horseId.trim().toUpperCase();
    const record: ShoeRecord = {
      id: uid(),
      date,
      reviewDate,
      note: note.trim(),
      hoofs: {
        L: [{ ...hoofs.L[0] }, { ...hoofs.L[1] }],
        R: [{ ...hoofs.R[0] }, { ...hoofs.R[1] }],
      },
    };

    setHorses((prev) => {
      const idx = prev.findIndex((h) => h.id === id);
      if (idx >= 0) {
        const copy = [...prev];
        // 追加新记录，绝不覆盖旧记录（含更换蹄铁类型的历史）
        copy[idx] = { ...copy[idx], records: [...copy[idx].records, record] };
        return copy;
      }
      return [...prev, { id, records: [record] }];
    });

    setToast(`已保存 ${id} 的修蹄记录，可在马匹档案打开详情`);
    resetForm();
  };

  const deleteHorse = (id: string) => {
    if (!confirm(`确定删除 ${id} 的全部档案？此操作不可恢复。`)) return;
    setHorses((prev) => prev.filter((h) => h.id !== id));
    if (detailId === id) setDetailId(null);
    if (horseId === id) resetForm();
  };

  const detailHorse = detailId ? horseMap.get(detailId) : undefined;

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62011 · 蹄铁师工作台 · Port 62011</p>
        <h1>马术蹄铁修整档案</h1>
        <span>
          四蹄并排记录，同一蹄位自动带出上次结果；仍异常转「持续观察」，恢复才转「正常」。记录按时间追加保存，重开页面不丢失。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>待复查 / 逾期</small>
          <strong>{reviewQueue.length}</strong>
        </article>
        <article>
          <small>持续观察马匹</small>
          <strong>{watchingCount}</strong>
        </article>
        <article>
          <small>本次更换蹄铁蹄位</small>
          <strong>{shoeChangeCount}</strong>
        </article>
        <article>
          <small>马匹档案</small>
          <strong>{horses.length}</strong>
        </article>
      </section>

      {/* 复查提醒：到期与逾期马匹优先排列 */}
      <section className="panel queue-panel">
        <div className="heading">
          <div>
            <p>复查提醒</p>
            <h2>到期 / 逾期马匹</h2>
          </div>
          <span className="queue-tip">逾期在前，同日持续观察优先处理</span>
        </div>
        {reviewQueue.length === 0 ? (
          <p className="empty">暂无到期或逾期复查；带「持续观察」的马匹也会列在这里。</p>
        ) : (
          <div className="queue-list">
            {reviewQueue.map(({ horse, latest, diff, watching }) => (
              <button
                key={horse.id}
                className={`queue-item${diff < 0 ? " overdue" : diff === 0 ? " due" : ""}`}
                onClick={() => setDetailId(horse.id)}
              >
                <b>{horse.id}</b>
                <span>
                  修蹄 {latest.date} · 复查 {latest.reviewDate}
                </span>
                <em>
                  {diff < 0
                    ? `逾期 ${-diff} 天`
                    : diff === 0
                    ? "今天到期"
                    : `还有 ${diff} 天`}
                </em>
                {watching && <span className="badge badge-watching">持续观察</span>}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="workspace">
        {/* 马匹列表 */}
        <aside className="panel">
          <h2>马匹档案</h2>
          <p className="aside-tip">选择马匹为其追加修蹄记录</p>
          <div className="horse-list">
            {horses.map((h) => {
              const latest = h.records[h.records.length - 1];
              const watching = Object.values(latest.hoofs)
                .flat()
                .some((hf) => hf.status !== "normal");
              return (
                <div key={h.id} className="horse-item">
                  <button
                    className={`horse-pick${horseId === h.id ? " active" : ""}`}
                    onClick={() => resetForm(h.id)}
                  >
                    <b>{h.id}</b>
                    <span>{h.records.length} 次修蹄记录</span>
                    {watching && <span className="badge badge-watching">观察</span>}
                  </button>
                  <button className="mini" onClick={() => setDetailId(h.id)}>
                    详情
                  </button>
                </div>
              );
            })}
            {horses.length === 0 && <p className="empty">还没有马匹档案</p>}
          </div>
          <button className="ghost full" onClick={() => resetForm("")}>
            + 登记新马匹
          </button>
        </aside>

        {/* 新增修蹄记录 */}
        <section className="panel form-panel">
          <div className="heading">
            <div>
              <p>{selectedHorse ? "复查 / 重钉" : "新马登记"}</p>
              <h2>{selectedHorse ? `${selectedHorse.id} · 第 ${selectedHorse.records.length + 1} 次修蹄` : "新增修蹄记录"}</h2>
            </div>
            <button className="primary" onClick={save}>
              保存记录
            </button>
          </div>

          {errors.length > 0 && (
            <div className="error-box">
              {errors.map((e) => (
                <p key={e}>⚠ {e}</p>
              ))}
            </div>
          )}

          <div className="form-top">
            <label className="field">
              <span>马匹编号 *</span>
              <input
                list="horse-id-list"
                placeholder="如 HORSE-18"
                value={horseId}
                onChange={(e) => setHorseId(e.target.value)}
              />
              <datalist id="horse-id-list">
                {horses.map((h) => (
                  <option key={h.id} value={h.id} />
                ))}
              </datalist>
            </label>
            <label className="field">
              <span>修蹄日期 *</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="field">
              <span>复查日期 *</span>
              <input
                type="date"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
              />
            </label>
          </div>

          {prevRecord && (
            <div className="prev-banner">
              上次修蹄 {prevRecord.date}，复查 {prevRecord.reviewDate}；各蹄位上次结果见下方卡片，可一键带出。
              更换蹄铁类型会作为新记录保存，旧记录保留在详情时间线中。
            </div>
          )}

          <div className="hoof-grid">
            <div className="hoof-corner" />
            <div className="hoof-col-head">前蹄</div>
            <div className="hoof-col-head">后蹄</div>
            <div className="hoof-side-label">左</div>
            <HoofCard
              cfg={POSITIONS[0]}
              hoof={hoofs.L[0]}
              prevHoof={getPrevHoof("L", 0)}
              onChange={(p) => patchHoof("L", 0, p)}
              onCarry={() => carryHoof("L", 0)}
            />
            <HoofCard
              cfg={POSITIONS[2]}
              hoof={hoofs.L[1]}
              prevHoof={getPrevHoof("L", 1)}
              onChange={(p) => patchHoof("L", 1, p)}
              onCarry={() => carryHoof("L", 1)}
            />
            <div className="hoof-side-label">右</div>
            <HoofCard
              cfg={POSITIONS[1]}
              hoof={hoofs.R[0]}
              prevHoof={getPrevHoof("R", 0)}
              onChange={(p) => patchHoof("R", 0, p)}
              onCarry={() => carryHoof("R", 0)}
            />
            <HoofCard
              cfg={POSITIONS[3]}
              hoof={hoofs.R[1]}
              prevHoof={getPrevHoof("R", 1)}
              onChange={(p) => patchHoof("R", 1, p)}
              onCarry={() => carryHoof("R", 1)}
            />
          </div>

          <label className="field full-note">
            <span>整体备注</span>
            <textarea
              rows={2}
              placeholder="运动马 / 休养马、教练复核意见、整体照片编号…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </section>
      </section>

      {/* 详情弹层：按时间保留全部记录 */}
      {detailHorse && (
        <div className="modal-mask" onClick={() => setDetailId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <p>马匹档案详情</p>
                <h2>{detailHorse.id}</h2>
                <span>共 {detailHorse.records.length} 次修蹄记录（旧记录不覆盖）</span>
              </div>
              <div className="modal-actions">
                <button
                  className="primary"
                  onClick={() => {
                    resetForm(detailHorse.id);
                    setDetailId(null);
                  }}
                >
                  追加修蹄记录
                </button>
                <button className="danger" onClick={() => deleteHorse(detailHorse.id)}>
                  删除档案
                </button>
                <button onClick={() => setDetailId(null)}>关闭</button>
              </div>
            </div>

            <div className="timeline">
              {[...detailHorse.records].reverse().map((rec, vi) => {
                const idx = detailHorse.records.length - 1 - vi;
                const prev = detailHorse.records[idx - 1];
                return (
                  <article key={rec.id} className="t-record">
                    <header>
                      <h3>
                        第 {idx + 1} 次 · 修蹄 {rec.date}
                      </h3>
                      <span className="review-chip">复查 {rec.reviewDate}</span>
                      {vi === 0 && <span className="badge badge-normal">最新</span>}
                    </header>
                    <div className="t-hoofs">
                      {POSITIONS.map((p) => {
                        const hf = rec.hoofs[p.side][p.index];
                        const oldShoe = prev?.hoofs[p.side][p.index].shoeType;
                        const changed = oldShoe && oldShoe !== hf.shoeType;
                        return (
                          <div key={p.key} className="t-hoof">
                            <div className="t-hoof-head">
                              <b>{p.label}</b>
                              <StatusBadge status={hf.status} />
                            </div>
                            <p>蹄形：{hf.shape || "—"}</p>
                            <p>
                              蹄铁：{hf.shoeType || "—"}
                              {changed && (
                                <span className="change-tag">
                                  更换（上次：{oldShoe}）
                                </span>
                              )}
                            </p>
                            <p>钉位：{hf.nails || "—"}</p>
                            {hf.gaitAbnormal && <p className="prev-gait">步态异常</p>}
                            {hf.note && <p className="t-note">备注：{hf.note}</p>}
                          </div>
                        );
                      })}
                    </div>
                    {rec.note && <p className="t-record-note">整体备注：{rec.note}</p>}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

export default App;
