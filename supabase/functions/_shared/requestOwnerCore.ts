// Pure owner-resolution rules (unit-tested from src/lib/improvement).
// The owner of a new record comes only from a bearer token validated by the
// auth server — never from request data.
//   no bearer, or the public anon/publishable key  -> guest (legitimate)
//   a user-shaped token that validates             -> user id
//   a user-shaped token that fails validation      -> invalid (refuse; never
//                                                      silently fall back to guest)

export type OwnerResolution = { kind: "guest" } | { kind: "user"; id: string } | { kind: "invalid" };

const b64 = (s: string) => {
  try {
    const p = s.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p + "=".repeat((4 - (p.length % 4)) % 4)));
  } catch {
    return null;
  }
};

/** Role claim of a JWT without trusting it (only used to recognise the public key). */
export const unverifiedRole = (token: string): string | null => {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const claims = b64(parts[1]);
  return claims && typeof claims.role === "string" ? claims.role : null;
};

export const resolveOwnerWith = async (
  authorization: string | null,
  publicKeys: string[],
  validate: (token: string) => Promise<string | null>,
): Promise<OwnerResolution> => {
  if (!authorization || !/^bearer\s+/i.test(authorization)) return { kind: "guest" };
  const token = authorization.replace(/^bearer\s+/i, "").trim();
  if (!token) return { kind: "guest" };
  if (publicKeys.includes(token) || token.startsWith("sb_publishable_")) return { kind: "guest" };
  if (unverifiedRole(token) === "anon") return { kind: "guest" };
  let id: string | null = null;
  try {
    id = await validate(token);
  } catch {
    id = null;
  }
  return id ? { kind: "user", id } : { kind: "invalid" };
};
