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
    return '\n\n【课程篇幅与教学结构规范 - 微课精讲模式】\n- 目标页数：总场景数严格控制在 4~5 页（包含导入与总结）。\n- 教学节奏：聚焦单一核心知识点/公式/技能，直奔主题，避免冗长铺垫。\n- 结构配比：1页核心问题导入 -> 1页关键原理/参数精讲 -> 1~2个针对性互动实验/练习小测 -> 1页速记卡与要点小结。\n- 纪律要求：严禁冗长背景介绍，开门见山，高密度探究。';
  }
  if (scale === 'thematic') {
    return '\n\n【课程篇幅与教学结构规范 - 专题大课模式】\n- 目标页数：总场景数展开为 12~15 页深度篇幅。\n- 教学节奏：适合专题复习或复杂工程/系统仿真项目，分层次阶梯式推进。\n- 结构配比：采用多阶段认知闭环（基础原理认知 -> 进阶规律探究 -> 综合实战/排障游戏），包含至少 3~4 个互动模拟/挑战部件，并在每个知识小节后插入 1 次阶段性小测，最后进行系统思维导图梳理与课后考核。\n- 纪律要求：避免连续堆砌纯理论文本，各阶段之间用过渡幻灯片平滑承接。';
  }
  // 'standard' or default
  return '\n\n【课程篇幅与教学结构规范 - 标准课时模式】\n- 目标页数：总场景数保持在 7~9 页的标准微课堂体量。\n- 教学节奏：经典认知闭环，由浅入深。\n- 结构配比：1页情境导入 -> 2页核心概念讲解 -> 2~3个互动探究实验/练习 -> 1~2次随堂小测 -> 1页总结反思与迁移应用。';
}
