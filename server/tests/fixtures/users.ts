export type TestRole = "subscriber" | "attorney" | "employee" | "admin";

export type TestUserFixture = {
  id: number;
  openId: string;
  email: string;
  name: string;
  role: TestRole;
  emailVerified: boolean;
};

export const roleFixtures: Record<TestRole, TestUserFixture> = {
  subscriber: {
    id: 101,
    openId: "fixture-subscriber",
    email: "subscriber@example.com",
    name: "Fixture Subscriber",
    role: "subscriber",
    emailVerified: true,
  },
  attorney: {
    id: 102,
    openId: "fixture-attorney",
    email: "attorney@example.com",
    name: "Fixture Attorney",
    role: "attorney",
    emailVerified: true,
  },
  employee: {
    id: 103,
    openId: "fixture-employee",
    email: "employee@example.com",
    name: "Fixture Employee",
    role: "employee",
    emailVerified: true,
  },
  admin: {
    id: 104,
    openId: "fixture-admin",
    email: "admin@example.com",
    name: "Fixture Admin",
    role: "admin",
    emailVerified: true,
  },
};

export const unverifiedSubscriberFixture: TestUserFixture = {
  ...roleFixtures.subscriber,
  id: 105,
  openId: "fixture-unverified-subscriber",
  email: "new-subscriber@example.com",
  emailVerified: false,
};
