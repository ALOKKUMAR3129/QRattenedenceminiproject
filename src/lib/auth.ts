import type { User } from './types';

const USERS_KEY = 'qr-att-user';

const MOCK_USERS: Record<string, { password: string; user: User }> = {
  'student@college.edu': {
    password: 'student123',
    user: { email: 'student@college.edu', name: 'Alex Johnson', role: 'student' },
  },
  'teacher@college.edu': {
    password: 'teacher123',
    user: { email: 'teacher@college.edu', name: 'Prof. Sarah Lee', role: 'teacher' },
  },
};

export function login(email: string, password: string): User | null {
  const entry = MOCK_USERS[email.toLowerCase()];
  if (entry && entry.password === password) {
    localStorage.setItem(USERS_KEY, JSON.stringify(entry.user));
    return entry.user;
  }
  return null;
}

export function logout(): void {
  localStorage.removeItem(USERS_KEY);
}

export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}
