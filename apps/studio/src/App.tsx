import { useEffect, useState } from "react";
import { Play, FlaskConical, FileText } from "lucide-react";
import { DEFAULT_GAME, GAMES, type GameDefinition } from "@slot/engine";
import { C, MONO } from "./theme";
import { useSimulation } from "./sim/useSimulation";
import { PlayPanel } from "./tabs/PlayPanel";
import { LabPanel } from "./tabs/LabPanel";
import { SpecPanel } from "./tabs/SpecPanel";

type Tab = "play" | "lab" | "spec";

export default function App() {
  const [tab, setTab] = useState<Tab>("play");
  const [game, setGame] = useState<GameDefinition>(DEFAULT_GAME);
  const sim = useSimulation();

  // 掛載時快速首跑，讓實驗室與規格書一進來就有數字。
  useEffect(() => { sim.run(DEFAULT_GAME, 300000); }, [sim.run]); // eslint-disable-line react-hooks/exhaustive-deps

  // 換遊戲 = 換一份定義；換完重新模擬讓所有分頁更新。
  const switchGame = (id: string) => {
    const g = GAMES.find((x) => x.id === id) ?? DEFAULT_GAME;
    setGame(g);
    sim.run(g, 300000);
  };

  const tabs: [Tab, string, typeof Play][] = [
    ["play", "試玩", Play],
    ["lab", "數值實驗室", FlaskConical],
    ["spec", "規格書", FileText],
  ];

  return (
    <div style={{ background: C.ink, color: C.text, minHeight: "100%", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 16px 48px" }}>
        <div className="flex items-end justify-between" style={{ flexWrap: "wrap", gap: 12, borderBottom: `1px solid ${C.line}`, paddingBottom: 14 }}>
          <div>
            <div className="flex items-center" style={{ gap: 10 }}>
              <span style={{ color: C.gold, fontSize: 11, letterSpacing: ".18em", fontWeight: 700, textTransform: "uppercase" }}>數值設計工作站 · v2</span>
              <select value={game.id} onChange={(e) => switchGame(e.target.value)}
                style={{ background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: "3px 8px", fontSize: 12, fontFamily: MONO, cursor: "pointer" }}>
                {GAMES.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}>
              {game.name} <span style={{ color: C.dim, fontWeight: 600, fontSize: 18 }}>· {game.layout.model} · 權重+RNG</span>
            </div>
          </div>
          <div className="flex" style={{ gap: 6, background: C.panel, padding: 4, borderRadius: 10, border: `1px solid ${C.line}` }}>
            {tabs.map(([id, lbl, Icon]) => (
              <button key={id} onClick={() => setTab(id)} className="flex items-center rounded-md"
                style={{ gap: 6, padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: tab === id ? C.gold : "transparent", color: tab === id ? C.ink : C.dim }}>
                <Icon size={15} /> {lbl}
              </button>
            ))}
          </div>
        </div>

        {tab === "play" && <PlayPanel game={game} />}
        {tab === "lab" && <LabPanel game={game} setGame={setGame} sim={sim} />}
        {tab === "spec" && <SpecPanel game={game} setGame={setGame} res={sim.res} goLab={() => setTab("lab")} />}

        <div style={{ marginTop: 28, paddingTop: 14, borderTop: `1px solid ${C.line}`, color: C.faint, fontSize: 11.5, lineHeight: 1.6 }}>
          設計駕駛艙，非上線認證模擬 — 最終 RTP 定案須 RD 用產品引擎、更大樣本與第三方認證。
          架構：引擎讀「遊戲定義」＋「機制模組」，新遊戲換定義、新機制加模組；整份定義可匯出 JSON（線上共用、版本控管的基礎）。
        </div>
      </div>
    </div>
  );
}
