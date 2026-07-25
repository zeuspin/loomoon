import { randomBytes } from "node:crypto";
import argon2 from "argon2";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

interface StoredUser extends AuthUser {
  passwordHash: string;
}

interface AuthSession {
  accessToken: string;
  user: AuthUser;
  expiresAt: string;
}

export class AuthService {
  readonly #sessions = new Map<string, { userId: string; expiresAt: number }>();

  private constructor(private readonly users: StoredUser[]) {}

  static async createDemo(): Promise<AuthService> {
    const [demoHash, reviewerHash] = await Promise.all([
      argon2.hash("loomoon-demo", { type: argon2.argon2id }),
      argon2.hash("loomoon-review", { type: argon2.argon2id })
    ]);
    return new AuthService([
      {
        id: "user-demo",
        email: "demo@loomoon.local",
        displayName: "Demo Creator",
        passwordHash: demoHash
      },
      {
        id: "user-reviewer",
        email: "reviewer@loomoon.local",
        displayName: "Review User",
        passwordHash: reviewerHash
      }
    ]);
  }

  async login(email: string, password: string): Promise<AuthSession> {
    const user = this.users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase());
    const valid = user ? await argon2.verify(user.passwordHash, password) : false;
    if (!user || !valid) throw new Error("INVALID_CREDENTIALS");
    const accessToken = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
    this.#sessions.set(accessToken, { userId: user.id, expiresAt });
    return {
      accessToken,
      user: publicUser(user),
      expiresAt: new Date(expiresAt).toISOString()
    };
  }

  authenticate(accessToken: string): AuthUser | undefined {
    const session = this.#sessions.get(accessToken);
    if (!session || session.expiresAt <= Date.now()) {
      if (session) this.#sessions.delete(accessToken);
      return undefined;
    }
    const user = this.users.find((item) => item.id === session.userId);
    return user ? publicUser(user) : undefined;
  }

  logout(accessToken: string): void {
    this.#sessions.delete(accessToken);
  }
}

function publicUser(user: StoredUser): AuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName };
}
