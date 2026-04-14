import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const { uid, email } = req.body;
  if (!uid) return res.status(400).json({ error: "Missing uid" });

  try {
    const origin =
      req.headers.origin ||
      process.env.APP_URL ||
      "https://uplift.vercel.app";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${origin}/?premium=success`,
      cancel_url: `${origin}/`,
      customer_email: email || undefined,
      metadata: { uid },
      subscription_data: { metadata: { uid } },
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("Checkout session error:", err);
    return res.status(500).json({ error: err.message });
  }
}
