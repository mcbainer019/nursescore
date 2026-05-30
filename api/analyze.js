export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { resumeText, jobDescription } = req.body;

  if (!resumeText) {
    return res.status(400).json({ error: 'resumeText is required' });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const prompt = `You are an expert nursing resume analyzer and ATS (Applicant Tracking System) specialist. Analyze the following nursing resume and provide a detailed, actionable assessment.

${jobDescription ? `Job Description to match against:\n${jobDescription}\n\n` : ''}

Resume to analyze:
${resumeText}

Analyze the resume across these 6 nursing-specific categories and return ONLY valid JSON (no markdown, no explanation):

{
  "overallScore": <number 0-100>,
  "biggestWin": "<one sentence: the strongest thing about this resume>",
  "criticalFix": "<one sentence: the single most important thing to fix right now>",
  "categories": {
    "clinicalKeywords": {
      "score": <0-100>,
      "label": "Clinical Keywords",
      "issues": ["<specific issue>", "<specific issue>"],
      "fixes": ["<actionable fix>", "<actionable fix>"],
      "missingKeywords": ["<keyword>", "<keyword>", "<keyword>"]
    },
    "quantifiedAchievements": {
      "score": <0-100>,
      "label": "Quantified Achievements",
      "issues": ["<specific issue>"],
      "fixes": ["<actionable fix>", "<actionable fix>"],
      "examples": ["<example of how to add numbers>"]
    },
    "atsFormatting": {
      "score": <0-100>,
      "label": "ATS Formatting",
      "issues": ["<specific issue>"],
      "fixes": ["<actionable fix>"],
      "warnings": ["<formatting warning>"]
    },
    "licensureCertifications": {
      "score": <0-100>,
      "label": "Licensure & Certifications",
      "issues": ["<specific issue>"],
      "fixes": ["<actionable fix>"],
      "missing": ["<certification that should be listed>"]
    },
    "specialtyExperience": {
      "score": <0-100>,
      "label": "Specialty Experience",
      "issues": ["<specific issue>"],
      "fixes": ["<actionable fix>"]
    },
    "professionalSummary": {
      "score": <0-100>,
      "label": "Professional Summary",
      "issues": ["<specific issue>"],
      "fixes": ["<actionable fix>", "<actionable fix>"]
    }
  }
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      return res.status(response.status).json({ error: 'Claude API error', details: errorData });
    }

    const data = await response.json();
    const text = data.content[0].text;

    // Parse JSON from Claude's response
    let parsed;
    try {
      // Strip any accidental markdown fences
      const clean = text.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('JSON parse error:', e, 'Raw text:', text);
      return res.status(500).json({ error: 'Failed to parse Claude response', raw: text });
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: error.message });
  }
}
