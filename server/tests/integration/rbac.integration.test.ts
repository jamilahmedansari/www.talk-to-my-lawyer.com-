import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "../../routers";
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { roleFixtures } from "../fixtures/users";

function createCaller(user: any) {
  const req = { protocol: "https", headers: {} } as any;
  const res = { clearCookie: () => undefined, cookie: () => undefined } as any;
  return appRouter.createCaller({ req, res, user });
}

async function expectTrpcError(
  run: () => Promise<unknown>,
  expectedCode: TRPCError["code"],
  expectedMessage: string
) {
  await expect(run()).rejects.toMatchObject({
    code: expectedCode,
    message: expectedMessage,
  });
}

describe("Auth/RBAC integration", () => {
  it("rejects protected auth onboarding for unauthenticated users", async () => {
    const caller = createCaller(null);

    await expectTrpcError(
      () => caller.auth.completeOnboarding({ role: "subscriber" }),
      "UNAUTHORIZED",
      UNAUTHED_ERR_MSG
    );
  });

  it("rejects billing paywall access for non-subscriber roles", async () => {
    const caller = createCaller(roleFixtures.employee);

    await expectTrpcError(
      () => caller.billing.checkPaywallStatus(),
      "FORBIDDEN",
      "Subscriber access required"
    );
  });

  it("rejects review queue access for subscriber role", async () => {
    const caller = createCaller(roleFixtures.subscriber);

    await expectTrpcError(
      () => caller.review.queue(),
      "FORBIDDEN",
      "Attorney, Employee, or Admin access required"
    );
  });

  it("rejects letter list access for attorney role", async () => {
    const caller = createCaller(roleFixtures.attorney);

    await expectTrpcError(
      () => caller.letters.myLetters(),
      "FORBIDDEN",
      "Subscriber access required"
    );
  });

  it("rejects admin stats access for non-admin users", async () => {
    const caller = createCaller(roleFixtures.employee);

    await expectTrpcError(() => caller.admin.stats(), "FORBIDDEN", NOT_ADMIN_ERR_MSG);
  });
});
