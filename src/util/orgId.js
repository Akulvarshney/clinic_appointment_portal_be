/** UUID v4 pattern for organization ids (Postgres uuid). */
const ORG_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Reject missing, empty, literal "null"/"undefined", and non-UUID strings so Prisma
 * never receives invalid UUIDs (avoids P2023 from query params like orgId=null).
 */
export function normalizeOrgId(raw) {
  if (raw === undefined || raw === null) {
    return { ok: false, orgId: null };
  }
  const s = String(raw).trim();
  if (
    !s ||
    s.toLowerCase() === "null" ||
    s.toLowerCase() === "undefined"
  ) {
    return { ok: false, orgId: null };
  }
  if (!ORG_UUID_RE.test(s)) {
    return { ok: false, orgId: null };
  }
  return { ok: true, orgId: s };
}
