// Lecture du JWT sélectionné : champ de saisie actif, puis texte de la page.
// Retourne { token, rect } ou null.
const TokenSelection = (() => {
  function fromField() {
    const el = document.activeElement;
    if (!el || (el.tagName !== "TEXTAREA" && el.tagName !== "INPUT")) return null;
    try {
      const { value, selectionStart: a, selectionEnd: b } = el;
      if (a === b) return null;
      const token = Jwt.findIn(value.substring(a, b)) || Jwt.findAround(value, a)?.token;
      return token ? { token, rect: el.getBoundingClientRect() } : null;
    } catch (_) {
      return null; // types d'input sans selectionStart
    }
  }

  function fromPage() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const token = Jwt.findIn(sel.toString());
    if (token) return { token, rect: sel.getRangeAt(0).getBoundingClientRect() };
    return expandPartial(sel);
  }

  // sélection partielle : on élargit au token entier dans le nœud texte
  function expandPartial(sel) {
    const node = sel.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    const hit = Jwt.findAround(node.textContent, sel.anchorOffset);
    if (!hit) return null;
    const r = document.createRange();
    r.setStart(node, hit.start);
    r.setEnd(node, hit.end);
    sel.removeAllRanges();
    sel.addRange(r); // on surligne visuellement le token complet
    return { token: hit.token, rect: r.getBoundingClientRect() };
  }

  function get() {
    return fromField() || fromPage();
  }

  return { get };
})();
