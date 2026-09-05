import { describe, it, expect } from "vitest";
import { signSessionToken, verifySessionToken } from "@/lib/auth/jwt";

const SECRET = "test-secret-that-is-definitely-long-enough-32";
const OTHER_SECRET = "another-secret-that-is-also-long-enough-32ch";

describe("Oturum jetonu (HS256 / Web Crypto)", () => {
  it("imzaladığı jetonu doğrular", async () => {
    const token = await signSessionToken(
      { userId: "u1", email: "a@b.com", name: "Test" },
      SECRET
    );
    const payload = await verifySessionToken(token, SECRET);

    expect(payload).toEqual({ userId: "u1", email: "a@b.com", name: "Test" });
  });

  it("başka bir anahtarla imzalanmış jetonu reddeder", async () => {
    const token = await signSessionToken({ userId: "u1", email: "a@b.com" }, OTHER_SECRET);
    expect(await verifySessionToken(token, SECRET)).toBeNull();
  });

  it("içeriği değiştirilmiş jetonu reddeder", async () => {
    const token = await signSessionToken({ userId: "u1", email: "a@b.com" }, SECRET);
    const [header, , signature] = token.split(".");

    const forgedBody = Buffer.from(
      JSON.stringify({
        userId: "admin",
        email: "admin@b.com",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    )
      .toString("base64url");

    expect(await verifySessionToken(`${header}.${forgedBody}.${signature}`, SECRET)).toBeNull();
  });

  it("alg:none saldırısını reddeder", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({ userId: "admin", email: "a@b.com", exp: Date.now() / 1000 + 999 })
    ).toString("base64url");

    expect(await verifySessionToken(`${header}.${body}.`, SECRET)).toBeNull();
  });

  it("süresi dolmuş jetonu reddeder", async () => {
    const token = await signSessionToken({ userId: "u1", email: "a@b.com" }, SECRET, -10);
    expect(await verifySessionToken(token, SECRET)).toBeNull();
  });

  it("REGRESYON: rastgele bir çerez değeri oturum sayılmaz", async () => {
    // Middleware eskiden yalnızca çerezin var olup olmadığına bakıyordu.
    expect(await verifySessionToken("uydurma-deger", SECRET)).toBeNull();
    expect(await verifySessionToken("a.b.c", SECRET)).toBeNull();
    expect(await verifySessionToken("", SECRET)).toBeNull();
    expect(await verifySessionToken(undefined, SECRET)).toBeNull();
  });
});
