import { pool } from '../config/db.js';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
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
};

export type UserModel = typeof userModel;
