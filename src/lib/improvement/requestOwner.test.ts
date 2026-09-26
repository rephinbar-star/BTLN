import { describe, expect, it } from "vitest";
import { resolveOwnerWith } from "../../../supabase/functions/_shared/requestOwnerCore";

const enc = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
const jwt = (claims: object) => `${enc({ alg: "HS256" })}.${enc(claims)}.sig`;
const ANON = jwt({ role: "anon" });
const good = jwt({ role: "authenticated", sub: "u1" });
const validate = async (t: string) => (t === good ? "u1" : null);

describe("resolveOwnerWith", () => {
  it("no bearer is a legitimate guest", async () => {
    expect(await resolveOwnerWith(null, [ANON], validate)).toEqual({ kind: "guest" });
  });
  it("public anon key is a guest", async () => {
    expect(await resolveOwnerWith(`Bearer ${ANON}`, [ANON], validate)).toEqual({ kind: "guest" });
    expect(await resolveOwnerWith("Bearer sb_publishable_x", [], validate)).toEqual({ kind: "guest" });
  });
  it("validated token yields the verified owner", async () => {
    expect(await resolveOwnerWith(`Bearer ${good}`, [ANON], validate)).toEqual({ kind: "user", id: "u1" });
  });
  it("forged or expired token is refused, never downgraded to guest", async () => {
    expect(await resolveOwnerWith(`Bearer ${jwt({ role: "authenticated", sub: "u2" })}`, [ANON], validate)).toEqual({ kind: "invalid" });
    expect(await resolveOwnerWith("Bearer garbage", [ANON], validate)).toEqual({ kind: "invalid" });
    expect(await resolveOwnerWith(`Bearer ${good}`, [ANON], async () => { throw new Error("down"); })).toEqual({ kind: "invalid" });
  });
});
