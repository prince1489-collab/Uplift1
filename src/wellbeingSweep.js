// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// wellbeingSweep.js — deleting the wellbeing scores earlier versions saved (3.31).
//
// Until 3.31 Seen offered a WHO-5 wellbeing check-in: a score out of 100, kept as a history in
// users/{uid}/wellbeing and as the latest answers on the profile (`wellbeing`, `wellbeingAt`). The
// founder took it out — a non-clinical app shouldn't score anyone's wellbeing — and chose to
// delete what was saved rather than keep health-type data nothing shows any more. So, the next
// time someone opens the app, their saved check-ins and those two fields are removed. Quietly,
// best effort, and harmless to repeat: once there's nothing left it is one empty read. The rules
// now allow only reading and deleting check-ins, never writing new ones.
//
// The Firestore functions are passed in so this can be tested in node (scripts/test-wellbeing-sweep.mjs).

export async function sweepWellbeing(db, uid, profile, fs) {
  if (!db || !uid || !fs) return { fields: false, deleted: 0 };
  let fields = false;
  if (profile && (profile.wellbeing !== undefined || profile.wellbeingAt !== undefined)) {
    await fs.updateDoc(fs.doc(db, "users", uid), { wellbeing: fs.deleteField(), wellbeingAt: fs.deleteField() });
    fields = true;
  }
  const snap = await fs.getDocs(fs.collection(db, "users", uid, "wellbeing"));
  const docs = snap?.docs || [];
  let deleted = 0;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = fs.writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => { batch.delete(d.ref); deleted += 1; });
    await batch.commit();
  }
  return { fields, deleted };
}
