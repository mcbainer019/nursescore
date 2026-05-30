export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { resume, jobDescription } = req.body;

  if (!resume) return res.status(400).json({ error: 'resume is required' });

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const prompt = `You are an expert nursing resume ATS analyzer. Analyze this nursing resume and return ONLY a valid JSON object with no markdown, no explanation, nothing else.

${jobDescription ? `Job Description:\n${jobDescription}\n\n` : ''}Resume:\n${resume}

Return this exact JSON structure:
{
  "overall": <number 0-100>,
  "verdict": "<2-3 sentence summary of the resume's ATS performance>",
  "biggest_win": "<the single strongest thing about this resume>",
  "top_missing_keywords": ["<keyword>", "<keyword>", "<keyword>", "<keyword>", "<keyword>"],
  "categories": {
    "certifications": {
      "score": <0-100>,
      "issues": ["<specific issue>", "<specific issue>"]
    },
    "ehr_tech": {
      "score": <0-100>,
      "issues": ["<specific issue>", "<specific issue>"]
    },
    "clinical_keywords": {
      "score": <0-100>,
      "issues": ["<specific issue>", "<specific issue>"]
    },
    "specialty_alignment": {
      "score": <0-100>,
      "issues": ["<specific issue>", "<specific issue>"]
    },
    "formatting": {
      "score": <0-100>,
      "issues": ["<specific issue>", "<specific issue>"]
    },
    "impact_language": {
      "score": <0-100>,
      "issues": ["<specific issue>", "<specific issue>"]
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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: 'Claude API error', details: err });
    }

    const data = await response.json();
    const text = data.content[0].text;

    let parsed;
    try {
      const clean = text.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse response', raw: text });
    }

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
