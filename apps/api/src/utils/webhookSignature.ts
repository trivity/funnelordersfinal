import { createHmac, timingSafeEqual } from 'crypto';

export function verifyHmacSha256(rawBody: Buffer, signature: string, secret: string): boolean {
  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const sigBuf = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
    if (expectedBuf.length !== sigBuf.length) return false;
    return timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}
