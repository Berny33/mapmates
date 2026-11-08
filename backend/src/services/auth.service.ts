import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import type { PublicUser, UserWithHash } from '../models/user.model.js';
import type {
  LoginInput,
  RegisterInput,
} from '../validators/auth.validators.js';
import { AppError } from '../utils/AppError.js';
import { isUniqueViolation } from '../utils/dbErrors.js';

const bcryptRounds = Number(process.env.BCRYPT_ROUNDS) || 12;

export const userModel = {
  async create(
    name: string,
    email: string,
    passwordHash: string,
  ): Promise<PublicUser> {
    const { rows } = await pool.query<PublicUser>(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, passwordHash],
    );

    return rows[0];
  },

  async findByEmail(email: string): Promise<UserWithHash | undefined> {
    const { rows } = await pool.query<UserWithHash>(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email],
    );

    return rows[0];
  },

  async findById(id: string): Promise<PublicUser | undefined> {
    const { rows } = await pool.query<PublicUser>(
      'SELECT id, name, email FROM users WHERE id = $1',
      [id],
    );

    return rows[0];
  },
};

interface AuthServiceDependencies {
  userModel: Pick<typeof userModel, 'create' | 'findByEmail' | 'findById'>;
}

let dummyHash: Promise<string> | undefined;

function getDummyHash(): Promise<string> {
  dummyHash ??= bcrypt.hash('not-a-real-password', bcryptRounds);
  return dummyHash;
}

function invalidCredentials(): AppError {
  return new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
}

export function createAuthService({ userModel }: AuthServiceDependencies) {
  return {
    async register(input: RegisterInput): Promise<PublicUser> {
      const passwordHash = await bcrypt.hash(input.password, bcryptRounds);

      try {
        return await userModel.create(input.name, input.email, passwordHash);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError(
            409,
            'EMAIL_ALREADY_REGISTERED',
            'An account with this email already exists',
          );
        }
        throw error;
      }
    },

    async login(input: LoginInput): Promise<PublicUser> {
      const user = await userModel.findByEmail(input.email);

      if (!user) {
        await bcrypt.compare(input.password, await getDummyHash());
        throw invalidCredentials();
      }

      const matches = await bcrypt.compare(input.password, user.password_hash);

      if (!matches) {
        throw invalidCredentials();
      }

      return { id: user.id, name: user.name, email: user.email };
    },

    async getCurrentUser(userId: string): Promise<PublicUser> {
      const user = await userModel.findById(userId);

      if (!user) {
        throw new AppError(401, 'UNAUTHENTICATED', 'Log in required');
      }

      return user;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
