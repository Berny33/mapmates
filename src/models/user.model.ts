import { pool } from '../config/db.js';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export interface UserWithHash extends PublicUser {
  password_hash: string;
}

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

export type UserModel = typeof userModel;
