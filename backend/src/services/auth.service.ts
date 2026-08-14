import bcrypt from 'bcryptjs';
import { userRepository } from '../repositories/user.repository';
import { signToken } from '../utils/jwt';

const SALT_ROUNDS = 10;

export class AuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
  }
}

export const authService = {
  async register(email: string, password: string) {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AuthError('An account with this email already exists.', 409);
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await userRepository.create(email, passwordHash);
    const accessToken = signToken({ userId: user.id, email: user.email });
    return { user: { id: user.id, email: user.email }, accessToken };
  },

  async login(email: string, password: string) {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new AuthError('Invalid email or password.');
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new AuthError('Invalid email or password.');
    }
    const accessToken = signToken({ userId: user.id, email: user.email });
    return { user: { id: user.id, email: user.email }, accessToken };
  },
};
