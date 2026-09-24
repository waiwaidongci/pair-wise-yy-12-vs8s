import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { RecordDraft, TrimRecord } from "./types";
import {
  allHorseIds,
  historyOf,
  loadRecords,
  makeRecord,
  reviewList,
  saveRecords,
  seedRecords,
  shoeChanges,
} from "./lib";
import RecordForm from "./components/RecordForm";
import ReviewPanel from "./components/ReviewPanel";
import HorseList from "./components/HorseList";
import HorseDetail from "./components/HorseDetail";

const SEED_FLAG = "farrier-seeded-v1";

export default function App() {
  const [records, setRecords] = useState<TrimRecord[]>(() => {
    const loaded = loadRecords();
    if (loaded.length > 0) return loaded;
    if (localStorage.getItem(SEED_FLAG)) return [];
    const seed = seedRecords();
    localStorage.setItem(SEED_FLAG, "1");
    saveRecords(seed);
    return seed;
  });
  const [openHorse, setOpenHorse] = useState<string | null>(null);
  const [toast, setToast] = useState<string>("");

  // 重开浏览器后记录仍保留：任何变更都写入 localStorage
  useEffect(() => {
    saveRecords(records);
  }, [records]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const reviews = useMemo(() => reviewList(records), [records]);
  const pending = reviews.filter((i) => i.group !== "upcoming").length;
  const abnormalHorses = useMemo(
    () => allHorseIds(records).filter((id) => reviews.find((i) => i.record.horseId === id)?.abnormal.length).length,
    [records, reviews]
  );

  const changedShoes = useMemo(() => {
    let count = 0;
    for (const id of allHorseIds(records)) {
      const hist = historyOf(records, id);
      for (let i = 1; i < hist.length; i++) count += shoeChanges(hist[i - 1], hist[i]).length;
    }
    return count;
  }, [records]);

  const handleSave = (draft: RecordDraft) => {
    const rec = makeRecord(draft);
    setRecords((rs) => [...rs, rec]);
    setToast(`已保存 ${rec.horseId} 的修蹄记录，可在马匹列表打开详情`);
  };

  const detailHistory = openHorse ? historyOf(records, openHorse) : [];

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62011 · 马术蹄铁 · Port 62011</p>
        <h1>马术蹄铁修整档案</h1>
        <span>
          四蹄并排建档：步态异常、蹄形评估、蹄铁类型与钉位一次记录；再修同蹄位自动带出上次结果，
          仍异常转「持续观察」，恢复才回「正常」。蹄铁更换只追加不覆盖，复查逾期优先提醒。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>待复查（到期+逾期）</small>
          <strong>{pending}</strong>
        </article>
        <article>
          <small>异常/观察马匹</small>
          <strong>{abnormalHorses}</strong>
        </article>
        <article>
          <small>累计蹄铁更换</small>
          <strong>{changedShoes}</strong>
        </article>
        <article>
          <small>马匹档案</small>
          <strong>{allHorseIds(records).length}</strong>
        </article>
      </section>

      <section className="workspace">
        <ReviewPanel items={reviews} onOpen={setOpenHorse} />
        <RecordForm records={records} onSave={handleSave} />
      </section>

      <HorseList records={records} onOpen={setOpenHorse} />

      {openHorse && (
        <HorseDetail horseId={openHorse} history={detailHistory} onClose={() => setOpenHorse(null)} />
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
