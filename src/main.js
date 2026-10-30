// JWT Peek — décodage 100 % local. Aucun fetch, aucun storage, aucune permission d'API.
// Point d'entrée : branche les événements. Chargé en dernier (voir manifest.json).
(() => {
  const NAV_KEYS = /^(Arrow(Left|Right|Up|Down)|Home|End|PageUp|PageDown)$/;

  function check() {
    const s = TokenSelection.get();
    if (!s || s.token.length > Jwt.MAX_TOKEN || Card.isShowing(s.token)) return;
    Card.show(s.token, s.rect);
  }

  const checkSoon = () => setTimeout(check, 10); // laisse le navigateur finaliser la sélection
  const closeIfOutside = (e) => { if (Card.isOpen() && !Card.contains(e)) Card.close(); };

  // phase de capture : certaines apps bloquent la propagation
  window.addEventListener("mousedown", closeIfOutside, true);
  window.addEventListener("mouseup", (e) => { if (!Card.contains(e)) checkSoon(); }, true);
  window.addEventListener("scroll", closeIfOutside, { capture: true, passive: true });
  window.addEventListener("resize", () => Card.close(), { passive: true });
  window.addEventListener("keyup", (e) => {
    if (e.key === "Escape") Card.close();
    else if ((e.shiftKey && NAV_KEYS.test(e.key)) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a")) {
      checkSoon(); // sélection clavier / Ctrl+A ou Cmd+A
    }
  }, true);
})();
