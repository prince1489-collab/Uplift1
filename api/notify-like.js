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
import { cors, requireCaller, pushEnvelope, tokensFor, dropDeadToken } from "./_auth.js";

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
    const body = country
      ? `${name} from ${country} liked your message ❤️`
      : `${name} liked your message ❤️`;

    // One dead device must not stop the others being told, so each send is settled on its own
    // and a permanently-dead token is pruned individually.
    const results = await Promise.allSettled(
      rows.map((r) => getMessaging().send(pushEnvelope(r.token, body, r.platform)))
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
