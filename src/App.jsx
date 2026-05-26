// ═══════════════════════════════════════════════════════════════
//  ソクラテス — 思想座標診断
//  Vite + React + recharts のみ
//  単一ファイル完全実装（importエラー根絶）
// ═══════════════════════════════════════════════════════════════
import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis,
  Radar, ResponsiveContainer,
} from "recharts";

// ───────────────────────────────────────────────────────────────
//  DATA — 質問（12問）
//  スコア軸: existence / essence / nihilism / transcend /
//            rationalism / empiricism / individual / collective /
//            pessimism / optimism / absurdism / idealism /
//            materialism / skepticism
// ───────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: "q01",
    text: "人は生まれる前から、なんらかの「役割」や「目的」を持っていると思うか？",
    sub: "本質とは何か、という問い。",
    options: [
      { label: "あると思う。存在には意味が先にある",           scores: { essence:3, transcend:2, idealism:1 } },
      { label: "ない。意味は自分で作るものだ",                 scores: { existence:3, individual:2, nihilism:1 } },
      { label: "分からないが、問い続けることに価値がある",     scores: { skepticism:2, existence:1, absurdism:1 } },
      { label: "そもそも「意味」という概念自体を疑う",         scores: { nihilism:3, skepticism:2, materialism:1 } },
    ],
  },
  {
    id: "q02",
    text: "苦しみには、意味があると思うか？",
    sub: "痛みと価値の関係について。",
    options: [
      { label: "ある。苦しみは人を成長させる",                 scores: { transcend:2, optimism:2, idealism:1 } },
      { label: "ない。苦しみはただの苦しみだ",                 scores: { nihilism:2, materialism:2, pessimism:1 } },
      { label: "意味はないが、立ち向かうことに価値がある",     scores: { absurdism:3, existence:2, individual:1 } },
      { label: "人によって違う。普遍的な答えはない",           scores: { skepticism:2, empiricism:2, existence:1 } },
    ],
  },
  {
    id: "q03",
    text: "「善悪」は人間が決めたルールか、それとも世界に先からあるものか？",
    sub: "道徳の根拠について。",
    options: [
      { label: "世界に先からある。普遍的な善悪がある",         scores: { essence:3, rationalism:2, transcend:1 } },
      { label: "人間が決めたルールだ。文化によって変わる",     scores: { skepticism:2, empiricism:2, materialism:1 } },
      { label: "権力が「善悪」を作り出している",               scores: { skepticism:3, materialism:2, individual:1 } },
      { label: "善悪の基準は、理性によって導き出せる",         scores: { rationalism:3, idealism:2, essence:1 } },
    ],
  },
  {
    id: "q04",
    text: "世界は、理性によって完全に理解できると思うか？",
    sub: "認識の限界について。",
    options: [
      { label: "原理的にはできる。未解明なだけで",             scores: { rationalism:3, optimism:2, materialism:1 } },
      { label: "できない。理性には限界がある",                 scores: { skepticism:2, pessimism:1, existence:1 } },
      { label: "理性そのものが、世界の一部を作っている",       scores: { idealism:3, rationalism:1, skepticism:1 } },
      { label: "「理解」の概念自体を問い直すべきだ",           scores: { skepticism:3, existence:1, absurdism:1 } },
    ],
  },
  {
    id: "q05",
    text: "「自由」とは何か。最も近いものを選んでほしい。",
    sub: "自由の本質について。",
    options: [
      { label: "何にも縛られないこと",                         scores: { individual:3, existence:2, nihilism:1 } },
      { label: "自分の本質に従って生きること",                 scores: { essence:2, rationalism:2, idealism:1 } },
      { label: "社会の中で他者と関わりながら実現されるもの",   scores: { collective:3, optimism:1, idealism:1 } },
      { label: "幻想だ。すべては因果に縛られている",           scores: { materialism:3, pessimism:1, skepticism:1 } },
    ],
  },
  {
    id: "q06",
    text: "神や超越的なものの存在を、どう考えるか？",
    sub: "超越と存在について。",
    options: [
      { label: "存在する。あるいは存在するかもしれない",       scores: { transcend:4, idealism:1, optimism:1 } },
      { label: "存在しない。人間が作った概念だ",               scores: { materialism:3, nihilism:1, skepticism:1 } },
      { label: "証明できないが、問い自体が重要だ",             scores: { skepticism:2, existence:2, absurdism:1 } },
      { label: "問いを立てること自体が誤りだと思う",           scores: { skepticism:3, materialism:1, empiricism:2 } },
    ],
  },
  {
    id: "q07",
    text: "個人と社会、どちらが優先されるべきか？",
    sub: "政治哲学の根本について。",
    options: [
      { label: "個人の自由が最大限尊重されるべきだ",           scores: { individual:4, existence:1, skepticism:1 } },
      { label: "社会全体の幸福が優先される",                   scores: { collective:3, optimism:1, rationalism:1 } },
      { label: "どちらも一方的に優先はできない",               scores: { skepticism:2, empiricism:2, absurdism:1 } },
      { label: "「個人」と「社会」の二項対立が間違っている",   scores: { skepticism:3, idealism:1, existence:1 } },
    ],
  },
  {
    id: "q08",
    text: "「不条理」——意味のない世界に生きることへの態度は？",
    sub: "カミュ的な問い。",
    options: [
      { label: "それでも反抗し、生きることを選ぶ",             scores: { absurdism:4, existence:2, individual:1 } },
      { label: "意味を自分で作り出す",                         scores: { existence:3, individual:2, optimism:1 } },
      { label: "不条理を直視しながら、静かに受け入れる",       scores: { pessimism:2, nihilism:2, absurdism:2 } },
      { label: "世界には隠れた秩序があり、不条理は見かけ上のものだ", scores: { transcend:2, rationalism:2, idealism:1 } },
    ],
  },
  {
    id: "q09",
    text: "歴史は「進歩」しているか？",
    sub: "時間と人類について。",
    options: [
      { label: "している。人類は成熟しつつある",               scores: { optimism:3, rationalism:2, collective:1 } },
      { label: "していない。繰り返しているだけだ",             scores: { pessimism:3, nihilism:1, skepticism:1 } },
      { label: "「進歩」という概念自体が西洋的偏見だ",         scores: { skepticism:3, materialism:1, empiricism:1 } },
      { label: "方向はあるが、一直線ではない",                 scores: { empiricism:2, skepticism:1, idealism:1 } },
    ],
  },
  {
    id: "q10",
    text: "言語は、思考を「表現」するものか、それとも「構成」するものか？",
    sub: "言語と認識の関係について。",
    options: [
      { label: "表現するもの。思考は言語なしでも存在する",     scores: { idealism:2, rationalism:2, essence:1 } },
      { label: "構成するもの。言語なしに思考はない",           scores: { skepticism:2, materialism:2, empiricism:1 } },
      { label: "どちらでもある。相互に影響し合う",             scores: { empiricism:2, skepticism:1, existence:1 } },
      { label: "言語の限界が、世界の限界だ",                   scores: { skepticism:3, idealism:1, pessimism:1 } },
    ],
  },
  {
    id: "q11",
    text: "「死」について、最も近い感覚は？",
    sub: "有限性との関係について。",
    options: [
      { label: "死があるから、今が輝く",                       scores: { existence:3, absurdism:1, individual:1 } },
      { label: "死は恐ろしい。できれば考えたくない",           scores: { empiricism:2, optimism:1, materialism:1 } },
      { label: "死は解放だ。存在の苦しみから逃れられる",       scores: { pessimism:3, nihilism:2, transcend:1 } },
      { label: "死後も何かが続くと思いたい",                   scores: { transcend:3, idealism:2, optimism:1 } },
    ],
  },
  {
    id: "q12",
    text: "「真実」は一つか、複数あるか？",
    sub: "真理の本質について。",
    options: [
      { label: "一つある。人間がまだ到達していないだけ",       scores: { rationalism:3, essence:2, optimism:1 } },
      { label: "複数ある。立場によって異なる",                 scores: { skepticism:2, empiricism:2, existence:1 } },
      { label: "「真実」は言語ゲームの中でしか意味を持たない", scores: { skepticism:3, materialism:1, empiricism:1 } },
      { label: "真実を追い求めること自体に意味がある",         scores: { idealism:2, existence:2, absurdism:1 } },
    ],
  },
];

// ───────────────────────────────────────────────────────────────
//  DATA — 哲学者（12人）
// ───────────────────────────────────────────────────────────────
const PHILOSOPHERS = [
  {
    id: "nietzsche", name: "フリードリヒ・ニーチェ",
    nameEn: "Friedrich Nietzsche", period: "1844–1900", origin: "プロイセン",
    label: "力への意志",
    description: "ニヒリズムを乗り越えようとした思想家。道徳の「系譜」を問い、キリスト教的価値体系を解体し、力への意志と永劫回帰を提唱した。",
    scores: { existence:4, essence:-2, nihilism:3, transcend:-3, rationalism:-1, empiricism:2, individual:5, collective:-3, pessimism:2, optimism:1, absurdism:2, idealism:-1, materialism:1, skepticism:3 },
    lineage: ["schopenhauer"], influenced: ["heidegger","foucault","sartre","camus"],
    beginnerBook: { title: "ニーチェ入門", author: "西尾幹二" },
    mainWork: { title: "ツァラトゥストラはこう語った" },
    quote: "汝の意志が「これが人生であったのか、さあもう一度」と言えるように生きよ。",
    color: "#b8962e",
    tags: ["実存","ニヒリズム克服","永劫回帰","価値の転換"],
  },
  {
    id: "camus", name: "アルベール・カミュ",
    nameEn: "Albert Camus", period: "1913–1960", origin: "フランス領アルジェリア",
    label: "不条理への反抗",
    description: "実存主義と距離を置きながら「不条理の哲学」を構築。意味のない世界に対して自殺でも逃避でもなく「反抗」を選ぶことを説いた。",
    scores: { existence:4, essence:-2, nihilism:2, transcend:-2, rationalism:0, empiricism:3, individual:3, collective:1, pessimism:2, optimism:1, absurdism:5, idealism:-1, materialism:2, skepticism:2 },
    lineage: ["nietzsche","kierkegaard"], influenced: [],
    beginnerBook: { title: "シーシュポスの神話（入門）", author: "清水正晴" },
    mainWork: { title: "シーシュポスの神話" },
    quote: "真に重大な哲学の問題はただ一つしかない。それは自殺だ。",
    color: "#7a9a6a",
    tags: ["不条理","反抗","地中海","実存"],
  },
  {
    id: "sartre", name: "ジャン＝ポール・サルトル",
    nameEn: "Jean-Paul Sartre", period: "1905–1980", origin: "フランス",
    label: "実存は本質に先立つ",
    description: "実存主義の旗手。「実存は本質に先立つ」という命題で、人間が先に存在し後から自らの本質を作ると主張した。",
    scores: { existence:5, essence:-3, nihilism:1, transcend:-4, rationalism:2, empiricism:1, individual:4, collective:2, pessimism:1, optimism:1, absurdism:2, idealism:2, materialism:1, skepticism:1 },
    lineage: ["heidegger","husserl"], influenced: [],
    beginnerBook: { title: "実存主義とは何か", author: "サルトル（伊吹武彦訳）" },
    mainWork: { title: "存在と無" },
    quote: "他者は地獄だ。",
    color: "#7878b8",
    tags: ["実存主義","自由と責任","アンガージュマン"],
  },
  {
    id: "heidegger", name: "マルティン・ハイデガー",
    nameEn: "Martin Heidegger", period: "1889–1976", origin: "ドイツ",
    label: "存在と時間",
    description: "存在の問いを哲学の中心に置いた。「現存在」「被投性」「死への存在」といった概念を通じ、人間の有限的存在を解析した。",
    scores: { existence:5, essence:1, nihilism:1, transcend:1, rationalism:-1, empiricism:-1, individual:3, collective:-1, pessimism:2, optimism:-1, absurdism:1, idealism:2, materialism:-2, skepticism:2 },
    lineage: ["nietzsche","husserl"], influenced: ["sartre","foucault"],
    beginnerBook: { title: "ハイデガー入門", author: "細川亮一" },
    mainWork: { title: "存在と時間" },
    quote: "現存在は、自己の存在においてこの存在そのものが問題となっている存在者である。",
    color: "#6898a8",
    tags: ["存在論","現存在","死への存在","技術批判"],
  },
  {
    id: "kierkegaard", name: "ソーレン・キェルケゴール",
    nameEn: "Søren Kierkegaard", period: "1813–1855", origin: "デンマーク",
    label: "単独者の実存",
    description: "実存主義の源流とされる宗教哲学者。美的・倫理的・宗教的の三段階を通じ「単独者」として神の前に立つことを説いた。",
    scores: { existence:5, essence:1, nihilism:-1, transcend:4, rationalism:-2, empiricism:0, individual:5, collective:-3, pessimism:2, optimism:-1, absurdism:2, idealism:3, materialism:-3, skepticism:2 },
    lineage: ["kant"], influenced: ["nietzsche","heidegger","sartre","camus"],
    beginnerBook: { title: "キェルケゴール入門", author: "鈴木祐丞" },
    mainWork: { title: "あれか、これか" },
    quote: "不安とは自由のめまいである。",
    color: "#a898c8",
    tags: ["実存主義源流","単独者","不安","信仰の飛躍"],
  },
  {
    id: "foucault", name: "ミシェル・フーコー",
    nameEn: "Michel Foucault", period: "1926–1984", origin: "フランス",
    label: "権力と知",
    description: "知と権力の関係、狂気・監視・性の歴史を分析した。真理が権力によって産出されるという視点から、近代の自明性を問い直した。",
    scores: { existence:2, essence:-3, nihilism:2, transcend:-3, rationalism:-2, empiricism:3, individual:2, collective:-1, pessimism:2, optimism:-1, absurdism:2, idealism:-2, materialism:3, skepticism:5 },
    lineage: ["nietzsche","heidegger"], influenced: [],
    beginnerBook: { title: "フーコー入門", author: "中山元" },
    mainWork: { title: "監獄の誕生" },
    quote: "権力は禁止するのではなく、産出する。",
    color: "#88a878",
    tags: ["権力論","系譜学","知の考古学","生政治"],
  },
  {
    id: "kant", name: "イマヌエル・カント",
    nameEn: "Immanuel Kant", period: "1724–1804", origin: "プロイセン",
    label: "理性の批判",
    description: "「コペルニクス的転回」を哲学にもたらした巨人。経験論と合理論を総合し、認識の限界と道徳法則を体系化した。",
    scores: { existence:-1, essence:3, nihilism:-2, transcend:2, rationalism:5, empiricism:2, individual:3, collective:2, pessimism:-1, optimism:2, absurdism:-2, idealism:4, materialism:-2, skepticism:2 },
    lineage: ["hume","leibniz"], influenced: ["hegel","schopenhauer","kierkegaard"],
    beginnerBook: { title: "カント入門", author: "石川文康" },
    mainWork: { title: "純粋理性批判" },
    quote: "頭上の星空と、内なる道徳律——この二つが私を畏敬で満たす。",
    color: "#c8b860",
    tags: ["批判哲学","義務論","認識論","定言命法"],
  },
  {
    id: "wittgenstein", name: "L. ウィトゲンシュタイン",
    nameEn: "Ludwig Wittgenstein", period: "1889–1951", origin: "オーストリア",
    label: "言語ゲームの境界",
    description: "哲学の問題を「言語の誤用」から生じると捉え、言語の限界を明確化しようとした。前期は論理実証主義的、後期は「言語ゲーム」論へ転換。",
    scores: { existence:1, essence:-1, nihilism:2, transcend:-1, rationalism:3, empiricism:4, individual:1, collective:0, pessimism:1, optimism:0, absurdism:2, idealism:-1, materialism:2, skepticism:5 },
    lineage: ["frege","russell"], influenced: [],
    beginnerBook: { title: "ウィトゲンシュタイン入門", author: "永井均" },
    mainWork: { title: "論理哲学論考" },
    quote: "語りえないことについては、沈黙しなければならない。",
    color: "#8898a8",
    tags: ["言語哲学","分析哲学","言語ゲーム","沈黙"],
  },
  {
    id: "schopenhauer", name: "A. ショーペンハウアー",
    nameEn: "Arthur Schopenhauer", period: "1788–1860", origin: "プロイセン",
    label: "意志と苦悩",
    description: "「世界は意志と表象である」と説き、存在の根底に盲目的な「意志」を見出した。仏教との親和性を持ち、意志の否定による救済を説いた。",
    scores: { existence:2, essence:1, nihilism:3, transcend:2, rationalism:1, empiricism:2, individual:1, collective:-2, pessimism:5, optimism:-4, absurdism:1, idealism:3, materialism:-1, skepticism:2 },
    lineage: ["kant","plato"], influenced: ["nietzsche","freud","wittgenstein"],
    beginnerBook: { title: "意志と表象としての世界（入門）", author: "西尾幹二" },
    mainWork: { title: "意志と表象としての世界" },
    quote: "人生は苦しみに満ちており、その根底には盲目の意志がある。",
    color: "#a08878",
    tags: ["悲観主義","意志論","東洋哲学との融合","芸術と救済"],
  },
  {
    id: "cioran", name: "エミール・シオラン",
    nameEn: "Emil Cioran", period: "1911–1995", origin: "ルーマニア",
    label: "存在の苦い観察",
    description: "断章形式でニヒリズム・悲観主義・虚無を語ったルーマニア出身の思想家。存在への根源的な懐疑を示した。",
    scores: { existence:3, essence:-2, nihilism:5, transcend:-1, rationalism:-2, empiricism:2, individual:4, collective:-4, pessimism:5, optimism:-5, absurdism:3, idealism:-1, materialism:2, skepticism:3 },
    lineage: ["nietzsche","schopenhauer"], influenced: [],
    beginnerBook: { title: "絶望のきわみで", author: "シオラン（金井裕訳）" },
    mainWork: { title: "生誕の災厄" },
    quote: "存在するということは、ただの見かけの勝利に過ぎない。",
    color: "#888888",
    tags: ["ニヒリズム","悲観主義","断章形式","存在への懐疑"],
  },
  {
    id: "spinoza", name: "バールーフ・スピノザ",
    nameEn: "Baruch Spinoza", period: "1632–1677", origin: "オランダ",
    label: "神すなわち自然",
    description: "「神すなわち自然（Deus sive Natura）」を唱えた汎神論の哲学者。デカルトの二元論を批判し、一元論的な宇宙観を幾何学的方法で体系化した。",
    scores: { existence:-1, essence:3, nihilism:-2, transcend:3, rationalism:5, empiricism:1, individual:0, collective:2, pessimism:-2, optimism:3, absurdism:-2, idealism:3, materialism:2, skepticism:0 },
    lineage: ["descartes","leibniz"], influenced: ["hegel","nietzsche"],
    beginnerBook: { title: "スピノザ入門", author: "吉田量彦" },
    mainWork: { title: "エチカ" },
    quote: "恐れから生まれる希望は存在しない。希望から生まれる恐れもまた存在しない。",
    color: "#78a8b8",
    tags: ["汎神論","一元論","感情論","幾何学的方法"],
  },
  {
    id: "hegel", name: "G.W.F. ヘーゲル",
    nameEn: "Georg Wilhelm Friedrich Hegel", period: "1770–1831", origin: "ドイツ",
    label: "弁証法的精神",
    description: "絶対精神と弁証法（正・反・合）で歴史と存在を体系化した。カントを超え、マルクス・ハイデガー・サルトルに深く影響した。",
    scores: { existence:-1, essence:4, nihilism:-2, transcend:3, rationalism:5, empiricism:-1, individual:-1, collective:4, pessimism:-2, optimism:4, absurdism:-3, idealism:5, materialism:-3, skepticism:-1 },
    lineage: ["kant","fichte"], influenced: ["marx","kierkegaard","nietzsche","heidegger"],
    beginnerBook: { title: "ヘーゲル入門", author: "加藤尚武" },
    mainWork: { title: "精神現象学" },
    quote: "ミネルヴァのフクロウは、夕暮れが迫る時に初めて飛び立つ。",
    color: "#b8a858",
    tags: ["弁証法","絶対精神","歴史哲学","観念論"],
  },
];

// ───────────────────────────────────────────────────────────────
//  DIAGNOSIS LOGIC
// ───────────────────────────────────────────────────────────────
const AXES = [
  "existence","essence","nihilism","transcend","rationalism","empiricism",
  "individual","collective","pessimism","optimism","absurdism","idealism",
  "materialism","skepticism",
];

function sumScores(answers) {
  const t = Object.fromEntries(AXES.map(k => [k, 0]));
  (answers || []).forEach(a => {
    Object.entries(a.scores || {}).forEach(([k, v]) => {
      if (k in t) t[k] += v;
    });
  });
  return t;
}

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  AXES.forEach(k => {
    const av = a[k] || 0, bv = b[k] || 0;
    dot += av * bv; na += av * av; nb += bv * bv;
  });
  if (!na || !nb) return 0;
  return ((dot / (Math.sqrt(na) * Math.sqrt(nb))) + 1) / 2;
}

function matchPhilosophers(s) {
  return [...PHILOSOPHERS]
    .map(p => ({ ...p, pct: Math.round(cosineSim(s, p.scores) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);
}

function resolveType(s) {
  const hi = (k, t) => (s[k] || 0) >= t;
  if (hi("nihilism",4) && hi("pessimism",3))
    return { name:"虚無の観測者", code:"VOID", axis:"虚無 × 悲観", color:"#999",
      desc:"世界の意味の不在を直視しながら、それでも問い続ける姿勢がある。ニーチェやシオランの系譜に近い。",
      quote:"深淵を覗くとき、深淵もまたこちらを覗いている。" };
  if (hi("absurdism",3) && hi("existence",3))
    return { name:"不条理の反逆者", code:"ABSR", axis:"不条理 × 実存", color:"#7a9a6a",
      desc:"意味のない世界に対して、それでも反抗することを選ぶ。カミュ的な不条理の哲学と共鳴する。",
      quote:"シーシュポスは幸福だったと想像しなければならない。" };
  if (hi("existence",4) && hi("individual",3) && !hi("transcend",2))
    return { name:"実存の探求者", code:"EXIS", axis:"実存 × 個人", color:"#7878b8",
      desc:"本質より実存を優先し、自由と責任の中で意味を構築しようとする。サルトル・キェルケゴールの流れ。",
      quote:"実存は本質に先立つ。" };
  if (hi("rationalism",4) && hi("idealism",3))
    return { name:"理性の体系家", code:"RATS", axis:"理性 × 観念論", color:"#b8a858",
      desc:"理性によって世界を把握しようとする傾向が強い。カント・ヘーゲルの系譜に近い。",
      quote:"現実的なものはすべて合理的である。" };
  if (hi("skepticism",4) && hi("empiricism",3))
    return { name:"懐疑の解剖者", code:"SKEP", axis:"懐疑 × 経験論", color:"#8898a8",
      desc:"あらゆる前提を疑い、言語と概念の限界を分析する傾向がある。ウィトゲンシュタイン・フーコーの系譜。",
      quote:"語りえないことについては、沈黙しなければならない。" };
  if (hi("transcend",3) && hi("idealism",2))
    return { name:"超越の探求者", code:"TRNS", axis:"超越 × 理念", color:"#a898c8",
      desc:"世界を超える何かを志向し、形而上学的な問いに引き寄せられる。スピノザ・カントの系譜。",
      quote:"頭上の星空と、内なる道徳律——この二つが私を畏敬で満たす。" };
  if (hi("pessimism",3))
    return { name:"悲観の証人", code:"PESS", axis:"悲観 × 意志", color:"#a08878",
      desc:"世界の苦悩と有限性を深く見つめる。ショーペンハウアー的な意志の哲学と共鳴する。",
      quote:"人生は苦しみであり、歴史は意志の盲目的な展開である。" };
  if (hi("collective",3) && hi("optimism",2))
    return { name:"共同体の設計者", code:"COMM", axis:"集合 × 楽観", color:"#88a878",
      desc:"社会と個人の調和に関心を持ち、歴史の進歩を信じる傾向がある。ヘーゲル・マルクスの系譜。",
      quote:"哲学者たちは世界をただ解釈してきた。重要なのはそれを変えることだ。" };
  return { name:"境界の哲学者", code:"BORD", axis:"複合的", color:"#a0a0a0",
    desc:"複数の思想潮流が交差する位置にある。どの系譜にも完全には収まらない複雑な思想座標を持つ。",
    quote:"問い続けることが、哲学の本質だ。" };
}

const RADAR_KEYS = ["existence","rationalism","nihilism","individual","skepticism","transcend"];
const RADAR_JP = { existence:"実存", rationalism:"理性", nihilism:"虚無", individual:"個人", skepticism:"懐疑", transcend:"超越" };
function toRadar(s) {
  return RADAR_KEYS.map(k => ({ axis: RADAR_JP[k] || k, value: Math.max(0, Math.min(10, (s[k]||0)+5)) }));
}

// ───────────────────────────────────────────────────────────────
//  CSS
// ───────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@300;400;700&family=Noto+Serif+JP:wght@200;300;400&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{background:#09090a;color:#e8d5b0;font-family:'Noto Serif JP',serif;min-height:100vh;}
::selection{background:rgba(184,150,46,.25);}
::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:rgba(184,150,46,.2);}

:root{
  --bg:#09090a;--surface:rgba(255,255,255,.022);
  --gold:#b8962e;--gold2:#d4b04a;--parchment:#e8d5b0;
  --muted:rgba(232,213,176,.48);--dim:rgba(232,213,176,.26);
  --border:rgba(184,150,46,.18);--border2:rgba(255,255,255,.06);
  --mono:'JetBrains Mono',monospace;
  --serif:'Libre Baskerville','Noto Serif JP',Georgia,serif;
  --jp:'Noto Serif JP',serif;
}

@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes fadeDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
@keyframes flicker{0%,97%,100%{opacity:1}98%{opacity:.92}99%{opacity:1}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes scan{0%{opacity:.3}50%{opacity:.7}100%{opacity:.3}}

.page{min-height:100vh;display:flex;flex-direction:column;align-items:center;position:relative;overflow-x:hidden;}
.bg-grid{position:fixed;inset:0;z-index:0;pointer-events:none;
  background-image:linear-gradient(rgba(184,150,46,.03) 1px,transparent 1px),
  linear-gradient(90deg,rgba(184,150,46,.03) 1px,transparent 1px);background-size:56px 56px;}
.noise{position:fixed;inset:0;z-index:1;pointer-events:none;opacity:.018;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size:200px;}
.scanlines{position:fixed;inset:0;z-index:1;pointer-events:none;
  background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.04) 3px,rgba(0,0,0,.04) 4px);}
.content{position:relative;z-index:10;width:100%;max-width:680px;padding:0 26px;}
.flicker{animation:flicker 10s ease-in-out infinite;}

.site-header{width:100%;max-width:680px;padding:48px 26px 0;position:relative;z-index:10;}
.logo{font-family:var(--serif);font-size:clamp(24px,4vw,34px);color:var(--gold);font-style:italic;letter-spacing:.06em;}
.logo-sub{font-family:var(--mono);font-size:8px;letter-spacing:.4em;color:var(--dim);margin-top:4px;}
.divider{width:100%;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.22;margin:22px 0;}
.div-thin{width:100%;height:1px;background:var(--border2);margin:14px 0;}

/* スタート */
.hero{padding:80px 0 52px;text-align:center;}
.hero-title{font-family:var(--serif);font-size:clamp(44px,9vw,76px);color:var(--gold);font-style:italic;letter-spacing:.06em;margin-bottom:10px;animation:fadeDown 1s ease both;}
.hero-sub{font-family:var(--mono);font-size:8px;letter-spacing:.42em;color:var(--dim);margin-bottom:30px;animation:fadeDown 1s ease .1s both;}
.hero-desc{font-family:var(--jp);font-size:14px;font-weight:200;color:var(--muted);line-height:2.35;max-width:420px;margin:0 auto 38px;letter-spacing:.05em;animation:fadeUp 1s ease .2s both;}
.hero-meta{font-family:var(--mono);font-size:8px;letter-spacing:.18em;color:var(--dim);display:flex;gap:24px;justify-content:center;margin-bottom:38px;animation:fadeUp 1s ease .3s both;}
.hero-meta span::before{content:"— ";}

/* ボタン */
.btn{background:transparent;cursor:pointer;transition:all .2s ease;font-family:var(--mono);}
.btn-primary{border:1px solid var(--gold);color:var(--gold);font-size:9px;letter-spacing:.38em;padding:14px 32px;}
.btn-primary:hover{background:rgba(184,150,46,.08);}
.btn-ghost{border:1px solid var(--border2);color:var(--dim);font-size:9px;letter-spacing:.22em;padding:11px 22px;}
.btn-ghost:hover{border-color:var(--border);color:var(--muted);}

/* 質問 */
.q-wrap{padding:48px 0;animation:fadeUp .45s cubic-bezier(.16,1,.3,1) both;}
.q-prog{width:100%;height:1px;background:var(--border2);margin-bottom:5px;overflow:hidden;}
.q-fill{height:100%;background:var(--gold);opacity:.45;transition:width .4s ease;}
.q-meta{font-family:var(--mono);font-size:8px;color:var(--dim);letter-spacing:.18em;display:flex;justify-content:space-between;margin-bottom:40px;}
.q-num{font-family:var(--mono);font-size:8px;color:var(--gold);letter-spacing:.42em;opacity:.6;margin-bottom:16px;}
.q-text{font-family:var(--serif);font-size:clamp(17px,3.8vw,22px);font-style:italic;line-height:1.78;color:var(--parchment);margin-bottom:8px;}
.q-sub{font-family:var(--mono);font-size:8px;color:var(--dim);letter-spacing:.14em;margin-bottom:32px;}
.opt{display:block;width:100%;text-align:left;background:transparent;border:1px solid var(--border2);
  padding:15px 20px;cursor:pointer;font-family:var(--jp);font-size:13px;font-weight:200;
  color:var(--muted);line-height:1.7;letter-spacing:.04em;margin-bottom:9px;
  transition:all .18s ease;position:relative;}
.opt::before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;
  background:var(--gold);transform:scaleY(0);transition:transform .18s ease;transform-origin:top;}
.opt:hover{border-color:rgba(184,150,46,.3);color:var(--parchment);background:rgba(184,150,46,.035);}
.opt:hover::before{transform:scaleY(1);}

/* 解析中 */
.analyzing{padding:80px 0;text-align:center;animation:fadeIn .4s ease;}
.ana-label{font-family:var(--mono);font-size:8px;color:var(--gold);letter-spacing:.35em;margin-bottom:28px;}
.dots{display:inline-flex;gap:5px;margin-bottom:30px;}
.dot{width:5px;height:5px;background:var(--gold);border-radius:50%;animation:blink 1.2s ease-in-out infinite;}
.dot:nth-child(2){animation-delay:.22s;}.dot:nth-child(3){animation-delay:.44s;}
.step{font-family:var(--jp);font-size:12px;font-weight:200;letter-spacing:.08em;margin-bottom:7px;transition:color .4s ease;}

/* 結果 */
.result-top{padding:40px 0 16px;animation:fadeUp .6s ease both;}
.r-label{font-family:var(--mono);font-size:8px;letter-spacing:.38em;color:rgba(184,150,46,.55);margin-bottom:6px;}
.type-name{font-family:var(--serif);font-size:clamp(26px,6vw,42px);font-style:italic;margin-bottom:5px;}
.type-code{font-family:var(--mono);font-size:9px;letter-spacing:.42em;color:var(--dim);margin-bottom:18px;}
.type-desc{font-family:var(--jp);font-size:14px;font-weight:200;color:var(--muted);line-height:2.1;letter-spacing:.04em;}
.type-quote{font-family:var(--serif);font-style:italic;font-size:clamp(13px,3vw,15px);color:var(--muted);
  line-height:1.9;border-left:1px solid rgba(184,150,46,.4);padding-left:18px;}

/* 哲学者カード */
.pc{background:var(--surface);border:1px solid var(--border2);padding:18px 20px;
  margin-bottom:9px;cursor:pointer;transition:border-color .2s;animation:fadeUp .5s ease both;position:relative;}
.pc::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(184,150,46,.28),transparent);opacity:0;transition:opacity .2s;}
.pc:hover{border-color:rgba(184,150,46,.25);}
.pc:hover::before{opacity:1;}
.pc-top{display:flex;justify-content:space-between;align-items:flex-start;}
.pc-pct{font-family:var(--mono);font-size:22px;color:var(--gold);font-weight:700;letter-spacing:-.02em;}
.pc-name{font-family:var(--serif);font-size:15px;font-style:italic;color:var(--parchment);}
.pc-en{font-family:var(--mono);font-size:7px;color:var(--dim);letter-spacing:.13em;margin-top:1px;}
.pc-label{display:inline-block;font-family:var(--mono);font-size:7px;letter-spacing:.12em;border:1px solid;padding:2px 7px;margin-top:9px;}
.pc-body{animation:fadeUp .3s ease both;}
.pc-desc{font-family:var(--jp);font-size:12px;font-weight:200;color:var(--muted);line-height:1.9;margin-top:10px;letter-spacing:.04em;}
.pc-quote{font-family:var(--serif);font-style:italic;font-size:11px;color:var(--dim);margin-top:9px;line-height:1.75;}
.pc-books{margin-top:12px;padding-top:11px;border-top:1px solid var(--border2);}
.pc-blabel{font-family:var(--mono);font-size:7px;color:var(--dim);letter-spacing:.2em;margin-bottom:6px;}
.pc-book{font-family:var(--jp);font-size:12px;font-weight:300;color:var(--muted);padding:3px 0;
  display:flex;align-items:baseline;gap:8px;}
.pc-book::before{content:'—';color:var(--dim);font-family:var(--mono);font-size:9px;flex-shrink:0;}
.tag-wrap{margin-top:10px;}
.tag{display:inline-block;font-family:var(--mono);font-size:7px;letter-spacing:.11em;
  color:var(--dim);border:1px solid var(--border2);padding:2px 7px;margin:2px;}

/* セクションラベル */
.sec{font-family:var(--mono);font-size:8px;letter-spacing:.4em;color:rgba(184,150,46,.55);
  margin-bottom:18px;display:flex;align-items:center;gap:10px;}
.sec::before,.sec::after{content:'';flex:1;height:1px;background:var(--border);opacity:.35;}

/* 系譜 */
.lineage-node{display:flex;align-items:center;gap:10px;padding:9px 0;position:relative;}
.ln-dot{width:5px;height:5px;border-radius:50%;background:var(--border);flex-shrink:0;}
.ln-dot.you{background:var(--gold);box-shadow:0 0 8px rgba(184,150,46,.5);}
.lineage-node.you{color:var(--gold);}
.ln-name{font-family:var(--mono);font-size:9px;letter-spacing:.1em;color:var(--muted);}
.ln-note{font-family:var(--jp);font-size:10px;color:var(--dim);}
.ln-arrow{font-family:var(--mono);font-size:8px;color:var(--dim);padding:2px 0 2px 14px;}

/* レーダー */
.radar-wrap{height:260px;margin:0 auto;}

/* シェアカード */
.share-card{background:#0c0b09;border:1px solid rgba(184,150,46,.28);padding:26px 26px 20px;position:relative;}
.share-card::after{content:'SOKRATES';position:absolute;top:10px;right:13px;
  font-family:var(--mono);font-size:7px;letter-spacing:.35em;color:rgba(184,150,46,.16);}

.footer{padding:48px 0 32px;text-align:center;font-family:var(--mono);font-size:7px;color:var(--dim);letter-spacing:.2em;position:relative;z-index:10;}

@media(max-width:480px){
  .content,.site-header{padding:0 18px;}
  .opt{padding:13px 15px;font-size:12px;}
  .q-text{font-size:16px;}
}
`;

// ───────────────────────────────────────────────────────────────
//  SCREENS
// ───────────────────────────────────────────────────────────────
function StartScreen({ onStart }) {
  return (
    <div className="content">
      <div className="hero">
        <h1 className="hero-title flicker">ソクラテス</h1>
        <p className="hero-sub">THOUGHT COORDINATE ANALYSIS</p>
        <p className="hero-desc">
          あなたの世界観・真理観・自由観・善悪観をもとに、
          思想座標を算出し、近い哲学者の系譜を明らかにします。
          心理テストではありません。思想の問いへの回答です。
        </p>
        <div className="hero-meta">
          <span>12問</span>
          <span>思想座標</span>
          <span>哲学者マッチング</span>
          <span>系譜導線</span>
        </div>
        <button className="btn btn-primary" onClick={onStart}>
          ENTER ARCHIVE
        </button>
      </div>
    </div>
  );
}

function QuestionCard({ question, qIndex, total, onAnswer }) {
  const pct = Math.round((qIndex / total) * 100);
  if (!question) return null;
  return (
    <div className="q-wrap" key={question.id}>
      <div className="q-prog"><div className="q-fill" style={{ width: pct + "%" }} /></div>
      <div className="q-meta">
        <span>{String(qIndex + 1).padStart(2,"0")} / {String(total).padStart(2,"0")}</span>
        <span>{pct}%</span>
      </div>
      <p className="q-num">QUESTION {String(qIndex + 1).padStart(2,"0")}</p>
      <h2 className="q-text">{question.text}</h2>
      {question.sub && <p className="q-sub">{question.sub}</p>}
      <div>
        {(question.options || []).map((opt, i) => (
          <button
            key={opt.label}
            className="opt"
            onClick={() => onAnswer(opt)}
            style={{ animationDelay: (i * 0.06) + "s", animation: "fadeUp .4s ease both" }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AnalyzingScreen() {
  const [step, setStep] = useState(0);
  const steps = ["思想座標を算出中","哲学者との類似度を計算中","思想系譜を解析中","レポートを生成中"];
  useEffect(() => {
    const id = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 560);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="content analyzing">
      <p className="ana-label">ANALYZING</p>
      <div className="dots"><div className="dot"/><div className="dot"/><div className="dot"/></div>
      {steps.map((s, i) => (
        <p key={s} className="step" style={{ color: i <= step ? "rgba(232,213,176,.65)" : "rgba(232,213,176,.14)" }}>{s}</p>
      ))}
    </div>
  );
}

function PhilCard({ phil, delay }) {
  const [open, setOpen] = useState(false);
  if (!phil) return null;
  return (
    <div className="pc" style={{ animationDelay: delay + "s" }} onClick={() => setOpen(o => !o)}>
      <div className="pc-top">
        <div>
          <div className="pc-pct">{phil.pct ?? 0}%</div>
          <div className="pc-name">{phil.name}</div>
          <div className="pc-en">{phil.nameEn} · {phil.period}</div>
          <div className="pc-label" style={{ color: phil.color, borderColor: phil.color + "55" }}>{phil.label}</div>
        </div>
        <span style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--dim)", letterSpacing:".1em", paddingTop:4 }}>
          {open ? "▲" : "▼"}
        </span>
      </div>
      {open && (
        <div className="pc-body">
          <p className="pc-desc">{phil.description}</p>
          <p className="pc-quote">「{phil.quote}」</p>
          <div className="pc-books">
            <p className="pc-blabel">READING PATH</p>
            {phil.beginnerBook && (
              <div className="pc-book">
                <span>{phil.beginnerBook.title}</span>
                {phil.beginnerBook.author && <span style={{ fontSize:10, color:"var(--dim)" }}>— {phil.beginnerBook.author}</span>}
              </div>
            )}
            {phil.mainWork && <div className="pc-book" style={{ opacity:.7 }}><span>{phil.mainWork.title}（主著）</span></div>}
          </div>
          {(phil.tags || []).length > 0 && (
            <div className="tag-wrap">{phil.tags.map(t => <span key={t} className="tag">{t}</span>)}</div>
          )}
        </div>
      )}
    </div>
  );
}

function LineageViz({ topPhil }) {
  if (!topPhil) return null;
  const sources = (topPhil.lineage || []).map(id => PHILOSOPHERS.find(p => p.id === id)).filter(Boolean);
  const influenced = (topPhil.influenced || []).map(id => PHILOSOPHERS.find(p => p.id === id)).filter(Boolean);
  return (
    <div style={{ marginBottom:36 }}>
      {sources.length > 0 && (
        <>
          <p style={{ fontFamily:"var(--mono)", fontSize:7, color:"var(--dim)", letterSpacing:".2em", marginBottom:10 }}>INFLUENCED BY</p>
          {sources.map(s => (
            <div key={s.id} className="lineage-node">
              <div className="ln-dot" />
              <span className="ln-name">{s.name}</span>
              <span className="ln-note">— {s.label}</span>
            </div>
          ))}
          <div className="ln-arrow">↓</div>
        </>
      )}
      <div className="lineage-node you">
        <div className="ln-dot you" />
        <span className="ln-name" style={{ color:"var(--gold)" }}>{topPhil.name}</span>
        <span style={{ fontFamily:"var(--jp)", fontSize:9, color:"rgba(184,150,46,.5)" }}>← あなたの近傍</span>
      </div>
      {influenced.length > 0 && (
        <>
          <div className="ln-arrow">↓</div>
          <p style={{ fontFamily:"var(--mono)", fontSize:7, color:"var(--dim)", letterSpacing:".2em", margin:"4px 0 10px" }}>INFLUENCED</p>
          {influenced.slice(0, 4).map(s => (
            <div key={s.id} className="lineage-node">
              <div className="ln-dot" />
              <span className="ln-name">{s.name}</span>
              <span className="ln-note">— {s.label}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function ResultScreen({ answers, onRestart }) {
  const scores  = useMemo(() => sumScores(answers), [answers]);
  const type    = useMemo(() => resolveType(scores), [scores]);
  const matched = useMemo(() => matchPhilosophers(scores), [scores]);
  const topPhil = matched[0] || null;
  const radar   = useMemo(() => toRadar(scores), [scores]);

  const shareText = useMemo(() => {
    if (!type) return "";
    const names = matched.slice(0,3).map(p => p.name + " " + (p.pct||0) + "%").join(" / ");
    return "思想座標診断「ソクラテス」\n\n思想タイプ: " + (type.name||"") + "（" + (type.code||"") + "）\n" + (type.axis||"") + "\n\n近い哲学者: " + names + "\n\n「" + (type.quote||"") + "」\n\n#ソクラテス診断 #思想座標";
  }, [type, matched]);

  const handleShare = useCallback(() => {
    if (navigator.share) { navigator.share({ text: shareText }).catch(() => {}); }
    else if (navigator.clipboard) { navigator.clipboard.writeText(shareText).then(() => alert("コピーしました")).catch(() => {}); }
  }, [shareText]);

  if (!type) return null;

  return (
    <div className="content" style={{ paddingBottom:80 }}>
      <div className="result-top">
        <p className="r-label">THOUGHT TYPE · 思想類型</p>
        <h2 className="type-name" style={{ color: type.color || "var(--gold)" }}>{type.name}</h2>
        <p className="type-code">{type.code} · {type.axis}</p>
        <p className="type-desc">{type.desc}</p>
      </div>

      <div className="divider" />

      <div style={{ marginBottom:36 }}>
        <p className="sec">THOUGHT COORDINATE</p>
        <div className="radar-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radar} margin={{ top:10, right:32, left:32, bottom:10 }}>
              <PolarGrid stroke="rgba(184,150,46,.1)" />
              <PolarAngleAxis dataKey="axis" tick={{ fill:"rgba(232,213,176,.45)", fontSize:9, fontFamily:"'JetBrains Mono',monospace" }} />
              <Radar name="思想座標" dataKey="value" stroke="rgba(184,150,46,.75)" fill="rgba(184,150,46,.1)" strokeWidth={1.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="divider" />

      <div style={{ marginBottom:36 }}>
        <p className="sec">PHILOSOPHER MATCH</p>
        <p style={{ fontFamily:"var(--jp)", fontSize:12, color:"var(--dim)", marginBottom:18, fontWeight:200, lineHeight:1.9, letterSpacing:".04em" }}>
          あなたの思想座標に近い哲学者です。クリックで詳細・系譜を確認できます。
        </p>
        {matched.map((p, i) => <PhilCard key={p.id} phil={p} delay={i * 0.07} />)}
      </div>

      <div className="divider" />

      <div style={{ marginBottom:36 }}>
        <p className="sec">QUOTATION</p>
        <blockquote className="type-quote">{type.quote}</blockquote>
        {topPhil && (
          <p style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--dim)", marginTop:10, letterSpacing:".14em" }}>
            {topPhil.name} · {topPhil.period}
          </p>
        )}
      </div>

      <div className="divider" />

      {topPhil && (
        <>
          <div style={{ marginBottom:8 }}>
            <p className="sec">THOUGHT LINEAGE</p>
            <p style={{ fontFamily:"var(--jp)", fontSize:12, color:"var(--dim)", marginBottom:20, fontWeight:200, lineHeight:1.9, letterSpacing:".04em" }}>
              {topPhil.name}の思想の流れです。この系譜を辿ることが次の探求の糸口になります。
            </p>
            <LineageViz topPhil={topPhil} />
          </div>
          <div className="divider" />
        </>
      )}

      <div style={{ marginBottom:36 }}>
        <p className="sec">SHARE</p>
        <div className="share-card">
          <p style={{ fontFamily:"var(--mono)", fontSize:7, color:"var(--dim)", letterSpacing:".28em", marginBottom:14 }}>SOKRATES · THOUGHT COORDINATE ANALYSIS</p>
          <p style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontSize:20, color: type.color || "var(--gold)", marginBottom:4 }}>{type.name}</p>
          <p style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--dim)", letterSpacing:".2em", marginBottom:14 }}>{type.code} · {type.axis}</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:14, marginBottom:14 }}>
            {matched.slice(0,3).map(p => (
              <span key={p.id} style={{ fontFamily:"var(--mono)", fontSize:9 }}>
                <span style={{ color:"var(--gold)" }}>{p.pct}%</span>
                <span style={{ color:"var(--dim)", marginLeft:5 }}>{(p.nameEn||"").split(" ").pop()}</span>
              </span>
            ))}
          </div>
          <p style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontSize:12, color:"var(--muted)", lineHeight:1.75 }}>「{type.quote}」</p>
        </div>
        <div style={{ display:"flex", gap:10, marginTop:12 }}>
          <button className="btn btn-primary" onClick={handleShare}>SHARE</button>
          <button className="btn btn-ghost" onClick={onRestart}>RESTART</button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
//  APP ROOT
// ───────────────────────────────────────────────────────────────
export default function App() {
  const [phase,   setPhase]   = useState("start");
  const [qIndex,  setQIndex]  = useState(0);
  const [answers, setAnswers] = useState([]);

  const currentQ = QUESTIONS[qIndex] || null;

  const handleStart = useCallback(() => { setPhase("quiz"); setQIndex(0); setAnswers([]); }, []);

  const handleAnswer = useCallback((opt) => {
    const next = [...answers, opt];
    if (qIndex + 1 >= QUESTIONS.length) {
      setAnswers(next);
      setPhase("analyzing");
      setTimeout(() => setPhase("result"), 2400);
    } else {
      setAnswers(next);
      setQIndex(i => i + 1);
    }
  }, [answers, qIndex]);

  const handleRestart = useCallback(() => { setPhase("start"); setQIndex(0); setAnswers([]); }, []);

  return (
    <>
      <style>{CSS}</style>
      <div className="bg-grid" />
      <div className="noise" />
      <div className="scanlines" />
      <div className="page">
        {phase !== "quiz" && (
          <header className="site-header" style={{ animation:"fadeDown .8s ease both" }}>
            <div className="logo flicker">ソクラテス</div>
            <div className="logo-sub">THOUGHT COORDINATE ARCHIVE</div>
            <div className="divider" />
          </header>
        )}
        {phase === "start"     && <StartScreen onStart={handleStart} />}
        {phase === "quiz"      && (
          <div className="content">
            <div style={{ paddingTop:28, fontFamily:"var(--serif)", fontStyle:"italic", fontSize:15, color:"rgba(184,150,46,.4)", letterSpacing:".1em" }}>ソクラテス</div>
            <QuestionCard key={currentQ ? currentQ.id : qIndex} question={currentQ} qIndex={qIndex} total={QUESTIONS.length} onAnswer={handleAnswer} />
          </div>
        )}
        {phase === "analyzing" && <AnalyzingScreen />}
        {phase === "result"    && <ResultScreen answers={answers} onRestart={handleRestart} />}
        {phase !== "quiz"      && <footer className="footer">SOKRATES · THOUGHT COORDINATE ARCHIVE</footer>}
      </div>
    </>
  );
}
