export type InteractiveThemeStyle = 'dark' | 'light';
export type SlideThemeStyle = 'light' | 'dark';

export interface ThemeStyleConfig {
  interactiveTheme: InteractiveThemeStyle;
  slideTheme: SlideThemeStyle;
}

export const DEFAULT_THEME_STYLE: ThemeStyleConfig = {
  interactiveTheme: 'dark', // 默认深色科技交互（适合学生探索）
  slideTheme: 'light',      // 默认浅色文档（适合常规展示）
};

export interface ThemePresetOption {
  id: string;
  name: string;
  badge: string;
  description: string;
  interactiveTheme: InteractiveThemeStyle;
  slideTheme: SlideThemeStyle;
}

export const THEME_STYLE_PRESETS: ThemePresetOption[] = [
  {
    id: 'student_study',
    name: '学生自主探究',
    badge: '深色交互 + 浅色文档',
    description: '深色沉浸式仿真小游戏，搭配纯白清晰讲义。适合学生上机自学与动手实验。',
    interactiveTheme: 'dark',
    slideTheme: 'light',
  },
  {
    id: 'offline_class',
    name: '线下实体课堂',
    badge: '浅色交互 + 浅色文档',
    description: '明亮浅色护眼交互，搭配高清晰纯白幻灯片。适合白天教室大屏与投影仪讲授。',
    interactiveTheme: 'light',
    slideTheme: 'light',
  },
  {
    id: 'online_course',
    name: '线上网课直播',
    badge: '浅色交互 + 深色文档',
    description: '深邃暗夜科技风幻灯片，搭配明亮清晰的交互实操。适合夜间或网课屏幕演示。',
    interactiveTheme: 'light',
    slideTheme: 'dark',
  },
  {
    id: 'all_dark',
    name: '极客沉浸暗黑',
    badge: '深色交互 + 深色文档',
    description: '全黑客暗黑科技调性，高对比发光强调。适合计算机、极客或暗色演播室。',
    interactiveTheme: 'dark',
    slideTheme: 'dark',
  },
];

/**
 * 构造注入给大模型的大纲与场景视觉风格提示词规约
 */
export function buildThemeStyleInstruction(
  interactiveTheme: InteractiveThemeStyle = 'dark',
  slideTheme: SlideThemeStyle = 'light',
): string {
  const parts: string[] = [];

  if (slideTheme === 'dark') {
    parts.push(`1. 【PPT/讲义文档主题 - 深色科技模式（Dark Slide）】：
   - 全课所有幻灯片页面（Slide）必须统一采用深色/暗夜背景：JSON 中的 background 必须设置为 {"type": "solid", "color": "#0f172a"}（或 "#111827" 等深邃底色）。
   - 所有文本元素（标题、正文、列表、卡片等）必须采用高对比度浅色字体，例如 defaultColor 必须设置为 "#f8fafc" 或 "#e2e8f0"，次要文字使用 "#94a3b8"，严禁使用白底黑字。适合夜间或网课高对比度演播。`);
  } else {
    parts.push(`1. 【PPT/讲义文档主题 - 浅色明亮模式（Light Slide）】：
   - 全课所有幻灯片页面（Slide）统一采用纯白/极简明亮背景：JSON 中的 background 必须设置为 {"type": "solid", "color": "#ffffff"}。
   - 文本采用深色高清晰度排版：defaultColor 设为 "#1e293b" 或 "#333333"，次要文字 "#64748b"，适合白天教学与投影演示。`);
  }

  if (interactiveTheme === 'light') {
    parts.push(`2. 【交互场景主题 - 浅色明亮/护眼模式（Light Interactive）】：
   - 全课所有互动页面（仿真模拟 simulation、闯关游戏 game、交互图表 diagram、3D可视化 visualization3d、代码练习 code、实操 procedural-skill）的 HTML 页面，必须采用明亮、轻快的浅色护眼界面风格。
   - 页面背景与画布主体统一采用纯白 "#ffffff"、浅暖灰 "#f8fafc" 或淡蓝灰 "#f1f5f9"；
   - 控件、卡片、侧边栏使用浅色材质与清晰的深色文字（如 "#1e293b"）；
   - 严禁默认使用黑底、暗黑仪表盘（Dark Dashboard）或太空暗夜背景！必须保证在公开课与课堂大屏投影时清晰、明快、护眼。`);
  } else {
    parts.push(`2. 【交互场景主题 - 深色科技/极客模式（Dark Interactive）】：
   - 全课所有互动页面（仿真模拟 simulation、闯关游戏 game、交互图表 diagram、3D可视化 visualization3d、代码练习 code、实操 procedural-skill）的 HTML 页面，采用沉浸式深色科技主题。
   - 页面背景与画布采用深色底色（如 "#0a0a1a"、"#0f172a"、"#1e293b"），搭配高对比度白色/发光彩色节点、霓虹轨迹高亮，适合学生个人端自主探索与沉浸式操作。`);
  }

  return `\n\n【界面视觉风格强制规约】：\n${parts.join('\n')}\n`;
}

/**
 * 获取当前主题组合的简短标签与描述
 */
export function getThemeStyleSummary(
  interactiveTheme: InteractiveThemeStyle = 'dark',
  slideTheme: SlideThemeStyle = 'light',
): { label: string; badge: string; isPreset: boolean; presetName?: string } {
  const matched = THEME_STYLE_PRESETS.find(
    (p) => p.interactiveTheme === interactiveTheme && p.slideTheme === slideTheme,
  );
  if (matched) {
    return {
      label: matched.name,
      badge: matched.badge,
      isPreset: true,
      presetName: matched.name,
    };
  }

  const slideLabel = slideTheme === 'dark' ? '深色讲义' : '浅色讲义';
  const interactiveLabel = interactiveTheme === 'light' ? '浅色交互' : '深色交互';
  return {
    label: `${interactiveLabel} · ${slideLabel}`,
    badge: `${interactiveLabel} + ${slideLabel}`,
    isPreset: false,
  };
}
