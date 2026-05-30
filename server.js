const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const client = new Anthropic();

app.use(express.json());
app.use(cors());

// Store subscription data (in production, use a real DB)
const subscriptions = new Map();

/**
 * POST /api/analyze-resume
 * Analyzes a nursing resume using Claude
 */
app.post('/api/analyze-resume', async (req, res) => {
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

    res.json(parsed);
  } catch (error) {
    console.error('Resume analysis error:', error);
    res.status(500).json({ error: error.message || 'Error analyzing resume' });
  }
});

/**
 * POST /create-checkout-session
 * Creates a Stripe Checkout session for $9/month subscription
 */
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { email, userId } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${process.env.DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.DOMAIN}/`,
      customer_email: email,
      metadata: {
        userId: userId || 'guest',
      },
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /webhook
 * Stripe webhook to track successful subscriptions
 */
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error(`Webhook signature verification failed: ${error.message}`);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  // Handle subscription events
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.userId || session.customer_email;
    
    // Store subscription info
    subscriptions.set(userId, {
      customerId: session.customer,
      email: session.customer_email,
      createdAt: new Date(),
      status: 'active',
    });

    console.log(`✓ New Pro subscriber: ${session.customer_email}`);
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    // Remove from active subscriptions
    const entries = Array.from(subscriptions.entries());
    entries.forEach(([key, val]) => {
      if (val.customerId === subscription.customer) {
        subscriptions.delete(key);
      }
    });
    console.log(`✗ Subscription cancelled: ${subscription.customer}`);
  }

  res.json({ received: true });
});

/**
 * GET /check-subscription/:email
 * Check if a user has an active Pro subscription
 */
app.get('/check-subscription/:email', (req, res) => {
  const { email } = req.params;
  const sub = subscriptions.get(email);

  if (sub && sub.status === 'active') {
    return res.json({ isPro: true, subscription: sub });
  }

  res.json({ isPro: false });
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NurseScore server running on port ${PORT}`);
  console.log(`Stripe price ID: ${process.env.STRIPE_PRICE_ID}`);
});
