// notify-like.js — push the message owner when someone hearts their message.
//
// SECURITY NOTE. This route used to take `ownerUid`, `reactorName` and `country` straight from
// the request body with no authentication of any kind. That meant anyone who knew a uid could
// send that person a push notification containing arbitrary text, forever, without an account.
//
// Nothing from the body is trusted now:
//   - the caller proves who they are with a Firebase ID token;
//   - the reaction itself is verified by reading the document the client just wrote, at a path
//     derived from (ownerUid, messageId, caller) — so you can only trigger a push for a like
//     you actually made;
//   - the name and country shown in the notification come from THAT document, not the request,
//     so the notification body can't be attacker-chosen.
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { cors, requireCaller, pushEnvelope, tokensFor, dropDeadToken, linkFor } from "./_auth.js";

export default async function handler(req, res) {
  if (!cors(req, res)) return;

  const callerUid = await requireCaller(req, res, "notify-like");
  if (!callerUid) return;

  const { ownerUid, messageId } = req.body ?? {};
  if (!ownerUid || !messageId) return res.status(400).json({ error: "missing ownerUid or messageId" });
  if (ownerUid === callerUid) return res.status(400).json({ error: "cannot notify yourself" });

  try {
    const db = getFirestore();

    // The reaction the client wrote a moment ago. Same id shape as the client builds in
    // UpliftRetentionFeatures.jsx — `${messageId}_${reactorUid}` — so it is derivable here and
    // cannot be pointed at someone else's reaction.
    const reactionSnap = await db
      .collection("users").doc(ownerUid)
      .collection("reactionsReceived").doc(`${messageId}_${callerUid}`)
      .get();
    if (!reactionSnap.exists) return res.status(403).json({ error: "no such reaction" });

    const reaction = reactionSnap.data() || {};
    // Belt and braces: the rules already require reactorUid == the writer.
    if (reaction.reactorUid !== callerUid) return res.status(403).json({ error: "not your reaction" });

    const userSnap = await db.collection("users").doc(ownerUid).get();
    // Every device they have, not just whichever registered most recently. Each row carries its
    // own platform, which is what decides the envelope shape.
    const rows = tokensFor(userSnap.data());
    if (!rows.length) return res.status(200).json({ skipped: "no token" });

    const name = String(reaction.reactorName || "Someone").trim() || "Someone";
    const country = reaction.country ? String(reaction.country) : null;

    // Hearts and stickers both arrive here, because both now write reactionsReceived and both
    // want the same proof-by-re-read. They must not both say "liked your message ❤️": someone
    // who sent a hug would be reported as having sent a heart, and the emoji in the alert would
    // be one the sender never chose.
    //
    // The emoji comes from the stored document rather than the request body, same as every
    // other field here — the endpoint deliberately trusts nothing the caller sends.
    const isSticker = Boolean(reaction.stickerId);
    const emoji = String(reaction.emoji || "❤️");
    const what = isSticker ? `reacted ${emoji}` : `liked your message ${emoji}`;
    const body = country ? `${name} from ${country} ${what}` : `${name} ${what}`;

    // One dead device must not stop the others being told, so each send is settled on its own
    // and a permanently-dead token is pruned individually.
    const results = await Promise.allSettled(
      rows.map((r) => getMessaging().send(pushEnvelope(r.token, body, r.platform, {
        title: isSticker ? "Someone reacted ✨" : "Your words landed ❤️",
        link: linkFor("hearts"),
      })))
    );
    let sent = 0;
    await Promise.all(results.map(async (result, i) => {
      if (result.status === "fulfilled") { sent += 1; return; }
      const code = result.reason?.code;
      console.error("[notify-like]", code, result.reason?.message);
      if (code === "messaging/registration-token-not-registered") await dropDeadToken(db, ownerUid, rows[i]);
    }));
    return res.status(200).json({ ok: sent > 0, sent, devices: rows.length });
  } catch (err) {
    console.error("[notify-like]", err?.code, err?.message);
    return res.status(500).json({ error: err?.code || "internal", message: err?.message });
  }
}
