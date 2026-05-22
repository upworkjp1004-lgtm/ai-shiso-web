// ═══════════════════════════════════════════════════════════════
//  AI思想チェッカー — v5.0 UI Refined
//  Vite React · ロジック完全保持 · UI/アニメーション全面刷新
// ═══════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useCallback } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";

// ───────────────────────────────────────────────────────────────
//  データ・ロジック（前バージョンから完全保持）
// ───────────────────────────────────────────────────────────────
// ── 質問ツリー
// 各optionの nextId で次の質問を指定。
// null = 診断終了（runDiagnosisへ）
// branch軸: freedom / loneliness / nihilism / community / idealism
const Q_TREE = {
  // ══ LAYER 0: 入口（固定2問） ══════════════════════════════
  "root": {
    id:"root", layer:0,
    text:"努力できるって、才能だと思う？",
    reaction: null,
    options:[
      { label:"思う",               scores:{ idealism:-2, realism:+3, nihilism:+1 },  nextId:"q_freedom" },
      { label:"思わない",           scores:{ idealism:+3, freedom:+1 },               nextId:"q_freedom" },
      { label:"どちらともいえない",  scores:{ logic:+2, realism:+1 },                  nextId:"q_freedom" },
      { label:"才能より環境だと思う",scores:{ realism:+2, community:+2, idealism:-1 }, nextId:"q_freedom" },
    ],
  },

  // ── LAYER 1: 自由軸分岐 ────────────────────────────────
  "q_freedom": {
    id:"q_freedom", layer:1,
    text:"自由と安心、どっちを選ぶ？",
    reaction: null,
    options:[
      { label:"自由",            scores:{ freedom:+4, stability:-2, nihilism:+1 },  nextId:"q_lone_hi" },
      { label:"安心",            scores:{ stability:+4, freedom:-2, community:+1 }, nextId:"q_lone_lo" },
      { label:"どちらも諦めない", scores:{ idealism:+3, romanticism:+2 },            nextId:"q_ideal"   },
      { label:"どちらもいらない", scores:{ nihilism:+4, loneliness:+2, freedom:+1 }, nextId:"q_nihil"   },
    ],
  },

  // ══ LAYER 2A: 自由高（loneliness 方向） ══════════════════
  "q_lone_hi": {
    id:"q_lone_hi", layer:2,
    text:"一人でいる時間と、人といる時間。どちらがより「自分らしい」と感じる？",
    reaction:"自由を選んだ人は、孤独との関係が鍵になる気がして。",
    options:[
      { label:"一人の時間",             scores:{ loneliness:+4, freedom:+2, community:-2 }, nextId:"q_lone_deep" },
      { label:"人といる時間",           scores:{ community:+3, emotion:+2, loneliness:-1 }, nextId:"q_social"    },
      { label:"どちらも同じくらい必要", scores:{ logic:+2, realism:+1 },                    nextId:"q_tension"   },
      { label:"状況による",             scores:{ realism:+3, stability:+1 },                nextId:"q_tension"   },
    ],
  },

  // ══ LAYER 2B: 安定高（community 方向） ═══════════════════
  "q_lone_lo": {
    id:"q_lone_lo", layer:2,
    text:"誰かと深くつながるとき、どんな感覚が近い？",
    reaction:"なるほど。安心の中身が気になって。",
    options:[
      { label:"守られている感覚",     scores:{ stability:+3, community:+2 },          nextId:"q_social"  },
      { label:"理解されている感覚",   scores:{ emotion:+3, community:+2, logic:-1 },   nextId:"q_social"  },
      { label:"あまり深くつながれない",scores:{ loneliness:+3, nihilism:+1 },          nextId:"q_nihil"   },
      { label:"つながりの感覚がわからない",scores:{ nihilism:+2, realism:+1 },         nextId:"q_nihil"   },
    ],
  },

  // ══ LAYER 2C: 理想主義方向 ════════════════════════════════
  "q_ideal": {
    id:"q_ideal", layer:2,
    text:"「世界はもっと良くなれる」という感覚、今も持っていますか？",
    reaction:"面白いですね。理想と現実の間にいる感じがして。",
    options:[
      { label:"強く持っている",       scores:{ idealism:+4, romanticism:+2 },           nextId:"q_ideal_deep" },
      { label:"持ちたいけど揺れてる", scores:{ idealism:+2, nihilism:+1, emotion:+1 },   nextId:"q_tension"    },
      { label:"あまり持てなくなった", scores:{ nihilism:+2, realism:+2, idealism:-1 },   nextId:"q_nihil"      },
      { label:"最初から持っていない", scores:{ nihilism:+3, realism:+3, idealism:-2 },   nextId:"q_nihil"      },
    ],
  },

  // ══ LAYER 2D: 虚無方向 ═══════════════════════════════════
  "q_nihil": {
    id:"q_nihil", layer:2,
    text:"「意味がない」と感じた瞬間、どうしていますか？",
    reaction:"では次に。少し深い方へ。",
    options:[
      { label:"そのまま受け入れる",         scores:{ nihilism:+4, loneliness:+1 },           nextId:"q_nihil_deep" },
      { label:"別のことに集中する",         scores:{ realism:+2, stability:+2 },              nextId:"q_tension"    },
      { label:"意味を作ろうとする",         scores:{ idealism:+2, freedom:+2, nihilism:-1 },  nextId:"q_ideal_deep" },
      { label:"「意味がない」こと自体が怖い",scores:{ community:+2, emotion:+3, nihilism:-2 }, nextId:"q_social"     },
    ],
  },

  // ══ LAYER 3A: 孤独深化 ════════════════════════════════════
  "q_lone_deep": {
    id:"q_lone_deep", layer:3,
    text:"一人でいることは「選んでいる」感じ？それとも「なってしまっている」感じ？",
    reaction:"孤独と自由が重なる場所を見ている気がして。",
    options:[
      { label:"選んでいる",           scores:{ freedom:+3, loneliness:+2, community:-2 }, nextId:"q_belief" },
      { label:"なってしまっている",   scores:{ loneliness:+3, nihilism:+2, freedom:-1 },  nextId:"q_belief" },
      { label:"最初は選んだが今は慣れ",scores:{ loneliness:+2, realism:+2 },               nextId:"q_belief" },
      { label:"よくわからない",       scores:{ nihilism:+1, realism:+1 },                  nextId:"q_belief" },
    ],
  },

  // ══ LAYER 3B: 社会性深化 ══════════════════════════════════
  "q_social": {
    id:"q_social", layer:3,
    text:"誰かに「理解された」と感じた経験は、あなたの人生にどのくらいある？",
    reaction:"なるほど。人との距離の取り方が見えてきた気がして。",
    options:[
      { label:"何度もある",         scores:{ community:+3, emotion:+2, loneliness:-2 }, nextId:"q_belief" },
      { label:"数えるくらいある",   scores:{ emotion:+1, loneliness:+1 },               nextId:"q_belief" },
      { label:"ほとんどない",       scores:{ loneliness:+3, nihilism:+1, community:-2 }, nextId:"q_belief" },
      { label:"理解されたくない",   scores:{ freedom:+2, loneliness:+2, community:-3 },  nextId:"q_belief" },
    ],
  },

  // ══ LAYER 3C: 矛盾・緊張 ══════════════════════════════════
  "q_tension": {
    id:"q_tension", layer:3,
    text:"自分の中に、矛盾した価値観が同時に存在していると感じますか？",
    reaction:"興味深いですね。葛藤の場所が見えてきた。",
    options:[
      { label:"常にある",         scores:{ emotion:+2, idealism:+1, nihilism:+1 },       nextId:"q_belief" },
      { label:"たまにある",       scores:{ logic:+2, realism:+1 },                        nextId:"q_belief" },
      { label:"あまり感じない",   scores:{ logic:+3, stability:+2, nihilism:-1 },          nextId:"q_belief" },
      { label:"矛盾があるのが普通",scores:{ realism:+2, romanticism:+1 },                  nextId:"q_belief" },
    ],
  },

  // ══ LAYER 3D: 理想深化 ════════════════════════════════════
  "q_ideal_deep": {
    id:"q_ideal_deep", layer:3,
    text:"理想を持ち続けることは、時として苦しくなりますか？",
    reaction:"理想主義の裏側を少し見てみたくて。",
    options:[
      { label:"なる。でも手放せない",  scores:{ idealism:+3, romanticism:+2, nihilism:+1 }, nextId:"q_belief" },
      { label:"苦しさより充実感が大きい",scores:{ idealism:+4, emotion:+2 },                nextId:"q_belief" },
      { label:"だから現実的になろうとしている",scores:{ realism:+3, idealism:-1 },          nextId:"q_belief" },
      { label:"苦しくなったので理想を捨てた",  scores:{ nihilism:+3, realism:+3, idealism:-3 }, nextId:"q_belief" },
    ],
  },

  // ══ LAYER 3E: 虚無深化 ════════════════════════════════════
  "q_nihil_deep": {
    id:"q_nihil_deep", layer:3,
    text:"「意味がない」という感覚は、あなたを軽くしますか？それとも重くしますか？",
    reaction:"そこが核心に近い気がして。",
    options:[
      { label:"軽くする",       scores:{ nihilism:+3, freedom:+2, loneliness:+1 },   nextId:"q_belief" },
      { label:"重くする",       scores:{ nihilism:+2, loneliness:+3, emotion:+1 },   nextId:"q_belief" },
      { label:"どちらでもある", scores:{ nihilism:+2, realism:+2 },                  nextId:"q_belief" },
      { label:"まだわからない", scores:{ nihilism:+1, idealism:+1 },                  nextId:"q_belief" },
    ],
  },

  // ══ LAYER 4: 全分岐の終端（共通2問） ════════════════════════
  "q_belief": {
    id:"q_belief", layer:4,
    text:"誰にも理解されなくても、自分の信念は貫く？",
    reaction:"最後に、一番核になるところを聞かせてください。",
    options:[
      { label:"貫く",               scores:{ idealism:+3, loneliness:+2, community:-2 }, nextId:"q_final" },
      { label:"状況による",         scores:{ realism:+3, logic:+2 },                      nextId:"q_final" },
      { label:"理解されないなら変える",scores:{ community:+2, emotion:+2, idealism:-1 },  nextId:"q_final" },
      { label:"信念が持てない",     scores:{ nihilism:+3, loneliness:+1, idealism:-2 },   nextId:"q_final" },
    ],
  },

  "q_final": {
    id:"q_final", layer:4,
    text:"言葉にできない感情は、存在すると思う？",
    reaction:"では次に。",
    options:[
      { label:"存在する",                    scores:{ romanticism:+3, emotion:+3, logic:-1 }, nextId:null },
      { label:"言葉にできなければ存在しない", scores:{ logic:+4, nihilism:+1, romanticism:-2 },nextId:null },
      { label:"存在するけど、意味はない",     scores:{ nihilism:+3, realism:+2 },              nextId:null },
      { label:"考えたことがなかった",         scores:{ realism:+1, stability:+1 },             nextId:null },
    ],
  },
};

// 後方互換用フラット配列（calcTraitsはanswers[]を使うので変更不要）
const QUESTIONS = Object.values(Q_TREE);

const PHILOSOPHERS = [
  { name:"フリードリヒ・ニーチェ", emoji:"⚡", desc:"力への意志と永劫回帰",
    quote:"深淵を覗くとき、深淵もまたこちらを覗いている。",
    keywords:["力への意志","超人","永劫回帰","虚無克服"],
    affinity:(t) => t.freedom*0.35 + t.nihilism*0.25 + t.idealism*0.2 + (100-t.community)*0.2 },
  { name:"アルベール・カミュ", emoji:"🚬", desc:"不条理の中の反抗",
    quote:"不条理を認識したうえで、それでも生き続けることが反抗だ。",
    keywords:["不条理","反抗","シーシュポス","地中海"],
    affinity:(t) => t.nihilism*0.35 + t.loneliness*0.3 + t.realism*0.2 + (100-t.idealism)*0.15 },
  { name:"ジャン=ポール・サルトル", emoji:"📖", desc:"実存は本質に先立つ",
    quote:"人間は自由の刑に処されている。",
    keywords:["実存主義","自由と責任","他者は地獄","投企"],
    affinity:(t) => t.freedom*0.4 + t.loneliness*0.25 + t.idealism*0.2 + t.nihilism*0.15 },
  { name:"ハンナ・アーレント", emoji:"🌍", desc:"公共性と思考の深淵",
    quote:"悪の凡庸さとは、思考の欠如から生まれる。",
    keywords:["公共性","思考","複数性","活動的生活"],
    affinity:(t) => t.community*0.35 + t.logic*0.3 + (100-t.freedom)*0.2 + t.idealism*0.15 },
  { name:"ルートヴィヒ・ウィトゲンシュタイン", emoji:"🔇", desc:"語りえないものについては沈黙せよ",
    quote:"語りえないことについては、沈黙しなければならない。",
    keywords:["言語ゲーム","沈黙","論理","写像理論"],
    affinity:(t) => t.logic*0.45 + (100-t.emotion)*0.25 + t.loneliness*0.2 + t.nihilism*0.1 },
  { name:"ジャン・ボードリヤール", emoji:"📺", desc:"シミュラクルと超現実",
    quote:"現実はすでに消え去った。我々が生きているのはそのコピーのコピーだ。",
    keywords:["シミュラクル","消費社会","ハイパーリアル","記号"],
    affinity:(t) => t.nihilism*0.4 + (100-t.idealism)*0.25 + t.realism*0.2 + (100-t.romanticism)*0.15 },
  { name:"ソーレン・キェルケゴール", emoji:"🌊", desc:"実存の三段階と不安",
    quote:"不安とは自由のめまいである。",
    keywords:["実存","不安","信仰の跳躍","単独者"],
    affinity:(t) => t.loneliness*0.35 + t.idealism*0.3 + t.romanticism*0.2 + (100-t.community)*0.15 },
  { name:"シモーヌ・ド・ボーヴォワール", emoji:"✒️", desc:"実存的自由と他者との関係",
    quote:"自由とは、他者の自由なくしては存在しない。",
    keywords:["相互承認","状況","他者との共存","倫理"],
    affinity:(t) => t.freedom*0.3 + t.emotion*0.3 + t.community*0.25 + t.idealism*0.15 },
];

const THOUGHT_TYPES = [
  { id:"solitary_nihilist",    name:"孤独な虚無論者",        color:"#7a8bb8",
    glow:["rgba(40,45,120,0.7)","rgba(60,30,110,0.5)","rgba(20,50,100,0.35)"],
    xText:"「虚無を知っている人間は、それでも朝に目を覚ます。」— #AI思想チェッカー",
    cond:(t) => t.nihilism>=8 && t.loneliness>=6 },

  { id:"free_existentialist",  name:"根のない自由主義者",    color:"#6ab0e8",
    glow:["rgba(20,70,150,0.65)","rgba(15,55,130,0.45)","rgba(10,80,120,0.3)"],
    xText:"「自由でいたい人間ほど、檻の形を正確に知っている。」— #AI思想チェッカー",
    cond:(t) => t.freedom>=8 && t.stability<=2 },

  { id:"silent_observer",      name:"沈黙の観測者",          color:"#5aaa9a",
    glow:["rgba(15,90,80,0.6)","rgba(20,80,90,0.45)","rgba(10,70,85,0.3)"],
    xText:"「言葉にしないことで、守られているものがある。」— #AI思想チェッカー",
    cond:(t) => t.logic>=8 && t.loneliness>=5 && t.emotion<=3 },

  { id:"night_romanticist",    name:"夜の実存主義者",        color:"#c87ac8",
    glow:["rgba(100,30,130,0.65)","rgba(80,20,120,0.5)","rgba(60,15,100,0.35)"],
    xText:"「現実主義者でいるには、少し世界を愛しすぎてしまった。」— #AI思想チェッカー",
    cond:(t) => t.romanticism>=7 && t.loneliness>=5 },

  { id:"gentle_nihilist",      name:"やさしいニヒリスト",    color:"#c89858",
    glow:["rgba(100,60,20,0.6)","rgba(90,50,15,0.45)","rgba(80,55,20,0.3)"],
    xText:"「虚無と優しさは、同じ場所から来ているかもしれない。」— #AI思想チェッカー",
    cond:(t) => t.nihilism>=6 && t.emotion>=5 },

  { id:"idealistic_wanderer",  name:"理想を手放せない漂流者", color:"#9878e8",
    glow:["rgba(60,30,150,0.65)","rgba(50,20,130,0.5)","rgba(40,25,110,0.35)"],
    xText:"「理想主義者は、現実に傷つきながらも理想を手放せない。」— #AI思想チェッカー",
    cond:(t) => t.idealism>=8 && t.realism<=3 },

  { id:"logical_skeptic",      name:"冷静な懐疑論者",        color:"#4a9aab",
    glow:["rgba(15,75,100,0.6)","rgba(10,65,90,0.45)","rgba(8,55,80,0.3)"],
    xText:"「疑うことは、信じることより誠実かもしれない。」— #AI思想チェッカー",
    cond:(t) => t.logic>=7 && t.nihilism>=4 && t.romanticism<=4 },

  { id:"communal_realist",     name:"静かな共同体主義者",    color:"#68b878",
    glow:["rgba(20,80,40,0.6)","rgba(15,70,35,0.45)","rgba(10,60,30,0.3)"],
    xText:"「人の中にいることで、ようやく自分の形が見える。」— #AI思想チェッカー",
    cond:(t) => t.community>=8 && t.freedom<=3 },

  { id:"border_dweller",       name:"境界の住人",            color:"#8898b8",
    glow:["rgba(40,55,110,0.55)","rgba(55,35,100,0.4)","rgba(30,50,90,0.28)"],
    xText:"「どちらでもなく、どちらでもある。それが私の場所だ。」— #AI思想チェッカー",
    cond:(_) => true },
];

const FALLBACK_BY_TYPE = {
  solitary_nihilist:   { definition:"意味の不在を知りながら、それでも何かを探し続けるという矛盾した構造を持つ人間の思想。", contradiction:"何も信じていないと言いながら、信じられるものを探し続けているという逆説がある。", solitude:"孤独には慣れているが、慣れたこととそれを望んだことは別の話だと、どこかで知っている。", distance:"人の輪に入れないのではなく、入る意味を見つけられないでいる状態が続いている。", quote:"虚無を知っている人間は、それでも朝に目を覚ます。" },
  free_existentialist: { definition:"自由を最大の価値とするが、その自由の重さに気づいてもなお、手放せないでいる構造。", contradiction:"束縛から逃れたいという意志と、どこかに根を下ろしたいという衝動が、同時に存在している。", solitude:"一人でいる時の方が、自分の輪郭がはっきりする気がしている。", distance:"集団の中にいても、そこから少し浮いた位置から観察している自分がいる。", quote:"自由でいたい人間ほど、檻の形を正確に知っている。" },
  silent_observer:     { definition:"感情より観察を、主張より沈黙を選ぶことで、世界との距離を保とうとする思想の構造。", contradiction:"冷静に見えて、その観察の奥に強い感情が眠っていることを、本人だけが知っている。", solitude:"孤独を嫌っているわけではない。ただ、一人でいる方が思考の精度が上がる。", distance:"人との関係を切るのではなく、一枚ガラスを挟んだままで関係を保っている。", quote:"言葉にしないことで、守られているものがある。" },
  night_romanticist:   { definition:"現実を知りながらも理想を捨てられない、その亀裂の中に美しさを見出そうとする思想。", contradiction:"ロマンを信じていないと言いながら、それを否定しきれない瞬間が繰り返しやってくる。", solitude:"夜が静かな分だけ、考えが深くなっていく。それを孤独と呼ぶのかどうかは、まだわからない。", distance:"社会の速度についていけないのではなく、その速度に意味を感じていない。", quote:"現実主義者でいるには、少し世界を愛しすぎてしまった。" },
  default:             { definition:"いくつかの思想的傾向が重なり合い、一つの軸では語れない複雑な構造を持つかもしれない。", contradiction:"自分の価値観を持ちながら、それが正しいかどうか問い続けているという構造がある。", solitude:"一人の時間と他者との時間、どちらが本当の自分に近いのか、まだ答えが出ていない。", distance:"社会との距離を意識しながら、それでも完全には切れないでいる。", quote:"問い続けることが、答えを持つことより誠実かもしれない。" },
};

function calcTraits(answers) {
  const base = { freedom:0, stability:0, idealism:0, realism:0, logic:0, emotion:0, loneliness:0, nihilism:0, romanticism:0, community:0 };
  for (const { scores } of answers) for (const [k,v] of Object.entries(scores ?? {})) base[k] = (base[k]??0) + v;
  const norm = {};
  for (const [k,v] of Object.entries(base)) norm[k] = Math.min(100, Math.max(0, Math.round(50 + v * 2.2)));
  return norm;
}
function resolveType(traits)        { return THOUGHT_TYPES.find(t => t.cond(traits)) ?? THOUGHT_TYPES.at(-1); }
function resolvePhilosophers(traits){ return [...PHILOSOPHERS].map(p=>({...p,score:p.affinity(traits)})).sort((a,b)=>b.score-a.score).slice(0,2); }
function getFallback(id)            { return FALLBACK_BY_TYPE[id] ?? FALLBACK_BY_TYPE.default; }

// ── APIタイムアウト定数
const API_TIMEOUT_MS = 18_000;
const API_MAX_RETRY  = 2;

// タイムアウト付きfetch
function fetchWithTimeout(url, options, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal })
    .finally(() => clearTimeout(timer));
}

async function generateAnalysis({ answers, traits, typeName, philosopher }) {
  const answerSummary = answers.map((a,i)=>`Q${i+1}: ${a.question} → ${a.answer}`).join("\n");
  const traitSummary  = Object.entries(traits).map(([k,v])=>`${k}:${v}`).join(", ");
  const systemPrompt = `あなたは思想アーカイブSNS「Noema」の診断AIです。
禁止：空虚な褒め・自己啓発・ChatGPT的相槌・同じ文章の繰り返し
文体：実存主義/虚無主義/ロマン主義の哲学的温度感。短く刺さる。スクショされる一文を含む。
出力（JSONのみ）:{"definition":"40〜60字","contradiction":"40〜60字","solitude":"30〜50字","distance":"30〜50字","quote":"20〜35字"}`;
  const userContent = `タイプ:${typeName}\n哲学者:${philosopher.name}\nスコア:${traitSummary}\n回答:\n${answerSummary}\n\n各回答の具体的選択に言及してください。毎回異なる視点で。`;

  const body = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    temperature: 1,
    system: systemPrompt,
    messages: [{ role:"user", content: userContent }],
  });

  let lastErr;
  for (let attempt = 0; attempt <= API_MAX_RETRY; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt)); // 指数バックオフ
    try {
      const res = await fetchWithTimeout(
        "https://api.anthropic.com/v1/messages",
        { method:"POST", headers:{"Content-Type":"application/json"}, body },
        API_TIMEOUT_MS
      );

      // レート制限は即リトライ不要
      if (res.status === 429) {
        throw Object.assign(new Error("RATE_LIMITED"), { code:"RATE_LIMITED", retryable: false });
      }
      // 認証エラーはリトライ不要
      if (res.status === 401 || res.status === 403) {
        throw Object.assign(new Error("AUTH_ERROR"), { code:"AUTH_ERROR", retryable: false });
      }
      if (!res.ok) {
        throw Object.assign(new Error(`API_${res.status}`), { code:`API_${res.status}`, retryable: true });
      }

      const data = await res.json();
      const raw  = data.content?.find(c=>c.type==="text")?.text ?? "{}";
      const parsed = JSON.parse(raw.replace(/```json|```/gi,"").trim());
      return parsed;

    } catch(e) {
      lastErr = e;
      // リトライ不要エラーは即抜ける
      if (e.code === "RATE_LIMITED" || e.code === "AUTH_ERROR") break;
      // AbortError（タイムアウト）はリトライ
      if (e.name === "AbortError") { lastErr = Object.assign(e, { code:"TIMEOUT" }); continue; }
    }
  }
  throw lastErr;
}

// ───────────────────────────────────────────────────────────────
//  CSS — グローバルスタイル（<style>タグで注入）
// ───────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Noto+Serif+JP:wght@200;300;400&family=Space+Mono:wght@400;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
  ::-webkit-scrollbar { width: 2px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(100,120,160,0.18); border-radius: 2px; }

  /* ── 変数 ── */
  :root {
    --f-serif:  'Cormorant Garamond', 'Noto Serif JP', Georgia, serif;
    --f-jp:     'Noto Serif JP', 'Georgia', serif;
    --f-mono:   'Space Mono', 'Courier New', monospace;
    --c-bg:     #090b10;
    --c-surface:#0f1219;
    --c-border: rgba(255,255,255,0.065);
    --c-border2:rgba(255,255,255,0.04);
    --c-text:   rgba(218,222,235,0.92);
    --c-muted:  rgba(130,145,175,0.65);
    --c-dim:    rgba(100,115,145,0.45);
    --transition: 0.26s cubic-bezier(0.4,0,0.2,1);
  }

  /* ══════════════════════════════════════════════
     アニメーション定義
  ══════════════════════════════════════════════ */
  @keyframes fadeUp    { from{opacity:0;transform:translateY(14px)}  to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn    { from{opacity:0}                              to{opacity:1} }
  @keyframes slideLeft { from{opacity:0;transform:translateX(20px)}  to{opacity:1;transform:translateX(0)} }
  @keyframes scaleIn   { from{opacity:0;transform:scale(0.96)}       to{opacity:1;transform:scale(1)} }
  @keyframes spin      { to{transform:rotate(360deg)} }
  @keyframes shimmer   { 0%,100%{opacity:0.4} 50%{opacity:1} }
  @keyframes revealBar { from{width:0} to{width:var(--bar-w)} }
  @keyframes countUp   { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }

  /* ── 背景グロー浮遊 ── */
  @keyframes orbFloat  {
    0%,100%{ transform:translate(0,0) scale(1); }
    33%    { transform:translate(18px,-22px) scale(1.04); }
    66%    { transform:translate(-12px,14px) scale(0.97); }
  }
  @keyframes glowPulse { 0%,100%{opacity:0.06} 50%{opacity:0.13} }

  /* ── 思想座標ドット ── */
  @keyframes pulseDot {
    0%,100%{ box-shadow:0 0 16px rgba(100,160,210,.6),0 0 32px rgba(100,160,210,.25); }
    50%    { box-shadow:0 0 26px rgba(100,160,210,.9),0 0 50px rgba(100,160,210,.4); }
  }

  /* ══════════════════════════════════════════════
     ホーム専用エフェクト
  ══════════════════════════════════════════════ */

  /* ── スキャンライン ── */
  @keyframes scanMove {
    0%   { transform:translateY(-100%); opacity:0; }
    5%   { opacity:1; }
    95%  { opacity:0.6; }
    100% { transform:translateY(100vh); opacity:0; }
  }
  .home-scanline {
    position:fixed; inset:0; pointer-events:none; z-index:1; overflow:hidden;
  }
  .home-scanline::before {
    content:'';
    position:absolute; left:0; right:0; top:0;
    height:2px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(80,140,200,0.0) 15%,
      rgba(80,160,220,0.18) 40%,
      rgba(100,180,240,0.32) 50%,
      rgba(80,160,220,0.18) 60%,
      rgba(80,140,200,0.0) 85%,
      transparent 100%);
    box-shadow: 0 0 18px rgba(80,160,220,0.25), 0 0 40px rgba(80,160,220,0.1);
    animation: scanMove 7s cubic-bezier(0.4,0,0.6,1) infinite;
    will-change: transform;
  }
  .home-scanline::after {
    content:'';
    position:absolute; left:0; right:0; top:0;
    height:1px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(150,100,220,0.0) 20%,
      rgba(150,100,220,0.12) 50%,
      rgba(150,100,220,0.0) 80%,
      transparent 100%);
    animation: scanMove 11s cubic-bezier(0.4,0,0.6,1) 4s infinite;
    will-change: transform;
  }

  /* ── CRT 水平ライン（静的） ── */
  .home-crt {
    position:fixed; inset:0; pointer-events:none; z-index:1;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(0,0,0,0.06) 3px,
      rgba(0,0,0,0.06) 4px
    );
  }

  /* ── ビネット（周辺減光） ── */
  .home-vignette {
    position:fixed; inset:0; pointer-events:none; z-index:1;
    background: radial-gradient(
      ellipse 90% 90% at 50% 50%,
      transparent 50%,
      rgba(0,0,0,0.35) 80%,
      rgba(0,0,0,0.65) 100%
    );
  }

  /* ── 浮遊粒子 ── */
  @keyframes particleDrift {
    0%   { transform:translate(0, 0)    scale(1);    opacity:0; }
    10%  { opacity:var(--p-opacity); }
    90%  { opacity:var(--p-opacity); }
    100% { transform:translate(var(--p-dx), var(--p-dy)) scale(var(--p-scale)); opacity:0; }
  }
  .particle {
    position:fixed; border-radius:50%;
    pointer-events:none !important;
    animation: particleDrift var(--p-dur) ease-in-out var(--p-delay) infinite;
    will-change: transform, opacity;
  }

  /* ── タイトルグロー ── */
  @keyframes titleGlow {
    0%,100% { text-shadow: 0 0 40px rgba(100,150,220,0.15), 0 0 80px rgba(100,150,220,0.05); }
    50%     { text-shadow: 0 0 60px rgba(120,170,240,0.28), 0 0 120px rgba(100,150,220,0.12); }
  }
  .home-title {
    animation: titleGlow 5s ease-in-out infinite;
  }

  /* ── ゆっくり動くグラデーション背景 ── */
  @keyframes gradientShift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  .home-grad-bg {
    position:fixed; inset:0; pointer-events:none; z-index:0;
    background: linear-gradient(
      135deg,
      #090b10 0%,
      #0b0d16 20%,
      #090d18 40%,
      #0a0b14 60%,
      #0c0b18 80%,
      #090b10 100%
    );
    background-size: 400% 400%;
    animation: gradientShift 20s ease infinite;
  }

  /* ── ホームバッジ発光 ── */
  @keyframes badgePulse {
    0%,100%{ box-shadow:0 0 0 0 rgba(80,140,200,0); }
    50%    { box-shadow:0 0 12px 2px rgba(80,140,200,0.15); }
  }
  .home-badge { animation: badgePulse 4s ease-in-out infinite; }

  /* ── ホームカード hover ── */
  .home-card {
    transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
  }
  .home-card:hover {
    transform: translateY(-3px);
    border-color: rgba(100,140,210,0.2) !important;
    box-shadow:
      0 12px 40px rgba(0,0,0,0.4),
      0 0 0 1px rgba(100,140,210,0.06),
      inset 0 0 30px rgba(80,120,180,0.03);
  }

  /* ── 始動ボタン特別演出 ── */
  @keyframes btnAura {
    0%,100%{ box-shadow: 0 0 20px rgba(70,110,190,0.12), 0 0 0 0 rgba(90,130,210,0); }
    50%    { box-shadow: 0 0 35px rgba(70,110,190,0.22), 0 0 0 6px rgba(90,130,210,0); }
  }
  .btn-start {
    display:inline-flex; align-items:center; gap:10px;
    padding:16px 48px;
    background: rgba(45,72,128,0.22);
    border:1px solid rgba(90,130,200,0.32);
    border-radius:14px;
    color:rgba(175,208,245,0.92);
    font-family:var(--f-serif); font-style:italic;
    font-size:16px; letter-spacing:0.06em; cursor:pointer;
    transition:all 0.32s cubic-bezier(0.4,0,0.2,1);
    position:relative; z-index:1; overflow:hidden;
    animation: btnAura 4s ease-in-out infinite;
  }
  .btn-start::before {
    content:'';
    position:absolute; inset:0;
    background: linear-gradient(135deg, rgba(100,150,220,0.08) 0%, transparent 60%);
    opacity:0; transition:opacity 0.3s ease;
  }
  .btn-start::after {
    content:'';
    position:absolute; bottom:0; left:50%; right:50%;
    height:1px;
    background: linear-gradient(90deg, transparent, rgba(110,160,230,0.6), transparent);
    transition: left 0.4s ease, right 0.4s ease;
  }
  .btn-start:hover {
    background: rgba(58,92,155,0.32);
    border-color: rgba(110,158,228,0.48);
    transform: translateY(-2px);
    box-shadow:
      0 12px 36px rgba(55,100,180,0.22),
      0 0 0 1px rgba(110,158,228,0.1),
      inset 0 0 24px rgba(80,130,210,0.06);
    animation: none;
  }
  .btn-start:hover::before { opacity:1; }
  .btn-start:hover::after  { left:10%; right:10%; }
  .btn-start:active { transform:translateY(0); }

  /* ── SYSTEM ID 点滅 ── */
  @keyframes cursorBlink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
  .cursor-blink { animation: cursorBlink 1.1s step-end infinite; }

  /* ── ステータスライン点滅 ── */
  @keyframes statusPing {
    0%,100%{ opacity:0.5; transform:scale(1); }
    50%    { opacity:1;   transform:scale(1.4); }
  }
  .status-dot { animation: statusPing 2.4s ease-in-out infinite; }

  /* ── 区切り線スライドイン ── */
  @keyframes lineExpand { from{width:0;opacity:0} to{width:100%;opacity:1} }
  .line-expand { animation: lineExpand 1.2s cubic-bezier(0.16,1,0.3,1) 0.3s both; }

  /* ══════════════════════════════════════════════
     共通コンポーネント
  ══════════════════════════════════════════════ */

  /* ── フェーズ遷移 ── */
  .phase-enter  { animation: fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) forwards; }
  .phase-quiz   { animation: slideLeft 0.42s cubic-bezier(0.16,1,0.3,1) both; }
  .phase-result { animation: scaleIn 0.6s cubic-bezier(0.16,1,0.3,1) both; }

  /* ── カードホバー ── */
  .card-hover {
    transition: transform var(--transition), border-color var(--transition), box-shadow var(--transition);
  }
  .card-hover:hover {
    transform: translateY(-2px);
    border-color: rgba(255,255,255,0.12) !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04);
  }

  /* ── 選択肢ボタン ── */
  .option-btn {
    width:100%; text-align:left; cursor:pointer;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px;
    padding: 15px 20px;
    margin-bottom: 10px;
    color: rgba(195,205,222,0.78);
    font-family: var(--f-jp);
    font-size: 14px;
    line-height: 1.6;
    letter-spacing: 0.015em;
    transition: all 0.22s cubic-bezier(0.4,0,0.2,1);
    position: relative;
    overflow: hidden;
  }
  .option-btn::before {
    content:'';
    position:absolute; inset:0;
    background: linear-gradient(135deg, rgba(80,120,180,0.08) 0%, transparent 60%);
    opacity:0; transition: opacity 0.22s ease;
  }
  .option-btn:hover { color:rgba(210,220,240,0.92); border-color:rgba(120,155,210,0.25); transform:translateX(3px); }
  .option-btn:hover::before { opacity:1; }
  .option-btn.selected {
    background: rgba(75,115,175,0.18);
    border-color: rgba(110,155,215,0.45);
    color: rgba(185,215,245,0.95);
    transform: translateX(3px);
    box-shadow: 0 0 0 1px rgba(110,155,215,0.1), inset 0 0 20px rgba(75,115,175,0.08);
  }
  .option-btn.selected::before { opacity:1; }

  /* ── プライマリボタン ── */
  .btn-primary {
    display: inline-flex; align-items:center; gap:8px;
    padding: 15px 44px;
    background: rgba(55,85,140,0.2);
    border: 1px solid rgba(90,130,200,0.3);
    border-radius: 14px;
    color: rgba(170,205,240,0.92);
    font-family: var(--f-serif);
    font-style: italic;
    font-size: 16px;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: all 0.28s cubic-bezier(0.4,0,0.2,1);
    box-shadow: 0 0 0 0 rgba(90,140,210,0);
    position:relative; overflow:hidden;
  }
  .btn-primary::after {
    content:''; position:absolute; inset:0;
    background: linear-gradient(135deg, rgba(100,150,220,0.1) 0%, transparent 70%);
    opacity:0; transition: opacity 0.28s ease;
  }
  .btn-primary:hover {
    background: rgba(65,100,160,0.28);
    border-color: rgba(110,155,220,0.45);
    transform: translateY(-1px);
    box-shadow: 0 8px 28px rgba(60,100,180,0.2), 0 0 0 1px rgba(110,155,220,0.1);
  }
  .btn-primary:hover::after { opacity:1; }
  .btn-primary:active { transform:translateY(0); }

  /* ── 次へボタン ── */
  .btn-next {
    display: inline-flex; align-items:center; gap:8px;
    padding: 12px 30px;
    background: rgba(55,85,140,0.18);
    border: 1px solid rgba(90,130,200,0.28);
    border-radius: 12px;
    color: rgba(165,200,238,0.9);
    font-family: var(--f-serif); font-style:italic;
    font-size: 14px; letter-spacing:0.06em; cursor:pointer;
    transition: all 0.22s cubic-bezier(0.4,0,0.2,1);
  }
  .btn-next:hover { background:rgba(65,100,160,0.25); transform:translateX(2px); border-color:rgba(110,155,220,0.4); }
  .btn-next:disabled { opacity:0.3; cursor:not-allowed; transform:none; }

  /* ── ゴーストボタン ── */
  .btn-ghost {
    padding: 12px 32px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    color: rgba(130,145,170,0.6);
    font-family: var(--f-serif); font-style:italic;
    font-size: 13px; letter-spacing:0.06em; cursor:pointer;
    transition: all 0.22s ease;
  }
  .btn-ghost:hover { border-color:rgba(255,255,255,0.14); color:rgba(160,175,200,0.8); }

  /* ── スコアバー ── */
  .score-bar-fill {
    height:100%; border-radius:2px;
    transition: width 1.4s cubic-bezier(0.34,1.3,0.64,1);
  }

  /* ── 結果カード ── */
  .result-card-stagger:nth-child(1)  { animation-delay: 0.05s; }
  .result-card-stagger:nth-child(2)  { animation-delay: 0.12s; }
  .result-card-stagger:nth-child(3)  { animation-delay: 0.19s; }
  .result-card-stagger:nth-child(4)  { animation-delay: 0.26s; }
  .result-card-stagger:nth-child(5)  { animation-delay: 0.33s; }
  .result-card-stagger:nth-child(6)  { animation-delay: 0.40s; }
  .result-card-stagger:nth-child(7)  { animation-delay: 0.47s; }
  .result-card-stagger:nth-child(8)  { animation-delay: 0.54s; }
  .result-card-stagger {
    animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both;
    opacity:0;
  }

  /* ══════════════════════════════════════════════
     質問分岐UI 専用アニメーション
  ══════════════════════════════════════════════ */

  /* AIリアクションバブル */
  @keyframes reactionIn {
    from { opacity:0; transform:translateY(8px) scale(0.97); }
    to   { opacity:1; transform:translateY(0)   scale(1); }
  }
  /* 質問テキスト切り替え */
  @keyframes questionIn {
    from { opacity:0; transform:translateX(14px); }
    to   { opacity:1; transform:translateX(0); }
  }
  /* 選択肢の順次登場 */
  @keyframes optionStagger {
    from { opacity:0; transform:translateX(10px); }
    to   { opacity:1; transform:translateX(0); }
  }
  /* タイピングドット */
  @keyframes typingDot {
    0%,80%,100% { transform:scale(0.7); opacity:0.35; }
    40%         { transform:scale(1);   opacity:1; }
  }
  .reaction-bubble { animation: reactionIn 0.42s cubic-bezier(0.16,1,0.3,1) forwards; }
  .question-text   { animation: questionIn 0.48s cubic-bezier(0.16,1,0.3,1) 0.05s both; }
  .option-stagger  { opacity:0; animation: optionStagger 0.4s cubic-bezier(0.16,1,0.3,1) forwards; }

  /* 分岐深度インジケーター */
  @keyframes depthGlow { 0%,100%{ opacity:0.5; box-shadow:none; } 50%{ opacity:1; box-shadow:0 0 5px currentColor; } }
  .depth-dot-active { animation: depthGlow 2s ease-in-out infinite; }

  /* ══════════════════════════════════════════════
     ThinkingScreen 専用アニメーション
  ══════════════════════════════════════════════ */

  /* ── メインリング回転 ── */
  @keyframes ringSpinA { to { transform: rotate(360deg); } }
  @keyframes ringSpinB { to { transform: rotate(-360deg); } }
  @keyframes ringSpinC { to { transform: rotate(360deg); } }
  @keyframes ringSpinD { to { transform: rotate(-360deg); } }

  /* ── リングの発光脈動 ── */
  @keyframes ringGlow {
    0%,100%{ filter: drop-shadow(0 0 3px rgba(80,160,220,0.4)); }
    50%    { filter: drop-shadow(0 0 9px rgba(80,160,220,0.85)) drop-shadow(0 0 18px rgba(80,140,220,0.3)); }
  }

  /* ── 中心コアの鼓動 ── */
  @keyframes corePulse {
    0%,100%{ transform:scale(1);   opacity:0.7; }
    50%    { transform:scale(1.18); opacity:1; }
  }

  /* ── スキャンライン（ThinkingScreen） ── */
  @keyframes thinkScan {
    0%   { top:-2px; opacity:0; }
    4%   { opacity:1; }
    96%  { opacity:0.7; }
    100% { top:100%; opacity:0; }
  }

  /* ── テキストのフェード切り替え ── */
  @keyframes stepFadeIn  { from{opacity:0; transform:translateY(6px)} to{opacity:1; transform:translateY(0)} }
  @keyframes stepFadeOut { from{opacity:1; transform:translateY(0)} to{opacity:0; transform:translateY(-6px)} }
  .step-in  { animation: stepFadeIn  0.45s cubic-bezier(0.16,1,0.3,1) forwards; }
  .step-out { animation: stepFadeOut 0.3s ease-in forwards; }

  /* ── グリッチ ── */
  @keyframes glitch {
    0%,90%,100% { transform:translate(0,0) skewX(0deg); opacity:1; clip-path:none; }
    91%  { transform:translate(-3px, 1px) skewX(-2deg); opacity:0.85; }
    92%  { transform:translate(3px,-1px) skewX(2deg); opacity:1; }
    93%  { transform:translate(-2px, 0px) skewX(0deg); opacity:0.9; }
    94%  { transform:translate(0,0) skewX(0deg); opacity:1; }
  }
  @keyframes glitchClip {
    0%,88%,100% { clip-path: inset(0 0 100% 0); opacity:0; }
    89% { clip-path: inset(20% 0 65% 0); opacity:0.7; transform:translate(4px,0); }
    90% { clip-path: inset(55% 0 20% 0); opacity:0.5; transform:translate(-4px,0); }
    91% { clip-path: inset(0 0 100% 0); opacity:0; }
  }

  /* ── 数値カウントアップ ── */
  @keyframes numFlicker {
    0%,100%{ opacity:1; }
    50%{ opacity:0.55; }
  }

  /* ── セグメントバーの点滅 ── */
  @keyframes segBlink {
    0%,49%{ background:rgba(80,160,220,0.7); box-shadow:0 0 5px rgba(80,160,220,0.5); }
    50%,100%{ background:rgba(80,160,220,0.12); box-shadow:none; }
  }

  /* ── ホライゾンスキャン（横方向） ── */
  @keyframes horizScan {
    0%  { left:-100%; opacity:0; }
    5%  { opacity:1; }
    95% { opacity:0.6; }
    100%{ left:100%; opacity:0; }
  }

  /* ── 画像保存ボタン ── */
  @keyframes savePulse {
    0%,100%{ box-shadow:0 0 0 0 rgba(80,160,120,0); }
    50%    { box-shadow:0 0 16px 2px rgba(80,160,120,0.22); }
  }
  @keyframes saveSuccess {
    0%  { transform:scale(1); }
    40% { transform:scale(1.06); }
    100%{ transform:scale(1); }
  }
  .btn-save {
    display:inline-flex; align-items:center; gap:9px;
    padding:14px 32px;
    background: rgba(40,80,60,0.18);
    border:1px solid rgba(70,140,100,0.28);
    border-radius:13px;
    color:rgba(120,200,150,0.88);
    font-family:var(--f-mono);
    font-size:11px; letter-spacing:0.14em; cursor:pointer;
    transition:all 0.26s cubic-bezier(0.4,0,0.2,1);
    position:relative; overflow:hidden;
    animation: savePulse 3.5s ease-in-out infinite;
  }
  .btn-save::before {
    content:''; position:absolute; inset:0;
    background:linear-gradient(135deg,rgba(80,160,110,0.07) 0%,transparent 60%);
    opacity:0; transition:opacity 0.24s ease;
  }
  .btn-save:hover {
    background:rgba(50,100,75,0.26);
    border-color:rgba(90,165,120,0.42);
    transform:translateY(-1px);
    box-shadow:0 8px 28px rgba(40,120,80,0.18);
    animation:none;
  }
  .btn-save:hover::before { opacity:1; }
  .btn-save:disabled { opacity:0.5; cursor:not-allowed; transform:none; animation:none; }
  .btn-save.saved {
    background:rgba(40,90,65,0.22);
    border-color:rgba(80,180,120,0.45);
    color:rgba(100,220,150,0.92);
    animation:saveSuccess 0.4s ease forwards;
  }

  /* ── ShareCard ラッパー
     visibility:hidden はhtml2canvasで真っ暗になるため使用禁止
     opacity:0 + pointer-events:none で視覚的に隠す ── */
  .share-card-wrapper {
    position: fixed;
    left: -9999px;
    top: 0;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
    /* overflow:visible でグロー要素が正確に描画されるようにする */
    overflow: visible;
  }

  /* ══════════════════════════════════════════════
     SNS共有ボタン（ガラス風・青白グロー）
  ══════════════════════════════════════════════ */

  /* ── 共有パネルのフェードイン ── */
  @keyframes sharePanelIn {
    from { opacity:0; transform:translateY(12px) scale(0.97); }
    to   { opacity:1; transform:translateY(0)    scale(1); }
  }
  .share-panel {
    animation: sharePanelIn 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both;
  }

  /* ── ガラス風ベースボタン ── */
  .btn-share-base {
    display: inline-flex; align-items:center; justify-content:center; gap:8px;
    padding: 13px 22px;
    border-radius: 13px;
    font-family: var(--f-mono);
    font-size: 10px; letter-spacing: 0.14em;
    cursor: pointer;
    transition: all 0.24s cubic-bezier(0.4,0,0.2,1);
    position: relative; overflow: hidden;
    white-space: nowrap;
  }
  .btn-share-base::before {
    content:'';
    position:absolute; inset:0;
    background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 60%);
    opacity:0; transition: opacity 0.22s ease;
  }
  .btn-share-base:hover::before { opacity:1; }
  .btn-share-base:active { transform: scale(0.97); }

  /* ── 画像保存（シアン系） ── */
  .btn-share-img {
    background: rgba(30,75,120,0.2);
    border: 1px solid rgba(70,150,220,0.28);
    color: rgba(120,190,240,0.9);
    box-shadow: 0 0 0 0 rgba(70,150,220,0);
    animation: imgBtnGlow 4s ease-in-out infinite;
  }
  @keyframes imgBtnGlow {
    0%,100%{ box-shadow: 0 0 8px rgba(70,150,220,0.1); }
    50%    { box-shadow: 0 0 18px rgba(70,150,220,0.22); }
  }
  .btn-share-img:hover {
    background: rgba(40,95,150,0.3);
    border-color: rgba(90,170,240,0.45);
    box-shadow: 0 6px 24px rgba(50,130,220,0.2), 0 0 0 1px rgba(90,170,240,0.1);
    animation: none;
  }
  .btn-share-img.saved {
    background: rgba(20,70,50,0.25);
    border-color: rgba(60,180,120,0.4);
    color: rgba(100,220,150,0.92);
  }

  /* ── X(Twitter)（紫・深夜系） ── */
  .btn-share-x {
    background: rgba(40,30,80,0.22);
    border: 1px solid rgba(120,90,200,0.28);
    color: rgba(175,150,230,0.88);
  }
  .btn-share-x:hover {
    background: rgba(55,40,110,0.32);
    border-color: rgba(150,115,230,0.45);
    box-shadow: 0 6px 24px rgba(100,70,200,0.18), 0 0 0 1px rgba(140,105,220,0.1);
  }

  /* ── URLコピー（グレー系） ── */
  .btn-share-copy {
    background: rgba(40,45,65,0.2);
    border: 1px solid rgba(120,130,170,0.22);
    color: rgba(155,165,195,0.8);
  }
  .btn-share-copy:hover {
    background: rgba(55,60,85,0.3);
    border-color: rgba(140,150,195,0.35);
    box-shadow: 0 6px 20px rgba(80,90,140,0.15);
  }
  .btn-share-copy.copied {
    border-color: rgba(80,180,120,0.38);
    color: rgba(100,210,150,0.88);
  }

  /* ── 浮遊アニメーション（結果ヘッダー） ── */
  @keyframes floatY {
    0%,100%{ transform: translateY(0px); }
    50%    { transform: translateY(-6px); }
  }
  @keyframes typeGlow {
    0%,100%{ filter: drop-shadow(0 0 18px var(--tc-glow)) drop-shadow(0 0 6px var(--tc-glow)); }
    50%    { filter: drop-shadow(0 0 32px var(--tc-glow)) drop-shadow(0 0 12px var(--tc-glow)); }
  }
  .result-title-float {
    animation: floatY 5s ease-in-out infinite, typeGlow 4s ease-in-out infinite;
  }

  /* ── 結果背景グロー（タイプ別カスタムプロパティ） ── */
  @keyframes resultGlow1 {
    0%,100%{ opacity:0.55; transform:translate(0,0) scale(1); }
    33%    { opacity:0.75; transform:translate(15px,-18px) scale(1.05); }
    66%    { opacity:0.6;  transform:translate(-10px,12px) scale(0.97); }
  }
  @keyframes resultGlow2 {
    0%,100%{ opacity:0.42; transform:translate(0,0) scale(1); }
    40%    { opacity:0.6;  transform:translate(-18px,14px) scale(1.04); }
    70%    { opacity:0.48; transform:translate(12px,-10px) scale(0.98); }
  }
  @keyframes resultGlow3 {
    0%,100%{ opacity:0.32; }
    50%    { opacity:0.48; }
  }

  /* ── SNSパネル区切り線 ── */
  .share-divider {
    height:1px;
    background: linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent);
    margin: 24px 0;
  }

  /* ── ローディングスピナー（保存中） ── */
  .saving-spinner {
    width:12px; height:12px; border-radius:50%;
    border:1.5px solid rgba(120,190,240,0.25);
    border-top-color:rgba(120,190,240,0.9);
    animation: spin 0.75s linear infinite;
  }

  /* ── モバイル最適化（iPhone Safari前提） ── */
  @media (max-width:480px) {
    .grid-2col { grid-template-columns:1fr !important; }
    .hide-mobile { display:none !important; }
    .card-hover:hover { transform:none; }

    /* タップ領域を広げる */
    .option-btn { padding: 15px 18px; margin-bottom: 11px; min-height: 48px; }
    .btn-next   { padding: 14px 26px; min-height: 48px; }
    .btn-share-base { min-height: 56px; }

    /* iOSのフォントサイズ自動拡大を防ぐ */
    html { -webkit-text-size-adjust: 100%; }

    /* スクロール最適化 */
    .scroll-container { -webkit-overflow-scrolling: touch; }

    /* レーダーチャートをモバイルでリサイズ */
    .radar-wrap { height: 150px !important; }

    /* 深度ドットを少し大きく */
    .depth-dot { width: 7px !important; height: 7px !important; }

    /* 共有ボタンを縦並びに */
    .share-grid { grid-template-columns: 1fr !important; gap: 8px !important; }
  }
  @media (max-width:360px) {
    .option-btn { font-size: 13px; }
  }

  /* ── 選択肢クリック時の波紋アニメーション ── */
  @keyframes optionRipple {
    from { transform:scale(0); opacity:0.4; }
    to   { transform:scale(2.5); opacity:0; }
  }
  .option-btn-ripple {
    position:absolute; border-radius:50%;
    width:80px; height:80px;
    background: rgba(100,160,230,0.25);
    transform:scale(0);
    pointer-events:none;
    animation: optionRipple 0.55s cubic-bezier(0.4,0,0.2,1) forwards;
  }

  /* ── 結果カード段階表示（stagger強化） ── */
  .result-reveal {
    opacity:0;
    animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards;
  }

  /* ── エラーUI ── */
  @keyframes errorShake {
    0%,100%{ transform:translateX(0); }
    20%    { transform:translateX(-6px); }
    40%    { transform:translateX(6px); }
    60%    { transform:translateX(-4px); }
    80%    { transform:translateX(4px); }
  }
  .error-shake { animation: errorShake 0.4s ease forwards; }

  /* ── retry ボタン ── */
  .btn-retry {
    display:inline-flex; align-items:center; gap:7px;
    padding:11px 22px;
    background:rgba(140,60,60,0.15); border:1px solid rgba(200,90,90,0.28);
    border-radius:10px; color:rgba(220,150,150,0.9);
    font-family:var(--f-mono); font-size:10px; letter-spacing:0.14em;
    cursor:pointer; transition:all 0.22s ease;
  }
  .btn-retry:hover { background:rgba(160,70,70,0.22); border-color:rgba(220,100,100,0.4); }

  /* ── safe-area-inset（iPhone ノッチ対応） ── */
  .safe-bottom { padding-bottom: max(24px, env(safe-area-inset-bottom)); }
`;

// ───────────────────────────────────────────────────────────────
//  UIコンポーネント
// ───────────────────────────────────────────────────────────────
const DISCLAIMER = "この分析はAIによる傾向の推定であり、実際の思想・信条を断定するものではありません。エンターテイメント・自己探索のためのツールです。";

// 動的グローオーブ
function GlowOrbs({ phase }) {
  const orbs = [
    { w:560, h:560, top:"-180px", right:"-130px", color:"#2a4a8a", delay:"0s" },
    { w:420, h:420, bottom:"-140px", left:"-100px", color:"#4a2a7a", delay:"3s" },
    { w:280, h:280, top:"40%", left:"30%", color:"#1a5a6a", delay:"6s" },
    { w:200, h:200, top:"20%", left:"60%", color:"#3a2a5a", delay:"9s" },
  ];
  return (
    <>
      {orbs.map((o,i) => (
        <div key={i} style={{
          position:"fixed", borderRadius:"50%", pointerEvents:"none", zIndex:0,
          width:o.w, height:o.h, top:o.top, right:o.right, bottom:o.bottom, left:o.left,
          background:o.color,
          filter:"blur(100px)",
          animation:`orbFloat ${18+i*4}s ease-in-out ${o.delay} infinite, glowPulse ${6+i*2}s ease-in-out ${o.delay} infinite`,
        }} />
      ))}
    </>
  );
}

// ── ホーム専用：浮遊粒子
const PARTICLES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  size:  [1.5, 1.5, 2, 1, 1, 2.5, 1][i % 7],
  left:  `${(i * 37 + 11) % 100}%`,
  top:   `${(i * 53 + 7)  % 100}%`,
  color: [
    "rgba(80,140,210,0.55)", "rgba(120,90,200,0.45)", "rgba(60,160,180,0.4)",
    "rgba(100,140,220,0.5)", "rgba(80,100,180,0.35)",
  ][i % 5],
  dur:   `${14 + (i % 12) * 2.5}s`,
  delay: `${-(i * 3.1) % 18}s`,
  dx:    `${((i * 17) % 60) - 30}px`,
  dy:    `${-((i * 23) % 80) - 20}px`,
  scale: `${0.5 + (i % 5) * 0.15}`,
  opacity: [0.6, 0.45, 0.7, 0.5, 0.55][i % 5],
}));

function HomeParticles() {
  return (
    <>
      {PARTICLES.map(p => (
        <div key={p.id} className="particle" style={{
          width: p.size, height: p.size,
          left: p.left, top: p.top,
          background: p.color,
          boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          "--p-dur":     p.dur,
          "--p-delay":   p.delay,
          "--p-dx":      p.dx,
          "--p-dy":      p.dy,
          "--p-scale":   p.scale,
          "--p-opacity": p.opacity,
        }} />
      ))}
    </>
  );
}

// ── ホーム専用：スキャンライン＋CRT＋ビネット（一括）
function HomeOverlays() {
  return (
    <>
      <div className="home-grad-bg" />
      <div className="home-scanline" />
      <div className="home-crt" />
      <div className="home-vignette" />
    </>
  );
}

// プログレスバー（洗練版）
function ProgressBar({ current, total }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div style={{ marginBottom:32 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <span style={{ fontFamily:"var(--f-mono)", fontSize:10, color:"var(--c-dim)", letterSpacing:"0.18em" }}>
          {String(current).padStart(2,"0")} / {String(total).padStart(2,"0")}
        </span>
        <span style={{ fontFamily:"var(--f-mono)", fontSize:10, color:"var(--c-muted)", letterSpacing:"0.1em" }}>{pct}%</span>
      </div>
      {/* セグメント式プログレス */}
      <div style={{ display:"flex", gap:3 }}>
        {Array.from({length:total}).map((_,i) => (
          <div key={i} style={{
            flex:1, height:2, borderRadius:2,
            background: i < current ? "linear-gradient(90deg,#4a7aaa,#7b68c8)" : "rgba(255,255,255,0.06)",
            transition:`background 0.4s ease ${i*0.04}s`,
            boxShadow: i < current ? "0 0 6px rgba(100,140,200,0.4)" : "none",
          }} />
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
//  html2canvas 動的ロード（CDN）
// ───────────────────────────────────────────────────────────────
let _h2cPromise = null;
function loadHtml2Canvas() {
  if (_h2cPromise) return _h2cPromise;
  _h2cPromise = new Promise((resolve, reject) => {
    if (window.html2canvas) { resolve(window.html2canvas); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload  = () => resolve(window.html2canvas);
    s.onerror = () => reject(new Error("html2canvas load failed"));
    document.head.appendChild(s);
  });
  return _h2cPromise;
}
function fallbackDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ───────────────────────────────────────────────────────────────
//  SVG レーダーチャート（html2canvas互換・インラインSVG）
// ───────────────────────────────────────────────────────────────
function RadarSVG({ data, color, size = 200 }) {
  const cx = size / 2, cy = size / 2, r = size * 0.34;
  const n = data.length;
  const ang  = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt   = (i, v) => ({ x: cx + r * (v / 100) * Math.cos(ang(i)), y: cy + r * (v / 100) * Math.sin(ang(i)) });
  const poly = (s) => data.map((_, i) => `${cx + r * s * Math.cos(ang(i))},${cy + r * s * Math.sin(ang(i))}`).join(" ");
  const path = data.map((d, i) => { const p = pt(i, d.value); return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`; }).join(" ") + " Z";
  return (
    <svg width={size} height={size} style={{ overflow:"visible", display:"block" }}>
      {[0.25, 0.5, 0.75, 1].map(s => (
        <polygon key={s} points={poly(s)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
      ))}
      {data.map((_, i) => {
        const o = { x: cx + r * Math.cos(ang(i)), y: cy + r * Math.sin(ang(i)) };
        return <line key={i} x1={cx} y1={cy} x2={o.x} y2={o.y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />;
      })}
      <path d={path} fill={`${color}22`} stroke={`${color}aa`} strokeWidth="1.5" strokeLinejoin="round" />
      {data.map((d, i) => {
        const p = pt(i, d.value);
        return <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} opacity="0.85" />;
      })}
      {data.map((d, i) => {
        const p = { x: cx + (r + 16) * Math.cos(ang(i)), y: cy + (r + 16) * Math.sin(ang(i)) };
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize:"8px", fill:"rgba(150,165,195,0.75)", fontFamily:"monospace" }}>
            {d.axis}
          </text>
        );
      })}
    </svg>
  );
}

// ───────────────────────────────────────────────────────────────
//  ShareCard — 画像化専用カード（DOM上に常駐・visibility制御）
// ───────────────────────────────────────────────────────────────
const ShareCard = React.forwardRef(function ShareCard({ result }, ref) {
  if (!result) return null;
  const phil     = result.philosophers?.[0];
  const typeSlug = THOUGHT_TYPES.find(t => t.name === result.typeName)?.id?.toUpperCase().replace(/_/g, "-") ?? "TYPE";
  const typeEntry = THOUGHT_TYPES.find(t => t.name === result.typeName);
  const [g1, g2, g3] = typeEntry?.glow ?? ["rgba(40,55,110,0.65)","rgba(55,35,100,0.5)","rgba(30,50,90,0.35)"];
  const radarData = [
    { axis:"自由",  value: result.traits.freedom },
    { axis:"理想",  value: result.traits.idealism },
    { axis:"感情",  value: result.traits.emotion },
    { axis:"ロマン",value: result.traits.romanticism },
    { axis:"孤独",  value: result.traits.loneliness },
    { axis:"論理",  value: result.traits.logic },
  ];
  const tc = result.typeColor ?? "#8898b8";

  return (
    <div ref={ref} style={{
      width: 540, height: 960,
      background: "#080a0f",
      position: "relative", overflow: "hidden",
      fontFamily: "'Noto Serif JP', Georgia, serif",
      flexShrink: 0,
    }}>

      {/* ── タイプ別グロー（3層・色変化） ── */}
      <div style={{ position:"absolute", width:680, height:680, top:-240, right:-200, borderRadius:"50%",
        background:`radial-gradient(circle at 40% 40%, ${g1} 0%, transparent 65%)`,
        pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:580, height:580, bottom:-200, left:-180, borderRadius:"50%",
        background:`radial-gradient(circle at 60% 60%, ${g2} 0%, transparent 65%)`,
        pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:380, height:380, top:"40%", left:"22%", borderRadius:"50%",
        background:`radial-gradient(circle at center, ${g3} 0%, transparent 65%)`,
        pointerEvents:"none" }} />

      {/* ── ノイズテクスチャ（SVGインライン） ── */}
      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.04, pointerEvents:"none" }}>
        <filter id="sc-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="4" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
        </filter>
        <rect width="100%" height="100%" filter="url(#sc-noise)"/>
      </svg>

      {/* ── CRTライン ── */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.05) 3px,rgba(0,0,0,0.05) 4px)" }} />

      {/* ── 上部アクセントライン ── */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2,
        background:`linear-gradient(90deg, transparent 0%, ${tc}bb 40%, ${tc}ff 50%, ${tc}bb 60%, transparent 100%)` }} />

      {/* ── 下部アクセントライン ── */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:1,
        background:`linear-gradient(90deg, transparent, ${tc}55, transparent)` }} />

      {/* ── 左側装飾ライン ── */}
      <div style={{ position:"absolute", top:0, bottom:0, left:0, width:1,
        background:`linear-gradient(180deg, transparent, ${tc}33 30%, ${tc}22 70%, transparent)` }} />

      {/* ── コンテンツ ── */}
      <div style={{ padding:"48px 44px 40px", display:"flex", flexDirection:"column",
        height:"100%", position:"relative", zIndex:1 }}>

        {/* ロゴ行 */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:36 }}>
          <div>
            <div style={{ fontFamily:"monospace", fontSize:10, color:"rgba(80,110,175,0.65)",
              letterSpacing:"0.3em", marginBottom:3 }}>NOEMA</div>
            <div style={{ fontFamily:"monospace", fontSize:7, color:"rgba(65,90,150,0.42)",
              letterSpacing:"0.22em" }}>AI THOUGHT ANALYZER</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:5, height:5, borderRadius:"50%",
              background:`${tc}cc` }} />
            <div style={{ fontFamily:"monospace", fontSize:7, color:`${tc}88`, letterSpacing:"0.15em" }}>
              ONLINE
            </div>
          </div>
        </div>

        {/* タイプIDバッジ */}
        <div style={{ marginBottom:12 }}>
          <span style={{ display:"inline-block", padding:"4px 15px",
            background:`${tc}14`, border:`1px solid ${tc}40`,
            borderRadius:999, fontFamily:"monospace", fontSize:9,
            color:`${tc}cc`, letterSpacing:"0.22em" }}>
            {typeSlug}
          </span>
        </div>

        {/* タイプ名（大きく・テキストシャドウ強化） */}
        <h2 style={{
          fontFamily:"'Cormorant Garamond', Georgia, serif",
          fontStyle:"italic", fontWeight:300,
          fontSize: result.typeName.length > 8 ? 34 : 42,
          lineHeight:1.1, letterSpacing:"0.02em",
          color: tc, margin:"0 0 6px",
          textShadow:`0 0 30px ${tc}66, 0 0 70px ${tc}33, 0 0 120px ${tc}18`,
        }}>
          {result.typeName}
        </h2>

        {/* 思想定義（タイトル下サブテキスト） */}
        {result.definition && (
          <p style={{ fontFamily:"'Noto Serif JP', Georgia, serif", fontSize:10,
            color:"rgba(145,158,192,0.62)", lineHeight:1.85, fontWeight:200,
            margin:"0 0 20px",
            display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical",
            overflow:"hidden",
          }}>
            {result.definition}
          </p>
        )}

        {/* スコアタグ */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:24 }}>
          {[
            { label:"自由", val:result.traits.freedom,    color:"#6aaeee" },
            { label:"孤独", val:result.traits.loneliness, color:"#5aaa9a" },
            { label:"虚無", val:result.traits.nihilism,   color:"#7880a8" },
            { label:"理想", val:result.traits.idealism,   color:"#7b68cc" },
            { label:"論理", val:result.traits.logic,      color:"#6a9edd" },
            { label:"感情", val:result.traits.emotion,    color:"#d07860" },
          ].map(({ label, val, color }) => (
            <span key={label} style={{ padding:"3px 11px", borderRadius:999,
              background:`${color}14`, border:`1px solid ${color}32`,
              color:`${color}dd`, fontSize:9, fontFamily:"monospace", letterSpacing:"0.12em" }}>
              {label} {val}
            </span>
          ))}
        </div>

        {/* 区切り（タイプ色グラデーション） */}
        <div style={{ height:1,
          background:`linear-gradient(90deg, ${tc}55 0%, ${tc}22 50%, transparent 100%)`,
          marginBottom:20 }} />

        {/* QUOTE */}
        {result.quote && (
          <div style={{ marginBottom:20, paddingLeft:16,
            borderLeft:`2px solid ${tc}66` }}>
            <div style={{ fontFamily:"monospace", fontSize:7, letterSpacing:"0.22em",
              color:`${tc}77`, marginBottom:8 }}>QUOTE</div>
            <p style={{
              fontFamily:"'Cormorant Garamond', Georgia, serif",
              fontStyle:"italic", fontWeight:300,
              fontSize:18, lineHeight:1.75, letterSpacing:"0.025em",
              color:"rgba(220,226,244,0.94)", margin:0,
            }}>
              「{result.quote}」
            </p>
          </div>
        )}

        {/* 哲学者名言 */}
        {phil?.quote && (
          <div style={{ marginBottom:20, padding:"12px 14px",
            background:"rgba(0,0,0,0.28)", border:"1px solid rgba(255,255,255,0.055)",
            borderLeft:`2px solid ${tc}33`, borderRadius:"0 10px 10px 0" }}>
            <div style={{ fontFamily:"monospace", fontSize:7, letterSpacing:"0.18em",
              color:`${tc}66`, marginBottom:7 }}>
              {phil.emoji} {phil.name}
            </div>
            <p style={{ fontFamily:"Georgia, serif", fontStyle:"italic",
              fontSize:12, color:"rgba(160,178,215,0.75)", lineHeight:1.85, margin:0 }}>
              「{phil.quote}」
            </p>
          </div>
        )}

        {/* 区切り */}
        <div style={{ height:1, background:"rgba(255,255,255,0.055)", marginBottom:18 }} />

        {/* レーダーチャート（少し大きく） */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
          <RadarSVG data={radarData} color={tc} size={210} />
        </div>

        {/* フッター */}
        <div style={{ marginTop:"auto", paddingTop:16, display:"flex",
          justifyContent:"space-between", alignItems:"flex-end" }}>
          <div style={{ fontFamily:"monospace", fontSize:7, color:"rgba(55,80,135,0.42)",
            letterSpacing:"0.14em", lineHeight:2 }}>
            <div>SCORE-BASED ANALYSIS</div>
            <div>CLAUDE · LITERARY OUTPUT</div>
          </div>
          <div style={{
            fontFamily:"'Cormorant Garamond', Georgia, serif",
            fontStyle:"italic", fontWeight:300,
            fontSize:22, letterSpacing:"0.1em",
            color:`${tc}66`,
            textShadow:`0 0 12px ${tc}44`,
          }}>
            Noema
          </div>
        </div>
      </div>
    </div>
  );
});

// ───────────────────────────────────────────────────────────────
//  useSaveImage フック — 真っ暗問題対応版
// ───────────────────────────────────────────────────────────────
function useSaveImage(cardRef, wrapperRef) {
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [saveErr, setSaveErr] = useState(null);

  const save = useCallback(async () => {
    if (!cardRef.current || saving) return;
    setSaving(true); setSaved(false); setSaveErr(null);

    // ── ① capture直前にwrapperを一時的にvisibleにする
    //    opacity:0のままだとhtml2canvasが正常描画できないブラウザがある
    const wrapper = wrapperRef?.current;
    if (wrapper) {
      wrapper.style.opacity = "1";
      wrapper.style.left    = "-9999px";
      wrapper.style.top     = "0px";
    }

    try {
      const h2c = await loadHtml2Canvas();

      // ── ② フォント・画像の完全ロードを待つ
      await document.fonts.ready;

      // ── ③ DOMの描画が確実に完了するまで待機（Safari対策）
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise(r => setTimeout(r, 150));

      const el = cardRef.current;
      if (!el) throw new Error("capture target not found");

      const canvas = await h2c(el, {
        backgroundColor:    "#090b10",   // 背景色を明示（透明防止）
        scale:              3,            // 3x → 1620×2880（高解像度）
        useCORS:            true,
        allowTaint:         false,        // taintは使わない（Safari互換）
        logging:            false,
        imageTimeout:       8000,
        removeContainer:    true,
        // html2canvas は width/height を明示すると確実
        width:              el.offsetWidth,
        height:             el.offsetHeight,
        scrollX:            0,
        scrollY:            0,
        windowWidth:        el.offsetWidth,
        windowHeight:       el.offsetHeight,
        // foreignObjectレンダリングを無効化（Safari問題回避）
        foreignObjectRendering: false,
        // backdrop-filterを無視させる
        ignoreElements: (node) => {
          const s = window.getComputedStyle(node);
          return !!(s.backdropFilter && s.backdropFilter !== "none");
        },
      });

      // ── ④ 描画されたcanvasのピクセルを検証（真っ暗チェック）
      const ctx   = canvas.getContext("2d");
      const pixel = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
      const isBlack = pixel[0] < 20 && pixel[1] < 20 && pixel[2] < 20 && pixel[3] > 200;
      // 背景色 #090b10 はR=9,G=11,B=16 → これは正常な黒なのでスルー
      // 真っ透明(alpha=0)なら異常
      if (pixel[3] < 50) {
        throw new Error("canvas rendered transparent — DOM may not be ready");
      }

      await new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) { reject(new Error("toBlob failed")); return; }
          const filename = `noema-${Date.now()}.png`;

          // ── ⑤ Web Share API（スマホ: iOS/Android）
          if (
            navigator.share &&
            typeof navigator.canShare === "function" &&
            navigator.canShare({ files: [new File([blob], filename, { type: "image/png" })] })
          ) {
            try {
              await navigator.share({
                title: "AI思想チェッカー — 診断結果",
                files: [new File([blob], filename, { type: "image/png" })],
              });
            } catch (e) {
              if (e.name !== "AbortError") fallbackDownload(blob, filename);
            }
          } else {
            fallbackDownload(blob, filename);
          }
          setSaved(true);
          setTimeout(() => setSaved(false), 3500);
          resolve();
        }, "image/png", 1.0);
      });

    } catch (e) {
      console.error("[useSaveImage]", e);
      setSaveErr(`保存に失敗しました: ${e.message ?? "不明なエラー"}`);
      setTimeout(() => setSaveErr(null), 5000);
    } finally {
      // ── ⑥ 必ずwrapperを元に戻す
      if (wrapper) {
        wrapper.style.opacity = "0";
      }
      setSaving(false);
    }
  }, [cardRef, wrapperRef, saving]);

  return { save, saving, saved, saveErr };
}

// スコアバー（アニメーション付き）
function ScoreBar({ label, value, color, delay=0 }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 100 + delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontFamily:"var(--f-mono)", fontSize:10, color:"var(--c-muted)", letterSpacing:"0.08em" }}>{label}</span>
        <span style={{ fontFamily:"var(--f-mono)", fontSize:10, color, letterSpacing:"0.05em",
          animation:`countUp 0.5s ease ${delay/1000 + 0.8}s both` }}>{value}</span>
      </div>
      <div style={{ height:2, background:"rgba(255,255,255,0.05)", borderRadius:2, overflow:"hidden" }}>
        <div className="score-bar-fill" style={{
          width:`${width}%`,
          background:`linear-gradient(90deg, ${color}55, ${color})`,
          boxShadow:`0 0 8px ${color}44`,
          transitionDelay:`${delay}ms`,
        }} />
      </div>
    </div>
  );
}

// 思想マップ
function ThoughtMap({ traits }) {
  const dotX = 15 + ((traits?.freedom ?? 50) / 100) * 70;
  const dotY = 15 + ((100 - (traits?.idealism ?? 50)) / 100) * 70;
  return (
    <div style={{ position:"relative", width:"100%", paddingBottom:"100%", maxWidth:240, margin:"0 auto" }}>
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.3)",
        border:"1px solid rgba(255,255,255,0.05)", borderRadius:14, overflow:"hidden" }}>
        {/* グリッド */}
        {[25,50,75].map(p => (
          <div key={p}>
            <div style={{ position:"absolute", left:`${p}%`, top:0, bottom:0, width:1, background:"rgba(255,255,255,0.025)" }} />
            <div style={{ position:"absolute", top:`${p}%`, left:0, right:0, height:1, background:"rgba(255,255,255,0.025)" }} />
          </div>
        ))}
        {/* ラベル */}
        {[["理想",{top:7,left:"50%",transform:"translateX(-50%)"}],["現実",{bottom:7,left:"50%",transform:"translateX(-50%)"}],
          ["安定",{left:7,top:"50%",transform:"translateY(-50%)"}],["自由",{right:7,top:"50%",transform:"translateY(-50%)"}]
        ].map(([t,p]) => (
          <div key={t} style={{ position:"absolute", color:"rgba(110,125,150,0.45)", fontSize:8, fontFamily:"var(--f-mono)", ...p }}>{t}</div>
        ))}
        {/* 他ユーザー点 */}
        {[[35,60],[60,30],[70,70],[25,40],[55,55],[45,75],[65,45]].map(([x,y],i) => (
          <div key={i} style={{ position:"absolute", left:`${x}%`, top:`${y}%`,
            width:4, height:4, borderRadius:"50%", transform:"translate(-50%,-50%)",
            background:"rgba(100,115,145,0.18)", border:"1px solid rgba(100,115,145,0.1)" }} />
        ))}
        {/* 自分のドット */}
        <div style={{ position:"absolute", left:`${dotX}%`, top:`${dotY}%`,
          width:13, height:13, borderRadius:"50%", transform:"translate(-50%,-50%)",
          background:"radial-gradient(circle at 35% 35%, #9dc8f0, #4a7aaa)",
          boxShadow:"0 0 16px rgba(100,160,210,0.6), 0 0 32px rgba(100,160,210,0.25)",
          animation:"pulseDot 2.8s ease-in-out infinite",
          zIndex:2 }} />
      </div>
    </div>
  );
}

// ── 思想解析ローディング画面
function ThinkingScreen() {
  // ── 解析ステップ（要件通りのテキスト）
  const STEPS = [
    { id:"s0", label:"思想構造解析中",    sub:"THOUGHT STRUCTURE SCAN",    pct: 14 },
    { id:"s1", label:"存在論マッピング中", sub:"ONTOLOGICAL MAPPING",       pct: 32 },
    { id:"s2", label:"矛盾抽出中",        sub:"CONTRADICTION EXTRACTION",  pct: 54 },
    { id:"s3", label:"社会距離測定中",    sub:"SOCIAL DISTANCE METERING",  pct: 73 },
    { id:"s4", label:"言語ノイズ除去中",  sub:"LINGUISTIC NOISE REDUCTION",pct: 91 },
  ];

  const [stepIdx,   setStepIdx]   = useState(0);
  const [stepState, setStepState] = useState("in");   // "in" | "out"
  const [pct,       setPct]       = useState(0);
  const [counter,   setCounter]   = useState(0);
  const [scanY,     setScanY]     = useState(0);
  const [glitchOn,  setGlitchOn]  = useState(false);

  // ステップ切り替え（1000ms表示 → 300msフェードアウト → 次へ）
  useEffect(() => {
    const totalMs = 1300;
    const fadeMs  = 300;
    let step = 0;

    const advance = () => {
      setStepState("out");
      setTimeout(() => {
        step = (step + 1) % STEPS.length;
        setStepIdx(step);
        setPct(STEPS[step].pct);
        setStepState("in");
      }, fadeMs);
    };

    // 初期表示
    setPct(STEPS[0].pct);
    const id = setInterval(advance, totalMs);
    return () => clearInterval(id);
  }, []);

  // カウンター（0→100を12秒で）
  useEffect(() => {
    const id = setInterval(() => setCounter(c => Math.min(99, c + 1)), 120);
    return () => clearInterval(id);
  }, []);

  // スキャンライン Y座標
  useEffect(() => {
    const id = setInterval(() => setScanY(y => (y + 1.8) % 110), 30);
    return () => clearInterval(id);
  }, []);

  // グリッチ（ランダム発火）
  useEffect(() => {
    const fire = () => {
      if (Math.random() < 0.3) {
        setGlitchOn(true);
        setTimeout(() => setGlitchOn(false), 180);
      }
    };
    const id = setInterval(fire, 2800);
    return () => clearInterval(id);
  }, []);

  const step = STEPS[stepIdx];

  // ── SVG リング半径設定
  const R1 = 52, R2 = 42, R3 = 32, R4 = 22;
  const circ = (r) => 2 * Math.PI * r;

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:50,
      background:"#090b10",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      fontFamily:"var(--f-mono)",
      overflow:"hidden",
    }}>

      {/* ── 背景グロー ── */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
        <div style={{ position:"absolute", width:500, height:500,
          top:"50%", left:"50%", transform:"translate(-50%,-50%)",
          background:"radial-gradient(ellipse, rgba(40,80,160,0.14) 0%, rgba(80,40,140,0.08) 50%, transparent 70%)",
          animation:"glowPulse 4s ease-in-out infinite" }} />
      </div>

      {/* ── CRT 水平ライン ── */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none",
        background:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.07) 3px,rgba(0,0,0,0.07) 4px)" }} />

      {/* ── スキャンライン（縦移動） ── */}
      <div style={{ position:"absolute", left:0, right:0, pointerEvents:"none",
        top:`${scanY}%`, height:"2px", zIndex:2,
        background:"linear-gradient(90deg,transparent 0%,rgba(80,160,220,0.0) 10%,rgba(80,180,240,0.22) 35%,rgba(100,200,255,0.38) 50%,rgba(80,180,240,0.22) 65%,rgba(80,160,220,0.0) 90%,transparent 100%)",
        boxShadow:"0 0 14px rgba(80,180,240,0.2), 0 0 30px rgba(80,160,220,0.08)",
      }} />

      {/* ── ホライゾンスキャン（横） ── */}
      <div style={{ position:"absolute", top:"30%", left:0, right:0,
        height:1, pointerEvents:"none", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:0, width:"60%", height:"100%",
          background:"linear-gradient(90deg,transparent,rgba(120,80,200,0.28),transparent)",
          animation:"horizScan 4s ease-in-out 1.5s infinite" }} />
      </div>

      {/* ── メインコンテンツ ── */}
      <div style={{ position:"relative", zIndex:10, width:"100%", maxWidth:400, padding:"0 28px", textAlign:"center" }}>

        {/* ── SVG 多重リング ── */}
        <div style={{ position:"relative", width:140, height:140, margin:"0 auto 36px" }}>
          <svg width="140" height="140" viewBox="0 0 140 140"
            style={{ position:"absolute", inset:0, animation:"ringGlow 3s ease-in-out infinite", overflow:"visible" }}>

            {/* 外リング（回転トラック） */}
            <circle cx="70" cy="70" r={R1} fill="none"
              stroke="rgba(80,120,180,0.1)" strokeWidth="1" />
            {/* 外リング（プログレス） */}
            <circle cx="70" cy="70" r={R1} fill="none"
              stroke="rgba(80,160,220,0.7)" strokeWidth="1.5"
              strokeDasharray={`${(pct/100)*circ(R1)} ${circ(R1)}`}
              strokeDashoffset="0"
              strokeLinecap="round"
              transform="rotate(-90 70 70)"
              style={{ transition:"stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }} />

            {/* 第2リング（逆回転） */}
            <g style={{ transformOrigin:"70px 70px", animation:"ringSpinB 7s linear infinite" }}>
              <circle cx="70" cy="70" r={R2} fill="none"
                stroke="rgba(120,80,200,0.15)" strokeWidth="1"
                strokeDasharray="4 8" />
              <circle cx="70" cy={70-R2} r="2.5" fill="rgba(120,80,220,0.8)"
                style={{ filter:"drop-shadow(0 0 4px rgba(120,80,220,0.9))" }} />
            </g>

            {/* 第3リング（正回転） */}
            <g style={{ transformOrigin:"70px 70px", animation:"ringSpinC 5s linear infinite" }}>
              <circle cx="70" cy="70" r={R3} fill="none"
                stroke="rgba(60,160,180,0.12)" strokeWidth="1"
                strokeDasharray="2 6" />
              <circle cx="70" cy={70-R3} r="2" fill="rgba(60,180,200,0.85)"
                style={{ filter:"drop-shadow(0 0 3px rgba(60,180,200,0.9))" }} />
            </g>

            {/* 第4リング（逆高速） */}
            <g style={{ transformOrigin:"70px 70px", animation:"ringSpinD 3.2s linear infinite" }}>
              <circle cx="70" cy="70" r={R4} fill="none"
                stroke="rgba(80,140,210,0.1)" strokeWidth="0.8"
                strokeDasharray="3 10" />
            </g>

            {/* 中心コア */}
            <circle cx="70" cy="70" r="8" fill="none"
              stroke="rgba(80,160,220,0.5)" strokeWidth="1" />
            <circle cx="70" cy="70" r="4"
              fill="rgba(80,170,230,0.9)"
              style={{
                animation:"corePulse 2s ease-in-out infinite",
                filter:"drop-shadow(0 0 5px rgba(80,170,230,1)) drop-shadow(0 0 12px rgba(80,150,220,0.6))",
                transformOrigin:"70px 70px",
              }} />

            {/* 十字マーク */}
            <line x1="70" y1="64" x2="70" y2="68" stroke="rgba(80,170,230,0.6)" strokeWidth="0.8"/>
            <line x1="70" y1="72" x2="70" y2="76" stroke="rgba(80,170,230,0.6)" strokeWidth="0.8"/>
            <line x1="64" y1="70" x2="68" y2="70" stroke="rgba(80,170,230,0.6)" strokeWidth="0.8"/>
            <line x1="72" y1="70" x2="76" y2="70" stroke="rgba(80,170,230,0.6)" strokeWidth="0.8"/>
          </svg>

          {/* カウンター（中央） */}
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:11, color:"rgba(80,170,230,0.8)", letterSpacing:"0.05em",
              animation:"numFlicker 1.1s ease-in-out infinite" }}>
              {String(counter).padStart(2,"0")}
            </span>
          </div>
        </div>

        {/* ── ステップテキスト（フェード切り替え） ── */}
        <div style={{ height:56, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", marginBottom:28 }}>

          <div key={step.id} className={stepState === "in" ? "step-in" : "step-out"}
            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>

            {/* メインラベル（グリッチ付き） */}
            <div style={{ position:"relative" }}>
              <span style={{
                fontSize:15, color:"rgba(200,215,240,0.92)",
                letterSpacing:"0.12em",
                fontFamily:"var(--f-jp)", fontWeight:300,
                animation: glitchOn ? "glitch 0.18s steps(1) forwards" : "none",
              }}>
                {step.label}
                <span className="cursor-blink" style={{ marginLeft:2, color:"rgba(80,170,230,0.9)" }}>_</span>
              </span>
              {/* グリッチコピー（色ズレ） */}
              {glitchOn && (
                <span aria-hidden="true" style={{
                  position:"absolute", left:0, top:0, pointerEvents:"none",
                  fontSize:15, letterSpacing:"0.12em",
                  fontFamily:"var(--f-jp)", fontWeight:300,
                  color:"rgba(220,60,100,0.45)",
                  transform:"translate(2px,-1px)",
                  mixBlendMode:"screen",
                  animation:"glitchClip 0.18s steps(1) forwards",
                }}>
                  {step.label}
                </span>
              )}
            </div>

            {/* サブラベル */}
            <span style={{ fontSize:8, color:"rgba(80,130,190,0.6)", letterSpacing:"0.22em" }}>
              {step.sub}
            </span>
          </div>
        </div>

        {/* ── プログレスバー（セグメント式） ── */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:8, color:"rgba(60,110,170,0.55)", letterSpacing:"0.2em" }}>
              ANALYSIS PROGRESS
            </span>
            <span style={{ fontSize:8, color:"rgba(80,160,220,0.7)", letterSpacing:"0.1em",
              animation:"numFlicker 0.9s ease-in-out infinite" }}>
              {pct}%
            </span>
          </div>

          {/* セグメント30個 */}
          <div style={{ display:"flex", gap:2 }}>
            {Array.from({length:30}).map((_,i) => {
              const filled = i < Math.round(pct / 100 * 30);
              const isEdge  = filled && i === Math.round(pct / 100 * 30) - 1;
              return (
                <div key={i} style={{
                  flex:1, height:3, borderRadius:1,
                  background: filled
                    ? isEdge
                      ? "rgba(80,160,220,0.9)"
                      : "rgba(80,140,200,0.55)"
                    : "rgba(255,255,255,0.05)",
                  boxShadow: isEdge ? "0 0 6px rgba(80,160,220,0.8)" : "none",
                  transition:`background 0.3s ease ${i*0.015}s`,
                  animation: isEdge ? "segBlink 0.8s ease-in-out infinite" : "none",
                }} />
              );
            })}
          </div>
        </div>

        {/* ── ログ行（スクロールするステータス） ── */}
        <div style={{ padding:"10px 14px",
          background:"rgba(0,0,0,0.3)", border:"1px solid rgba(80,120,160,0.12)",
          borderRadius:8, textAlign:"left" }}>
          {STEPS.map((s, i) => {
            const done    = i < stepIdx;
            const current = i === stepIdx;
            return (
              <div key={s.id} style={{
                display:"flex", alignItems:"center", gap:8,
                marginBottom: i < STEPS.length-1 ? 5 : 0,
                opacity: done ? 0.35 : current ? 1 : 0.2,
                transition:"opacity 0.4s ease",
              }}>
                <span style={{ fontSize:8, width:10, textAlign:"center",
                  color: done ? "rgba(80,200,120,0.8)" : current ? "rgba(80,170,230,0.9)" : "rgba(100,120,160,0.4)" }}>
                  {done ? "✓" : current ? "▶" : "·"}
                </span>
                <span style={{ fontSize:8, letterSpacing:"0.12em",
                  color: done ? "rgba(80,200,120,0.65)" : current ? "rgba(140,180,230,0.85)" : "rgba(80,100,140,0.4)" }}>
                  {s.sub}
                </span>
                {current && (
                  <span style={{ marginLeft:"auto", fontSize:8,
                    color:"rgba(80,160,220,0.6)", animation:"numFlicker 0.7s ease-in-out infinite" }}>
                    RUNNING
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── システム情報 ── */}
        <div style={{ marginTop:18, display:"flex", justifyContent:"space-between",
          padding:"0 2px" }}>
          <span style={{ fontSize:7, color:"rgba(60,100,150,0.4)", letterSpacing:"0.14em" }}>
            CLAUDE · SONNET-4
          </span>
          <span style={{ fontSize:7, color:"rgba(60,100,150,0.4)", letterSpacing:"0.14em" }}>
            NOEMA ANALYSIS ENGINE
          </span>
        </div>
      </div>
    </div>
  );
}

// エラーバナー
function ErrorBanner({ message, onRetry }) {
  return (
    <div className="phase-enter" style={{ padding:"18px 20px", marginBottom:20,
      background:"rgba(160,50,50,0.07)", border:"1px solid rgba(190,70,70,0.18)",
      borderRadius:14 }}>
      <p style={{ color:"rgba(220,150,150,0.9)", fontSize:13, lineHeight:1.8, marginBottom:12,
        fontFamily:"var(--f-jp)" }}>⚠ {message}</p>
      {onRetry && (
        <button onClick={onRetry} style={{ padding:"7px 18px",
          background:"rgba(160,50,50,0.12)", border:"1px solid rgba(190,70,70,0.2)",
          borderRadius:8, color:"rgba(220,150,150,0.85)", fontSize:11, cursor:"pointer",
          fontFamily:"var(--f-mono)", letterSpacing:"0.08em" }}>RETRY</button>
      )}
    </div>
  );
}

// セクションラベル
function SLabel({ children, color="rgba(90,130,180,0.8)" }) {
  return (
    <div style={{ fontFamily:"var(--f-mono)", fontSize:9, color, letterSpacing:"0.22em",
      textTransform:"uppercase", marginBottom:14, display:"flex", alignItems:"center", gap:7 }}>
      <span style={{ fontSize:8 }}>◈</span> {children}
    </div>
  );
}

// カード
function Card({ children, style={}, className="", hover=true }) {
  return (
    <div className={`${hover?"card-hover":""} ${className}`} style={{
      background:"rgba(255,255,255,0.022)", border:"1px solid var(--c-border)",
      borderRadius:18, padding:22, backdropFilter:"blur(12px)",
      marginBottom:16, position:"relative", ...style,
    }}>
      {children}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
//  メインコンポーネント
// ───────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase]           = useState("home");
  const [currentQId, setCurrentQId] = useState("root");
  const [answers, setAnswers]       = useState([]);
  const [selected, setSelected]     = useState(null);
  const [result, setResult]         = useState(null);
  const [apiError, setApiError]     = useState(null);
  const [apiErrorCode, setApiErrorCode] = useState(null); // エラーコード分類
  const [pendingRun, setPendingRun] = useState(null);
  const [retryCount, setRetryCount] = useState(0);        // リトライ回数表示

  // 会話UI用
  const [showReaction, setShowReaction] = useState(false);
  const [showTyping,   setShowTyping]   = useState(false);
  const [showQuestion, setShowQuestion] = useState(true);
  const [qKey, setQKey]                 = useState(0);

  const containerRef    = useRef(null);
  const shareCardRef    = useRef(null);
  const shareWrapperRef = useRef(null);
  const { save, saving, saved, saveErr } = useSaveImage(shareCardRef, shareWrapperRef);

  // useMemo で毎レンダーの再計算を防ぐ
  const currentQ      = Q_TREE[currentQId];
  const answeredCount = answers.length;

  const radarData = React.useMemo(() => result?.traits ? [
    { axis:"自由",  value: result.traits.freedom },
    { axis:"理想",  value: result.traits.idealism },
    { axis:"感情",  value: result.traits.emotion },
    { axis:"ロマン",value: result.traits.romanticism },
    { axis:"孤独",  value: result.traits.loneliness },
    { axis:"論理",  value: result.traits.logic },
  ] : [], [result?.traits]);

  const typeEntry = React.useMemo(() =>
    result ? THOUGHT_TYPES.find(t => t.name === result.typeName) : null,
  [result?.typeName]);

  useEffect(() => {
    containerRef.current?.scrollTo({ top:0, behavior:"smooth" });
  }, [currentQId, phase]);

  const handleSelect = useCallback((opt) => setSelected(opt), []);

  const handleNext = useCallback(() => {
    if (!selected) return;

    // ── selected を先に保存してからnullにする（クロージャでの安全な参照のため）
    const savedSelected = selected;

    const newAnswers = [...answers, {
      question: currentQ.text,
      answer:   savedSelected.label,
      scores:   savedSelected.scores,
      qId:      currentQId,
    }];
    setAnswers(newAnswers);
    setSelected(null);

    // 最終問（nextId === null）
    if (!savedSelected.nextId) {
      runDiagnosis(newAnswers);
      return;
    }

    const reaction = Q_TREE[savedSelected.nextId]?.reaction;

    // ── リアクション → タイピング → 次の質問 のシーケンス
    setShowQuestion(false);

    if (reaction) {
      setPendingReaction(reaction);
      setShowReaction(false);
      setShowTyping(true);
      setTimeout(() => {
        setShowTyping(false);
        setShowReaction(true);
        setTimeout(() => {
          setShowReaction(false);
          setCurrentQId(savedSelected.nextId);
          setQKey(k => k + 1);
          setShowQuestion(true);
        }, 1200);
      }, 900);
    } else {
      setTimeout(() => {
        setCurrentQId(savedSelected.nextId);
        setQKey(k => k + 1);
        setShowQuestion(true);
      }, 200);
    }
  }, [selected, currentQ, currentQId, answers]);

  const runDiagnosis = useCallback(async (allAnswers) => {
    setPhase("thinking");
    setApiError(null);
    setApiErrorCode(null);
    setPendingRun(() => () => runDiagnosis(allAnswers));
    const traits       = calcTraits(allAnswers);
    const typeEntry    = resolveType(traits);
    const philosophers = resolvePhilosophers(traits);
    const mainPhil     = philosophers[0];
    let analysis;
    try {
      analysis = await generateAnalysis({
        answers: allAnswers, traits,
        typeName: typeEntry.name, philosopher: mainPhil,
      });
    } catch(e) {
      analysis = null;
      // エラー分類をstateに保存（エラー画面で分岐表示用）
      const code = e?.code ?? "UNKNOWN";
      setApiErrorCode(code);
      console.warn("[diagnosis] API failed:", code, e?.message);
    }
    // API失敗でも必ずフォールバックで結果を出す
    if (!analysis?.quote) analysis = getFallback(typeEntry.id);
    setResult({
      typeName: typeEntry.name, typeColor: typeEntry.color,
      typeId: typeEntry.id, traits, philosophers, ...analysis,
    });
    setPhase("result");
  }, []);

  const handleRetry = useCallback(() => pendingRun?.(), [pendingRun]);
  const [copied, setCopied] = useState(false);

  const shareToX = useCallback(() => {
    if (!result) return;
    const typeEntry = THOUGHT_TYPES.find(t => t.name === result.typeName);
    const text = typeEntry?.xText
      ?? `「${result.quote ?? result.typeName}」— #AI思想チェッカー #Noema`;
    const url = encodeURIComponent(window.location.href);
    const tweet = encodeURIComponent(text);
    window.open(`https://twitter.com/intent/tweet?text=${tweet}&url=${url}`, "_blank", "noopener");
  }, [result]);

  const copyURL = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // フォールバック
      const el = document.createElement("input");
      el.value = window.location.href;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }, []);
  const restart = useCallback(() => {
    setPhase("home"); setCurrentQId("root"); setAnswers([]);
    setSelected(null); setResult(null); setApiError(null); setApiErrorCode(null);
    setShowReaction(false); setShowTyping(false); setShowQuestion(true);
    setQKey(0); setPendingReaction(null); setRetryCount(0);
  }, []);

  // リアクション文（pendingReactionはstate経由で保持する）
  const [pendingReaction, setPendingReaction] = useState(null);

  // タイプ別グロー（useMemo化）
  const resultGlowColors = React.useMemo(() => {
    if (!result) return null;
    const te = THOUGHT_TYPES.find(t => t.name === result.typeName);
    return te?.glow ?? ["rgba(40,55,110,0.55)","rgba(55,35,100,0.4)","rgba(30,50,90,0.28)"];
  }, [result?.typeName]);

  return (
    <div style={{ minHeight:"100vh", background:"var(--c-bg)", color:"var(--c-text)",
      fontFamily:"var(--f-jp)", position:"relative" }}>
      <style>{GLOBAL_CSS}</style>

      {/* 動的背景グロー */}
      <GlowOrbs phase={phase} />

      {/* タイプ別結果背景グロー */}
      {phase === "result" && resultGlowColors && (() => {
        const [g1, g2, g3] = resultGlowColors;
        return (
          <>
            <div style={{ position:"fixed", width:580, height:580, top:-160, right:-160, borderRadius:"50%",
              background:`radial-gradient(circle, ${g1} 0%, transparent 68%)`,
              pointerEvents:"none", zIndex:0,
              animation:"resultGlow1 18s ease-in-out infinite" }} />
            <div style={{ position:"fixed", width:480, height:480, bottom:-140, left:-140, borderRadius:"50%",
              background:`radial-gradient(circle, ${g2} 0%, transparent 68%)`,
              pointerEvents:"none", zIndex:0,
              animation:"resultGlow2 14s ease-in-out 2s infinite" }} />
            <div style={{ position:"fixed", width:280, height:280, top:"50%", left:"50%",
              transform:"translate(-50%,-50%)", borderRadius:"50%",
              background:`radial-gradient(circle, ${g3} 0%, transparent 68%)`,
              pointerEvents:"none", zIndex:0,
              animation:"resultGlow3 8s ease-in-out 1s infinite" }} />
          </>
        );
      })()}

      {/* ノイズオーバーレイ */}
      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", opacity:0.025,
        backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
        backgroundRepeat:"repeat", backgroundSize:"128px" }} />

      {/* スクロールコンテナ */}
      <div ref={containerRef}
        className="scroll-container safe-bottom"
        style={{ position:"relative", zIndex:1,
          maxWidth:600, margin:"0 auto", padding:"0 20px 96px",
          overflowY:"auto", maxHeight:"100vh",
          WebkitOverflowScrolling:"touch",  // iOS Safari用
        }}>

        {/* ══ HOME ══════════════════════════════════════════════ */}
        {phase === "home" && (
          <>
            {/* ホーム専用レイヤー（粒子・スキャンライン等） */}
            <HomeOverlays />
            <HomeParticles />

            <div className="phase-enter" style={{
              textAlign:"center", paddingTop:72, paddingBottom:56,
              position:"relative", zIndex:10, isolation:"isolate",
            }}>

              {/* ── システムID行 ── */}
              <div style={{ fontFamily:"var(--f-mono)", fontSize:9, color:"rgba(70,120,180,0.55)",
                letterSpacing:"0.28em", marginBottom:10,
                display:"flex", justifyContent:"center", alignItems:"center", gap:8 }}>
                <span>SYS</span>
                <span style={{ color:"rgba(255,255,255,0.1)" }}>·</span>
                <span>NOEMA_v4.0</span>
                <span style={{ color:"rgba(255,255,255,0.1)" }}>·</span>
                <span>INIT<span className="cursor-blink">_</span></span>
              </div>

              {/* ── ステータスバッジ ── */}
              <div className="home-badge" style={{
                display:"inline-flex", alignItems:"center", gap:8, padding:"5px 16px",
                background:"rgba(40,65,115,0.14)", border:"1px solid rgba(75,115,190,0.2)",
                borderRadius:999, marginBottom:30,
              }}>
                <div className="status-dot" style={{ width:5, height:5, borderRadius:"50%",
                  background:"rgba(80,210,140,0.75)" }} />
                <span style={{ fontFamily:"var(--f-mono)", fontSize:9,
                  color:"rgba(90,150,215,0.75)", letterSpacing:"0.2em" }}>
                  思想解析装置 · ONLINE
                </span>
              </div>

              {/* ── メインタイトル ── */}
              <div style={{ position:"relative", marginBottom:6 }}>
                {/* 後ろのぼんやりしたコピー（奥行き感） */}
                <h1 aria-hidden="true" style={{
                  position:"absolute", inset:0,
                  fontFamily:"var(--f-serif)", fontStyle:"italic", fontWeight:300,
                  fontSize:"clamp(38px,8vw,62px)", lineHeight:1.12, letterSpacing:"-0.01em",
                  background:"linear-gradient(160deg,rgba(80,130,220,0.25) 0%,rgba(120,80,200,0.2) 100%)",
                  WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                  filter:"blur(12px)", transform:"translateY(2px) scale(1.01)",
                  pointerEvents:"none", userSelect:"none",
                }}>
                  AI 思想チェッカー
                </h1>
                {/* 本体タイトル */}
                <h1 className="home-title" style={{
                  position:"relative",
                  fontFamily:"var(--f-serif)", fontStyle:"italic", fontWeight:300,
                  fontSize:"clamp(38px,8vw,62px)", lineHeight:1.12, letterSpacing:"-0.01em",
                  marginBottom:0,
                  background:"linear-gradient(160deg,rgba(228,233,248,0.97) 0%,rgba(145,178,230,0.93) 42%,rgba(168,132,218,0.9) 100%)",
                  WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                }}>
                  AI 思想チェッカー
                </h1>
              </div>

              {/* ── サブタイトル区切り線 ── */}
              <div style={{ display:"flex", alignItems:"center", gap:12, justifyContent:"center", margin:"18px auto 22px", maxWidth:320 }}>
                <div className="line-expand" style={{ flex:1, height:1,
                  background:"linear-gradient(90deg,transparent,rgba(80,120,180,0.35))" }} />
                <span style={{ fontFamily:"var(--f-mono)", fontSize:8,
                  color:"rgba(80,120,180,0.55)", letterSpacing:"0.22em", whiteSpace:"nowrap" }}>
                  THOUGHT ANALYSIS SYSTEM
                </span>
                <div className="line-expand" style={{ flex:1, height:1,
                  background:"linear-gradient(90deg,rgba(80,120,180,0.35),transparent)" }} />
              </div>

              {/* ── 説明文 ── */}
              <p style={{ fontFamily:"var(--f-jp)", color:"rgba(145,160,192,0.75)", fontSize:14,
                lineHeight:2.05, maxWidth:360, margin:"0 auto 36px", fontWeight:200 }}>
                8つの問いに答えるだけ。<br />
                思想スコアを計算し、あなたの価値観の構造を<br />
                AIが文学的に可視化します。
              </p>

              {/* ── 解析項目パネル ── */}
              <div className="home-card" style={{
                textAlign:"left", marginBottom:28, padding:22,
                background:"rgba(10,14,24,0.7)", backdropFilter:"blur(18px)",
                border:"1px solid rgba(80,110,170,0.15)",
                borderRadius:18, position:"relative", overflow:"hidden",
              }}>
                {/* パネル内スキャングロー */}
                <div style={{ position:"absolute", top:0, left:0, right:0, height:1,
                  background:"linear-gradient(90deg,transparent 0%,rgba(80,140,210,0.3) 40%,rgba(80,140,210,0.3) 60%,transparent 100%)",
                  animation:"shimmer 3s ease-in-out infinite" }} />
                <div style={{ position:"absolute", bottom:0, left:0, right:0, height:1,
                  background:"linear-gradient(90deg,transparent 0%,rgba(120,80,200,0.15) 50%,transparent 100%)" }} />

                {/* ヘッダー */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                  <div style={{ fontFamily:"var(--f-mono)", fontSize:9, color:"rgba(80,130,190,0.75)",
                    letterSpacing:"0.22em" }}>ANALYSIS · PARAMETERS</div>
                  <div style={{ display:"flex", gap:5 }}>
                    {["rgba(230,80,80,0.5)","rgba(220,170,60,0.5)","rgba(60,180,100,0.5)"].map((c,i) => (
                      <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:c }} />
                    ))}
                  </div>
                </div>

                {/* 項目グリッド */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px 16px" }}>
                  {[
                    ["自由 ↔ 安定",   "freedom / stability"],
                    ["理想 ↔ 現実",   "idealism / realism"],
                    ["論理 ↔ 感情",   "logic / emotion"],
                    ["孤独耐性",       "loneliness index"],
                    ["虚無傾向",       "nihilism score"],
                    ["ロマン主義",     "romanticism"],
                    ["共同体志向",     "community"],
                    ["哲学者親和性",   "philosopher affinity"],
                  ].map(([jp, en], i) => (
                    <div key={i} style={{ display:"flex", flexDirection:"column", gap:2,
                      padding:"7px 10px",
                      background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.04)",
                      borderRadius:8, animation:`fadeUp 0.5s ease ${0.05 + i*0.05}s both` }}>
                      <span style={{ fontFamily:"var(--f-jp)", fontSize:11,
                        color:"rgba(185,200,228,0.8)", fontWeight:300 }}>{jp}</span>
                      <span style={{ fontFamily:"var(--f-mono)", fontSize:8,
                        color:"rgba(90,120,170,0.55)", letterSpacing:"0.1em" }}>{en}</span>
                    </div>
                  ))}
                </div>

                {/* フッター */}
                <div style={{ marginTop:14, paddingTop:12,
                  borderTop:"1px solid rgba(255,255,255,0.04)",
                  display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontFamily:"var(--f-mono)", fontSize:8,
                    color:"rgba(70,110,170,0.5)", letterSpacing:"0.15em" }}>10 AXES · 8 QUESTIONS</span>
                  <span style={{ fontFamily:"var(--f-mono)", fontSize:8,
                    color:"rgba(80,160,130,0.6)", letterSpacing:"0.12em" }}>SCORE-BASED TYPING</span>
                </div>
              </div>

              {/* ── 注意書き ── */}
              <p style={{ fontFamily:"var(--f-mono)", fontSize:8, color:"rgba(80,100,140,0.5)",
                letterSpacing:"0.12em", marginBottom:28, lineHeight:1.8 }}>
                CLAUDE API · LITERARY ANALYSIS · NON-DETERMINISTIC OUTPUT
              </p>

              {/* ── 起動ボタン ── */}
              <button className="btn-start" onClick={() => setPhase("quiz")}>
                <span style={{ fontFamily:"var(--f-mono)", fontSize:9,
                  color:"rgba(100,155,210,0.6)", letterSpacing:"0.15em" }}>▶</span>
                診断をはじめる
              </button>

              {/* ── フッターメタ ── */}
              <div style={{ marginTop:40, display:"flex", justifyContent:"center",
                gap:20, alignItems:"center" }}>
                {["SCORE ANALYSIS","PHILOSOPHER MATCH","LITERARY OUTPUT"].map((t, i) => (
                  <span key={i} style={{ fontFamily:"var(--f-mono)", fontSize:7,
                    color:"rgba(70,100,150,0.4)", letterSpacing:"0.14em" }}>{t}</span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══ QUIZ ══════════════════════════════════════════════ */}
        {phase === "quiz" && currentQ && (
          <div className="phase-quiz" style={{ paddingTop:44 }}>

            {/* ── ヘッダー：深度インジケーター ── */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:28 }}>
              {/* 分岐深度ドット */}
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontFamily:"var(--f-mono)", fontSize:9, color:"var(--c-dim)", letterSpacing:"0.15em", marginRight:4 }}>
                  DEPTH
                </span>
                {[0,1,2,3,4].map(i => {
                  const filled  = i <= (currentQ.layer ?? 0);
                  const current = i === (currentQ.layer ?? 0);
                  return (
                    <div key={i} className={current ? "depth-dot-active" : ""}
                      style={{
                        width: current ? 8 : 5, height: current ? 8 : 5,
                        borderRadius:"50%",
                        background: filled
                          ? current ? "rgba(100,170,230,0.9)" : "rgba(80,130,190,0.45)"
                          : "rgba(255,255,255,0.07)",
                        border: current ? "1px solid rgba(120,190,240,0.4)" : "none",
                        transition:"all 0.3s ease",
                      }} />
                  );
                })}
              </div>
              {/* 回答済み数 */}
              <div style={{ fontFamily:"var(--f-mono)", fontSize:9, color:"var(--c-dim)", letterSpacing:"0.14em" }}>
                {String(answeredCount).padStart(2,"0")} ANSWERED
              </div>
            </div>

            {/* ── 会話エリア ── */}
            <div style={{ marginBottom:20 }}>

              {/* タイピングインジケーター */}
              {showTyping && (
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14,
                  padding:"12px 16px",
                  background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.06)",
                  borderRadius:"14px 14px 14px 4px",
                  width:"fit-content", maxWidth:"70%",
                }}>
                  <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{
                        width:5, height:5, borderRadius:"50%",
                        background:"rgba(110,160,220,0.7)",
                        animation:`typingDot 1.2s ease-in-out ${i*0.2}s infinite`,
                      }} />
                    ))}
                  </div>
                  <span style={{ fontFamily:"var(--f-mono)", fontSize:8, color:"rgba(80,130,180,0.55)", letterSpacing:"0.12em" }}>
                    NOEMA
                  </span>
                </div>
              )}

              {/* AIリアクションバブル */}
              {showReaction && pendingReaction && (
                <div className="reaction-bubble" style={{ marginBottom:16 }}>
                  {/* AIアイコン行 */}
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:7 }}>
                    <div style={{ width:20, height:20, borderRadius:"50%",
                      background:"rgba(60,90,150,0.3)", border:"1px solid rgba(80,120,190,0.3)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:9, color:"rgba(100,160,220,0.8)" }}>N</div>
                    <span style={{ fontFamily:"var(--f-mono)", fontSize:8, color:"rgba(80,130,180,0.55)", letterSpacing:"0.12em" }}>NOEMA</span>
                  </div>
                  {/* バブル */}
                  <div style={{
                    padding:"12px 16px",
                    background:"rgba(50,80,140,0.12)", border:"1px solid rgba(80,120,190,0.2)",
                    borderRadius:"4px 14px 14px 14px",
                    maxWidth:"82%",
                  }}>
                    <p style={{ fontFamily:"var(--f-jp)", fontSize:13, color:"rgba(175,195,228,0.85)",
                      lineHeight:1.75, fontWeight:300, fontStyle:"italic" }}>
                      {pendingReaction}
                    </p>
                  </div>
                </div>
              )}

              {/* 過去の回答ログ（直近2件） */}
              {answers.slice(-2).map((a, i) => (
                <div key={a.qId + i} style={{ marginBottom:10, opacity: i === 0 && answers.length > 1 ? 0.4 : 0.65,
                  transition:"opacity 0.4s ease" }}>
                  {/* 質問（小さめ） */}
                  <div style={{ fontFamily:"var(--f-mono)", fontSize:8, color:"rgba(70,100,150,0.55)",
                    letterSpacing:"0.1em", marginBottom:4, paddingLeft:2 }}>{a.question}</div>
                  {/* ユーザーの回答バブル */}
                  <div style={{ display:"flex", justifyContent:"flex-end" }}>
                    <div style={{ padding:"8px 14px",
                      background:"rgba(60,90,150,0.15)", border:"1px solid rgba(80,120,190,0.18)",
                      borderRadius:"14px 14px 4px 14px",
                      fontFamily:"var(--f-jp)", fontSize:12, color:"rgba(165,195,232,0.8)",
                      fontWeight:300, maxWidth:"75%",
                    }}>
                      {a.answer}
                    </div>
                  </div>
                </div>
              ))}

              {/* 現在の質問 */}
              {showQuestion && (
                <div style={{ marginTop: answers.length > 0 ? 18 : 0 }}>
                  {/* AIアイコン行 */}
                  <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8 }}>
                    <div style={{ width:24, height:24, borderRadius:"50%",
                      background:"rgba(60,90,150,0.25)", border:"1px solid rgba(80,120,190,0.3)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:10, color:"rgba(100,165,225,0.85)",
                      boxShadow:"0 0 8px rgba(80,130,200,0.15)",
                    }}>N</div>
                    <span style={{ fontFamily:"var(--f-mono)", fontSize:8, color:"rgba(80,130,180,0.55)", letterSpacing:"0.12em" }}>NOEMA</span>
                    <span style={{ fontFamily:"var(--f-mono)", fontSize:8, color:"rgba(60,100,150,0.35)", letterSpacing:"0.1em" }}>
                      · {currentQ.id.toUpperCase()}
                    </span>
                  </div>

                  {/* 質問バブル */}
                  <div className="question-text" key={qKey} style={{
                    padding:"16px 20px",
                    background:"rgba(255,255,255,0.028)", border:"1px solid rgba(255,255,255,0.08)",
                    borderRadius:"4px 18px 18px 18px",
                    marginBottom:20, position:"relative",
                    backdropFilter:"blur(10px)",
                  }}>
                    {/* 上部グロー線 */}
                    <div style={{ position:"absolute", top:0, left:20, right:20, height:1,
                      background:"linear-gradient(90deg,transparent,rgba(80,140,210,0.2),transparent)" }} />
                    <p style={{
                      fontFamily:"var(--f-serif)", fontStyle:"italic", fontWeight:300,
                      fontSize:"clamp(16px,4vw,21px)", lineHeight:1.65,
                      color:"rgba(218,226,244,0.94)", letterSpacing:"0.02em",
                    }}>
                      {currentQ.text}
                    </p>
                  </div>

                  {/* 選択肢 */}
                  <div style={{ marginBottom:18 }}>
                    {currentQ.options.map((opt, i) => (
                      <button
                        key={`${qKey}-${opt.label}`}
                        className={`option-btn option-stagger ${selected?.label === opt.label ? "selected" : ""}`}
                        onClick={(e) => {
                          handleSelect(opt);
                          // 波紋エフェクト
                          const btn  = e.currentTarget;
                          const rect = btn.getBoundingClientRect();
                          const rip  = document.createElement("span");
                          rip.className = "option-btn-ripple";
                          rip.style.left = `${e.clientX - rect.left - 40}px`;
                          rip.style.top  = `${e.clientY - rect.top - 40}px`;
                          btn.appendChild(rip);
                          setTimeout(() => rip.remove(), 600);
                          // Haptic（iOS Safari）
                          if (navigator.vibrate) navigator.vibrate(10);
                        }}
                        style={{ animationDelay:`${0.08 + i*0.07}s`, position:"relative", overflow:"hidden" }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* スコアプレビュー */}
                  {selected && (
                    <div style={{ padding:"9px 14px", marginBottom:18,
                      background:"rgba(40,65,120,0.07)", border:"1px solid rgba(70,110,170,0.12)",
                      borderRadius:10, animation:"fadeIn 0.25s ease forwards" }}>
                      <div style={{ fontFamily:"var(--f-mono)", fontSize:8, color:"rgba(70,110,160,0.5)",
                        letterSpacing:"0.18em", marginBottom:7 }}>SCORE DELTA</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                        {Object.entries(selected.scores).filter(([,v])=>v!==0).map(([k,v]) => (
                          <span key={k} style={{
                            padding:"2px 9px", borderRadius:999,
                            background: v>0 ? "rgba(60,120,85,0.14)" : "rgba(120,60,60,0.14)",
                            border:`1px solid ${v>0 ? "rgba(80,150,105,0.22)" : "rgba(150,80,80,0.22)"}`,
                            color: v>0 ? "rgba(100,180,130,0.85)" : "rgba(180,100,100,0.85)",
                            fontSize:9, fontFamily:"var(--f-mono)",
                          }}>
                            {k} {v>0?`+${v}`:v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 次へボタン */}
                  <div style={{ textAlign:"right" }}>
                    <button className="btn-next" onClick={handleNext}
                      disabled={!selected || showTyping || showReaction}>
                      {!selected?.nextId ? "分析する" : "次へ"} →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ THINKING ══════════════════════════════════════════ */}
        {phase === "thinking" && <ThinkingScreen />}

        {/* ══ ERROR ════════════════════════════════════════════ */}
        {phase === "error" && (
          <div className="phase-enter" style={{ paddingTop:80 }}>
            <ErrorBanner message={apiError} onRetry={handleRetry} />
            <div style={{ textAlign:"center", marginTop:32 }}>
              <button className="btn-ghost" onClick={restart}>最初からやり直す</button>
            </div>
          </div>
        )}

        {/* ══ RESULT ═══════════════════════════════════════════ */}
        {phase === "result" && result && (
          <div className="phase-result" style={{ paddingTop:52 }}>

            {/* API失敗フォールバック通知（静かに表示） */}
            {apiErrorCode && (
              <div style={{
                marginBottom:24, padding:"10px 16px",
                background:"rgba(100,80,30,0.08)", border:"1px solid rgba(160,130,60,0.18)",
                borderRadius:10, display:"flex", alignItems:"center", gap:10,
                animation:"fadeUp 0.5s ease forwards",
              }}>
                <span style={{ fontSize:14, opacity:0.7 }}>◎</span>
                <div>
                  <div style={{ fontFamily:"var(--f-mono)", fontSize:9,
                    color:"rgba(180,155,80,0.75)", letterSpacing:"0.1em", marginBottom:3 }}>
                    {apiErrorCode === "TIMEOUT" ? "AI応答タイムアウト" :
                     apiErrorCode === "RATE_LIMITED" ? "APIレート制限" :
                     "AIとの接続に問題が発生"}
                  </div>
                  <div style={{ fontFamily:"var(--f-jp)", fontSize:11,
                    color:"rgba(160,140,80,0.65)", fontWeight:300 }}>
                    スコアから算出したフォールバック結果を表示しています。
                  </div>
                </div>
              </div>
            )}

            {/* ① タイプ名ヘッダー */}
            <div className="result-card-stagger" style={{ textAlign:"center", marginBottom:40 }}>
              {/* ANALYSIS COMPLETE ラベル */}
              <div style={{ fontFamily:"var(--f-mono)", fontSize:9, color:"var(--c-dim)",
                letterSpacing:"0.22em", marginBottom:14 }}>
                THOUGHT TYPE · ANALYSIS COMPLETE
              </div>

              {/* タイプID */}
              <div style={{ display:"inline-block", padding:"4px 16px", marginBottom:18,
                background:`${result.typeColor}14`, border:`1px solid ${result.typeColor}38`,
                borderRadius:999, fontFamily:"var(--f-mono)", fontSize:9,
                color:`${result.typeColor}bb`, letterSpacing:"0.18em" }}>
                {THOUGHT_TYPES.find(t=>t.name===result.typeName)?.id?.toUpperCase().replace(/_/g,"-")}
              </div>

              {/* タイプ名 — 浮遊アニメーション */}
              <h2
                className="result-title-float"
                style={{
                  "--tc-glow": `${result.typeColor}66`,
                  display:"block", fontFamily:"var(--f-serif)", fontStyle:"italic", fontWeight:300,
                  fontSize:"clamp(32px,8vw,52px)", letterSpacing:"0.01em", lineHeight:1.12,
                  color:result.typeColor, marginBottom:22,
                }}
              >
                {result.typeName}
              </h2>

              {/* スコアバッジ */}
              <div style={{ display:"flex", flexWrap:"wrap", gap:7, justifyContent:"center" }}>
                {[
                  { label:"自由", val:result.traits.freedom,    color:"#7aaedd" },
                  { label:"孤独", val:result.traits.loneliness, color:"#6aaa9a" },
                  { label:"虚無", val:result.traits.nihilism,   color:"#8890a8" },
                  { label:"理想", val:result.traits.idealism,   color:"#8b78cc" },
                ].map(({ label, val, color }) => (
                  <span key={label} style={{ padding:"4px 14px", borderRadius:999,
                    background:`${color}12`, border:`1px solid ${color}28`,
                    color:`${color}cc`, fontSize:10, fontFamily:"var(--f-mono)", letterSpacing:"0.1em" }}>
                    {label} {val}
                  </span>
                ))}
              </div>
            </div>

            {/* ② QUOTE カード — スクショ映え */}
            {result.quote && (
              <div className="result-card-stagger card-hover" style={{
                margin:"0 0 18px", padding:"32px 28px 28px",
                background:"rgba(255,255,255,0.018)",
                border:"1px solid rgba(255,255,255,0.07)",
                borderLeft:`2px solid ${result.typeColor}55`,
                borderRadius:"0 18px 18px 0",
                position:"relative",
                backdropFilter:"blur(14px)",
              }}>
                <div style={{ position:"absolute", top:16, left:28, fontFamily:"var(--f-mono)",
                  fontSize:8, letterSpacing:"0.24em", color:`${result.typeColor}88` }}>QUOTE</div>
                <p style={{
                  fontFamily:"var(--f-serif)", fontStyle:"italic", fontWeight:300,
                  fontSize:"clamp(16px,3.8vw,21px)", lineHeight:1.75,
                  color:"rgba(218,226,242,0.94)", marginTop:18, letterSpacing:"0.025em",
                }}>
                  「{result.quote}」
                </p>
              </div>
            )}

            {/* ③ 思想定義 */}
            {result.definition && (
              <Card className="result-card-stagger"
                style={{ background:"rgba(45,65,115,0.07)", border:"1px solid rgba(75,105,165,0.16)" }}>
                <SLabel>思想定義</SLabel>
                <p style={{ fontFamily:"var(--f-jp)", fontSize:14, lineHeight:2.05,
                  color:"rgba(198,212,232,0.88)", fontWeight:300 }}>
                  {result.definition}
                </p>
              </Card>
            )}

            {/* ④ 内面的矛盾 + 孤独・距離 */}
            <div className="result-card-stagger" style={{ marginBottom:16 }}>
              {result.contradiction && (
                <div className="card-hover" style={{ padding:"18px 20px", marginBottom:12,
                  background:"rgba(90,55,125,0.06)", border:"1px solid rgba(115,75,155,0.16)",
                  borderRadius:16, backdropFilter:"blur(10px)",
                  transition:"all 0.26s ease" }}>
                  <SLabel color="rgba(145,95,200,0.8)">内面的矛盾</SLabel>
                  <p style={{ fontFamily:"var(--f-jp)", fontSize:13, lineHeight:2,
                    color:"rgba(190,170,218,0.82)", fontWeight:300 }}>
                    {result.contradiction}
                  </p>
                </div>
              )}
              <div className="grid-2col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {result.solitude && (
                  <div className="card-hover" style={{ padding:"16px 18px",
                    background:"rgba(38,78,100,0.07)", border:"1px solid rgba(58,108,140,0.16)",
                    borderRadius:16, backdropFilter:"blur(10px)", transition:"all 0.26s ease" }}>
                    <SLabel color="rgba(75,145,180,0.8)" style={{ fontSize:8 }}>孤独性</SLabel>
                    <p style={{ fontFamily:"var(--f-jp)", fontSize:12, lineHeight:1.95,
                      color:"rgba(158,192,215,0.78)", fontWeight:300 }}>{result.solitude}</p>
                  </div>
                )}
                {result.distance && (
                  <div className="card-hover" style={{ padding:"16px 18px",
                    background:"rgba(55,78,48,0.07)", border:"1px solid rgba(78,110,68,0.16)",
                    borderRadius:16, backdropFilter:"blur(10px)", transition:"all 0.26s ease" }}>
                    <SLabel color="rgba(95,158,98,0.8)" style={{ fontSize:8 }}>社会との距離</SLabel>
                    <p style={{ fontFamily:"var(--f-jp)", fontSize:12, lineHeight:1.95,
                      color:"rgba(152,192,158,0.78)", fontWeight:300 }}>{result.distance}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ⑤ 哲学者 */}
            <Card className="result-card-stagger">
              <SLabel>哲学者親和性</SLabel>
              <p style={{ fontFamily:"var(--f-mono)", fontSize:9, color:"var(--c-dim)",
                marginBottom:16, letterSpacing:"0.1em" }}>
                思想スコアから算出した近接思想家 — 断定ではない
              </p>
              {result.philosophers.map((p, i) => (
                <div key={p.name} style={{ padding:"16px 18px", marginBottom:i<1?12:0,
                  background: i===0 ? "rgba(65,98,160,0.09)" : "rgba(255,255,255,0.018)",
                  border:`1px solid ${i===0 ? "rgba(88,120,192,0.2)" : "rgba(255,255,255,0.05)"}`,
                  borderRadius:14, transition:"all 0.26s ease" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:i===0?12:0 }}>
                    <span style={{ fontSize:22, lineHeight:1 }}>{p.emoji}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:"var(--f-jp)", color:"rgba(205,215,232,0.9)",
                        fontSize:13, marginBottom:3, fontWeight:300 }}>{p.name}</div>
                      <div style={{ fontFamily:"var(--f-mono)", color:"var(--c-dim)", fontSize:9,
                        letterSpacing:"0.08em" }}>{p.desc}</div>
                    </div>
                    {i===0 && <div style={{ fontFamily:"var(--f-mono)", fontSize:9,
                      color:"rgba(108,152,215,0.7)", letterSpacing:"0.12em" }}>PRIMARY</div>}
                  </div>
                  {i===0 && p.quote && (
                    <div style={{ padding:"10px 14px", marginBottom:12,
                      background:"rgba(0,0,0,0.18)", border:"1px solid rgba(255,255,255,0.04)",
                      borderLeft:`2px solid ${result.typeColor}30`, borderRadius:"0 8px 8px 0" }}>
                      <p style={{ fontFamily:"var(--f-serif)", fontStyle:"italic", fontWeight:300,
                        fontSize:12, color:"rgba(172,188,218,0.8)", lineHeight:1.85 }}>
                        「{p.quote}」
                      </p>
                    </div>
                  )}
                  {i===0 && p.keywords && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                      {p.keywords.map(kw => (
                        <span key={kw} style={{ padding:"2px 10px", borderRadius:999,
                          background:"rgba(75,108,182,0.11)", border:"1px solid rgba(98,132,205,0.18)",
                          color:"rgba(118,158,218,0.8)", fontSize:9, fontFamily:"var(--f-mono)",
                          letterSpacing:"0.08em" }}>#{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </Card>

            {/* ⑥ レーダー + 座標 */}
            <div className="result-card-stagger grid-2col"
              style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
              <Card style={{ marginBottom:0 }}>
                <SLabel>思想レーダー</SLabel>
                <ResponsiveContainer width="100%" height={175}>
                  <RadarChart data={radarData} margin={{ top:10,right:18,bottom:10,left:18 }}>
                    <PolarGrid stroke="rgba(255,255,255,0.04)" />
                    <PolarAngleAxis dataKey="axis" tick={{ fill:"rgba(108,128,165,0.7)", fontSize:9, fontFamily:"Space Mono,monospace" }} />
                    <Radar dataKey="value" stroke={`${result.typeColor}a0`} fill={`${result.typeColor}1a`} strokeWidth={1.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </Card>
              <Card style={{ marginBottom:0 }}>
                <SLabel>思想座標</SLabel>
                <ThoughtMap traits={result.traits} />
                <div style={{ textAlign:"center", marginTop:10, fontFamily:"var(--f-mono)",
                  fontSize:8, color:"var(--c-dim)", letterSpacing:"0.12em" }}>
                  ● あなた　· 他ユーザー
                </div>
              </Card>
            </div>

            {/* ⑦ スコアバー */}
            <div className="result-card-stagger grid-2col"
              style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
              <Card style={{ marginBottom:0 }}>
                <SLabel>価値観スコア</SLabel>
                <ScoreBar label="自由志向"  value={result.traits.freedom}     color="#7aaedd" delay={0}   />
                <ScoreBar label="安定志向"  value={result.traits.stability}   color="#7ab888" delay={80}  />
                <ScoreBar label="理想主義"  value={result.traits.idealism}    color="#8b78cc" delay={160} />
                <ScoreBar label="現実主義"  value={result.traits.realism}     color="#a09070" delay={240} />
                <ScoreBar label="ロマン主義" value={result.traits.romanticism} color="#b07ac8" delay={320} />
              </Card>
              <Card style={{ marginBottom:0 }}>
                <SLabel>思考スコア</SLabel>
                <ScoreBar label="論理型"    value={result.traits.logic}      color="#7aaedd" delay={40}  />
                <ScoreBar label="感情型"    value={result.traits.emotion}    color="#e08870" delay={120} />
                <ScoreBar label="孤独耐性"  value={result.traits.loneliness} color="#6aaa9a" delay={200} />
                <ScoreBar label="ニヒリズム" value={result.traits.nihilism}   color="#8890a8" delay={280} />
                <ScoreBar label="共同体志向" value={result.traits.community}  color="#88a870" delay={360} />
              </Card>
            </div>

            {/* ⑧ 回答履歴 */}
            <Card className="result-card-stagger">
              <SLabel>あなたの選択</SLabel>
              {answers.map((a, i) => (
                <div key={i} style={{ display:"flex", gap:12, paddingBottom:12, marginBottom:12,
                  borderBottom: i < answers.length-1 ? "1px solid var(--c-border2)" : "none" }}>
                  <span style={{ fontFamily:"var(--f-mono)", fontSize:9, color:"var(--c-dim)",
                    minWidth:22, marginTop:3, letterSpacing:"0.1em" }}>{String(i+1).padStart(2,"0")}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"var(--f-mono)", fontSize:9, color:"var(--c-dim)",
                      marginBottom:4, letterSpacing:"0.06em" }}>{a.question}</div>
                    <div style={{ fontFamily:"var(--f-jp)", fontSize:13, color:"rgba(178,192,218,0.85)",
                      fontWeight:300, marginBottom:6 }}>{a.answer}</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                      {Object.entries(a.scores??{}).filter(([,v])=>v!==0).map(([k,v]) => (
                        <span key={k} style={{ fontSize:8, fontFamily:"var(--f-mono)", padding:"1px 7px",
                          borderRadius:999,
                          background: v>0 ? "rgba(70,130,95,0.1)" : "rgba(130,70,70,0.1)",
                          border:`1px solid ${v>0 ? "rgba(90,160,115,0.16)" : "rgba(160,90,90,0.16)"}`,
                          color: v>0 ? "rgba(100,178,128,0.72)" : "rgba(178,100,100,0.72)",
                        }}>
                          {k}{v>0?`+${v}`:v}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </Card>

            {/* ── SNS共有パネル ── */}
            <div className="result-card-stagger share-panel"
              style={{ marginBottom:8 }}>

              {/* 区切り線 */}
              <div className="share-divider" />

              {/* ラベル */}
              <div style={{ textAlign:"center", fontFamily:"var(--f-mono)", fontSize:9,
                color:"var(--c-dim)", letterSpacing:"0.2em", marginBottom:16 }}>
                SHARE · EXPORT
              </div>

              {/* エラー */}
              {saveErr && (
                <div style={{ marginBottom:12, padding:"9px 16px",
                  background:"rgba(160,50,50,0.08)", border:"1px solid rgba(190,70,70,0.18)",
                  borderRadius:10, animation:"fadeIn 0.3s ease", textAlign:"center" }}>
                  <span style={{ fontFamily:"var(--f-mono)", fontSize:10, color:"rgba(210,130,130,0.85)" }}>
                    ⚠ {saveErr}
                  </span>
                </div>
              )}

              {/* ボタン3つ */}
              <div className="share-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>

                {/* 画像保存 */}
                <button
                  className={`btn-share-base btn-share-img ${saved ? "saved" : ""}`}
                  onClick={save}
                  disabled={saving}
                  style={{ flexDirection:"column", gap:6, padding:"14px 10px" }}
                >
                  {saving ? (
                    <div className="saving-spinner" />
                  ) : (
                    <span style={{ fontSize:18, lineHeight:1 }}>{saved ? "✓" : "↓"}</span>
                  )}
                  <span style={{ fontSize:9, letterSpacing:"0.1em" }}>
                    {saving ? "生成中" : saved ? "保存済み" : "画像保存"}
                  </span>
                </button>

                {/* Xでシェア */}
                <button
                  className="btn-share-base btn-share-x"
                  onClick={shareToX}
                  style={{ flexDirection:"column", gap:6, padding:"14px 10px" }}
                >
                  <span style={{ fontSize:16, lineHeight:1, fontFamily:"monospace", fontWeight:"bold" }}>𝕏</span>
                  <span style={{ fontSize:9, letterSpacing:"0.1em" }}>Xでシェア</span>
                </button>

                {/* URLコピー */}
                <button
                  className={`btn-share-base btn-share-copy ${copied ? "copied" : ""}`}
                  onClick={copyURL}
                  style={{ flexDirection:"column", gap:6, padding:"14px 10px" }}
                >
                  <span style={{ fontSize:17, lineHeight:1 }}>{copied ? "✓" : "⎘"}</span>
                  <span style={{ fontSize:9, letterSpacing:"0.1em" }}>
                    {copied ? "コピー済み" : "URLコピー"}
                  </span>
                </button>
              </div>

              {/* 補足テキスト */}
              <div style={{ marginTop:10, textAlign:"center", fontFamily:"var(--f-mono)",
                fontSize:8, color:"rgba(70,90,130,0.45)", letterSpacing:"0.1em" }}>
                PNG · 1620×2880 · 9:16
              </div>
            </div>

            {/* リスタート */}
            <div className="result-card-stagger" style={{ textAlign:"center", marginTop:32 }}>
              <button className="btn-ghost" onClick={restart}>もう一度診断する</button>
            </div>

            {/* 免責 */}
            <div className="result-card-stagger" style={{ marginTop:36, padding:"14px 20px",
              background:"rgba(160,130,45,0.03)", border:"1px solid rgba(160,130,45,0.09)",
              borderRadius:14, textAlign:"center" }}>
              <p style={{ fontFamily:"var(--f-jp)", color:"rgba(138,125,90,0.58)", fontSize:10,
                lineHeight:1.85, fontWeight:300 }}>⚠ {DISCLAIMER}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── ShareCard（画像化専用・DOM常駐・opacity:0で非表示） ── */}
      {result && (
        <div ref={shareWrapperRef} className="share-card-wrapper">
          <ShareCard ref={shareCardRef} result={result} />
        </div>
      )}
    </div>
  );
}
