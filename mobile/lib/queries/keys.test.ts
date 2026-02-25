import { describe, it, expect } from "vitest";
import { groupKeys, userKeys, inviteKeys } from "./keys";

describe("Query key factory", () => {
  describe("groupKeys", () => {
    it("returns stable all key", () => {
      expect(groupKeys.all).toEqual(["groups"]);
    });

    it("returns detail key with id", () => {
      expect(groupKeys.detail("abc")).toEqual(["groups", "abc"]);
    });

    it("returns expenses key with id", () => {
      expect(groupKeys.expenses("abc")).toEqual(["groups", "abc", "expenses"]);
    });

    it("returns balances key with id", () => {
      expect(groupKeys.balances("abc")).toEqual(["groups", "abc", "balances"]);
    });

    it("returns activity key with id", () => {
      expect(groupKeys.activity("abc")).toEqual(["groups", "abc", "activity"]);
    });

    it("returns members key with id", () => {
      expect(groupKeys.members("abc")).toEqual(["groups", "abc", "members"]);
    });
  });

  describe("userKeys", () => {
    it("returns stable current key", () => {
      expect(userKeys.current).toEqual(["user", "current"]);
    });

    it("returns stable profile key", () => {
      expect(userKeys.profile).toEqual(["user", "profile"]);
    });
  });

  describe("inviteKeys", () => {
    it("returns preview key with token", () => {
      expect(inviteKeys.preview("tok123")).toEqual(["invite", "tok123"]);
    });
  });
});
