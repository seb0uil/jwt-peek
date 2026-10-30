// JWT Peek — décodage 100 % local. Aucun fetch, aucun storage, aucune permission.
(() => {
  const TIME_CLAIMS = ["exp", "nbf", "iat", "auth_time", "updated_at"];
  const MAX_TOKEN = 20000; // au-delà, on ignore
  const MAX_SCAN = 100000; // taille max de texte analysé (évite de scanner une page entière après Ctrl+A)
  const NAV_KEYS = /^(Arrow(Left|Right|Up|Down)|Home|End|PageUp|PageDown)$/;
  let host = null;
  let lastToken = null;

  // ---------- décodage ----------
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
    return {
      header,
      payload,
      sig: sig || "",
    };
  }

  // Cherche un JWT *dans* un texte (ex. "Authorization: Bearer eyJ..." ou un JSON entier)
  const JWT_FIND = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;

  function findIn(text) {
    if (!text || typeof text !== "string" || text.length > MAX_SCAN) return null;
    for (const src of [text, text.replace(/\s+/g, "")]) {
      for (const m of src.matchAll(JWT_FIND)) {
        try { parse(m[0]); return m[0]; } catch (_) { /* faux positif, on continue */ }
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
      if (start <= pos && pos <= end) {
        try { parse(m[0]); return { token: m[0], start, end }; }
        catch (_) { /* ignore */ }
      }
    }
    return null;
  }

  // ---------- sélection (texte de page + input/textarea) ----------
  function getToken() {
    // 1) input / textarea
    const el = document.activeElement;
    if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
      try {
        const { value, selectionStart: a, selectionEnd: b } = el;
        if (a !== b) {
          const tok = findIn(value.substring(a, b)) || findAround(value, a)?.token;
          if (tok) return { token: tok, rect: el.getBoundingClientRect() };
        }
      } catch (_) { /* types d'input sans selectionStart */ }
    }

    // 2) texte de la page
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const tok = findIn(sel.toString());
    if (tok) return { token: tok, rect: range.getBoundingClientRect() };

    // 3) sélection partielle : on élargit au token entier dans le nœud texte
    const node = sel.anchorNode;
    if (node && node.nodeType === Node.TEXT_NODE) {
      const hit = findAround(node.textContent, sel.anchorOffset);
      if (hit) {
        const r = document.createRange();
        r.setStart(node, hit.start);
        r.setEnd(node, hit.end);
        sel.removeAllRanges();
        sel.addRange(r); // on surligne visuellement le token complet
        return { token: hit.token, rect: r.getBoundingClientRect() };
      }
    }
    return null;
  }

  // ---------- helpers d'affichage ----------
  function toSec(v) {
    return typeof v === "number" ? (v > 1e11 ? v / 1000 : v) : null;
  }

  function dur(a) {
    return a < 60 ? `${Math.round(a)} s`
      : a < 3600 ? `${Math.round(a / 60)} min`
      : a < 86400 ? `${(a / 3600).toFixed(1)} h`
      : `${(a / 86400).toFixed(1)} j`;
  }

  function rel(sec) {
    const d = sec - Date.now() / 1000;
    const s = dur(Math.abs(d));
    return d >= 0 ? `dans ${s}` : `il y a ${s}`;
  }

  function status(p) {
    const now = Date.now() / 1000;
    const nbf = toSec(p?.nbf);
    const exp = toSec(p?.exp);
    if (nbf != null && now < nbf) return ["pas encore valide", "warn"];
    if (exp != null) return now >= exp ? ["expiré", "bad"] : ["non expiré", "ok"];
    return ["sans exp", "warn"];
  }

  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text; // jamais innerHTML : le contenu du token est non fiable
    return e;
  }

  const CSS = `
    :host { all: initial; }
    .card { box-sizing: border-box; width: min(480px, calc(100vw - 16px)); max-height: 70vh;
      overflow: auto; background: #1b1d23; color: #e6e6e6; border: 1px solid #3a3d46;
      border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,.45);
      font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .bar { position: sticky; top: 0; display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; background: #23262e; border-bottom: 1px solid #3a3d46; }
    .title { font-weight: 600; }
    .meta { color: #9aa0ab; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
    .sp { flex: 1; }
    .badge { padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .ok { background: #1f4d2e; color: #7ee2a0; }
    .bad { background: #5a1f24; color: #ff9aa2; }
    .warn { background: #54441a; color: #ffd27a; }
    button { all: unset; cursor: pointer; padding: 2px 8px; border-radius: 6px; color: #c9ced8; }
    button:hover { background: #343844; }
    section { padding: 8px 10px; }
    h4 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #8b93a1; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-all;
      font: 12px/1.45 ui-monospace, Menlo, Consolas, monospace; color: #e6e6e6; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; color: #e6e6e6; }
    td { padding: 2px 6px 2px 0; vertical-align: top; }
    td:first-child { font-family: ui-monospace, Menlo, monospace; color: #8fb8ff; width: 1%; white-space: nowrap; }
    .rel { color: #9aa0ab; }
    .foot { padding: 6px 10px 8px; color: #7d8492; font-size: 11px; border-top: 1px solid #2d3038; }
  `;

  // ---------- popup ----------
  function close() {
    if (host) host.remove();
    host = null;
    lastToken = null;
  }

  function show(token, rect) {
    let data;
    try { data = parse(token); } catch (_) { return; }
    close();
    lastToken = token;

    host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:0;left:0;";
    const root = host.attachShadow({ mode: "closed" });
    root.appendChild(h("style", null, CSS));

    const card = h("div", "card");
    const { header, payload, sig } = data;
    const [label, cls] = status(payload);

    // barre
    const bar = h("div", "bar");
    bar.append(
      h("span", "title", "JWT"),
      h("span", `badge ${cls}`, label),
      h("span", "meta", [header.alg, header.kid && `kid=${String(header.kid).slice(0, 12)}`].filter(Boolean).join(" · ")),
      h("span", "sp")
    );
    const copyBtn = h("button", null, "Copier payload");
    copyBtn.onclick = () => {
      const text = JSON.stringify(payload, null, 2);
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(
          () => (copyBtn.textContent = "Copié ✓"),
          () => (copyBtn.textContent = "Échec copie")
        );
      } else {
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.cssText = "position:fixed;opacity:0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          copyBtn.textContent = "Copié ✓";
        } catch (_) {
          copyBtn.textContent = "Échec copie";
        }
      }
    };
    const closeBtn = h("button", null, "✕");
    closeBtn.onclick = close;
    bar.append(copyBtn, closeBtn);
    card.append(bar);

    // dates
    const times = TIME_CLAIMS.filter((k) => typeof payload[k] === "number");
    if (times.length) {
      const sec = h("section");
      sec.append(h("h4", null, "Dates"));
      const tbl = h("table");
      for (const k of times) {
        const tr = h("tr");
        const s = toSec(payload[k]);
        const td = h("td");
        td.append(
          document.createTextNode(new Date(s * 1000).toLocaleString("fr-FR") + "  "),
          h("span", "rel", `(${rel(s)})`)
        );
        tr.append(h("td", null, k), td);
        tbl.append(tr);
      }
      const expSec = toSec(payload.exp);
      const iatSec = toSec(payload.iat);
      if (expSec != null && iatSec != null) {
        const ttl = expSec - iatSec;
        const tr = h("tr");
        tr.append(h("td", null, "ttl"), h("td", null, (ttl < 0 ? "-" : "") + dur(Math.abs(ttl))));
        tbl.append(tr);
      }
      sec.append(tbl);
      card.append(sec);
    }

    for (const [title, obj] of [["Header", header], ["Payload", payload]]) {
      const sec = h("section");
      sec.append(h("h4", null, title), h("pre", null, JSON.stringify(obj, null, 2)));
      card.append(sec);
    }

    card.append(
      h("div", "foot", `Décodé localement · signature non vérifiée${sig ? "" : " · ⚠ aucune signature"}`)
    );
    root.append(card);
    document.documentElement.appendChild(host);

    // positionnement sous la sélection, sinon au-dessus, borné au viewport
    const w = card.offsetWidth, hgt = card.offsetHeight;
    let top = rect.bottom + 8;
    if (top + hgt > innerHeight - 8) top = Math.max(8, rect.top - hgt - 8);
    const left = Math.max(8, Math.min(rect.left, innerWidth - w - 8));
    host.style.top = `${top}px`;
    host.style.left = `${left}px`;
  }

  function check() {
    const s = getToken();
    if (!s || s.token.length > MAX_TOKEN || s.token === lastToken) return;
    show(s.token, s.rect);
  }

  // ---------- événements (phase de capture : certaines apps bloquent la propagation) ----------
  const inside = (e) => host && e.composedPath().includes(host);
  window.addEventListener("mousedown", (e) => { if (host && !inside(e)) close(); }, true);
  window.addEventListener("mouseup", (e) => { if (!inside(e)) setTimeout(check, 10); }, true);
  window.addEventListener("scroll", (e) => { if (host && !inside(e)) close(); }, { capture: true, passive: true });
  window.addEventListener("resize", () => { if (host) close(); }, { passive: true });
  window.addEventListener("keyup", (e) => {
    if (e.key === "Escape") close();
    else if ((e.shiftKey && NAV_KEYS.test(e.key)) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a")) {
      setTimeout(check, 10); // sélection clavier / Ctrl+A ou Cmd+A
    }
  }, true);
})();
