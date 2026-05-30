const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
require('dotenv').config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(express.json());
app.use(cors());

// Store subscription data (in production, use a real DB)
const subscriptions = new Map();

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
          price: process.env.STRIPE_PRICE_ID, // $9/month recurring
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