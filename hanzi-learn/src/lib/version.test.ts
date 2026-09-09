/**
 * 版本解析测试
 *
 * 覆盖：构建期注入优先、回退 package.json、未知 commit 归一化、单行格式化。
 */
import { describe, it, expect } from "vitest";
import { DEV_VERSION, formatVersion, getVersionInfo, resolveVersion } from "./version";
import pkg from "../../package.json";

describe("resolveVersion", () => {
  it("优先使用构建期注入的版本与 commit", () => {
    expect(
      resolveVersion({ appVersion: "1.2.3", gitCommit: "abc1234", pkgVersion: "9.9.9" }),
    ).toEqual({ version: "1.2.3", commit: "abc1234" });
  });

  it("无注入版本时回退 package.json", () => {
    expect(resolveVersion({ appVersion: "", gitCommit: "", pkgVersion: "2.0.0" })).toEqual({
      version: "2.0.0",
      commit: "",
    });
  });

  it("都拿不到时回退 dev", () => {
    expect(resolveVersion({ appVersion: "", gitCommit: "", pkgVersion: "" })).toEqual({
      version: DEV_VERSION,
      commit: "",
    });
    expect(resolveVersion({ appVersion: "", gitCommit: "", pkgVersion: "   " })).toEqual({
      version: DEV_VERSION,
      commit: "",
    });
  });

  it("commit 为 unknown 视为未知", () => {
    expect(
      resolveVersion({ appVersion: "1.0.0", gitCommit: "unknown", pkgVersion: "1.0.0" }).commit,
    ).toBe("");
  });

  it("去除首尾空白", () => {
    expect(
      resolveVersion({ appVersion: " 1.0.0 ", gitCommit: " abc123 ", pkgVersion: "1.0.0" }),
    ).toEqual({ version: "1.0.0", commit: "abc123" });
  });
});

describe("formatVersion", () => {
  it("有 commit 时拼接", () => {
    expect(formatVersion({ version: "1.1.0", commit: "a1b2c3d" })).toBe("v1.1.0 · a1b2c3d");
  });

  it("无 commit 时只显示版本", () => {
    expect(formatVersion({ version: "1.1.0", commit: "" })).toBe("v1.1.0");
  });
});

describe("getVersionInfo", () => {
  it("本地（无构建期注入）回退 package.json 版本", () => {
    const info = getVersionInfo();
    expect(info.version).toBe(process.env.APP_VERSION || pkg.version);
    expect(typeof info.commit).toBe("string");
  });
});
