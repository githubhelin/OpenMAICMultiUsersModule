export type CourseScale = 'micro' | 'standard' | 'thematic';

export interface CourseScaleConfig {
  id: CourseScale;
  label: string;
  badge: string;
  slides: string;
  description: string;
  structure: string;
}

export const COURSE_SCALES: Record<CourseScale, CourseScaleConfig> = {
  micro: {
    id: 'micro',
    label: '微课精讲',
    badge: '4~5页',
    slides: '4~5 页',
    description: '单点突破，速战速决',
    structure: '1页导入 + 1页精讲 + 1~2个交互/小测 + 1页速记总结',
  },
  standard: {
    id: 'standard',
    label: '标准课时',
    badge: '7~9页',
    slides: '7~9 页',
    description: '经典闭环，均衡深入',
    structure: '1页导入 + 2页讲解 + 2~3个交互探究 + 1~2次小测 + 1页拓展',
  },
  thematic: {
    id: 'thematic',
    label: '专题大课',
    badge: '12~15页',
    slides: '12~15 页',
    description: '多阶递进，深度实战',
    structure: '多阶段认知闭环 + 3~4个深度实验/挑战 + 分段小测 + 系统考核',
  },
};

export function buildCourseScaleInstruction(scale?: CourseScale): string {
  if (scale === 'micro') {
    return `

【课程篇幅与教学结构规范 - 微课精讲模式】
- 目标页数：总场景数严格控制在 4~5 页。
- 场景结构配比（必须严格遵守以下场景类型组合）：
  1. [第1页] type: "slide" — 核心情境与关键问题导入。
  2. [第2页] type: "slide" — 关键原理与核心公式/参数精讲。
  3. [第3页] type: "interactive" — 针对性互动仿真/探究游戏（必须提供 widgetType 与 widgetOutline）。
  4. [第4页] type: "quiz" — 随堂过关小测验（必须提供 quizConfig: { "questionCount": 2, "difficulty": "medium", "questionTypes": ["single", "multiple"] }）。
  5. [第5页/末页] type: "slide" — 要点速记卡与全课总结展望（最后一页必须是 slide，严禁以 interactive 结尾）。`;
  }
  if (scale === 'thematic') {
    return `

【课程篇幅与教学结构规范 - 专题大课模式】
- 目标页数：总场景数展开为 12~15 页深度篇幅。
- 场景结构配比（必须严格遵守以下场景类型组合）：
  1. 理论与框架：2~3页 type: "slide"（情境导入、多层次知识精讲）。
  2. 深度互动：3~4页 type: "interactive"（仿真实验、探究游戏、算法可视化等，必须提供 widgetType 与 widgetOutline）。
  3. 阶段小测：2~3次 type: "quiz"（分别穿插在各个知识模块探究之后，必须提供 quizConfig: { "questionCount": 2, "difficulty": "medium", "questionTypes": ["single", "multiple"] }）。
  4. 最终收官：倒数第一页必须是 type: "slide"（全课知识图谱梳理、思维导图总结与课后拓展，最后一页必须是 slide，严禁以 interactive 结尾）。`;
  }
  // 'standard' or default
  return `

【课程篇幅与教学结构规范 - 标准课时模式】
- 目标页数：总场景数保持在 7~9 页的标准课堂体量。
- 场景结构配比（必须严格遵守以下场景类型组合）：
  1. 导入与精讲：2~3页 type: "slide"（情境导入、核心概念精讲）。
  2. 互动探究：2~3页 type: "interactive"（科学仿真/探究游戏/动态图解，必须提供 widgetType 与 widgetOutline）。
  3. 随堂小测：1~2次 type: "quiz"（穿插在互动探究之后巩固所学，必须提供 quizConfig: { "questionCount": 2, "difficulty": "medium", "questionTypes": ["single", "multiple"] }）。
  4. 总结收尾：最后一页必须是 type: "slide"（课程核心要点总结、认知升华与拓展，最后一页必须是 slide，严禁以 interactive 结尾）。`;
}
