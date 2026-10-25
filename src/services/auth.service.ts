import bcrypt from 'bcryptjs';
import type { PublicUser, UserModel } from '../models/user.model.js';
import type { RegisterInput } from '../validators/auth.validators.js';
import { AppError } from '../utils/AppError.js';
import { isUniqueViolation } from '../utils/dbErrors.js';

const bcryptRounds = Number(process.env.BCRYPT_ROUNDS) || 12;

interface AuthServiceDependencies {
  userModel: Pick<UserModel, 'create'>;
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
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
