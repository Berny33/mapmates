export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export interface UserWithHash extends PublicUser {
  password_hash: string;
}
