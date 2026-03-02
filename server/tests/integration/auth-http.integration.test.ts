import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { roleFixtures, unverifiedSubscriberFixture } from "../fixtures/users";

const { mockDb, mockAuthHandlers } = vi.hoisted(() => ({
  mockDb: {
    upsertUser: vi.fn(),
    getUserByOpenId: vi.fn(),
    getUserByEmail: vi.fn(),
    createDiscountCodeForEmployee: vi.fn(),
  },
  mockAuthHandlers: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    refreshSession: vi.fn(),
  },
}));

vi.mock("../../db", () => mockDb);
vi.mock("../../email", () => ({
  sendVerificationEmail: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  sendEmployeeWelcomeEmail: vi.fn(),
  sendAttorneyWelcomeEmail: vi.fn(),
}));
vi.mock("../../_core/cookies", () => ({
  getSessionCookieOptions: vi.fn(() => ({ httpOnly: true, secure: true, sameSite: "lax" })),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      signUp: mockAuthHandlers.signUp,
      signInWithPassword: mockAuthHandlers.signInWithPassword,
      refreshSession: mockAuthHandlers.refreshSession,
      admin: { signOut: vi.fn() },
      getUser: vi.fn(),
    },
  })),
}));

async function startTestServer() {
  const { registerSupabaseAuthRoutes } = await import("../../supabaseAuth");
  const app = express();
  app.use(express.json());
  registerSupabaseAuthRoutes(app);

  const server = await new Promise<import("node:http").Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not bind ephemeral test port");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

describe("Supabase auth HTTP integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.getUserByEmail.mockResolvedValue(null);
    mockDb.getUserByOpenId.mockResolvedValue(roleFixtures.subscriber);
    mockDb.upsertUser.mockResolvedValue(undefined);
    mockAuthHandlers.signUp.mockResolvedValue({
      data: {
        user: {
          id: "supabase-user-1",
          email: roleFixtures.subscriber.email,
        },
      },
      error: null,
    });
    mockAuthHandlers.signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: "supabase-user-1",
          email: roleFixtures.subscriber.email,
          user_metadata: { name: roleFixtures.subscriber.name },
          app_metadata: { provider: "email" },
        },
        session: {
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
        },
      },
      error: null,
    });
    mockAuthHandlers.refreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
        },
      },
      error: null,
    });
  });

  it("supports signup/login/refresh happy path", async () => {
    const { server, baseUrl } = await startTestServer();

    try {
      const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: roleFixtures.subscriber.email,
          password: "correct-horse-battery-staple",
          name: roleFixtures.subscriber.name,
          role: "subscriber",
        }),
      });
      expect(signupRes.status).toBe(201);

      const signupPayload = await signupRes.json();
      expect(signupPayload.success).toBe(true);

      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: roleFixtures.subscriber.email,
          password: "correct-horse-battery-staple",
        }),
      });
      expect(loginRes.status).toBe(200);
      const setCookie = loginRes.headers.get("set-cookie");
      expect(setCookie).toContain("sb_session=");

      const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: "POST",
        headers: {
          cookie: setCookie ?? "",
        },
      });
      expect(refreshRes.status).toBe(200);
      const refreshPayload = await refreshRes.json();
      expect(refreshPayload.success).toBe(true);
      expect(refreshPayload.session.access_token).toBe("new-access-token");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("rejects login for unverified app-level users with explicit code", async () => {
    mockDb.getUserByEmail.mockResolvedValue(unverifiedSubscriberFixture);
    const { server, baseUrl } = await startTestServer();

    try {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: unverifiedSubscriberFixture.email,
          password: "correct-horse-battery-staple",
        }),
      });

      expect(loginRes.status).toBe(401);
      await expect(loginRes.json()).resolves.toMatchObject({
        error: "Email not verified",
        code: "EMAIL_NOT_VERIFIED",
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("rejects refresh when session cookie is missing", async () => {
    const { server, baseUrl } = await startTestServer();

    try {
      const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: "POST",
      });

      expect(refreshRes.status).toBe(401);
      await expect(refreshRes.json()).resolves.toMatchObject({
        error: "No session found",
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
