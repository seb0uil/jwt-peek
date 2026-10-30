// Formatage des claims temporels et du statut d'expiration.
const Fmt = (() => {
  const TIME_CLAIMS = ["exp", "nbf", "iat", "auth_time", "updated_at"];

  // secondes epoch ; un timestamp > 1e11 est supposé en millisecondes
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

  function date(sec) {
    return new Date(sec * 1000).toLocaleString("fr-FR");
  }

  // [libellé, classe CSS du badge]
  function status(p) {
    const now = Date.now() / 1000;
    const nbf = toSec(p?.nbf);
    const exp = toSec(p?.exp);
    if (nbf != null && now < nbf) return ["pas encore valide", "warn"];
    if (exp != null) return now >= exp ? ["expiré", "bad"] : ["non expiré", "ok"];
    return ["sans exp", "warn"];
  }

  // durée de vie exp - iat, ou null si l'un des deux manque
  function ttl(p) {
    const exp = toSec(p?.exp), iat = toSec(p?.iat);
    if (exp == null || iat == null) return null;
    const t = exp - iat;
    return (t < 0 ? "-" : "") + dur(Math.abs(t));
  }

  return { TIME_CLAIMS, toSec, rel, date, status, ttl };
})();
