import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// Signs an opaque value for storage in a cookie, so the transaction id
// itself can't be forged/guessed client-side even though the cookie is
// otherwise just a plain string. Format: "<value>.<hmac>".
export function signValue(value: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${mac}`;
}

export function verifySignedValue(signed: string, secret: string): string | null {
  const dot = signed.lastIndexOf(".");
  if (dot === -1) return null;

  const value = signed.slice(0, dot);
  const mac = signed.slice(dot + 1);
  const expectedMac = createHmac("sha256", secret).update(value).digest("base64url");

  const macBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expectedMac);
  if (macBuf.length !== expectedBuf.length || !timingSafeEqual(macBuf, expectedBuf)) {
    return null;
  }

  return value;
}
