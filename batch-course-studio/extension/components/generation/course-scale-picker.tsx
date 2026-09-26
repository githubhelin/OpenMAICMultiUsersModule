'use client';

import * as React from 'react';
import { Layers, Zap, Target, BookOpen, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  type CourseScale,
  COURSE_SCALES,
} from '@/lib/types/course-scale';

interface CourseScalePickerProps {
  value?: CourseScale;
  onChange: (value: CourseScale) => void;
  disabled?: boolean;
  className?: string;
}

const SCALE_ICONS: Record<CourseScale, React.ReactNode> = {
  micro: <Zap className="size-3.5 text-amber-500 shrink-0" />,
  standard: <Target className="size-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />,
  thematic: <BookOpen className="size-3.5 text-violet-500 shrink-0" />,
};

export function CourseScalePicker({
  value = 'standard',
  onChange,
  disabled = false,
  className,
}: CourseScalePickerProps) {
  const currentConfig = COURSE_SCALES[value] || COURSE_SCALES.standard;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <button
              type="button"
              className={cn(
                'relative inline-flex h-8 shrink-0 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2',
                'border-border/60 bg-background/80 hover:bg-muted/70 text-foreground/90 shadow-xs hover:border-border',
                disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
                className,
              )}
            >
              {SCALE_ICONS[value] || <Layers className="size-3.5" />}
              <span className="font-medium">{currentConfig.label}</span>
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full font-mono">
                {currentConfig.badge}
              </span>
              <ChevronDown className="size-3 text-muted-foreground/70 -mr-0.5" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          选择课程篇幅与教学形态（当前：{currentConfig.label}，约{currentConfig.slides}）
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" sideOffset={6} className="w-68 p-1.5 space-y-1">
        <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground border-b border-border/40 mb-1">
          课程篇幅与结构形态
        </div>
        {(Object.keys(COURSE_SCALES) as CourseScale[]).map((scaleKey) => {
          const item = COURSE_SCALES[scaleKey];
          const isSelected = value === scaleKey;
          return (
            <DropdownMenuItem
              key={scaleKey}
              onClick={() => onChange(scaleKey)}
              className={cn(
                'flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors',
                isSelected
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'hover:bg-muted/80 text-foreground',
              )}
            >
              <div className="mt-0.5">{SCALE_ICONS[scaleKey]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-xs">{item.label}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted/90 text-muted-foreground border border-border/40">
                    {item.slides}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                  {item.description}
                </p>
                <p className="text-[10px] text-muted-foreground/70 leading-tight mt-1 line-clamp-1">
                  {item.structure}
                </p>
              </div>
              {isSelected && (
                <Check className="size-3.5 text-primary mt-0.5 shrink-0" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
