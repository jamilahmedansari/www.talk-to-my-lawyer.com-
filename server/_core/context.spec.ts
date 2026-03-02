import { describe, expect, it } from "vitest";
import { hasPolicyAccess } from "./context";

describe("RBAC policy matrix", () => {
  describe("subscriber", () => {
    it("allows subscriber letter access", () => {
      expect(hasPolicyAccess("subscriber", "letters", "read")).toBe(true);
    });

    it("denies subscriber review access", () => {
      expect(hasPolicyAccess("subscriber", "review", "read")).toBe(false);
    });
  });

  describe("employee", () => {
    it("allows employee affiliate access", () => {
      expect(hasPolicyAccess("employee", "affiliate", "write")).toBe(true);
    });

    it("denies employee admin access", () => {
      expect(hasPolicyAccess("employee", "admin", "manage")).toBe(false);
    });
  });

  describe("attorney", () => {
    it("allows attorney review access", () => {
      expect(hasPolicyAccess("attorney", "review", "write")).toBe(true);
    });

    it("denies attorney affiliate access", () => {
      expect(hasPolicyAccess("attorney", "affiliate", "write")).toBe(false);
    });
  });

  describe("admin", () => {
    it("allows admin manage access", () => {
      expect(hasPolicyAccess("admin", "admin", "manage")).toBe(true);
    });

    it("allows admin access to subordinate actions", () => {
      expect(hasPolicyAccess("admin", "review", "write")).toBe(true);
    });
  });
});
