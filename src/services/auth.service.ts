import bcrypt from 'bcryptjs';
import type { PublicUser, UserModel } from '../models/user.model.js';
import type {
  LoginInput,
  RegisterInput,
} from '../validators/auth.validators.js';
import { AppError } from '../utils/AppError.js';
import { isUniqueViolation } from '../utils/dbErrors.js';

const bcryptRounds = Number(process.env.BCRYPT_ROUNDS) || 12;

interface AuthServiceDependencies {
  userModel: Pick<UserModel, 'create' | 'findByEmail' | 'findById'>;
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
        // Compare against a dummy hash so an unknown email takes as long as
        // a wrong password and cannot be detected by measuring response time.
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
