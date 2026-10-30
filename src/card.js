// Carte affichant le JWT décodé, isolée de la page dans un Shadow DOM fermé.
const Card = (() => {
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

  let host = null;
  let token = null;

  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text; // jamais innerHTML : le contenu du token est non fiable
    return e;
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  function button(label, onclick) {
    const b = h("button", null, label);
    b.onclick = onclick;
    return b;
  }

  function bar({ header, payload }) {
    const [label, cls] = Fmt.status(payload);
    const meta = [header.alg, header.kid && `kid=${String(header.kid).slice(0, 12)}`].filter(Boolean).join(" · ");
    const copyBtn = button("Copier payload", () => {
      copyText(JSON.stringify(payload, null, 2)).then(
        () => (copyBtn.textContent = "Copié ✓"),
        () => (copyBtn.textContent = "Échec copie")
      );
    });
    const el = h("div", "bar");
    el.append(
      h("span", "title", "JWT"),
      h("span", `badge ${cls}`, label),
      h("span", "meta", meta),
      h("span", "sp"),
      copyBtn,
      button("✕", close)
    );
    return el;
  }

  function row(key, ...cells) {
    const tr = h("tr");
    const td = h("td");
    td.append(...cells);
    tr.append(h("td", null, key), td);
    return tr;
  }

  function dates(payload) {
    const keys = Fmt.TIME_CLAIMS.filter((k) => typeof payload[k] === "number");
    if (!keys.length) return null;
    const tbl = h("table");
    for (const k of keys) {
      const s = Fmt.toSec(payload[k]);
      tbl.append(row(k, document.createTextNode(Fmt.date(s) + "  "), h("span", "rel", `(${Fmt.rel(s)})`)));
    }
    const ttl = Fmt.ttl(payload);
    if (ttl) tbl.append(row("ttl", ttl));
    const sec = h("section");
    sec.append(h("h4", null, "Dates"), tbl);
    return sec;
  }

  function json(title, obj) {
    const sec = h("section");
    sec.append(h("h4", null, title), h("pre", null, JSON.stringify(obj, null, 2)));
    return sec;
  }

  function render(data) {
    const card = h("div", "card");
    card.append(
      ...[
        bar(data),
        dates(data.payload),
        json("Header", data.header),
        json("Payload", data.payload),
        h("div", "foot", `Décodé localement · signature non vérifiée${data.sig ? "" : " · ⚠ aucune signature"}`),
      ].filter(Boolean)
    );
    return card;
  }

  // sous la sélection, sinon au-dessus, borné au viewport
  function place(card, rect) {
    const w = card.offsetWidth, hgt = card.offsetHeight;
    let top = rect.bottom + 8;
    if (top + hgt > innerHeight - 8) top = Math.max(8, rect.top - hgt - 8);
    const left = Math.max(8, Math.min(rect.left, innerWidth - w - 8));
    host.style.top = `${top}px`;
    host.style.left = `${left}px`;
  }

  function show(tok, rect) {
    let data;
    try { data = Jwt.parse(tok); } catch (_) { return; }
    close();
    token = tok;

    host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;z-index:2147483647;top:0;left:0;";
    const root = host.attachShadow({ mode: "closed" });
    const card = render(data);
    root.append(h("style", null, CSS), card);
    document.documentElement.appendChild(host);
    place(card, rect);
    log(data);
  }

  // niveau "Verbose" de la console : masqué par défaut dans DevTools
  function log({ header, payload, sig }) {
    console.groupCollapsed(`[JWT Peek] ${header.alg || "?"} · ${Fmt.status(payload)[0]}`);
    console.debug("header", header);
    console.debug("payload", payload);
    console.debug("signature", sig || "(aucune)");
    console.groupEnd();
  }

  function close() {
    if (host) host.remove();
    host = null;
    token = null;
  }

  const isOpen = () => host != null;
  const isShowing = (tok) => tok === token;
  const contains = (e) => host != null && e.composedPath().includes(host);

  return { show, close, isOpen, isShowing, contains };
})();
