/**
 * SLOT 玩法分類體系（taxonomy）— 競品 / 媒體網站調查整理出的權威目錄。
 * ------------------------------------------------------------
 * 三軸（互不混淆）：
 *   pay      贏分方式 Pay Mechanics — base 怎麼偵測 / 計算贏分（一個遊戲只有一種）。
 *   mode     玩法模式 Game Modes    — 獨立、可被認證的結算「狀態」（可疊加多個）。
 *   mechanic 遊戲機制 Feature Mechanics — 符號 / 盤面「修飾」，掛在某個贏分方式或模式之上（可自由疊加）。
 *
 * 組合規則：一個遊戲 = 1 個 pay + 0..N 個 mode + 0..N 個 mechanic。
 * 判準：會產生「獨立認證 RTP 狀態」→ mode；定義 base 贏分幾何 → pay；其餘（含單一符號觸發的重抽鏈）→ mechanic。
 * tumble/連爆 是雙重身分：它是 cluster(集合連爆)/scatter(分散連爆) 的結算引擎，但機制上是盤面修飾 →
 *   歸在 mechanic（cascade），pay 項目交叉引用、RTP 只計一次。
 *
 * 這份目錄是「分類的唯一真相」：studio 用它渲染分類百科、把每個遊戲/機制標記到對應節點，
 * 並由 implemented 旗標標示「引擎已可模擬 / 規劃中」。新增玩法時，先在這裡登錄一個 key。
 */

export type Axis = "pay" | "mode" | "mechanic";

export interface TaxonomyEntry {
  /** 穩定 slug，跨檔交叉引用用（GameDefinition.payMechanic / FeatureDef.taxonomyKey / GameDefinition.mechanics）。 */
  key: string;
  axis: Axis;
  nameEN: string;
  nameZH: string;
  /** 同義詞 / 廠商專有名稱。 */
  aka?: string;
  definition: string;
  /** 移動 RTP 的主要可調旋鈕。 */
  mathLevers: string;
  /** 對波動的影響。 */
  volatility: string;
  /** 數值工具該算什麼指標 / 怎麼測。 */
  howToTest: string;
  examples: string;
  prevalence: "core" | "common" | "niche";
  /** 引擎目前是否已模擬（false = 已分類、規劃中）。 */
  implemented?: boolean;
}

export interface AxisInfo {
  id: Axis;
  nameZH: string;
  nameEN: string;
  desc: string;
}

export const AXES: AxisInfo[] = [
  {
    id: "pay",
    nameZH: "贏分方式",
    nameEN: "Pay Mechanics",
    desc: "base 如何偵測與計算贏分（贏分幾何）。一個遊戲只有一種；自我延伸型（Megaways/Infinity/帶 tumble 的 cluster）其延續機率本身就是 RTP 槓桿，固定幾何（線/路/不擴張 cluster）則由權重+賠付表決定 RTP。",
  },
  {
    id: "mode",
    nameZH: "玩法模式",
    nameEN: "Game Modes",
    desc: "取代或並存於 base 的獨立結算狀態，各有自己的 reel set / 規則 / RTP 配置（需各自認證）。模式不增加莊家優勢，而是把同一份 EV 重分配成更稀有、更大、更高波動的命中。觸發頻率與 bonus EV 占比是兩大主槓桿。",
  },
  {
    id: "mechanic",
    nameZH: "遊戲機制",
    nameEN: "Feature Mechanics / Modifiers",
    desc: "每局 / 每回合的符號與盤面修飾，掛在某 pay 或 mode 之上；改變符號、位置、盤面形狀或單局結算，但不構成獨立認證狀態、也不是 base 贏分幾何。靠調低賠付/權重補回 RTP。",
  },
];

export const TAXONOMY: TaxonomyEntry[] = [
  // ───────────────────────── 贏分方式 Pay Mechanics ─────────────────────────
  {
    key: "lines", axis: "pay", nameEN: "Fixed / Selectable Paylines", nameZH: "固定/可選連線（連線）",
    aka: "lines, win lines, multi-line, 連線",
    definition: "只有當相符符號落在預定路徑（橫/斜/鋸齒）上、自第 1 軸由左到右相鄰才中獎；不在線上的符號不計分。固定=全線恆開，可選=玩家啟用子集。",
    mathLevers: "線數+幾何、各軸虛擬卷軸符號權重、賠付表、卷軸長度。RTP=Σ(獎×機率)/押注（線會重疊，非獨立）。權重/賠付不變時，線數本身不改 RTP。",
    volatility: "可調滿全幅。多線+密集低分符號=高命中低波動；少數高價線或後置 5 連=高波動。是其他機制的低-中波動基準。",
    howToTest: "卷軸有界時做全循環解析枚舉求精確 RTP/命中率，再用蒙地卡羅交叉驗；逐線中獎機率=沿線各軸停止機率連乘後加總。",
    examples: "Book of Dead（10 固定線, Play'n GO）；Rainbow Riches；經典 10/20/25 線", prevalence: "core",
  },
  {
    key: "ways", axis: "pay", nameEN: "Ways-to-Win (243/1024/3125/4096)", nameZH: "路數玩法（路 / All-Ways）",
    aka: "way, all-ways, adjacent ways, multiway, 路",
    definition: "無固定線：任何相符符號落在相鄰軸（自最左軸起）即中獎，不論列位。路數=各軸列高連乘（5×3=243）。平押、非逐路押。",
    mathLevers: "盤面列高（抬高原始路數+基礎命中）、各軸符號權重（同軸 2 個=該軸因子×2）、賠付表縮放、卷軸長度。堆疊高分符號大幅抬高上限。路數本身由盤面形狀導出，非獨立 RTP 槓桿。",
    volatility: "同 RTP 下通常比少線遊戲命中更高、基礎波動更低；設計者再用符號堆疊、倍數、把多數 RTP 推進 bonus 來拉高波動。",
    howToTest: "卷軸有界做全循環、否則蒙地卡羅；回報路數、命中率、贏分分佈；量測堆疊符號帶來的波動；確認 base 對 feature 的 RTP 拆分。",
    examples: "Thunderstruck II（243）；Buffalo 系（1024）；Big Bass base", prevalence: "core", implemented: true,
  },
  {
    key: "megaways", axis: "pay", nameEN: "Megaways (BTG variable ways)", nameZH: "Megaways 變動路數",
    aka: "Megaways™, variable ways, up to 117,649 ways",
    definition: "BTG 授權引擎。每軸每局顯示隨機格數（常 2–7），路數逐局變動最高 117,649（7^6）。相鄰自左讀路；幾乎必配 tumble + 漸增免費局倍數。（純 bonus 加列而非每局隨機 → 屬機制 Grid Expansion。）",
    mathLevers: "各軸格數（高度）分佈、各高度的卷軸權重、tumble 延續機率+連鎖倍數階梯（主導）、賠付表。每局路數是隨機變數，封頂機率極小。",
    volatility: "結構性中高至極高；變動高度+tumble+漸升（常不重置）倍數造成長空轉與罕見巨獎。倍數階梯才是波動主因，非路數本身。",
    howToTest: "必用蒙地卡羅（無封閉解）：100k→1B 局＋95%/99% CI；回報路數分佈、RTP 收斂、連鎖深度分佈、倍數階梯到達機率、最大贏可達性。",
    examples: "Bonanza, Extra Chilli（BTG）；Buffalo King Megaways（Pragmatic 授權）", prevalence: "core",
  },
  {
    key: "cluster", axis: "pay", nameEN: "Cluster Pays", nameZH: "集合連爆（相鄰群組支付）",
    aka: "cluster wins, grid pays, Megaclusters, 集合連爆",
    definition: "方/矩形盤（5×5…8×8）。中獎=N+ 個同符號「正交相鄰」（上下左右、不含對角）相連，常 min 5；賠付隨群組大小遞增。無線/軸/路。幾乎必配 tumble（連爆）— tumble 本身歸機制 cascade，此處交叉引用。",
    mathLevers: "盤面大小、最小群組數+大小→賠付曲線（陡/凸=高波動）、符號權重/種類數（種類少=群組大）、tumble 延續+群組倍數累進、可橋接群組的 wild。tumble 延續機率是 RTP 槓桿。",
    volatility: "可跨全幅；大小→賠付曲線與 tumble 倍數階梯主導。小群組頻繁（低基礎波動），但巨獎需靠連消堆出罕見大連通塊 → 多為中高至高。",
    howToTest: "只能模擬（無封閉解）：蒙地卡羅跑完整 tumble 鏈；回報群組大小分佈、平均連消次數、RTP、命中率、大獎尾端 p99/p99.9、倍數到達。",
    examples: "Reactoonz（Play'n GO）；Aloha! Cluster Pays（NetEnt）；Sugar Rush（Pragmatic）", prevalence: "core",
  },
  {
    key: "scatterPays", axis: "pay", nameEN: "Scatter Pays / Pay-Anywhere", nameZH: "分散連爆（任意位置計數支付）",
    aka: "pay-anywhere, scatter pays, 分散連爆",
    definition: "中獎只需某賠付符號在盤面任意位置出現達最低「數量」— 無相鄰、無線、無路、位置完全無關（如 8+ 個就賠）。與「觸發用散佈」不同。常配 tumble（連爆）與全局倍數球。",
    mathLevers: "盤面總格數、各符號出現權重、數量門檻+數量→賠付曲線、tumble 延續+倍數球、符號數。每次 tumble 的中獎≈位置上的二項計數。",
    volatility: "機制本身利於命中（去掉相鄰、同門檻下比 cluster 命中高）；現代設計用罕見倍數球堆疊+陡賠付曲線把波動拉高。",
    howToTest: "模擬：建模每次 tumble 的數量分佈（二項式）、沿鏈加總數量→賠付；回報 RTP、命中率、倍數球貢獻%、贏分百分位、最大贏可達性。",
    examples: "Sweet Bonanza, Gates of Olympus（Pragmatic）", prevalence: "core",
  },
  {
    key: "coinValuePay", axis: "pay", nameEN: "Prize / Coin-Value Pay", nameZH: "金額符號累計支付（面值加總）",
    aka: "cash-value pays, money-symbol pay, value summation",
    definition: "賠付符號帶「身上面額」，贏分=盤面面額總和（常由收集器符號蒐集），與線/路/相鄰/數量曲線無關。已是獨立的 base 贏分模型（不只在 Hold & Spin 內）。",
    mathLevers: "面額符號落地權重、各面額分佈（denom 表）、是否需收集器才實現（收集機率）、收集器倍數、面額是否跨局累積。RTP=E[加總面額×P(實現)]，後置於收集事件。",
    volatility: "中至高、塊狀：很多局只見面額符號卻不賠，直到收集器落下才一次大賠。延後實現拉高波動。",
    howToTest: "模擬面額符號落點（加權抽 denom）+收集器落地機率；回報 E[盤面面額]、收集率、已實現賠付分佈、RTP、貢獻%、尾端百分位。",
    examples: "Cash Volt（Red Tiger）；Big Bass 漁夫收集面額；Money Cart 面值讀取（Relax）", prevalence: "common",
  },
  {
    key: "infinityReels", axis: "pay", nameEN: "Infinity / Expanding-Reel Ways", nameZH: "無限延展卷軸路數（Infinity Reels）",
    aka: "Infinity Reels, InfiniReels, End2End, expanding reels",
    definition: "卷軸由窄（常 3 軸=27 路）起，每當最新軸產生中獎就向右加一軸、路數×列高，無上限直到無新中獎；相鄰自左讀；通常每加一軸倍數+1。",
    mathLevers: "維持延展的符號相符延續機率 p（驅動鏈長、是 RTP 槓桿）、各軸路數成長因子（列高）、每加軸的遞增倍數、最大贏封頂。p<1 使長鏈罕見 → EV 有限；p 微調即大幅移動 RTP 與波動。",
    volatility: "高；賠付由罕見長延展鏈主導 — 重右尾、起伏大。",
    howToTest: "模擬：鏈長近似 p 的幾何分佈；蒙地卡羅求 RTP、鏈長分佈、終止時倍數分佈、封頂命中機率。",
    examples: "El Dorado Infinity Reels（ReelPlay/Relax）；Gods of Gold InfiniReels（NetEnt）", prevalence: "common",
  },
  {
    key: "linesWaysHybrid", axis: "pay", nameEN: "Lines + Ways Hybrid / Dynamic-Ways", nameZH: "混合/動態路數（線+路 或 自我擴增）",
    aka: "hybrid pay, dual-evaluation, self-amplifying ways",
    definition: "同一遊戲同時用固定線與路數（或依模式切換），或活躍路數因盤面事件中途增生。唯一明確非互斥的 pay 項（兩種幾何的聯集/切換）。純中途路數膨脹（xWays/PopWins）則屬機制。",
    mathLevers: "線+路槓桿的聯集；兩種計分間、base 對 feature 間的 RTP 拆分；自我擴增則看擴增事件頻率+揭示/合併大小分佈+合格符號。須避免雙重計分。",
    volatility: "可調滿幅；自我擴增變體偏高（單一觸發即膨脹路數與贏分、增肥上尾）。",
    howToTest: "RTP=RTP(線)+RTP(路) 並修正重疊；動態路數用蒙地卡羅建模擴增事件；回報路數分佈、尾端百分位、各計分貢獻%。",
    examples: "base 計線、免費局計路的遊戲；Sheeple 自我擴增合併引擎", prevalence: "niche",
  },

  // ───────────────────────── 玩法模式 Game Modes ─────────────────────────
  {
    key: "freeSpins", axis: "mode", nameEN: "Free Spins (incl. retrigger)", nameZH: "免費旋轉（免費遊戲，含重新觸發）",
    aka: "free games, bonus spins, scatter bonus, retrigger",
    definition: "通常由散佈觸發、不另押注的一段旋轉，幾乎必帶強化數值（持續/漸增倍數、黏性/額外 wild、擴張盤面、retrigger）。現代高波動遊戲多數 RTP 由此扛。retrigger 併為其子屬性（延長狀態局數、非每局盤面修飾）。",
    mathLevers: "觸發機率 P(N+散佈)/局、免費局數+retrigger 機率與每次加局數+總局數上限、feature reel set/權重、in-bonus 倍數曲線與是否持續。Feature RTP=觸發率×期望 feature 贏分。降觸發率、抬每次 EV → 守住 RTP 但拉高波動。",
    volatility: "首要波動槓桿：更稀觸發+更大 feature EV=更高波動。持續/不重置倍數+retrigger 造成長上尾與廣告最大贏。",
    howToTest: "算觸發率與平均觸發前局數(1/p)；量 in-bonus retrigger 機率、模擬含 retrigger 的局數分佈；隔離 feature RTP 貢獻%（現代常 30–70%）；蒙地卡羅求贏分百分位、最大贏可達性。",
    examples: "Gates of Olympus / Sweet Bonanza 免費局；Book of Dead retrigger；近乎通用", prevalence: "core", implemented: true,
  },
  {
    key: "selectableFreeSpins", axis: "mode", nameEN: "Player-Selectable Free-Spin Variant", nameZH: "免費遊戲類型選擇（高低波動選擇）",
    aka: "feature select, choose your bonus, volatility choice",
    definition: "進 bonus 時玩家在多種免費局配置間選擇，以局數換倍數/波動（如 10 局高倍 vs 20 局低倍）。是狀態機分支、各有自己的 RTP/波動（分別認證），與「轉盤隨機選」不同。",
    mathLevers: "各選項（局數、起始倍數、reel set）調到（接近）同 RTP 但不同 SD；選單內容與各自 EV/波動；是否提供較差 EV 的「趣味」選項。各分支分別認證。",
    volatility: "重點是讓玩家在近乎同 RTP 下自選波動帶；高倍少局=高波動，多局低倍=較低波動。實際 session 波動由玩家掌控。",
    howToTest: "每個可選項當獨立 RTP 狀態認證；回報各選項 RTP 與 SD 的分佈；驗證選項是否（刻意）RTP 接近相等或記錄差距；各分支蒙地卡羅。",
    examples: "多數 Pragmatic/Hacksaw「choose your free spins」；White Rabbit 式局數/倍數取捨", prevalence: "common",
  },
  {
    key: "holdAndSpin", axis: "mode", nameEN: "Hold & Spin / Lock & Respin", nameZH: "鎖定重轉/金幣收集（Hold & Spin）",
    aka: "hold & win, lock & respin, link & win, Lightning Link",
    definition: "落足夠金幣/現金符號觸發；該些符號鎖定、給少量重抽（常 3），每落新符號就鎖定並把計數重置為 3；重抽用盡或填滿結束。贏分=鎖定面額總和(+Mini/Minor/Major/Grand)，填滿常給 Grand。in-state 以加總面額計分（暫時的面額 pay，交叉引用 coinValuePay）。",
    mathLevers: "觸發機率、面額分佈、每次重抽落新符號機率（驅動鏈長/填滿）、盤面大小、頭獎面額/權重+填滿給獎。重置為 3 使鏈長對落地機率極敏感。",
    volatility: "中至高；很多小完成、罕見填滿/Grand 撐起重右尾。由金幣面額而非賠付表驅動。",
    howToTest: "模擬重置重抽鏈；回報填滿（最大贏）機率、各 tier 命中率、鏈長分佈、feature 貢獻%、RTP（常 94–97%）。",
    examples: "Big Bass Hold & Spinner（Pragmatic）；Lightning/Dragon Link（Aristocrat）", prevalence: "core", implemented: true,
  },
  {
    key: "pickGame", axis: "mode", nameEN: "Pick / Bonus-Pick Game", nameZH: "挑選獎勵遊戲（Pick Game）",
    aka: "pick'em, pick-me, second-screen bonus",
    definition: "互動式第二畫面：玩家選隱藏物揭示現金/倍數/加選/終止符。選擇是假象 — 結果由加權獎池/預生成 RNG 序列決定，與點哪個無關。",
    mathLevers: "獎值表、獎權重、終止符數/權重（控制每回合期望選次與長度）、是否有倍數/升級物、觸發機率。EV=Σ(獎×機率)×觸發率。早終止符多=低 EV 低波動。",
    volatility: "通常低至中（頻繁的保底感中獎），是穩定器；可用罕見肥尾頭獎物拉高。",
    howToTest: "建模為帶停止機率的加權抽；算期望選次與 feature EV；蒙地卡羅求結果波動與貢獻%；驗證玩家路徑選擇 EV 中性。",
    examples: "Monopoly bonus；經典 IGT/WMS/Playtech 開寶箱；Goonies 分支", prevalence: "common",
  },
  {
    key: "wheel", axis: "mode", nameEN: "Wheel Bonus", nameZH: "輪盤獎勵（Bonus Wheel）",
    aka: "bonus wheel, prize/money wheel, mode-select wheel",
    definition: "轉動加權扇區輪盤，給倍數/現金/頭獎 tier/免費局數/再轉，或隨機選進哪個 feature/免費局變體。與「玩家自選」不同（這裡按權重抽）。常為漸進頭獎入口。",
    mathLevers: "扇區值表、扇區權重（視覺大小是裝飾、真實機率是內部權重）、輪盤層數/升級路徑、頭獎或再轉扇區、觸發機率。EV=Σ(值×權重)×觸發率。",
    volatility: "依扇區分佈低至高；極小權重的 Grand/頭獎扇區加重尾。",
    howToTest: "由扇區權重算輪盤 EV；蒙地卡羅扇區命中分佈與貢獻%；驗證罕見頂扇區權重對應廣告最大贏行為。",
    examples: "Divine Fortune 頭獎輪；Jackpot King「Wheel King」（Blueprint）", prevalence: "common",
  },
  {
    key: "bonusBuy", axis: "mode", nameEN: "Bonus Buy / Feature Buy", nameZH: "購買獎勵/購買免費遊戲（Bonus Buy）",
    aka: "buy feature, buy bonus, feature drop, Nolimit Bonus",
    definition: "付固定倍數押注（常 50x–300x，至 1000x+ 分層）直接進某 feature、跳過 base。買來的 bonus 與自然觸發數學等價；分層/Super 買保證起始條件。與「買輪盤/買選」（買一個分佈）不同。英國禁。",
    mathLevers: "買價(×押注) 與其買到的 feature EV：價≈E[feature 賠付]/目標買 RTP。買 RTP 對齊自然觸發頻率、通常略高於 base RTP 以補償放棄的 base 回報。各當獨立狀態建模。",
    volatility: "實際波動極高 — 每次購買全有或全無；移除低波動 base 磨耗 → 每回合都是高波動 feature 結果。買價層越高波動越高。",
    howToTest: "各買價層各自認證 RTP；確認買 RTP=bonus EV/買價；回報各層買模式 SD、最大贏/封頂命中機率。",
    examples: "Pragmatic Buy Free Spins(~100x)；Hacksaw/Nolimit 分層買；Push Feature Drop", prevalence: "core",
  },
  {
    key: "buyWheel", axis: "mode", nameEN: "Buy Bonus Wheel / Buy-a-Pick", nameZH: "購買輪盤/購買選擇（多選購買）",
    aka: "buy a chance, buy the wheel, variable-outcome buy",
    definition: "買的不是固定 feature，而是買「一次輪盤/一次 pick」再隨機（加權）決定給哪個 feature。購買的即時結果本身是隨機變數 — 你買的是 feature 的分佈，非確定入場。EV 數學與標準 Bonus Buy 不同。",
    mathLevers: "買價 vs 結果分佈的 EV（Σ P(feature)×E[賠付]）；輪盤/pick 偏向好/壞 feature 的權重；是否可能「沒中/小」（拉高波動、降買 RTP 風險）。價≈E[分佈賠付]/目標買 RTP。",
    volatility: "比確定買更高 — 付了溢價也可能拿到最弱 feature，每次購買波動含「選 feature 抽」與「feature 自身波動」兩段。有極小權重頂 feature 時重尾。",
    howToTest: "用完整結果分佈（兩階段：抽 feature→模擬 feature）認證買狀態 RTP；回報每購買 SD、P(最差)、P(頂 feature)、封頂命中。",
    examples: "Hacksaw「buy a chance/buy bonus wheel」；Nolimit 分層 feature 選擇買", prevalence: "common",
  },
  {
    key: "anteBet", axis: "mode", nameEN: "Ante Bet / Bet+ Booster", nameZH: "前置加注/投注增強（Ante Bet）",
    aka: "ante, bet boost, double-chance, xBet",
    definition: "選擇性加注（常 +25%、至 +50% 或分層）以提升 bonus 觸發機率（常加倍散佈數/權重或重配 RNG），但不跳進 bonus。介於一般玩與全買之間。",
    mathLevers: "加注比例 vs 觸發機率提升比例。若觸發機率以同比例上升即設計成 RTP 中性；分層 xBet 各調到各自（常略不同）RTP。",
    volatility: "略降波動（feature 更常中）同時抬高每局成本。分層保證內容的 booster 前置波動。",
    howToTest: "驗證開關前後淨 RTP≈base；量觸發率提升 vs 成本；各 booster 層各自認證 RTP；回報有效 session 波動。",
    examples: "Pragmatic Ante Bet/Bet+（Sweet Bonanza、Dog House）；Nolimit Booster 分層", prevalence: "common",
  },
  {
    key: "gamble", axis: "mode", nameEN: "Gamble / Double-Up", nameZH: "賭博/翻倍（Gamble）",
    aka: "double or nothing, risk game, card-colour gamble, ladder gamble",
    definition: "中獎後選擇性把獎金押在二元（紅黑/正反）或階梯命題上翻倍，猜錯全失。",
    mathLevers: "中獎機率 vs 賠付倍數。公平 50/50 翻倍=EV 中性；業者常略低於公平（如 49.x%）薄取優勢。等價：80/20 翻倍(EV 1.6x)=50/50 3.2x。",
    volatility: "純波動放大器 — 加寬贏分分佈（更多零、更肥尾），不顯著改變平均 RTP（公平則中性、傾斜則略負）。常不計入認證 RTP。",
    howToTest: "確認 gamble EV(公平=1.0)；建模其對已實現賠付分佈百分位的影響（非平均）；驗證傾斜對應公布優勢。",
    examples: "經典 Novomatic/IGT 撲克紅黑；倍數階梯；Blueprint「collect or gamble」", prevalence: "common",
  },
  {
    key: "trailRespin", axis: "mode", nameEN: "Trail / Money-Cart Respin Mode", nameZH: "軌道/棋盤連動模式（Money Cart）",
    aka: "Money Cart, board-game bonus, persistent-modifier respin",
    definition: "重抽鎖定 bonus 狀態：蒐集的特殊符號持續存在，跨重抽走過一條倍數/收集器/持續修飾/面額符號的軌道；以加總符號面額計分（暫時面額 pay，交叉引用 coinValuePay）。是 Hold & Spin 的進階表親，扛幾乎全部上限潛力。",
    mathLevers: "觸發率、修飾符號權重、收集器/倍數互動規則、重抽重置落地機率、最大贏封頂。持續修飾跨回合複利。",
    volatility: "極高；極端右尾（六位數×最大贏）。持續性+收集器倍數互動是尾端主因。",
    howToTest: "模擬完整盤面狀態演化（路徑相依）；回報 feature RTP 占比、修飾堆疊分佈、封頂命中、p99.9 贏分。",
    examples: "Money Train 4 Money Cart（Relax, 150,000x）；Dead Riders Trail", prevalence: "niche",
  },
  {
    key: "jackpot", axis: "mode", nameEN: "Progressive / Jackpot Round", nameZH: "累積/彩金模式（Progressive Jackpot）",
    aka: "progressive jackpot, must-drop, Mega Moolah, Drops & Wins",
    definition: "疊在任何 base 上的池化或固定彩金，由每注抽成挹注、經專屬觸發贏得（收集 N 個彩金符號、湊冠冕、轉到輪盤、RNG 抽、神秘 must-hit）。獨立/連線池化/神秘式皆有。既是賠付結構覆蓋（從 base RTP 切出貢獻）也是觸發回合。",
    mathLevers: "種子/重置額；每注貢獻率（實例 0.015%–1.25%）從總 RTP 切出（降 base RTP）；觸發機率 p；各 tier 拆分；must-hit 上限。彩金 RTP≈貢獻率(+種子攤提)。平均命中前局數=1/p。",
    volatility: "極高/極端尾端（天文罕見、超大獎）。彩金 RTP 占比越大、p 越稀越起伏；公布 RTP 只在彩金生命週期實現。",
    howToTest: "GLI-11/19 框架：觸發機率、平均命中時間(1/p)、彩金 RTP 配置、種子流動性/挹注償付能力、不可變貢獻/賠付稽核、base 對彩金 RTP 拆分。",
    examples: "Mega Moolah/WowPot（Games Global）；Jackpot King；Drops & Wins", prevalence: "common", implemented: true,
  },
  {
    key: "progressionMode", axis: "mode", nameEN: "Tiered Progression / Survival / Heist", nameZH: "階段進化/生存/搶劫模式",
    aka: "level/stage system, escalation, multiplier duel, ladder mode",
    definition: "推進關卡（各關解鎖更強 wild、移除低分、抬倍數）的 bonus，或多倍數靠「偷/存活」成長的對決/生存模式，或帶崩盤/爆掉的 collect-or-climb 階梯。常注入影響實際 RTP 的玩家能動性。",
    mathLevers: "升級機率、各關 EV/倍數遞增、生命/存活機率、崩盤機率、collect-vs-climb 決策樹。到頂關大幅偏向大獎。",
    volatility: "高至極端；內嵌賭博/升級造成起伏、全有或全無、且部分取決於玩家選擇/時機。",
    howToTest: "對關卡做狀態機模擬；回報各關到達機率、各關 EV、頂關貢獻%、（能動性模式）最佳玩 vs 平均玩 RTP 差距。",
    examples: "In and Out Heist Mode（NetEnt）；Death Becomes You 倍數對決（Hacksaw）", prevalence: "niche",
  },

  // ───────────────────────── 遊戲機制 Feature Mechanics ─────────────────────────
  {
    key: "standardWild", axis: "mechanic", nameEN: "Standard Wild", nameZH: "百搭符號（WILD）",
    aka: "wild, joker, substitute",
    definition: "替代所有賠付符號（通常不含散佈/bonus）以完成組合。幾乎每款都有的基礎積木。",
    mathLevers: "各軸 wild 頻率與哪些軸帶 wild（中間軸 2–4 餵更多線/路）。每多一個 wild 抬高完成機率 — 直接好調的 RTP 旋鈕。",
    volatility: "本身中性至略穩定。base wild 多=低波動；限免費局或中間軸=集中價值、抬高波動。",
    howToTest: "掃各軸 wild 權重；回報 wild 對 RTP 貢獻%、有無 wild 的命中率差。",
    examples: "幾乎所有 video slot 的軸 2–4 標準 W", prevalence: "core", implemented: true,
  },
  {
    key: "expandingWild", axis: "mechanic", nameEN: "Expanding Wild", nameZH: "延展百搭（WILD延展）",
    aka: "expanding wild, full-reel wild, stretching wild",
    definition: "落地時長成覆蓋整軸（偶爾整列）的 wild，使該軸每格皆 wild；常給重抽、常限特定軸或免費局。",
    mathLevers: "延展 wild 權重、可落哪些軸、base 對免費局限制、卷軸上相鄰建構（鄰居+密度約束 RTP/波動）、附帶倍數/重抽/收集。",
    volatility: "中至高；一次延展可同時完成多線/路 → 罕見大獎。當 base「填充」時溫和、限免費局時偏重。",
    howToTest: "把延展軸狀態加進 PAR-sheet 組合學；P(延展)×延展後盤面 EV；全循環 vs 蒙地卡羅；掃密度/鄰居求波動。",
    examples: "Book of Dead 延展符號（Play'n GO）；Juicy Fruits 漫遊延展（Pragmatic）", prevalence: "core",
  },
  {
    key: "walkingWild", axis: "mechanic", nameEN: "Walking / Shifting / Roaming Wild", nameZH: "移動百搭（WILD移動）",
    aka: "walking wild, marching wild, shifting/sliding wild",
    definition: "停留盤面、每局移動一軸（或一列）、每步給一次重抽，直到走出盤面 — 自成重抽鏈；有時邊走邊延展整軸。",
    mathLevers: "重抽數=走過的盤寬、方向、邊走邊整軸延展、是否多個堆疊、進鏈的生成機率、每步倍數。",
    volatility: "中至高；保證重抽平滑 in-feature 波動，但 feature 本身是較稀有的高價值事件、加 session 尾端；走越長尾越肥。",
    howToTest: "由觸發機率播種，模擬定長重抽鏈；累加 wild 經過各盤面狀態的期望贏分；回報 feature RTP、觸發頻率、每 feature 分佈。",
    examples: "Wild Toro 3（ELK）；Wild Chapo（Relax）；Jack and the Beanstalk（NetEnt）", prevalence: "common",
  },
  {
    key: "stickyWild", axis: "mechanic", nameEN: "Sticky / Locked Wild", nameZH: "黏性百搭（黏性WILD）",
    aka: "sticky wild, locked/held/persistent wild",
    definition: "落地後鎖定原位數局（或整個 feature）而非消失；常每個新黏性 wild 也給一次重抽、串起回合。",
    mathLevers: "黏住時長、落地是否給重抽、後續黏性 wild 是否堆疊並再延長、base 對免費局可用性、附帶倍數。",
    volatility: "免費局內高；累積的黏性 wild 跨回合複利（相關性中獎）撐起大獎尾 — 關鍵 in-bonus RTP 驅動。",
    howToTest: "把鎖定盤面當跨旋轉演化（相關）狀態建模 — 多旋轉 Markov/顯式模擬；回報期望 feature 贏分、觸發頻率、feature RTP 切片。",
    examples: "Dead or Alive 2 黏性 wild（NetEnt）；Immortal Romance Wild Desire", prevalence: "core", implemented: true,
  },
  {
    key: "multiplierWild", axis: "mechanic", nameEN: "Multiplier Wild", nameZH: "倍數百搭（倍數WILD）",
    aka: "wild multiplier, multiplying wild, x-wild",
    definition: "既替代又對其完成的贏分套用倍數（常 2x–8x）；一個贏分中多個倍數 wild 通常相乘。",
    mathLevers: "倍數值+落地權重、堆疊規則（相加 vs 相乘）、合格軸、base 對免費局。倍數本身是加權 RNG 抽。",
    volatility: "高，尤其相乘堆疊 — 贏分感覺更稀但更大；主要上限槓桿。",
    howToTest: "贏分結算時從加權分佈抽倍數（堆疊時相乘）；算每線 E[倍數]；蒙地卡羅求 RTP、最大贏、SD；掃權重定波動帶。",
    examples: "Buffalo King Megaways 免費局倍數 wild；Wild Flower 至 8x（BTG）", prevalence: "core",
  },
  {
    key: "nudgeWild", axis: "mechanic", nameEN: "Nudging Wild (xNudge) / Reel Nudge", nameZH: "推移百搭/卷軸推移（Nudge）",
    aka: "xNudge® (Nolimit City), nudging wild, reel nudge",
    definition: "（常超大/堆疊的）wild 部分落地後「推」進完整視野；每推一格給該 wild 的倍數 +1，多個推移 wild 相乘。一般 nudge 則把軸/符號移一格以形成或擴張贏分。",
    mathLevers: "推移 wild 頻率、起始偏移分佈（典型推移數）、跨軸倍數相乘 vs 相加、倍數遞增大小。",
    volatility: "極高；複利 +1 倍數+跨軸相乘造成罕見極端尖峰 — 極端波動設計的標誌。",
    howToTest: "建模偏移分佈→推移→+1 倍數累積；跨軸相乘；蒙地卡羅求 RTP、倍數到達機率、最大贏/封頂。",
    examples: "Deadwood, Tombstone, Wanted Dead or a Wild（Nolimit City）", prevalence: "common",
  },
  {
    key: "reposition", axis: "mechanic", nameEN: "Reposition / Magnet", nameZH: "符號重定位/吸附（Magnet/Reposition）",
    aka: "magnet, gravitate, gather, pull-to-wild, slide-together",
    definition: "把符號重新定位 — 滑在一起形成相鄰、拉向 wild 或收集器、或重力填補空隙 — 以製造或擴張贏分，無 xNudge 的 +1 倍數。與一般卷軸推移不同：是盤面層的吸附/聚集。",
    mathLevers: "吸附/聚集事件觸發機率、哪些符號被吸（wild/面額）、可移多遠、是否串成 cascade 或收集、目標（wild vs 收集器）。注入盤面 EV → base 權重/賠付調低守 RTP。",
    volatility: "中；形成相鄰時抬命中，但唯有一次聚很多面額/收集器才大尖峰。尾端隨可掃進的價值量縮放。",
    howToTest: "把重定位建模為條件性盤面重寫；P(觸發)×移動後盤面 EV；蒙地卡羅求 RTP、命中率差、聚集大小分佈；餵收集器時與收集器合併建模。",
    examples: "聚集/磁吸至收集器 features；符號重力格遊戲", prevalence: "niche",
  },
  {
    key: "multiplier", axis: "mechanic", nameEN: "Multiplier (global / progressive / symbol)", nameZH: "倍數（連續累進 / 全局倍數）",
    aka: "win multiplier, progressive/increasing multiplier, multiplier trail, global multiplier",
    definition: "套在某贏分或某模式全部贏分上的純量因子（2x…1024x+）— 固定、隨機、附於符號/wild，或每次連消/中獎/旋轉爬升、且免費局內常不重置的漸進倍數。（每格黏性倍數矩陣另列 multiplierMap。）",
    mathLevers: "階梯步值+上限、進一步機率=P(再一次合格中獎/連消)、feature 內重置 vs 持續、各值權重。RTP 貢獻=E[base 贏×到達倍數]，重右偏。",
    volatility: "現代 slot 最大波動槓桿之一。倍數重分配「何時」中獎、非平均。持續 vs 重置是最大單一旋鈕；相乘/無上限→極端。",
    howToTest: "把階梯建模成倍數狀態的 Markov 鏈（轉移=P(合格事件)）；算各狀態 E[倍數]；併入鏈 EV；蒙地卡羅求 RTP、贏分分佈、最大贏尾、SD。",
    examples: "Gates of Olympus/Sweet Bonanza tumble 倍數球；Bonanza Megaways 不重置倍數", prevalence: "core",
  },
  {
    key: "multiplierMap", axis: "mechanic", nameEN: "Persistent Multiplier Map", nameZH: "位置倍數圖/固定格位倍數（倍數累積格）",
    aka: "sticky position multipliers, per-cell multiplier, multiplier matrix",
    definition: "各格累積並保留自己的倍數值（跨旋轉/連消）的「每格倍數矩陣」，與單一全局/漸進純量不同。某格倍數在贏分經過它（或充能事件）時上升，套用於未來落在該格的贏分。空間相關狀態。",
    mathLevers: "每格遞增規則+上限、哪些格可充能（全部 vs 僅中獎位）、持續範圍（本旋轉/整 feature/銀行）、贏分如何彙總所覆蓋格的倍數（相加 vs 相乘）、重置規則。地圖的空間相關性是與純量階梯的關鍵差異。",
    volatility: "高；熱區跨 feature 累積 → 落在充能格的贏分尖峰；feast/famine 由倍數累在「哪裡」決定。持續+相乘彙總把尾端推向極端。",
    howToTest: "把整個倍數矩陣當跨旋轉演化的相關狀態模擬（非單一純量 Markov）；回報每格倍數分佈、每贏分 E[覆蓋格倍數]、RTP、尾端百分位、貢獻%。",
    examples: "Reactoonz Quantum（Play'n GO）；Jammin' Jars 罐位倍數（Push）", prevalence: "common",
  },
  {
    key: "cascade", axis: "mechanic", nameEN: "Cascading / Tumbling / Avalanche", nameZH: "連續掉落/連爆（Cascade / 連爆）",
    aka: "tumble, cascade, avalanche, rolling reels, reactions, 連爆",
    definition: "任何中獎後移除中獎符號、新符號落下補位、重算、重複直到無新中獎；一注換一串中獎。是 cluster(集合連爆)/scatter(分散連爆) 的連爆引擎，也是 Megaways 與多數格遊戲核心。是盤面引擎而非獨立狀態；RTP 在此計一次、被 pay 項交叉引用。",
    mathLevers: "補位流符號權重（可不同於首落）、每連消倍數階梯+上限、倍數每旋轉重置(base) vs 跨 bonus 累積(免費局)。EV 對整條遞迴鏈計算。",
    volatility: "無倍數時中性至平滑（只靠重複中獎加命中）；有漸升/持續倍數時大幅抬波動 — 免費局的累積成長倍數造就最大、最起伏的贏分。",
    howToTest: "模擬遞迴連消到終止（無封閉解）；回報每中獎平均連消次數、鏈長分佈、倍數階梯到達、base 對免費局貢獻%、RTP、尾端百分位。",
    examples: "Gonzo's Quest Avalanche（NetEnt）；Sweet Bonanza/Sugar Rush tumble（Pragmatic）", prevalence: "core", implemented: true,
  },
  {
    key: "gridExpansion", axis: "mechanic", nameEN: "Grid / Reel Expansion", nameZH: "格位擴展/卷軸增列（擴展模式）",
    aka: "extra row, add-a-row, add-a-reel, expanding grid",
    definition: "每局/每 feature 盤面增列或增軸（如 5×3→5×4→5×5，或免費局 +1 軸），但 pay 幾何不變（仍是線或仍是相鄰路）。與 Megaways（每局隨機高度）、Infinity Reels（中獎鏈式無界增軸）、巨型符號（多格符號）不同。",
    mathLevers: "擴展觸發機率、加幾列/軸與是否 feature 內階梯/永久、結果路數/位置倍增、新位置補位權重。增加贏分機會 → base 權重/賠付調低守 RTP。",
    volatility: "中至高；大盤抬命中也抬上限，但因擴展常被 feature 把守 → 把上檔集中進 bonus、拉長 base 空轉。免費局內階梯/永久成長增肥尾端。",
    howToTest: "建模擴展後盤面形狀、在各盤面大小重跑（不變的）pay 結算；P(擴展態)×EV(該大小)；蒙地卡羅求 RTP、各大小貢獻%、路數/位置分佈、尾端。",
    examples: "Dog House Megaways 免費局加列（Pragmatic）；Bonanza 式加頂軸", prevalence: "common",
  },
  {
    key: "popWins", axis: "mechanic", nameEN: "PopWins / Reel-Splitting Growth", nameZH: "PopWins 中獎增列（分裂增列）",
    aka: "PopWins™ (AvatarUX), win-split, row-gain-on-win",
    definition: "AvatarUX 授權機制：每個中獎符號分裂成兩格、永久為該軸加列、提升活躍路數（整段序列內）。與 xWays（揭示堆疊）、xSplit（向左分裂）、Infinity Reels（加整軸）、Gigablox（巨塊）不同。由中獎驅動、在 tumble 式序列內複利。",
    mathLevers: "各軸最大高度上限、pop 規則（每個中獎符號 vs 合格符號）、popped 位置如何餵重算（延續機率）、每次 pop 後路數重算、付費旋轉間重置。中獎驅動成長使路數成路徑相依隨機變數 — 延續機率是 RTP 槓桿。",
    volatility: "高；熱序列把軸高與路數吹大、造就罕見大連 pop 贏分，平凡旋轉維持小 — 重右尾。",
    howToTest: "模擬 pop 後重算迴圈到終止（路徑相依、無封閉解）；回報路數演化、每序列 pop 數分佈、RTP、大獎尾、貢獻%。",
    examples: "AvatarUX PopWins 家族 — TikiPop, CherryPop, PopRocks", prevalence: "common",
  },
  {
    key: "symbolCollection", axis: "mechanic", nameEN: "Symbol Collection / Money Collect (meter)", nameZH: "圖式收集（累積至門檻）",
    aka: "collect feature, collection meter, charge-up collector",
    definition: "指定收集器/面額符號在計量表累積（回合內或跨旋轉持續），達門檻給賠付/免費局/倍數升級/符號轉換/頭獎 tier。與一次性收集器不同：這是隨時間填向門檻的計量表。",
    mathLevers: "收集符號落地權重、門檻大小、各門檻給獎表、計量表是否持續(銀行) vs 重置、收集倍數。RTP 從 base 賠付轉到收集給獎（base 調低守總 RTP）。",
    volatility: "中至高；把價值後置/延後到門檻事件 — 頻繁小進度但塊狀大賠；持續性抬波動、拉長空轉。",
    howToTest: "把計量表當計數/吸收態過程：P(每局 k 個收集符號)→期望達門檻局數+期望給獎；確認 base+收集 RTP=目標；蒙地卡羅求填充率分佈與收集占 RTP%。有狀態 → 模擬。",
    examples: "Goonies Cash Collect 表（Blueprint）；Jackpot King 冠冕表", prevalence: "core",
  },
  {
    key: "valueCollector", axis: "mechanic", nameEN: "Cash / Value Collector Symbol", nameZH: "金額收集符號（一次性收集器）",
    aka: "collector symbol, sweeper, money collect symbol, fisherman/banker collector",
    definition: "即時收集器符號：落地時「掃」走全盤面額符號、立刻賠其加總值 — 是每局盤面事件而非持續計量表。與門檻計量表不同；直接搭配 coinValuePay（收集器實現加總的身上面額）。",
    mathLevers: "收集器落地權重（實現機率閘）、掃時盤上面額符號數/值分佈、收集器倍數、多收集器是否複利、哪些面額符號合格被掃。已實現 RTP=P(收集器落地且盤上有值)×E[掃總×倍數]。",
    volatility: "中至高；面額符號常呆坐到收集器落地才賠 → 塊狀後置；收集器越稀、面額分佈越肥則尾越重。",
    howToTest: "兩階段模擬：(1)依權重放面額符號與收集器，(2)收集器落地時加總合格值×倍數；回報收集率、掃總分佈、RTP、貢獻%、尾端。與 coinValuePay 合併建模避免雙計。",
    examples: "Big Bass 漁夫收集（Pragmatic）；Money Cart Collector（Relax）", prevalence: "core",
  },
  {
    key: "symbolUpgrade", axis: "mechanic", nameEN: "Symbol Transformation / Upgrade", nameZH: "圖式升級/轉換",
    aka: "symbol upgrade, transforming/morphing symbols, conversion",
    definition: "指定符號在觸發下變成其他（通常更高賠或特殊）符號 — 充能/收集填滿、修飾符號轉換相鄰格、隨機事件或 bonus 條件。含「收集 N 個升級整個符號階」。",
    mathLevers: "轉換觸發機率、來源→目標值映射（升級幅度）、轉換位置數、持續性。升級注入盤面 EV → base 權重/賠付調低守 RTP；需多局充能的把價值後置。",
    volatility: "中至高；隨升級幅度與觸發稀有度縮放（充能式=較高波動）— 把贏分分佈上移而不改命中。",
    howToTest: "建模為條件盤面重寫：P(觸發)×值差(來源→目標)；分配其 RTP 切片並再平衡 base 權重；蒙地卡羅求 RTP、貢獻%、分佈位移；充能式驗證達標局數分佈。",
    examples: "Reactoonz Gargantoon（Play'n GO）；Great Game Rockies 動物→金幣（Hacksaw）", prevalence: "common",
  },
  {
    key: "symbolRemoval", axis: "mechanic", nameEN: "Symbol Removal / Destruction", nameZH: "圖式刪除/消除",
    aka: "destroy/clear/blast/wipe symbols, royal removal, DoubleMax",
    definition: "刪除指定符號（全低分、目標符號、或被 wild/炸彈清的符號），通常接著一次連消（符號落下補空）、常串更多中獎。模式內永久移除中低分/royal 會豐富剩餘池；被移數可餵計量表。",
    mathLevers: "移除哪些符號+觸發機率、移除是否餵連消（重算→鏈）、是否有爬升倍數騎在連消上、被移數是否給計量表。移除低分抬高後續旋轉的條件值 — 刻意的 RTP-into-feature 槓桿。",
    volatility: "中至高；單次移除溫和，但移除餵長連消鏈（尤其帶爬升/持續倍數）造就罕見大獎 — 強波動放大。",
    howToTest: "模擬移除後跑連消迴圈到終止（路徑相依、非單局組合學）；回報 RTP、平均鏈長、大獎尾；掃可移符號+觸發權重平衡 RTP 對波動。",
    examples: "Fire in the Hole xBomb 炸除（Nolimit）；Hacksaw DoubleMax 引擎", prevalence: "common",
  },
  {
    key: "mysterySymbol", axis: "mechanic", nameEN: "Mystery / Random Reveal Symbol", nameZH: "神秘符號/隨機符號（Mystery）",
    aka: "mystery symbol, question-mark symbol, mystery stacks",
    definition: "落地後變身的占位符 — 通常全盤的神秘符號一起揭示為「同一個」隨機選中的常規符號（或 wild/散佈、或隨機倍數），製造群組/線。變體：門後揭示、鎖定 N 局、tumble 內連鎖神秘、4 高神秘堆。",
    mathLevers: "神秘落地權重、揭示機率分佈（哪個符號 — 通常偏低分以控 RTP）、是否全部揭示「相同」（相關、高影響）vs 獨立、是否可揭示倍數/wild。",
    volatility: "高 — 相同揭示使整盤相關：揭不成時更多死局、揭成時更多大獎。靠揭示偏低守 RTP，波動來自全有或全無的相關性。",
    howToTest: "兩階段模擬：(1)依權重放神秘符號，(2)從加權表抽揭示再結算。比較相同揭示 vs 獨立揭示模型；蒙地卡羅求 RTP、命中/大獎拆分；調揭示權重定 RTP、落地權重定 feast/famine 頻率。",
    examples: "Razor Shark Mystery Stacks（Push）；Lightning Link 隱藏揭示", prevalence: "common",
  },
  {
    key: "winRespin", axis: "mechanic", nameEN: "Sticky Re-Spin / Win Respin", nameZH: "中獎重轉/同步重轉（Respin）",
    aka: "respin, win-respin, freeze-and-respin, hold-the-win",
    definition: "任何中獎（或特定符號落地）凍結中獎盤面、給一或多次「非中獎軸」重抽以延長贏分 — 無 Hold & Spin 的金幣鎖定重置結構、也無走動/黏性 wild 鏈。經典 NetEnt/Novomatic 重抽。",
    mathLevers: "重抽觸發條件（任何中獎 vs 特定符號）、給幾次重抽、哪些位凍結 vs 重抽、進一步觸發是否再給、附帶倍數。P(觸發)×E[重抽盤額外贏]。",
    volatility: "低至中；通常是平滑/延長機制、加增量命中而非肥尾，除非串鏈或帶倍數。",
    howToTest: "把凍結盤重抽當條件式二次結算；P(觸發)×E[重抽贏]；蒙地卡羅求 RTP 貢獻、命中率提升、可再給時的重抽鏈長。",
    examples: "NetEnt 單符號重抽；Novomatic 重抽 feature", prevalence: "common",
  },
  {
    key: "stacked", axis: "mechanic", nameEN: "Stacked Symbols", nameZH: "堆疊符號（Stacked）",
    aka: "stacks, full stacks, stacked wilds/royals",
    definition: "符號出現在某軸連續多格（一疊），提高整軸同符號覆蓋的機會。",
    mathLevers: "堆疊高度+頻率、哪些符號堆疊（wild vs 高 vs 低）、軸位。路數遊戲中整疊使該軸路數因子倍增。",
    volatility: "中；在路數遊戲經整軸命中抬高大獎頻率 — 溫和波動提升，堆疊高分或 wild 時更銳。",
    howToTest: "在卷軸帶中表示堆疊；路數模型中把該軸符號因子×堆疊；蒙地卡羅求膨脹的大獎頻率、RTP、SD。",
    examples: "眾多 243/1024 路遊戲的整疊 wild；堆疊 royal", prevalence: "common",
  },
  {
    key: "colossal", axis: "mechanic", nameEN: "Colossal / Giant Symbols (incl. Gigablox)", nameZH: "巨型符號（Colossal，含 Gigablox）",
    aka: "colossal/giant/oversized symbols, Gigablox (Yggdrasil), block symbols",
    definition: "符號跨 2×2、3×3、4×4（feature 內至 5×5/6×6）方塊而非單格，疊在底層線或路盤上；各塊拆成單格結算，製造大量相符計數、抬高路數/位置密度。Gigablox 併入此處（不定義新贏分幾何，base 仍相鄰自左路 → 與巨型符號同類）。與 Grid Expansion（長盤面本身）不同。",
    mathLevers: "塊大小（2×2 vs 4×4 vs 6×6）、塊生成頻率、feature 塊大小遞增、哪些符號可成塊（單一高分集中效果）、卷軸鄰居建構。塊膨脹有效符號密度與路數。",
    volatility: "中至高（feature 中塊放大時高）。單一大塊填滿多位、同時完成多線/路 → 罕見大獎，同時稀釋小獎。",
    howToTest: "把塊建模為多格占用；卷軸帶中加權塊出現；結算其觸及的所有線/路；全循環 EV+蒙地卡羅求 RTP、大符號覆蓋分佈、feature 貢獻%；掃塊大小+落地權重對 RTP 與最大贏。",
    examples: "Lucky Neko Gigablox, Hades Gigablox（Yggdrasil）；3×3 巨型高分", prevalence: "common",
  },
  {
    key: "splitSymbol", axis: "mechanic", nameEN: "Splitting Symbols (xSplit)", nameZH: "分裂符號（xSplit / 分裂）",
    aka: "split symbols, xSplit® (Nolimit City)",
    definition: "落地符號把其格分成兩（或多）個同符號實例，增加該符號計數與其完成的路/線 — 巨型符號的反向。Nolimit xSplit 把其「左側」所有符號分裂（倍增那些位）、常再轉 wild，與 xWays 複利。（與 PopWins 不同：後者分裂中獎符號並永久加軸高。）",
    mathLevers: "分裂機率、產生份數（×2、×3）、合格符號、計份的路數引擎（路/Megaways 中每次分裂使路數倍增）、與擴展符號互動。",
    volatility: "中至高（在路數引擎複利或疊在 xWays 上時極高）；分裂高分大幅膨脹單一贏分、可衝最大贏封頂。",
    howToTest: "路數模型中先以複本取代分裂格再計組合（路數倍增）；P(分裂)×放大組合值求 RTP；蒙地卡羅求膨脹大獎事件、最大贏/封頂、SD。",
    examples: "xWays Hoarder xSplit, Fire in the Hole xSplit（Nolimit City）", prevalence: "niche",
  },
  {
    key: "xWays", axis: "mechanic", nameEN: "Symbol-Splitting Expander (xWays)", nameZH: "分裂擴展符號（xWays）",
    aka: "xWays® (Nolimit City), mystery-stack expander, Infectious xWays",
    definition: "揭示為其軸上 2–4 個「相同」賠付符號（或 wild）的修飾型神秘符號，擴張盤面高度與活躍路數。Infectious 變體把全盤相符符號也轉成 xWays、引爆路數。騎在不變的路數 base 上（與 Gigablox 同列機制軸）。",
    mathLevers: "xWays 落地頻率、2/3/4 揭示分佈、合格被揭示符號（高分=高波動）、Infectious 連鎖規則。",
    volatility: "極端；Infectious 連鎖時路數可達數十萬、拉長尾並降低有意義的 base 命中。",
    howToTest: "建模揭示數分佈→每局重算路數；蒙地卡羅求路數分佈、RTP 收斂、最大贏可達；掃合格符號權重定波動帶。",
    examples: "San Quentin xWays, Infectious 5（Nolimit City）", prevalence: "niche",
  },
  {
    key: "xPays", axis: "mechanic", nameEN: "xPays (count-and-collect)", nameZH: "xPays 計數收集支付（Nolimit）",
    aka: "xPays®, reverse tumble, pay-then-replace, connect-and-collect",
    definition: "Nolimit 專有修飾：以符號（常前幾軸）的「計數」賠付；中獎符號錨定不動、非中獎符號落走、新符號連消補入；賠付=蒐集計數×符號值 — 連消式加總。以值讀贏分使其鄰近 coinValuePay，但作為錨定補位的修飾留在機制軸。",
    mathLevers: "符號值表、給幾次補位、計數→值曲線、中獎符號持續性（抬鏈潛力）。",
    volatility: "高；把 RTP 集中進多連消序列、降低命中至大獎頻率。",
    howToTest: "模擬錨定補位迴圈到終止；回報蒐集計數分佈、平均補位、RTP、大獎尾。",
    examples: "Monkey's Gold xPays, Karen Maneater xPays（Nolimit City）", prevalence: "niche",
  },
  {
    key: "xCluster", axis: "mechanic", nameEN: "xCluster / xLoot / xWin", nameZH: "xCluster 群組轉換（含 xLoot/xWin）",
    aka: "xCluster® (Nolimit City), xLoot, xWin, cluster-conversion",
    definition: "Nolimit xMechanics 家族成員。xCluster 把中獎群組轉成單一合併/轉換符號或 wild（群組轉換修飾）。xLoot/xWin 為 2024–25 新增的價值/給獎注入群組修飾。",
    mathLevers: "轉換的群組大小門檻、轉成什麼（wild vs 高分 vs 面額）、轉換是否播種連消或倍數、合格規則；xLoot/xWin 則看注入的值/給獎分佈。注入盤面 EV → base 調低守 RTP。",
    volatility: "中至高；把價值集中進較稀的群組事件、抬尾 — 與其他 xMechanics 連鎖時符合 Nolimit 極端波動風格。",
    howToTest: "模擬群組形成→轉換→重算/連消到終止；回報轉換頻率、轉換後贏分分佈、RTP、貢獻%、尾端；與 xWays/xBomb 疊加時建模互動。",
    examples: "Nolimit xCluster 系；Tanked（xLoot/xWin, 2024–25）", prevalence: "niche",
  },
  {
    key: "xBomb", axis: "mechanic", nameEN: "Exploding / Area-Clearing Wild (xBomb)", nameZH: "爆炸/區域清除百搭（xBomb）",
    aka: "xBomb® (Nolimit City), bomb wild, blast wild",
    definition: "引爆並移除相鄰/周圍非散佈符號（至~9 個）的 wild，觸發連消補位、每次爆炸給「持續」贏分倍數 +1。變體在連消解算前先把清除區預載複利倍數。",
    mathLevers: "xBomb 落地頻率、每爆倍數遞增、倍數重置規則（每旋轉 vs bonus 內持續）、清除區預載倍數值。",
    volatility: "高至極端；把符號移除連消與棘輪持續倍數耦合 — 25,920x–150,000x 最大贏背後的主導上限配置。",
    howToTest: "模擬爆炸→移除→連消＋持續倍數累積；回報終止時倍數分佈、RTP、最大贏/封頂機率、feature 貢獻%。",
    examples: "Fire in the Hole xBomb, Das xBoot（Nolimit City）", prevalence: "niche",
  },
  {
    key: "duelReels", axis: "mechanic", nameEN: "Full-Reel / VS Wild Reels (DuelReels)", nameZH: "整軸百搭/對決卷軸（DuelReels）",
    aka: "DuelReels™ (Hacksaw), VS symbols, expanding wild reel",
    definition: "VS 符號擴張成帶倍數的整軸 WILD；勝方倍數套用整軸，一個贏分中多個 wild 軸先「相加」倍數再套用於線/路贏分。",
    mathLevers: "VS/wild 軸頻率、倍數值分佈、跨軸相加規則（先加再乘）、最大贏封頂。",
    volatility: "極高；調到極端波動 — 多個整軸 wild 帶相加倍數造就罕見大獎。",
    howToTest: "建模 VS→整軸 wild 轉換+相加倍數；蒙地卡羅求 RTP、倍數和分佈、封頂機率。",
    examples: "Wanted Dead or a Wild DuelReels, RIP City（Hacksaw）", prevalence: "niche",
  },
  {
    key: "bothWays", axis: "mechanic", nameEN: "Both-Ways Evaluation Overlay", nameZH: "雙向支付（左右雙向）",
    aka: "win both ways, 2-way pay, 雙向連線",
    definition: "贏分同時左到右與右到左結算；同一線/路雙向讀。是疊在線或路結構上的修飾/覆蓋（非獨立贏分幾何）。NetEnt（Starburst）推廣。",
    mathLevers: "大致使結算中獎事件加倍 → 從反方向注入 RTP，須以降賠付/減高分頻率/縮短最大組合長補回。槓桿=方向加倍＋補償性賠付/權重調整。",
    volatility: "同 RTP 下傾向降波動/抬命中（更頻繁小獎）。常用於低波動高命中遊戲。",
    howToTest: "在底層線/路上啟用雙向結算枚舉/模擬；確認賠付補償後 RTP；與單向基準比命中率與 SD 驗證平滑。",
    examples: "Starburst（雙向+10 線, NetEnt）；Twin Spin", prevalence: "common",
  },
  {
    key: "triggerScatter", axis: "mechanic", nameEN: "Trigger Scatter Symbol (mode-gate)", nameZH: "觸發分散符號（Scatter 觸發）",
    aka: "scatter, bonus symbol, trigger scatter",
    definition: "不論位置都計分且/或觸發 feature 的符號；落足夠數量（如 3–6）啟動免費局、Hold & Spin 或其他模式。與 scatter-PAYS（贏分結構）不同。雖是符號，功能是「把守玩法模式軸」— 是 base 對 feature RTP 拆分與 feature 命中頻率的最大單一驅動。",
    mathLevers: "各軸散佈頻率與所需數量決定 feature 觸發率 — 高 RTP 模式多常被達到、進而 base 對 feature RTP 拆分的最大驅動。權重微調即大幅擺動觸發機率（多軸巧合）。",
    volatility: "間接但主級：散佈越稀=feature 越稀=波動越高。是 feature 命中頻率主旋鈕。",
    howToTest: "由卷軸權重算 P(N+散佈)/局；平均觸發前局數=1/p；驗證其產生的 base/feature RTP 拆分；對目標觸發率壓測散佈權重。",
    examples: "「4+散佈→免費局」；「3–6 攪拌器散佈→Hold & Spin」", prevalence: "core", implemented: true,
  },
];

/** 依軸取出條目。 */
export const byAxis = (a: Axis): TaxonomyEntry[] => TAXONOMY.filter((e) => e.axis === a);
/** 用 key 取單一條目（給 GameDefinition.payMechanic / FeatureDef.taxonomyKey / mechanics[] 解析顯示）。 */
export const taxonomyEntry = (key: string): TaxonomyEntry | undefined => TAXONOMY.find((e) => e.key === key);
/** 軸的中繼資料。 */
export const axisInfo = (a: Axis): AxisInfo => AXES.find((x) => x.id === a)!;
