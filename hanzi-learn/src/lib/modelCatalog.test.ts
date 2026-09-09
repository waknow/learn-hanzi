/**
 * 模型目录纯函数测试
 *
 * 覆盖：id 合法性、未知模型补全、上游响应归一化、排序、生效模型解析优先级。
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_MODEL,
  FALLBACK_MODELS,
  describeModel,
  isValidModelId,
  normalizeModelList,
  resolveEffectiveModel,
  sortModels,
} from "./modelCatalog";

describe("isValidModelId", () => {
  it("接受常见模型 id", () => {
    expect(isValidModelId("deepseek-v4-flash")).toBe(true);
    expect(isValidModelId("deepseek-v4-pro")).toBe(true);
    expect(isValidModelId("  deepseek-chat  ")).toBe(true);
  });

  it("拒绝空值、非字符串和带空格的 id", () => {
    expect(isValidModelId("")).toBe(false);
    expect(isValidModelId("  ")).toBe(false);
    expect(isValidModelId(null)).toBe(false);
    expect(isValidModelId(123)).toBe(false);
    expect(isValidModelId("deep seek")).toBe(false);
    expect(isValidModelId("a")).toBe(false);
  });
});

describe("describeModel", () => {
  it("已知模型返回内置元数据", () => {
    const info = describeModel("deepseek-v4-flash");
    expect(info.label).toBe("DeepSeek V4 Flash");
    expect(info.recommended).toBe(true);
    expect(info.contextWindow).toBe(128000);
  });

  it("未知模型回退为通用文案且保留 id", () => {
    const info = describeModel("deepseek-future-xyz");
    expect(info.id).toBe("deepseek-future-xyz");
    expect(info.label).toBe("deepseek-future-xyz");
    expect(info.contextWindow).toBeNull();
    expect(info.recommended).toBe(false);
  });
});

describe("normalizeModelList", () => {
  it("解析上游 data 数组并补全元数据", () => {
    const models = normalizeModelList({
      object: "list",
      data: [
        { id: "deepseek-v4-pro", object: "model" },
        { id: "deepseek-v4-flash", object: "model" },
      ],
    });
    expect(models.map((m) => m.id)).toEqual(["deepseek-v4-flash", "deepseek-v4-pro"]);
    expect(models[0].label).toBe("DeepSeek V4 Flash");
  });

  it("过滤非法项、去重、保留未知模型", () => {
    const models = normalizeModelList({
      data: [
        { id: "deepseek-v4-flash" },
        { id: "deepseek-v4-flash" },
        { id: "" },
        { id: "bad id" },
        { id: 42 },
        { id: "deepseek-new-2027" },
      ],
    });
    expect(models.map((m) => m.id).sort()).toEqual(["deepseek-new-2027", "deepseek-v4-flash"]);
  });

  it("结构异常时返回空数组", () => {
    expect(normalizeModelList(null)).toEqual([]);
    expect(normalizeModelList({})).toEqual([]);
    expect(normalizeModelList({ data: "oops" })).toEqual([]);
  });
});

describe("sortModels", () => {
  it("推荐模型排在前面，其余按 id 排序", () => {
    const sorted = sortModels([
      { id: "zzz-model", label: "z", contextWindow: null, description: "", recommended: false },
      { id: "b-model", label: "b", contextWindow: null, description: "", recommended: false },
      { id: "pro", label: "p", contextWindow: null, description: "", recommended: true },
    ]);
    expect(sorted.map((m) => m.id)).toEqual(["pro", "b-model", "zzz-model"]);
  });

  it("内置兜底目录含推荐模型", () => {
    expect(FALLBACK_MODELS.some((m) => m.recommended)).toBe(true);
  });
});

describe("resolveEffectiveModel", () => {
  it("手动选择优先于环境变量", () => {
    expect(resolveEffectiveModel("deepseek-v4-pro", "deepseek-v4-flash")).toEqual({
      model: "deepseek-v4-pro",
      source: "manual",
    });
  });

  it("手动为空时取环境变量", () => {
    expect(resolveEffectiveModel("", "deepseek-v4-pro")).toEqual({
      model: "deepseek-v4-pro",
      source: "env",
    });
    expect(resolveEffectiveModel(null, "deepseek-v4-pro")).toEqual({
      model: "deepseek-v4-pro",
      source: "env",
    });
  });

  it("都没有时回退内置默认", () => {
    expect(resolveEffectiveModel("", "")).toEqual({ model: DEFAULT_MODEL, source: "default" });
    expect(resolveEffectiveModel(undefined, undefined)).toEqual({
      model: DEFAULT_MODEL,
      source: "default",
    });
  });

  it("仅空白的值视为未设置", () => {
    expect(resolveEffectiveModel("   ", "  ")).toEqual({
      model: DEFAULT_MODEL,
      source: "default",
    });
  });
});
