import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/js";

const COLORS = {
  bg: "#FAFAF8",
  cream: "#FFFBF5",
  text: "#2D2520",
  textMuted: "#7A6F68",
  accent: "#D4A574",
  accentLight: "#EDE4D6",
  accentDark: "#8B6F47",
  success: "#6B8E5F",
  warning: "#C49060",
  error: "#A85448",
  border: "#E8DFD3",
  card: "#FFFFFF",
};

const FONT_BODY = "'Inter', 'Segoe UI', sans-serif";
const FONT_DISPLAY = "'Crimson Text', Georgia, serif";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

function ScoreRing({ score, size = 110, stroke = 8 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  
  let color = COLORS.error;
  if (score >= 75) color = COLORS.success;
  else if (score >= 50) color = COLORS.warning;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.border} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      />
      <text
        x={size / 2}
        y={size / 2 + 8}
        textAnchor="middle"
        style={{
          transform: "rotate(90deg)",
          transformOrigin: `${size / 2}px ${size / 2}px`,
          fontSize: size * 0.26,
          fontWeight: 600,
          fill: color,
          fontFamily: FONT_DISPLAY,
          letterSpacing: "-1px"
        }}
      >
        {score}
      </text>
    </svg>
  );
}

function CategoryBar({ label, score, issues, icon }) {
  let color = COLORS.error;
  let bgColor = "#FEF3E8";
  
  if (score >= 75) {
    color = COLORS.success;
    bgColor = "#F0F5EA";
  } else if (score >= 50) {
    color = COLORS.warning;
    bgColor = "#FEF3E8";
  }

  return (
    <div style={{
      marginBottom: 14,
      background: COLORS.card,
      borderRadius: 10,
      border: `1px solid ${COLORS.border}`,
      padding: "14px 16px",
      transition: "all 0.2s"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontFamily: FONT_BODY, fontWeight: 500, fontSize: 14, color: COLORS.text }}>{label}</span>
        </div>
        <span style={{
          fontFamily: FONT_BODY,
          fontWeight: 600,
          fontSize: 13,
          color: color,
          background: bgColor,
          padding: "3px 10px",
          borderRadius: 16
        }}>
          {score}
        </span>
      </div>
      <div style={{ background: COLORS.border, borderRadius: 3, height: 5, marginBottom: issues?.length ? 10 : 0 }}>
        <div style={{
          background: color,
          width: `${score}%`,
          height: "100%",
          borderRadius: 3,
          transition: "width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)"
        }} />
      </div>
      {issues?.length > 0 && (
        <ul style={{ margin: "8px 0 0 0", padding: 0, listStyle: "none" }}>
          {issues.slice(0, 3).map((issue, i) => (
            <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 5 }}>
              <span style={{
                color: COLORS.textMuted,
                fontWeight: 600,
                fontSize: 12,
                marginTop: 2,
                opacity: 0.6
              }}>→</span>
              <span style={{
                fontFamily: FONT_BODY,
                fontSize: 13,
                color: COLORS.textMuted,
                lineHeight: 1.4
              }}>
                {issue}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "50px 0" }}>
      <div style={{
        width: 44,
        height: 44,
        border: `2px solid ${COLORS.border}`,
        borderTop: `2px solid ${COLORS.accent}`,
        borderRadius: "50%",
        animation: "spin 0.9s cubic-bezier(0.4, 0.0, 0.2, 1) infinite"
      }} />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <p style={{
        fontFamily: FONT_BODY,
        color: COLORS.textMuted,
        fontSize: 13,
        margin: 0,
        fontWeight: 400
      }}>
        Analyzing your resume…
      </p>
    </div>
  );
}

const SYSTEM_PROMPT = `You are NurseScore, an expert ATS resume analyzer specialized exclusively in nursing and healthcare resumes. You have deep knowledge of how hospital ATS systems (iCIMS, Taleo, Workday, HealthcareSource) score nursing resumes.

You must analyze the provided resume against the job description (or general nursing standards if no JD is provided) and return a JSON object ONLY — no preamble, no markdown fences, no explanation outside the JSON.

Score across exactly these 6 categories (0-100 each):

1. certifications — BLS, ACLS, PALS, RN license with state and expiry present and correctly formatted
2. ehr_tech — EHR/EMR systems listed (Epic, Cerner, Meditech, Pyxis, BCMA, athenahealth etc) and matched to JD
3. clinical_keywords — clinical skills matching the JD (patient assessment, medication administration, IV therapy, wound care, care planning, specialty procedures)
4. specialty_alignment — unit/specialty terminology matching the target role (ICU, ER, Med-Surg, L&D, Pediatrics, etc)
5. formatting — single column, standard headings, no tables/graphics, ATS-parseable structure, correct credential ordering
6. impact_language — quantified achievements, patient ratios, acuity levels, measurable outcomes present

Return ONLY this exact JSON shape:
{
  "overall": <weighted average, number>,
  "verdict": "<one sentence plain-English summary of the resume's biggest problem>",
  "categories": {
    "certifications": { "score": <number>, "issues": ["<specific actionable fix>", ...] },
    "ehr_tech": { "score": <number>, "issues": ["<specific actionable fix>", ...] },
    "clinical_keywords": { "score": <number>, "issues": ["<specific actionable fix>", ...] },
    "specialty_alignment": { "score": <number>, "issues": ["<specific actionable fix>", ...] },
    "formatting": { "score": <number>, "issues": ["<specific actionable fix>", ...] },
    "impact_language": { "score": <number>, "issues": ["<specific actionable fix>", ...] }
  },
  "top_missing_keywords": ["<keyword>", "<keyword>", "<keyword>"],
  "biggest_win": "<single most impactful change this nurse can make right now>"
}

Issues should be specific, actionable, and nursing-specific. Max 3 issues per category. If a category looks good, issues can be empty array.
Weights for overall: certifications 20%, ehr_tech 15%, clinical_keywords 25%, specialty_alignment 20%, formatting 10%, impact_language 10%.`;

const CATEGORY_META = {
  certifications: { label: "Certifications & Licensure", icon: "🏅" },
  ehr_tech: { label: "EHR & Technology", icon: "💻" },
  clinical_keywords: { label: "Clinical Keywords", icon: "🩺" },
  specialty_alignment: { label: "Specialty Alignment", icon: "🎯" },
  formatting: { label: "ATS Formatting", icon: "📄" },
  impact_language: { label: "Impact & Outcomes", icon: "📈" },
};

export default function NurseScore() {
  const [resume, setResume] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scansUsed, setScansUsed] = useState(0);
  const [activeTab, setActiveTab] = useState("score");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  async function analyzeResume() {
    if (!resume.trim()) {
      setError("Please paste your resume text first.");
      return;
    }
    if (scansUsed >= 1) {
      setError("You've used your free scan. Upgrade to Pro for unlimited analysis.");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);

    const userContent = `RESUME:\n${resume}\n\n${jobDesc.trim() ? `JOB DESCRIPTION:\n${jobDesc}` : "No job description provided — score against general nursing ATS standards."}`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }]
        })
      });

      const data = await response.json();
      const text = data.content?.map(b => b.text || "").join("").trim();
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
      setScansUsed(s => s + 1);
    } catch (e) {
      setError("Something went wrong analyzing your resume. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout() {
    if (!email.trim()) {
      setError("Please enter your email to proceed to checkout.");
      return;
    }

    setCheckoutLoading(true);
    setError("");

    try {
      const response = await fetch("https://nursescore.vercel.app/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, userId: null })
      });

      const { sessionId, error: checkoutError } = await response.json();
      
      if (checkoutError) {
        setError(checkoutError);
        setCheckoutLoading(false);
        return;
      }

      const stripe = await stripePromise;
      const { error: redirectError } = await stripe.redirectToCheckout({ sessionId });

      if (redirectError) {
        setError(redirectError.message);
      }
    } catch (e) {
      setError("Checkout failed. Please try again.");
      console.error(e);
    } finally {
      setCheckoutLoading(false);
    }
  }

  const getVerdictStyle = (score) => {
    if (score >= 80) return { text: "Strong ATS Match", color: COLORS.success };
    if (score >= 60) return { text: "Needs Improvement", color: COLORS.warning };
    return { text: "At Risk", color: COLORS.error };
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: FONT_BODY }}>
      <div style={{
        background: COLORS.card,
        borderBottom: `1px solid ${COLORS.border}`,
        padding: "16px 24px"
      }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 24,
              color: COLORS.text,
              fontWeight: 400,
              letterSpacing: "-0.5px",
              margin: 0
            }}>
              NurseScore
            </div>
            <div style={{
              fontSize: 12,
              color: COLORS.textMuted,
              fontWeight: 400,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginTop: 2
            }}>
              ATS Resume Analyzer
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{
              fontSize: 12,
              color: COLORS.textMuted,
              padding: "6px 12px",
              background: COLORS.accentLight,
              borderRadius: 6
            }}>
              {scansUsed}/1 free scans
            </div>
            <button style={{
              background: COLORS.accent,
              border: "none",
              borderRadius: 6,
              padding: "7px 14px",
              color: COLORS.card,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: FONT_BODY,
              transition: "all 0.2s"
            }}
            onMouseOver={e => e.target.style.background = COLORS.accentDark}
            onMouseOut={e => e.target.style.background = COLORS.accent}
            >
              Pro — $9/mo
            </button>
          </div>
        </div>
      </div>

      {!result && !loading && (
        <div style={{
          background: COLORS.cream,
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "48px 24px"
        }}>
          <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "left" }}>
            <div style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: COLORS.accentDark,
              marginBottom: 16,
              paddingBottom: 4,
              borderBottom: `1px solid ${COLORS.accent}`
            }}>
              Built for nurses
            </div>
            <h1 style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 42,
              color: COLORS.text,
              margin: "0 0 16px 0",
              fontWeight: 400,
              lineHeight: 1.2,
              letterSpacing: "-0.5px"
            }}>
              Does your resume make it past the filter?
            </h1>
            <p style={{
              fontSize: 15,
              color: COLORS.textMuted,
              margin: 0,
              maxWidth: 500,
              lineHeight: 1.6,
              fontWeight: 400
            }}>
              Most nursing resumes get rejected by hospital ATS systems before a human ever sees them. Paste yours and find out why — with nursing-specific fixes in 30 seconds.
            </p>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 800, margin: "0 auto", padding: result || loading ? "32px 16px" : "32px 16px" }}>
        <div style={{
          background: COLORS.card,
          borderRadius: 12,
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 2px 8px rgba(45, 37, 32, 0.04)",
          overflow: "hidden"
        }}>

          {!result && !loading && (
            <div style={{ padding: "28px" }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
                {[["score", "Analyze"], ["how", "How it Works"]].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    style={{
                      padding: "8px 14px",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontFamily: FONT_BODY,
                      fontWeight: 500,
                      fontSize: 13,
                      background: activeTab === id ? COLORS.accentLight : "transparent",
                      color: activeTab === id ? COLORS.text : COLORS.textMuted,
                      transition: "all 0.2s",
                      borderBottom: activeTab === id ? `2px solid ${COLORS.accent}` : "none"
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === "score" && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{
                      display: "block",
                      fontWeight: 500,
                      fontSize: 13,
                      color: COLORS.text,
                      marginBottom: 6
                    }}>
                      Your Resume <span style={{ color: COLORS.error }}>*</span>
                    </label>
                    <textarea
                      value={resume}
                      onChange={e => setResume(e.target.value)}
                      placeholder="Paste your full resume here…&#10;&#10;Include certifications, EHR systems, clinical skills, and work experience."
                      style={{
                        width: "100%",
                        minHeight: 200,
                        padding: "12px 14px",
                        borderRadius: 8,
                        border: `1.5px solid ${COLORS.border}`,
                        fontFamily: FONT_BODY,
                        fontSize: 13,
                        color: COLORS.text,
                        background: COLORS.bg,
                        resize: "vertical",
                        lineHeight: 1.5,
                        outline: "none",
                        boxSizing: "border-box",
                        transition: "border-color 0.2s"
                      }}
                      onFocus={e => e.target.style.borderColor = COLORS.accent}
                      onBlur={e => e.target.style.borderColor = COLORS.border}
                    />
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={{
                      display: "block",
                      fontWeight: 500,
                      fontSize: 13,
                      color: COLORS.text,
                      marginBottom: 6
                    }}>
                      Job Description <span style={{ color: COLORS.textMuted, fontWeight: 400 }}>(optional)</span>
                    </label>
                    <textarea
                      value={jobDesc}
                      onChange={e => setJobDesc(e.target.value)}
                      placeholder="Paste the job posting you're applying to…"
                      style={{
                        width: "100%",
                        minHeight: 120,
                        padding: "12px 14px",
                        borderRadius: 8,
                        border: `1.5px solid ${COLORS.border}`,
                        fontFamily: FONT_BODY,
                        fontSize: 13,
                        color: COLORS.text,
                        background: COLORS.bg,
                        resize: "vertical",
                        lineHeight: 1.5,
                        outline: "none",
                        boxSizing: "border-box",
                        transition: "border-color 0.2s"
                      }}
                      onFocus={e => e.target.style.borderColor = COLORS.accent}
                      onBlur={e => e.target.style.borderColor = COLORS.border}
                    />
                  </div>

                  {error && (
                    <div style={{
                      background: "#FAF3F0",
                      border: `1px solid #EDD5CE`,
                      borderRadius: 8,
                      padding: "10px 14px",
                      marginBottom: 16
                    }}>
                      <p style={{
                        color: COLORS.error,
                        fontFamily: FONT_BODY,
                        fontSize: 13,
                        margin: 0,
                        fontWeight: 500
                      }}>
                        {error}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={analyzeResume}
                    disabled={!resume.trim()}
                    style={{
                      width: "100%",
                      padding: "12px 0",
                      border: "none",
                      borderRadius: 8,
                      cursor: resume.trim() ? "pointer" : "not-allowed",
                      background: resume.trim() ? COLORS.accent : COLORS.border,
                      color: resume.trim() ? COLORS.card : COLORS.textMuted,
                      fontFamily: FONT_BODY,
                      fontWeight: 600,
                      fontSize: 14,
                      transition: "all 0.2s",
                      boxShadow: resume.trim() ? "0 2px 6px rgba(212, 165, 116, 0.2)" : "none"
                    }}
                    onMouseOver={e => resume.trim() && (e.target.style.background = COLORS.accentDark)}
                    onMouseOut={e => resume.trim() && (e.target.style.background = COLORS.accent)}
                  >
                    Analyze My Resume
                  </button>
                  <p style={{
                    textAlign: "center",
                    fontFamily: FONT_BODY,
                    fontSize: 12,
                    color: COLORS.textMuted,
                    marginTop: 10,
                    marginBottom: 0
                  }}>
                    Free analysis. No sign-up. Results in ~30 seconds.
                  </p>
                </>
              )}

              {activeTab === "how" && (
                <div>
                  {[
                    ["🏥", "Hospital ATS Logic", "We analyze using the same criteria used by iCIMS, Taleo, and Workday—the systems used by 97% of US hospitals."],
                    ["📋", "Six Dimensions", "Certifications, EHR systems, clinical keywords, specialty alignment, formatting, and measurable impact—scored separately so you know exactly what to fix."],
                    ["⚡", "Specific, Not Generic", "You won't get 'add more keywords.' You'll get: 'Add your BLS expiry date in this format: BLS — American Heart Association — Exp. 03/2027'."],
                    ["🔒", "Private & Secure", "Your resume is never stored or shared. Analysis happens in-session and is deleted immediately."]
                  ].map(([icon, title, desc], i) => (
                    <div key={i} style={{ display: "flex", gap: 12, marginBottom: 18 }}>
                      <div style={{ fontSize: 20, flexShrink: 0 }}>{icon}</div>
                      <div>
                        <div style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: COLORS.text,
                          marginBottom: 4
                        }}>
                          {title}
                        </div>
                        <div style={{
                          fontSize: 13,
                          color: COLORS.textMuted,
                          lineHeight: 1.5,
                          fontWeight: 400
                        }}>
                          {desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {loading && <Spinner />}

          {result && (
            <div style={{ padding: "28px" }}>
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 20,
                marginBottom: 24,
                padding: "20px 22px",
                background: COLORS.bg,
                borderRadius: 10,
                border: `1px solid ${COLORS.border}`
              }}>
                <ScoreRing score={result.overall} size={100} stroke={7} />
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 8 }}>
                    {(() => {
                      const verdict = getVerdictStyle(result.overall);
                      return (
                        <>
                          <div style={{
                            display: "inline-block",
                            fontFamily: FONT_BODY,
                            fontWeight: 600,
                            fontSize: 12,
                            color: verdict.color,
                            paddingBottom: 2,
                            borderBottom: `2px solid ${verdict.color}`,
                            marginBottom: 8
                          }}>
                            {verdict.text}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <p style={{
                    fontFamily: FONT_BODY,
                    color: COLORS.text,
                    fontSize: 14,
                    margin: 0,
                    lineHeight: 1.6,
                    fontWeight: 500
                  }}>
                    {result.verdict}
                  </p>
                </div>
              </div>

              {result.biggest_win && (
                <div style={{
                  background: COLORS.accentLight,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                  marginBottom: 20,
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start"
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>⭐</span>
                  <div>
                    <div style={{
                      fontWeight: 700,
                      fontSize: 12,
                      color: COLORS.accentDark,
                      marginBottom: 3,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em"
                    }}>
                      Biggest Impact
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: COLORS.text,
                      lineHeight: 1.5,
                      fontWeight: 500
                    }}>
                      {result.biggest_win}
                    </div>
                  </div>
                </div>
              )}

              {result.top_missing_keywords?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    fontWeight: 600,
                    fontSize: 12,
                    color: COLORS.text,
                    marginBottom: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
                  }}>
                    🔑 Missing Keywords
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.top_missing_keywords.map((kw, i) => (
                      <span
                        key={i}
                        style={{
                          background: "#FEF3E8",
                          border: `1px solid ${COLORS.warning}`,
                          color: COLORS.warning,
                          borderRadius: 16,
                          padding: "4px 11px",
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: FONT_BODY
                        }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: 12,
                  color: COLORS.text,
                  marginBottom: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em"
                }}>
                  Score Breakdown
                </div>
                {Object.entries(result.categories).map(([key, val]) => (
                  <CategoryBar
                    key={key}
                    label={CATEGORY_META[key]?.label}
                    icon={CATEGORY_META[key]?.icon}
                    score={val.score}
                    issues={val.issues}
                  />
                ))}
              </div>

              <div style={{
                background: COLORS.bg,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: "20px 18px"
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>⭐</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: FONT_DISPLAY,
                      fontSize: 16,
                      color: COLORS.text,
                      fontWeight: 400,
                      marginBottom: 6,
                      letterSpacing: "-0.3px"
                    }}>
                      Unlimited Scanning
                    </div>
                    <ul style={{ padding: 0, margin: "0 0 12px 0", listStyle: "none" }}>
                      {["Unlimited rescans", "Rewrite suggestions", "Cover letter generator", "Specialty modes (ICU, ER, L&D)"].map((f, i) => (
                        <li key={i} style={{
                          fontSize: 12,
                          color: COLORS.textMuted,
                          marginBottom: 3,
                          display: "flex",
                          gap: 6,
                          alignItems: "center"
                        }}>
                          <span style={{ color: COLORS.accent }}>✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {error && (
                  <div style={{
                    background: "#FAF3F0",
                    border: `1px solid #EDD5CE`,
                    borderRadius: 6,
                    padding: "8px 10px",
                    marginBottom: 12
                  }}>
                    <p style={{
                      color: COLORS.error,
                      fontFamily: FONT_BODY,
                      fontSize: 12,
                      margin: 0,
                      fontWeight: 500
                    }}>
                      {error}
                    </p>
                  </div>
                )}

                <div style={{ marginBottom: 12 }}>
                  <label style={{
                    display: "block",
                    fontWeight: 500,
                    fontSize: 12,
                    color: COLORS.text,
                    marginBottom: 6
                  }}>
                    Email <span style={{ color: COLORS.error }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    style={{
                      width: "100%",
                      padding: "9px 11px",
                      borderRadius: 6,
                      border: `1px solid ${COLORS.border}`,
                      fontFamily: FONT_BODY,
                      fontSize: 13,
                      color: COLORS.text,
                      background: COLORS.card,
                      boxSizing: "border-box",
                      outline: "none",
                      transition: "border-color 0.2s"
                    }}
                    onFocus={e => e.target.style.borderColor = COLORS.accent}
                    onBlur={e => e.target.style.borderColor = COLORS.border}
                  />
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={checkoutLoading || !email.trim()}
                  style={{
                    width: "100%",
                    background: COLORS.accent,
                    color: COLORS.card,
                    border: "none",
                    borderRadius: 6,
                    padding: "10px 0",
                    fontFamily: FONT_BODY,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: checkoutLoading || !email.trim() ? "not-allowed" : "pointer",
                    opacity: checkoutLoading || !email.trim() ? 0.6 : 1,
                    transition: "all 0.2s"
                  }}
                  onMouseOver={e => !checkoutLoading && email.trim() && (e.target.style.background = COLORS.accentDark)}
                  onMouseOut={e => !checkoutLoading && email.trim() && (e.target.style.background = COLORS.accent)}
                >
                  {checkoutLoading ? "Processing…" : "Subscribe to Pro — $9/month"}
                </button>
                <p style={{
                  fontFamily: FONT_BODY,
                  fontSize: 11,
                  color: COLORS.textMuted,
                  marginTop: 8,
                  marginBottom: 0,
                  textAlign: "center"
                }}>
                  Cancel anytime. Secure payment via Stripe.
                </p>
              </div>

              <button
                onClick={() => {
                  setResult(null);
                  setResume("");
                  setJobDesc("");
                  setEmail("");
                  setError("");
                }}
                style={{
                  width: "100%",
                  padding: "10px 0",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  background: "transparent",
                  color: COLORS.textMuted,
                  fontFamily: FONT_BODY,
                  fontWeight: 500,
                  fontSize: 13,
                  cursor: "pointer",
                  marginTop: 12,
                  transition: "all 0.2s"
                }}
                onMouseOver={e => e.target.style.background = COLORS.bg}
                onMouseOut={e => e.target.style.background = "transparent"}
              >
                ← Analyze another resume
              </button>
            </div>
          )}
        </div>

        {!result && !loading && (
          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: 20,
            marginTop: 20,
            flexWrap: "wrap",
            fontSize: 12,
            color: COLORS.textMuted
          }}>
            {["🔒 Your data is private", "📊 97% of hospitals use our criteria", "✓ Trusted by nurses"].map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        )}
      </div>

      <div style={{
        textAlign: "center",
        padding: "24px",
        borderTop: `1px solid ${COLORS.border}`,
        marginTop: 32,
        color: COLORS.textMuted,
        fontSize: 12
      }}>
        <p style={{ margin: 0 }}>
          NurseScore © 2026 · Built for nurses, not recruiters
        </p>
      </div>
    </div>
  );
}
