import { useMemo, useState } from "react";
import type { HoofPos, RecordDraft, TrimRecord } from "../types";
import { HOOF_POSITIONS } from "../types";
import {
  addDays,
  allHorseIds,
  emptyDraft,
  historyOf,
  prefillFrom,
  shoeChanges,
  validateDraft,
} from "../lib";
import HoofCard, { SHOE_OPTIONS } from "./HoofCard";

interface Props {
  records: TrimRecord[];
  onSave: (draft: RecordDraft) => void;
}

export default function RecordForm({ records, onSave }: Props) {
  const [draft, setDraft] = useState<RecordDraft>(() => emptyDraft());
  const [horseTouched, setHorseTouched] = useState(false);
  const [reviewTouched, setReviewTouched] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const horseIds = useMemo(() => allHorseIds(records), [records]);
  const history = useMemo(
    () => (draft.horseId.trim() ? historyOf(records, draft.horseId) : []),
    [records, draft.horseId]
  );
  const prev = history[history.length - 1];
  const knownHorse = horseIds.includes(draft.horseId.trim().toUpperCase());

  const patchHoof = (pos: HoofPos, patch: Partial<RecordDraft["hooves"][HoofPos]>) =>
    setDraft((d) => ({ ...d, hooves: { ...d.hooves, [pos]: { ...d.hooves[pos], ...patch } } }));

  const onTrimDate = (trimDate: string) =>
    setDraft((d) => ({
      ...d,
      trimDate,
      reviewDate: reviewTouched || !trimDate ? d.reviewDate : addDays(trimDate, 28),
    }));

  const applyLast = () => {
    if (prev) {
      setDraft((d) => prefillFrom(prev, d.trimDate || undefined));
      setErrors([]);
    }
  };

  const reset = () => {
    setDraft(emptyDraft());
    setHorseTouched(false);
    setReviewTouched(false);
    setErrors([]);
  };

  const submit = () => {
    const errs = validateDraft(draft);
    setErrors(errs);
    if (errs.length === 0) {
      onSave(draft);
      reset();
    }
  };

  const changes = shoeChanges(prev, draft);

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p>修蹄档案</p>
          <h2>新增修蹄记录</h2>
        </div>
        <div className="heading-actions">
          <button type="button" onClick={reset}>
            清空
          </button>
          <button type="button" className="primary" onClick={submit}>
            保存记录
          </button>
        </div>
      </div>

      <div className="form-top">
        <label className="field">
          <span>马匹编号</span>
          <input
            list="horse-ids"
            value={draft.horseId}
            placeholder="如 HORSE-18"
            onChange={(e) => {
              setHorseTouched(true);
              setDraft((d) => ({ ...d, horseId: e.target.value }));
            }}
          />
          <datalist id="horse-ids">
            {horseIds.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span>修蹄日期</span>
          <input type="date" value={draft.trimDate} onChange={(e) => onTrimDate(e.target.value)} />
        </label>

        <label className="field">
          <span>下次复查日期</span>
          <input
            type="date"
            value={draft.reviewDate}
            onChange={(e) => {
              setReviewTouched(true);
              setDraft((d) => ({ ...d, reviewDate: e.target.value }));
            }}
          />
        </label>

        <label className="field grow">
          <span>备注 / 照片编号</span>
          <input
            value={draft.note}
            placeholder="如：照片 P-18-03，已与教练沟通"
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          />
        </label>
      </div>

      {horseTouched && knownHorse && (
        <div className="prefill-bar">
          {prev ? (
            <>
              <span>
                该马上次修蹄 <b>{prev.trimDate}</b>（复查日 {prev.reviewDate}
                ）。再修同一蹄位时可带出上次结果：
              </span>
              <button type="button" onClick={applyLast}>
                带出上次结果
              </button>
            </>
          ) : (
            <span>该马暂无历史档案，将建立首条记录。</span>
          )}
        </div>
      )}

      <div className="hoof-grid">
        {HOOF_POSITIONS.map((p) => (
          <HoofCard
            key={p.value}
            label={p.label}
            entry={draft.hooves[p.value]}
            prevEntry={prev?.hooves[p.value]}
            prevDate={prev?.trimDate}
            onChange={(patch) => patchHoof(p.value, patch)}
          />
        ))}
      </div>

      <datalist id="shoe-options">
        {SHOE_OPTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {changes.length > 0 && (
        <p className="shoe-change-note">
          蹄铁更换（旧记录保留，不会覆盖）：
          {changes.map((c) => (
            <span key={c.pos} className="chip-change">
              {HOOF_POSITIONS.find((p) => p.value === c.pos)?.short} {c.from} → {c.to}
            </span>
          ))}
        </p>
      )}

      {errors.length > 0 && (
        <div className="form-errors" role="alert">
          <b>资料不全，记录未保存：</b>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
