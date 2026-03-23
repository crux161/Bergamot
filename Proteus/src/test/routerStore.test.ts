import { describe, it, expect } from "vitest";
import { parseRoute, isAuthRoute } from "../renderer/stores/routerStore";

describe("parseRoute", () => {
  it("parses DM home route", () => {
    expect(parseRoute("#/channels/@me")).toEqual({ kind: "dmHome" });
    expect(parseRoute("")).toEqual({ kind: "dmHome" });
  });

  it("parses DM conversation route", () => {
    const route = parseRoute("#/channels/@me/abc-123");
    expect(route).toEqual({ kind: "dmConversation", conversationId: "abc-123" });
  });

  it("parses DM conversation with message permalink", () => {
    const route = parseRoute("#/channels/@me/abc-123/msg-456");
    expect(route).toEqual({ kind: "dmConversation", conversationId: "abc-123", messageId: "msg-456" });
  });

  it("parses channel route", () => {
    const route = parseRoute("#/channels/g1/c1");
    expect(route).toEqual({ kind: "channel", guildId: "g1", channelId: "c1" });
  });

  it("parses channel route with message permalink", () => {
    const route = parseRoute("#/channels/g1/c1/m1");
    expect(route).toEqual({ kind: "channel", guildId: "g1", channelId: "c1", messageId: "m1" });
  });

  it("parses guild home route", () => {
    const route = parseRoute("#/channels/g1");
    expect(route).toEqual({ kind: "guildHome", guildId: "g1" });
  });

  it("parses notification route", () => {
    expect(parseRoute("#/notifications")).toEqual({ kind: "notifications" });
  });

  it("parses favorites route", () => {
    expect(parseRoute("#/favorites")).toEqual({ kind: "favorites" });
  });

  it("parses bookmarks route", () => {
    expect(parseRoute("#/bookmarks")).toEqual({ kind: "bookmarks" });
  });

  it("parses mentions route", () => {
    expect(parseRoute("#/mentions")).toEqual({ kind: "mentions" });
  });

  it("parses you route", () => {
    expect(parseRoute("#/you")).toEqual({ kind: "you" });
  });

  it("parses forgot password route", () => {
    expect(parseRoute("#/forgot")).toEqual({ kind: "forgotPassword" });
  });

  it("parses reset password route", () => {
    expect(parseRoute("#/reset?token=tok123")).toEqual({ kind: "resetPassword", token: "tok123" });
  });

  it("parses verify email route", () => {
    expect(parseRoute("#/verify?token=tok456")).toEqual({ kind: "verifyEmail", token: "tok456" });
  });
});

describe("isAuthRoute", () => {
  it("returns true for auth routes", () => {
    expect(isAuthRoute({ kind: "forgotPassword" })).toBe(true);
    expect(isAuthRoute({ kind: "resetPassword", token: "x" })).toBe(true);
    expect(isAuthRoute({ kind: "verifyEmail", token: "x" })).toBe(true);
  });

  it("returns false for non-auth routes", () => {
    expect(isAuthRoute({ kind: "dmHome" })).toBe(false);
    expect(isAuthRoute({ kind: "channel", guildId: "1", channelId: "2" })).toBe(false);
  });
});
