import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Check, Download, FileText, Puzzle } from "lucide-react";
import type { GameDefinition } from "@slot/engine";
import { C, MONO, pct } from "../theme";
import { SecTitle, Field, Mini, ChkAuto, ChkMan } from "../ui";
import { ClassificationBreakdown, TaxonomyCatalog, classificationMarkdown, gameClassification } from "../classification";
import type { RichSimResult } from "../sim/types";

interface Props {
  game: GameDefinition;
  setGame: Dispatch<SetStateAction<GameDefinition>>;
  res: RichSimResult | null;
  goLab: () => void;
}

export function SpecPanel({ game, setGame, res, goLab }: Props) {
  const [manual, setManual] = useState({ vol: false, tail: false, hit: false, psych: false });
  const [jsonIn, setJsonIn] = useState("");
  const [copied, setCopied] = useState("");

  const setF = (k: keyof GameDefinition, v: any) => setGame((p) => ({ ...p, [k]: v }));
  const setFeatField = (id: string, k: string, v: any) => setGame((p) => ({ ...p, features: p.features.map((f) => f.id === id ? { ...f, [k]: v } : f) }));

  const featShare = res ? (res.rtpFeat / res.rtp) * 100 : 0;
  const ciHalf = res ? res.se * 100 * 1.96 : 0;
  const rtpPct = res ? res.rtp * 100 : 0;
  const inBand = !!res && Math.abs(rtpPct - game.rtpTarget) <= game.rtpTolerance;
  const sampleOk = !!res && ciHalf <= game.rtpTolerance;
  const featuresHaveMetrics = !!res && game.features.every((f) => res.perFeature[f.id] !== undefined);

  // 組 Markdown（數值自動帶入）
  const md = useMemo(() => {
    if (!res) return "（尚未模擬）";
    const L: (string | null)[] = [];
    L.push(`# ${game.name}`, `> ${game.tagline}`, ``);
    L.push(`## 核心描述`, `- 期待點：${game.expectation}`, `- 目標客群：${game.audience}`, `- 波動定位：${game.volatilityTarget}`, `- RTP 目標：${game.rtpTarget}% ± ${game.rtpTolerance}%`, `- 規格：${game.layout.reels}×${game.layout.rows} · ${game.layout.model} · 權重+RNG`, ``);
    L.push(classificationMarkdown(game), ``);
    L.push(`## 數值總表（模擬 ${(res.spins / 1000).toFixed(0)}k 局）`,
      `- RTP：${rtpPct.toFixed(2)}%（95% CI ±${ciHalf.toFixed(2)}%）`,
      `- 主遊戲 / 免費遊戲：${pct(res.rtpBase)} / ${pct(res.rtpFeat)}（feature 佔 ${featShare.toFixed(1)}%）`,
      `- 中獎率 / 空轉率：${pct(res.hitRate)} / ${pct(1 - res.hitRate)}`,
      `- 觸發率：1 / ${res.triggerOneIn.toFixed(0)}`,
      `- 波動 SD：${res.sd.toFixed(2)}　最大單局：${res.maxWin.toFixed(0)}x`,
      `- 倍數分佈：${res.buckets.map((b) => `${b.name} ${b.pct.toFixed(2)}%`).join("｜")}`, ``);
    L.push(`## 機制子規格`);
    game.features.forEach((f) => {
      const rc = res.perFeature[f.id] !== undefined ? (res.perFeature[f.id] * 100).toFixed(2) + "%" : "—";
      L.push(`### ${f.label}（${f.category === "mechanic" ? "遊戲機制" : "玩法模式"}・${f.type}）`, `- 觸發條件：${f.trigger}`, `- 觸發率：1 / ${res.triggerOneIn.toFixed(0)}`, `- 對 RTP 貢獻：${rc}`,
        f.params.multiplier ? `- 倍率：×${f.params.multiplier}` : null,
        f.params.retrigger !== undefined ? `- 可再觸發：${f.params.retrigger ? "是" : "否"}` : null,
        f.type === "holdAndSpin" ? `- 重抽次數：${f.params.respins}　重抽落幣機率：${f.params.respinCoinChance}` : null,
        f.type === "holdAndSpin" && f.params.coins ? `- 金幣面額（× 押注）：${Object.entries(f.params.coins).map(([k, v]) => `${k}=${v}`).join("、")}` : null,
        f.type === "holdAndSpin" ? `- 填滿盤面加給：${f.params.fullScreenBonus ?? 0}×` : null,
        `- 說明：${f.desc}`, ``);
    });
    L.push(`## 驗證`, `- [${inBand ? "x" : " "}] RTP 落在目標 ± 容差`, `- [${sampleOk ? "x" : " "}] 樣本足以在容差內定案（否則需 RD 大樣本）`, `- [${featuresHaveMetrics ? "x" : " "}] 每個機制都有子規格數值`, `- [${manual.vol ? "x" : " "}] 波動定位與體感一致`, `- [${manual.tail ? "x" : " "}] 倍數分佈尾端符合預期`, `- [${manual.hit ? "x" : " "}] 中獎率 / 空轉節奏 OK`, `- [${manual.psych ? "x" : " "}] 已做心理層 / 合規鉤子檢查（另立檢核）`);
    return L.filter((x) => x !== null).join("\n");
  }, [game, res, rtpPct, ciHalf, featShare, inBand, sampleOk, featuresHaveMetrics, manual]);

  const cls = gameClassification(game);
  const catalogKeys = [cls.pay?.key, ...cls.modes.map((m) => m.entry?.key), ...cls.mechanics.map((m) => m.key)].filter(Boolean) as string[];

  const copy = (text: string, tag: string) => { try { navigator.clipboard?.writeText(text); } catch { /* clipboard 不可用時忽略 */ } setCopied(tag); setTimeout(() => setCopied(""), 1500); };
  const loadJson = () => {
    try {
      const g = JSON.parse(jsonIn);
      if (g && g.weights && g.paytable && g.features && g.scatter && g.layout && g.symbols && g.paying && g.wild) setGame(g);
      else alert("JSON 缺少必要欄位（weights / paytable / features / scatter / layout / symbols / paying / wild）");
    } catch (e: any) { alert("JSON 解析失敗：" + e.message); }
  };

  if (!res) return <div className="rounded-xl p-8" style={{ marginTop: 18, background: C.panel, border: `1px dashed ${C.line}`, textAlign: "center", color: C.dim }}>尚未有模擬數據。<button onClick={goLab} style={{ color: C.teal, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>到數值實驗室</button>跑一次。</div>;

  return (
    <div style={{ marginTop: 18 }}>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,360px)", gap: 16 }}>
        {/* 左：規格書本體 */}
        <div className="flex" style={{ flexDirection: "column", gap: 14 }}>
          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <SecTitle>核心描述</SecTitle>
            <Field label="遊戲名稱" value={game.name} onChange={(v) => setF("name", v)} />
            <Field label="一句話特色 / fantasy" value={game.tagline} onChange={(v) => setF("tagline", v)} area />
            <Field label="期待點" value={game.expectation} onChange={(v) => setF("expectation", v)} area />
            <Field label="目標客群" value={game.audience} onChange={(v) => setF("audience", v)} area />
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <Field label="波動定位" value={game.volatilityTarget} onChange={(v) => setF("volatilityTarget", v)} />
              <Field label="RTP 目標 %" value={game.rtpTarget} onChange={(v) => setF("rtpTarget", parseFloat(v) || 0)} num />
              <Field label="容差 ±%" value={game.rtpTolerance} onChange={(v) => setF("rtpTolerance", parseFloat(v) || 0)} num />
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <SecTitle>玩法分類 <span style={{ color: C.faint, fontWeight: 500, fontSize: 11 }}>· 三軸：贏分方式／玩法模式／遊戲機制</span></SecTitle>
            <ClassificationBreakdown game={game} />
          </div>

          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <SecTitle>數值總表 <span style={{ color: C.faint, fontWeight: 500, fontSize: 11 }}>· 自動帶入（模擬 {(res.spins / 1000).toFixed(0)}k）</span></SecTitle>
            <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              <Mini label="RTP" value={rtpPct.toFixed(2) + "%"} sub={`目標 ${game.rtpTarget}±${game.rtpTolerance}`} ok={inBand} accent={C.value} />
              <Mini label="CI ±" value={ciHalf.toFixed(2) + "%"} sub="95% 信賴" ok={sampleOk} accent={C.text} />
              <Mini label="feature 佔" value={featShare.toFixed(1) + "%"} accent={C.purple} />
              <Mini label="中獎率" value={pct(res.hitRate)} sub={`空轉 ${pct(1 - res.hitRate)}`} accent={C.teal} />
              <Mini label="觸發" value={`1/${res.triggerOneIn.toFixed(0)}`} accent={C.text} />
              <Mini label="波動 / 最大" value={`${res.sd.toFixed(1)} / ${res.maxWin.toFixed(0)}x`} accent={C.gold} />
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <SecTitle>機制子規格 <span style={{ color: C.faint, fontWeight: 500, fontSize: 11 }}>· 每個機制一張，數值自動帶</span></SecTitle>
            {game.features.map((f) => (
              <div key={f.id} className="rounded-lg p-3" style={{ background: C.panel2, border: `1px solid ${C.line}`, marginBottom: 8 }}>
                <div className="flex items-center" style={{ gap: 8, marginBottom: 6 }}>
                  <Puzzle size={14} color={f.category === "mechanic" ? C.purple : C.gold} /><span style={{ fontWeight: 800, fontSize: 14 }}>{f.label}</span>
                  <span style={{ color: C.faint, fontSize: 11, fontFamily: MONO }}>type: {f.type}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: f.category === "mechanic" ? C.purple : C.gold, border: `1px solid ${(f.category === "mechanic" ? C.purple : C.gold)}55`, borderRadius: 4, padding: "0 6px" }}>{f.category === "mechanic" ? "遊戲機制" : "玩法模式"}</span>
                </div>
                <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 6 }}>
                  <Mini label="觸發" value={f.trigger} small />
                  <Mini label="觸發率" value={`1/${res.triggerOneIn.toFixed(0)}`} small accent={C.text} />
                  <Mini label="RTP 貢獻" value={res.perFeature[f.id] !== undefined ? (res.perFeature[f.id] * 100).toFixed(2) + "%" : "—"} small accent={C.purple} />
                  <Mini label="參數" value={f.type === "holdAndSpin" ? `重抽 ${f.params.respins} · 落幣 ${f.params.respinCoinChance}` : `×${f.params.multiplier ?? "—"} / retrig ${f.params.retrigger ? "可" : "不可"}`} small />
                </div>
                <Field label="說明" value={f.desc} onChange={(v) => setFeatField(f.id, "desc", v)} area />
              </div>
            ))}
            <div style={{ color: C.faint, fontSize: 11, lineHeight: 1.5 }}>新機制（sticky wild / hold &amp; spin / cascade / 漸進式 JP …）= 引擎註冊一個模組 + 這裡自動多一張子規格。</div>
          </div>
        </div>

        {/* 右：驗證 + 匯出 */}
        <div className="flex" style={{ flexDirection: "column", gap: 14 }}>
          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <SecTitle>驗證 checklist</SecTitle>
            <ChkAuto ok={inBand} label="RTP 落在目標 ± 容差" detail={`${rtpPct.toFixed(2)}% vs ${game.rtpTarget}±${game.rtpTolerance}%`} />
            <ChkAuto ok={sampleOk} warn label="樣本足以在容差內定案" detail={sampleOk ? "CI 在容差內" : `CI ±${ciHalf.toFixed(2)}% > 容差 — 需 RD 大樣本`} />
            <ChkAuto ok={featuresHaveMetrics} label="每個機制都有子規格數值" />
            <div style={{ height: 1, background: C.line, margin: "8px 0" }} />
            <ChkMan v={manual.vol} on={() => setManual((m) => ({ ...m, vol: !m.vol }))} label="波動定位與體感一致" />
            <ChkMan v={manual.tail} on={() => setManual((m) => ({ ...m, tail: !m.tail }))} label="倍數分佈尾端符合預期" />
            <ChkMan v={manual.hit} on={() => setManual((m) => ({ ...m, hit: !m.hit }))} label="中獎率 / 空轉節奏 OK" />
            <ChkMan v={manual.psych} on={() => setManual((m) => ({ ...m, psych: !m.psych }))} label="心理層 / 合規鉤子已檢查（另立檢核）" />
          </div>

          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <SecTitle>匯出 <span style={{ color: C.faint, fontWeight: 500, fontSize: 11 }}>· 都在工具內，不另開檔</span></SecTitle>
            <button onClick={() => copy(md, "md")} className="flex items-center justify-center rounded-lg" style={{ width: "100%", gap: 6, padding: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: C.gold, color: C.ink, marginBottom: 8 }}>
              {copied === "md" ? <Check size={15} /> : <FileText size={15} />} {copied === "md" ? "已複製" : "複製規格書 Markdown"}
            </button>
            <textarea readOnly value={md} style={{ width: "100%", height: 130, background: C.panel2, color: C.dim, border: `1px solid ${C.line}`, borderRadius: 8, padding: 8, fontSize: 10.5, fontFamily: MONO, resize: "vertical" }} />
          </div>

          <div className="rounded-xl p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <SecTitle>遊戲定義 JSON <span style={{ color: C.faint, fontWeight: 500, fontSize: 11 }}>· 共用 / 版本控管</span></SecTitle>
            <button onClick={() => copy(JSON.stringify(game, null, 2), "json")} className="flex items-center justify-center rounded-lg" style={{ width: "100%", gap: 6, padding: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: "none", background: C.teal, color: C.ink, marginBottom: 8 }}>
              {copied === "json" ? <Check size={14} /> : <Download size={14} />} {copied === "json" ? "已複製" : "匯出目前遊戲定義"}
            </button>
            <textarea value={jsonIn} onChange={(e) => setJsonIn(e.target.value)} placeholder="貼上遊戲定義 JSON 以匯入…" style={{ width: "100%", height: 70, background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: 8, fontSize: 11, fontFamily: MONO, resize: "vertical" }} />
            <button onClick={loadJson} disabled={!jsonIn.trim()} className="rounded-lg" style={{ width: "100%", marginTop: 6, padding: 7, fontSize: 12, fontWeight: 700, cursor: jsonIn.trim() ? "pointer" : "default", border: `1px solid ${C.line}`, background: "transparent", color: jsonIn.trim() ? C.teal : C.faint }}>匯入並套用</button>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <TaxonomyCatalog highlightKeys={catalogKeys} />
      </div>
    </div>
  );
}
