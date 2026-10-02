'use client';

import * as React from 'react';
import {
  Palette,
  Sun,
  Moon,
  MonitorPlay,
  Presentation,
  Check,
  ChevronDown,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  type InteractiveThemeStyle,
  type SlideThemeStyle,
  type ThemePresetOption,
  THEME_STYLE_PRESETS,
  getThemeStyleSummary,
} from '@/lib/types/theme-style';

interface ThemeStylePickerProps {
  interactiveTheme?: InteractiveThemeStyle;
  slideTheme?: SlideThemeStyle;
  onChangeInteractiveTheme: (value: InteractiveThemeStyle) => void;
  onChangeSlideTheme: (value: SlideThemeStyle) => void;
  onSelectPreset?: (preset: ThemePresetOption) => void;
  disabled?: boolean;
  className?: string;
}

export function ThemeStylePicker({
  interactiveTheme = 'dark',
  slideTheme = 'light',
  onChangeInteractiveTheme,
  onChangeSlideTheme,
  onSelectPreset,
  disabled = false,
  className,
}: ThemeStylePickerProps) {
  const [open, setOpen] = React.useState(false);
  const summary = getThemeStyleSummary(interactiveTheme, slideTheme);

  const handleSelectPreset = (preset: ThemePresetOption) => {
    onChangeInteractiveTheme(preset.interactiveTheme);
    onChangeSlideTheme(preset.slideTheme);
    onSelectPreset?.(preset);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild disabled={disabled}>
            <button
              type="button"
              className={cn(
                'relative inline-flex h-8 shrink-0 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2',
                'border-border/60 bg-background/80 hover:bg-muted/70 text-foreground/90 shadow-xs hover:border-border',
                disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
                className,
              )}
            >
              <Palette className="size-3.5 text-indigo-500 shrink-0" />
              <span className="font-medium">{summary.label}</span>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full font-mono">
                {interactiveTheme === 'dark' ? '深' : '浅'}交互·{slideTheme === 'dark' ? '深' : '浅'}PPT
              </span>
              <ChevronDown className="size-3 text-muted-foreground/70 -mr-0.5" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          定制交互与PPT呈现风格（当前：{summary.badge}）
        </TooltipContent>
      </Tooltip>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-84 p-3 space-y-3 text-xs bg-popover/95 backdrop-blur-md shadow-xl border-border/80"
      >
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <SlidersHorizontal className="size-3.5 text-indigo-500" />
            <span>视觉与交互风格定制</span>
          </div>
          <span className="text-[10px] text-muted-foreground">独立可调</span>
        </div>

        {/* 快速场景预设 */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Sparkles className="size-3 text-amber-500" />
            <span>快速应用教学场景</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {THEME_STYLE_PRESETS.map((preset) => {
              const isMatch =
                interactiveTheme === preset.interactiveTheme && slideTheme === preset.slideTheme;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={cn(
                    'flex flex-col items-start p-2 rounded-lg border text-left transition-all relative cursor-pointer',
                    isMatch
                      ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-foreground font-medium ring-1 ring-indigo-500/50'
                      : 'border-border/60 hover:bg-muted/70 hover:border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-foreground">{preset.name}</span>
                    {isMatch && <Check className="size-3 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                  </div>
                  <span className="text-[10px] text-muted-foreground/90 mt-0.5 leading-tight font-mono">
                    {preset.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 独立开关调节 */}
        <div className="space-y-2.5 pt-1 border-t border-border/40">
          {/* 交互主题切换 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                <MonitorPlay className="size-3 text-blue-500" />
                交互场景主题 (仿真/小游戏/图表/3D)
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {interactiveTheme === 'dark' ? '深色科技' : '浅色明亮'}
              </span>
            </div>
            <div className="grid grid-cols-2 p-0.5 bg-muted/80 rounded-lg gap-1 border border-border/40">
              <button
                type="button"
                onClick={() => onChangeInteractiveTheme('dark')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md font-medium transition-all text-xs cursor-pointer',
                  interactiveTheme === 'dark'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Moon className="size-3 text-indigo-400" />
                <span>深色科技 (暗黑)</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeInteractiveTheme('light')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md font-medium transition-all text-xs cursor-pointer',
                  interactiveTheme === 'light'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Sun className="size-3 text-amber-500" />
                <span>浅色护眼 (明亮)</span>
              </button>
            </div>
          </div>

          {/* PPT文档主题切换 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground flex items-center gap-1">
                <Presentation className="size-3 text-teal-500" />
                PPT文档主题 (讲义与幻灯片底色)
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {slideTheme === 'light' ? '浅色纯白' : '深色夜间'}
              </span>
            </div>
            <div className="grid grid-cols-2 p-0.5 bg-muted/80 rounded-lg gap-1 border border-border/40">
              <button
                type="button"
                onClick={() => onChangeSlideTheme('light')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md font-medium transition-all text-xs cursor-pointer',
                  slideTheme === 'light'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Sun className="size-3 text-amber-500" />
                <span>浅色讲义 (纯白)</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeSlideTheme('dark')}
                className={cn(
                  'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md font-medium transition-all text-xs cursor-pointer',
                  slideTheme === 'dark'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Moon className="size-3 text-indigo-400" />
                <span>深色幻灯 (暗夜)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 说明提示 */}
        <div className="bg-muted/40 rounded-lg p-2 text-[10px] text-muted-foreground leading-relaxed border border-border/30">
          💡{' '}
          {interactiveTheme === 'dark' && slideTheme === 'light' && (
            <span>
              <strong>学生探究组合</strong>：仿真实验采用沉浸式暗黑科技风，幻灯片采用白底黑字便于阅读复习。
            </span>
          )}
          {interactiveTheme === 'light' && slideTheme === 'light' && (
            <span>
              <strong>课堂讲授组合</strong>：全流程浅色高对比度排版，专为白天大屏投影与多媒体黑板讲授打造。
            </span>
          )}
          {interactiveTheme === 'light' && slideTheme === 'dark' && (
            <span>
              <strong>网课直播组合</strong>：深色课件降低屏幕眩光与推流码率，浅色实验画布高亮操作细节。
            </span>
          )}
          {interactiveTheme === 'dark' && slideTheme === 'dark' && (
            <span>
              <strong>全暗黑极客</strong>：课件与互动统一采用深邃暗夜科技风，适合计算机与科技前沿演播。
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
