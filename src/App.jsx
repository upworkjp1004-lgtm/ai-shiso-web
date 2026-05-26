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
// ══════════════════════════════════════════════════════════════
//  Q_TREE — 心理構造分析型質問ツリー（v3.0）
//
//  設計思想：
//  「感情を聞く」のではなく「反応パターンを見る」
//  愛着スタイル・防衛機制・認知傾向を間接的に測定する
//
//  スコア軸（14軸）:
//  freedom, stability, idealism, realism, logic, emotion,
//  loneliness, community, nihilism, romanticism,
//  sensitivity, rationality, curiosity, optimism
//
//  心理軸（隠しパラメータ・calcTraitsで正規化後に活用）:
//  attach_avoid（回避型愛着） → loneliness + nihilism - community
//  attach_anxious（不安型）   → emotion + sensitivity - stability
//  defense_suppress（感情抑圧）→ logic - emotion
//  cognition_anticipate（先回り不安）→ sensitivity + nihilism
// ══════════════════════════════════════════════════════════════
const Q_TREE = {

  // ══ LAYER 0: 入口 ─────────────────────────────────────────
  // 目的: 対人反応のベースライン測定（愛着スタイルの初期分岐）
  "root": {
    id:"root", layer:0,
    text:"誰かに優しくされた後、あなたが一番近い感情は？",
    reaction: null,
    options:[
      {
        label:"少し安心する。素直に受け取れる",
        scores:{ stability:+3, community:+2, emotion:+2 },
        nextId:"q_trust",
        hint:"SECURE"
      },
      {
        label:"距離を取りたくなる。なぜか落ち着かない",
        scores:{ loneliness:+3, freedom:+2, community:-2 },
        nextId:"q_avoid",
        hint:"AVOID"
      },
      {
        label:"本音を隠したくなる。見せすぎた気がする",
        scores:{ loneliness:+2, nihilism:+2, stability:-1 },
        nextId:"q_mask",
        hint:"FEARFUL"
      },
      {
        label:"なぜか申し訳なくなる。受け取る資格があるか不安",
        scores:{ emotion:+3, sensitivity:+2, stability:-2, idealism:+1 },
        nextId:"q_anxious",
        hint:"ANXIOUS"
      },
    ],
  },

  // ══ LAYER 1: 安定型ルート ─────────────────────────────────
  // 「少し安心する」→ 信頼の質と条件付きを掘り下げる
  "q_trust": {
    id:"q_trust", layer:1,
    text:"「この人なら信用できる」と思うとき、何が決め手になる？",
    reaction:"なるほど。あなたの信頼の形が見えてきた気がして。",
    options:[
      {
        label:"裏切らなかった実績。時間をかけて確認する",
        scores:{ realism:+3, stability:+2, logic:+2 },
        nextId:"q_depth"
      },
      {
        label:"言葉より行動。何をするかで判断する",
        scores:{ logic:+3, realism:+2, emotion:-1 },
        nextId:"q_depth"
      },
      {
        label:"直感。なんとなく分かる",
        scores:{ emotion:+3, romanticism:+2, sensitivity:+1 },
        nextId:"q_emotion_pattern"
      },
      {
        label:"本当に信用している人がいるか、自信がない",
        scores:{ loneliness:+3, nihilism:+2, community:-1 },
        nextId:"q_isolation"
      },
    ],
  },

  // ══ LAYER 1: 回避型ルート ─────────────────────────────────
  // 「距離を取りたくなる」→ 回避の構造を掘り下げる
  "q_avoid": {
    id:"q_avoid", layer:1,
    text:"誰かが近づいてきたとき、最初に何を考える？",
    reaction:"近づかれる感覚に、何かがあるみたいで。",
    options:[
      {
        label:"この人は何を求めているのか、を考える",
        scores:{ logic:+3, loneliness:+2, rationality:+2 },
        nextId:"q_distance"
      },
      {
        label:"どこまで開けばいいか、をすぐ計算する",
        scores:{ loneliness:+3, logic:+2, community:-2 },
        nextId:"q_distance"
      },
      {
        label:"嬉しいけど、どこかに身構える",
        scores:{ emotion:+2, sensitivity:+2, stability:-1 },
        nextId:"q_emotion_pattern"
      },
      {
        label:"できるだけ何も感じないようにする",
        scores:{ nihilism:+3, loneliness:+2, emotion:-2 },
        nextId:"q_isolation"
      },
    ],
  },

  // ══ LAYER 1: 本音隠蔽ルート ───────────────────────────────
  // 「本音を隠したくなる」→ 防衛の種類を特定する
  "q_mask": {
    id:"q_mask", layer:1,
    text:"本音を隠すとき、あなたはどのやり方を選んでいる？",
    reaction:"その隠し方に、あなたの癖が出る気がして。",
    options:[
      {
        label:"論理的に説明して、感情を見えなくする",
        scores:{ logic:+4, emotion:-2, rationality:+2 },
        nextId:"q_depth"
      },
      {
        label:"冗談にして、本気じゃないフリをする",
        scores:{ nihilism:+2, freedom:+2, sensitivity:+1 },
        nextId:"q_nihil_branch"
      },
      {
        label:"話題を変える。気づかれないように",
        scores:{ loneliness:+2, community:-1, stability:+1 },
        nextId:"q_distance"
      },
      {
        label:"その場にいなくなる。物理的に",
        scores:{ loneliness:+3, freedom:+3, community:-3 },
        nextId:"q_isolation"
      },
    ],
  },

  // ══ LAYER 1: 不安型ルート ─────────────────────────────────
  // 「申し訳なくなる」→ 承認欲求と自己否定を掘り下げる
  "q_anxious": {
    id:"q_anxious", layer:1,
    text:"誰かの機嫌が悪いとき、自分のせいかもと思う？",
    reaction:"その反応に、大切なものが見える気がして。",
    options:[
      {
        label:"よく思う。何かしたか、すぐ確認したくなる",
        scores:{ sensitivity:+3, emotion:+3, stability:-2 },
        nextId:"q_emotion_pattern"
      },
      {
        label:"たまに思う。でも確認はしない",
        scores:{ sensitivity:+2, loneliness:+1, logic:+1 },
        nextId:"q_emotion_pattern"
      },
      {
        label:"関係ないと分かっていても、気になってしまう",
        scores:{ emotion:+2, sensitivity:+2, nihilism:+1 },
        nextId:"q_depth"
      },
      {
        label:"あまり思わない。他人の感情は他人のもの",
        scores:{ logic:+2, freedom:+2, community:-1 },
        nextId:"q_depth"
      },
    ],
  },

  // ══ LAYER 2: 信頼の深度 ───────────────────────────────────
  "q_depth": {
    id:"q_depth", layer:2,
    text:"「この人には本音を言える」と思った後、後悔したことはある？",
    reaction:"少し深いところへ。",
    options:[
      {
        label:"ある。それからは開き方を慎重にした",
        scores:{ loneliness:+3, nihilism:+2, community:-1 },
        nextId:"q_defense"
      },
      {
        label:"ある。でも後悔より、話せた方が良かったと思う",
        scores:{ emotion:+2, community:+2, idealism:+1 },
        nextId:"q_value"
      },
      {
        label:"ない。でも本音を言える人が少ない",
        scores:{ loneliness:+2, stability:+1, logic:+1 },
        nextId:"q_defense"
      },
      {
        label:"本音を言える人がいない",
        scores:{ loneliness:+4, nihilism:+2, community:-2 },
        nextId:"q_isolation"
      },
    ],
  },

  // ══ LAYER 2: 距離の取り方 ─────────────────────────────────
  "q_distance": {
    id:"q_distance", layer:2,
    text:"関係が深くなりそうになると、どこかで引いてしまうことがある？",
    reaction:"距離の問題が見えてきた気がして。",
    options:[
      {
        label:"ある。理由は分からないけど、引いてしまう",
        scores:{ loneliness:+3, nihilism:+2, freedom:+2, community:-2 },
        nextId:"q_defense"
      },
      {
        label:"ある。傷つくのが分かってるから",
        scores:{ loneliness:+2, sensitivity:+2, realism:+1 },
        nextId:"q_defense"
      },
      {
        label:"あまりない。深くなることが自然",
        scores:{ community:+3, emotion:+2, stability:+1 },
        nextId:"q_value"
      },
      {
        label:"相手による。人を選んでいる",
        scores:{ logic:+2, realism:+2, stability:+1 },
        nextId:"q_value"
      },
    ],
  },

  // ══ LAYER 2: 感情パターン ─────────────────────────────────
  "q_emotion_pattern": {
    id:"q_emotion_pattern", layer:2,
    text:"感情が高ぶったとき、あなたは最初に何をする？",
    reaction:"感情との付き合い方が見えてきた気がして。",
    options:[
      {
        label:"ひとりになる。整理されるまで誰とも話さない",
        scores:{ loneliness:+3, logic:+2, community:-1 },
        nextId:"q_defense"
      },
      {
        label:"誰かに話す。吐き出さないと処理できない",
        scores:{ community:+3, emotion:+3, loneliness:-1 },
        nextId:"q_value"
      },
      {
        label:"何か別のことに集中する。忘れようとする",
        scores:{ stability:+2, nihilism:+1, emotion:-1 },
        nextId:"q_defense"
      },
      {
        label:"感情が高ぶること自体、あまりない",
        scores:{ logic:+3, nihilism:+2, emotion:-2 },
        nextId:"q_defense"
      },
    ],
  },

  // ══ LAYER 2: 孤立感 ───────────────────────────────────────
  "q_isolation": {
    id:"q_isolation", layer:2,
    text:"「本当の自分を知っている人がいない」と感じることはある？",
    reaction:"そこを少し掘り下げてみたくて。",
    options:[
      {
        label:"常にある。みんな表面の自分を見ている",
        scores:{ loneliness:+4, nihilism:+3, community:-2 },
        nextId:"q_nihil_branch"
      },
      {
        label:"ある。でも、それでいいとも思っている",
        scores:{ loneliness:+3, freedom:+2, nihilism:+1 },
        nextId:"q_nihil_branch"
      },
      {
        label:"たまにある。でも近づこうとはする",
        scores:{ emotion:+2, idealism:+2, loneliness:+1 },
        nextId:"q_value"
      },
      {
        label:"あまりない。理解してくれる人がいる",
        scores:{ community:+3, stability:+2, emotion:+1 },
        nextId:"q_value"
      },
    ],
  },

  // ══ LAYER 3: 防衛機制の種類 ───────────────────────────────
  "q_defense": {
    id:"q_defense", layer:3,
    text:"傷ついたとき、あなたが一番やってしまうことは？",
    reaction:"防衛の形が見えてきた気がして。",
    options:[
      {
        label:"「どうせこんなもの」と冷めた目で見る",
        scores:{ nihilism:+3, loneliness:+2, idealism:-1 },
        nextId:"q_final_a"
      },
      {
        label:"なぜそうなったかを論理的に整理する",
        scores:{ logic:+3, rationality:+2, emotion:-1 },
        nextId:"q_final_a"
      },
      {
        label:"自分のどこが悪かったかを考え続ける",
        scores:{ sensitivity:+3, stability:-2, idealism:+1 },
        nextId:"q_final_b"
      },
      {
        label:"誰かに優しくして、自分の感情を後回しにする",
        scores:{ community:+2, emotion:+2, stability:+1 },
        nextId:"q_final_b"
      },
    ],
  },

  // ══ LAYER 3: 価値観の核 ───────────────────────────────────
  "q_value": {
    id:"q_value", layer:3,
    text:"「幸せ」について、今どのくらい信じている？",
    reaction:"最も深いところへ向かっています。",
    options:[
      {
        label:"信じている。目指す価値がある",
        scores:{ idealism:+3, optimism:+3, nihilism:-2 },
        nextId:"q_final_b"
      },
      {
        label:"信じたいが、自分には当てはまらない気がする",
        scores:{ idealism:+2, loneliness:+2, nihilism:+1 },
        nextId:"q_final_b"
      },
      {
        label:"幸せという概念自体が曖昧に感じる",
        scores:{ nihilism:+3, logic:+2, idealism:-1 },
        nextId:"q_final_a"
      },
      {
        label:"考えないようにしている",
        scores:{ nihilism:+2, stability:+2, emotion:-1 },
        nextId:"q_final_a"
      },
    ],
  },

  // ══ LAYER 3: 虚無分岐 ─────────────────────────────────────
  "q_nihil_branch": {
    id:"q_nihil_branch", layer:3,
    text:"「全部どうでもいい」と感じる瞬間、その後どうなる？",
    reaction:"そこが核心に近い気がして。",
    options:[
      {
        label:"少し楽になる。重さが消える感じ",
        scores:{ nihilism:+3, freedom:+2, loneliness:+1 },
        nextId:"q_final_a"
      },
      {
        label:"怖くなる。本当に空っぽになりそうで",
        scores:{ nihilism:+2, sensitivity:+2, idealism:+1, stability:-2 },
        nextId:"q_final_b"
      },
      {
        label:"また何かを探し始める",
        scores:{ idealism:+2, curiosity:+2, nihilism:+1 },
        nextId:"q_final_b"
      },
      {
        label:"そのまま、何もしない",
        scores:{ nihilism:+3, loneliness:+2, emotion:-1 },
        nextId:"q_final_a"
      },
    ],
  },

  // ══ LAYER 4A: 終端（内向き）──────────────────────────────
  "q_final_a": {
    id:"q_final_a", layer:4,
    text:"深夜に一人でいるとき、あなたの頭にいるのは誰？",
    reaction:"最後の問いです。",
    options:[
      {
        label:"特定の誰か。消えないでいる",
        scores:{ romanticism:+3, loneliness:+2, emotion:+2 },
        nextId:null
      },
      {
        label:"過去の自分。何かを後悔している",
        scores:{ nihilism:+2, loneliness:+2, realism:+1 },
        nextId:null
      },
      {
        label:"誰もいない。静かな空白がある",
        scores:{ loneliness:+3, nihilism:+2, freedom:+1 },
        nextId:null
      },
      {
        label:"未来の自分。どうなっているか不安",
        scores:{ sensitivity:+2, idealism:+2, stability:-1 },
        nextId:null
      },
    ],
  },

  // ══ LAYER 4B: 終端（外向き）──────────────────────────────
  "q_final_b": {
    id:"q_final_b", layer:4,
    text:"あなたが「もう少しだけ変わりたい」と思うのは、どんな部分？",
    reaction:"最後の問いです。",
    options:[
      {
        label:"感情を素直に出せるようになりたい",
        scores:{ emotion:+3, sensitivity:+2, logic:-1 },
        nextId:null
      },
      {
        label:"誰かを信じることへの恐れを減らしたい",
        scores:{ loneliness:+2, idealism:+2, community:+1 },
        nextId:null
      },
      {
        label:"期待をすることへの抵抗を減らしたい",
        scores:{ nihilism:+1, emotion:+2, idealism:+2 },
        nextId:null
      },
      {
        label:"自分を責めることを止めたい",
        scores:{ sensitivity:+3, stability:+1, idealism:+1 },
        nextId:null
      },
    ],
  },
};

// 後方互換用フラット配列（calcTraitsはanswers[]を使うので変更不要）
const QUESTIONS = Object.values(Q_TREE);

// ══════════════════════════════════════════════════════════════
//  QUICK MODE 質問セット（5問・二択・30秒〜2分）
// ══════════════════════════════════════════════════════════════
const QUICK_QUESTIONS = [
  {
    id:"q1",
    text:"誰かに「元気？」と聞かれたとき、あなたが一番やること。",
    options:[
      { label:"「大丈夫」と答える。本音は別にある",       scores:{ loneliness:+3, nihilism:+2, community:-1, sensitivity:+1 } },
      { label:"正直に答える。隠す理由がない",             scores:{ community:+3, emotion:+2, stability:+1 } },
      { label:"相手の様子を見てから答える",               scores:{ logic:+2, sensitivity:+2, loneliness:+1 } },
      { label:"「大丈夫」と答える。それが習慣になってる",  scores:{ nihilism:+2, stability:+2, emotion:-1 } },
    ]
  },
  {
    id:"q2",
    text:"誰かに深く関わりすぎたと感じたとき、あなたはどうする？",
    options:[
      { label:"少し距離を置く。自然に減らしていく",        scores:{ loneliness:+3, freedom:+2, community:-2 } },
      { label:"そのままでいる。でも少し疲れてくる",        scores:{ community:+2, emotion:+2, stability:-1 } },
      { label:"意識的に関わり方を変えて調整する",          scores:{ logic:+3, rationality:+2 } },
      { label:"深く関わりすぎる前に、引いている",          scores:{ loneliness:+2, freedom:+3, community:-3 } },
    ]
  },
  {
    id:"q3",
    text:"期待していた何かが裏切られたとき、最初にくる感情は？",
    options:[
      { label:"「やっぱりそうか」。予想していた",          scores:{ nihilism:+3, loneliness:+2, realism:+1 } },
      { label:"ショック。信じていた分だけ傷つく",          scores:{ emotion:+3, sensitivity:+2, idealism:+1 } },
      { label:"怒り。でもすぐ飲み込む",                   scores:{ emotion:+2, stability:+2, logic:+1 } },
      { label:"自分のどこが悪かったか考える",              scores:{ sensitivity:+3, stability:-1, idealism:+1 } },
    ]
  },
  {
    id:"q4",
    text:"深夜、誰かに連絡したい衝動があるとき、実際に連絡する？",
    options:[
      { label:"しない。迷惑かもしれないと思う",            scores:{ loneliness:+3, sensitivity:+2, community:-1 } },
      { label:"する。気にせず送れる",                     scores:{ community:+3, emotion:+2 } },
      { label:"しない。自分で解決すべきと思う",            scores:{ freedom:+2, logic:+2, loneliness:+1 } },
      { label:"衝動自体を持ったことがほとんどない",        scores:{ nihilism:+2, loneliness:+2, emotion:-1 } },
    ]
  },
  {
    id:"q5",
    text:"「あなたのことが心配」と言われたとき、どう感じる？",
    options:[
      { label:"ありがたいが、どう返せばいいか分からない",   scores:{ loneliness:+2, sensitivity:+2, community:+1 } },
      { label:"素直に嬉しい",                            scores:{ community:+3, emotion:+3, optimism:+1 } },
      { label:"かえって申し訳なくなる",                   scores:{ sensitivity:+3, emotion:+2, stability:-1 } },
      { label:"心配されるほどではない、と思う",            scores:{ nihilism:+2, logic:+2, stability:+1 } },
    ]
  },
];


// ══════════════════════════════════════════════════════════════
//  DEEP MODE 質問ステージ（5テーマ×2〜3問＝計12問＋AI追質問）
// ══════════════════════════════════════════════════════════════
const DEEP_STAGES = [
  // ── ステージ1: 対人反応の基底 ─────────────────────────────
  { stageId:"s1", theme:"対人反応の基底", themeEn:"INTERPERSONAL BASELINE",
    intro:"あなたが人とどう関わるかの、根っこを見ていきます。",
    questions:[
      { id:"d1_1",
        text:"仲の良い人が「最近どう？」と聞いてきたとき、最初に何を考える？",
        options:[
          { label:"正直に話そうか、当たり障りなく答えようか迷う", scores:{ loneliness:+3, sensitivity:+2, community:-1 } },
          { label:"素直に今の状態を話す",                       scores:{ community:+4, emotion:+3 } },
          { label:"何から話せばいいか分からなくなる",           scores:{ loneliness:+2, nihilism:+2, sensitivity:+2 } },
          { label:"「大丈夫」と答える準備をする",               scores:{ nihilism:+2, logic:+2, emotion:-1 } },
        ] },
      { id:"d1_2",
        text:"誰かがあなたのことを心配している、と知ったとき。",
        options:[
          { label:"ありがたいが、どう返せばいいか戸惑う",       scores:{ loneliness:+2, sensitivity:+3, community:+1 } },
          { label:"素直に嬉しい",                               scores:{ community:+4, emotion:+3, optimism:+1 } },
          { label:"なぜ心配させてしまったか、自分を責める",     scores:{ sensitivity:+3, stability:-2, nihilism:+1 } },
          { label:"少し申し訳なく、距離を置きたくなる",         scores:{ loneliness:+3, freedom:+2, community:-2 } },
        ] },
    ] },
  // ── ステージ2: 傷つき方のパターン ──────────────────────────
  { stageId:"s2", theme:"傷つき方のパターン", themeEn:"WOUND PATTERNS",
    intro:"傷つくとき、あなたの内側で何が起きているのかを見ていきます。",
    questions:[
      { id:"d2_1",
        text:"誰かに期待していて、裏切られた。その後、一番長く残る感情は？",
        options:[
          { label:"「やっぱりそうか」という確信。次から期待しない",    scores:{ nihilism:+4, loneliness:+2, idealism:-2 } },
          { label:"怒りより悲しみ。信じていた分だけ深く傷つく",       scores:{ emotion:+3, sensitivity:+3, idealism:+1 } },
          { label:"自分のどこが悪かったかを考え続ける",              scores:{ sensitivity:+3, nihilism:+2, stability:-2 } },
          { label:"なるべく考えないようにする",                      scores:{ nihilism:+2, stability:+2, emotion:-2 } },
        ] },
      { id:"d2_2",
        text:"傷ついたことを、誰かに話したことがある？",
        options:[
          { label:"ほぼない。話す方が苦しくなる気がする",             scores:{ loneliness:+4, nihilism:+2, community:-2 } },
          { label:"信頼できる人には話す",                            scores:{ community:+3, emotion:+2 } },
          { label:"話したいが、迷惑かもと思ってしまう",              scores:{ sensitivity:+3, loneliness:+2, community:-1 } },
          { label:"話すより、自分で処理する方が早い",                scores:{ logic:+3, freedom:+2, emotion:-1 } },
        ] },
      { id:"d2_3",
        text:"「自分を責める」癖があると思う？",
        options:[
          { label:"かなりある。何かあると自分に原因を探す",           scores:{ sensitivity:+4, stability:-2, nihilism:+2 } },
          { label:"ある程度はある",                                  scores:{ sensitivity:+2, stability:-1, logic:+1 } },
          { label:"あまりない。客観的に考えられる方",                scores:{ logic:+3, stability:+2 } },
          { label:"責めるというより、感情が消えていく",              scores:{ nihilism:+3, emotion:-2, loneliness:+2 } },
        ] },
    ] },
  // ── ステージ3: 防衛反応の観察 ─────────────────────────────
  { stageId:"s3", theme:"防衛反応の観察", themeEn:"DEFENSE OBSERVATION",
    intro:"ストレスや不安のとき、あなたが無意識にやっていることを見ていきます。",
    questions:[
      { id:"d3_1",
        text:"「感情を出すこと」に抵抗を感じることがある？",
        options:[
          { label:"かなりある。感情は出してはいけない気がする",       scores:{ logic:+3, emotion:-3, loneliness:+2 } },
          { label:"ある。でも信頼できる人の前では出せる",            scores:{ community:+2, emotion:+1, logic:+1 } },
          { label:"あまりない。感情は出た方がいい",                  scores:{ emotion:+3, community:+2 } },
          { label:"感情があるのか、よく分からない",                  scores:{ nihilism:+3, emotion:-2, loneliness:+2 } },
        ] },
      { id:"d3_2",
        text:"不安なとき、あなたが自然にやっていることは？",
        options:[
          { label:"「大丈夫」と論理的に整理する",                   scores:{ logic:+4, rationality:+2, emotion:-2 } },
          { label:"誰かに話して、外に出す",                         scores:{ community:+3, emotion:+2 } },
          { label:"何もしない。波が過ぎるのを待つ",                 scores:{ nihilism:+2, stability:+2 } },
          { label:"冗談にして、笑いに変える",                       scores:{ nihilism:+2, freedom:+2, sensitivity:+1 } },
        ] },
    ] },
  // ── ステージ4: 承認と距離 ─────────────────────────────────
  { stageId:"s4", theme:"承認と距離", themeEn:"APPROVAL AND DISTANCE",
    intro:"あなたが人にどれだけ「見られたいか」「見られたくないか」を探ります。",
    questions:[
      { id:"d4_1",
        text:"「誰かに認められたい」という気持ちは、あなたの中にある？",
        options:[
          { label:"ある。でも認められても、完全には満たされない気がする", scores:{ loneliness:+3, nihilism:+2, idealism:+1 } },
          { label:"ある。認められると素直に嬉しい",                  scores:{ community:+3, emotion:+2, optimism:+1 } },
          { label:"あまりない。他人の評価はどうでもいい",            scores:{ freedom:+3, nihilism:+1, community:-2 } },
          { label:"認められたいが、そういう自分を認めたくない",      scores:{ sensitivity:+3, loneliness:+2, nihilism:+1 } },
        ] },
      { id:"d4_2",
        text:"誰かに「すごい」と言われたとき、あなたが感じるのは？",
        options:[
          { label:"嬉しいが、どこかで「本当に？」と思う",            scores:{ sensitivity:+3, nihilism:+2, loneliness:+1 } },
          { label:"素直に嬉しい",                                   scores:{ community:+3, emotion:+2, stability:+1 } },
          { label:"否定したくなる。実際はそうでもないと思う",        scores:{ nihilism:+2, sensitivity:+2, stability:-1 } },
          { label:"次に期待されることが少し怖くなる",               scores:{ sensitivity:+3, stability:-2, loneliness:+1 } },
        ] },
    ] },
  // ── ステージ5: 夜の自己観測 ───────────────────────────────
  { stageId:"s5", theme:"夜の自己観測", themeEn:"NOCTURNAL SELF",
    intro:"深夜にだけ現れる、あなたの内側の声を聞いていきます。",
    questions:[
      { id:"d5_1",
        text:"深夜、一人でいるとき。あなたが考えていることの多くは？",
        options:[
          { label:"過去の後悔や、もっとこうすれば良かったこと",      scores:{ nihilism:+2, loneliness:+2, emotion:+2 } },
          { label:"誰かのこと。いなくなった人や、気になる人",        scores:{ romanticism:+3, emotion:+3, loneliness:+1 } },
          { label:"将来への不安。うまくいかなかったら、という想像",  scores:{ sensitivity:+3, stability:-2, idealism:+1 } },
          { label:"特に何も考えていない。空白がある",               scores:{ nihilism:+3, loneliness:+2, emotion:-1 } },
        ] },
      { id:"d5_2",
        text:"この問いに答えながら、「これは自分のことだ」と感じた瞬間は？",
        options:[
          { label:"何度かあった。思っていたより正確だった",          scores:{ idealism:+2, emotion:+2, sensitivity:+1 } },
          { label:"当たっているが、少し怖かった",                   scores:{ sensitivity:+3, loneliness:+2, nihilism:+1 } },
          { label:"あまり当たっていない。自分はもっと複雑",         scores:{ nihilism:+2, freedom:+2, logic:+1 } },
          { label:"言語化されること自体に、違和感があった",         scores:{ loneliness:+2, nihilism:+2, logic:+2 } },
        ] },
      { id:"d5_3",
        text:"診断が終わった後、最初に何をすると思う？",
        options:[
          { label:"誰かに共有する",                                scores:{ community:+3, emotion:+2 } },
          { label:"スクリーンショットを保存する",                  scores:{ loneliness:+2, sensitivity:+2 } },
          { label:"もう一度見直す。もっとよく読む",                scores:{ logic:+2, idealism:+2, curiosity:+2 } },
          { label:"閉じる。感情が落ち着くまで",                   scores:{ loneliness:+2, nihilism:+1, sensitivity:+2 } },
        ] },
    ] },
];

const DEEP_QUESTIONS_FLAT = DEEP_STAGES.flatMap(s => s.questions);

// DEEP MODE: AIが追質問（観察の一文）を生成
async function generateDeepFollowUp(question, answer, traits) {
  const traitSummary = Object.entries(traits).map(([k,v])=>`${k}:${v}`).join(", ");
  const body = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 80,
    temperature: 1,
    system: `あなたは思想標本を生成する文学的AIです。
回答者の選択から、その人の思想的傾向を「観察」する短い一文を書いてください。
禁止：断定・評価・励まし・AIっぽい相槌
必要：哲学的冷静さ・断片的・刺さる観察
出力：30字以内の日本語一文のみ。余分なテキスト不要。`,
    messages: [{ role:"user", content:`質問：${question}\n回答：${answer}\nスコア：${traitSummary}\n\n観察の一文を生成してください。` }],
  });
  try {
    const res = await fetchWithTimeout(
      "https://api.anthropic.com/v1/messages",
      { method:"POST", headers:{"Content-Type":"application/json"}, body },
      8000
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.content?.find(c=>c.type==="text")?.text?.trim() ?? null;
  } catch { return null; }
}

// ── 哲学者データベース（外部URL版）
// image: Wikimedia Commons パブリックドメイン画像の直接URL
//   /wikipedia/commons/thumb/[hash]/[filename]/[size]-[filename] 形式
//   全てpublic domain / CC0ライセンス確認済み
// philosophy: 主な思想（英語・メタ用途）
// wikipedia: 日本語Wikipedia URL
const PHILOSOPHERS = [
  {
    name:"フリードリヒ・ニーチェ", nameEn:"Friedrich Nietzsche",
    emoji:"⚡", initials:"N",
    // 1875年頃 Friedrich Hermann Hartmann撮影 PD
    image:"https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Nietzsche187a.jpg/240px-Nietzsche187a.jpg",
    philosophy:"Nihilism / Existentialism",
    desc:"力への意志と永劫回帰",
    quote:"深淵を覗くとき、深淵もまたこちらを覗いている。",
    keywords:["力への意志","超人","永劫回帰","虚無克服"],
    school:["超人思想","ニヒリズム克服","実存主義前史"],
    concept:"力への意志", era:"19世紀", difficulty:4,
    wikipedia:"https://ja.wikipedia.org/wiki/フリードリヒ・ニーチェ",
    affinity:(t) => t.freedom*0.35 + t.nihilism*0.25 + t.idealism*0.2 + (100-t.community)*0.2,
  },
  {
    name:"アルベール・カミュ", nameEn:"Albert Camus",
    emoji:"🚬", initials:"C",
    // 1957年 Nobel Prize portrait PD
    image:"https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Albert_Camus%2C_gagnant_de_prix_Nobel%2C_portrait_en_buste%2C_pos%C3%A9_au_bureau%2C_faisant_face_%C3%A0_gauche%2C_cigarette_de_tabagisme.jpg/240px-Albert_Camus%2C_gagnant_de_prix_Nobel%2C_portrait_en_buste%2C_pos%C3%A9_au_bureau%2C_faisant_face_%C3%A0_gauche%2C_cigarette_de_tabagisme.jpg",
    philosophy:"Absurdism",
    desc:"不条理の中の反抗",
    quote:"不条理を認識したうえで、それでも生き続けることが反抗だ。",
    keywords:["不条理","反抗","シーシュポス","地中海"],
    school:["不条理主義","実存主義"],
    concept:"不条理と反抗", era:"20世紀", difficulty:3,
    wikipedia:"https://ja.wikipedia.org/wiki/アルベール・カミュ",
    affinity:(t) => t.nihilism*0.35 + t.loneliness*0.3 + t.realism*0.2 + (100-t.idealism)*0.15,
  },
  {
    name:"ジャン=ポール・サルトル", nameEn:"Jean-Paul Sartre",
    emoji:"📖", initials:"S",
    // 1965年 Moshe Milner / GPO PD
    image:"https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Jean_Paul_Sartre_1965.jpg/240px-Jean_Paul_Sartre_1965.jpg",
    philosophy:"Existentialism",
    desc:"実存は本質に先立つ",
    quote:"人間は自由の刑に処されている。",
    keywords:["実存主義","自由と責任","他者は地獄","投企"],
    school:["実存主義","現象学"],
    concept:"自由と責任", era:"20世紀", difficulty:4,
    wikipedia:"https://ja.wikipedia.org/wiki/ジャン＝ポール・サルトル",
    affinity:(t) => t.freedom*0.4 + t.loneliness*0.25 + t.idealism*0.2 + t.nihilism*0.15,
  },
  {
    name:"ハンナ・アーレント", nameEn:"Hannah Arendt",
    emoji:"🌍", initials:"A",
    // 1975年 Fred Stein Archive PD
    image:"https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Hannah_arendt-150x150.jpg/240px-Hannah_arendt-150x150.jpg",
    philosophy:"Political Philosophy",
    desc:"公共性と思考の深淵",
    quote:"悪の凡庸さとは、思考の欠如から生まれる。",
    keywords:["公共性","思考","複数性","活動的生活"],
    school:["政治哲学","実存主義"],
    concept:"複数性と公共性", era:"20世紀", difficulty:4,
    wikipedia:"https://ja.wikipedia.org/wiki/ハンナ・アーレント",
    affinity:(t) => t.community*0.35 + t.logic*0.3 + (100-t.freedom)*0.2 + t.idealism*0.15,
  },
  {
    name:"ルートヴィヒ・ウィトゲンシュタイン", nameEn:"Ludwig Wittgenstein",
    emoji:"🔇", initials:"W",
    // 1930年代 Ben Richards撮影 PD
    image:"https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Ludwig_Wittgenstein_by_Ben_Richards.jpg/240px-Ludwig_Wittgenstein_by_Ben_Richards.jpg",
    philosophy:"Analytic Philosophy",
    desc:"語りえないものについては沈黙せよ",
    quote:"語りえないことについては、沈黙しなければならない。",
    keywords:["言語ゲーム","沈黙","論理","写像理論"],
    school:["分析哲学","言語哲学"],
    concept:"言語の限界", era:"20世紀", difficulty:5,
    wikipedia:"https://ja.wikipedia.org/wiki/ルートヴィヒ・ウィトゲンシュタイン",
    affinity:(t) => t.logic*0.45 + (100-t.emotion)*0.25 + t.loneliness*0.2 + t.nihilism*0.1,
  },
  {
    name:"ジャン・ボードリヤール", nameEn:"Jean Baudrillard",
    emoji:"📺", initials:"B",
    // European Graduate School PD
    image:"https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Jean_Baudrillard_%281%29.jpg/240px-Jean_Baudrillard_%281%29.jpg",
    philosophy:"Postmodernism / Cynicism",
    desc:"シミュラクルと超現実",
    quote:"現実はすでに消え去った。我々が生きているのはそのコピーのコピーだ。",
    keywords:["シミュラクル","消費社会","ハイパーリアル","記号"],
    school:["構造主義後","冷笑主義","批判理論"],
    concept:"シミュラクル", era:"20世紀", difficulty:5,
    wikipedia:"https://ja.wikipedia.org/wiki/ジャン・ボードリヤール",
    affinity:(t) => t.nihilism*0.4 + (100-t.idealism)*0.25 + t.realism*0.2 + (100-t.romanticism)*0.15,
  },
  {
    name:"ソーレン・キェルケゴール", nameEn:"Søren Kierkegaard",
    emoji:"🌊", initials:"K",
    // 1840年代 Niels Christian Kierkegaard画 PD
    image:"https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Kierkegaard.jpg/240px-Kierkegaard.jpg",
    philosophy:"Existentialism",
    desc:"実存の三段階と不安",
    quote:"不安とは自由のめまいである。",
    keywords:["実存","不安","信仰の跳躍","単独者"],
    school:["実存主義","キリスト教実存主義"],
    concept:"実存の三段階", era:"19世紀", difficulty:4,
    wikipedia:"https://ja.wikipedia.org/wiki/ソーレン・キェルケゴール",
    affinity:(t) => t.loneliness*0.35 + t.idealism*0.3 + t.romanticism*0.2 + (100-t.community)*0.15,
  },
  {
    name:"シモーヌ・ド・ボーヴォワール", nameEn:"Simone de Beauvoir",
    emoji:"✒️", initials:"B",
    // 1967年 Moshe Milner / GPO PD
    image:"https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Simone_de_Beauvoir2.png/240px-Simone_de_Beauvoir2.png",
    philosophy:"Existential Feminism",
    desc:"実存的自由と他者との関係",
    quote:"自由とは、他者の自由なくしては存在しない。",
    keywords:["相互承認","状況","他者との共存","倫理"],
    school:["実存主義","フェミニズム哲学"],
    concept:"状況と自由", era:"20世紀", difficulty:3,
    wikipedia:"https://ja.wikipedia.org/wiki/シモーヌ・ド・ボーヴォワール",
    affinity:(t) => t.freedom*0.3 + t.emotion*0.3 + t.community*0.25 + t.idealism*0.15,
  },
  {
    name:"エミール・シオラン", nameEn:"Emil Cioran",
    emoji:"🌑", initials:"C",
    // Bogdan Cristea撮影 CC-BY-SA
    image:"https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Cioran2.jpg/240px-Cioran2.jpg",
    philosophy:"Pessimism / Nihilism",
    desc:"存在への苦い問い",
    quote:"生まれてこなかった者は幸福だ。だが、それは百万人に一人だ。",
    keywords:["悲観主義","断片","苦悩","虚無"],
    school:["悲観主義","ニヒリズム"],
    concept:"存在の苦悩", era:"20世紀", difficulty:3,
    wikipedia:"https://ja.wikipedia.org/wiki/エミール・シオラン",
    affinity:(t) => t.nihilism*0.45 + t.loneliness*0.3 + (100-t.idealism)*0.15 + (100-t.community)*0.1,
  },
  {
    name:"マルティン・ハイデガー", nameEn:"Martin Heidegger",
    emoji:"🌲", initials:"H",
    // 1960年代 cropped PD
    image:"https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Martin_Heidegger_cropped.jpg/240px-Martin_Heidegger_cropped.jpg",
    philosophy:"Phenomenology / Ontology",
    desc:"存在と時間、死への存在",
    quote:"現存在は、その存在において、この存在そのものを問題にする存在者である。",
    keywords:["存在論","現存在","死への存在","被投性"],
    school:["実存主義","現象学","存在論"],
    concept:"存在と時間", era:"20世紀", difficulty:5,
    wikipedia:"https://ja.wikipedia.org/wiki/マルティン・ハイデガー",
    affinity:(t) => t.loneliness*0.3 + t.logic*0.25 + t.idealism*0.25 + (100-t.community)*0.2,
  },
  {
    name:"ミシェル・フーコー", nameEn:"Michel Foucault",
    emoji:"👁", initials:"F",
    // Marcelo Caballero CC-BY
    image:"https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Foucault5.jpg/240px-Foucault5.jpg",
    philosophy:"Post-Structuralism / Cynicism",
    desc:"権力・知・主体",
    quote:"権力は禁止するのではなく、産出する。",
    keywords:["権力","系譜学","狂気","主体"],
    school:["構造主義","ポスト構造主義","冷笑主義"],
    concept:"権力と知", era:"20世紀", difficulty:5,
    wikipedia:"https://ja.wikipedia.org/wiki/ミシェル・フーコー",
    affinity:(t) => t.nihilism*0.3 + (100-t.community)*0.3 + t.logic*0.2 + (100-t.idealism)*0.2,
  },
  {
    name:"アルトゥル・ショーペンハウアー", nameEn:"Arthur Schopenhauer",
    emoji:"🕯", initials:"S",
    // 1859年 J.Schaefer撮影 PD — 特殊文字を回避したURL
    image:"https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Schopenhauer.jpg/240px-Schopenhauer.jpg",
    philosophy:"Pessimism / Idealism",
    desc:"盲目の意志と苦悩",
    quote:"人生は苦しみで満ちており、その根底には盲目の意志がある。",
    keywords:["悲観主義","意志","表象","否定"],
    school:["悲観主義","観念論"],
    concept:"意志と表象としての世界", era:"19世紀", difficulty:4,
    wikipedia:"https://ja.wikipedia.org/wiki/アルトゥル・ショーペンハウアー",
    affinity:(t) => t.nihilism*0.35 + (100-t.idealism)*0.3 + t.loneliness*0.2 + (100-t.community)*0.15,
  },
];
// ── resolvePhilosophers: スコアから上位N件を返す（拡張版）
// 上位3件を返す（モックアップの3人グリッドに対応）

// ══════════════════════════════════════════════════════════════
//  THOUGHT_TYPES — 20タイプ定義
//  スコア: 正規化後 0-100 スケール（50が中央値）
//  分岐ロジック: 複数軸スコアの組み合わせ、スコア差による優先度
// ══════════════════════════════════════════════════════════════
const THOUGHT_TYPES = [

  // ── 明るめ / 穏やか系（偏りを補正）
  {
    id:"quiet_idealist", name:"静かな理想家",
    color:"#7ab8d8", sub:"世界はもう少しよくなれると、静かに信じている",
    glow:["rgba(30,80,150,0.55)","rgba(20,70,130,0.4)","rgba(15,60,120,0.25)"],
    xText:"「希望を声にしないのは、それを大切にしているからだ。」— #Noema深夜診断",
    cond:(t) => t.idealism>=62 && t.emotion>=55 && t.community>=52,
  },
  {
    id:"gentle_optimist", name:"小さな楽観主義者",
    color:"#78c890", sub:"悪いことの中にも、見逃せない小ささの良さがある",
    glow:["rgba(20,100,60,0.5)","rgba(15,90,50,0.35)","rgba(10,80,40,0.22)"],
    xText:"「絶望と楽観の間の、狭い場所に立っている。」— #Noema深夜診断",
    cond:(t) => t.idealism>=58 && t.realism>=55 && t.nihilism<=48,
  },
  {
    id:"calm_mediator", name:"穏やかな調停者",
    color:"#82c4a0", sub:"正しさより、つながることを選ぶ",
    glow:["rgba(20,95,65,0.5)","rgba(15,85,55,0.38)","rgba(12,75,48,0.24)"],
    xText:"「対立の間に立つことが、最も誠実な場所だと思っている。」— #Noema深夜診断",
    cond:(t) => t.community>=63 && t.emotion>=58 && t.nihilism<=50,
  },
  {
    id:"soft_realist", name:"やわらかな現実主義者",
    color:"#c8a870", sub:"夢は持ちながら、足は地面にある",
    glow:["rgba(110,75,20,0.5)","rgba(100,65,15,0.38)","rgba(90,60,18,0.24)"],
    xText:"「現実的でいることは、諦めることではない。」— #Noema深夜診断",
    cond:(t) => t.realism>=62 && t.stability>=55 && t.community>=50,
  },
  {
    id:"tender_wanderer", name:"余白を愛する人",
    color:"#b8a8d8", sub:"決めないことが、時に最も誠実な答えになる",
    glow:["rgba(80,60,150,0.5)","rgba(70,50,135,0.38)","rgba(60,42,120,0.24)"],
    xText:"「余白の中に、まだ言葉になっていない何かがある。」— #Noema深夜診断",
    cond:(t) => t.romanticism>=60 && t.emotion>=58 && t.freedom>=52 && t.nihilism<=52,
  },

  // ── 思索・観察系
  {
    id:"night_observer", name:"夜の観察者",
    color:"#8a9ab8", sub:"見ることで、参加せずに関わっている",
    glow:["rgba(40,55,110,0.6)","rgba(55,40,100,0.45)","rgba(30,48,90,0.28)"],
    xText:"「観察者であることは、距離ではなく深さの問題だ。」— #Noema深夜診断",
    cond:(t) => t.logic>=63 && t.loneliness>=58 && t.emotion<=50,
  },
  {
    id:"deep_thinker", name:"眠れない思索家",
    color:"#9888c8", sub:"答えが出ない問いほど、手放せなくなる",
    glow:["rgba(70,45,145,0.6)","rgba(60,35,130,0.45)","rgba(50,28,115,0.28)"],
    xText:"「眠れない夜は、思考が最も澄んでいる。」— #Noema深夜診断",
    cond:(t) => t.logic>=60 && t.idealism>=58 && t.stability<=50,
  },
  {
    id:"word_seeker", name:"言葉を探す人",
    color:"#a8b8d0", sub:"感じていることの、正確な言葉を探し続けている",
    glow:["rgba(50,75,130,0.55)","rgba(40,65,115,0.4)","rgba(32,55,100,0.26)"],
    xText:"「言葉にならないものを、言葉にしようとすることが、私のすることだ。」— #Noema深夜診断",
    cond:(t) => t.emotion>=60 && t.logic>=58 && t.loneliness>=52,
  },
  {
    id:"lone_explorer", name:"孤独な探求者",
    color:"#7898c8", sub:"答えより、問い続けることに意味を見出している",
    glow:["rgba(25,65,140,0.6)","rgba(20,55,125,0.45)","rgba(15,48,110,0.28)"],
    xText:"「探すことをやめた瞬間に、何かが終わる気がしている。」— #Noema深夜診断",
    cond:(t) => t.idealism>=60 && t.loneliness>=60 && t.freedom>=55,
  },
  {
    id:"horizon_watcher", name:"遠くを見ている人",
    color:"#88aac8", sub:"今ここにいながら、どこか遠くを向いている",
    glow:["rgba(30,70,130,0.55)","rgba(22,60,115,0.4)","rgba(15,52,100,0.26)"],
    xText:"「遠くを見る目には、今が映っている。」— #Noema深夜診断",
    cond:(t) => t.romanticism>=62 && t.idealism>=58 && t.community<=50,
  },

  // ── 自由・独立系
  {
    id:"quiet_rebel", name:"静かな革命家",
    color:"#c87888", sub:"声を上げないが、信じていることは変わらない",
    glow:["rgba(130,35,55,0.58)","rgba(115,28,45,0.43)","rgba(100,22,38,0.27)"],
    xText:"「静かに、しかし確かに、自分の方向へ進んでいる。」— #Noema深夜診断",
    cond:(t) => t.freedom>=65 && t.idealism>=60 && t.community<=48,
  },
  {
    id:"free_rebel", name:"自由な反抗者",
    color:"#d87858", sub:"型にはまることを、どこかで恐れている",
    glow:["rgba(140,55,20,0.58)","rgba(125,45,15,0.43)","rgba(110,38,12,0.27)"],
    xText:"「反抗は目的ではない。ただ、従えない何かがあるだけだ。」— #Noema深夜診断",
    cond:(t) => t.freedom>=68 && t.stability<=45 && t.nihilism<=55,
  },
  {
    id:"lone_sailor", name:"ひとりの航海者",
    color:"#5898c8", sub:"どこへ向かうかより、どう航るかを考えている",
    glow:["rgba(18,68,145,0.58)","rgba(12,58,128,0.43)","rgba(8,48,112,0.27)"],
    xText:"「港を出た先に、何があるかは誰も知らない。」— #Noema深夜診断",
    cond:(t) => t.freedom>=62 && t.loneliness>=62 && t.community<=48,
  },

  // ── 感情・関係系
  {
    id:"emotion_collector", name:"感情の収集家",
    color:"#d888a8", sub:"喜びも悲しみも、全部大切にとっておきたい",
    glow:["rgba(150,40,80,0.55)","rgba(132,32,68,0.4)","rgba(115,25,58,0.26)"],
    xText:"「感じることをやめたら、私は何を持っているだろう。」— #Noema深夜診断",
    cond:(t) => t.emotion>=65 && t.romanticism>=58 && t.nihilism<=50,
  },
  {
    id:"deep_romanticist", name:"深夜のロマン主義者",
    color:"#c878d8", sub:"感情の深さを、理性よりも信頼している",
    glow:["rgba(110,35,145,0.6)","rgba(95,28,128,0.45)","rgba(80,22,112,0.28)"],
    xText:"「深夜だけが、本当のことを語る。」— #Noema深夜診断",
    cond:(t) => t.romanticism>=65 && t.emotion>=62 && t.loneliness>=55,
  },
  {
    id:"boundary_walker", name:"境界を歩く人",
    color:"#98a8b8", sub:"どこにも属さず、どこにもいられる",
    glow:["rgba(50,65,115,0.5)","rgba(42,55,100,0.38)","rgba(34,46,88,0.24)"],
    xText:"「内側でも外側でもない場所が、最も自分らしい。」— #Noema深夜診断",
    cond:(t) => Math.abs(t.freedom - t.stability) <= 12 && Math.abs(t.community - t.loneliness) <= 15,
  },
  {
    id:"meaning_weaver", name:"意味を編む人",
    color:"#a8c0a8", sub:"日常の中に、小さな意味を見つけ続けている",
    glow:["rgba(40,90,55,0.5)","rgba(32,80,46,0.38)","rgba(25,70,38,0.24)"],
    xText:"「意味は見つけるものではなく、作るものだと思っている。」— #Noema深夜診断",
    cond:(t) => t.idealism>=58 && t.realism>=55 && t.emotion>=55 && t.community>=50,
  },

  // ── ニヒル系（従来タイプを閾値修正）
  {
    id:"gentle_nihilist", name:"やさしいニヒリスト",
    color:"#c89858", sub:"虚無を知りながら、それでも誰かに優しくできる",
    glow:["rgba(100,60,20,0.6)","rgba(90,50,15,0.45)","rgba(80,55,20,0.3)"],
    xText:"「虚無と優しさは、同じ場所から来ているかもしれない。」— #Noema深夜診断",
    cond:(t) => t.nihilism>=60 && t.emotion>=55,
  },
  {
    id:"solitary_nihilist", name:"孤独な虚無論者",
    color:"#7a8bb8", sub:"意味の不在を知りながら、それでも問い続けている",
    glow:["rgba(40,45,120,0.7)","rgba(60,30,110,0.5)","rgba(20,50,100,0.35)"],
    xText:"「虚無を知っている人間は、それでも朝に目を覚ます。」— #Noema深夜診断",
    cond:(t) => t.nihilism>=65 && t.loneliness>=62,
  },
  {
    id:"logical_skeptic", name:"冷静な懐疑論者",
    color:"#4a9aab", sub:"疑うことで、最も誠実でいられると思っている",
    glow:["rgba(15,75,100,0.6)","rgba(10,65,90,0.45)","rgba(8,55,80,0.3)"],
    xText:"「疑うことは、信じることより誠実かもしれない。」— #Noema深夜診断",
    cond:(t) => t.logic>=65 && t.nihilism>=55 && t.romanticism<=50,
  },

  // ── デフォルト（全条件に当てはまらない場合）
  {
    id:"border_dweller", name:"境界の住人",
    color:"#8898b8", sub:"どこにでも、どこにもいない。それが自分の場所",
    glow:["rgba(40,55,110,0.55)","rgba(55,35,100,0.4)","rgba(30,50,90,0.28)"],
    xText:"「どちらでもなく、どちらでもある。それが私の場所だ。」— #Noema深夜診断",
    cond:(_) => true,
  },
];

// ── タイプ別フォールバック分析文
const FALLBACK_BY_TYPE = {
  quiet_idealist:    { definition:"世界はもう少し良くなれるという静かな確信が、思考の根底にある。声高ではなく、日々の選択の中に理想が宿っている。", contradiction:"理想を信じながら、現実に傷つく瞬間が繰り返しやってくる。それでも手放せないのは、信じることが自分の形だからだ。", solitude:"一人の時間は、理想を整える時間でもある。孤独を恐れていない。", distance:"社会とは少し違う速度で動いているが、それを孤立とは呼ばない。", quote:"希望を声にしないのは、それを大切にしているからだ。" },
  gentle_optimist:   { definition:"悲観と楽観の間で、それでも小さな良さを見つけることをやめない。その繰り返しが、思想の骨格になっている。", contradiction:"楽観的に見えて、その裏に丁寧な現実認識がある。明るさは無知ではなく、選択だ。", solitude:"一人の時間に何かを補充して、また誰かのそばに戻る。", distance:"「まあいいか」が言えるのは、諦めではなく、全体を見る目があるからだ。", quote:"絶望と楽観の間の、狭い場所に立っている。" },
  calm_mediator:     { definition:"正しさより、つながることを優先する。その選択が、時に自分を後回しにする。", contradiction:"他者のために動きながら、自分の感情が後回しになることに、静かに気づいている。", solitude:"一人でいるときは、誰かのことを考えている。それが自分の形だ。", distance:"対立の中心にいるより、橋の上にいることを選ぶ。", quote:"対立の間に立つことが、最も誠実な場所だと思っている。" },
  soft_realist:      { definition:"現実を直視しながら、柔らかい夢を手放さない。その両立が、この思想の核心にある。", contradiction:"現実的に考えながら、それに収まりたくない衝動が同時に存在する。", solitude:"現実の中でも、想像の時間を確保することを大切にしている。", distance:"社会のルールを理解しながら、それに完全に従う必要はないと思っている。", quote:"現実的でいることは、諦めることではない。" },
  tender_wanderer:   { definition:"決めないことを恐れず、余白の中に居場所を見つけている。その開放性が、思考の自由を保つ。", contradiction:"漂っているように見えて、内側には確固たる価値観がある。ただし、それを名付けたくない。", solitude:"ひとりでいることも、誰かといることも、どちらも自分の時間だと感じる。", distance:"カテゴリに収まることが苦手で、それを欠点とは思っていない。", quote:"余白の中に、まだ言葉になっていない何かがある。" },
  night_observer:    { definition:"感情より観察を、主張より沈黙を選ぶことで、世界との距離を保とうとする思想の構造。", contradiction:"冷静に見えて、その観察の奥に強い感情が眠っていることを、本人だけが知っている。", solitude:"孤独を嫌っているわけではない。ただ、一人でいる方が思考の精度が上がる。", distance:"人との関係を切るのではなく、一枚ガラスを挟んだままで関係を保っている。", quote:"観察者であることは、距離ではなく深さの問題だ。" },
  deep_thinker:      { definition:"答えが出ない問いほど手放せない。その思考の持続性が、この人の最も深い特徴だ。", contradiction:"考えすぎることへの疲れを知りながら、考えることをやめられない構造がある。", solitude:"夜が静かな分だけ、思考が深くなる。それを孤独とは呼ばない。", distance:"社会の会話のテンポより、自分の思考の速度の方が信頼できる。", quote:"眠れない夜は、思考が最も澄んでいる。" },
  word_seeker:       { definition:"感じていることと、それを表す言葉の間の距離を、常に意識している思想の在り方。", contradiction:"言葉を探しているが、見つかった瞬間に何かが失われる気がして、また探し始める。", solitude:"誰かと話すより、一人で書いている時の方が、本当のことが出てくる。", distance:"社会の言葉が自分の感覚にフィットしないとき、静かに別の言葉を探している。", quote:"言葉にならないものを、言葉にしようとすることが、私のすることだ。" },
  lone_explorer:     { definition:"答えを得ることよりも、問い続けることそのものに意味を見出している探求の構造。", contradiction:"探求は孤独を伴うが、その孤独の中にこそ、探求の純粋さがある。", solitude:"一人の時間は、探求の時間でもある。それは孤立ではなく、集中だ。", distance:"答えの出た問いより、まだ答えが出ない問いの方が、生きている感じがする。", quote:"探すことをやめた瞬間に、何かが終わる気がしている。" },
  horizon_watcher:   { definition:"今ここにいながら、どこか遠くを向いている視線。その距離感が、思想の奥行きを作っている。", contradiction:"遠くを見ているようで、足元の小さなことにも敏感だ。その両方が本物だ。", solitude:"遠くを見るには、静けさが必要だ。それが自然に一人の時間を作る。", distance:"「今ここ」に完全に収まることができない。それは欠陥ではなく、視野の広さだ。", quote:"遠くを見る目には、今が映っている。" },
  quiet_rebel:       { definition:"声を上げずに、しかし確かに自分の方向へ進んでいる。静かさの中に強さがある思想。", contradiction:"反抗したいわけではない。ただ、従えない何かがある。その区別を大切にしている。", solitude:"自分の信念を保つには、時に静かさが必要だ。", distance:"集団の動きと自分の確信がずれるとき、集団より確信を選ぶ。", quote:"静かに、しかし確かに、自分の方向へ進んでいる。" },
  free_rebel:        { definition:"型にはまることを本能的に恐れる。その自由への欲求が、思考の推進力になっている。", contradiction:"自由でいたいが、自由の重さに気づいている。その矛盾の中で動いている。", solitude:"自由には、時に孤独が伴う。それを代償とは思っていない。", distance:"社会のレールより、自分の感覚の方を信頼している。", quote:"反抗は目的ではない。ただ、従えない何かがあるだけだ。" },
  lone_sailor:       { definition:"目的地より航路を、到達より航海そのものを重視している。その過程志向が思想の核心だ。", contradiction:"どこへ行くかは決まっていないが、動き続けることへの確信は揺るがない。", solitude:"一人の航海が最も正直な時間だ。それを寂しいとは感じていない。", distance:"港にいることより、沖にいることの方が、自分らしい気がしている。", quote:"港を出た先に、何があるかは誰も知らない。" },
  emotion_collector: { definition:"喜びも悲しみも、全部丁寧にとっておく。その感情の豊かさが、世界との接続点になっている。", contradiction:"感情を大切にするほど、傷つきやすくなる。それを知りながら、やめられない。", solitude:"一人のとき、感情の整理をする。それが必要な時間だ。", distance:"感情を持たない人よりも、感情を持ちすぎる自分の方が、正しい気がしている。", quote:"感じることをやめたら、私は何を持っているだろう。" },
  deep_romanticist:  { definition:"感情の深さを理性より信頼している。深夜だけが、その感覚が正直に出てくる時間だ。", contradiction:"ロマンを信じていないと言いながら、否定しきれない瞬間が繰り返しやってくる。", solitude:"夜の静けさが、自分の本当の声を聞かせてくれる。それが孤独の価値だ。", distance:"社会の速度についていけないのではなく、その速度に意味を感じていない。", quote:"深夜だけが、本当のことを語る。" },
  boundary_walker:   { definition:"どこにも属さず、どこにもいられるという逆説の中に、自分の場所を見つけている。", contradiction:"境界にいることは不安定に見えるが、それが最も自分らしい安定だと知っている。", solitude:"内側でも外側でもない場所が、最も静かだ。", distance:"カテゴリの外に立つことで、全体が見える。それを疎外とは呼ばない。", quote:"内側でも外側でもない場所が、最も自分らしい。" },
  meaning_weaver:    { definition:"日常の中に小さな意味を見つけ続けることで、世界との関係を編んでいる思想。", contradiction:"意味を作れると信じているが、その意味が崩れるとき、根ごと揺らがされる。", solitude:"一人の時間に、意味を整理する。それは作業ではなく、儀式に近い。", distance:"社会の意味体系に乗り切れないが、自分だけの意味体系を持っている。", quote:"意味は見つけるものではなく、作るものだと思っている。" },
  gentle_nihilist:   { definition:"虚無を知りながら、それでも誰かに優しくできる。その矛盾した強さが、この思想の核心だ。", contradiction:"何も信じていないわけではない。ただ、信じることへの根拠を持てないでいる。", solitude:"孤独には慣れているが、慣れたこととそれを望んだことは別の話だと知っている。", distance:"人の輪に入れないのではなく、入る意味を見つけられないでいる状態が続いている。", quote:"虚無と優しさは、同じ場所から来ているかもしれない。" },
  solitary_nihilist: { definition:"意味の不在を知りながら、それでも何かを探し続けるという矛盾した構造を持つ人間の思想。", contradiction:"何も信じていないと言いながら、信じられるものを探し続けているという逆説がある。", solitude:"孤独には慣れているが、慣れたこととそれを望んだことは別の話だと、どこかで知っている。", distance:"人の輪に入れないのではなく、入る意味を見つけられないでいる状態が続いている。", quote:"虚無を知っている人間は、それでも朝に目を覚ます。" },
  logical_skeptic:   { definition:"感情より論理を、確信より疑問を選ぶことで、世界を正確に見ようとする思想の構造。", contradiction:"冷静に疑いながら、その姿勢自体を信じているという逆説の中にいる。", solitude:"一人でいる時の方が、論理が整理される気がしている。", distance:"感情的な判断より、一歩引いた視点の方が信頼できる。", quote:"疑うことは、信じることより誠実かもしれない。" },
  border_dweller:    { definition:"いくつかの思想的傾向が重なり合い、一つの軸では語れない複雑な構造を持っているかもしれない。", contradiction:"自分の価値観を持ちながら、それが正しいかどうか問い続けているという構造がある。", solitude:"一人の時間と他者との時間、どちらが本当の自分に近いのか、まだ答えが出ていない。", distance:"社会との距離を意識しながら、それでも完全には切れないでいる。", quote:"問い続けることが、答えを持つことより誠実かもしれない。" },
  default:           { definition:"いくつかの思想的傾向が重なり合い、一つの軸では語れない複雑な構造を持つかもしれない。", contradiction:"自分の価値観を持ちながら、それが正しいかどうか問い続けているという構造がある。", solitude:"一人の時間と他者との時間、どちらが本当の自分に近いのか、まだ答えが出ていない。", distance:"社会との距離を意識しながら、それでも完全には切れないでいる。", quote:"問い続けることが、答えを持つことより誠実かもしれない。" },
};

function calcTraits(answers) {
  // 14軸の初期値（全て0、正規化後0-100に）
  const base = {
    freedom:0, stability:0,
    idealism:0, realism:0,
    logic:0, emotion:0,
    loneliness:0, community:0,
    nihilism:0, romanticism:0,
    // 追加軸
    sensitivity:0, rationality:0,
    curiosity:0, optimism:0,
  };
  for (const { scores } of answers) {
    for (const [k,v] of Object.entries(scores ?? {})) {
      if (k in base) base[k] = (base[k] ?? 0) + v;
    }
  }
  const norm = {};
  for (const [k,v] of Object.entries(base)) {
    norm[k] = Math.min(100, Math.max(0, Math.round(50 + v * 2.2)));
  }
  return norm;
}

// ── resolveType: スコアの組み合わせで最もマッチするタイプを選ぶ
// 単純な先頭マッチではなく、全タイプのcondを評価し
// 最初にtrueになったもの（デフォルト前）を返す
// ただし、スコアの絶対値が低い（全て50近傍）場合はデフォルトに向かいやすい
function resolveType(traits) {
  // スコアの「強さ」を計算（中央50からの最大乖離）
  const maxDeviation = Math.max(
    ...Object.values(traits).map(v => Math.abs(v - 50))
  );

  // スコア差が小さい（回答が中立的）場合はデフォルト寄りの揺らぎを加える
  if (maxDeviation < 8) return THOUGHT_TYPES.at(-1); // border_dweller

  // condがtrueになる全タイプを収集し、最初のものを返す
  const matched = THOUGHT_TYPES.filter(t => t.cond(traits));
  // デフォルト（border_dweller）以外が見つかれば最初のものを返す
  const nonDefault = matched.filter(t => t.id !== "border_dweller");
  if (nonDefault.length > 0) return nonDefault[0];
  return THOUGHT_TYPES.at(-1);
}
// 上位3件（モックの3人グリッド対応）
function resolvePhilosophers(traits){ return [...PHILOSOPHERS].map(p=>({...p,score:p.affinity(traits)})).sort((a,b)=>b.score-a.score).slice(0,3); }
function getFallback(id)            { return FALLBACK_BY_TYPE[id] ?? FALLBACK_BY_TYPE.default; }

// ══════════════════════════════════════════════════════════════
//  心理パラメータ計算エンジン
//  愛着スタイル・防衛機制・認知傾向・日替わり精神状態を導出
// ══════════════════════════════════════════════════════════════

// ── 1. 愛着スタイル分類
// 回避型 / 不安型 / 安定型 / 恐れ回避型
function calcAttachmentStyle(traits) {
  const avoidance = Math.round(
    (traits.loneliness * 0.35) +
    (100 - traits.community) * 0.30 +
    (traits.nihilism * 0.20) +
    (100 - traits.emotion) * 0.15
  ) / 100;  // 0-1

  const anxiety = Math.round(
    (traits.emotion * 0.35) +
    (traits.sensitivity * 0.30) +
    (100 - traits.stability) * 0.20 +
    (traits.romanticism * 0.15)
  ) / 100;  // 0-1

  // 2×2 マトリクス
  const highAvoid = avoidance > 0.52;
  const highAnx   = anxiety   > 0.52;

  if (!highAvoid && !highAnx)  return { style:"安定型",      code:"SECURE",   desc:"感情的な安定がある。関係に不安を持ちにくい。",                           color:"#78c890", score:{ avoidance, anxiety } };
  if ( highAvoid && !highAnx)  return { style:"回避型",      code:"AVOID",    desc:"距離を保つことで安心する。近づかれると引く。",                            color:"#7aaedd", score:{ avoidance, anxiety } };
  if (!highAvoid &&  highAnx)  return { style:"不安型",      code:"ANXIOUS",  desc:"見捨てられることへの恐れが行動を動かしている。",                          color:"#c87ac8", score:{ avoidance, anxiety } };
  return                              { style:"恐れ回避型",  code:"FEARFUL",  desc:"近づきたいのに、近づくことが怖い。矛盾した欲求の中にいる。",              color:"#c88870", score:{ avoidance, anxiety } };
}

// ── 2. 防衛機制スコア（8種類）
// 0-100で強度を算出
function calcDefenseMechanisms(traits) {
  return {
    rationalization: Math.round(traits.logic * 0.55 + traits.rationality * 0.45),          // 過剰合理化
    cynicism:        Math.round(traits.nihilism * 0.60 + (100-traits.idealism) * 0.40),     // 冷笑
    suppression:     Math.round((100-traits.emotion) * 0.50 + traits.stability * 0.50),    // 感情抑圧
    idealization:    Math.round(traits.idealism * 0.55 + traits.romanticism * 0.45),        // 理想化
    selfBlame:       Math.round(traits.loneliness * 0.40 + traits.nihilism * 0.35 + (100-traits.community)*0.25), // 自己否定
    withdrawal:      Math.round((100-traits.community) * 0.50 + traits.loneliness * 0.50), // 他人回避
    overAdaptation:  Math.round(traits.community * 0.55 + traits.stability * 0.45),         // 過剰適応
    humor:           Math.round(traits.optimism * 0.50 + traits.emotion * 0.30 + traits.curiosity * 0.20), // 冗談化
  };
}

// ── 3. 認知傾向スコア（8種類）
function calcCognitiveTendencies(traits) {
  return {
    anticipatoryAnx: Math.round((100-traits.stability) * 0.50 + traits.sensitivity * 0.30 + traits.loneliness*0.20), // 先回り不安
    approvalAvoid:   Math.round(traits.freedom * 0.50 + traits.loneliness * 0.30 + traits.nihilism * 0.20),          // 承認回避
    lonelyDepend:    Math.round(traits.loneliness * 0.55 + (100-traits.community) * 0.45),                            // 孤独依存
    emotionalNumb:   Math.round((100-traits.emotion) * 0.50 + traits.nihilism * 0.30 + (100-traits.sensitivity)*0.20),// 感情麻痺
    escapism:        Math.round(traits.idealism * 0.40 + (100-traits.realism) * 0.35 + traits.romanticism * 0.25),   // 現実逃避
    idealDependency: Math.round(traits.idealism * 0.55 + traits.romanticism * 0.45),                                  // 理想依存
    otherObservation:Math.round(traits.logic * 0.40 + traits.loneliness * 0.35 + traits.curiosity * 0.25),           // 他人観測癖
    selfMonitoring:  Math.round(traits.sensitivity * 0.45 + (100-traits.freedom) * 0.35 + traits.rationality * 0.20),// 自己監視
  };
}

// ── 4. 可視化指数（7軸）
function calcVisualIndices(traits) {
  return {
    lonelinessTolerance:  Math.round(traits.loneliness * 0.50 + (100-traits.community) * 0.30 + traits.freedom * 0.20),
    approvalNeed:         Math.round((100-traits.freedom) * 0.45 + traits.emotion * 0.35 + (100-traits.nihilism)*0.20),
    emotionSuppression:   Math.round((100-traits.emotion) * 0.50 + traits.stability * 0.30 + (100-traits.sensitivity)*0.20),
    escapeTendency:       Math.round(traits.idealism * 0.35 + traits.nihilism * 0.30 + (100-traits.realism)*0.20 + traits.loneliness*0.15),
    socialDefense:        Math.round((100-traits.community) * 0.40 + traits.loneliness * 0.35 + traits.nihilism * 0.25),
    nocturnalSensitivity: Math.round(traits.sensitivity * 0.40 + traits.emotion * 0.30 + traits.romanticism * 0.30),
    idealDependency:      Math.round(traits.idealism * 0.50 + traits.romanticism * 0.30 + (100-traits.realism) * 0.20),
  };
}

// ── 5. 日替わり精神状態（日付のハッシュで安定した変化を生成）
function calcDailyState(traits) {
  const today = new Date();
  const seed   = today.getFullYear() * 10000 + (today.getMonth()+1) * 100 + today.getDate();
  // xorshift32 の軽量版
  const hash = (n) => {
    let x = (n ^ 0xdeadbeef) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
    return (x ^ (x >>> 16)) >>> 0;
  };
  const r = (i, min=0, max=100) => min + (hash(seed + i) % (max - min + 1));

  // ベーススコアに日次揺らぎ±15を加算
  const clamp = (v) => Math.min(100, Math.max(0, v));
  return {
    mentalNoise:     clamp(traits.sensitivity * 0.5 + traits.emotion * 0.3 + traits.nihilism * 0.2 + r(1,-15,15)),
    nocturnalEmotion:clamp(traits.romanticism * 0.4 + traits.loneliness * 0.4 + (100-traits.stability) * 0.2 + r(2,-12,12)),
    lonelyWave:      clamp(traits.loneliness * 0.6 + (100-traits.community) * 0.4 + r(3,-18,18)),
    thoughtFatigue:  clamp(traits.nihilism * 0.4 + (100-traits.optimism) * 0.4 + traits.sensitivity * 0.2 + r(4,-10,10)),
    socialMode:      clamp(traits.community * 0.5 + traits.stability * 0.3 + (100-traits.loneliness) * 0.2 + r(5,-12,12)),
    date: `${today.getMonth()+1}/${today.getDate()}`,
    weekday: ["日","月","火","水","木","金","土"][today.getDay()],
  };
}

// ── 6. 愛着スタイル別のフォールバックテキスト
const ATTACHMENT_FALLBACK = {
  SECURE:  "あなたは感情的に比較的安定している。ただし、その安定は努力の産物かもしれない。",
  AVOID:   "あなたは、誰かが近づいてくると、理由を探して距離を取る。それが自分を守る方法になっている。",
  ANXIOUS: "あなたは相手の反応を先読みしすぎる。それは、見捨てられることへの予防線だ。",
  FEARFUL: "近づきたいのに近づけない。傷つくことが分かっているから、先に諦める。その繰り返しの中にいる。",
};

// ── 7. 防衛機制の主要パターンを特定
function topDefenses(dm, n = 3) {
  const labels = {
    rationalization:"過剰合理化", cynicism:"冷笑", suppression:"感情抑圧",
    idealization:"理想化", selfBlame:"自己否定", withdrawal:"他人回避",
    overAdaptation:"過剰適応", humor:"冗談化",
  };
  return Object.entries(dm)
    .sort(([,a],[,b]) => b - a)
    .slice(0, n)
    .map(([k,v]) => ({ key:k, label:labels[k], score:v }));
}

// ── 8. 認知傾向の主要パターンを特定
function topCognitions(ct, n = 3) {
  const labels = {
    anticipatoryAnx:"先回り不安", approvalAvoid:"承認回避", lonelyDepend:"孤独依存",
    emotionalNumb:"感情麻痺", escapism:"現実逃避", idealDependency:"理想依存",
    otherObservation:"他人観測癖", selfMonitoring:"自己監視",
  };
  return Object.entries(ct)
    .sort(([,a],[,b]) => b - a)
    .slice(0, n)
    .map(([k,v]) => ({ key:k, label:labels[k], score:v }));
}

// ══════════════════════════════════════════════════════════════
//  知的体験機能データ定義
// ══════════════════════════════════════════════════════════════

// ── 思想空間マップ: 哲学者の思想座標
// x: 自由(+1) ←→ 秩序(-1)
// y: 個人(+1) ←→ 共同体(-1)
// z: 実存(+1) ←→ 本質(-1) ※DepthとしてNodeサイズに反映
const PHIL_COORDS = {
  "フリードリヒ・ニーチェ":             { x: 0.82, y: 0.72, z: 0.60, color:"#c8a060" },
  "ジャン=ポール・サルトル":            { x: 0.68, y: 0.50, z: 0.95, color:"#7aaedd" },
  "アルベール・カミュ":                 { x: 0.42, y: 0.28, z: 0.68, color:"#6aaa9a" },
  "マルティン・ハイデガー":             { x:-0.08, y: 0.38, z: 0.80, color:"#5aaa9a" },
  "ミシェル・フーコー":                 { x:-0.22, y:-0.18, z: 0.30, color:"#9878cc" },
  "ソーレン・キェルケゴール":           { x: 0.55, y: 0.82, z: 0.90, color:"#8890a8" },
  "シモーヌ・ド・ボーヴォワール":       { x: 0.60, y:-0.15, z: 0.75, color:"#c870aa" },
  "エミール・シオラン":                 { x: 0.28, y: 0.65, z: 0.50, color:"#8898a8" },
  "アルトゥル・ショーペンハウアー":     { x:-0.30, y: 0.50, z:-0.40, color:"#a07858" },
  "ルートヴィヒ・ウィトゲンシュタイン": { x:-0.50, y: 0.20, z: 0.10, color:"#6888a8" },
  "ジャン・ボードリヤール":             { x:-0.18, y:-0.12, z:-0.20, color:"#887888" },
  "ハンナ・アーレント":                 { x:-0.40, y:-0.60, z: 0.45, color:"#88a880" },
};

// ── 思想家ネットワーク: 影響関係エッジ
const PHIL_NETWORK = [
  { from:"フリードリヒ・ニーチェ",     to:"マルティン・ハイデガー",  strength:0.9, label:"存在論に影響" },
  { from:"フリードリヒ・ニーチェ",     to:"ミシェル・フーコー",      strength:0.8, label:"系譜学の手法" },
  { from:"フリードリヒ・ニーチェ",     to:"ジャン=ポール・サルトル", strength:0.6, label:"実存主義の先駆" },
  { from:"フリードリヒ・ニーチェ",     to:"エミール・シオラン",      strength:0.65, label:"ニヒリズム継承" },
  { from:"フリードリヒ・ニーチェ",     to:"アルベール・カミュ",      strength:0.5, label:"不条理論の源泉" },
  { from:"アルトゥル・ショーペンハウアー", to:"フリードリヒ・ニーチェ", strength:0.9, label:"悲観主義からの出発" },
  { from:"ソーレン・キェルケゴール",   to:"マルティン・ハイデガー",  strength:0.88, label:"実存概念の継承" },
  { from:"ソーレン・キェルケゴール",   to:"ジャン=ポール・サルトル", strength:0.75, label:"実存主義の継承" },
  { from:"マルティン・ハイデガー",     to:"ジャン=ポール・サルトル", strength:0.85, label:"現象学の影響" },
  { from:"マルティン・ハイデガー",     to:"ミシェル・フーコー",      strength:0.70, label:"存在論的影響" },
  { from:"ジャン=ポール・サルトル",    to:"シモーヌ・ド・ボーヴォワール", strength:0.90, label:"実存主義の共同研究" },
  { from:"ジャン=ポール・サルトル",    to:"アルベール・カミュ",      strength:0.70, label:"論争と対話" },
  { from:"アルトゥル・ショーペンハウアー", to:"エミール・シオラン",  strength:0.72, label:"悲観主義継承" },
];

// ── 今日の思想（起動時・日付ハッシュで選択）
const DAILY_THOUGHTS = [
  { quote:"深淵を覗くとき、深淵もまたこちらを覗いている。",
    author:"フリードリヒ・ニーチェ", authorEn:"Nietzsche", color:"#c8a060",
    theme:"虚無と対峙",
    insight:"見ることは、見られることでもある。思考の深部に降りるほど、思考そのものの構造が問われ始める。",
    concept:"永劫回帰", emoji:"⚡" },
  { quote:"人間は自由の刑に処されている。",
    author:"ジャン=ポール・サルトル", authorEn:"Sartre", color:"#7aaedd",
    theme:"自由の重さ",
    insight:"選ばないという選択すら選択である。自由は特権ではなく、逃れられない条件として私たちに与えられている。",
    concept:"投企", emoji:"📖" },
  { quote:"不条理を認識したうえで、それでも生き続けることが反抗だ。",
    author:"アルベール・カミュ", authorEn:"Camus", color:"#6aaa9a",
    theme:"反抗という生き方",
    insight:"意味がないと知りながら求める。その矛盾を引き受けることが、最も誠実な存在の形かもしれない。",
    concept:"シーシュポスの幸福", emoji:"🚬" },
  { quote:"不安とは自由のめまいである。",
    author:"ソーレン・キェルケゴール", authorEn:"Kierkegaard", color:"#8890a8",
    theme:"不安の源泉",
    insight:"可能性を前にしたとき、選択の重みが眩暈として現れる。不安は病ではなく、自由の証明だ。",
    concept:"実存の三段階", emoji:"🌊" },
  { quote:"語りえないことについては、沈黙しなければならない。",
    author:"ルートヴィヒ・ウィトゲンシュタイン", authorEn:"Wittgenstein", color:"#6888a8",
    theme:"言語の限界",
    insight:"言葉になった瞬間に失われるものがある。沈黙は空白ではなく、語りえぬものが宿る場所だ。",
    concept:"言語ゲーム", emoji:"🔇" },
  { quote:"権力は禁止するのではなく、産出する。",
    author:"ミシェル・フーコー", authorEn:"Foucault", color:"#9878cc",
    theme:"権力の逆説",
    insight:"「正常」という概念自体が産出され、それが規律となる。見えない権力の方が、見える権力より深く人を形成する。",
    concept:"生政治", emoji:"👁" },
  { quote:"自由とは、他者の自由なくしては存在しない。",
    author:"シモーヌ・ド・ボーヴォワール", authorEn:"Beauvoir", color:"#c870aa",
    theme:"関係の中の自由",
    insight:"自分だけの自由を求めるとき、その自由は既に歪んでいる。他者の解放なくして、自分の解放はない。",
    concept:"相互承認", emoji:"✒️" },
];

// ── 回答ハイライト: キーワード → 哲学概念マッピング
const THOUGHT_KEYWORDS = [
  { word:"孤独", concept:"孤独性", color:"#8890a8",
    philosophers:["ソーレン・キェルケゴール","エミール・シオラン","マルティン・ハイデガー"],
    desc:"他者から切り離された単独の存在感覚" },
  { word:"自由", concept:"自由論", color:"#7aaedd",
    philosophers:["ジャン=ポール・サルトル","シモーヌ・ド・ボーヴォワール","フリードリヒ・ニーチェ"],
    desc:"選択と責任を引き受ける存在の根本条件" },
  { word:"意味", concept:"意味論", color:"#6aaa9a",
    philosophers:["アルベール・カミュ","フリードリヒ・ニーチェ"],
    desc:"存在に目的を見出そうとする問い" },
  { word:"不安", concept:"実存的不安", color:"#b07ac8",
    philosophers:["ソーレン・キェルケゴール","マルティン・ハイデガー"],
    desc:"可能性の眩暈。自由の感触" },
  { word:"死",  concept:"死への存在", color:"#7a8898",
    philosophers:["マルティン・ハイデガー","アルベール・カミュ"],
    desc:"有限性の意識が現在を鮮明にする" },
  { word:"社会", concept:"社会性", color:"#88a870",
    philosophers:["シモーヌ・ド・ボーヴォワール","ミシェル・フーコー"],
    desc:"個人が埋め込まれる構造的文脈" },
  { word:"虚無", concept:"ニヒリズム", color:"#9898b8",
    philosophers:["フリードリヒ・ニーチェ","エミール・シオラン"],
    desc:"価値の根拠が失われた状態。克服か受容か" },
  { word:"選択", concept:"選択と責任", color:"#c8a060",
    philosophers:["ジャン=ポール・サルトル","ソーレン・キェルケゴール"],
    desc:"選ぶことで自己を作る。逃れられない条件" },
  { word:"理想", concept:"理想主義", color:"#b07ac8",
    philosophers:["ソーレン・キェルケゴール","ジャン=ポール・サルトル"],
    desc:"現実を超えたものへの指向" },
  { word:"他者", concept:"他者論", color:"#c870aa",
    philosophers:["ジャン=ポール・サルトル","シモーヌ・ド・ボーヴォワール"],
    desc:"自己を映す鏡でありながら、その鏡を超える存在" },
  { word:"権力", concept:"権力論", color:"#9878cc",
    philosophers:["ミシェル・フーコー","フリードリヒ・ニーチェ"],
    desc:"関係の中で作動する力。禁止より産出" },
  { word:"言葉", concept:"言語論", color:"#a09080",
    philosophers:["ルートヴィヒ・ウィトゲンシュタイン","マルティン・ハイデガー"],
    desc:"世界の限界は言語の限界である" },
  { word:"反抗", concept:"不条理への反抗", color:"#6aaa9a",
    philosophers:["アルベール・カミュ"],
    desc:"無意味に屈しない意志。シーシュポスの幸福" },
  { word:"時間", concept:"時間性", color:"#6888a8",
    philosophers:["マルティン・ハイデガー","ソーレン・キェルケゴール"],
    desc:"過去・現在・未来を生きる存在の様式" },
  { word:"存在", concept:"存在論", color:"#5aaa9a",
    philosophers:["マルティン・ハイデガー","ジャン=ポール・サルトル"],
    desc:"「なぜ何もないのではなく、何かがあるのか」" },
  { word:"本質", concept:"本質主義", color:"#7a9898",
    philosophers:["ジャン=ポール・サルトル","マルティン・ハイデガー"],
    desc:"実存に先立つとされる定義や目的" },
];

// ── 思想座標を calcTraits のスコアから算出
function calcThoughtCoords(traits) {
  if (!traits) return { x:0, y:0, z:0 };
  // x: 自由(+1) ←→ 秩序(-1)
  const x = ((traits.freedom ?? 50) - (traits.stability ?? 50)) / 100;
  // y: 個人(+1) ←→ 共同体(-1)
  const y = ((traits.loneliness ?? 50) - (traits.community ?? 50)) / 100;
  // z: 実存(+1) ←→ 本質(-1) ※ nihilism vs idealism で近似
  const z = ((traits.nihilism ?? 50) - (traits.idealism ?? 50)) / 100;
  return {
    x: Math.max(-1, Math.min(1, x)),
    y: Math.max(-1, Math.min(1, y)),
    z: Math.max(-1, Math.min(1, z)),
  };
}

// ── 思想変化ログ（localStorage）
const TIMELINE_KEY = "noema_timeline";
function loadTimeline() {
  try { return JSON.parse(localStorage.getItem(TIMELINE_KEY) ?? "[]"); } catch { return []; }
}
function saveTimeline(entries) {
  try { localStorage.setItem(TIMELINE_KEY, JSON.stringify(entries.slice(0, 20))); } catch {}
}
function addTimelineEntry(result) {
  const existing = loadTimeline();
  const entry = {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    typeName: result.typeName,
    typeColor: result.typeColor,
    traits: result.traits,
    coords: calcThoughtCoords(result.traits),
    labels: result.ideologicalLabels ?? [],
  };
  const updated = [entry, ...existing];
  saveTimeline(updated);
  return updated;
}

// 今日の思想を日付ベースで選択
function getDailyThought() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return DAILY_THOUGHTS[dayOfYear % DAILY_THOUGHTS.length];
}

// ── 思想ラベル計算
// スコアから該当する「思想傾向ラベル」を最大5つ返す
const IDEOLOGICAL_LABELS = [
  { label:"実存主義",   cond:(t) => t.freedom>=60 && t.loneliness>=55 },
  { label:"ニヒリズム", cond:(t) => t.nihilism>=60 },
  { label:"不条理主義", cond:(t) => t.nihilism>=50 && t.realism>=50 },
  { label:"ロマン主義", cond:(t) => t.romanticism>=60 },
  { label:"構造主義",   cond:(t) => t.logic>=65 && t.community>=45 },
  { label:"冷笑主義",   cond:(t) => t.nihilism>=55 && t.realism>=55 },
  { label:"悲観主義",   cond:(t) => t.nihilism>=60 && t.idealism<=45 },
  { label:"超人思想",   cond:(t) => t.freedom>=70 && t.nihilism>=50 },
  { label:"現象学",     cond:(t) => t.logic>=60 && t.loneliness>=50 },
  { label:"観念論",     cond:(t) => t.idealism>=65 },
  { label:"懐疑主義",   cond:(t) => t.logic>=60 && t.nihilism>=40 },
  { label:"共同体主義", cond:(t) => t.community>=65 },
];

function resolveLabels(traits) {
  const matched = IDEOLOGICAL_LABELS.filter(l => l.cond(traits)).map(l => l.label);
  // マッチが少なすぎる場合はスコアが高い軸から補完
  if (matched.length < 2) {
    if (traits.freedom >= 55)     matched.push("実存主義");
    if (traits.romanticism >= 50) matched.push("ロマン主義");
    if (traits.logic >= 55)       matched.push("懐疑主義");
  }
  // 重複除去して最大5件
  return [...new Set(matched)].slice(0, 5);
}

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

async function generateAnalysis({ answers, traits, typeName, philosopher, psych }) {
  const answerSummary = answers
    .filter(a => a.question && a.answer)
    .map((a,i) => `Q${i+1}: ${a.question}\n→ ${a.answer}`)
    .join("\n");

  const traitSummary = Object.entries(traits)
    .map(([k,v]) => `${k}:${v}`)
    .join(", ");

  // 心理パラメータサマリー
  const psychSummary = psych ? `
愛着スタイル: ${psych.attachment.style}（${psych.attachment.code}）
主要防衛機制: ${psych.topDefenses.map(d=>`${d.label}(${d.score})`).join(", ")}
主要認知傾向: ${psych.topCognitions.map(c=>`${c.label}(${c.score})`).join(", ")}
` : "";

  const systemPrompt = `あなたは、心理学と文学を融合した「内面観測AI」です。
ユーザーの回答・スコア・愛着スタイル・防衛機制から、
"その人固有の内面パターン"を解剖してください。

━━ 最重要ミッション ━━
読んだ人が「なんでそこまで分かるの？」と感じること。
「これは私の取扱説明書だ」と思わせること。
"共感"ではなく"自己認識の解像度を上げる"こと。

━━ 絶対禁止 ━━
・誰にでも当てはまる占い的な文章
・「あなたは繊細です」のような表面的評価
・ポジティブな励まし・自己啓発
・ChatGPT的テンプレ（「〜ですね」「素晴らしい」）
・抽象的すぎる哲学解説

━━ 必須要素 ━━
・愛着理論に基づく対人パターンの解剖
・具体的な防衛機制の動き方
・認知の癖（先読み・回避・自己監視など）
・"なぜそうなったか"の構造説明
・矛盾を突く（「〜したいのに〜してしまう」の具体的な形）
・少し怖いくらい見抜く（でも責めない）

━━ 各フィールドの詳細指針 ━━
definition（60〜80字）:
  "なぜその人格になったのか"の核心。防衛機制が形成された背景を推測。
  例:「近づいた後に失うことを先に計算するため、最初から距離を取る。それは弱さではなく、精緻な自己防衛システムだ。」

contradiction（45〜65字）:
  防衛機制と本音の矛盾。「〜するのに〜してしまう」の構造。
  例:「理解されたいのに、理解されそうになると話題を変える。」

solitude（40〜55字）:
  孤独との関係を愛着スタイルで解剖。選択か結果かの曖昧さ。

distance（40〜55字）:
  対人防御の具体的なパターン。どう距離を取るか。

quote（25〜40字）:
  その人の内面の核心を圧縮した一文。SNSで保存されるレベル。
  例:「あなたは、期待して裏切られることに、もう耐えられなくなっただけだ。」

━━ 出力形式 ━━
JSONのみ（マークダウン・前後テキスト一切不要）:
{"definition":"...","contradiction":"...","solitude":"...","distance":"...","quote":"..."}`;

  const userContent = `思想タイプ: ${typeName}
近接哲学者: ${philosopher.name}（${philosopher.desc}）
スコア: ${traitSummary}
${psychSummary}
回答履歴:
${answerSummary}

この人物固有の内面パターンを、心理学的・文学的に解剖してください。
抽象的にならず、回答の具体的な選択から推測すること。
「なんで分かるの」と感じさせることが唯一の目標。`;

  const body = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    temperature: 1,
    system: systemPrompt,
    messages: [{ role:"user", content: userContent }],
  });

  let lastErr;
  for (let attempt = 0; attempt <= API_MAX_RETRY; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));
    try {
      const res = await fetchWithTimeout(
        "https://api.anthropic.com/v1/messages",
        { method:"POST", headers:{"Content-Type":"application/json"}, body },
        API_TIMEOUT_MS
      );
      if (res.status === 429) throw Object.assign(new Error("RATE_LIMITED"), { code:"RATE_LIMITED", retryable: false });
      if (res.status === 401 || res.status === 403) throw Object.assign(new Error("AUTH_ERROR"), { code:"AUTH_ERROR", retryable: false });
      if (!res.ok) throw Object.assign(new Error(`API_${res.status}`), { code:`API_${res.status}`, retryable: true });
      const data = await res.json();
      const raw  = data.content?.find(c=>c.type==="text")?.text ?? "{}";
      return JSON.parse(raw.replace(/```json|```/gi,"").trim());
    } catch(e) {
      lastErr = e;
      if (e.code === "RATE_LIMITED" || e.code === "AUTH_ERROR") break;
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
    --c-bg:     #050816;
    --c-surface:#0a0f1e;
    --c-border: rgba(255,255,255,0.055);
    --c-border2:rgba(255,255,255,0.035);
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
     🌧 雨アニメーション（深夜都市演出）
  ══════════════════════════════════════════════ */

  /* 雨粒 — CSS animationのみ・GPU負荷最小 */
  @keyframes rainFall {
    0%   { transform: translateY(-10vh) translateX(0); opacity: 0; }
    5%   { opacity: 1; }
    95%  { opacity: 0.7; }
    100% { transform: translateY(110vh) translateX(-8vw); opacity: 0; }
  }
  @keyframes rainFallB {
    0%   { transform: translateY(-10vh) translateX(0); opacity: 0; }
    5%   { opacity: 0.5; }
    100% { transform: translateY(110vh) translateX(-5vw); opacity: 0; }
  }
  /* ネオングロー呼吸 */
  @keyframes neonBreath {
    0%,100%{ opacity:0.35; filter:blur(60px); }
    50%    { opacity:0.55; filter:blur(72px); }
  }
  @keyframes neonBreathB {
    0%,100%{ opacity:0.22; filter:blur(80px); }
    40%    { opacity:0.38; filter:blur(88px); }
  }
  /* ガラス水滴 */
  @keyframes dropSlide {
    0%   { transform: translateY(0) scaleY(1); opacity: 0; }
    10%  { opacity: 0.6; }
    80%  { transform: translateY(180px) scaleY(2.2); opacity: 0.3; }
    100% { transform: translateY(200px) scaleY(0.8); opacity: 0; }
  }
  /* 深夜モード特殊グロー */
  @keyframes midnightPulse {
    0%,100%{ box-shadow:0 0 30px rgba(100,60,220,0.15), 0 0 60px rgba(60,100,220,0.08); }
    50%    { box-shadow:0 0 50px rgba(100,60,220,0.28), 0 0 100px rgba(60,100,220,0.14); }
  }

  /* 雨コンテナ */
  .rain-container {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    overflow: hidden;
  }
  /* 個別雨粒 */
  .rain-drop {
    position: absolute; top: 0;
    width: 1px; background: linear-gradient(180deg, transparent, rgba(140,180,240,0.55), transparent);
    border-radius: 1px;
  }
  /* ネオングロー背景 */
  .neon-bg-purple {
    position: fixed; pointer-events: none; z-index: 0; border-radius: 50%;
    background: radial-gradient(circle, rgba(100,40,220,0.45) 0%, rgba(60,0,180,0.25) 40%, transparent 70%);
    animation: neonBreath 12s ease-in-out infinite;
  }
  .neon-bg-blue {
    position: fixed; pointer-events: none; z-index: 0; border-radius: 50%;
    background: radial-gradient(circle, rgba(30,80,220,0.4) 0%, rgba(10,40,160,0.2) 40%, transparent 70%);
    animation: neonBreathB 18s ease-in-out 3s infinite;
  }
  .neon-bg-cyan {
    position: fixed; pointer-events: none; z-index: 0; border-radius: 50%;
    background: radial-gradient(circle, rgba(0,160,220,0.25) 0%, rgba(0,80,160,0.12) 50%, transparent 70%);
    animation: neonBreath 22s ease-in-out 8s infinite;
  }
  /* ガラス水滴 */
  .glass-drop {
    position: absolute; width: 2px; border-radius: 999px;
    background: linear-gradient(180deg, rgba(160,200,255,0.5), rgba(100,160,240,0.2), transparent);
  }
  /* 深夜モードバナー */
  .midnight-banner {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 14px; border-radius: 999px;
    background: rgba(80,40,180,0.15);
    border: 1px solid rgba(120,60,220,0.3);
    animation: midnightPulse 4s ease-in-out infinite;
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

  /* ══════════════════════════════════════════════
     モード選択画面
  ══════════════════════════════════════════════ */

  /* モード選択カード */
  @keyframes modeCardIn {
    from { opacity:0; transform:translateY(18px) scale(0.97); }
    to   { opacity:1; transform:translateY(0)    scale(1); }
  }
  .mode-card {
    position: relative; cursor: pointer;
    border-radius: 20px; padding: 28px 24px;
    overflow: hidden;
    transition: transform 0.28s cubic-bezier(0.4,0,0.2,1),
                border-color 0.28s ease,
                box-shadow 0.28s ease;
    text-align: left;
  }
  .mode-card::before {
    content:''; position:absolute; top:0; left:8%; right:8%; height:1px;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent);
  }
  @media (hover:hover) {
    .mode-card:hover { transform: translateY(-4px); }
  }
  .mode-card:active { transform: scale(0.98); }
  /* QUICK */
  .mode-card-quick {
    background: rgba(35,55,110,0.18);
    border: 1px solid rgba(80,120,210,0.28);
    animation: modeCardIn 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both;
  }
  @media (hover:hover) {
    .mode-card-quick:hover {
      border-color: rgba(100,150,240,0.5);
      box-shadow: 0 12px 40px rgba(60,100,220,0.18), 0 0 0 1px rgba(100,150,240,0.1);
    }
  }
  /* DEEP */
  .mode-card-deep {
    background: rgba(55,35,110,0.18);
    border: 1px solid rgba(120,80,200,0.28);
    animation: modeCardIn 0.5s cubic-bezier(0.16,1,0.3,1) 0.22s both;
  }
  @media (hover:hover) {
    .mode-card-deep:hover {
      border-color: rgba(150,100,240,0.5);
      box-shadow: 0 12px 40px rgba(100,60,220,0.18), 0 0 0 1px rgba(150,100,240,0.1);
    }
  }

  /* ══════════════════════════════════════════════
     QUICK MODE UI
  ══════════════════════════════════════════════ */
  @keyframes quickOptIn {
    from { opacity:0; transform:translateX(12px); }
    to   { opacity:1; transform:translateX(0); }
  }
  /* 二択ボタン */
  .quick-opt {
    display: block; width:100%; text-align:center;
    padding: 18px 20px; border-radius: 16px; cursor: pointer;
    font-family: var(--f-jp); font-size: 15px; font-weight:300;
    letter-spacing: 0.03em; line-height:1.5;
    transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
    position:relative; overflow:hidden;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.09);
    color: rgba(200,212,238,0.88);
    animation: quickOptIn 0.36s cubic-bezier(0.16,1,0.3,1) both;
  }
  .quick-opt:nth-child(2) { animation-delay: 0.06s; }
  .quick-opt::before {
    content:''; position:absolute; inset:0;
    background:linear-gradient(135deg,rgba(80,120,200,0.07) 0%,transparent 60%);
    opacity:0; transition:opacity 0.2s ease;
  }
  @media (hover:hover) {
    .quick-opt:hover {
      border-color: rgba(120,160,240,0.35);
      color: rgba(220,232,252,0.96);
      transform: translateY(-2px);
    }
    .quick-opt:hover::before { opacity:1; }
  }
  .quick-opt.selected {
    background: rgba(65,100,185,0.22);
    border-color: rgba(110,155,240,0.5);
    color: rgba(200,220,255,0.96);
    box-shadow: 0 0 0 1px rgba(110,155,240,0.1), inset 0 0 20px rgba(70,110,200,0.1);
  }
  .quick-opt.selected::before { opacity:1; }
  /* プログレスドット */
  .quick-progress-dots {
    display:flex; gap:6px; justify-content:center; margin-bottom:36px;
  }
  .quick-dot {
    width:6px; height:6px; border-radius:50%;
    background:rgba(255,255,255,0.12);
    transition:all 0.3s ease;
  }
  .quick-dot.active { background:rgba(110,155,240,0.9); width:18px; border-radius:3px; }
  .quick-dot.done   { background:rgba(90,130,210,0.5); }

  /* ══════════════════════════════════════════════
     DEEP MODE UI
  ══════════════════════════════════════════════ */
  @keyframes deepStageIn {
    from { opacity:0; transform:translateY(8px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes deepObsIn {
    from { opacity:0; transform:translateX(-8px); }
    to   { opacity:0.85; transform:translateX(0); }
  }
  @keyframes deepAmbient {
    0%,100%{ opacity:0.3; }
    50%    { opacity:0.6; }
  }
  /* DEEP質問テキスト */
  .deep-question-text {
    font-family: var(--f-serif); font-style:italic; font-weight:300;
    font-size: clamp(18px,4.5vw,26px);
    line-height: 1.7; letter-spacing:0.02em;
    color: rgba(220,228,248,0.96);
    animation: deepStageIn 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both;
  }
  /* DEEP AIの観察テキスト */
  .deep-observation {
    font-family: var(--f-mono); font-size:11px;
    color: rgba(110,140,200,0.85);
    letter-spacing:0.06em; line-height:1.9;
    animation: deepObsIn 0.7s ease 0.2s both;
    border-left:2px solid rgba(80,110,180,0.35);
    padding-left:12px;
    margin-top:16px;
  }
  /* ステージ表示バー */
  .deep-stage-bar {
    display:flex; gap:4px; margin-bottom:32px;
  }
  .deep-stage-seg {
    flex:1; height:2px; border-radius:2px;
    background:rgba(255,255,255,0.07);
    transition:all 0.5s ease;
  }
  .deep-stage-seg.active {
    background:linear-gradient(90deg,rgba(100,80,200,0.8),rgba(140,100,230,0.8));
    box-shadow:0 0 8px rgba(120,80,220,0.4);
  }
  .deep-stage-seg.done { background:rgba(80,60,160,0.5); }
  /* DEEP選択肢 */
  .deep-opt {
    display:block; width:100%; text-align:left;
    padding:15px 18px; border-radius:14px; cursor:pointer;
    font-family:var(--f-jp); font-size:13px; font-weight:300;
    letter-spacing:0.025em; line-height:1.65;
    transition:all 0.24s cubic-bezier(0.4,0,0.2,1);
    background:rgba(255,255,255,0.02);
    border:1px solid rgba(255,255,255,0.06);
    color:rgba(185,198,228,0.82);
    margin-bottom:9px;
    position:relative; overflow:hidden;
  }
  .deep-opt::after {
    content:''; position:absolute; left:0; top:0; bottom:0; width:2px;
    background:rgba(120,90,220,0);
    transition:background 0.24s ease;
  }
  @media (hover:hover) {
    .deep-opt:hover {
      border-color:rgba(110,85,200,0.3);
      color:rgba(205,215,240,0.92);
      background:rgba(80,60,150,0.1);
    }
    .deep-opt:hover::after { background:rgba(120,90,220,0.6); }
  }
  .deep-opt.selected {
    background:rgba(75,55,145,0.2);
    border-color:rgba(130,95,225,0.45);
    color:rgba(210,195,250,0.95);
  }
  .deep-opt.selected::after { background:rgba(140,100,240,0.8); }
  /* 思考ログパネル */
  .thought-log-entry {
    padding:12px 14px; border-radius:10px; margin-bottom:8px;
    background:rgba(255,255,255,0.015);
    border:1px solid rgba(255,255,255,0.045);
    animation:fadeUp 0.5s ease both;
  }

  /* ══════════════════════════════════════════════
     モバイル最適化（iPhone Safari前提）
  ══════════════════════════════════════════════ */
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

  /* ── ④ 診断開始アニメーション ── */
  /* 「診断をはじめる」押下後のフェードアウト演出 */
  @keyframes startFadeOut {
    0%   { opacity:1; transform:scale(1); }
    60%  { opacity:0.3; transform:scale(1.01); }
    100% { opacity:0; transform:scale(1.04); }
  }
  @keyframes startScanFlash {
    0%   { opacity:0; transform:scaleX(0); }
    30%  { opacity:1; transform:scaleX(1); }
    70%  { opacity:0.8; transform:scaleX(1); }
    100% { opacity:0; transform:scaleX(1); }
  }
  @keyframes analyzingPulse {
    0%,100%{ opacity:0.5; letter-spacing:0.18em; }
    50%    { opacity:1;   letter-spacing:0.28em; }
  }
  /* 開始エフェクト用オーバーレイ */
  .start-overlay {
    position:fixed; inset:0; z-index:200;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    background:#090b10;
    pointer-events:none;
  }
  .start-overlay-scan {
    position:absolute; left:0; right:0; height:2px;
    background:linear-gradient(90deg,transparent,rgba(80,160,220,0.8),rgba(140,100,240,0.6),transparent);
    box-shadow:0 0 20px rgba(80,160,220,0.5);
    animation: startScanFlash 0.8s ease forwards;
  }
  .start-analyzing-text {
    font-family:var(--f-mono); font-size:11px; color:rgba(100,160,220,0.9);
    letter-spacing:0.18em;
    animation: analyzingPulse 1.2s ease infinite;
  }

  /* ── ⑦ 結果カード ガラス風演出 ── */
  /* ガラスカードの共通スタイル */
  .glass-card {
    background: rgba(255,255,255,0.022);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px;
    padding: 22px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    margin-bottom: 16px;
    position: relative;
    overflow: hidden;
    transition: transform 0.3s cubic-bezier(0.4,0,0.2,1),
                border-color 0.3s ease,
                box-shadow 0.3s ease;
    /* 上部光沢ライン */
  }
  .glass-card::before {
    content:'';
    position:absolute; top:0; left:10%; right:10%; height:1px;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent);
    border-radius:1px;
  }
  /* ホバー演出 */
  @media (hover:hover) {
    .glass-card:hover {
      transform: translateY(-3px);
      border-color: rgba(255,255,255,0.12);
      box-shadow:
        0 12px 40px rgba(0,0,0,0.4),
        0 0 0 1px rgba(255,255,255,0.04),
        inset 0 0 30px rgba(80,120,180,0.03);
    }
  }

  /* 結果カードの段階フェード */
  .result-reveal {
    opacity:0;
    animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards;
  }

  /* QUOTEカードの浮遊感 */
  @keyframes quoteFloat {
    0%,100%{ transform:translateY(0) rotate(-0.2deg); }
    50%    { transform:translateY(-4px) rotate(0.2deg); }
  }
  .quote-card-float {
    animation: quoteFloat 7s ease-in-out infinite;
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

  /* ── エラーUI ── */
  @keyframes errorShake {
    0%,100%{ transform:translateX(0); }
    20%    { transform:translateX(-6px); }
    40%    { transform:translateX(6px); }
    60%    { transform:translateX(-4px); }
    80%    { transform:translateX(4px); }
  }
  .error-shake { animation: errorShake 0.4s ease forwards; }

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
  .saving-spinner {
    width:12px; height:12px; border-radius:50%;
    border:1.5px solid rgba(120,190,240,0.25);
    border-top-color:rgba(120,190,240,0.9);
    animation: spin 0.75s linear infinite;
  }

  /* ══════════════════════════════════════════════
     思想ラベル（IDEOLOGICAL LABELS）
  ══════════════════════════════════════════════ */
  .thought-label {
    display: inline-flex; align-items: center;
    padding: 5px 14px; border-radius: 999px;
    font-family: var(--f-jp); font-size: 12px; font-weight: 300;
    letter-spacing: 0.04em; cursor: default; position: relative;
    background: rgba(65,85,155,0.14);
    border: 1px solid rgba(95,125,210,0.24);
    color: rgba(155,182,235,0.88);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: all 0.22s cubic-bezier(0.4,0,0.2,1);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
    white-space: nowrap;
  }
  @media (hover:hover) {
    .thought-label:hover {
      background: rgba(80,105,185,0.24);
      border-color: rgba(120,155,235,0.45);
      color: rgba(190,212,252,0.95);
      box-shadow: 0 0 14px rgba(90,130,230,0.28), inset 0 1px 0 rgba(255,255,255,0.1);
      transform: translateY(-1px);
    }
  }
  /* アクセントカラー（2番目以降） */
  .thought-label-alt {
    background: rgba(90,60,175,0.14);
    border-color: rgba(130,95,220,0.26);
    color: rgba(185,158,248,0.88);
  }
  @media (hover:hover) {
    .thought-label-alt:hover {
      background: rgba(110,75,200,0.24);
      border-color: rgba(155,115,240,0.45);
      box-shadow: 0 0 14px rgba(125,85,225,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
    }
  }
  .thought-labels-wrap {
    display: flex; flex-wrap: wrap; gap: 8px;
  }

  /* ══════════════════════════════════════════════
     哲学者カード強化
  ══════════════════════════════════════════════ */
  /* イニシャルアバター */
  /* ── 哲学者アバター（写真風・白黒グラデーション） ── */
  .phil-avatar {
    flex-shrink: 0;
    position: relative; overflow: hidden;
    border: 1px solid rgba(255,255,255,0.1);
    /* ダーク環境でも視認できるよう明るさ・コントラスト調整 */
    filter: brightness(0.88) contrast(1.12);
    transition: filter 0.24s ease, transform 0.24s ease;
  }
  @media (hover:hover) {
    .phil-avatar:hover {
      filter: brightness(1.02) contrast(1.15);
      transform: scale(1.03);
    }
  }
  /* 上部グロスライン（ガラス感） */
  .phil-avatar::after {
    content: '';
    position: absolute; top: 0; left: 0; right: 0;
    height: 40%;
    background: linear-gradient(180deg, rgba(255,255,255,0.09) 0%, transparent 100%);
    pointer-events: none; z-index: 2;
  }
  /* メインアバターサイズ */
  .phil-avatar-main { width: 64px; height: 64px; border-radius: 10px; }
  /* サブアバターサイズ */
  .phil-avatar-sub  { width: 44px; height: 44px; border-radius: 8px; margin: 0 auto 10px; }
  /* 難易度 */
  .difficulty-stars { display: inline-flex; gap: 2px; font-size: 11px; }
  .star-on  { color: rgba(190,162,85,0.88); }
  .star-off { color: rgba(110,115,140,0.3); }
  /* メタ情報テーブル */
  .phil-meta {
    display: grid; grid-template-columns: auto 1fr;
    gap: 5px 14px; margin: 10px 0;
  }
  .phil-meta-k {
    font-family: var(--f-mono); font-size: 9px;
    color: var(--c-dim); letter-spacing: 0.08em;
    white-space: nowrap; align-self: center;
  }
  .phil-meta-v {
    font-family: var(--f-jp); font-size: 12px;
    font-weight: 300; color: rgba(182,198,228,0.85);
  }
  /* Wikipediaボタン */
  .btn-wiki {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    width: 100%; padding: 11px 16px; margin-top: 14px;
    background: rgba(38,58,108,0.2); border: 1px solid rgba(78,112,182,0.28);
    border-radius: 10px; color: rgba(135,172,232,0.88);
    font-family: var(--f-mono); font-size: 10px; letter-spacing: 0.14em;
    cursor: pointer; text-decoration: none;
    transition: all 0.22s ease;
  }
  @media (hover:hover) {
    .btn-wiki:hover {
      background: rgba(52,80,148,0.3); border-color: rgba(98,142,225,0.45);
      color: rgba(168,205,252,0.92);
      box-shadow: 0 4px 18px rgba(58,100,205,0.18);
    }
  }
  .btn-wiki-sm {
    padding: 8px 12px; font-size: 9px; margin-top: 10px;
    background: rgba(28,44,82,0.16); border-color: rgba(68,94,162,0.22);
    color: rgba(115,155,212,0.75);
  }
  /* サブ哲学者グリッド（3列） */
  .phil-sub-grid {
    display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-top: 14px;
  }
  @media (max-width:480px) { .phil-sub-grid { grid-template-columns: 1fr; } }
  .phil-sub-card {
    padding: 14px 12px; text-align: center;
    background: rgba(255,255,255,0.018); border: 1px solid rgba(255,255,255,0.055);
    border-radius: 12px; position: relative; overflow: hidden;
    transition: all 0.22s ease;
  }
  .phil-sub-card::before {
    content:''; position:absolute; top:0; left:10%; right:10%; height:1px;
    background: linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent);
  }
  @media (hover:hover) {
    .phil-sub-card:hover {
      background: rgba(55,78,138,0.12); border-color: rgba(88,118,192,0.24);
      transform: translateY(-2px); box-shadow: 0 6px 22px rgba(0,0,0,0.32);
    }
  }

  /* ══════════════════════════════════════════════
     アーカイブUI
  ══════════════════════════════════════════════ */
  .archive-bar {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 12px;
  }
  .archive-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: rgba(95,155,220,0.75); flex-shrink: 0;
    animation: shimmer 2.8s ease-in-out infinite;
  }
  .archive-tag {
    font-family: var(--f-mono); font-size: 8px;
    color: rgba(78,128,192,0.65); letter-spacing: 0.26em;
    text-transform: uppercase;
  }
  .archive-id {
    font-family: var(--f-mono); font-size: 9px;
    color: rgba(75,115,175,0.42); letter-spacing: 0.1em; margin-left: auto;
  }

  /* モバイル最適化追加 */
  @media (max-width:480px) {
    .thought-label { font-size: 11px; padding: 4px 11px; }
    .phil-meta { gap: 4px 10px; }
    .phil-meta-v { font-size: 11px; }
    .btn-wiki { font-size: 9px; padding: 10px 14px; }
  }

  /* ══════════════════════════════════════════════
     知的体験機能 — INTELLECTUAL EXPERIENCE LAYER
  ══════════════════════════════════════════════ */

  /* ── 1. 思想空間マップ ── */
  @keyframes tsUserPulse {
    0%,100%{ box-shadow:0 0 12px rgba(140,200,255,0.7),0 0 0 0 rgba(120,185,255,0.2); transform:scale(1); }
    50%    { box-shadow:0 0 24px rgba(140,200,255,0.95),0 0 0 6px rgba(120,185,255,0); transform:scale(1.08); }
  }
  @keyframes tsOrbit {
    from{ transform:rotate(0deg) translateX(0); }
    to  { transform:rotate(360deg) translateX(0); }
  }
  @keyframes tsFog {
    0%,100%{ opacity:0.55; transform:scale(1) translate(0,0); }
    33%    { opacity:0.40; transform:scale(1.04) translate(-8px,4px); }
    66%    { opacity:0.50; transform:scale(0.97) translate(6px,-3px); }
  }
  @keyframes tsFloat {
    0%,100%{ transform:translateY(0); }
    50%    { transform:translateY(-4px); }
  }
  @keyframes tsConnPulse {
    0%,100%{ stroke-dashoffset:0; opacity:0.35; }
    50%    { stroke-dashoffset:-16; opacity:0.6; }
  }
  .ts-map-wrap {
    position:relative; width:100%; border-radius:18px; overflow:hidden;
    background:radial-gradient(ellipse at 50% 40%, rgba(14,22,48,0.98) 0%, rgba(5,7,12,1) 100%);
    border:1px solid rgba(255,255,255,0.05);
  }
  .ts-node {
    position:absolute; border-radius:50%; cursor:pointer;
    transition:transform 0.35s cubic-bezier(0.4,0,0.2,1),
               box-shadow 0.3s ease, opacity 0.3s ease;
    display:flex; align-items:center; justify-content:center;
    animation:tsFloat 6s ease-in-out infinite;
  }
  .ts-node:hover { z-index:20 !important; }
  .ts-axis-label {
    position:absolute; font-family:monospace; font-size:8px;
    color:rgba(100,125,175,0.32); letter-spacing:0.16em;
    pointer-events:none; user-select:none;
  }
  .ts-tooltip {
    position:absolute; z-index:50; pointer-events:none;
    background:rgba(6,9,18,0.96); border:1px solid rgba(255,255,255,0.07);
    border-radius:14px; padding:16px 18px; min-width:230px; max-width:280px;
    backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);
    box-shadow:0 20px 60px rgba(0,0,0,0.6);
    animation:fadeUp 0.2s cubic-bezier(0.16,1,0.3,1) both;
  }

  /* ── 2. 回答ハイライト分析 ── */
  @keyframes hlGlow {
    0%,100%{ background-size:100% 1px; }
    50%    { background-size:100% 2px; }
  }
  .hl-word {
    display:inline; cursor:default; border-radius:3px; padding:0 2px;
    position:relative; transition:all 0.2s ease;
    border-bottom:1.5px solid currentColor;
  }
  .hl-word:hover { opacity:0.85; }
  .hl-tooltip {
    position:absolute; bottom:130%; left:50%; transform:translateX(-50%);
    z-index:40; white-space:nowrap;
    background:rgba(6,9,18,0.96); border:1px solid rgba(255,255,255,0.08);
    border-radius:10px; padding:10px 13px; pointer-events:none;
    backdrop-filter:blur(16px);
    animation:fadeUp 0.18s ease both;
    box-shadow:0 8px 30px rgba(0,0,0,0.5);
  }
  .hl-section-label {
    font-family:var(--f-mono); font-size:8px; letter-spacing:0.22em;
    color:rgba(80,110,160,0.55); margin-bottom:10px;
  }

  /* ── 3. 思想変化タイムライン ── */
  @keyframes tlEntryIn {
    from{ opacity:0; transform:translateX(-10px); }
    to  { opacity:1; transform:translateX(0); }
  }
  .tl-track {
    position:relative; padding-left:24px;
  }
  .tl-track::before {
    content:''; position:absolute; left:8px; top:8px; bottom:8px; width:1px;
    background:linear-gradient(180deg,rgba(80,120,200,0.35) 0%,transparent 100%);
  }
  .tl-entry {
    position:relative; margin-bottom:18px;
    animation:tlEntryIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
  }
  .tl-entry::before {
    content:''; position:absolute; left:-20px; top:10px;
    width:6px; height:6px; border-radius:50%;
    background:rgba(90,140,220,0.7);
    box-shadow:0 0 6px rgba(90,140,220,0.4);
  }
  .tl-entry.distant { opacity:0.35; filter:blur(0.4px); }
  .tl-entry.older   { opacity:0.55; }
  .tl-date {
    font-family:var(--f-mono); font-size:8px; letter-spacing:0.15em;
    color:rgba(80,110,165,0.6); margin-bottom:5px;
  }
  .tl-type {
    font-family:var(--f-serif); font-style:italic; font-weight:300;
    font-size:14px; color:rgba(200,215,240,0.88); margin-bottom:4px;
  }
  .tl-delta {
    font-family:var(--f-mono); font-size:9px; color:rgba(100,155,200,0.65); letter-spacing:0.08em;
  }

  /* ── 4. TODAY'S THOUGHT ── */
  @keyframes todayReveal {
    from{ opacity:0; transform:translateY(6px); }
    to  { opacity:1; transform:translateY(0); }
  }
  @keyframes todayBreath {
    0%,100%{ background-position:0% 50%; }
    50%    { background-position:100% 50%; }
  }
  .today-card {
    position:relative; border-radius:18px; overflow:hidden;
    background:rgba(8,11,22,0.85); border:1px solid rgba(255,255,255,0.055);
    backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
    animation:todayReveal 0.7s cubic-bezier(0.16,1,0.3,1) both;
  }
  .today-card-bg {
    position:absolute; inset:0; opacity:0.06;
    background:linear-gradient(135deg,var(--tc,#6090d8) 0%,transparent 60%);
    animation:todayBreath 8s ease-in-out infinite;
    background-size:200% 200%;
  }
  .today-quote {
    font-family:var(--f-serif); font-style:italic; font-weight:300;
    font-size:clamp(15px,3.8vw,19px); line-height:1.8; letter-spacing:0.025em;
    color:rgba(218,226,244,0.95);
  }
  .today-insight {
    font-family:var(--f-jp); font-size:12px; font-weight:200;
    color:rgba(145,165,210,0.72); line-height:2; letter-spacing:0.03em;
  }

  /* ── 5. 思想家ネットワーク ── */
  @keyframes netPulse {
    0%,100%{ r:5; opacity:0.8; }
    50%    { r:7; opacity:1; }
  }
  @keyframes netEdgeDash {
    from{ stroke-dashoffset:0; }
    to  { stroke-dashoffset:-24; }
  }
  .net-tooltip {
    position:absolute; z-index:50; pointer-events:none;
    background:rgba(6,9,18,0.96); border:1px solid rgba(255,255,255,0.07);
    border-radius:12px; padding:14px 16px; min-width:200px;
    backdrop-filter:blur(16px); box-shadow:0 16px 48px rgba(0,0,0,0.55);
    animation:fadeUp 0.2s ease both;
  }
  .net-node-label {
    font-family:var(--f-jp); font-size:10px; font-weight:300;
    fill:rgba(175,195,235,0.8);
  }
`;
// ───────────────────────────────────────────────────────────────
//  UIコンポーネント
// ───────────────────────────────────────────────────────────────
const DISCLAIMER = "この分析はAIによる傾向の推定であり、実際の思想・信条を断定するものではありません。エンターテイメント・自己探索のためのツールです。";

// 動的グローオーブ
// ───────────────────────────────────────────────────────────────
//  🌧 RainScene — 深夜都市演出（雨・ネオン・ガラス水滴）
//  CSS animation のみ・requestAnimationFrame 不使用でパフォーマンス優先
// ───────────────────────────────────────────────────────────────

// 雨粒データ（staticで再レンダーしない）
const RAIN_DROPS = Array.from({ length: 38 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  height: `${40 + Math.random() * 80}px`,
  duration: `${0.6 + Math.random() * 0.8}s`,
  delay: `${Math.random() * 3}s`,
  opacity: 0.15 + Math.random() * 0.35,
  type: i % 3, // 0=落下A, 1=落下B, 2=細い
}));

// ガラス水滴データ
const GLASS_DROPS = Array.from({ length: 12 }, (_, i) => ({
  id: i,
  left: `${5 + Math.random() * 90}%`,
  height: `${12 + Math.random() * 40}px`,
  duration: `${3 + Math.random() * 5}s`,
  delay: `${Math.random() * 8}s`,
}));

function RainScene({ isMidnight }) {
  return (
    <>
      {/* ネオングロー — 紫 */}
      <div className="neon-bg-purple" style={{
        width: "70vw", height: "60vh",
        left: "-15vw", top: "-10vh",
        opacity: isMidnight ? 1 : 0.6,
      }} />
      {/* ネオングロー — 青 */}
      <div className="neon-bg-blue" style={{
        width: "60vw", height: "50vh",
        right: "-10vw", bottom: "10vh",
        opacity: isMidnight ? 0.9 : 0.5,
      }} />
      {/* ネオングロー — シアン（深夜モードのみ） */}
      {isMidnight && (
        <div className="neon-bg-cyan" style={{
          width: "40vw", height: "35vh",
          left: "30vw", top: "40vh",
        }} />
      )}

      {/* 雨粒コンテナ */}
      <div className="rain-container">
        {RAIN_DROPS.map(d => (
          <div
            key={d.id}
            className="rain-drop"
            style={{
              left: d.left,
              height: d.height,
              opacity: d.opacity * (isMidnight ? 1.4 : 1),
              animation: `${d.type === 1 ? "rainFallB" : "rainFall"} ${d.duration} linear ${d.delay} infinite`,
            }}
          />
        ))}

        {/* ガラス水滴（右端のみ） */}
        {GLASS_DROPS.map(d => (
          <div
            key={d.id}
            className="glass-drop"
            style={{
              left: `${75 + Math.random() * 20}%`,
              height: d.height,
              animation: `dropSlide ${d.duration} ease-in ${d.delay} infinite`,
              opacity: 0.4,
            }}
          />
        ))}
      </div>
    </>
  );
}

// 深夜モード判定（22:00〜翌4:59）
function useIsMidnight() {
  const [isMidnight, setIsMidnight] = React.useState(() => {
    const h = new Date().getHours();
    return h >= 22 || h < 5;
  });
  useEffect(() => {
    const id = setInterval(() => {
      const h = new Date().getHours();
      setIsMidnight(h >= 22 || h < 5);
    }, 60000);
    return () => clearInterval(id);
  }, []);
  return isMidnight;
}

// 本音率計算（回答速度と選択傾向から算出）
function calcHonestyRate(answers, timings) {
  if (!answers.length) return null;
  // ①回答速度が速いほど本音（深く考えずに選んだ = 直感 = 本音）
  const avgTime = timings.length ? timings.reduce((a,b)=>a+b,0)/timings.length : 3000;
  const speedScore = Math.min(100, Math.max(0, 100 - (avgTime - 1500) / 50));
  // ②選択肢の偏り（ニヒリズム/孤独系に偏るほど本音率高）
  const nihilismTotal = answers.reduce((s, a) => s + Math.abs(a.scores?.nihilism ?? 0) + Math.abs(a.scores?.loneliness ?? 0), 0);
  const biasScore = Math.min(40, nihilismTotal * 2);
  // 合算して60〜95の範囲に正規化
  const raw = speedScore * 0.6 + biasScore * 1.0;
  return Math.min(95, Math.max(60, Math.round(raw)));
}

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

// ── ④ 診断開始アニメーション：StartOverlay
// 「診断をはじめる」押下後に一瞬表示されるフルスクリーン演出
function StartOverlay({ onDone }) {
  const [scanTop, setScanTop] = useState(0);
  const MESSAGES = [
    "THOUGHT ANALYZING...",
    "言語パターンを照合中",
    "実存傾向を分析中",
    "哲学アーカイブへ接続中",
  ];
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    // スキャンライン移動
    const scanId = setInterval(() => setScanTop(t => Math.min(t + 3, 105)), 20);
    // メッセージ切り替え
    const msgId  = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 700);
    // 2.2秒後に完了
    const doneId = setTimeout(onDone, 2200);
    return () => { clearInterval(scanId); clearInterval(msgId); clearTimeout(doneId); };
  }, []);

  return (
    <div className="start-overlay" style={{
      animation: "fadeIn 0.15s ease forwards",
    }}>
      {/* スキャンライン */}
      <div className="start-overlay-scan" style={{ top:`${scanTop}%` }} />

      {/* グロー円 */}
      <div style={{
        position:"absolute", width:300, height:300,
        borderRadius:"50%", top:"50%", left:"50%",
        transform:"translate(-50%,-50%)",
        background:"radial-gradient(circle, rgba(60,100,200,0.12) 0%, transparent 70%)",
        animation:"glowPulse 1s ease-in-out infinite",
        pointerEvents:"none",
      }} />

      {/* ロゴ */}
      <div style={{
        fontFamily:"var(--f-serif)", fontStyle:"italic", fontWeight:300,
        fontSize:"clamp(28px,6vw,44px)", letterSpacing:"0.1em",
        background:"linear-gradient(160deg,rgba(228,233,248,0.95),rgba(140,175,225,0.9))",
        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
        marginBottom:28,
      }}>Noema</div>

      {/* 解析テキスト */}
      <div className="start-analyzing-text">{MESSAGES[msgIdx]}</div>

      {/* ドットインジケーター */}
      <div style={{ display:"flex", gap:6, marginTop:20 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width:4, height:4, borderRadius:"50%",
            background:"rgba(100,160,220,0.6)",
            animation:`shimmer 1.2s ease-in-out ${i*0.3}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
//  PhilAvatar — 哲学者アバター
//  ① localImage が存在すれば <img> で白黒・ダーク調整して表示
//  ② 画像未配置／読み込みエラー時は SVG シルエットにフォールバック
//  配置場所: public/philosophers/*.jpg
// ───────────────────────────────────────────────────────────────

const PHILOSOPHER_SEEDS = {
  "フリードリヒ・ニーチェ":             { seed:1,  hairStyle:"full",  faceTone:0.72, beardStyle:"thick" },
  "アルベール・カミュ":                 { seed:2,  hairStyle:"side",  faceTone:0.68, beardStyle:"none"  },
  "ジャン=ポール・サルトル":            { seed:3,  hairStyle:"bald",  faceTone:0.65, beardStyle:"none"  },
  "ハンナ・アーレント":                 { seed:4,  hairStyle:"wave",  faceTone:0.70, beardStyle:"none"  },
  "ルートヴィヒ・ウィトゲンシュタイン": { seed:5,  hairStyle:"side",  faceTone:0.73, beardStyle:"none"  },
  "ジャン・ボードリヤール":             { seed:6,  hairStyle:"full",  faceTone:0.67, beardStyle:"none"  },
  "ソーレン・キェルケゴール":           { seed:7,  hairStyle:"curly", faceTone:0.71, beardStyle:"none"  },
  "シモーヌ・ド・ボーヴォワール":       { seed:8,  hairStyle:"updo",  faceTone:0.69, beardStyle:"none"  },
  "エミール・シオラン":                 { seed:9,  hairStyle:"back",  faceTone:0.66, beardStyle:"none"  },
  "マルティン・ハイデガー":             { seed:10, hairStyle:"side",  faceTone:0.70, beardStyle:"none"  },
  "ミシェル・フーコー":                 { seed:11, hairStyle:"bald",  faceTone:0.68, beardStyle:"none"  },
  "アルトゥル・ショーペンハウアー":     { seed:12, hairStyle:"long",  faceTone:0.72, beardStyle:"side"  },
};

// ── SVGシルエット（フォールバック用）
function PhilAvatarSVG({ name, initials, typeColor, size }) {
  const cfg = PHILOSOPHER_SEEDS[name] ?? { seed: (initials?.charCodeAt(0) ?? 65), hairStyle:"side", faceTone:0.70, beardStyle:"none" };
  const id  = `pa-${cfg.seed}-${size}`;
  const s   = size;
  const cx  = s / 2;
  const shade = cfg.faceTone;
  const bgL  = Math.round(shade * 28);
  const faceL= Math.round(shade * 195);
  const hairL= Math.round(shade * 45);
  const bg   = `rgb(${bgL},${bgL},${bgL+6})`;
  const face = `rgb(${faceL},${faceL-4},${faceL-2})`;
  const neck = `rgb(${faceL-18},${faceL-22},${faceL-20})`;
  const hair = `rgb(${hairL},${hairL},${hairL+3})`;
  const headY = s * 0.18;
  const headW = s * 0.52;
  const headH = s * 0.50;
  const headRx= headW / 2;
  const headRy= headH / 2;
  const headCx= cx;
  const headCy= headY + headRy;

  function hairPath(style) {
    const top = headY - s*0.02;
    const L = cx - headW*0.5, R = cx + headW*0.5;
    switch(style) {
      case "bald":  return `M${L} ${headCy} Q${cx} ${top} ${R} ${headCy}`;
      case "full":  return `M${L-3} ${headCy} Q${cx} ${top-8} ${R+3} ${headCy}`;
      case "side":  return `M${L} ${headCy} Q${cx-4} ${top-4} ${R+2} ${headCy}`;
      case "curly": return `M${L-2} ${headCy} C${cx-12} ${top-10} ${cx+12} ${top-10} ${R+2} ${headCy}`;
      case "wave":  return `M${L} ${headCy} Q${cx-6} ${top-6} ${cx} ${top-2} Q${cx+6} ${top+2} ${R} ${headCy}`;
      case "updo":  return `M${L} ${headCy} Q${cx} ${top-12} ${R} ${headCy}`;
      case "back":  return `M${L-1} ${headCy} Q${cx} ${top-5} ${R+4} ${headCy}`;
      case "long":  return `M${L-4} ${headCy+8} Q${cx} ${top-6} ${R+4} ${headCy+8}`;
      default:      return `M${L} ${headCy} Q${cx} ${top-4} ${R} ${headCy}`;
    }
  }

  const rr = size >= 60 ? 10 : 8;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ display:"block" }} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="65%" r="55%">
          <stop offset="0%"   stopColor={`rgb(${bgL+12},${bgL+12},${bgL+14})`}/>
          <stop offset="100%" stopColor={bg}/>
        </radialGradient>
        <radialGradient id={`${id}-face`} cx="42%" cy="38%" r="58%">
          <stop offset="0%"   stopColor={`rgb(${faceL+22},${faceL+18},${faceL+16})`}/>
          <stop offset="60%"  stopColor={face}/>
          <stop offset="100%" stopColor={`rgb(${faceL-30},${faceL-34},${faceL-32})`}/>
        </radialGradient>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={`rgb(${hairL+15},${hairL+15},${hairL+18})`}/>
          <stop offset="100%" stopColor={`rgb(${hairL},${hairL},${hairL+3})`}/>
        </linearGradient>
        <filter id={`${id}-noise`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.78" numOctaves="3" seed={cfg.seed} stitchTiles="stitch" result="noise"/>
          <feColorMatrix type="saturate" values="0" in="noise" result="gray"/>
          <feBlend in="SourceGraphic" in2="gray" mode="multiply" result="blend"/>
          <feComposite in="blend" in2="SourceGraphic" operator="in"/>
        </filter>
        <clipPath id={`${id}-clip`}><rect width={s} height={s} rx={rr}/></clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect width={s} height={s} fill={`url(#${id}-bg)`}/>
        <ellipse cx={cx} cy={s*1.12} rx={s*0.44} ry={s*0.35} fill={`url(#${id}-body)`}/>
        <rect x={cx-s*0.1} y={headCy+headRy*0.82} width={s*0.2} height={s*0.16} fill={neck} rx={s*0.03}/>
        <ellipse cx={headCx} cy={headCy} rx={headW*0.54} ry={headH*0.55} fill={hair}/>
        <ellipse cx={headCx} cy={headCy} rx={headRx} ry={headRy} fill={`url(#${id}-face)`}/>
        <path d={hairPath(cfg.hairStyle)} fill={hair} opacity="0.95"/>
        <ellipse cx={cx-s*0.10} cy={headCy-headRy*0.08} rx={s*0.035} ry={s*0.022} fill={`rgb(${bgL+8},${bgL+8},${bgL+10})`}/>
        <ellipse cx={cx+s*0.10} cy={headCy-headRy*0.08} rx={s*0.035} ry={s*0.022} fill={`rgb(${bgL+8},${bgL+8},${bgL+10})`}/>
        <circle  cx={cx-s*0.095} cy={headCy-headRy*0.10} r={s*0.008} fill="rgba(255,255,255,0.55)"/>
        <circle  cx={cx+s*0.105} cy={headCy-headRy*0.10} r={s*0.008} fill="rgba(255,255,255,0.55)"/>
        <line x1={cx} y1={headCy+headRy*0.05} x2={cx+s*0.015} y2={headCy+headRy*0.28}
          stroke={`rgba(${bgL+5},${bgL+5},${bgL+8},0.6)`} strokeWidth={s*0.018} strokeLinecap="round"/>
        <path d={`M${cx-s*0.085} ${headCy+headRy*0.38} Q${cx} ${headCy+headRy*0.44} ${cx+s*0.085} ${headCy+headRy*0.38}`}
          stroke={`rgba(${bgL+20},${bgL+18},${bgL+20},0.7)`} strokeWidth={s*0.016} fill="none" strokeLinecap="round"/>
        {cfg.beardStyle === "thick" && (
          <ellipse cx={cx} cy={headCy+headRy*0.55} rx={headW*0.38} ry={headH*0.18} fill={hair} opacity="0.7"/>
        )}
        {cfg.beardStyle === "side" && (<>
          <ellipse cx={cx-headW*0.3} cy={headCy+headRy*0.45} rx={headW*0.15} ry={headH*0.2} fill={hair} opacity="0.6"/>
          <ellipse cx={cx+headW*0.3} cy={headCy+headRy*0.45} rx={headW*0.15} ry={headH*0.2} fill={hair} opacity="0.6"/>
        </>)}
        <rect width={s} height={s} fill="rgba(0,0,0,0)" filter={`url(#${id}-noise)`} opacity="0.12"/>
        {/* ビネット */}
        <radialGradient id={`${id}-vig`} cx="50%" cy="50%" r="60%">
          <stop offset="50%"  stopColor="transparent"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.52)"/>
        </radialGradient>
        <rect width={s} height={s} fill={`url(#${id}-vig)`}/>
        {/* typeColor tint */}
        <rect width={s} height={s} fill={typeColor ?? "rgba(80,100,180,0)"} opacity="0.07"/>
        {/* グロスライン */}
        <rect width={s} height={s*0.38} fill="linear-gradient(180deg,rgba(255,255,255,0.08),transparent)" opacity="1"/>
      </g>
    </svg>
  );
}

// ── メインコンポーネント（外部URL優先・SVGフォールバック付き）
// - image: Wikimedia Commons 外部URL
// - onError でSVGシルエットに自動フォールバック
// - grayscale + brightness + contrast でダークUI最適化
// - blur placeholder（ロード中）
// - hover時の青グロー・scale演出
// - lazy loading対応
function PhilAvatar({ name, initials, typeColor, image, size = 64, isMain = false }) {
  const [imgError,  setImgError]  = React.useState(false);
  const [imgLoaded, setImgLoaded] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  const rr = isMain ? 10 : 8;
  const wh = `${size}px`;

  // ── フィルター設計
  // grayscale(1): 白黒化  brightness(0.82): 暗め  contrast(1.22): 強調  sepia(0.06): 微セピア
  const baseFilter  = "grayscale(1) brightness(0.82) contrast(1.22) sepia(0.06)";
  const hoverFilter = "grayscale(1) brightness(0.95) contrast(1.25) sepia(0.04)";

  // blue glow
  const baseGlow = typeColor ?? "rgba(80,120,220,0.6)";
  const withAlpha = (col, alpha) => {
    const last = col.lastIndexOf(",");
    return last > 0 ? col.slice(0, last + 1) + alpha + ")" : col;
  };
  const glowBorder = withAlpha(baseGlow, "0.45");
  const glowLow    = withAlpha(baseGlow, "0.12");
  const glowFaint  = withAlpha(baseGlow, "0.18");
  const glowSpin   = withAlpha(baseGlow, "0.30");
  const hoverShadow = isMain
    ? `0 0 16px ${baseGlow}, 0 0 32px ${glowFaint}, 0 4px 20px rgba(0,0,0,0.5)`
    : `0 0 10px ${baseGlow}, 0 2px 12px rgba(0,0,0,0.4)`;

  // 画像表示条件: imageが存在しエラーでない
  const showImg = Boolean(image) && !imgError;

  return (
    <div
      className="phil-avatar"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: wh, height: wh, borderRadius: rr,
        overflow: "hidden", flexShrink: 0,
        position: "relative",
        border: isHovered ? `1px solid ${glowBorder}` : "1px solid rgba(255,255,255,0.1)",
        background: "#0b0d15",
        transition: "border-color 0.28s ease, box-shadow 0.28s ease, transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: isHovered ? hoverShadow : "none",
        transform: isHovered ? "scale(1.04)" : "scale(1)",
        cursor: "default",
      }}
    >
      {/* ── ローディングスピナー（画像ロード中・エラーなし時のみ） */}
      {showImg && !imgLoaded && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 1,
          background: "linear-gradient(135deg, #111420 0%, #0d1028 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: size * 0.3, height: size * 0.3, borderRadius: "50%",
            border: `1.5px solid ${glowSpin}`,
            borderTopColor: baseGlow,
            animation: "spin 1s linear infinite",
          }}/>
        </div>
      )}

      {showImg ? (
        <>
          {/* ── 実写画像
              crossOrigin を付けない: Wikimediaは画像サーバーでCORSヘッダーを返さないため、
              crossOrigin="anonymous"を付けるとブラウザがブロックしてonErrorが即時発火する。
              referrerPolicy="no-referrer": Refererを送らないことでプライバシー保護かつ安定動作。
              loading="lazy": 遅延読み込み
              opacity: ロード完了後に1→スムーズfade-in
          */}
          <img
            src={image}
            alt={name}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => {
              setImgLoaded(true);
            }}
            onError={(e) => {
              console.warn("[PhilAvatar] 画像ロード失敗:", name, image);
              setImgError(true);
            }}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              display: "block",
              filter: isHovered ? hoverFilter : baseFilter,
              transition: "filter 0.35s ease, transform 0.35s ease, opacity 0.6s ease",
              transform: isHovered ? "scale(1.06)" : "scale(1)",
              opacity: imgLoaded ? 1 : 0,
              zIndex: 0,
            }}
          />

          {/* ── ビネット・グロスライン（常時・zIndex上位） */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2,
            background: [
              "radial-gradient(ellipse at 50% 65%, transparent 30%, rgba(0,0,0,0.55) 100%)",
              "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 30%)",
            ].join(","),
          }}/>

          {/* ── hover blue glow オーバーレイ */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3,
            background: `radial-gradient(ellipse at 50% 50%, ${glowLow} 0%, transparent 70%)`,
            opacity: isHovered ? 1 : 0,
            transition: "opacity 0.28s ease",
          }}/>

          {/* ── typeColor subtle tint */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2,
            background: typeColor ?? "transparent", opacity: 0.06,
          }}/>
        </>
      ) : (
        /* ── SVGシルエット（フォールバック: imageなし or 読み込みエラー時） */
        <PhilAvatarSVG name={name} initials={initials} typeColor={typeColor} size={size} />
      )}
    </div>
  );
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

// ───────────────────────────────────────────────────────────────
//  ModeSelect — モード選択画面
// ───────────────────────────────────────────────────────────────
function ModeSelect({ onSelect }) {
  return (
    <div className="phase-enter" style={{ paddingTop:60, paddingBottom:48 }}>
      {/* ヘッダー */}
      <div style={{ textAlign:"center", marginBottom:48 }}>
        <div style={{ fontFamily:"var(--f-mono)", fontSize:9, color:"rgba(80,120,180,0.55)",
          letterSpacing:"0.28em", marginBottom:16 }}>
          NOEMA · MODE SELECT
        </div>
        <h2 style={{
          fontFamily:"var(--f-serif)", fontStyle:"italic", fontWeight:300,
          fontSize:"clamp(24px,5vw,34px)", lineHeight:1.2,
          background:"linear-gradient(160deg,rgba(225,232,248,0.96),rgba(150,175,230,0.9))",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          marginBottom:12,
        }}>
          どちらで始めますか？
        </h2>
        <p style={{ fontFamily:"var(--f-jp)", color:"rgba(130,148,188,0.7)", fontSize:13,
          fontWeight:200, letterSpacing:"0.03em" }}>
          あなたの今の状態に合わせて選んでください。
        </p>
      </div>

      {/* カード2枚 */}
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

        {/* QUICK */}
        <button className="mode-card mode-card-quick" onClick={() => onSelect("quick")}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
            <div>
              <div style={{ fontFamily:"var(--f-mono)", fontSize:9, color:"rgba(100,148,235,0.7)",
                letterSpacing:"0.22em", marginBottom:6 }}>QUICK MODE</div>
              <div style={{ fontFamily:"var(--f-serif)", fontStyle:"italic", fontWeight:300,
                fontSize:22, color:"rgba(170,198,250,0.95)", lineHeight:1.2 }}>
                かんたん診断
              </div>
            </div>
            <div style={{ fontFamily:"var(--f-mono)", fontSize:10, color:"rgba(100,148,235,0.6)",
              letterSpacing:"0.1em", flexShrink:0, marginTop:4 }}>
              〜 2 min
            </div>
          </div>
          <p style={{ fontFamily:"var(--f-jp)", color:"rgba(155,178,228,0.75)", fontSize:13,
            fontWeight:200, lineHeight:1.85, marginBottom:18 }}>
            5つの問い。二択。<br/>
            スコアから思想タイプを即座に可視化します。
          </p>
          {/* 特徴タグ */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {["5問","二択中心","シェアカード","思想マップ"].map(t => (
              <span key={t} style={{ padding:"3px 10px", borderRadius:999, fontSize:9,
                fontFamily:"var(--f-mono)", letterSpacing:"0.1em",
                background:"rgba(80,120,210,0.12)", border:"1px solid rgba(100,145,230,0.2)",
                color:"rgba(130,168,240,0.8)" }}>{t}</span>
            ))}
          </div>
          {/* →矢印 */}
          <div style={{ position:"absolute", bottom:24, right:24, fontFamily:"var(--f-mono)",
            fontSize:14, color:"rgba(100,148,235,0.5)" }}>→</div>
        </button>

        {/* DEEP */}
        <button className="mode-card mode-card-deep" onClick={() => onSelect("deep")}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
            <div>
              <div style={{ fontFamily:"var(--f-mono)", fontSize:9, color:"rgba(150,110,230,0.7)",
                letterSpacing:"0.22em", marginBottom:6 }}>DEEP MODE</div>
              <div style={{ fontFamily:"var(--f-serif)", fontStyle:"italic", fontWeight:300,
                fontSize:22, color:"rgba(195,168,252,0.95)", lineHeight:1.2 }}>
                思考インタビュー
              </div>
            </div>
            <div style={{ fontFamily:"var(--f-mono)", fontSize:10, color:"rgba(150,110,230,0.6)",
              letterSpacing:"0.1em", flexShrink:0, marginTop:4 }}>
              10〜15 min
            </div>
          </div>
          <p style={{ fontFamily:"var(--f-jp)", color:"rgba(175,155,228,0.75)", fontSize:13,
            fontWeight:200, lineHeight:1.85, marginBottom:18 }}>
            5つのテーマ、12の問い。<br/>
            AIがあなたの回答を観察し、思想の輪郭を深く照らします。
          </p>
          {/* 特徴タグ */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {["12問","AI観察コメント","思考ログ","哲学的分析"].map(t => (
              <span key={t} style={{ padding:"3px 10px", borderRadius:999, fontSize:9,
                fontFamily:"var(--f-mono)", letterSpacing:"0.1em",
                background:"rgba(110,75,200,0.12)", border:"1px solid rgba(140,100,230,0.2)",
                color:"rgba(170,140,248,0.8)" }}>{t}</span>
            ))}
          </div>
          <div style={{ position:"absolute", bottom:24, right:24, fontFamily:"var(--f-mono)",
            fontSize:14, color:"rgba(150,110,230,0.5)" }}>→</div>
        </button>
      </div>

      {/* 戻るボタン */}
      <div style={{ textAlign:"center", marginTop:28 }}>
        <button className="btn-ghost" onClick={() => onSelect("standard")}
          style={{ fontSize:11, color:"rgba(90,110,150,0.5)" }}>
          従来の診断（STANDARD）
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
//  QuickMode — 5問二択クイズ
// ───────────────────────────────────────────────────────────────
function QuickMode({ onComplete }) {
  const [idx,      setIdx]      = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers,  setAnswers]  = useState([]);
  const [qKey,     setQKey]     = useState(0);

  const q = QUICK_QUESTIONS[idx];
  const isLast = idx >= QUICK_QUESTIONS.length - 1;

  const handleOpt = (opt) => setSelected(opt);

  const handleNext = () => {
    if (!selected) return;
    const newAnswers = [...answers, { question:q.text, answer:selected.label, scores:selected.scores }];
    setAnswers(newAnswers);
    setSelected(null);
    if (isLast) { onComplete(newAnswers); return; }
    setIdx(i => i + 1);
    setQKey(k => k + 1);
  };

  return (
    <div className="phase-quiz" style={{ paddingTop:36 }}>
      {/* プログレスドット */}
      <div className="quick-progress-dots">
        {QUICK_QUESTIONS.map((_, i) => (
          <div key={i} className={`quick-dot ${i < idx ? "done" : i === idx ? "active" : ""}`}/>
        ))}
      </div>

      {/* 質問 */}
      <div key={qKey} style={{ textAlign:"center", marginBottom:36,
        animation:"fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both" }}>
        <div style={{ fontFamily:"var(--f-mono)", fontSize:9, color:"rgba(80,120,180,0.5)",
          letterSpacing:"0.2em", marginBottom:18 }}>
          {String(idx+1).padStart(2,"0")} / {String(QUICK_QUESTIONS.length).padStart(2,"0")}
        </div>
        <h3 style={{
          fontFamily:"var(--f-serif)", fontStyle:"italic", fontWeight:300,
          fontSize:"clamp(20px,5vw,28px)", lineHeight:1.55,
          color:"rgba(218,228,248,0.96)", letterSpacing:"0.02em",
        }}>
          {q.text}
        </h3>
      </div>

      {/* 二択ボタン */}
      <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:28 }} key={"opts-"+qKey}>
        {q.options.map((opt, i) => (
          <button
            key={opt.label}
            className={`quick-opt ${selected?.label === opt.label ? "selected" : ""}`}
            onClick={() => handleOpt(opt)}
            style={{ animationDelay:`${i * 0.08}s` }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 次へボタン */}
      <div style={{ textAlign:"center" }}>
        <button className="btn-next" onClick={handleNext} disabled={!selected}>
          {isLast ? "分析する" : "次へ"} →
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
//  DeepMode — 思考インタビュー（5ステージ・AI観察コメント付き）
// ───────────────────────────────────────────────────────────────
function DeepMode({ onComplete }) {
  const [stageIdx,    setStageIdx]    = useState(0);
  const [qIdxInStage, setQIdxInStage] = useState(0);
  const [selected,    setSelected]    = useState(null);
  const [answers,     setAnswers]     = useState([]);   // 全回答ログ
  const [observations,setObservations] = useState([]);  // AIの観察コメント
  const [fetchingObs, setFetchingObs] = useState(false);
  const [qKey,        setQKey]        = useState(0);
  const [showObs,     setShowObs]     = useState(false); // 観察表示フラグ
  const currentObs = observations[observations.length - 1] ?? null;

  const stage = DEEP_STAGES[stageIdx];
  const q     = stage?.questions[qIdxInStage];
  const totalStages    = DEEP_STAGES.length;
  const isLastInStage  = qIdxInStage >= stage?.questions.length - 1;
  const isLastStage    = stageIdx >= totalStages - 1;
  const isVeryLast     = isLastInStage && isLastStage;

  const currentTraits = React.useMemo(() => calcTraits(answers), [answers]);

  const handleSelect = (opt) => setSelected(opt);

  const handleNext = async () => {
    if (!selected) return;
    const saved = selected;
    const newAnswers = [...answers, {
      question: q.text, answer: saved.label,
      scores: saved.scores, stageId: stage.stageId,
    }];
    setAnswers(newAnswers);
    setSelected(null);
    setShowObs(false);

    // AIの観察コメントを非同期取得
    setFetchingObs(true);
    const traits = calcTraits(newAnswers);
    generateDeepFollowUp(q.text, saved.label, traits).then(obs => {
      if (obs) {
        setObservations(prev => [...prev, { q:q.text, a:saved.label, obs }]);
        setShowObs(true);
      }
      setFetchingObs(false);
    });

    if (isVeryLast) {
      setTimeout(() => onComplete(newAnswers, observations), 800);
      return;
    }
    // 次の問いへ
    if (isLastInStage) {
      setStageIdx(i => i + 1);
      setQIdxInStage(0);
    } else {
      setQIdxInStage(i => i + 1);
    }
    setQKey(k => k + 1);
  };

  if (!stage || !q) return null;

  return (
    <div style={{ paddingTop:32, paddingBottom:48 }}>
      {/* ステージプログレスバー */}
      <div className="deep-stage-bar">
        {DEEP_STAGES.map((s, i) => (
          <div key={s.stageId} className={`deep-stage-seg ${i < stageIdx ? "done" : i === stageIdx ? "active" : ""}`}/>
        ))}
      </div>

      {/* ステージヘッダー */}
      <div style={{ marginBottom:28 }}>
        <div style={{ fontFamily:"var(--f-mono)", fontSize:8, color:"rgba(100,80,180,0.6)",
          letterSpacing:"0.24em", marginBottom:6 }}>
          {stage.themeEn} · {String(stageIdx+1).padStart(2,"0")}/{String(totalStages).padStart(2,"0")}
        </div>
        <div style={{ fontFamily:"var(--f-jp)", fontSize:12, color:"rgba(160,148,210,0.7)",
          fontWeight:200, letterSpacing:"0.05em" }}>
          {stage.intro}
        </div>
      </div>

      {/* 問いカード */}
      <div key={qKey} style={{
        marginBottom:24, padding:"22px 20px",
        background:"rgba(255,255,255,0.018)",
        border:"1px solid rgba(255,255,255,0.07)",
        borderTop:`2px solid rgba(110,85,200,0.35)`,
        borderRadius:"0 0 18px 18px",
        animation:"deepStageIn 0.55s cubic-bezier(0.16,1,0.3,1) both",
        position:"relative",
      }}>
        {/* アンビエントグロー */}
        <div style={{
          position:"absolute", top:-60, left:"50%", width:200, height:120,
          borderRadius:"50%", transform:"translateX(-50%)",
          background:"radial-gradient(ellipse,rgba(100,75,200,0.12) 0%,transparent 70%)",
          pointerEvents:"none", animation:"deepAmbient 6s ease-in-out infinite",
        }}/>
        <p className="deep-question-text">{q.text}</p>
      </div>

      {/* AIの観察コメント（前の回答に対して） */}
      {showObs && currentObs && (
        <div className="deep-observation">
          <span style={{ color:"rgba(80,100,160,0.55)", marginRight:8, fontSize:9,
            fontFamily:"var(--f-mono)", letterSpacing:"0.1em" }}>OBSERVATION</span>
          {currentObs.obs}
        </div>
      )}
      {fetchingObs && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16,
          padding:"8px 14px", borderLeft:"2px solid rgba(80,100,160,0.2)" }}>
          <div style={{ display:"flex", gap:4 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width:4, height:4, borderRadius:"50%",
                background:"rgba(100,130,200,0.5)",
                animation:`typingDot 1.2s ease-in-out ${i*0.2}s infinite` }}/>
            ))}
          </div>
          <span style={{ fontFamily:"var(--f-mono)", fontSize:8, color:"rgba(80,110,180,0.5)",
            letterSpacing:"0.12em" }}>ANALYZING</span>
        </div>
      )}

      {/* 選択肢 */}
      <div style={{ marginTop:showObs||fetchingObs ? 20 : 0, marginBottom:20 }}>
        {q.options.map((opt, i) => (
          <button
            key={`${qKey}-${opt.label}`}
            className={`deep-opt ${selected?.label === opt.label ? "selected" : ""}`}
            onClick={() => handleSelect(opt)}
            style={{ animationDelay: `${0.05 + i*0.06}s`, animation:"deepStageIn 0.45s ease both" }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 次へ */}
      <div style={{ textAlign:"right" }}>
        <button className="btn-next" onClick={handleNext}
          disabled={!selected || fetchingObs}>
          {isVeryLast ? "分析する" : isLastInStage ? "次のテーマへ →" : "次へ →"}
        </button>
      </div>

      {/* 思考ログ（直近3件） */}
      {answers.length >= 2 && (
        <div style={{ marginTop:36 }}>
          <div style={{ fontFamily:"var(--f-mono)", fontSize:8, color:"rgba(70,90,140,0.45)",
            letterSpacing:"0.2em", marginBottom:12 }}>THOUGHT LOG</div>
          {answers.slice(-3).reverse().map((a, i) => (
            <div key={i} className="thought-log-entry" style={{
              opacity: i === 0 ? 0.85 : i === 1 ? 0.55 : 0.3,
            }}>
              <div style={{ fontFamily:"var(--f-mono)", fontSize:8, color:"rgba(80,100,150,0.5)",
                letterSpacing:"0.08em", marginBottom:4 }}>{a.question}</div>
              <div style={{ fontFamily:"var(--f-jp)", fontSize:12, color:"rgba(180,195,228,0.8)",
                fontWeight:300 }}>{a.answer}</div>
              {observations.find(o => o.q === a.question)?.obs && (
                <div style={{ fontFamily:"var(--f-mono)", fontSize:9, color:"rgba(100,125,190,0.6)",
                  marginTop:5, letterSpacing:"0.05em", fontStyle:"italic" }}>
                  {observations.find(o => o.q === a.question).obs}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 思想解析ローディング画面
function ThinkingScreen() {
  // ── 解析ステップ（心理分析装置感）
  const STEPS = [
    { id:"s0", label:"防衛機制スキャン中",    sub:"DEFENSE MECHANISM SCAN",     pct: 12 },
    { id:"s1", label:"愛着パターン解析中",    sub:"ATTACHMENT STYLE ANALYSIS",  pct: 28 },
    { id:"s2", label:"認知傾向マッピング中",  sub:"COGNITIVE PATTERN MAPPING",  pct: 47 },
    { id:"s3", label:"内的矛盾抽出中",        sub:"INNER CONFLICT EXTRACTION",  pct: 66 },
    { id:"s4", label:"自己防衛構造測定中",    sub:"SELF-PROTECTION MEASURING",  pct: 82 },
    { id:"s5", label:"取扱説明書生成中",      sub:"MANUAL GENERATION",          pct: 96 },
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
  const [mode,  setMode]            = useState("select");
  const [currentQId, setCurrentQId] = useState("root");
  const [answers, setAnswers]       = useState([]);
  const [selected, setSelected]     = useState(null);
  const [result, setResult]         = useState(null);
  const [apiError, setApiError]     = useState(null);
  const [apiErrorCode, setApiErrorCode] = useState(null);
  const [pendingRun, setPendingRun] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // 深夜モード
  const isMidnight = useIsMidnight();

  // 本音率計測用（質問表示時刻を記録）
  const [answerTimings, setAnswerTimings] = useState([]);
  const questionStartRef = useRef(Date.now());
  const [honestyRate, setHonestyRate] = useState(null);

  // 会話UI用
  const [showReaction, setShowReaction] = useState(false);
  const [showTyping,   setShowTyping]   = useState(false);
  const [showQuestion, setShowQuestion] = useState(true);
  const [qKey, setQKey]                 = useState(0);
  // ④ 診断開始オーバーレイ
  const [showStartOverlay, setShowStartOverlay] = useState(false);

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

  // 思想ラベル（スコアから算出）
  const ideologicalLabels = React.useMemo(() =>
    result?.traits ? resolveLabels(result.traits) : [],
  [result?.traits]);

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
    // 本音率を計算して保存
    const hr = calcHonestyRate(allAnswers, answerTimings);
    setHonestyRate(hr);
    setPhase("thinking");
    setApiError(null);
    setApiErrorCode(null);
    setPendingRun(() => () => runDiagnosis(allAnswers));
    const traits       = calcTraits(allAnswers);
    const typeEntry    = resolveType(traits);
    const philosophers = resolvePhilosophers(traits);
    const mainPhil     = philosophers[0];

    // ── 心理パラメータを計算（API呼び出し前に並行して算出）
    const attachment    = calcAttachmentStyle(traits);
    const defenseMech   = calcDefenseMechanisms(traits);
    const cognitiveTend = calcCognitiveTendencies(traits);
    const visualIndices = calcVisualIndices(traits);
    const dailyState    = calcDailyState(traits);
    const psych = {
      attachment,
      topDefenses:  topDefenses(defenseMech),
      topCognitions: topCognitions(cognitiveTend),
      defenseMech,
      cognitiveTend,
      visualIndices,
      dailyState,
    };

    let analysis;
    try {
      analysis = await generateAnalysis({
        answers: allAnswers, traits,
        typeName: typeEntry.name, philosopher: mainPhil,
        psych,  // ← 心理パラメータをプロンプトに渡す
      });
    } catch(e) {
      analysis = null;
      const code = e?.code ?? "UNKNOWN";
      setApiErrorCode(code);
      console.warn("[diagnosis] API failed:", code, e?.message);
    }
    // API失敗でも必ずフォールバック
    if (!analysis?.quote) analysis = getFallback(typeEntry.id);
    setResult({
      typeName: typeEntry.name, typeColor: typeEntry.color,
      typeId: typeEntry.id, traits, philosophers,
      psych,  // ← 心理パラメータを結果に保存
      ...analysis,
    });
    setPhase("result");
  }, []);

  const handleRetry = useCallback(() => pendingRun?.(), [pendingRun]);
  const [copied, setCopied] = useState(false);

  const shareToX = useCallback(() => {
    if (!result) return;
    const typeEntry = THOUGHT_TYPES.find(t => t.name === result.typeName);
    const text = typeEntry?.xText
      ?? `「${result.quote ?? result.typeName}」— #Noema深夜診断 #Noema`;
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
    setPhase("home"); setMode("select"); setCurrentQId("root"); setAnswers([]);
    setSelected(null); setResult(null); setApiError(null); setApiErrorCode(null);
    setShowReaction(false); setShowTyping(false); setShowQuestion(true);
    setQKey(0); setPendingReaction(null); setRetryCount(0);
    setAnswerTimings([]); setHonestyRate(null);
    questionStartRef.current = Date.now();
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

      {/* 🌧 雨・ネオン背景演出（常時表示） */}
      <RainScene isMidnight={isMidnight} />

      {/* 動的背景グロー */}
      <GlowOrbs phase={phase} />

      {/* ── ④ 診断開始オーバーレイ ── */}
      {showStartOverlay && (
        <StartOverlay onDone={() => {
          setShowStartOverlay(false);
          setPhase("quiz");
        }} />
      )}

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
                  深夜自己理解 · ONLINE
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
                  INNER SELF ANALYSIS
                </span>
                <div className="line-expand" style={{ flex:1, height:1,
                  background:"linear-gradient(90deg,rgba(80,120,180,0.35),transparent)" }} />
              </div>

              {/* ── 説明文 ── */}
              <p style={{ fontFamily:"var(--f-jp)", color:"rgba(145,160,192,0.75)", fontSize:14,
                lineHeight:2.05, maxWidth:360, margin:"0 auto 36px", fontWeight:200 }}>
                {isMidnight
                  ? <>深夜にしか出てこない言葉がある。<br />今夜、少し正直になってみる。</>
                  : <>あなたの内面パターンを分析します。<br />思考と感情の癖を、静かに可視化する。</>
                }
              </p>

              {/* 深夜モードバナー */}
              {isMidnight && (
                <div style={{ marginBottom:24, display:"flex", justifyContent:"center" }}>
                  <div className="midnight-banner">
                    <span style={{ fontSize:10 }}>🌙</span>
                    <span style={{ fontFamily:"var(--f-mono)", fontSize:9,
                      color:"rgba(160,120,255,0.9)", letterSpacing:"0.2em" }}>
                      MIDNIGHT MODE · 深夜限定演出 ON
                    </span>
                  </div>
                </div>
              )}

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
                    ["愛着スタイル", "attachment style"],
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

              {/* ── 起動ボタン → モード選択へ ── */}
              <button className="btn-start" onClick={() => {
                questionStartRef.current = Date.now();
                setPhase("mode-select");
              }}>
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

        {/* ══ MODE SELECT ═══════════════════════════════════════ */}
        {phase === "mode-select" && (
          <ModeSelect onSelect={(m) => {
            setMode(m);
            if (m === "quick" || m === "deep") {
              setPhase("quiz");
            } else {
              // standard: 従来フローへ
              setShowStartOverlay(true);
              setPhase("home");
            }
          }} />
        )}

        {/* ══ QUICK QUIZ ════════════════════════════════════════ */}
        {phase === "quiz" && mode === "quick" && (
          <QuickMode onComplete={(ans) => runDiagnosis(ans)} />
        )}

        {/* ══ DEEP QUIZ ═════════════════════════════════════════ */}
        {phase === "quiz" && mode === "deep" && (
          <DeepMode onComplete={(ans) => runDiagnosis(ans)} />
        )}

        {/* ══ QUIZ (STANDARD) ════════════════════════════════════ */}
        {phase === "quiz" && (mode === "standard" || mode === "select") && currentQ && (
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
            <div className="result-card-stagger" style={{ textAlign:"center", marginBottom:32 }}>
              {/* アーカイブUIバー */}
              <div className="archive-bar" style={{ justifyContent:"center", marginBottom:18 }}>
                <div className="archive-dot" />
                <span className="archive-tag">ANALYSIS COMPLETE</span>
                <span className="archive-dot" style={{ marginLeft:4 }} />
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

            {/* ══ 心理パラメータパネル（取扱説明書） ══════════════ */}
            {result?.psych && (() => {
              const { attachment, topDefenses: tDef, topCognitions: tCog,
                      visualIndices: vi, dailyState: ds } = result.psych;

              // 可視化指数の日本語ラベル
              const viLabels = {
                lonelinessTolerance:"孤独耐性", approvalNeed:"承認欲求",
                emotionSuppression:"感情抑制度", escapeTendency:"現実逃避傾向",
                socialDefense:"対人防御力", nocturnalSensitivity:"深夜感受性",
                idealDependency:"理想依存度",
              };
              const viColors = {
                lonelinessTolerance:"#8890a8", approvalNeed:"#c87ac8",
                emotionSuppression:"#7aaedd", escapeTendency:"#c8a060",
                socialDefense:"#78aa88", nocturnalSensitivity:"#a880cc",
                idealDependency:"#d09060",
              };

              return (
                <>
                  {/* ── A. 愛着スタイル ── */}
                  <div className="result-card-stagger glass-card" style={{
                    marginBottom:14,
                    background:"rgba(20,30,60,0.1)",
                    border:`1px solid ${attachment.color}28`,
                    borderLeft:`3px solid ${attachment.color}88`,
                  }}>
                    <div className="archive-bar" style={{ marginBottom:10 }}>
                      <div className="archive-dot" style={{ background:attachment.color }} />
                      <span className="archive-tag">ATTACHMENT STYLE</span>
                      <span className="archive-id" style={{ color:attachment.color }}>
                        {attachment.code}
                      </span>
                    </div>
                    <div style={{ display:"flex", alignItems:"baseline", gap:12, marginBottom:8 }}>
                      <span style={{ fontFamily:"var(--f-serif)", fontStyle:"italic",
                        fontSize:"clamp(20px,5vw,26px)", color:attachment.color, fontWeight:300 }}>
                        {attachment.style}
                      </span>
                    </div>
                    <p style={{ fontFamily:"var(--f-jp)", fontSize:13, color:"rgba(185,200,228,0.82)",
                      fontWeight:200, lineHeight:1.85, letterSpacing:"0.04em", margin:"0 0 10px" }}>
                      {ATTACHMENT_FALLBACK[attachment.code]}
                    </p>
                    {/* 回避/不安 2軸スコア */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                      {[
                        { label:"回避傾向", val:Math.round(attachment.score.avoidance*100), color:"#7aaedd" },
                        { label:"不安傾向", val:Math.round(attachment.score.anxiety*100),   color:"#c87ac8" },
                      ].map(({ label, val, color }) => (
                        <div key={label}>
                          <div style={{ display:"flex", justifyContent:"space-between",
                            fontFamily:"var(--f-mono)", fontSize:8,
                            color:"rgba(120,140,180,0.6)", letterSpacing:"0.12em", marginBottom:4 }}>
                            <span>{label}</span><span>{val}</span>
                          </div>
                          <div style={{ height:2, background:"rgba(255,255,255,0.04)", borderRadius:999, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${val}%`,
                              background:`linear-gradient(90deg,${color}44,${color}cc)`,
                              borderRadius:999, transition:"width 1s ease" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── B. 防衛機制 ── */}
                  <div className="result-card-stagger glass-card" style={{
                    marginBottom:14,
                    background:"rgba(60,20,20,0.06)",
                    border:"1px solid rgba(180,80,80,0.15)",
                  }}>
                    <div className="archive-bar" style={{ marginBottom:10 }}>
                      <div className="archive-dot" style={{ background:"#c06868" }} />
                      <span className="archive-tag">DEFENSE MECHANISMS</span>
                      <span className="archive-id">防衛機制パターン</span>
                    </div>
                    <p style={{ fontFamily:"var(--f-jp)", fontSize:11, color:"var(--c-muted)",
                      marginBottom:14, fontWeight:200, letterSpacing:"0.04em" }}>
                      ストレス時に無意識に使う心理的防衛
                    </p>
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      {tDef.map(({ key, label, score }, i) => {
                        const barColors = ["#c06868","#c08860","#c0a060"];
                        return (
                          <div key={key}>
                            <div style={{ display:"flex", justifyContent:"space-between",
                              alignItems:"baseline", marginBottom:4 }}>
                              <span style={{ fontFamily:"var(--f-jp)", fontSize:12,
                                color: i === 0 ? "rgba(200,160,160,0.92)" : "rgba(175,190,225,0.75)",
                                fontWeight: i === 0 ? 300 : 200 }}>
                                {i === 0 && "▶ "}{label}
                              </span>
                              <span style={{ fontFamily:"var(--f-mono)", fontSize:10,
                                color:barColors[i] ?? "#888", opacity:0.8 }}>{score}</span>
                            </div>
                            <div style={{ height:i===0?3:2, background:"rgba(255,255,255,0.04)",
                              borderRadius:999, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${score}%`,
                                background:`linear-gradient(90deg,${barColors[i] ?? "#888"}44,${barColors[i] ?? "#888"}cc)`,
                                borderRadius:999, transition:"width 1.1s ease" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── C. 認知傾向 ── */}
                  <div className="result-card-stagger glass-card" style={{
                    marginBottom:14,
                    background:"rgba(20,40,80,0.07)",
                    border:"1px solid rgba(60,100,200,0.15)",
                  }}>
                    <div className="archive-bar" style={{ marginBottom:10 }}>
                      <div className="archive-dot" style={{ background:"#6080c8" }} />
                      <span className="archive-tag">COGNITIVE TENDENCIES</span>
                      <span className="archive-id">認知の癖</span>
                    </div>
                    <p style={{ fontFamily:"var(--f-jp)", fontSize:11, color:"var(--c-muted)",
                      marginBottom:14, fontWeight:200, letterSpacing:"0.04em" }}>
                      思考・感情の自動パターン
                    </p>
                    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      {tCog.map(({ key, label, score }, i) => {
                        const barColors = ["#6080c8","#7080b8","#8090b0"];
                        return (
                          <div key={key}>
                            <div style={{ display:"flex", justifyContent:"space-between",
                              alignItems:"baseline", marginBottom:4 }}>
                              <span style={{ fontFamily:"var(--f-jp)", fontSize:12,
                                color: i === 0 ? "rgba(160,180,220,0.92)" : "rgba(155,170,210,0.75)",
                                fontWeight: i === 0 ? 300 : 200 }}>
                                {i === 0 && "▶ "}{label}
                              </span>
                              <span style={{ fontFamily:"var(--f-mono)", fontSize:10,
                                color:barColors[i], opacity:0.8 }}>{score}</span>
                            </div>
                            <div style={{ height:i===0?3:2, background:"rgba(255,255,255,0.04)",
                              borderRadius:999, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${score}%`,
                                background:`linear-gradient(90deg,${barColors[i]}44,${barColors[i]}cc)`,
                                borderRadius:999, transition:"width 1.1s ease" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── D. 7軸可視化指数（自己観測スペクトラム） ── */}
                  <div className="result-card-stagger glass-card" style={{ marginBottom:14 }}>
                    <div className="archive-bar" style={{ marginBottom:10 }}>
                      <div className="archive-dot" />
                      <span className="archive-tag">SELF OBSERVATION SPECTRUM</span>
                      <span className="archive-id">7軸指数</span>
                    </div>
                    <p style={{ fontFamily:"var(--f-jp)", fontSize:11, color:"var(--c-muted)",
                      marginBottom:16, fontWeight:200, letterSpacing:"0.04em" }}>
                      あなたの内部状態の断面図
                    </p>
                    <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
                      {Object.entries(vi).map(([key, val]) => (
                        <div key={key}>
                          <div style={{ display:"flex", justifyContent:"space-between",
                            alignItems:"baseline", marginBottom:4 }}>
                            <span style={{ fontFamily:"var(--f-jp)", fontSize:12,
                              color:"rgba(185,200,228,0.82)", fontWeight:200 }}>
                              {viLabels[key] ?? key}
                            </span>
                            <span style={{ fontFamily:"var(--f-mono)", fontSize:10,
                              color:viColors[key] ?? "#8888a8", opacity:0.75 }}>{val}</span>
                          </div>
                          <div style={{ height:2, background:"rgba(255,255,255,0.04)",
                            borderRadius:999, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${val}%`,
                              background:`linear-gradient(90deg,${viColors[key] ?? "#8888a8"}44,${viColors[key] ?? "#8888a8"}cc)`,
                              borderRadius:999, transition:"width 1.2s ease" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── E. 今日の精神状態（日替わり） ── */}
                  <div className="result-card-stagger glass-card" style={{
                    marginBottom:14,
                    background:"rgba(20,20,40,0.08)",
                    border:"1px solid rgba(80,80,160,0.18)",
                  }}>
                    <div className="archive-bar" style={{ marginBottom:10 }}>
                      <div className="archive-dot" style={{ background:"rgba(100,100,200,0.8)" }} />
                      <span className="archive-tag">TODAY'S STATE</span>
                      <span className="archive-id" style={{ color:"rgba(120,120,200,0.6)" }}>
                        {ds.date}（{ds.weekday}）
                      </span>
                    </div>
                    <p style={{ fontFamily:"var(--f-jp)", fontSize:11, color:"var(--c-muted)",
                      marginBottom:14, fontWeight:200, letterSpacing:"0.04em" }}>
                      今日の精神状態（毎日変化）
                    </p>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                      {[
                        { label:"精神ノイズ",    val:ds.mentalNoise,      color:"#c87ac8" },
                        { label:"深夜感情",      val:ds.nocturnalEmotion, color:"#8890c8" },
                        { label:"孤独波形",      val:ds.lonelyWave,       color:"#7aaedd" },
                        { label:"思考疲労",      val:ds.thoughtFatigue,   color:"#c8a060" },
                        { label:"社会適応モード",val:ds.socialMode,       color:"#78aa88" },
                      ].map(({ label, val, color }) => (
                        <div key={label}
                          style={{ padding:"10px 12px",
                            background:"rgba(255,255,255,0.015)",
                            border:"1px solid rgba(255,255,255,0.05)", borderRadius:10 }}>
                          <div style={{ fontFamily:"var(--f-mono)", fontSize:8,
                            color:"rgba(100,120,170,0.6)", letterSpacing:"0.12em", marginBottom:4 }}>
                            {label}
                          </div>
                          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
                            <span style={{ fontFamily:"var(--f-serif)", fontStyle:"italic",
                              fontSize:22, color, fontWeight:300 }}>{val}</span>
                            <span style={{ fontFamily:"var(--f-mono)", fontSize:7,
                              color:"rgba(100,115,155,0.45)" }}>/100</span>
                          </div>
                          <div style={{ height:2, background:"rgba(255,255,255,0.04)",
                            borderRadius:999, overflow:"hidden", marginTop:6 }}>
                            <div style={{ height:"100%", width:`${val}%`,
                              background:`linear-gradient(90deg,${color}44,${color}cc)`,
                              borderRadius:999, transition:"width 1.3s ease" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* 思想ラベルセクション（IDEOLOGICAL LABELS） */}
            {ideologicalLabels.length > 0 && (
              <div className="glass-card result-card-stagger"
                style={{ background:"rgba(35,50,100,0.07)", border:"1px solid rgba(70,100,170,0.18)", marginBottom:16 }}>
                {/* アーカイブヘッダー */}
                <div className="archive-bar">
                  <div className="archive-dot" />
                  <span className="archive-tag">IDEOLOGICAL LABELS</span>
                  <span className="archive-id">THOUGHT CATEGORY</span>
                </div>
                <p style={{ fontFamily:"var(--f-jp)", fontSize:12, color:"var(--c-muted)",
                  marginBottom:14, fontWeight:300, letterSpacing:"0.03em" }}>
                  思想ラベリング
                </p>
                <div className="thought-labels-wrap">
                  {ideologicalLabels.map((label, i) => (
                    <span
                      key={label}
                      className={`thought-label ${i % 2 === 1 ? "thought-label-alt" : ""}`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 深夜モード演出 + 本音率 */}
            {(isMidnight || honestyRate !== null) && (
              <div className="result-card-stagger" style={{ marginBottom:16, display:"flex", gap:10, flexWrap:"wrap" }}>
                {isMidnight && (
                  <div style={{
                    flex:1, minWidth:140, padding:"14px 18px",
                    background:"rgba(80,40,180,0.08)", border:"1px solid rgba(120,60,220,0.22)",
                    borderRadius:14, animation:"midnightPulse 4s ease-in-out infinite",
                  }}>
                    <div style={{ fontFamily:"var(--f-mono)", fontSize:8, color:"rgba(130,80,220,0.7)",
                      letterSpacing:"0.2em", marginBottom:6 }}>MIDNIGHT MODE</div>
                    <div style={{ fontFamily:"var(--f-jp)", fontSize:12, color:"rgba(180,150,255,0.85)",
                      fontWeight:300, lineHeight:1.7 }}>
                      深夜に開いたあなたへ。<br />今夜の診断は、少し正直だったかもしれない。
                    </div>
                  </div>
                )}
                {honestyRate !== null && (
                  <div style={{
                    flex:1, minWidth:140, padding:"14px 18px",
                    background:"rgba(40,80,140,0.08)", border:"1px solid rgba(70,120,200,0.2)",
                    borderRadius:14,
                  }}>
                    <div style={{ fontFamily:"var(--f-mono)", fontSize:8, color:"rgba(80,130,200,0.7)",
                      letterSpacing:"0.2em", marginBottom:6 }}>HONESTY RATE</div>
                    <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:6 }}>
                      <span style={{ fontFamily:"var(--f-serif)", fontStyle:"italic",
                        fontSize:32, color:result.typeColor, fontWeight:300 }}>
                        {honestyRate}%
                      </span>
                      <span style={{ fontFamily:"var(--f-mono)", fontSize:8,
                        color:"rgba(80,120,180,0.55)", letterSpacing:"0.1em" }}>本音率</span>
                    </div>
                    <div style={{ height:3, background:"rgba(255,255,255,0.05)", borderRadius:999, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${honestyRate}%`,
                        background:`linear-gradient(90deg, ${result.typeColor}88, ${result.typeColor})`,
                        borderRadius:999, transition:"width 1s ease" }} />
                    </div>
                    <div style={{ fontFamily:"var(--f-jp)", fontSize:11, color:"rgba(120,150,200,0.6)",
                      marginTop:6, fontWeight:200 }}>
                      {honestyRate >= 85 ? "かなり直感で答えていた" :
                       honestyRate >= 72 ? "本音に近い回答傾向" : "少し考えながら答えていた"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ② QUOTE カード — ⑦ガラス風浮遊演出に強化 */}
            {result.quote && (
              <div
                className="result-card-stagger quote-card-float"
                style={{
                  margin:"0 0 20px", padding:"36px 30px 30px",
                  background:"rgba(255,255,255,0.016)",
                  border:"1px solid rgba(255,255,255,0.08)",
                  borderLeft:`3px solid ${result.typeColor}66`,
                  borderRadius:"0 20px 20px 0",
                  position:"relative",
                  backdropFilter:"blur(16px)",
                  WebkitBackdropFilter:"blur(16px)",
                  boxShadow:`0 4px 30px rgba(0,0,0,0.25), inset 0 0 40px rgba(80,120,200,0.025)`,
                }}>
                {/* 上部光沢 */}
                <div style={{
                  position:"absolute", top:0, left:"5%", right:"5%", height:1,
                  background:`linear-gradient(90deg,transparent,${result.typeColor}44,transparent)`,
                }} />
                {/* QUOTEラベル */}
                <div style={{
                  position:"absolute", top:16, left:30,
                  fontFamily:"var(--f-mono)", fontSize:8,
                  letterSpacing:"0.28em", color:`${result.typeColor}88`,
                }}>QUOTE</div>
                {/* 引用記号（装飾） */}
                <div style={{
                  position:"absolute", top:22, right:24,
                  fontFamily:"var(--f-serif)", fontSize:36, lineHeight:1,
                  color:`${result.typeColor}18`, fontStyle:"italic",
                  userSelect:"none",
                }}>"</div>
                <p style={{
                  fontFamily:"var(--f-serif)", fontStyle:"italic", fontWeight:300,
                  fontSize:"clamp(17px,4vw,22px)", lineHeight:1.8,
                  color:"rgba(220,228,244,0.95)", marginTop:18,
                  letterSpacing:"0.025em",
                  textShadow:`0 0 30px ${result.typeColor}22`,
                }}>
                  「{result.quote}」
                </p>
              </div>
            )}

            {/* ③ 思想定義 — ⑦glass-card化 */}
            {result.definition && (
              <div
                className="glass-card result-card-stagger"
                style={{ background:"rgba(40,60,110,0.07)", border:"1px solid rgba(70,100,160,0.18)" }}>
                <SLabel>思想定義</SLabel>
                <p style={{
                  fontFamily:"var(--f-jp)", fontSize:"clamp(13px,3.2vw,15px)",
                  lineHeight:2.1, color:"rgba(198,212,232,0.88)", fontWeight:300,
                }}>
                  {result.definition}
                </p>
              </div>
            )}

            {/* ④ 内面的矛盾 + 孤独・距離 — ⑦glass-card化 */}
            <div className="result-card-stagger" style={{ marginBottom:16 }}>
              {result.contradiction && (
                <div className="glass-card" style={{
                  marginBottom:12,
                  background:"rgba(85,50,120,0.07)", border:"1px solid rgba(110,70,150,0.18)",
                }}>
                  <SLabel color="rgba(145,95,200,0.8)">内面的矛盾</SLabel>
                  <p style={{
                    fontFamily:"var(--f-jp)", fontSize:"clamp(12px,3vw,14px)",
                    lineHeight:2, color:"rgba(190,170,218,0.85)", fontWeight:300,
                  }}>
                    {result.contradiction}
                  </p>
                </div>
              )}
              <div className="grid-2col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {result.solitude && (
                  <div className="glass-card" style={{ marginBottom:0,
                    background:"rgba(35,72,95,0.07)", border:"1px solid rgba(55,102,135,0.18)",
                  }}>
                    <SLabel color="rgba(75,145,180,0.8)">孤独性</SLabel>
                    <p style={{
                      fontFamily:"var(--f-jp)", fontSize:"clamp(11px,2.8vw,13px)",
                      lineHeight:1.95, color:"rgba(158,192,215,0.82)", fontWeight:300,
                    }}>{result.solitude}</p>
                  </div>
                )}
                {result.distance && (
                  <div className="glass-card" style={{ marginBottom:0,
                    background:"rgba(50,72,44,0.07)", border:"1px solid rgba(72,104,64,0.18)",
                  }}>
                    <SLabel color="rgba(95,158,98,0.8)">社会との距離</SLabel>
                    <p style={{
                      fontFamily:"var(--f-jp)", fontSize:"clamp(11px,2.8vw,13px)",
                      lineHeight:1.95, color:"rgba(152,192,158,0.82)", fontWeight:300,
                    }}>{result.distance}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ⑤ 哲学者カード（強化版）— PHILOSOPHER MATCH */}
            <div className="glass-card result-card-stagger"
              style={{ background:"rgba(30,45,95,0.07)", border:"1px solid rgba(65,95,165,0.18)" }}>

              {/* アーカイブヘッダー */}
              <div className="archive-bar">
                <div className="archive-dot" />
                <span className="archive-tag">PHILOSOPHER MATCH</span>
                <span className="archive-id">EXISTENTIAL INDEX</span>
              </div>
              <p style={{ fontFamily:"var(--f-jp)", fontSize:12, color:"var(--c-muted)",
                marginBottom:16, fontWeight:300 }}>
                最も近い思想家
              </p>

              {/* プライマリ哲学者（メインカード） */}
              {result.philosophers[0] && (() => {
                const p = result.philosophers[0];
                return (
                  <div style={{
                    padding:"18px 18px 16px",
                    background:"rgba(60,90,160,0.09)",
                    border:`1px solid rgba(90,130,200,0.22)`,
                    borderRadius:14, marginBottom:4,
                    position:"relative", overflow:"hidden",
                  }}>
                    {/* 上部光沢 */}
                    <div style={{ position:"absolute", top:0, left:"8%", right:"8%", height:1,
                      background:`linear-gradient(90deg,transparent,${result.typeColor}33,transparent)` }} />

                    {/* 名前行 */}
                    <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:12 }}>
                      {/* 外部URL画像 or SVGフォールバック */}
                      <PhilAvatar
                        name={p.name}
                        initials={p.initials}
                        typeColor={result.typeColor}
                        image={p.image}
                        size={64}
                        isMain={true}
                      />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:"var(--f-jp)", color:"rgba(210,222,242,0.95)",
                          fontSize:"clamp(13px,3.5vw,16px)", fontWeight:300, marginBottom:3,
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {p.name}
                        </div>
                        <div style={{ fontFamily:"var(--f-mono)", color:"var(--c-dim)",
                          fontSize:9, letterSpacing:"0.1em", marginBottom:6 }}>
                          {p.nameEn}
                        </div>
                        {/* 思想系統ラベル */}
                        {p.school?.[0] && (
                          <span className="thought-label" style={{ fontSize:10, padding:"2px 10px" }}>
                            {p.school[0]}
                          </span>
                        )}
                      </div>
                      <span style={{ fontFamily:"var(--f-mono)", fontSize:9,
                        color:"rgba(108,152,215,0.65)", letterSpacing:"0.1em", flexShrink:0 }}>
                        PRIMARY
                      </span>
                    </div>

                    {/* メタ情報テーブル */}
                    <div className="phil-meta">
                      <span className="phil-meta-k">代表概念</span>
                      <span className="phil-meta-v">{p.concept}</span>
                      <span className="phil-meta-k">時代</span>
                      <span className="phil-meta-v">{p.era}</span>
                      <span className="phil-meta-k">難易度</span>
                      <span className="difficulty-stars">
                        {[1,2,3,4,5].map(n => (
                          <span key={n} className={n <= p.difficulty ? "star-on" : "star-off"}>★</span>
                        ))}
                      </span>
                    </div>

                    {/* 名言 */}
                    {p.quote && (
                      <div style={{ padding:"10px 14px", marginBottom:4,
                        background:"rgba(0,0,0,0.2)", border:"1px solid rgba(255,255,255,0.04)",
                        borderLeft:`2px solid ${result.typeColor}33`, borderRadius:"0 8px 8px 0" }}>
                        <p style={{ fontFamily:"var(--f-serif)", fontStyle:"italic", fontWeight:300,
                          fontSize:12, color:"rgba(172,190,225,0.82)", lineHeight:1.85 }}>
                          「{p.quote}」
                        </p>
                      </div>
                    )}

                    {/* Wikiボタン */}
                    <a href={p.wikipedia} target="_blank" rel="noopener noreferrer"
                      className="btn-wiki">
                      <span>Wikipedia で読む</span>
                      <span style={{ fontSize:11, opacity:0.7 }}>↗</span>
                    </a>
                  </div>
                );
              })()}

              {/* サブ哲学者グリッド（2〜3人目） */}
              <div className="phil-sub-grid">
                {result.philosophers.slice(1).map((p) => (
                  <div key={p.name} className="phil-sub-card">
                    {/* 外部URL画像 or SVGフォールバック */}
                    <PhilAvatar
                      name={p.name}
                      initials={p.initials}
                      typeColor={result.typeColor}
                      image={p.image}
                      size={44}
                    />
                    <div style={{ fontFamily:"var(--f-jp)", color:"rgba(195,210,235,0.9)",
                      fontSize:12, fontWeight:300, marginBottom:3,
                      wordBreak:"break-all" }}>
                      {p.name.replace("=","=")}
                    </div>
                    <div style={{ fontFamily:"var(--f-mono)", color:"var(--c-dim)",
                      fontSize:8, letterSpacing:"0.08em", marginBottom:8 }}>
                      {p.nameEn}
                    </div>
                    {/* 思想系統 */}
                    {p.school?.[0] && (
                      <span className="thought-label" style={{ fontSize:9, padding:"2px 9px", marginBottom:8, display:"inline-block" }}>
                        {p.school[0]}
                      </span>
                    )}
                    {/* Wikiリンク */}
                    <a href={p.wikipedia} target="_blank" rel="noopener noreferrer"
                      className="btn-wiki btn-wiki-sm" style={{ marginTop:8 }}>
                      Wikipedia ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>

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

            {/* ⑦ スコアバー — EXISTENTIAL INDEX */}
            <div className="result-card-stagger" style={{ marginBottom:16 }}>
              {/* アーカイブヘッダー */}
              <div className="glass-card" style={{
                background:"rgba(28,42,88,0.07)", border:"1px solid rgba(62,88,158,0.18)",
                marginBottom:0,
              }}>
                <div className="archive-bar">
                  <div className="archive-dot" />
                  <span className="archive-tag">EXISTENTIAL INDEX</span>
                  <span className="archive-id">ARCHIVE ENTRY</span>
                </div>
                <p style={{ fontFamily:"var(--f-jp)", fontSize:12, color:"var(--c-muted)",
                  marginBottom:18, fontWeight:300 }}>存在指標</p>

                {/* スコアバー一覧（2列グリッド） */}
                <div className="grid-2col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  <div>
                    <div style={{ fontFamily:"var(--f-mono)", fontSize:8, color:"var(--c-dim)",
                      letterSpacing:"0.18em", marginBottom:12 }}>VALUE AXES</div>
                    <ScoreBar label="自由志向"  value={result.traits.freedom}     color="#7aaedd" delay={0}   />
                    <ScoreBar label="孤独耐性"  value={result.traits.loneliness}  color="#6aaa9a" delay={80}  />
                    <ScoreBar label="虚無傾向"  value={result.traits.nihilism}    color="#8890a8" delay={160} />
                    <ScoreBar label="現実主義"  value={result.traits.realism}     color="#a09070" delay={240} />
                    <ScoreBar label="ロマン主義" value={result.traits.romanticism} color="#b07ac8" delay={320} />
                    <ScoreBar label="反社会性"  value={Math.round((100-result.traits.community)*0.8)} color="#9878b8" delay={400} />
                  </div>
                  <div>
                    <div style={{ fontFamily:"var(--f-mono)", fontSize:8, color:"var(--c-dim)",
                      letterSpacing:"0.18em", marginBottom:12 }}>COGNITIVE</div>
                    <ScoreBar label="論理型"    value={result.traits.logic}      color="#7aaedd" delay={40}  />
                    <ScoreBar label="感情型"    value={result.traits.emotion}    color="#e08870" delay={120} />
                    <ScoreBar label="理想主義"  value={result.traits.idealism}   color="#8b78cc" delay={200} />
                    <ScoreBar label="安定志向"  value={result.traits.stability}  color="#7ab888" delay={280} />
                    <ScoreBar label="共同体志向" value={result.traits.community}  color="#88a870" delay={360} />
                  </div>
                </div>
              </div>
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
