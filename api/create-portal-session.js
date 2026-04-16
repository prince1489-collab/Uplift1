// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const { customerId } = req.body;
  if (!customerId) return res.status(400).json({ error: "Missing customerId" });

  try {
    const origin =
      req.headers.origin ||
      process.env.APP_URL ||
      "https://www.seenapp.app";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("Portal session error:", err);
    return res.status(500).json({ error: err.message });
  }
}
