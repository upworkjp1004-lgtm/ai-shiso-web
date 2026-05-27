// ═══════════════════════════════════════════════════════════════
//  ソクラテス — 思想座標診断 v1.0
//  Vite + React + recharts のみ使用（追加依存ゼロ）
//  単一ファイル完全実装
// ═══════════════════════════════════════════════════════════════
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";

// ───────────────────────────────────────────────────────────────
//  DATA ▸ 質問（12問）
//  スコア軸14本:
//  existence(実存) essence(本質) nihilism(虚無) transcend(超越)
//  rationalism(理性) empiricism(経験) individual(個人) collective(社会)
//  pessimism(悲観) optimism(楽観) absurdism(不条理) idealism(観念)
//  materialism(唯物) skepticism(懐疑)
// ───────────────────────────────────────────────────────────────
const QUESTIONS = [
  {
    id: "q01",
    text: "人は生まれる前から、なんらかの「役割」や「目的」を持っていると思うか？",
    sub: "本質とは何か、という問い。",
    options: [
      { label: "あると思う。存在には意味が先にある",       scores: { essence:3, transcend:2, idealism:1 } },
      { label: "ない。意味は自分で作るものだ",             scores: { existence:3, individual:2, nihilism:1 } },
      { label: "分からないが、問い続けることに価値がある",  scores: { skepticism:2, existence:1, absurdism:1 } },
      { label: "そもそも「意味」という概念自体を疑う",      scores: { nihilism:3, skepticism:2, materialism:1 } },
    ],
  },
  {
    id: "q02",
    text: "苦しみには、意味があると思うか？",
    sub: "痛みと価値の関係について。",
    options: [
      { label: "ある。苦しみは人を成長させる",             scores: { transcend:2, optimism:2, idealism:1 } },
      { label: "ない。苦しみはただの苦しみだ",             scores: { nihilism:2, materialism:2, pessimism:1 } },
      { label: "意味はないが、立ち向かうことに価値がある",  scores: { absurdism:3, existence:2, individual:1 } },
      { label: "人によって違う。普遍的な答えはない",        scores: { skepticism:2, empiricism:2, existence:1 } },
    ],
  },
  {
    id: "q03",
    text: "「善悪」は人間が決めたルールか、それとも世界に先からあるものか？",
    sub: "道徳の根拠について。",
    options: [
      { label: "世界に先からある。普遍的な善悪がある",       scores: { essence:3, rationalism:2, transcend:1 } },
      { label: "人間が決めたルールだ。文化によって変わる",   scores: { skepticism:2, empiricism:2, materialism:1 } },
      { label: "権力が「善悪」を作り出している",            scores: { skepticism:3, materialism:2, individual:1 } },
      { label: "善悪の基準は、理性によって導き出せる",      scores: { rationalism:3, idealism:2, essence:1 } },
    ],
  },
  {
    id: "q04",
    text: "世界は、理性によって完全に理解できると思うか？",
    sub: "認識の限界について。",
    options: [
      { label: "原理的にはできる。未解明なだけで",          scores: { rationalism:3, optimism:2, materialism:1 } },
      { label: "できない。理性には限界がある",              scores: { skepticism:2, pessimism:1, existence:1 } },
      { label: "理性そのものが、世界の一部を作っている",     scores: { idealism:3, rationalism:1, skepticism:1 } },
      { label: "「理解」の概念自体を問い直すべきだ",        scores: { skepticism:3, existence:1, absurdism:1 } },
    ],
  },
  {
    id: "q05",
    text: "「自由」とは何か。最も近いものを選んでほしい。",
    sub: "自由の本質について。",
    options: [
      { label: "何にも縛られないこと",                     scores: { individual:3, existence:2, nihilism:1 } },
      { label: "自分の本質に従って生きること",              scores: { essence:2, rationalism:2, idealism:1 } },
      { label: "社会の中で他者と関わりながら実現されるもの", scores: { collective:3, optimism:1, idealism:1 } },
      { label: "幻想だ。すべては因果に縛られている",        scores: { materialism:3, pessimism:1, skepticism:1 } },
    ],
  },
  {
    id: "q06",
    text: "神や超越的なものの存在を、どう考えるか？",
    sub: "超越と存在について。",
    options: [
      { label: "存在する。あるいは存在するかもしれない",     scores: { transcend:4, idealism:1, optimism:1 } },
      { label: "存在しない。人間が作った概念だ",            scores: { materialism:3, nihilism:1, skepticism:1 } },
      { label: "証明できないが、問い自体が重要だ",          scores: { skepticism:2, existence:2, absurdism:1 } },
      { label: "問いを立てること自体が誤りだと思う",        scores: { skepticism:3, materialism:1, empiricism:2 } },
    ],
  },
  {
    id: "q07",
    text: "個人と社会、どちらが優先されるべきか？",
    sub: "政治哲学の根本について。",
    options: [
      { label: "個人の自由が最大限尊重されるべきだ",        scores: { individual:4, existence:1, skepticism:1 } },
      { label: "社会全体の幸福が優先される",               scores: { collective:3, optimism:1, rationalism:1 } },
      { label: "どちらも一方的に優先はできない",            scores: { skepticism:2, empiricism:2, absurdism:1 } },
      { label: "「個人」と「社会」の二項対立が間違っている", scores: { skepticism:3, idealism:1, existence:1 } },
    ],
  },
  {
    id: "q08",
    text: "「不条理」——意味のない世界に生きることへの態度は？",
    sub: "カミュ的な問い。",
    options: [
      { label: "それでも反抗し、生きることを選ぶ",          scores: { absurdism:4, existence:2, individual:1 } },
      { label: "意味を自分で作り出す",                     scores: { existence:3, individual:2, optimism:1 } },
      { label: "不条理を直視しながら、静かに受け入れる",    scores: { pessimism:2, nihilism:2, absurdism:2 } },
      { label: "世界には隠れた秩序があり、不条理は見かけ上のものだ", scores: { transcend:2, rationalism:2, idealism:1 } },
    ],
  },
  {
    id: "q09",
    text: "歴史は「進歩」しているか？",
    sub: "時間と人類について。",
    options: [
      { label: "している。人類は成熟しつつある",            scores: { optimism:3, rationalism:2, collective:1 } },
      { label: "していない。繰り返しているだけだ",          scores: { pessimism:3, nihilism:1, skepticism:1 } },
      { label: "「進歩」という概念自体が西洋的偏見だ",      scores: { skepticism:3, materialism:1, empiricism:1 } },
      { label: "方向はあるが、一直線ではない",              scores: { empiricism:2, skepticism:1, idealism:1 } },
    ],
  },
  {
    id: "q10",
    text: "言語は、思考を「表現」するものか、それとも「構成」するものか？",
    sub: "言語と認識の関係について。",
    options: [
      { label: "表現するもの。思考は言語なしでも存在する",   scores: { idealism:2, rationalism:2, essence:1 } },
      { label: "構成するもの。言語なしに思考はない",        scores: { skepticism:2, materialism:2, empiricism:1 } },
      { label: "どちらでもある。相互に影響し合う",          scores: { empiricism:2, skepticism:1, existence:1 } },
      { label: "言語の限界が、世界の限界だ",               scores: { skepticism:3, idealism:1, pessimism:1 } },
    ],
  },
  {
    id: "q11",
    text: "「死」について、最も近い感覚は？",
    sub: "有限性との関係について。",
    options: [
      { label: "死があるから、今が輝く",                   scores: { existence:3, absurdism:1, individual:1 } },
      { label: "死は恐ろしい。できれば考えたくない",        scores: { empiricism:2, optimism:1, materialism:1 } },
      { label: "死は解放だ。存在の苦しみから逃れられる",    scores: { pessimism:3, nihilism:2, transcend:1 } },
      { label: "死後も何かが続くと思いたい",               scores: { transcend:3, idealism:2, optimism:1 } },
    ],
  },
  {
    id: "q12",
    text: "「真実」は一つか、複数あるか？",
    sub: "真理の本質について。",
    options: [
      { label: "一つある。人間がまだ到達していないだけ",     scores: { rationalism:3, essence:2, optimism:1 } },
      { label: "複数ある。立場によって異なる",              scores: { skepticism:2, empiricism:2, existence:1 } },
      { label: "「真実」は言語ゲームの中でしか意味を持たない", scores: { skepticism:3, materialism:1, empiricism:1 } },
      { label: "真実を追い求めること自体に意味がある",      scores: { idealism:2, existence:2, absurdism:1 } },
    ],
  },
];

// ───────────────────────────────────────────────────────────────
//  DATA ▸ 哲学者（12人）
// ───────────────────────────────────────────────────────────────
const PHILOSOPHERS = [
  {
    id: "nietzsche", name: "フリードリヒ・ニーチェ",
    nameEn: "Friedrich Nietzsche", period: "1844–1900",
    label: "力への意志",
    desc: "ニヒリズムを乗り越えようとした思想家。道徳の「系譜」を問い、キリスト教的価値体系を解体し、力への意志と永劫回帰を提唱した。",
    scores: { existence:4, essence:-2, nihilism:3, transcend:-3, rationalism:-1, empiricism:2, individual:5, collective:-3, pessimism:2, optimism:1, absurdism:2, idealism:-1, materialism:1, skepticism:3 },
    lineage: ["schopenhauer"], influences: ["schopenhauer"], nextThinkers: ["heidegger","camus"], mapX: -0.62, mapY: -0.45, nextRead: { philosopher: "ハイデガー", philosopherId: "heidegger", recommendedBook: "存在と時間", reason: "ニーチェが解体した「存在の意味」をハイデガーが再構築します。力への意志から存在論へ、問いが深化します。", difficulty: "Hard" }, influenced: ["heidegger","foucault","sartre","camus"],
    beginnerBook: { title: "ニーチェ入門", author: "西尾幹二" },
    mainWork: "ツァラトゥストラはこう語った",
    quote: "汝の意志が「これが人生であったのか、さあもう一度」と言えるように生きよ。",
    color: "#a8902a", tags: ["実存","ニヒリズム克服","永劫回帰","価値の転換"],
  },
  {
    id: "camus", name: "アルベール・カミュ",
    nameEn: "Albert Camus", period: "1913–1960",
    label: "不条理への反抗",
    desc: "実存主義と距離を置きながら「不条理の哲学」を構築。意味のない世界に対して自殺でも逃避でもなく「反抗」を選ぶことを説いた。",
    scores: { existence:4, essence:-2, nihilism:2, transcend:-2, rationalism:0, empiricism:3, individual:3, collective:1, pessimism:2, optimism:1, absurdism:5, idealism:-1, materialism:2, skepticism:2 },
    lineage: ["nietzsche","kierkegaard"], influences: ["nietzsche","kierkegaard"], nextThinkers: [], mapX: -0.48, mapY: -0.30, nextRead: { philosopher: "サルトル", philosopherId: "sartre", recommendedBook: "実存主義とは何か", reason: "カミュと論争したサルトルを読むことで、「不条理」と「実存」の違いが明確になります。", difficulty: "Medium" }, influenced: [],
    beginnerBook: { title: "シーシュポスの神話", author: "カミュ（清水徹訳）" },
    mainWork: "シーシュポスの神話",
    quote: "真に重大な哲学の問題はただ一つしかない。それは自殺だ。",
    color: "#6a9a5a", tags: ["不条理","反抗","実存"],
  },
  {
    id: "sartre", name: "ジャン＝ポール・サルトル",
    nameEn: "Jean-Paul Sartre", period: "1905–1980",
    label: "実存は本質に先立つ",
    desc: "実存主義の旗手。「実存は本質に先立つ」という命題で、人間が先に存在し後から自らの本質を作ると主張した。",
    scores: { existence:5, essence:-3, nihilism:1, transcend:-4, rationalism:2, empiricism:1, individual:4, collective:2, pessimism:1, optimism:1, absurdism:2, idealism:2, materialism:1, skepticism:1 },
    lineage: ["heidegger","husserl"], influences: ["heidegger","husserl"], nextThinkers: [], mapX: -0.52, mapY: -0.18, nextRead: { philosopher: "ハイデガー", philosopherId: "heidegger", recommendedBook: "存在と時間", reason: "サルトルの実存主義の源流であるハイデガーを辿ることで、自由と存在の問いがより深まります。", difficulty: "Hard" }, influenced: [],
    beginnerBook: { title: "実存主義とは何か", author: "サルトル（伊吹武彦訳）" },
    mainWork: "存在と無",
    quote: "他者は地獄だ。",
    color: "#6868b8", tags: ["実存主義","自由と責任","アンガージュマン"],
  },
  {
    id: "heidegger", name: "マルティン・ハイデガー",
    nameEn: "Martin Heidegger", period: "1889–1976",
    label: "存在と時間",
    desc: "存在の問いを哲学の中心に置いた。「現存在」「被投性」「死への存在」といった概念を通じ、人間の有限的存在を解析した。",
    scores: { existence:5, essence:1, nihilism:1, transcend:1, rationalism:-1, empiricism:-1, individual:3, collective:-1, pessimism:2, optimism:-1, absurdism:1, idealism:2, materialism:-2, skepticism:2 },
    lineage: ["nietzsche","husserl"], influences: ["nietzsche","husserl"], nextThinkers: ["sartre","foucault"], mapX: -0.38, mapY: -0.12, nextRead: { philosopher: "サルトル", philosopherId: "sartre", recommendedBook: "実存主義とは何か", reason: "ハイデガーの存在論をサルトルがどう実存主義へ展開したかを辿ると、思想の連鎖が見えてきます。", difficulty: "Medium" }, influenced: ["sartre","foucault"],
    beginnerBook: { title: "ハイデガー入門", author: "細川亮一" },
    mainWork: "存在と時間",
    quote: "現存在は、自己の存在においてこの存在そのものが問題となっている存在者である。",
    color: "#5888a8", tags: ["存在論","現存在","死への存在"],
  },
  {
    id: "kierkegaard", name: "ソーレン・キェルケゴール",
    nameEn: "Søren Kierkegaard", period: "1813–1855",
    label: "単独者の実存",
    desc: "実存主義の源流とされる宗教哲学者。美的・倫理的・宗教的の三段階を通じ「単独者」として神の前に立つことを説いた。",
    scores: { existence:5, essence:1, nihilism:-1, transcend:4, rationalism:-2, empiricism:0, individual:5, collective:-3, pessimism:2, optimism:-1, absurdism:2, idealism:3, materialism:-3, skepticism:2 },
    lineage: ["kant"], influences: ["kant"], nextThinkers: ["nietzsche","heidegger"], mapX: -0.28, mapY: 0.52, nextRead: { philosopher: "ニーチェ", philosopherId: "nietzsche", recommendedBook: "ツァラトゥストラはこう語った", reason: "キェルケゴールの「単独者」概念を批判的に継承したニーチェを読むことで、神なき実存の問いへ進めます。", difficulty: "Medium" }, influenced: ["nietzsche","heidegger","sartre","camus"],
    beginnerBook: { title: "キェルケゴール入門", author: "鈴木祐丞" },
    mainWork: "あれか、これか",
    quote: "不安とは自由のめまいである。",
    color: "#9878c8", tags: ["実存主義源流","単独者","不安","信仰の飛躍"],
  },
  {
    id: "foucault", name: "ミシェル・フーコー",
    nameEn: "Michel Foucault", period: "1926–1984",
    label: "権力と知",
    desc: "知と権力の関係、狂気・監視・性の歴史を分析した。真理が権力によって産出されるという視点から、近代の自明性を問い直した。",
    scores: { existence:2, essence:-3, nihilism:2, transcend:-3, rationalism:-2, empiricism:3, individual:2, collective:-1, pessimism:2, optimism:-1, absurdism:2, idealism:-2, materialism:3, skepticism:5 },
    lineage: ["nietzsche","heidegger"], influences: ["nietzsche","heidegger"], nextThinkers: [], mapX: -0.70, mapY: -0.60, nextRead: { philosopher: "ニーチェ", philosopherId: "nietzsche", recommendedBook: "道徳の系譜学", reason: "フーコーの権力論の根底にあるニーチェの系譜学を読むことで、知と権力の思想的起源が見えます。", difficulty: "Medium" }, influenced: [],
    beginnerBook: { title: "フーコー入門", author: "中山元" },
    mainWork: "監獄の誕生",
    quote: "権力は禁止するのではなく、産出する。",
    color: "#78a868", tags: ["権力論","系譜学","知の考古学"],
  },
  {
    id: "kant", name: "イマヌエル・カント",
    nameEn: "Immanuel Kant", period: "1724–1804",
    label: "理性の批判",
    desc: "「コペルニクス的転回」を哲学にもたらした巨人。経験論と合理論を総合し、認識の限界と道徳法則を体系化した。",
    scores: { existence:-1, essence:3, nihilism:-2, transcend:2, rationalism:5, empiricism:2, individual:3, collective:2, pessimism:-1, optimism:2, absurdism:-2, idealism:4, materialism:-2, skepticism:2 },
    lineage: ["hume","leibniz"], influences: ["hume","leibniz"], nextThinkers: ["hegel","schopenhauer"], mapX: 0.60, mapY: 0.48, nextRead: { philosopher: "ヘーゲル", philosopherId: "hegel", recommendedBook: "精神現象学", reason: "カントの批判哲学を乗り越えようとしたヘーゲルを読むことで、理性と歴史の問いへ進めます。", difficulty: "Hard" }, influenced: ["hegel","schopenhauer","kierkegaard"],
    beginnerBook: { title: "カント入門", author: "石川文康" },
    mainWork: "純粋理性批判",
    quote: "頭上の星空と、内なる道徳律——この二つが私を畏敬で満たす。",
    color: "#b8a850", tags: ["批判哲学","義務論","認識論"],
  },
  {
    id: "wittgenstein", name: "ルートヴィヒ・ウィトゲンシュタイン",
    nameEn: "Ludwig Wittgenstein", period: "1889–1951",
    label: "言語ゲームの境界",
    desc: "哲学の問題を「言語の誤用」から生じると捉え、言語の限界を明確化しようとした。前期は論理実証主義的、後期は「言語ゲーム」論へ転換。",
    scores: { existence:1, essence:-1, nihilism:2, transcend:-1, rationalism:3, empiricism:4, individual:1, collective:0, pessimism:1, optimism:0, absurdism:2, idealism:-1, materialism:2, skepticism:5 },
    lineage: ["frege","russell"], influences: ["frege","russell"], nextThinkers: [], mapX: 0.72, mapY: -0.55, nextRead: { philosopher: "フーコー", philosopherId: "foucault", recommendedBook: "言葉と物", reason: "言語の限界を問うウィトゲンシュタインから、言語と権力を問うフーコーへ。知の問いが社会へ開きます。", difficulty: "Hard" }, influenced: [],
    beginnerBook: { title: "ウィトゲンシュタイン入門", author: "永井均" },
    mainWork: "論理哲学論考",
    quote: "語りえないことについては、沈黙しなければならない。",
    color: "#7898a8", tags: ["言語哲学","分析哲学","言語ゲーム"],
  },
  {
    id: "schopenhauer", name: "アルトゥル・ショーペンハウアー",
    nameEn: "Arthur Schopenhauer", period: "1788–1860",
    label: "意志と苦悩",
    desc: "「世界は意志と表象である」と説き、存在の根底に盲目的な「意志」を見出した。仏教との親和性を持ち、意志の否定による救済を説いた。",
    scores: { existence:2, essence:1, nihilism:3, transcend:2, rationalism:1, empiricism:2, individual:1, collective:-2, pessimism:5, optimism:-4, absurdism:1, idealism:3, materialism:-1, skepticism:2 },
    lineage: ["kant","plato"], influences: ["kant","plato"], nextThinkers: ["nietzsche"], mapX: 0.10, mapY: -0.70, nextRead: { philosopher: "ニーチェ", philosopherId: "nietzsche", recommendedBook: "道徳の系譜学", reason: "ショーペンハウアーの悲観主義を超克しようとしたニーチェを読むことで、意志の問いが反転します。", difficulty: "Medium" }, influenced: ["nietzsche","freud","wittgenstein"],
    beginnerBook: { title: "意志と表象としての世界（入門）", author: "西尾幹二" },
    mainWork: "意志と表象としての世界",
    quote: "人生は苦しみに満ちており、その根底には盲目の意志がある。",
    color: "#9a8070", tags: ["悲観主義","意志論","東洋哲学との融合"],
  },
  {
    id: "cioran", name: "エミール・シオラン",
    nameEn: "Emil Cioran", period: "1911–1995",
    label: "存在の苦い観察",
    desc: "断章形式でニヒリズム・悲観主義・虚無を語ったルーマニア出身の思想家。存在への根源的な懐疑を示した。",
    scores: { existence:3, essence:-2, nihilism:5, transcend:-1, rationalism:-2, empiricism:2, individual:4, collective:-4, pessimism:5, optimism:-5, absurdism:3, idealism:-1, materialism:2, skepticism:3 },
    lineage: ["nietzsche","schopenhauer"], influences: ["nietzsche","schopenhauer"], nextThinkers: [], mapX: -0.20, mapY: -0.82, nextRead: { philosopher: "ショーペンハウアー", philosopherId: "schopenhauer", recommendedBook: "意志と表象としての世界", reason: "シオランの虚無の根源にあるショーペンハウアーを読むことで、悲観主義の哲学的基盤が見えます。", difficulty: "Hard" }, influenced: [],
    beginnerBook: { title: "絶望のきわみで", author: "シオラン（金井裕訳）" },
    mainWork: "生誕の災厄",
    quote: "存在するということは、ただの見かけの勝利に過ぎない。",
    color: "#888888", tags: ["ニヒリズム","悲観主義","断章形式"],
  },
  {
    id: "spinoza", name: "バールーフ・スピノザ",
    nameEn: "Baruch Spinoza", period: "1632–1677",
    label: "神すなわち自然",
    desc: "「神すなわち自然（Deus sive Natura）」を唱えた汎神論の哲学者。デカルトの二元論を批判し、一元論的な宇宙観を幾何学的方法で体系化した。",
    scores: { existence:-1, essence:3, nihilism:-2, transcend:3, rationalism:5, empiricism:1, individual:0, collective:2, pessimism:-2, optimism:3, absurdism:-2, idealism:3, materialism:2, skepticism:0 },
    lineage: ["descartes","leibniz"], influences: ["descartes","leibniz"], nextThinkers: ["hegel"], mapX: 0.55, mapY: 0.72, nextRead: { philosopher: "ヘーゲル", philosopherId: "hegel", recommendedBook: "精神現象学", reason: "スピノザの一元論的世界観をヘーゲルが弁証法的に展開。神と自然と歴史の問いが連なります。", difficulty: "Hard" }, influenced: ["hegel","nietzsche"],
    beginnerBook: { title: "スピノザ入門", author: "吉田量彦" },
    mainWork: "エチカ",
    quote: "恐れから生まれる希望は存在しない。希望から生まれる恐れもまた存在しない。",
    color: "#5898b8", tags: ["汎神論","一元論","幾何学的方法"],
  },
  {
    id: "hegel", name: "G.W.F. ヘーゲル",
    nameEn: "Georg Wilhelm Friedrich Hegel", period: "1770–1831",
    label: "弁証法的精神",
    desc: "絶対精神と弁証法（正・反・合）で歴史と存在を体系化した。カントを超え、マルクス・ハイデガー・サルトルに深く影響した。",
    scores: { existence:-1, essence:4, nihilism:-2, transcend:3, rationalism:5, empiricism:-1, individual:-1, collective:4, pessimism:-2, optimism:4, absurdism:-3, idealism:5, materialism:-3, skepticism:-1 },
    lineage: ["kant","fichte"], influences: ["kant","fichte"], nextThinkers: ["kierkegaard","nietzsche"], mapX: 0.68, mapY: 0.62, nextRead: { philosopher: "キェルケゴール", philosopherId: "kierkegaard", recommendedBook: "あれか、これか", reason: "ヘーゲルの体系哲学への反発から生まれたキェルケゴールを読むことで、「単独者」の問いへ向かえます。", difficulty: "Medium" }, influenced: ["marx","kierkegaard","nietzsche","heidegger"],
    beginnerBook: { title: "ヘーゲル入門", author: "加藤尚武" },
    mainWork: "精神現象学",
    quote: "ミネルヴァのフクロウは、夕暮れが迫る時に初めて飛び立つ。",
    color: "#a89840", tags: ["弁証法","絶対精神","歴史哲学"],
  },
];

// ───────────────────────────────────────────────────────────────
//  LOGIC ▸ 診断計算
// ───────────────────────────────────────────────────────────────
const AXES = ["existence","essence","nihilism","transcend","rationalism","empiricism","individual","collective","pessimism","optimism","absurdism","idealism","materialism","skepticism"];

function calcScores(answers) {
  const t = Object.fromEntries(AXES.map(k => [k, 0]));
  (answers || []).forEach(a => {
    Object.entries(a.scores || {}).forEach(([k, v]) => { if (k in t) t[k] += v; });
  });
  return t;
}

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  AXES.forEach(k => {
    const av = a[k]||0, bv = b[k]||0;
    dot += av*bv; na += av*av; nb += bv*bv;
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


// 最も対立する哲学者を算出（コサイン類似度が最も低い）
function findOpposingPhilosophers(s) {
  return [...PHILOSOPHERS]
    .map(p => ({ ...p, sim: cosineSim(s, p.scores) }))
    .sort((a, b) => a.sim - b.sim)
    .slice(0, 3);
}

// 思想マップ用：ユーザー座標算出
function calcMapCoords(s) {
  const maxVal = 12;
  const x = Math.max(-1, Math.min(1, ((s.individual||0) - (s.collective||0)) / maxVal));
  const y = Math.max(-1, Math.min(1, ((s.transcend||0) - (s.nihilism||0)) / maxVal));
  return { x, y };
}

// 対立理由を生成
function getOppositionReason(userScores, phil) {
  const userTopAxis = AXES.reduce((best, k) => (userScores[k]||0) > (userScores[best]||0) ? k : best, AXES[0]);
  const philTopAxis = AXES.reduce((best, k) => (phil.scores[k]||0) > (phil.scores[best]||0) ? k : best, AXES[0]);
  const axisJp = {
    existence:"主観的実存", essence:"客観的本質", nihilism:"虚無的観点", transcend:"超越的観点",
    rationalism:"理性的秩序", empiricism:"経験的観察", individual:"個人の自由", collective:"社会的調和",
    pessimism:"悲観的世界観", optimism:"楽観的世界観", absurdism:"不条理の直視", idealism:"観念的理想",
    materialism:"物質的現実", skepticism:"徹底的懐疑"
  };
  const u = axisJp[userTopAxis] || userTopAxis;
  const p = axisJp[philTopAxis] || philTopAxis;
  return "あなたが重視する「" + u + "」に対し、" + phil.name + "は「" + p + "」を哲学の核心に据えています。";
}


function resolveType(s) {
  const hi = (k, t) => (s[k]||0) >= t;
  if (hi("nihilism",4) && hi("pessimism",3))
    return { name:"ニヒリズム", code:"VOID", axis:"虚無 × 悲観", color:"#888899",
      desc:"あなたは、世界の意味の不在を直視しながら、それでも問い続ける傾向があります。価値の根拠を持てないがゆえに、問いそのものを哲学とする立場です。",
      quote:"深淵を覗くとき、深淵もまたこちらを覗いている。" };
  if (hi("absurdism",3) && hi("existence",3))
    return { name:"不条理主義", code:"ABSR", axis:"不条理 × 実存", color:"#6a9a5a",
      desc:"あなたは、世界に明確な意味を求めるよりも、不条理そのものを観察しようとする傾向があります。意味のない世界でも、反抗し生き続けることに価値を見出します。",
      quote:"シーシュポスは幸福だったと想像しなければならない。" };
  if (hi("existence",4) && hi("individual",3) && !hi("transcend",2))
    return { name:"実存主義", code:"EXIS", axis:"実存 × 個人", color:"#6868b8",
      desc:"あなたは、本質より実存を優先し、自由と責任の中で意味を構築しようとする傾向があります。人間は先に存在し、後から自らの本質を作る——その命題と共鳴しています。",
      quote:"実存は本質に先立つ。" };
  if (hi("rationalism",4) && hi("idealism",3))
    return { name:"観念論的合理主義", code:"RATS", axis:"理性 × 観念", color:"#b8a850",
      desc:"あなたは、理性によって世界を把握しようとする傾向が強い思想家です。カント・ヘーゲルの系譜に近く、現実の背後に理念的な構造を見出します。",
      quote:"現実的なものはすべて合理的である。" };
  if (hi("skepticism",4) && hi("empiricism",3))
    return { name:"懐疑的経験論", code:"SKEP", axis:"懐疑 × 経験", color:"#5888a8",
      desc:"あなたは、あらゆる前提を疑い、言語と概念の限界を分析する傾向があります。ウィトゲンシュタイン・フーコーの系譜に近い、批判的知性の持ち主です。",
      quote:"語りえないことについては、沈黙しなければならない。" };
  if (hi("transcend",3) && hi("idealism",2))
    return { name:"超越的観念論", code:"TRNS", axis:"超越 × 観念", color:"#9878c8",
      desc:"あなたは、世界を超える何かを志向し、形而上学的な問いに引き寄せられます。スピノザ・カントの系譜に近い、静かな思索者です。",
      quote:"頭上の星空と、内なる道徳律——この二つが私を畏敬で満たす。" };
  if (hi("pessimism",3))
    return { name:"悲観的観念論", code:"PESS", axis:"悲観 × 意志", color:"#9a8070",
      desc:"あなたは、世界の苦悩と有限性を深く見つめる傾向があります。ショーペンハウアー的な意志の哲学と共鳴し、芸術や否定の中に救済を見出します。",
      quote:"人生は苦しみであり、歴史は意志の盲目的な展開である。" };
  if (hi("collective",3) && hi("optimism",2))
    return { name:"社会的合理主義", code:"COMM", axis:"社会 × 楽観", color:"#78a868",
      desc:"あなたは、社会と個人の調和に関心を持ち、歴史の進歩を信じる傾向があります。ヘーゲル・マルクスの系譜に近い、社会哲学者的な視点を持ちます。",
      quote:"哲学者たちは世界をただ解釈してきた。重要なのはそれを変えることだ。" };
  return { name:"折衷的懐疑主義", code:"BORD", axis:"複合的", color:"#888898",
    desc:"あなたの思想は複数の流れが交差し、一つの系譜に収まりません。それは思想的な豊かさであり、問い続ける誠実さの証でもあります。",
    quote:"問い続けることが、哲学の本質だ。" };
}

const RADAR_KEYS = ["existence","rationalism","nihilism","individual","skepticism","transcend"];
const RADAR_JP   = { existence:"実存", rationalism:"理性", nihilism:"虚無", individual:"個人", skepticism:"懐疑", transcend:"超越" };
function toRadar(s) {
  return RADAR_KEYS.map(k => ({ axis: RADAR_JP[k]||k, value: Math.max(0, Math.min(10, (s[k]||0)+5)) }));
}

// ───────────────────────────────────────────────────────────────
//  CSS（全スタイル一括定義）
// ───────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=DM+Mono:ital,wght@0,300;0,400;1,300&family=Noto+Serif+JP:wght@200;300;400&display=swap');

/* ── reset ── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{background:#111109;color:#ddd0b0;font-family:'Noto Serif JP',serif;min-height:100vh;-webkit-font-smoothing:antialiased;}
::selection{background:rgba(168,144,58,.25);}
::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:rgba(168,144,58,.25);}

/* ── design tokens ── */
:root{
  --bg:#111109;
  --bg2:#171612;
  --bg3:#1c1b17;
  --gold:#b89c40;
  --gold2:#d4b860;
  --gold-dim:rgba(184,156,64,.55);
  --parch:#ddd0b0;
  --muted:rgba(221,208,176,.68);
  --dim:rgba(221,208,176,.40);
  --dim2:rgba(221,208,176,.24);
  --border:rgba(184,156,64,.22);
  --border2:rgba(255,255,255,.07);
  --border3:rgba(255,255,255,.04);
  --surface:rgba(255,255,255,.028);
  --surface2:rgba(255,255,255,.014);
  --mono:'DM Mono','JetBrains Mono',monospace;
  --serif:'Cormorant Garamond','Noto Serif JP',Georgia,serif;
  --jp:'Noto Serif JP',serif;
  --section-gap:56px;
  --card-pad:22px 24px;
}

/* ── animations ── */
@keyframes fadeUp  {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn  {from{opacity:0}to{opacity:1}}
@keyframes fadeDown{from{opacity:0;transform:translateY(-7px)}to{opacity:1;transform:translateY(0)}}
@keyframes flicker {0%,96%,100%{opacity:1}97%{opacity:.88}98.5%{opacity:1}99.5%{opacity:.92}}
@keyframes blink   {0%,100%{opacity:1}50%{opacity:0}}
@keyframes pulseGold{0%,100%{box-shadow:0 0 5px rgba(184,156,64,.35)}50%{box-shadow:0 0 12px rgba(184,156,64,.65)}}

/* ── background layers ── */
.bg-grid{
  position:fixed;inset:0;z-index:0;pointer-events:none;
  background-image:
    linear-gradient(rgba(184,156,64,.022) 1px,transparent 1px),
    linear-gradient(90deg,rgba(184,156,64,.022) 1px,transparent 1px);
  background-size:64px 64px;
}
.scanlines{
  position:fixed;inset:0;z-index:1;pointer-events:none;
  background:repeating-linear-gradient(
    0deg,transparent,transparent 3px,
    rgba(0,0,0,.03) 3px,rgba(0,0,0,.03) 4px
  );
}
.noise-layer{
  position:fixed;inset:0;z-index:1;pointer-events:none;opacity:.012;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size:200px;
}

/* ── layout ── */
.page{
  min-height:100vh;display:flex;flex-direction:column;
  align-items:center;position:relative;overflow-x:hidden;
}
.content{
  position:relative;z-index:10;
  width:100%;max-width:720px;
  padding:0 32px;
}
.flicker{animation:flicker 12s ease-in-out infinite;}

/* ── header ── */
.site-header{
  width:100%;max-width:720px;
  padding:52px 32px 0;
  position:relative;z-index:10;
}
.logo{
  font-family:var(--serif);
  font-size:clamp(28px,4.5vw,38px);
  color:var(--gold);font-style:italic;
  letter-spacing:.06em;font-weight:400;
}
.logo-sub{
  font-family:var(--mono);font-size:9px;
  letter-spacing:.44em;color:var(--dim);margin-top:6px;
}
.divider{
  width:100%;height:1px;
  background:linear-gradient(90deg,transparent,var(--gold),transparent);
  opacity:.2;margin:28px 0;
}

/* ── start / hero ── */
.hero{padding:88px 0 64px;text-align:center;}
.hero-title{
  font-family:var(--serif);
  font-size:clamp(52px,11vw,88px);
  color:var(--gold);font-style:italic;
  letter-spacing:.06em;font-weight:400;
  margin-bottom:12px;animation:fadeDown 1s ease both;
}
.hero-sub{
  font-family:var(--mono);font-size:9px;
  letter-spacing:.46em;color:var(--dim);
  margin-bottom:36px;animation:fadeDown 1s ease .1s both;
}
.hero-desc{
  font-family:var(--jp);font-size:15px;font-weight:200;
  color:var(--muted);line-height:2.4;
  max-width:440px;margin:0 auto 44px;
  letter-spacing:.06em;animation:fadeUp 1s ease .2s both;
}
.hero-meta{
  font-family:var(--mono);font-size:9px;letter-spacing:.18em;
  color:var(--dim);display:flex;gap:20px;flex-wrap:wrap;
  justify-content:center;margin-bottom:44px;
  animation:fadeUp 1s ease .3s both;
}
.hero-meta span::before{content:"— ";}

/* ── buttons ── */
.btn{
  background:transparent;cursor:pointer;
  font-family:var(--mono);transition:all .22s ease;
  outline:none;
}
.btn-primary{
  border:1px solid var(--gold);color:var(--gold);
  font-size:9px;letter-spacing:.4em;
  padding:16px 36px;
}
.btn-primary:hover{
  background:rgba(184,156,64,.09);
  border-color:var(--gold2);color:var(--gold2);
}
.btn-ghost{
  border:1px solid var(--border2);color:var(--dim);
  font-size:9px;letter-spacing:.24em;padding:14px 26px;
}
.btn-ghost:hover{border-color:var(--border);color:var(--muted);}

/* ── quiz ── */
.q-wrap{padding:52px 0 48px;animation:fadeUp .4s cubic-bezier(.16,1,.3,1) both;}
.q-prog{
  width:100%;height:1px;
  background:var(--border3);margin-bottom:6px;overflow:hidden;
}
.q-fill{height:100%;background:var(--gold);opacity:.5;transition:width .45s ease;}
.q-meta{
  font-family:var(--mono);font-size:9px;color:var(--dim);
  letter-spacing:.18em;display:flex;justify-content:space-between;
  margin-bottom:48px;
}
.q-num{
  font-family:var(--mono);font-size:8px;color:var(--gold-dim);
  letter-spacing:.46em;margin-bottom:18px;
}
.q-text{
  font-family:var(--serif);font-style:italic;
  font-size:clamp(22px,4.5vw,30px);
  line-height:1.75;color:var(--parch);
  margin-bottom:10px;font-weight:400;
  letter-spacing:.01em;
}
.q-sub{
  font-family:var(--mono);font-size:9px;color:var(--dim);
  letter-spacing:.16em;margin-bottom:38px;
}
.opt{
  display:block;width:100%;text-align:left;
  background:transparent;border:1px solid var(--border2);
  padding:18px 22px;cursor:pointer;
  font-family:var(--jp);font-size:15px;font-weight:200;
  color:var(--muted);line-height:1.75;
  letter-spacing:.04em;margin-bottom:10px;
  transition:all .18s ease;position:relative;
  min-height:56px;
}
.opt::before{
  content:'';position:absolute;left:0;top:0;bottom:0;width:2px;
  background:var(--gold);transform:scaleY(0);
  transition:transform .18s ease;transform-origin:top;
}
.opt:hover{
  border-color:rgba(184,156,64,.35);
  color:var(--parch);background:rgba(184,156,64,.04);
}
.opt:hover::before{transform:scaleY(1);}

/* ── analyzing ── */
.analyzing{padding:90px 0;text-align:center;animation:fadeIn .4s ease;}
.ana-label{
  font-family:var(--mono);font-size:8px;color:var(--gold);
  letter-spacing:.38em;margin-bottom:30px;
}
.dots{display:inline-flex;gap:6px;margin-bottom:34px;}
.dot{
  width:5px;height:5px;background:var(--gold);
  border-radius:50%;animation:blink 1.2s ease-in-out infinite;
}
.dot:nth-child(2){animation-delay:.22s;}
.dot:nth-child(3){animation-delay:.44s;}
.step-txt{
  font-family:var(--jp);font-size:13px;font-weight:200;
  letter-spacing:.08em;margin-bottom:10px;
  transition:color .4s ease;
}

/* ── result top ── */
.result-top{
  padding:48px 0 24px;
  animation:fadeUp .6s ease both;
}
.r-label{
  font-family:var(--mono);font-size:8px;letter-spacing:.44em;
  color:var(--gold-dim);margin-bottom:10px;
}
.type-name{
  font-family:var(--serif);font-style:italic;
  font-size:clamp(32px,7vw,52px);font-weight:400;
  margin-bottom:8px;line-height:1.15;
}
.type-code{
  font-family:var(--mono);font-size:10px;
  letter-spacing:.44em;color:var(--dim);margin-bottom:22px;
}
.type-desc{
  font-family:var(--jp);font-size:15px;font-weight:200;
  color:var(--muted);line-height:2.3;
  letter-spacing:.04em;margin-bottom:6px;
}
.type-quote{
  font-family:var(--serif);font-style:italic;
  font-size:clamp(14px,3vw,18px);color:var(--muted);
  line-height:1.95;
  border-left:1px solid rgba(184,156,64,.45);
  padding-left:20px;
}

/* ── section label ── */
.sec{
  font-family:var(--mono);font-size:8px;letter-spacing:.44em;
  color:var(--gold-dim);margin-bottom:20px;
  display:flex;align-items:center;gap:12px;
}
.sec::before,.sec::after{
  content:'';flex:1;height:1px;
  background:linear-gradient(90deg,transparent,var(--border));
  opacity:.5;
}
.sec::after{
  background:linear-gradient(90deg,var(--border),transparent);
}

/* ── section wrapper ── */
.sec-block{margin-bottom:var(--section-gap);}

/* ── section intro text ── */
.sec-intro{
  font-family:var(--jp);font-size:13px;font-weight:200;
  color:var(--dim);margin-bottom:22px;
  line-height:2.0;letter-spacing:.04em;
}

/* ── philosopher card ── */
.pc{
  background:var(--surface);
  border:1px solid var(--border2);
  padding:var(--card-pad);
  margin-bottom:10px;cursor:pointer;
  transition:border-color .2s,background .2s;
  animation:fadeUp .5s ease both;position:relative;
}
.pc::before{
  content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(184,156,64,.3),transparent);
  opacity:0;transition:opacity .2s;
}
.pc:hover{
  border-color:rgba(184,156,64,.3);
  background:rgba(255,255,255,.038);
}
.pc:hover::before{opacity:1;}
.pc-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;}
.pc-pct{
  font-family:var(--mono);font-size:26px;color:var(--gold);
  font-weight:700;letter-spacing:-.03em;line-height:1;
  margin-bottom:6px;
}
.pc-name{
  font-family:var(--serif);font-style:italic;font-size:18px;
  color:var(--parch);font-weight:400;
}
.pc-en{
  font-family:var(--mono);font-size:8px;color:var(--dim);
  letter-spacing:.14em;margin-top:3px;
}
.pc-label-tag{
  display:inline-block;font-family:var(--mono);
  font-size:7px;letter-spacing:.12em;
  border:1px solid;padding:3px 9px;margin-top:10px;
}
.pc-toggle{
  font-family:var(--mono);font-size:9px;color:var(--dim);
  letter-spacing:.1em;padding-top:4px;flex-shrink:0;
  transition:color .18s;
}
.pc:hover .pc-toggle{color:var(--muted);}
.pc-body{animation:fadeUp .28s ease both;padding-top:6px;}
.pc-desc{
  font-family:var(--jp);font-size:13px;font-weight:200;
  color:var(--muted);line-height:2.0;margin-top:12px;
  letter-spacing:.04em;
}
.pc-quote-txt{
  font-family:var(--serif);font-style:italic;font-size:13px;
  color:var(--dim);margin-top:12px;line-height:1.85;
}
.pc-books{
  margin-top:14px;padding-top:13px;
  border-top:1px solid var(--border3);
}
.pc-blabel{
  font-family:var(--mono);font-size:7px;color:var(--dim);
  letter-spacing:.22em;margin-bottom:8px;
}
.pc-book-row{
  font-family:var(--jp);font-size:13px;font-weight:300;
  color:var(--muted);padding:4px 0;
  display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;
}
.pc-book-row::before{
  content:'—';color:var(--dim);
  font-family:var(--mono);font-size:9px;flex-shrink:0;
}
.tag-row{margin-top:12px;display:flex;flex-wrap:wrap;gap:4px;}
.tag{
  display:inline-block;font-family:var(--mono);font-size:7px;
  letter-spacing:.11em;color:var(--dim);
  border:1px solid var(--border2);padding:3px 8px;
}

/* ── radar ── */
.radar-wrap{height:280px;margin:0 auto;}

/* ── lineage (old) ── */
.ln-node{display:flex;align-items:center;gap:12px;padding:10px 0;}
.ln-dot{
  width:6px;height:6px;border-radius:50%;
  background:var(--border);flex-shrink:0;
}
.ln-dot.you{background:var(--gold);box-shadow:0 0 8px rgba(184,156,64,.5);}
.ln-node.you{color:var(--gold);}
.ln-name{
  font-family:var(--mono);font-size:10px;
  letter-spacing:.1em;color:var(--muted);
}
.ln-note{font-family:var(--jp);font-size:11px;color:var(--dim);}
.ln-arrow{
  font-family:var(--mono);font-size:10px;
  color:var(--dim);padding:4px 0 4px 16px;
}

/* ── share card ── */
.share-card{
  background:var(--bg2);
  border:1px solid rgba(184,156,64,.28);
  padding:28px 28px 22px;position:relative;
}
.share-card::after{
  content:'SOKRATES';position:absolute;top:11px;right:14px;
  font-family:var(--mono);font-size:7px;
  letter-spacing:.38em;color:rgba(184,156,64,.14);
}

/* ── footer ── */
.footer{
  padding:52px 0 36px;text-align:center;
  font-family:var(--mono);font-size:7px;
  color:var(--dim2);letter-spacing:.22em;
  position:relative;z-index:10;
}

/* ── 対立哲学者 ── */
.opp-card{
  background:rgba(200,80,80,.018);
  border:1px solid rgba(180,70,70,.16);
  padding:var(--card-pad);margin-bottom:10px;
  position:relative;animation:fadeUp .5s ease both;
}
.opp-card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(180,80,80,.28),transparent);
}
.opp-rank{
  font-family:var(--mono);font-size:7px;
  color:rgba(180,100,100,.55);letter-spacing:.32em;margin-bottom:8px;
}
.opp-name{
  font-family:var(--serif);font-style:italic;font-size:18px;
  color:rgba(220,168,168,.88);margin-bottom:3px;font-weight:400;
}
.opp-en{
  font-family:var(--mono);font-size:8px;
  color:rgba(220,168,168,.35);letter-spacing:.12em;margin-bottom:12px;
}
.opp-label{
  display:inline-block;font-family:var(--mono);font-size:7px;
  letter-spacing:.1em;border:1px solid rgba(180,80,80,.25);
  color:rgba(200,130,130,.68);padding:3px 9px;margin-bottom:12px;
}
.opp-desc{
  font-family:var(--jp);font-size:13px;font-weight:200;
  color:rgba(220,168,168,.55);line-height:2.0;letter-spacing:.04em;
}
.opp-reason{
  font-family:var(--jp);font-size:12px;font-weight:200;
  color:rgba(190,130,130,.5);line-height:1.9;
  margin-top:10px;padding-top:10px;
  border-top:1px solid rgba(180,80,80,.1);
  letter-spacing:.04em;
}

/* ── 思想マップ ── */
.thought-map{position:relative;width:100%;margin:0 auto;}
.map-svg-wrap{
  position:relative;width:100%;padding-bottom:100%;
  max-width:520px;margin:0 auto;
}
.map-svg-wrap svg{position:absolute;top:0;left:0;width:100%;height:100%;}
.map-axis-label{
  font-family:var(--mono);font-size:7px;
  fill:rgba(221,208,176,.32);letter-spacing:.15em;
}
.map-phil-name{
  font-family:var(--mono);font-size:7px;
  fill:rgba(221,208,176,.52);letter-spacing:.06em;
}
.map-you-label{
  font-family:var(--mono);font-size:8px;
  fill:var(--gold);letter-spacing:.12em;
}
.map-caption{
  font-family:var(--mono);font-size:8px;color:var(--dim2);
  letter-spacing:.18em;text-align:center;margin-top:14px;
  display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;
}

/* ── 次に読む ── */
.next-read-card{
  background:rgba(184,156,64,.025);
  border:1px solid rgba(184,156,64,.18);
  padding:var(--card-pad);margin-bottom:10px;
  animation:fadeUp .5s ease both;position:relative;
}
.next-read-card::before{
  content:'NEXT';position:absolute;top:11px;right:16px;
  font-family:var(--mono);font-size:6px;
  letter-spacing:.38em;color:rgba(184,156,64,.18);
}
.nr-phil{
  font-family:var(--serif);font-style:italic;
  font-size:22px;color:var(--gold);
  margin-bottom:5px;font-weight:400;
}
.nr-book{
  font-family:var(--jp);font-size:14px;font-weight:300;
  color:var(--muted);margin-bottom:8px;
}
.nr-reason{
  font-family:var(--jp);font-size:13px;font-weight:200;
  color:var(--dim);line-height:2.0;
  letter-spacing:.04em;margin-bottom:14px;
}
.nr-meta{display:flex;gap:10px;flex-wrap:wrap;}
.nr-tag{
  font-family:var(--mono);font-size:7px;
  letter-spacing:.12em;border:1px solid var(--border2);
  color:var(--dim);padding:4px 10px;
}
.nr-tag-gold{
  border-color:rgba(184,156,64,.3);
  color:rgba(184,156,64,.75);
}

/* ── 思想系譜タイムライン ── */
.lineage-timeline{padding:8px 0 24px;animation:fadeUp .5s ease both;}
.lt-item{
  display:flex;gap:20px;margin-bottom:0;position:relative;
}
.lt-item::before{
  content:'';position:absolute;left:9px;top:24px;bottom:-24px;
  width:1px;background:rgba(184,156,64,.11);
}
.lt-item:last-child::before{display:none;}
.lt-left{
  display:flex;flex-direction:column;
  align-items:center;flex-shrink:0;padding-top:4px;
}
.lt-dot{
  width:19px;height:19px;border-radius:50%;
  border:1px solid rgba(184,156,64,.25);
  background:var(--bg);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.lt-dot-inner{
  width:5px;height:5px;border-radius:50%;
  background:rgba(184,156,64,.45);
}
.lt-dot.you-dot{
  border-color:var(--gold);
  animation:pulseGold 2.5s ease-in-out infinite;
}
.lt-dot.you-dot .lt-dot-inner{background:var(--gold);}
.lt-spacer{
  width:1px;flex:1;
  background:rgba(184,156,64,.09);min-height:24px;
}
.lt-right{padding:0 0 30px 0;flex:1;}
.lt-period{
  font-family:var(--mono);font-size:7px;color:var(--dim2);
  letter-spacing:.2em;margin-bottom:4px;
}
.lt-name{
  font-family:var(--serif);font-style:italic;font-size:17px;
  color:var(--muted);margin-bottom:4px;font-weight:400;
}
.lt-name.you-name{color:var(--gold);}
.lt-label{
  font-family:var(--mono);font-size:7px;
  letter-spacing:.1em;color:var(--dim);
  border:1px solid var(--border2);
  display:inline-block;padding:2px 8px;margin-bottom:7px;
}
.lt-desc{
  font-family:var(--jp);font-size:12px;font-weight:200;
  color:rgba(221,208,176,.32);line-height:1.85;letter-spacing:.03em;
}

/* ── responsive ── */
@media(max-width:600px){
  .content,.site-header{padding:0 20px;}
  :root{--section-gap:44px;--card-pad:18px 18px;}
  .q-text{font-size:20px !important;}
  .opt{padding:16px 16px;font-size:14px;min-height:52px;}
  .hero-desc{font-size:14px;}
  .hero-meta{gap:14px;font-size:8px;}
  .pc-name{font-size:16px;}
  .type-name{font-size:clamp(28px,7vw,40px);}
  .map-svg-wrap{max-width:100%;}
  .q-wrap{padding:40px 0 36px;}
  .divider{margin:20px 0;}
  .btn-primary{padding:16px 28px;}
}
@media(max-width:360px){
  .content,.site-header{padding:0 16px;}
  .q-text{font-size:18px !important;}
  .opt{font-size:13px;}
}
`;

// ───────────────────────────────────────────────────────────────
//  COMPONENTS
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
          <span>思想マップ</span>
          <span>次の哲学者</span>
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
      <div className="q-prog">
        <div className="q-fill" style={{ width: pct + "%" }} />
      </div>
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
  }, []); // eslint-disable-line
  return (
    <div className="content analyzing">
      <p className="ana-label">ANALYZING</p>
      <div className="dots">
        <div className="dot"/><div className="dot"/><div className="dot"/>
      </div>
      {steps.map((s, i) => (
        <p key={s} className="step-txt" style={{ color: i <= step ? "rgba(212,197,160,.65)" : "rgba(212,197,160,.14)" }}>
          {s}
        </p>
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
          <div className="pc-label-tag" style={{ color: phil.color, borderColor: (phil.color || "#888") + "55" }}>
            {phil.label}
          </div>
        </div>
        <span style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--dim)", letterSpacing:".1em", paddingTop:4 }}>
          {open ? "▲" : "▼"}
        </span>
      </div>
      {open && (
        <div className="pc-body">
          <p className="pc-desc">{phil.desc}</p>
          <p className="pc-quote-txt">「{phil.quote}」</p>
          <div className="pc-books">
            <p className="pc-blabel">READING PATH</p>
            {phil.beginnerBook && (
              <div className="pc-book-row">
                <span>{phil.beginnerBook.title}</span>
                {phil.beginnerBook.author && (
                  <span style={{ fontSize:12, color:"var(--dim)" }}>— {phil.beginnerBook.author}</span>
                )}
              </div>
            )}
            {phil.mainWork && (
              <div className="pc-book-row" style={{ opacity:.7 }}>
                <span>{phil.mainWork}（主著）</span>
              </div>
            )}
          </div>
          {(phil.tags || []).length > 0 && (
            <div className="tag-row">
              {phil.tags.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LineageViz({ topPhil }) {
  if (!topPhil) return null;
  const sources    = (topPhil.lineage    || []).map(id => PHILOSOPHERS.find(p => p.id === id)).filter(Boolean);
  const influenced = (topPhil.influenced || []).map(id => PHILOSOPHERS.find(p => p.id === id)).filter(Boolean);
  return (
    <div style={{ marginBottom:36 }}>
      {sources.length > 0 && (
        <>
          <p style={{ fontFamily:"var(--mono)", fontSize:7, color:"var(--dim)", letterSpacing:".2em", marginBottom:10 }}>INFLUENCED BY</p>
          {sources.map(s => (
            <div key={s.id} className="ln-node">
              <div className="ln-dot" />
              <span className="ln-name">{s.name}</span>
              <span className="ln-note">— {s.label}</span>
            </div>
          ))}
          <div className="ln-arrow">↓</div>
        </>
      )}
      <div className="ln-node you">
        <div className="ln-dot you" />
        <span className="ln-name" style={{ color:"var(--gold)" }}>{topPhil.name}</span>
        <span style={{ fontFamily:"var(--jp)", fontSize:9, color:"rgba(184,156,64,.55)" }}>← あなたの近傍</span>
      </div>
      {influenced.length > 0 && (
        <>
          <div className="ln-arrow">↓</div>
          <p style={{ fontFamily:"var(--mono)", fontSize:7, color:"var(--dim)", letterSpacing:".2em", margin:"4px 0 10px" }}>INFLUENCED</p>
          {influenced.slice(0,4).map(s => (
            <div key={s.id} className="ln-node">
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


// ── 新機能①: 対立する哲学者 ──
function OpposingPhilosophers({ scores }) {
  const opposing = useMemo(() => findOpposingPhilosophers(scores), [scores]);
  return (
    <div style={{ marginBottom:36 }}>
      <p className="sec">OPPOSING THOUGHT</p>
      <p style={{ fontFamily:"var(--jp)", fontSize:13, color:"var(--dim)", marginBottom:20, fontWeight:200, lineHeight:1.9, letterSpacing:".04em" }}>
        あなたの思想と最も距離のある哲学者です。対立する視点を知ることで、自分の思想の輪郭が明確になります。
      </p>
      {opposing.map((phil, i) => {
        if (!phil) return null;
        const reason = getOppositionReason(scores, phil);
        return (
          <div key={phil.id} className="opp-card" style={{ animationDelay: (i * 0.08) + "s" }}>
            <p className="opp-rank">OPPOSING · {["01","02","03"][i]}</p>
            <p className="opp-name">{phil.name}</p>
            <p className="opp-en">{phil.nameEn} · {phil.period}</p>
            <span className="opp-label">{phil.label}</span>
            <p className="opp-desc">{phil.desc}</p>
            <p className="opp-reason">{reason}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── 新機能②: 思想マップ (SVGベース) ──
function ThoughtMap({ scores, matched }) {
  const userCoord = useMemo(() => calcMapCoords(scores), [scores]);
  const mapPhils = useMemo(() => {
    return PHILOSOPHERS.filter(p => typeof p.mapX === "number" && typeof p.mapY === "number").slice(0, 10);
  }, []);
  const toSVG = (x, y, size) => ({
    cx: size * 0.5 + x * size * 0.42,
    cy: size * 0.5 - y * size * 0.42,
  });
  const SIZE = 300;
  const center = SIZE / 2;
  const r = SIZE * 0.42;
  const userSVG = toSVG(userCoord.x, userCoord.y, SIZE);
  const topPhilIds = new Set((matched || []).slice(0,3).map(p => p.id));
  return (
    <div style={{ marginBottom:36 }}>
      <p className="sec">THOUGHT COORDINATE MAP</p>
      <p style={{ fontFamily:"var(--jp)", fontSize:13, color:"var(--dim)", marginBottom:20, fontWeight:200, lineHeight:1.9, letterSpacing:".04em" }}>
        横軸：個人主義 ←→ 社会重視　　縦軸：虚無 ←→ 超越
      </p>
      <div className="thought-map">
        <div className="map-svg-wrap">
          <svg viewBox={"0 0 " + SIZE + " " + SIZE} xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width={SIZE-2} height={SIZE-2} fill="none" stroke="rgba(168,144,58,.08)" strokeWidth="1"/>
            <line x1={center} y1={0} x2={center} y2={SIZE} stroke="rgba(168,144,58,.10)" strokeWidth="0.5"/>
            <line x1={0} y1={center} x2={SIZE} y2={center} stroke="rgba(168,144,58,.10)" strokeWidth="0.5"/>
            {[-0.5, 0.5].map(g => {
              const gx = center + g * r;
              const gy = center + g * r;
              return (
                <g key={g}>
                  <line x1={gx} y1={0} x2={gx} y2={SIZE} stroke="rgba(168,144,58,.04)" strokeWidth="0.5"/>
                  <line x1={0} y1={gy} x2={SIZE} y2={gy} stroke="rgba(168,144,58,.04)" strokeWidth="0.5"/>
                </g>
              );
            })}
            <text x={center} y={12} textAnchor="middle" className="map-axis-label">超越</text>
            <text x={center} y={SIZE-4} textAnchor="middle" className="map-axis-label">虚無</text>
            <text x={6} y={center+4} textAnchor="start" className="map-axis-label">社会</text>
            <text x={SIZE-6} y={center+4} textAnchor="end" className="map-axis-label">個人</text>
            {mapPhils.map(p => {
              const sv = toSVG(p.mapX || 0, p.mapY || 0, SIZE);
              const cx = sv.cx, cy = sv.cy;
              const isTop = topPhilIds.has(p.id);
              const col = p.color || "#888";
              const opacity = isTop ? 0.85 : 0.38;
              const labelX = cx + (p.mapX > 0 ? 6 : -6);
              const labelAnchor = p.mapX > 0 ? "start" : "end";
              return (
                <g key={p.id}>
                  {isTop && (
                    <circle cx={cx} cy={cy} r={8} fill="none" stroke={col} strokeWidth="0.5" opacity="0.3"/>
                  )}
                  <circle cx={cx} cy={cy} r={isTop ? 4 : 2.5} fill={col} opacity={opacity}/>
                  <text x={labelX} y={cy - 5} textAnchor={labelAnchor} className="map-phil-name"
                    opacity={opacity}
                    style={{ fill: isTop ? col : "rgba(212,197,160,.4)" }}>
                    {p.nameEn ? p.nameEn.split(" ").pop() : p.name}
                  </text>
                </g>
              );
            })}
            <circle cx={userSVG.cx} cy={userSVG.cy} r={14} fill="none" stroke="rgba(168,144,58,.2)" strokeWidth="0.5"/>
            <circle cx={userSVG.cx} cy={userSVG.cy} r={6} fill="none" stroke="rgba(168,144,58,.6)" strokeWidth="1"/>
            <circle cx={userSVG.cx} cy={userSVG.cy} r={2.5} fill="var(--gold)"/>
            <text x={userSVG.cx} y={userSVG.cy - 14} textAnchor="middle" className="map-you-label">YOU</text>
          </svg>
        </div>
        <div className="map-caption">
          <span>● あなたの座標</span>
          <span>● 近傍哲学者（強調）</span>
          <span>● その他の哲学者</span>
        </div>
      </div>
    </div>
  );
}

// ── 新機能③: 次に読むべき哲学者 ──
function NextReadSection({ topPhil }) {
  if (!topPhil || !topPhil.nextRead) return null;
  const nr = topPhil.nextRead;
  const nextPhil = PHILOSOPHERS.find(p => p.id === nr.philosopherId);
  return (
    <div style={{ marginBottom:36 }}>
      <p className="sec">NEXT PHILOSOPHER</p>
      <p style={{ fontFamily:"var(--jp)", fontSize:13, color:"var(--dim)", marginBottom:20, fontWeight:200, lineHeight:1.9, letterSpacing:".04em" }}>
        あなたの近傍哲学者「{topPhil.name}」から、思想的につながる次の人物を推薦します。
      </p>
      <div className="next-read-card">
        <p style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--dim)", letterSpacing:".28em", marginBottom:12 }}>RECOMMENDED</p>
        <p className="nr-phil">{nr.philosopher}</p>
        {nextPhil && (
          <p style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--dim)", letterSpacing:".14em", marginBottom:10 }}>
            {nextPhil.nameEn} · {nextPhil.period}
          </p>
        )}
        <p className="nr-book">
          <span style={{ fontFamily:"var(--mono)", fontSize:8, color:"rgba(184,156,64,.6)", letterSpacing:".14em", marginRight:10 }}>BOOK</span>
          {nr.recommendedBook}
        </p>
        <p className="nr-reason">{nr.reason}</p>
        <div className="nr-meta">
          <span className={"nr-tag" + (nr.difficulty === "Hard" ? " nr-tag-gold" : "")}>
            DIFFICULTY · {nr.difficulty}
          </span>
          {nextPhil && nextPhil.label && (
            <span className="nr-tag">{nextPhil.label}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 新機能④: 思想系譜タイムライン ──
function LineageTimeline({ topPhil }) {
  if (!topPhil) return null;
  const buildChain = (phil) => {
    const chain = [];
    const influenceIds = phil.influences || phil.lineage || [];
    influenceIds.slice(0, 2).forEach(id => {
      const p = PHILOSOPHERS.find(x => x.id === id);
      if (p) chain.push({ ...p, role: "influence" });
    });
    chain.push({ ...phil, role: "you" });
    const nextIds = phil.nextThinkers || phil.influenced || [];
    nextIds.slice(0, 2).forEach(id => {
      const p = PHILOSOPHERS.find(x => x.id === id);
      if (p) chain.push({ ...p, role: "next" });
    });
    return chain;
  };
  const chain = buildChain(topPhil);
  return (
    <div style={{ marginBottom:36 }}>
      <p className="sec">THOUGHT LINEAGE TIMELINE</p>
      <p style={{ fontFamily:"var(--jp)", fontSize:13, color:"var(--dim)", marginBottom:28, fontWeight:200, lineHeight:1.9, letterSpacing:".04em" }}>
        {topPhil.name}の思想が生まれた系譜と、その後の展開です。この縦線を辿ることが、次の探求の糸口になります。
      </p>
      <div className="lineage-timeline">
        {chain.map((item, i) => {
          const isYou = item.role === "you";
          const isLast = i === chain.length - 1;
          return (
            <div key={item.id + "_" + i} className="lt-item">
              <div className="lt-left">
                <div className={"lt-dot" + (isYou ? " you-dot" : "")}>
                  <div className="lt-dot-inner"/>
                </div>
                {!isLast && <div className="lt-spacer"/>}
              </div>
              <div className="lt-right">
                <p className="lt-period">{item.period}</p>
                <p className={"lt-name" + (isYou ? " you-name" : "")}>{item.name}</p>
                <span className="lt-label" style={{ borderColor: (item.color || "#888") + "40", color: isYou ? "var(--gold)" : "var(--dim)" }}>
                  {item.label}
                </span>
                {isYou ? (
                  <p className="lt-desc" style={{ color:"rgba(184,156,64,.55)", marginTop:4 }}>← あなたの思想的近傍</p>
                ) : (
                  <p className="lt-desc">{(item.desc || "").slice(0, 60)}…</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultScreen({ answers, onRestart }) {
  const scores  = useMemo(() => calcScores(answers), [answers]);
  const type    = useMemo(() => resolveType(scores), [scores]);
  const matched = useMemo(() => matchPhilosophers(scores), [scores]);
  const topPhil = matched[0] || null;
  const radar   = useMemo(() => toRadar(scores), [scores]);

  const shareText = useMemo(() => {
    if (!type) return "";
    const ns = matched.slice(0,3).map(p => p.name + " " + (p.pct||0) + "%").join(" / ");
    return "思想座標診断「ソクラテス」\n\n" + (type.name||"") + "（" + (type.code||"") + "）\n" + (type.axis||"") + "\n\n近い哲学者: " + ns + "\n\n「" + (type.quote||"") + "」\n\n#ソクラテス診断 #思想座標";
  }, [type, matched]);

  const handleShare = useCallback(() => {
    if (navigator.share) { navigator.share({ text: shareText }).catch(()=>{}); }
    else if (navigator.clipboard) { navigator.clipboard.writeText(shareText).then(()=>alert("コピーしました")).catch(()=>{}); }
  }, [shareText]);

  if (!type) return null;

  return (
    <div className="content" style={{ paddingBottom:80 }}>
      {/* 思想タイプ */}
      <div className="result-top">
        <p className="r-label">THOUGHT TYPE · 思想類型</p>
        <h2 className="type-name" style={{ color: type.color || "var(--gold)" }}>{type.name}</h2>
        <p className="type-code">{type.code} · {type.axis}</p>
        <p className="type-desc">{type.desc}</p>
      </div>

      <div className="divider" />

      {/* 思想座標 */}
      <div style={{ marginBottom:48 }}>
        <p className="sec">THOUGHT COORDINATE</p>
        <div className="radar-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radar} margin={{ top:10, right:32, left:32, bottom:10 }}>
              <PolarGrid stroke="rgba(184,156,64,.12)" />
              <PolarAngleAxis dataKey="axis" tick={{ fill:"rgba(221,208,176,.55)", fontSize:11, fontFamily:"'DM Mono',monospace" }} />
              <Radar name="思想座標" dataKey="value" stroke="rgba(184,156,64,.8)" fill="rgba(184,156,64,.12)" strokeWidth={1.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="divider" />

      {/* 哲学者マッチング */}
      <div style={{ marginBottom:48 }}>
        <p className="sec">PHILOSOPHER MATCH</p>
        <p style={{ fontFamily:"var(--jp)", fontSize:13, color:"var(--dim)", marginBottom:18, fontWeight:200, lineHeight:1.9, letterSpacing:".04em" }}>
          あなたの思想座標に近い哲学者です。クリックで詳細・読書案内を確認できます。
        </p>
        {matched.map((p, i) => <PhilCard key={p.id} phil={p} delay={i * 0.07} />)}
      </div>

      <div className="divider" />

      {/* 引用 */}
      <div style={{ marginBottom:48 }}>
        <p className="sec">QUOTATION</p>
        <blockquote className="type-quote">{type.quote}</blockquote>
        {topPhil && (
          <p style={{ fontFamily:"var(--mono)", fontSize:10, color:"var(--dim)", marginTop:12, letterSpacing:".14em" }}>
            {topPhil.name} · {topPhil.period}
          </p>
        )}
      </div>

      <div className="divider" />

      {/* 思想マップ（新機能②）*/}
      <ThoughtMap scores={scores} matched={matched} />

      <div className="divider" />

      {/* 対立する哲学者（新機能①）*/}
      <OpposingPhilosophers scores={scores} />

      <div className="divider" />

      {/* 次に読むべき哲学者（新機能③）*/}
      {topPhil && <NextReadSection topPhil={topPhil} />}

      {topPhil && <div className="divider" />}

      {/* 思想系譜タイムライン（新機能④）*/}
      {topPhil && <LineageTimeline topPhil={topPhil} />}

      <div className="divider" />

      {/* シェアカード */}
      <div style={{ marginBottom:48 }}>
        <p className="sec">SHARE</p>
        <div className="share-card">
          <p style={{ fontFamily:"var(--mono)", fontSize:8, color:"var(--dim)", letterSpacing:".28em", marginBottom:14 }}>
            SOKRATES · THOUGHT COORDINATE ANALYSIS
          </p>
          <p style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontSize:26, color: type.color || "var(--gold)", marginBottom:4 }}>
            {type.name}
          </p>
          <p style={{ fontFamily:"var(--mono)", fontSize:9, color:"var(--dim)", letterSpacing:".2em", marginBottom:14 }}>
            {type.code} · {type.axis}
          </p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:14, marginBottom:14 }}>
            {matched.slice(0,3).map(p => (
              <span key={p.id} style={{ fontFamily:"var(--mono)", fontSize:9 }}>
                <span style={{ color:"var(--gold)" }}>{p.pct}%</span>
                <span style={{ color:"var(--dim)", marginLeft:5 }}>{(p.nameEn || "").split(" ").pop()}</span>
              </span>
            ))}
          </div>
          <p style={{ fontFamily:"var(--serif)", fontStyle:"italic", fontSize:14, color:"var(--muted)", lineHeight:1.85 }}>
            「{type.quote}」
          </p>
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
      <div className="noise-layer" />
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
            <div style={{ paddingTop:28, fontFamily:"var(--serif)", fontStyle:"italic", fontSize:16, color:"rgba(184,156,64,.38)", letterSpacing:".1em" }}>
              ソクラテス
            </div>
            <QuestionCard
              key={currentQ ? currentQ.id : qIndex}
              question={currentQ}
              qIndex={qIndex}
              total={QUESTIONS.length}
              onAnswer={handleAnswer}
            />
          </div>
        )}
        {phase === "analyzing" && <AnalyzingScreen />}
        {phase === "result"    && <ResultScreen answers={answers} onRestart={handleRestart} />}
        {phase !== "quiz"      && (
          <footer className="footer">SOKRATES · THOUGHT COORDINATE ARCHIVE</footer>
        )}
      </div>
    </>
  );
}