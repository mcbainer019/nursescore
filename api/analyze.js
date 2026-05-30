const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { resume, jobDescription } = req.body;

    if (!resume || !resume.trim()) {
      return res.status(400).json({ error: 'Resume is required' });
    }

    const systemPrompt = `You are NurseScore, an expert ATS resume analyzer specialized exclusively in nursing and healthcare resumes. You have deep knowledge of how hospital ATS systems (iCIMS, Taleo, Workday, HealthcareSource) score nursing resumes.

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

    const userContent = `RESUME:\n${resume}\n\n${jobDescription && jobDescription.trim() ? `JOB DESCRIPTION:\n${jobDescription}` : "No job description provided — score against general nursing ATS standards."}`;

    const message = await client.messages.create({
      model: 'claude-opus-4-1-20250805',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const clean = responseText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    res.status(200).json(parsed);
  } catch (error) {
    console.error('Resume analysis error:', error);
    res.status(500).json({ error: error.message || 'Error analyzing resume' });
  }
}
