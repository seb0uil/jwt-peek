// Décodage et recherche de JWT dans du texte. Aucune dépendance au DOM.
const Jwt = (() => {
  const MAX_TOKEN = 20000; // au-delà, on ignore
  const MAX_SCAN = 100000; // taille max de texte analysé (évite de scanner une page entière après Ctrl+A)

  // Cherche un JWT *dans* un texte (ex. "Authorization: Bearer eyJ..." ou un JSON entier)
  const JWT_FIND = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;

  function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    s += "=".repeat((4 - (s.length % 4)) % 4);
    const bin = atob(s);
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }

  function parse(token) {
    const [h, p, sig] = token.split(".");
    if (!h || !p) throw new Error("Format JWT invalide");
    const header = JSON.parse(b64urlDecode(h));
    const payload = JSON.parse(b64urlDecode(p));
    if (!header || typeof header !== "object" || !payload || typeof payload !== "object") {
      throw new Error("Header ou Payload invalide");
    }
    return { header, payload, sig: sig || "" };
  }

  function isValid(token) {
    try { parse(token); return true; } catch (_) { return false; }
  }

  function findIn(text) {
    if (!text || typeof text !== "string" || text.length > MAX_SCAN) return null;
    for (const src of [text, text.replace(/\s+/g, "")]) {
      for (const m of src.matchAll(JWT_FIND)) {
        if (isValid(m[0])) return m[0]; // sinon faux positif, on continue
      }
    }
    return null;
  }

  // JWT qui *contient* la position `pos` dans `text` (cas du double-clic qui
  // ne sélectionne qu'un segment, car "." et "-" coupent le mot)
  function findAround(text, pos) {
    if (!text || typeof text !== "string" || typeof pos !== "number") return null;
    // un token valide contenant `pos` tient forcément dans [pos - MAX_TOKEN, pos + MAX_TOKEN]
    const from = Math.max(0, pos - MAX_TOKEN);
    const win = text.slice(from, pos + MAX_TOKEN);
    for (const m of win.matchAll(JWT_FIND)) {
      const start = from + m.index, end = start + m[0].length;
      if (start <= pos && pos <= end && isValid(m[0])) return { token: m[0], start, end };
    }
    return null;
  }

  return { MAX_TOKEN, parse, findIn, findAround };
})();
