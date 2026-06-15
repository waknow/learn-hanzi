'use client';

import { useMemo } from 'react';
import { usePrintConfig, COEFFICIENT_OPTIONS, type PrintFont, type PrintSize, type CutLine } from '@/hooks/usePrintConfig';
import { getPinyin } from '@/lib/pinyin';
import { expandWithFrequency } from '@/lib/frequency';
import { getCharColor } from '@/lib/colors';

interface PrintCardsProps {
  chars: string[];
}

const FONT_MAP: Record<PrintFont, string> = {
  '楷体': "'KaiTi', 'STKaiti', serif",
  '宋体': "'SimSun', 'Noto Serif CJK SC', serif",
  '黑体': "'SimHei', 'Noto Sans CJK SC', sans-serif",
  '圆体': "'ZCOOL KuaiLe', cursive",
};

const CUTLINE_CLASS: Record<CutLine, string> = {
  '虚线': 'border border-dashed border-gray-400',
  '圆点': 'border border-dotted border-gray-400',
  '实线标记': 'border border-solid border-gray-300',
  '隐藏': '',
};

const LAYOUT_MAP: Record<PrintSize, { cols: number; rows: number; charSize: string }> = {
  '36pt': { cols: 5, rows: 6, charSize: '36pt' },
  '48pt': { cols: 4, rows: 5, charSize: '48pt' },
  '60pt': { cols: 3, rows: 4, charSize: '60pt' },
  '72pt': { cols: 2, rows: 3, charSize: '72pt' },
};

const SIZE_LABELS = [
  { value: '36pt' as PrintSize, label: '小' },
  { value: '48pt' as PrintSize, label: '中' },
  { value: '60pt' as PrintSize, label: '大' },
  { value: '72pt' as PrintSize, label: '特大' },
];

const FONT_OPTIONS = [
  { value: '楷体' as PrintFont, label: '楷体' },
  { value: '宋体' as PrintFont, label: '宋体' },
  { value: '黑体' as PrintFont, label: '黑体' },
  { value: '圆体' as PrintFont, label: '圆体' },
];

const CUT_OPTIONS = [
  { value: '虚线' as CutLine, label: '虚线' },
  { value: '圆点' as CutLine, label: '圆点' },
  { value: '实线标记' as CutLine, label: '标记' },
  { value: '隐藏' as CutLine, label: '隐藏' },
];

export default function PrintCards({ chars }: PrintCardsProps) {
  const { config, setConfig, loaded } = usePrintConfig();
  const layout = LAYOUT_MAP[config.size];
  const fontFamily = FONT_MAP[config.font];
  const cutClass = CUTLINE_CLASS[config.cutLine];
  const hasBorder = config.cutLine !== '隐藏';

  const cardsPerPage = layout.cols * layout.rows;

  const expandedChars = useMemo(
    () => expandWithFrequency(chars, config.coefficient),
    [chars, config.coefficient]
  );

  /** 所有不重复的字符（用于染色索引） */
  const uniqueChars = useMemo(
    () => [...new Set(expandedChars.filter(Boolean))],
    [expandedChars]
  );

  const pages: string[][] = [];
  for (let i = 0; i < expandedChars.length; i += cardsPerPage) {
    pages.push(expandedChars.slice(i, i + cardsPerPage));
    const last = pages[pages.length - 1];
    while (last.length < cardsPerPage) last.push('');
  }

  if (!loaded) return null;

  return (
    <div>
      {/* ===== 工具栏 ===== */}
      <div className="no-print sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-2 text-sm">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-2">
          <select value={config.font}
            onChange={e => setConfig({ font: e.target.value as PrintFont })}
            className="px-2 py-1 rounded bg-gray-50 border-0 text-gray-600">
            {FONT_OPTIONS.map(o => <option key={o.value}>{o.label}</option>)}
          </select>

          <div className="flex rounded bg-gray-50 overflow-hidden">
            {SIZE_LABELS.map(s => (
              <button key={s.value} onClick={() => setConfig({ size: s.value })}
                className={`px-2.5 py-1 ${config.size === s.value ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex rounded bg-gray-50 overflow-hidden">
            {CUT_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setConfig({ cutLine: o.value })}
                className={`px-2 py-1 ${config.cutLine === o.value ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>
                {o.label}
              </button>
            ))}
          </div>

          <div className="flex rounded bg-gray-50 overflow-hidden">
            {COEFFICIENT_OPTIONS.map(co => (
              <button key={co.value} onClick={() => setConfig({ coefficient: co.value })}
                className={`px-2 py-1 ${config.coefficient === co.value ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>
                {co.label}
              </button>
            ))}
          </div>

          <button onClick={() => setConfig({ showPinyin: !config.showPinyin })}
            className={`px-2.5 py-1 rounded ${config.showPinyin ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-500'}`}>
            {config.showPinyin ? '拼音开' : '拼音关'}
          </button>

          <button onClick={() => setConfig({ showColor: !config.showColor })}
            className={`px-2.5 py-1 rounded ${config.showColor ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-500'}`}>
            {config.showColor ? '🎨 染色开' : '🎨 染色关'}
          </button>

          <button onClick={() => window.print()}
            className="ml-auto px-4 py-1 rounded bg-gray-800 text-white font-bold">
            打印
          </button>

          <span className="text-xs text-gray-300">{expandedChars.length} 卡 · {pages.length} 页</span>

          <div className="w-full text-[10px] text-amber-500 mt-1">
            ⚠️ 打印前请取消「页眉和页脚」（Chrome: 更多设置 → 选项）
          </div>
        </div>
      </div>

      {/* ===== 卡片网格 ===== */}
      <div className="max-w-4xl mx-auto p-4">
        {pages.map((pageChars, pageIdx) => (
          <div key={pageIdx}
            className="print-page"
            style={{
              width: '200mm',
              height: '287mm',
              padding: '5mm',
              margin: '0 auto 10mm auto',
              boxSizing: 'border-box',
            }}>
            {/* 页码 */}
            <div style={{
              textAlign: 'right',
              fontSize: '8pt',
              color: '#ccc',
              marginBottom: '1mm',
              height: '5mm',
            }}>
              {pages.length > 1 ? `${pageIdx + 1} / ${pages.length}` : ''}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
                gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
                gap: '3mm',
                width: '190mm',
                height: '270mm',
              }}>
              {pageChars.map((char, idx) => {
                const color = config.showColor && char
                  ? getCharColor(char, uniqueChars)
                  : { bg: '#ffffff', fg: '#000000' };

                return (
                  <div key={idx}
                    className={`print-card ${hasBorder ? cutClass : ''}`}
                    style={{
                      fontFamily,
                      background: color.bg,
                      color: color.fg,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    {char && (
                      <>
                        <span style={{ fontSize: layout.charSize, lineHeight: 1.2, color: 'inherit' }}>
                          {char}
                        </span>
                        {config.showPinyin && getPinyin(char) && (
                          <span style={{
                            fontSize: `calc(${layout.charSize} / 3.5)`,
                            lineHeight: 1,
                            marginTop: '2mm',
                            color: 'inherit',
                            opacity: 0.6,
                          }}>
                            {getPinyin(char)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; padding: 0; width: 210mm; }
          .no-print { display: none !important; }

          .print-page {
            page-break-before: always !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            margin: 0 auto !important;
            overflow: hidden;
          }
          .print-page:first-child { page-break-before: avoid !important; }
          .print-page:last-child { page-break-after: avoid !important; }

          .print-card {
            page-break-inside: avoid;
            break-inside: avoid;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
}
