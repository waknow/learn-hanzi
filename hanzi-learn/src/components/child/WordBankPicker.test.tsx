/**
 * 字库选择组件测试
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WordBankPicker from "./WordBankPicker";
import { loadBanks, saveBanks } from "@/lib/storage";

/** 只启用给定 id 的字库（其余停用） */
function enableOnly(ids: string[]) {
  const banks = loadBanks();
  saveBanks({ items: banks.items.map((b) => ({ ...b, enabled: ids.includes(b.id) })) });
}

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
}));
vi.mock("@/hooks/useSound", () => ({
  useSound: () => ({ init: vi.fn(), play: vi.fn(), speak: vi.fn() }),
}));

describe("WordBankPicker", () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
  });

  it("默认渲染全部内置字库与综合", async () => {
    render(<WordBankPicker />);
    expect(await screen.findByText("一级")).toBeInTheDocument();
    expect(screen.getByText("二级")).toBeInTheDocument();
    expect(screen.getByText("综合")).toBeInTheDocument();
  });

  it("点击字库跳转到句子生成页", async () => {
    render(<WordBankPicker />);
    fireEvent.click(await screen.findByText("一级"));
    expect(pushMock).toHaveBeenCalledWith("/child/sentence?bank=level1");
  });

  it("只显示 enabled=true 的字库", async () => {
    enableOnly(["level1"]);
    render(<WordBankPicker />);
    expect(await screen.findByText("一级")).toBeInTheDocument();
    expect(screen.queryByText("二级")).not.toBeInTheDocument();
  });

  it("点击打印按钮跳转打印页，且不触发进入句子页", async () => {
    render(<WordBankPicker />);
    await screen.findByText("一级");

    fireEvent.click(screen.getByLabelText("打印一级字卡"));

    expect(pushMock).toHaveBeenCalledWith("/print?bank=level1");
    expect(pushMock).not.toHaveBeenCalledWith("/child/sentence?bank=level1");
  });

  it("没有启用的字库时显示空态提示", async () => {
    enableOnly([]);
    render(<WordBankPicker />);
    expect(await screen.findByText(/请让家长先开启字库/)).toBeInTheDocument();
  });
});
