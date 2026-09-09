"use client";

/**
 * DeepSeek 模型选择卡片（家长设置页）
 *
 * - 打开页面即自动调用 GET /api/model 获取账号可用模型（服务端带缓存）
 * - 支持「自动」（跟随环境变量/默认）与手动指定；选择立即持久化到服务端
 * - 获取失败时展示内置兜底目录并给出「重新获取」按钮，不阻塞其他设置
 */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { loadConfig, saveConfig } from "@/lib/storage";
import type { ModelInfo, ModelSource } from "@/lib/modelCatalog";

interface ModelListResponse {
  models: ModelInfo[];
  listSource: "api" | "fallback";
  current: string;
  currentSource: ModelSource;
  selected: string;
  currentAvailable: boolean;
  hasApiKey: boolean;
  error: string | null;
  fetchedAt: string | null;
}

/** 来源标签文案 */
const SOURCE_LABEL: Record<ModelSource, string> = {
  manual: "家长手动选择",
  env: "跟随环境变量 DEEPSEEK_MODEL",
  default: "内置默认模型",
};

export default function ModelSelector() {
  const [data, setData] = useState<ModelListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  /** 拉取模型列表（refresh=true 时跳过服务端缓存） */
  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/model${refresh ? "?refresh=1" : ""}`);
      const body = (await res.json()) as ModelListResponse;
      setData(body);
    } catch {
      setMessage("网络异常，未能获取模型列表");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** 切换模型：先写服务端（生成时读取），再同步本地配置 */
  const selectModel = useCallback(async (modelId: string) => {
    setSaving(modelId);
    setMessage("");
    try {
      const res = await fetch("/api/model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId }),
      });
      const body = (await res.json()) as ModelListResponse & { ok?: boolean };
      if (!res.ok || body.ok === false) {
        setMessage("保存失败，请重试");
        return;
      }
      setData(body);
      const config = loadConfig();
      saveConfig({ ...config, model: modelId });
      setMessage(modelId ? "已切换模型，下次生成立即生效" : "已设为自动选择模型");
    } catch {
      setMessage("网络异常，保存失败");
    } finally {
      setSaving(null);
    }
  }, []);

  if (loading && !data) {
    return (
      <div className="rounded-2xl bg-white shadow-sm p-6 text-center text-gray-300 text-sm">
        🔍 正在获取可用模型…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-white shadow-sm p-6 text-center">
        <p className="text-sm text-gray-400 mb-3">{message || "未能获取模型列表"}</p>
        <button
          onClick={() => void load(true)}
          className="px-5 py-2 rounded-full bg-candy-sky text-white text-sm active:scale-95 transition-transform"
        >
          重新获取
        </button>
      </div>
    );
  }

  const options: {
    id: string;
    label: string;
    description: string;
    contextWindow: number | null;
  }[] = [
    {
      id: "",
      label: "自动",
      description: `跟随服务端配置（当前：${data.current}）`,
      contextWindow: null,
    },
    ...data.models.map((m) => ({
      id: m.id,
      label: m.label,
      description: m.description,
      contextWindow: m.contextWindow,
    })),
  ];

  return (
    <div className="rounded-2xl bg-white shadow-sm p-5">
      {/* 当前状态 */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">当前使用</p>
          <p className="font-cartoon text-gray-700 text-lg break-all">{data.current}</p>
          <p className="text-xs text-candy-teal mt-1">
            {SOURCE_LABEL[data.currentSource]}
            {data.listSource === "fallback" ? " · 离线目录" : ""}
          </p>
        </div>
        <button
          onClick={() => void load(true)}
          disabled={loading}
          className="shrink-0 px-4 py-2 rounded-full bg-candy-sky/15 text-candy-sky text-xs
                     active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? "获取中…" : "重新获取"}
        </button>
      </div>

      {/* 提示信息 */}
      {data.error && (
        <p className="text-xs text-candy-orange bg-candy-orange/10 rounded-xl px-3 py-2 mb-3">
          ⚠️ {data.error}
        </p>
      )}
      {!data.currentAvailable && (
        <p className="text-xs text-candy-orange bg-candy-orange/10 rounded-xl px-3 py-2 mb-3">
          ⚠️ 当前模型不在账号可用列表中，生成时会自动回退到默认模型
        </p>
      )}
      {data.fetchedAt && data.listSource === "api" && (
        <p className="text-xs text-gray-300 mb-3">
          列表更新时间：{new Date(data.fetchedAt).toLocaleTimeString("zh-CN")}
        </p>
      )}

      {/* 模型列表 */}
      <div className="space-y-2">
        {options.map((opt) => {
          const active = (data.selected || "") === opt.id;
          return (
            <motion.button
              key={opt.id || "auto"}
              layout
              data-testid={`model-option-${opt.id || "auto"}`}
              onClick={() => void selectModel(opt.id)}
              disabled={saving !== null}
              className={`w-full text-left px-4 py-3 rounded-2xl transition-colors disabled:opacity-60 ${
                active
                  ? "bg-candy-green/15 ring-2 ring-candy-green"
                  : "bg-gray-50 active:bg-gray-100"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-cartoon text-gray-700 text-sm break-all">
                  {active ? "✅ " : ""}
                  {opt.label}
                </span>
                {saving === opt.id && <span className="text-xs text-gray-400">保存中…</span>}
              </div>
              <p className="text-xs text-gray-400 mt-1">{opt.description}</p>
              {opt.id && opt.contextWindow && (
                <p className="text-xs text-gray-300 mt-1">
                  上下文 {Math.round(opt.contextWindow / 1000)}K
                </p>
              )}
            </motion.button>
          );
        })}
      </div>

      {message && <p className="text-xs text-candy-teal mt-3 text-center">{message}</p>}
    </div>
  );
}
