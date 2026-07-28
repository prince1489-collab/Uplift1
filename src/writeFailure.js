// writeFailure.js — turning a Firestore write failure into something true.
//
// Twelve places in this app used to answer every failed write with "check your connection
// and try again". That is a guess presented as a diagnosis, and when the guess is wrong it
// costs the user real time: they restart their wifi, switch to mobile data, reinstall the
// app — none of which can help, because the write was refused by a security rule.
//
// That is not hypothetical. Private replies were denied for every user because the
// `privateReplies` rule lived in firestore.rules but had never been deployed to Firebase.
// The app told everyone it was their connection.
//
// Message wording follows one principle: say whose problem it is. "Refused by the server's
// rules" is our fault and the user should stop retrying and tell us. "Couldn't reach the
// server" is plausibly theirs and retrying is sensible. Those need different words.

export function writeFailure(err, what) {
  const code = err?.code || "";
  if (code === "permission-denied") {
    return `${what} was refused by the server's rules. That's a configuration problem on our side, not something you did — please report it.`;
  }
  if (code === "unavailable" || code === "deadline-exceeded") {
    return "Couldn't reach the server — check your connection and try again.";
  }
  if (code === "unauthenticated") {
    return "Your session has expired — sign in again and retry.";
  }
  if (code === "resource-exhausted") {
    return "The server is busy right now. Give it a moment and try again.";
  }
  return `${what} didn't go through${code ? ` (${code})` : ""} — please try again.`;
}
