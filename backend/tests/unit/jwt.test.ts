import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from '../../src/utils/jwt';

describe('jwt sign/verify', () => {
  it('round-trips a payload', () => {
    const token = signToken({ userId: 'abc-123', email: 'a@b.com' });
    const payload = verifyToken(token);
    expect(payload.userId).toBe('abc-123');
    expect(payload.email).toBe('a@b.com');
  });

  it('throws on a tampered token', () => {
    const token = signToken({ userId: 'abc-123', email: 'a@b.com' });
    const tampered = token.slice(0, -2) + 'xx';
    expect(() => verifyToken(tampered)).toThrow();
  });
});
