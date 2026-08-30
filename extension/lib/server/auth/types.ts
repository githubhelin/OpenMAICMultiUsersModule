export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  email?: string | null;
  password_hash: string;
  salt: string;
  nickname: string;
  avatar: string;
  bio?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export type SafeUser = Omit<User, 'password_hash' | 'salt'>;

export interface AuthSessionPayload {
  userId: string;
  username: string;
  role: UserRole;
  nickname: string;
  avatar: string;
  exp: number;
}
