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
import { cors, requireCaller, pushEnvelope } from "./_auth.js";

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
    const token = userSnap.data()?.fcmToken;
    // Written beside the token by nativePush.js; absent for tokens stored before it existed,
    // which correctly falls through to the original web/iOS envelope.
    const platform = userSnap.data()?.pushPlatform;
    if (!token) return res.status(200).json({ skipped: "no token" });

    const name = String(reaction.reactorName || "Someone").trim() || "Someone";
    const country = reaction.country ? String(reaction.country) : null;
    const body = country
      ? `${name} from ${country} liked your message ❤️`
      : `${name} liked your message ❤️`;

    const pushId = await getMessaging().send(pushEnvelope(token, body, platform));
    return res.status(200).json({ ok: true, messageId: pushId });
  } catch (err) {
    console.error("[notify-like]", err?.code, err?.message);
    if (err?.code === "messaging/registration-token-not-registered") {
      try {
        await getFirestore().collection("users").doc(ownerUid).update({ fcmToken: "" });
      } catch { /* ignore */ }
    }
    return res.status(500).json({ error: err?.code || "internal", message: err?.message });
  }
}
