import { useState, useRef, useCallback } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";

const SAMPLE_TEXTS = [
  "個人の自由こそが社会の根幹であり、国家は最小限の役割にとどまるべきだと考える。人は自らの選択に責任を持ち、他者の自由を侵害しない限り、何をしてもよいはずだ。",
  "社会は個人の集合体ではなく、共同体としての連帯が人を人たらしめる。伝統や秩序には先人の知恵が凝縮されており、急激な変革よりも漸進的な改善が望ましい。",
  "既存の権力構造は常に問い直されるべきだ。言語や制度そのものが権力関係を再生産している。真の解放とは、その構造への批判的意識から始まる。",
  "最大多数の最大幸福こそが倫理の基準だ。感情的な判断より合理的な計算を重視し、結果によって行為の正しさを評価すべきである。",
];

const PHILOSOPHERS = [
  { name: "ジョン・スチュアート・ミル", era: "19c", trait: "liberalism", emoji: "⚖️" },
  { name: "フリードリヒ・ニーチェ", era: "19c", trait: "individualism", emoji: "⚡" },
  { name: "ジャン＝ジャック・ルソー", era: "18c", trait: "collectivism", emoji: "🌿" },
  { name: "ミシェル・フーコー", era: "20c", trait: "liberalism", emoji: "🔍" },
  { name: "エドモンド・バーク", era: "18c", trait: "authoritarianism", emoji: "🏛️" },
  { name: "ジェレミー・ベンサム", era: "18c", trait: "rationality", emoji: "📊" },
  { name: "ハンナ・アーレント", era: "20c", trait: "collectivism", emoji: "🌍" },
  { name: "カール・マルクス", era: "19c", trait: "collectivism", emoji: "✊" },
];

const DISCLAIMER = "この分析はAIによる文章傾向の推定であり、実際の思想・信条を断定するものではありません。エンターテイメント・学習目的のツールです。";

function GlowOrb({ style }) {
  return (
    <div style={{
      position: "absolute",
      borderRadius: "50%",
      filter: "blur(80px)",
      opacity: 0.12,
      pointerEvents: "none",
      ...style,
    }} />
  );
}

function ScoreBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ color: "#9ca3af", fontSize: 13, fontFamily: "'DM Mono', monospace" }}>{label}</span>
        <span style={{ color, fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{value}</span>
      </div>
      <div style={{ height: 4, background: "#1e293b", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${value}%`,
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: 4,
          transition: "width 1.2s cubic-bezier(0.34,1.56,0.64,1)",
          boxShadow: `0 0 8px ${color}66`,
        }} />
      </div>
    </div>
  );
}

function PhilosopherMatch({ result }) {
  if (!result) return null;
  const scores = {
    liberalism: result.liberalism,
    individualism: result.individualism,
    collectivism: result.collectivism,
    authoritarianism: result.authoritarianism,
    rationality: result.rationality,
  };
  const matches = PHILOSOPHERS.map(p => {
    const key = p.trait;
    const score = scores[key] || 50;
    const similarity = Math.round((score / 100) * 40 + Math.random() * 20 + 30);
    return { ...p, similarity: Math.min(similarity, 82) };
  }).sort((a, b) => b.similarity - a.similarity).slice(0, 3);

  return (
    <div style={{ marginTop: 8 }}>
      {matches.map((p, i) => (
        <div key={p.name} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 14px", marginBottom: 8,
          background: i === 0 ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${i === 0 ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`,
          borderRadius: 10,
        }}>
          <span style={{ fontSize: 22 }}>{p.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{p.name}</div>
            <div style={{ color: "#64748b", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{p.era}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: i === 0 ? "#818cf8" : "#475569", fontSize: 12, fontWeight: 700 }}>
              共通傾向 {p.similarity}%
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ThoughtMap({ result }) {
  if (!result) return null;
  const x = ((result.liberalism - result.authoritarianism) / 100) * 50;
  const y = ((result.collectivism - result.individualism) / 100) * 50;
  const dotX = 50 + x;
  const dotY = 50 + y;

  return (
    <div style={{ position: "relative", width: "100%", paddingBottom: "100%", maxWidth: 320, margin: "0 auto" }}>
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(0,0,0,0.4)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, overflow: "hidden",
      }}>
        {/* Grid lines */}
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.06)" }} />
        {/* Quadrant colors */}
        <div style={{ position: "absolute", top: 0, right: 0, width: "50%", height: "50%", background: "rgba(99,102,241,0.04)" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, width: "50%", height: "50%", background: "rgba(16,185,129,0.04)" }} />
        {/* Labels */}
        <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", color: "#64748b", fontSize: 10, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>集団主義</div>
        <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", color: "#64748b", fontSize: 10, fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>個人主義</div>
        <div style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>統制</div>
        <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>自由</div>
        {/* Dot */}
        <div style={{
          position: "absolute",
          left: `${dotX}%`, top: `${dotY}%`,
          transform: "translate(-50%, -50%)",
          width: 16, height: 16,
          borderRadius: "50%",
          background: "radial-gradient(circle, #818cf8, #6366f1)",
          boxShadow: "0 0 20px rgba(99,102,241,0.8), 0 0 40px rgba(99,102,241,0.4)",
          animation: "pulse-dot 2s ease-in-out infinite",
        }} />
        <style>{`
          @keyframes pulse-dot {
            0%, 100% { box-shadow: 0 0 20px rgba(99,102,241,0.8), 0 0 40px rgba(99,102,241,0.4); }
            50% { box-shadow: 0 0 30px rgba(99,102,241,1), 0 0 60px rgba(99,102,241,0.6); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default function App() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [phase, setPhase] = useState("home"); // home | result

  const analyze = useCallback(async () => {
    if (!text.trim() || text.length < 30) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `あなたは文章傾向分析AIです。ユーザーの文章を学術的・中立的に分析し、思想・価値観・哲学的傾向をスコア化します。
以下のJSONのみを返してください（他のテキスト不要）:
{
  "individualism": 0-100の整数,
  "collectivism": 0-100の整数,
  "liberalism": 0-100の整数,
  "authoritarianism": 0-100の整数,
  "rationality": 0-100の整数,
  "emotionality": 0-100の整数,
  "abstractness": 0-100の整数,
  "sociality": 0-100の整数,
  "conservatism": 0-100の整数,
  "progressivism": 0-100の整数,
  "utilitarianism": 0-100の整数,
  "deontology": 0-100の整数,
  "comment": "150字以内の分析コメント（断定せず傾向として述べる）",
  "keywords": ["特徴的なキーワード3-5語"]
}
注意: 危険思想の推奨・差別の肯定はしない。あくまで文章傾向の推定として記述。`,
          messages: [{ role: "user", content: `次の文章を分析してください:\n\n${text}` }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
      setPhase("result");
    } catch (e) {
      setError("分析に失敗しました。もう一度お試しください。");
    } finally {
      setLoading(false);
    }
  }, [text]);

  const radarData = result ? [
    { axis: "個人主義", value: result.individualism },
    { axis: "理性", value: result.rationality },
    { axis: "進歩主義", value: result.progressivism },
    { axis: "自由志向", value: result.liberalism },
    { axis: "功利主義", value: result.utilitarianism },
    { axis: "抽象思考", value: result.abstractness },
    { axis: "社会性", value: result.sociality },
    { axis: "感情性", value: result.emotionality },
  ] : [];

  const styles = {
    root: {
      minHeight: "100vh",
      background: "#050a14",
      color: "#e2e8f0",
      fontFamily: "'Noto Sans JP', sans-serif",
      position: "relative",
      overflow: "hidden",
    },
    card: {
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 20,
      padding: 24,
      backdropFilter: "blur(12px)",
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 11,
      fontFamily: "'DM Mono', monospace",
      color: "#6366f1",
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    btn: {
      padding: "14px 32px",
      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
      color: "white",
      border: "none",
      borderRadius: 12,
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: "0 0 30px rgba(99,102,241,0.4)",
      transition: "all 0.2s",
      fontFamily: "'Noto Sans JP', sans-serif",
      letterSpacing: "0.05em",
    },
  };

  return (
    <div style={styles.root}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <GlowOrb style={{ width: 600, height: 600, top: -200, right: -100, background: "#6366f1" }} />
      <GlowOrb style={{ width: 400, height: 400, bottom: -100, left: -100, background: "#8b5cf6" }} />
      <GlowOrb style={{ width: 300, height: 300, top: "40%", left: "30%", background: "#06b6d4" }} />

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px 60px" }}>
        {/* HEADER */}
        <div style={{ textAlign: "center", paddingTop: 60, paddingBottom: 40 }}>
          <div style={{
            display: "inline-block", padding: "4px 14px",
            background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 999, fontSize: 11, color: "#818cf8", fontFamily: "'DM Mono', monospace",
            letterSpacing: "0.12em", marginBottom: 24,
          }}>
            AI THOUGHT ANALYZER v2.0
          </div>
          <h1 style={{
            fontSize: "clamp(32px, 6vw, 54px)", fontWeight: 700,
            background: "linear-gradient(135deg, #e2e8f0 0%, #818cf8 50%, #c084fc 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            lineHeight: 1.15, marginBottom: 16, letterSpacing: "-0.02em",
          }}>
            AI 思想チェッカー
          </h1>
          <p style={{ color: "#64748b", fontSize: 15, lineHeight: 1.7, maxWidth: 480, margin: "0 auto 32px" }}>
            あなたの文章から、思想傾向・価値観・哲学的立場を多角的に分析します
          </p>
        </div>

        {/* INPUT */}
        {phase === "home" && (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>
              <span>◈</span> テキスト入力
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="分析したい文章を入力してください（30文字以上）&#10;&#10;自分の意見・エッセイ・SNS投稿など、思想が反映された文章が適しています。"
              style={{
                width: "100%", minHeight: 180, background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12,
                color: "#e2e8f0", fontSize: 14, padding: 16, resize: "vertical",
                fontFamily: "'Noto Sans JP', sans-serif", lineHeight: 1.8,
                boxSizing: "border-box", outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={e => e.target.style.borderColor = "rgba(99,102,241,0.5)"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <span style={{ color: "#475569", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                {text.length} 文字{text.length < 30 && text.length > 0 && <span style={{ color: "#f59e0b" }}> (30文字以上必要)</span>}
              </span>
            </div>
            {/* Sample buttons */}
            <div style={{ marginTop: 16 }}>
              <div style={{ color: "#475569", fontSize: 11, fontFamily: "'DM Mono', monospace", marginBottom: 8 }}>サンプル文章:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["自由主義的", "保守主義的", "批判理論的", "功利主義的"].map((label, i) => (
                  <button key={i} onClick={() => setText(SAMPLE_TEXTS[i])} style={{
                    padding: "6px 12px", background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
                    color: "#94a3b8", fontSize: 12, cursor: "pointer",
                    fontFamily: "'Noto Sans JP', sans-serif",
                    transition: "all 0.15s",
                  }}
                    onMouseEnter={e => { e.target.style.background = "rgba(99,102,241,0.1)"; e.target.style.borderColor = "rgba(99,102,241,0.3)"; }}
                    onMouseLeave={e => { e.target.style.background = "rgba(255,255,255,0.04)"; e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
                  >{label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <button
                onClick={analyze}
                disabled={loading || text.length < 30}
                style={{
                  ...styles.btn,
                  opacity: (loading || text.length < 30) ? 0.5 : 1,
                  cursor: (loading || text.length < 30) ? "not-allowed" : "pointer",
                }}
              >
                {loading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                    <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    分析中...
                  </span>
                ) : "思想を分析する →"}
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
            {error && <div style={{ marginTop: 12, color: "#f87171", fontSize: 13, textAlign: "center" }}>{error}</div>}
          </div>
        )}

        {/* RESULTS */}
        {phase === "result" && result && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <button onClick={() => { setPhase("home"); setResult(null); }} style={{
                padding: "8px 16px", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
                color: "#94a3b8", fontSize: 13, cursor: "pointer",
                fontFamily: "'Noto Sans JP', sans-serif",
              }}>← 戻る</button>
              <div style={{ color: "#475569", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>ANALYSIS COMPLETE</div>
            </div>

            {/* AI Comment */}
            <div style={{ ...styles.card, border: "1px solid rgba(99,102,241,0.25)", background: "rgba(99,102,241,0.06)" }}>
              <div style={styles.sectionTitle}><span>◈</span> AI分析コメント</div>
              <p style={{ color: "#c7d2fe", fontSize: 15, lineHeight: 1.9, margin: 0 }}>
                {result.comment}
              </p>
              {result.keywords && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
                  {result.keywords.map(k => (
                    <span key={k} style={{
                      padding: "3px 10px", background: "rgba(99,102,241,0.15)",
                      border: "1px solid rgba(99,102,241,0.25)", borderRadius: 999,
                      color: "#818cf8", fontSize: 12, fontFamily: "'DM Mono', monospace",
                    }}>#{k}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Radar + Map */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              <div style={styles.card}>
                <div style={styles.sectionTitle}><span>◈</span> 思想レーダー</div>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
                    <PolarGrid stroke="rgba(255,255,255,0.06)" />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: "#64748b", fontSize: 10, fontFamily: "'DM Mono', monospace" }} />
                    <Radar name="score" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={1.5} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#e2e8f0", fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div style={styles.card}>
                <div style={styles.sectionTitle}><span>◈</span> 思想マップ</div>
                <ThoughtMap result={result} />
              </div>
            </div>

            {/* Score bars */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              <div style={styles.card}>
                <div style={styles.sectionTitle}><span>◈</span> 個人 vs 集団</div>
                <ScoreBar label="個人主義" value={result.individualism} color="#818cf8" />
                <ScoreBar label="集団主義" value={result.collectivism} color="#34d399" />
                <ScoreBar label="自由志向" value={result.liberalism} color="#60a5fa" />
                <ScoreBar label="権威志向" value={result.authoritarianism} color="#f87171" />
              </div>
              <div style={styles.card}>
                <div style={styles.sectionTitle}><span>◈</span> 思考スタイル</div>
                <ScoreBar label="理性・合理性" value={result.rationality} color="#818cf8" />
                <ScoreBar label="感情・直感" value={result.emotionality} color="#fb923c" />
                <ScoreBar label="抽象思考" value={result.abstractness} color="#a78bfa" />
                <ScoreBar label="社会的関心" value={result.sociality} color="#34d399" />
              </div>
            </div>

            {/* Axis analysis */}
            <div style={styles.card}>
              <div style={styles.sectionTitle}><span>◈</span> 哲学・倫理傾向</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[
                  { label: "保守主義", value: result.conservatism, color: "#f59e0b" },
                  { label: "進歩主義", value: result.progressivism, color: "#34d399" },
                  { label: "功利主義", value: result.utilitarianism, color: "#60a5fa" },
                  { label: "義務論", value: result.deontology, color: "#c084fc" },
                ].map(item => (
                  <ScoreBar key={item.label} label={item.label} value={item.value} color={item.color} />
                ))}
              </div>
            </div>

            {/* Philosopher match */}
            <div style={styles.card}>
              <div style={styles.sectionTitle}><span>◈</span> 思想家との近似傾向</div>
              <p style={{ color: "#64748b", fontSize: 12, marginBottom: 12 }}>
                文章傾向に一部共通点が見られる哲学者・思想家（断定ではありません）
              </p>
              <PhilosopherMatch result={result} />
            </div>

            {/* Re-analyze */}
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <button onClick={() => { setPhase("home"); setResult(null); }} style={styles.btn}>
                別の文章を分析する
              </button>
            </div>
          </>
        )}

        {/* Disclaimer */}
        <div style={{
          marginTop: 40, padding: "16px 20px",
          background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)",
          borderRadius: 12, textAlign: "center",
        }}>
          <p style={{ color: "#92400e", fontSize: 12, margin: 0, lineHeight: 1.6, color: "#78716c" }}>
            ⚠️ {DISCLAIMER}
          </p>
        </div>
      </div>
    </div>
  );
}
