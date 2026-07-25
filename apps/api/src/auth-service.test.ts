import { describe, expect, it } from "vitest";
import { AuthService } from "./auth-service.js";

describe("AuthService", () => {
  it("authenticates seeded users and resolves bearer sessions", async () => {
    const auth = await AuthService.createDemo();
    const session = await auth.login("demo@loomoon.local", "loomoon-demo");

    expect(session.accessToken).toHaveLength(64);
    expect(auth.authenticate(session.accessToken)).toMatchObject({
      email: "demo@loomoon.local"
    });
  });

  it("uses a generic error for unknown users and incorrect passwords", async () => {
    const auth = await AuthService.createDemo();
    await expect(auth.login("missing@loomoon.local", "wrong")).rejects.toThrow("INVALID_CREDENTIALS");
    await expect(auth.login("demo@loomoon.local", "wrong")).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("invalidates an access token on logout", async () => {
    const auth = await AuthService.createDemo();
    const session = await auth.login("reviewer@loomoon.local", "loomoon-review");
    auth.logout(session.accessToken);
    expect(auth.authenticate(session.accessToken)).toBeUndefined();
  });
});
