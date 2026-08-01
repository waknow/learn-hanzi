/**
 * 家长密码门禁组件测试
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PasswordGate from "./PasswordGate";
import { saveConfig, loadConfig } from "@/lib/storage";

/** 依次点击指定数字键 */
function typeDigits(digits: string[]) {
  for (const d of digits) {
    fireEvent.click(screen.getByRole("button", { name: d }));
  }
}

describe("PasswordGate", () => {
  beforeEach(() => localStorage.clear());

  it("已设置密码：输入正确密码后调用 onSuccess", () => {
    saveConfig({ password: "8888", enabledBanks: [], customBanks: [] });
    const onSuccess = vi.fn();
    render(<PasswordGate onSuccess={onSuccess} />);
    typeDigits(["8", "8", "8", "8"]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("已设置密码：输入错误密码不通过", () => {
    saveConfig({ password: "8888", enabledBanks: [], customBanks: [] });
    const onSuccess = vi.fn();
    render(<PasswordGate onSuccess={onSuccess} />);
    typeDigits(["1", "2", "3", "4"]);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("首次使用（无密码）：两次输入一致则保存并放行", () => {
    // 显式写入空密码触发首次设置分支（默认配置恒有 '1234'，不会走进该分支）
    saveConfig({ password: "", enabledBanks: [], customBanks: [] });
    const onSuccess = vi.fn();
    render(<PasswordGate onSuccess={onSuccess} />);
    typeDigits(["1", "2", "3", "4"]); // 设置新密码
    typeDigits(["1", "2", "3", "4"]); // 确认
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(loadConfig().password).toBe("1234");
  });

  it("首次使用：两次输入不一致则不放行", () => {
    saveConfig({ password: "", enabledBanks: [], customBanks: [] });
    const onSuccess = vi.fn();
    render(<PasswordGate onSuccess={onSuccess} />);
    typeDigits(["1", "2", "3", "4"]);
    typeDigits(["9", "9", "9", "9"]);
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
