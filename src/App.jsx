import { useState, useEffect, useRef, useCallback } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";

// ─────────────────────────────────────────────
//  定数
// ─────────────────────────────────────────────
const DISCLAIMER =
  "この分析はAIによる傾向の推定であり、実際の思想・信条を断定するものではありません。エンターテイメント・自己探索のためのツールです。";

// 最初の固定質問セット（5問）
const SEED_QUESTIONS = [
  {
    id: "q1",
    text: "努力できるって、才能だと思う？",
    options: ["思う", "思わない", "どちらともいえない", "才能より環境だと思う"],
  },
  {
    id: "q2",
    text: "一生同じ街に住み続けられる？",
    options: ["住める、安心する", "無理、息が詰まる", "街より人間関係による", "まだわからない"],
  },
  {
    id: "q3",
    text: "孤独は必要だと思う？",
    options: ["絶対必要", "たまに必要", "あまり必要ない", "孤独が怖い"],
  },
  {
    id: "q4",
    text: "自由と安心、どっちを選ぶ？",
    options: ["自由", "安心", "どちらも諦めない", "どちらもいらない"],
  },
  {
    id: "q5",
    text: "誰にも理解されなくても、自分の信念は貫く？",
    options: ["貫く", "状況による", "理解されないなら変える", "信念が持てない"],
  },
];

// 哲学者マッピング
const PHILOSOPHER_MAP = [
  { name: "ニーチェ", desc: "力への意志、永劫回帰", keys: ["自由", "個人主義", "虚無耐性"], emoji: "⚡" },
  { name: "カミュ", desc: "不条理の中の反抗", keys: ["虚無", "孤独", "現実主義"], emoji: "🚬" },
  { name: "アーレント", desc: "公共性と思考の深淵", keys: ["共同体", "論理", "社会"], emoji: "🌍" },
  { name: "サルトル", desc: "実存は本質に先立つ", keys: ["自由", "孤独", "理想主義"], emoji: "📖" },
  { name: "ウィトゲンシュタイン", desc: "語りえないものについて沈黙", keys: ["論理", "内省", "抽象"], emoji: "🔇" },
  { name: "ボードリヤール", desc: "シミュラクルの世界", keys: ["虚無", "現代", "批判"], emoji: "📺" },
];

// 結果タイトルの候補（スコアに応じて後で選択）
const RESULT_TITLES = [
  { title: "静かな観測者", cond: (s) => s.loneliness > 65 && s.logic > 60 },
  { title: "夜明け前の理想主義者", cond: (s) => s.idealism > 70 && s.freedom > 60 },
  { title: "孤独に慣れたロマン主義", cond: (s) => s.loneliness > 60 && s.romanticism > 60 },
  { title: "やさしいニヒリスト", cond: (s) => s.nihilism > 55 && s.emotion > 50 },
  { title: "不条理を笑う現実主義者", cond: (s) => s.realism > 65 && s.nihilism > 45 },
  { title: "深夜の自由論者", cond: (s) => s.freedom > 70 },
  { title: "静かな共同体主義者", cond: (s) => s.community > 65 && s.loneliness < 50 },
  { title: "問い続ける懐疑論者", cond: (_) => true }, // fallback
];

// ─────────────────────────────────────────────
//  ユーティリティ
// ─────────────────────────────────────────────
function pickTitle(scores) {
  for (const t of RESULT_TITLES) {
    if (t.cond(scores)) return t.title;
  }
  return "問い続ける懐疑論者";
}

function pickPhilosopher(scores) {
  // スコアに基づいてトップ2を返す（簡易スコアリング）
  const map = [
    { ...PHILOSOPHER_MAP[0], score: scores.freedom * 0.4 + scores.nihilism * 0.3 + (100 - scores.community) * 0.3 },
    { ...PHILOSOPHER_MAP[1], score: scores.nihilism * 0.4 + scores.loneliness * 0.3 + scores.realism * 0.3 },
    { ...PHILOSOPHER_MAP[2], score: scores.community * 0.4 + scores.logic * 0.3 + (100 - scores.freedom) * 0.3 },
    { ...PHILOSOPHER_MAP[3], score: scores.freedom * 0.3 + scores.idealism * 0.4 + scores.loneliness * 0.3 },
    { ...PHILOSOPHER_MAP[4], score: scores.logic * 0.5 + (100 - scores.emotion) * 0.3 + scores.loneliness * 0.2 },
    { ...PHILOSOPHER_MAP[5], score: scores.nihilism * 0.4 + (100 - scores.idealism) * 0.3 + scores.realism * 0.3 },
  ];
  return map.sort((a, b) => b.score - a.score).slice(0, 2);
}

// ─────────────────────────────────────────────
//  サブコンポーネント
// ─────────────────────────────────────────────

/** グローオーブ背景 */
function GlowOrb({ style }) {
  return (
    <div
      style={{
        position: "absolute", borderRadius: "50%",
        filter: "blur(90px)", opacity: 0.09, pointerEvents: "none",
        ...style,
      }}
    />
  );
}

/** 進捗バー */
function ProgressBar({ current, total }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={S.mono}>Q {current} / {total}</span>
        <span style={S.mono}>{pct}%</span>
      </div>
      <div style={{ height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: "linear-gradient(90deg, #4a7aaa, #7b68c8)",
          borderRadius: 2, transition: "width 0.5s ease",
        }} />
      </div>
    </div>
  );
}

/** 選択肢ボタン */
function OptionButton({ text, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left",
        padding: "13px 18px", marginBottom: 10,
        background: selected ? "rgba(80,120,180,0.2)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${selected ? "rgba(100,150,210,0.5)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 12, color: selected ? "rgba(180,210,240,0.95)" : "rgba(190,200,215,0.75)",
        fontSize: 14, cursor: "pointer", fontFamily: "'Georgia', 'Noto Serif JP', serif",
        lineHeight: 1.5, transition: "all 0.18s ease",
        letterSpacing: "0.01em",
      }}
    >
      {text}
    </button>
  );
}

/** スコアバー */
function ScoreBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ ...S.mono, fontSize: 11 }}>{label}</span>
        <span style={{ ...S.mono, fontSize: 11, color }}>{value}</span>
      </div>
      <div style={{ height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
        <div style={{
          height: "100%", width: `${value}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 2, transition: "width 1.2s cubic-bezier(0.34,1.56,0.64,1)",
          boxShadow: `0 0 6px ${color}55`,
        }} />
      </div>
    </div>
  );
}

/** 思想マップ（座標） */
function ThoughtMap({ scores }) {
  // X: 自由(右) ↔ 安定(左)、Y: 理想(上) ↔ 現実(下)
  const dotX = 15 + (scores.freedom / 100) * 70;
  const dotY = 15 + ((100 - scores.idealism) / 100) * 70;
  return (
    <div style={{ position: "relative", width: "100%", paddingBottom: "100%", maxWidth: 260, margin: "0 auto" }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.05)" }} />
        {[
          { text: "理想", pos: { top: 7, left: "50%", transform: "translateX(-50%)" } },
          { text: "現実", pos: { bottom: 7, left: "50%", transform: "translateX(-50%)" } },
          { text: "安定", pos: { left: 7, top: "50%", transform: "translateY(-50%)" } },
          { text: "自由", pos: { right: 7, top: "50%", transform: "translateY(-50%)" } },
        ].map(({ text, pos }) => (
          <div key={text} style={{ position: "absolute", color: "rgba(120,130,155,0.55)", fontSize: 9, fontFamily: "monospace", ...pos }}>
            {text}
          </div>
        ))}
        {/* ぼかしドット（他ユーザー風） */}
        {[[35, 60], [60, 30], [70, 70], [25, 40], [55, 55]].map(([x, y], i) => (
          <div key={i} style={{
            position: "absolute", left: `${x}%`, top: `${y}%`,
            width: 5, height: 5, borderRadius: "50%",
            transform: "translate(-50%,-50%)",
            background: "rgba(120,130,160,0.2)", border: "1px solid rgba(120,130,160,0.12)",
          }} />
        ))}
        {/* 自分のドット */}
        <div style={{
          position: "absolute", left: `${dotX}%`, top: `${dotY}%`,
          width: 14, height: 14, borderRadius: "50%",
          transform: "translate(-50%,-50%)",
          background: "radial-gradient(circle, #7ba8d4, #4a7aaa)",
          boxShadow: "0 0 18px rgba(100,160,210,0.7), 0 0 36px rgba(100,160,210,0.3)",
          animation: "pulseDot 2.4s ease-in-out infinite",
        }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  定数スタイル
// ─────────────────────────────────────────────
const S = {
  mono: { fontFamily: "monospace", fontSize: 11, color: "rgba(110,125,155,0.7)", letterSpacing: "0.12em" },
  card: {
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 18, padding: 22,
    backdropFilter: "blur(10px)",
    marginBottom: 18,
  },
  sectionLabel: {
    fontFamily: "monospace", fontSize: 10,
    color: "rgba(90,130,180,0.8)", letterSpacing: "0.2em",
    textTransform: "uppercase", marginBottom: 14,
    display: "flex", alignItems: "center", gap: 6,
  },
  fadeUp: { animation: "fadeUp 0.5s ease forwards", opacity: 0 },
};

// ─────────────────────────────────────────────
//  メインコンポーネント
// ─────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState("home");      // home | quiz | thinking | result
  const [qIndex, setQIndex] = useState(0);          // 現在の質問番号
  const [questions, setQuestions] = useState(SEED_QUESTIONS); // 質問リスト（AI分岐で追加）
  const [answers, setAnswers] = useState([]);       // { question, answer }[]
  const [selected, setSelected] = useState(null);   // 現在選択中の選択肢
  const [aiFollowUp, setAiFollowUp] = useState(null); // AIからの分岐コメント
  const [loadingFollowUp, setLoadingFollowUp] = useState(false);
  const [result, setResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const containerRef = useRef(null);

  const totalQ = questions.length;
  const currentQ = questions[qIndex];
  const isLast = qIndex >= totalQ - 1;

  // スクロールトップ
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [qIndex, phase]);

  // 選択肢タップ時 → AIに分岐コメント＋次の質問を生成させる
  const handleSelect = useCallback(async (opt) => {
    setSelected(opt);
    setAiFollowUp(null);

    // 最後の質問でなければ、AIに分岐コメントを取得
    if (!isLast) {
      setLoadingFollowUp(true);
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            system: `あなたは静かで少し文学的なAIです。ユーザーの選択に、短く自然に反応します。
ルール:
- 1〜2文。30字以内が理想。
- 評価・説教しない。断定しない。
- 少し詩的に、でも自然に。
- 深夜ラジオのDJのような温度感。
必ずJSONのみ返す: {"comment": "...", "nextQuestion": "...", "options": ["...", "...", "...", "..."]}
nextQuestionは価値観が出る短い問い（20字以内）。optionsは4択。`,
            messages: [{
              role: "user",
              content: `質問:「${currentQ.text}」に「${opt}」と答えました。これまでの回答: ${JSON.stringify(answers.slice(-3).map(a => a.answer))}`,
            }],
          }),
        });
        const data = await res.json();
        const raw = data.content?.[0]?.text || "{}";
        const clean = raw.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        setAiFollowUp(parsed.comment || null);
        // 残り質問が2問以下なら動的に追加
        if (qIndex >= totalQ - 2 && parsed.nextQuestion) {
          setQuestions(prev => [...prev, {
            id: `ai_${Date.now()}`,
            text: parsed.nextQuestion,
            options: parsed.options || ["そう思う", "少しそう", "あまり思わない", "全く違う"],
          }]);
        }
      } catch {
        // フォールバック：コメントなし
      }
      setLoadingFollowUp(false);
    }
  }, [currentQ, qIndex, totalQ, isLast, answers]);

  // 「次へ」ボタン
  const handleNext = useCallback(() => {
    if (!selected) return;
    const newAnswers = [...answers, { question: currentQ.text, answer: selected }];
    setAnswers(newAnswers);
    setSelected(null);
    setAiFollowUp(null);

    if (isLast) {
      analyzeAll(newAnswers);
    } else {
      setQIndex(i => i + 1);
    }
  }, [selected, currentQ, answers, isLast]);

  // 全回答からAI分析
  const analyzeAll = useCallback(async (allAnswers) => {
    setPhase("thinking");
    setAnalyzing(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `あなたは思想傾向分析AIです。ユーザーの選択式回答から価値観スコアを算出します。
以下のJSONのみを返してください（他テキスト不要）:
{
  "freedom": 0-100,
  "stability": 0-100,
  "idealism": 0-100,
  "realism": 0-100,
  "logic": 0-100,
  "emotion": 0-100,
  "loneliness": 0-100,
  "nihilism": 0-100,
  "romanticism": 0-100,
  "community": 0-100,
  "comment": "120字以内。断定せず傾向として。少し文学的に。",
  "keywords": ["3〜4語のキーワード"]
}
断定しない。「〜傾向があります」「〜かもしれません」と表現すること。`,
          messages: [{
            role: "user",
            content: `回答一覧:\n${allAnswers.map((a, i) => `Q${i + 1}: ${a.question} → ${a.answer}`).join("\n")}`,
          }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "{}";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
      setPhase("result");
    } catch {
      setResult({
        freedom: 60, stability: 40, idealism: 65, realism: 50,
        logic: 55, emotion: 60, loneliness: 70, nihilism: 45,
        romanticism: 60, community: 40,
        comment: "あなたの価値観は、静かな複雑さを持っているようです。",
        keywords: ["思索", "孤独", "自由"],
      });
      setPhase("result");
    }
    setAnalyzing(false);
  }, []);

  const restart = () => {
    setPhase("home"); setQIndex(0); setQuestions(SEED_QUESTIONS);
    setAnswers([]); setSelected(null); setAiFollowUp(null); setResult(null);
  };

  // ─── レーダーデータ ───
  const radarData = result ? [
    { axis: "自由", value: result.freedom },
    { axis: "理想", value: result.idealism },
    { axis: "感情", value: result.emotion },
    { axis: "ロマン", value: result.romanticism },
    { axis: "孤独耐性", value: result.loneliness },
    { axis: "論理", value: result.logic },
  ] : [];

  const resultTitle = result ? pickTitle(result) : "";
  const philosophers = result ? pickPhilosopher(result) : [];

  // ─────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "#0a0c12",
      color: "rgba(210,215,228,0.92)",
      fontFamily: "'Georgia', 'Noto Serif JP', serif",
      position: "relative", overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Noto+Serif+JP:wght@300;400&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(100,120,160,0.2); border-radius: 2px; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulseDot {
          0%,100% { box-shadow: 0 0 18px rgba(100,160,210,0.7), 0 0 36px rgba(100,160,210,0.3); }
          50%     { box-shadow: 0 0 28px rgba(100,160,210,1),   0 0 55px rgba(100,160,210,0.5); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:0.3} 50%{opacity:1} }
        button { transition: all 0.18s ease; }
        button:hover { opacity: 0.82; }
      `}</style>

      {/* 背景グロー */}
      <GlowOrb style={{ width: 500, height: 500, top: -150, right: -100, background: "#3a5f9a" }} />
      <GlowOrb style={{ width: 400, height: 400, bottom: -120, left: -80, background: "#5a3f8a" }} />
      <GlowOrb style={{ width: 250, height: 250, top: "45%", left: "35%", background: "#2a6a7a" }} />

      <div ref={containerRef} style={{ maxWidth: 600, margin: "0 auto", padding: "0 20px 80px", overflowY: "auto", maxHeight: "100vh" }}>

        {/* ══ HOME ══ */}
        {phase === "home" && (
          <div style={{ ...S.fadeUp, textAlign: "center", paddingTop: 70, paddingBottom: 40 }}>
            <div style={{ ...S.mono, marginBottom: 20 }}>AI THOUGHT ANALYZER · v3.0</div>
            <h1 style={{
              fontSize: "clamp(34px, 7vw, 58px)", fontFamily: "'EB Garamond', serif",
              fontStyle: "italic", fontWeight: 400, letterSpacing: "-0.01em",
              lineHeight: 1.2, marginBottom: 18,
              background: "linear-gradient(135deg, rgba(210,218,235,0.95) 0%, rgba(130,160,210,0.9) 55%, rgba(150,120,200,0.9) 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              AI 思想チェッカー
            </h1>
            <p style={{ color: "rgba(140,155,180,0.8)", fontSize: 14, lineHeight: 1.9, maxWidth: 400, margin: "0 auto 40px", fontFamily: "'Noto Serif JP', serif" }}>
              いくつかの選択肢に答えるだけ。<br />
              あなたの価値観の輪郭を、AIが静かに可視化します。
            </p>

            <div style={{ ...S.card, textAlign: "left", marginBottom: 28 }}>
              <div style={S.sectionLabel}><span>◈</span> 診断について</div>
              {[
                "選択式 · 5〜8問 · 約3分",
                "AIが回答に応じて質問を分岐",
                "思想マップ・哲学者傾向を可視化",
                "断定しない · 傾向として提示",
              ].map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "rgba(90,130,180,0.7)", fontSize: 12, marginTop: 2 }}>—</span>
                  <span style={{ color: "rgba(170,180,200,0.75)", fontSize: 13 }}>{t}</span>
                </div>
              ))}
            </div>

            <button onClick={() => setPhase("quiz")} style={{
              padding: "16px 48px",
              background: "rgba(55,85,135,0.25)",
              border: "1px solid rgba(90,130,190,0.35)",
              borderRadius: 14, color: "rgba(170,200,235,0.9)",
              fontSize: 15, cursor: "pointer",
              fontFamily: "'EB Garamond', serif", fontStyle: "italic",
              letterSpacing: "0.08em",
              boxShadow: "0 0 30px rgba(70,110,180,0.15)",
            }}>
              診断をはじめる
            </button>
          </div>
        )}

        {/* ══ QUIZ ══ */}
        {phase === "quiz" && currentQ && (
          <div style={{ paddingTop: 48 }}>
            <ProgressBar current={qIndex + 1} total={totalQ} />

            {/* 質問 */}
            <div style={{ ...S.card, marginBottom: 20, ...S.fadeUp }}>
              <div style={S.sectionLabel}><span>◈</span> 問い {qIndex + 1}</div>
              <p style={{
                fontSize: "clamp(16px,4vw,20px)",
                fontFamily: "'EB Garamond', serif", fontStyle: "italic",
                lineHeight: 1.65, color: "rgba(210,220,235,0.95)",
                letterSpacing: "0.02em",
              }}>
                {currentQ.text}
              </p>
            </div>

            {/* 選択肢 */}
            <div style={{ marginBottom: 16 }}>
              {currentQ.options.map((opt) => (
                <OptionButton key={opt} text={opt} selected={selected === opt} onClick={() => handleSelect(opt)} />
              ))}
            </div>

            {/* AIフォローアップコメント */}
            <div style={{ minHeight: 40, marginBottom: 18 }}>
              {loadingFollowUp && (
                <div style={{ display: "flex", gap: 5, padding: "8px 12px", alignItems: "center" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: "rgba(100,150,200,0.5)",
                      animation: `blink 1.2s ease ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              )}
              {aiFollowUp && !loadingFollowUp && (
                <div style={{
                  padding: "10px 16px",
                  background: "rgba(60,90,140,0.1)",
                  border: "1px solid rgba(80,120,180,0.15)",
                  borderRadius: 10,
                  fontSize: 13, color: "rgba(150,175,210,0.8)",
                  fontStyle: "italic", lineHeight: 1.7,
                  animation: "fadeUp 0.4s ease forwards",
                }}>
                  {aiFollowUp}
                </div>
              )}
            </div>

            {/* 次へボタン */}
            <div style={{ textAlign: "right" }}>
              <button
                onClick={handleNext}
                disabled={!selected || loadingFollowUp}
                style={{
                  padding: "12px 32px",
                  background: selected ? "rgba(60,95,150,0.25)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${selected ? "rgba(90,135,200,0.35)" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: 12,
                  color: selected ? "rgba(160,200,235,0.9)" : "rgba(120,130,150,0.4)",
                  fontSize: 14, cursor: selected ? "pointer" : "not-allowed",
                  fontFamily: "'EB Garamond', serif", fontStyle: "italic",
                  letterSpacing: "0.08em",
                }}
              >
                {isLast ? "分析する →" : "次へ →"}
              </button>
            </div>
          </div>
        )}

        {/* ══ THINKING ══ */}
        {phase === "thinking" && (
          <div style={{ textAlign: "center", paddingTop: 120, ...S.fadeUp }}>
            <div style={{
              width: 44, height: 44,
              border: "2px solid rgba(100,150,200,0.2)",
              borderTopColor: "rgba(100,160,210,0.8)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 28px",
            }} />
            <p style={{ color: "rgba(130,150,180,0.7)", fontSize: 14, fontStyle: "italic", lineHeight: 2 }}>
              分析しています...<br />
              <span style={{ fontSize: 12, color: "rgba(100,120,150,0.5)" }}>あなたの回答を静かに読んでいます</span>
            </p>
          </div>
        )}

        {/* ══ RESULT ══ */}
        {phase === "result" && result && (
          <div style={{ paddingTop: 48, ...S.fadeUp }}>

            {/* ヘッダー */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={S.mono}>ANALYSIS COMPLETE</div>
              <h2 style={{
                fontSize: "clamp(22px,5vw,34px)",
                fontFamily: "'EB Garamond', serif", fontStyle: "italic",
                color: "rgba(200,215,235,0.95)", marginTop: 10, marginBottom: 8,
                letterSpacing: "0.02em",
              }}>
                {resultTitle}
              </h2>
              {result.keywords && (
                <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 10 }}>
                  {result.keywords.map(k => (
                    <span key={k} style={{
                      padding: "3px 11px",
                      background: "rgba(70,110,170,0.15)",
                      border: "1px solid rgba(90,130,190,0.25)",
                      borderRadius: 999, color: "rgba(130,170,215,0.85)",
                      fontSize: 11, fontFamily: "monospace",
                    }}>#{k}</span>
                  ))}
                </div>
              )}
            </div>

            {/* AIコメント */}
            <div style={{ ...S.card, border: "1px solid rgba(80,120,180,0.2)", background: "rgba(60,90,150,0.07)", marginBottom: 18 }}>
              <div style={S.sectionLabel}><span>◈</span> AI 分析コメント</div>
              <p style={{ color: "rgba(190,205,225,0.88)", fontSize: 14, lineHeight: 1.95, fontStyle: "italic" }}>
                {result.comment}
              </p>
            </div>

            {/* レーダー + マップ */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
              <div style={S.card}>
                <div style={S.sectionLabel}><span>◈</span> 思想レーダー</div>
                <ResponsiveContainer width="100%" height={180}>
                  <RadarChart data={radarData} margin={{ top: 10, right: 18, bottom: 10, left: 18 }}>
                    <PolarGrid stroke="rgba(255,255,255,0.05)" />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: "rgba(110,130,165,0.75)", fontSize: 9, fontFamily: "monospace" }} />
                    <Radar dataKey="value" stroke="rgba(90,140,200,0.7)" fill="rgba(80,130,190,0.2)" strokeWidth={1.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div style={S.card}>
                <div style={S.sectionLabel}><span>◈</span> 思想座標</div>
                <ThoughtMap scores={result} />
                <div style={{ textAlign: "center", marginTop: 8, fontSize: 9, color: "rgba(100,115,140,0.5)", fontFamily: "monospace" }}>
                  ● あなた　· 他ユーザー
                </div>
              </div>
            </div>

            {/* スコアバー */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
              <div style={S.card}>
                <div style={S.sectionLabel}><span>◈</span> 価値観軸</div>
                <ScoreBar label="自由志向" value={result.freedom} color="#7aaedd" />
                <ScoreBar label="理想主義" value={result.idealism} color="#8b78cc" />
                <ScoreBar label="ロマン主義" value={result.romanticism} color="#b07ac8" />
                <ScoreBar label="孤独耐性" value={result.loneliness} color="#6aaa9a" />
              </div>
              <div style={S.card}>
                <div style={S.sectionLabel}><span>◈</span> 思考スタイル</div>
                <ScoreBar label="論理型" value={result.logic} color="#7aaedd" />
                <ScoreBar label="感情型" value={result.emotion} color="#e08870" />
                <ScoreBar label="ニヒリズム" value={result.nihilism} color="#8890a8" />
                <ScoreBar label="共同体志向" value={result.community} color="#7ab888" />
              </div>
            </div>

            {/* 哲学者傾向 */}
            <div style={S.card}>
              <div style={S.sectionLabel}><span>◈</span> 哲学者傾向</div>
              <p style={{ color: "rgba(110,125,150,0.65)", fontSize: 11, fontFamily: "monospace", marginBottom: 14 }}>
                文章傾向に共通点が見られる思想家（断定ではありません）
              </p>
              {philosophers.map((p, i) => (
                <div key={p.name} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 14px", marginBottom: 8,
                  background: i === 0 ? "rgba(70,110,170,0.1)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${i === 0 ? "rgba(90,130,190,0.25)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 12,
                }}>
                  <span style={{ fontSize: 20 }}>{p.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "rgba(200,210,228,0.9)", fontSize: 13, marginBottom: 2 }}>{p.name}</div>
                    <div style={{ color: "rgba(110,125,155,0.65)", fontSize: 11, fontFamily: "monospace" }}>{p.desc}</div>
                  </div>
                  {i === 0 && (
                    <div style={{ fontSize: 11, color: "rgba(120,160,210,0.75)", fontFamily: "monospace" }}>
                      主な傾向
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 回答履歴 */}
            <div style={S.card}>
              <div style={S.sectionLabel}><span>◈</span> あなたの回答</div>
              {answers.map((a, i) => (
                <div key={i} style={{
                  display: "flex", gap: 10, paddingBottom: 10, marginBottom: 10,
                  borderBottom: i < answers.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <span style={{ ...S.mono, minWidth: 24, marginTop: 1 }}>Q{i + 1}</span>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(120,135,160,0.65)", marginBottom: 3, fontFamily: "monospace" }}>{a.question}</div>
                    <div style={{ fontSize: 13, color: "rgba(180,195,215,0.85)" }}>{a.answer}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* リスタート */}
            <div style={{ textAlign: "center", marginTop: 28 }}>
              <button onClick={restart} style={{
                padding: "13px 36px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 12, color: "rgba(130,145,170,0.65)",
                fontSize: 13, cursor: "pointer",
                fontFamily: "'EB Garamond', serif", fontStyle: "italic",
                letterSpacing: "0.06em",
              }}>
                もう一度診断する
              </button>
            </div>

            {/* 免責 */}
            <div style={{
              marginTop: 36, padding: "14px 18px",
              background: "rgba(200,160,60,0.04)", border: "1px solid rgba(200,160,60,0.12)",
              borderRadius: 12, textAlign: "center",
            }}>
              <p style={{ color: "rgba(150,135,100,0.65)", fontSize: 11, lineHeight: 1.7 }}>
                ⚠ {DISCLAIMER}
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}