export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: number;
};

const USERS_KEY = "imagingpedia_users";
const CURRENT_KEY = "imagingpedia_current_user_email";

function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as User[]) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: User[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function simpleHash(input: string): string {
  // Lightweight deterministic hash (not secure; for demo only)
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /.+@.+\..+/.test(email);
}

export function isAuthenticated(): boolean {
  const email = localStorage.getItem(CURRENT_KEY);
  if (!email) return false;
  const users = loadUsers();
  return users.some((u) => u.email === email);
}

export function getCurrentUser(): User | null {
  const email = localStorage.getItem(CURRENT_KEY);
  if (!email) return null;
  const users = loadUsers();
  return users.find((u) => u.email === email) || null;
}

export function logout() {
  localStorage.removeItem(CURRENT_KEY);
}

export function signUp(name: string, email: string, password: string): { ok: true; user: User } | { ok: false; error: string } {
  const nEmail = normalizeEmail(email);
  if (!name.trim()) return { ok: false, error: "Name is required" };
  if (!isValidEmail(nEmail)) return { ok: false, error: "Invalid email" };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters" };

  const users = loadUsers();
  if (users.some((u) => u.email === nEmail)) {
    return { ok: false, error: "Email already registered" };
  }

  const salt = "imagingpedia_salt";
  const newUser: User = {
    id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name: name.trim(),
    email: nEmail,
    passwordHash: simpleHash(password + salt),
    createdAt: Date.now(),
  };

  users.push(newUser);
  saveUsers(users);
  localStorage.setItem(CURRENT_KEY, nEmail);
  return { ok: true, user: newUser };
}

export function login(email: string, password: string): { ok: true; user: User } | { ok: false; error: string } {
  const nEmail = normalizeEmail(email);
  const users = loadUsers();
  const user = users.find((u) => u.email === nEmail);
  if (!user) return { ok: false, error: "Account not found" };

  const salt = "imagingpedia_salt";
  const hash = simpleHash(password + salt);
  if (user.passwordHash !== hash) return { ok: false, error: "Incorrect password" };

  localStorage.setItem(CURRENT_KEY, nEmail);
  return { ok: true, user };
}
