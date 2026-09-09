/**
 * 版本信息解析（纯函数，客户端/服务端/测试均可 import）
 *
 * 版本来源优先级：
 *   1. 构建期注入的 `APP_VERSION`（next.config.js 注入；Docker 构建由 build.sh 传入）
 *   2. package.json 的 version（本地开发、非 Docker 构建）
 *   3. "dev"（都拿不到时的兜底）
 *
 * 说明：客户端组件里直接读 package.json 会被打进浏览器包，
 * 因此版本值统一在构建期由 next.config.js 写入 process.env.APP_VERSION。
 */

import pkg from "../../package.json";

/** 版本信息 */
export interface AppVersionInfo {
  /** 展示用版本号，如 1.1.0 或 1.1.0-3-gabc1234 */
  version: string;
  /** git 短哈希；未知时为空串 */
  commit: string;
}

/** 版本来源（可覆盖，便于测试与复用） */
export interface VersionSources {
  /** 构建期注入的版本，缺省取 process.env.APP_VERSION */
  appVersion?: string;
  /** 构建期注入的 commit，缺省取 process.env.GIT_COMMIT */
  gitCommit?: string;
  /** package.json 版本，缺省取本仓库 package.json */
  pkgVersion?: string;
}

/** 兜底版本号（无法解析时） */
export const DEV_VERSION = "dev";

/**
 * 解析版本信息。
 *
 * 未提供（`undefined`）的来源回退到下一优先级；显式传空串表示「该来源无值」。
 */
export function resolveVersion(sources: VersionSources = {}): AppVersionInfo {
  const { appVersion, gitCommit, pkgVersion } = sources;

  const rawVersion = appVersion ?? process.env.APP_VERSION;
  const rawCommit = gitCommit ?? process.env.GIT_COMMIT;
  const rawPkg = pkgVersion ?? pkg.version;

  const version = (rawVersion || rawPkg || "").trim() || DEV_VERSION;
  const commit = (rawCommit || "").trim();
  return { version, commit: commit === "unknown" ? "" : commit };
}

/** 当前应用版本信息 */
export function getVersionInfo(): AppVersionInfo {
  return resolveVersion();
}

/** 组合成单行展示文本，如 "v1.1.0 · a1b2c3d" */
export function formatVersion(info: AppVersionInfo): string {
  const v = `v${info.version}`;
  return info.commit ? `${v} · ${info.commit}` : v;
}
