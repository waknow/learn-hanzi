/**
 * 字库内容维护页测试
 *
 * 覆盖：内置字只能禁用不能删除、内置字库可以补充新字（补充后置 customized）、
 * 新增的字可以删除、自定义字库的字可以删除、至少保留 1 个生效字、字库不存在时回设置页。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import BankContentPage from "./page";
import { loadBanks, saveBanks } from "@/lib/storage";

const mocks = vi.hoisted(() => ({ push: vi.fn(), bankId: "level1" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(`bank=${mocks.bankId}`),
}));

beforeEach(() => {
  localStorage.clear();
  mocks.push.mockClear();
  mocks.bankId = "level1";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as never,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("字库内容维护页 —— 内置字库", () => {
  it("内置字只能禁用，不能删除；禁用结果写回 disabledChars", async () => {
    render(<BankContentPage />);
    await screen.findByText("➕ 添加汉字");

    // 内置字「小」没有删除按钮（只有 🔒）
    expect(screen.queryByLabelText("删除小")).toBeNull();

    await userEvent.click(screen.getByLabelText("禁用小"));

    expect(await screen.findByText("已禁用「小」")).toBeInTheDocument();
    expect(loadBanks().items.find((b) => b.id === "level1")?.disabledChars).toEqual(["小"]);
    // 禁用后按钮变成"启用"
    expect(screen.getByLabelText("启用小")).toBeInTheDocument();
  });

  it("可以往内置字库补充新字：置 customized，且新增的字可以再删除", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<BankContentPage />);
    await screen.findByText("➕ 添加汉字");

    await userEvent.type(screen.getByLabelText("要添加的汉字"), "熊猫");
    await userEvent.click(screen.getByText("添加"));

    const afterAdd = loadBanks().items.find((b) => b.id === "level1");
    expect(afterAdd?.chars).toContain("熊");
    expect(afterAdd?.chars).toContain("猫");
    expect(afterAdd?.customized).toBe(true);
    expect(await screen.findByText("新增 2 字：熊猫")).toBeInTheDocument();

    // 家长新增的字可以删除
    await userEvent.click(screen.getByLabelText("删除熊"));
    const afterDelete = loadBanks().items.find((b) => b.id === "level1");
    expect(afterDelete?.chars).not.toContain("熊");
    expect(afterDelete?.chars).toContain("猫");
  });

  it("重复添加已有汉字时提示已存在，不重复写入", async () => {
    render(<BankContentPage />);
    await screen.findByText("➕ 添加汉字");
    const before = loadBanks().items.find((b) => b.id === "level1")!.chars.length;

    await userEvent.type(screen.getByLabelText("要添加的汉字"), "小");
    await userEvent.click(screen.getByText("添加"));

    expect(await screen.findByText("这些字都已经在字库里了")).toBeInTheDocument();
    expect(loadBanks().items.find((b) => b.id === "level1")!.chars.length).toBe(before);
  });

  it("不能把字库里的字全部禁用（至少保留 1 个生效字）", async () => {
    const banks = loadBanks();
    saveBanks({
      items: banks.items.map((b) =>
        b.id === "level1" ? { ...b, chars: ["小"], disabledChars: undefined } : b,
      ),
    });

    render(<BankContentPage />);
    await screen.findByText("➕ 添加汉字");
    await userEvent.click(screen.getByLabelText("禁用小"));

    expect(await screen.findByText("至少要保留 1 个生效的汉字")).toBeInTheDocument();
    expect(loadBanks().items.find((b) => b.id === "level1")?.disabledChars).toBeUndefined();
  });

  it("筛选「已禁用」只显示被禁用的字", async () => {
    const banks = loadBanks();
    saveBanks({
      items: banks.items.map((b) => (b.id === "level1" ? { ...b, disabledChars: ["小"] } : b)),
    });

    render(<BankContentPage />);
    await screen.findByText("➕ 添加汉字");
    // 筛选按钮（字块上的「已禁用」是状态文案，取 role 避免歧义）
    await userEvent.click(screen.getByRole("button", { name: "已禁用" }));

    expect(screen.getByLabelText("启用小")).toBeInTheDocument();
    expect(screen.queryByLabelText("禁用大")).toBeNull();
  });
});

describe("字库内容维护页 —— 自定义字库", () => {
  beforeEach(() => {
    const banks = loadBanks();
    saveBanks({
      items: [
        ...banks.items,
        {
          id: "custom_1",
          name: "动物园",
          emoji: "🐼",
          chars: ["猫", "狗", "鸟"],
          origin: "custom",
          enabled: true,
        },
      ],
    });
    mocks.bankId = "custom_1";
  });

  it("自定义字库里的字可以删除", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<BankContentPage />);
    await screen.findByText("➕ 添加汉字");

    await userEvent.click(screen.getByLabelText("删除猫"));

    expect(loadBanks().items.find((b) => b.id === "custom_1")?.chars).toEqual(["狗", "鸟"]);
    expect(await screen.findByText("已删除「猫」")).toBeInTheDocument();
  });

  it("取消删除时不改动字库", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<BankContentPage />);
    await screen.findByText("➕ 添加汉字");

    await userEvent.click(screen.getByLabelText("删除猫"));

    expect(loadBanks().items.find((b) => b.id === "custom_1")?.chars).toEqual(["猫", "狗", "鸟"]);
  });
});

describe("字库内容维护页 —— 异常入口", () => {
  it("字库不存在时跳回设置页", async () => {
    mocks.bankId = "nope";
    render(<BankContentPage />);

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/parent/settings"));
  });
});
