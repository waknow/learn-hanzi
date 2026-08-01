/**
 * 字库选择组件测试
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WordBankPicker from "./WordBankPicker";
import { saveConfig } from "@/lib/storage";

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

  it("enabledBanks 只显示启用的字库", async () => {
    saveConfig({ password: "1234", enabledBanks: ["level1"], customBanks: [] });
    render(<WordBankPicker />);
    expect(await screen.findByText("一级")).toBeInTheDocument();
    expect(screen.queryByText("二级")).not.toBeInTheDocument();
  });

  it("没有可用字库时显示空态提示", async () => {
    saveConfig({ password: "1234", enabledBanks: ["nope"], customBanks: [] });
    render(<WordBankPicker />);
    expect(await screen.findByText(/请让家长先开启字库/)).toBeInTheDocument();
  });
});
