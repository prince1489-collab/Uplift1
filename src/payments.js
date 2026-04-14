/**
 * startCheckout — redirects the user to a Stripe Checkout page for the $3.99/mo subscription.
 * Called from anywhere in the app that has a "Go Premium" button.
 */
export async function startCheckout(currentUser) {
  if (!currentUser?.uid) return;
  try {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: currentUser.uid,
        email: currentUser.email ?? "",
      }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error(data.error || "Unknown error");
    }
  } catch (err) {
    console.error("Checkout error:", err);
    alert("Could not start checkout. Please try again.");
  }
}
