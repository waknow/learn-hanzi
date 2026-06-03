'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loadConfig, saveConfig } from '@/lib/storage';

interface PasswordGateProps {
  onSuccess: () => void;
}

/**
 * 4 位数字密码验证组件
 * 首次使用引导设置密码，之后每次验证
 */
export default function PasswordGate({ onSuccess }: PasswordGateProps) {
  const [input, setInput] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'verify' | 'set1' | 'set2'>('verify');
  const [error, setError] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const config = loadConfig();
    if (config.password) {
      setIsFirstTime(false);
      setStep('verify');
    } else {
      setIsFirstTime(true);
      setStep('set1');
      setMessage('设置家长密码（4位数字）');
    }
  }, []);

  const handleDigit = useCallback(
    (digit: string) => {
      setError(false);

      if (step === 'verify') {
        const next = input + digit;
        if (next.length <= 4) {
          setInput(next);
          if (next.length === 4) {
            // 验证密码
            const config = loadConfig();
            if (next === config.password) {
              onSuccess();
            } else {
              setError(true);
              setTimeout(() => {
                setInput('');
                setError(false);
              }, 600);
            }
          }
        }
      } else if (step === 'set1') {
        const next = newPassword + digit;
        if (next.length <= 4) {
          setNewPassword(next);
          if (next.length === 4) {
            setStep('set2');
            setMessage('再次输入确认密码');
          }
        }
      } else if (step === 'set2') {
        const next = input + digit;
        if (next.length <= 4) {
          setInput(next);
          if (next.length === 4) {
            if (next === newPassword) {
              // 保存密码
              const config = loadConfig();
              config.password = newPassword;
              saveConfig(config);
              onSuccess();
            } else {
              setError(true);
              setMessage('两次密码不一致，重新设置');
              setTimeout(() => {
                setInput('');
                setNewPassword('');
                setStep('set1');
                setError(false);
              }, 800);
            }
          }
        }
      }
    },
    [input, newPassword, step, onSuccess]
  );

  const handleDelete = useCallback(() => {
    if (step === 'verify') {
      setInput((prev) => prev.slice(0, -1));
    } else if (step === 'set2') {
      setInput((prev) => prev.slice(0, -1));
    } else if (step === 'set1') {
      setNewPassword((prev) => prev.slice(0, -1));
    }
  }, [step]);

  const displayValue = step === 'set1' ? newPassword : input;

  return (
    <div className="min-h-screen bg-gradient-to-b from-candy-purple/20 to-candy-sky/20 flex items-center justify-center p-8">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-4xl shadow-xl p-8 w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-cartoon text-gray-700">
            {isFirstTime ? '设置家长密码' : '家长验证'}
          </h2>
          {message && (
            <p className="text-sm text-gray-400 mt-2">{message}</p>
          )}
        </div>

        {/* 密码圆点 */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={
                error
                  ? { x: [-5, 5, -5, 5, 0], backgroundColor: '#ef4444' }
                  : {}
              }
              transition={{ duration: 0.4 }}
              className={`w-5 h-5 rounded-full border-2 ${
                displayValue.length > i
                  ? 'bg-candy-purple border-candy-purple'
                  : 'border-gray-300'
              }`}
            />
          ))}
        </div>

        {/* 数字键盘 */}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="h-16 text-2xl font-bold rounded-2xl bg-gray-50 active:bg-gray-200 
                         text-gray-700 hover:bg-gray-100 transition-colors
                         active:scale-95 transform"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleDelete}
            className="h-16 text-xl rounded-2xl bg-gray-50 active:bg-gray-200 
                       text-gray-500 hover:bg-gray-100 transition-colors
                       active:scale-95 transform"
          >
            ←
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="h-16 text-2xl font-bold rounded-2xl bg-gray-50 active:bg-gray-200 
                       text-gray-700 hover:bg-gray-100 transition-colors
                       active:scale-95 transform"
          >
            0
          </button>
          <div />
        </div>
      </motion.div>
    </div>
  );
}
