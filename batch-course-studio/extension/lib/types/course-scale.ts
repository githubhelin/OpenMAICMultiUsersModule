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
    badge: '6~8页',
    slides: '6~8 页',
    description: '单点精讲，完整闭环',
    structure: '1页导入 + 2页精讲 + 1~2个交互探究 + 1次小测 + 1页速记总结',
  },
  standard: {
    id: 'standard',
    label: '标准课时',
    badge: '10~13页',
    slides: '10~13 页',
    description: '经典闭环，均衡深入',
    structure: '1页导入 + 3~4页精讲 + 2~3个交互探究 + 2次随堂小测 + 1~2页拓展总结',
  },
  thematic: {
    id: 'thematic',
    label: '专题大课',
    badge: '16~20页',
    slides: '16~20 页',
    description: '多阶递进，深度实战',
    structure: '多阶段认知进阶 + 5~6页理论精讲 + 4~5个深度实验 + 2~3次分段小测 + 终极认证总结',
  },
};

export function buildCourseScaleInstruction(scale?: CourseScale): string {
  if (scale === 'micro') {
    return `

【课程篇幅与教学结构规范 - 微课精讲模式 (6~8页)】
- 遵循 OpenMAIC 标准教学范式，绝不随意精简或压缩教学逻辑，保持知识呈现的完整度与深度。
- 目标页数：总场景数严格控制在 6~8 页。
- 教学结构必须严格按照以下场景类型与逻辑链路展开：
  1. [第1页] type: "slide" — 核心情境驱动、痛点问题导入与本课学习目标。
  2. [第2~3页] type: "slide" — 核心概念、关键原理、数学公式或算法机制层层深入精讲（提供清晰的知识结构与图表说明）。
  3. [第4~5页] type: "interactive" — 1~2个针对性互动实验/科学仿真/探究游戏（必须提供 widgetType 与 widgetOutline，让学生动手操控变量探究规律）。
  4. [倒数第2页] type: "quiz" — 随堂过关小测验，检测关键概念掌握程度（必须提供 quizConfig: { "questionCount": 2, "difficulty": "medium", "questionTypes": ["single", "multiple"] }）。
  5. [末页/最后一页] type: "slide" — 要点速记卡、关键结论梳理与全课总结展望（最后一页必须是 slide，严禁以 interactive 或 quiz 结尾）。`;
  }
  if (scale === 'thematic') {
    return `

【课程篇幅与教学结构规范 - 专题大课模式 (16~20页)】
- 遵循 OpenMAIC 标准教学范式，体系化展开复杂专题，绝不省略推导过程与分层认知建构，保障大体量课程的严谨与充实。
- 目标页数：总场景数展开为 16~20 页深度篇幅。
- 教学结构必须采用多阶段认知进阶体系（基础认知 -> 进阶规律 -> 综合应用与工程实战）：
  1. 宏观导引（第1页）：type: "slide" — 专题大背景、工程/学术挑战与全课学习路线图。
  2. 理论框架精讲（共5~6页）：type: "slide" — 概念体系剖析、核心机制推导、系统流程与典型案例深度解析。
  3. 深度交互实验（共4~5页）：type: "interactive" — 覆盖各知识小节的深度科学仿真、算法可视化沙箱或决策挑战（必须提供 widgetType 与 widgetOutline）。
  4. 阶段性闯关检测（共2~3页）：type: "quiz" — 穿插在各个知识模块探究之后，检测阶段性掌握并给予即时反馈（必须提供 quizConfig: { "questionCount": 2, "difficulty": "medium", "questionTypes": ["single", "multiple"] }）。
  5. 经验迁移与避坑（1~2页）：type: "slide" — 常见误区辨析、工程最佳实践与前沿拓展。
  6. 终极收官（最后一页）：type: "slide" — 全课知识图谱梳理、思维导图总结、能力进阶勋章与课后实战探究（最后一页必须是 slide，严禁以 interactive 或 quiz 结尾）。`;
  }
  // 'standard' or default
  return `

【课程篇幅与教学结构规范 - 标准课时模式 (10~13页)】
- 遵循 OpenMAIC 经典标准课堂教学范式，扎实推进认知闭环，绝不随意精简理论讲解、实验探索与测验复盘任何一个核心环节。
- 目标页数：总场景数保持在 10~13 页的标准完整课堂体量。
- 教学结构必须严格按照以下场景类型与教学链路递进：
  1. 情境导入（第1页）：type: "slide" — 贴近现实的情境启发、核心悬念与学习目标铺垫。
  2. 核心精讲（共3~4页）：type: "slide" — 由浅入深、梯度递进的概念定义、原理机制与结构化图表精讲。
  3. 互动探究（共2~3页）：type: "interactive" — 科学仿真、交互图解、动态沙盒或探究游戏（必须提供 widgetType 与 widgetOutline，引导学生动手验证）。
  4. 随堂小测（共2页）：type: "quiz" — 包含知识点巩固测验与综合应用测验，检验实战掌握度（必须提供 quizConfig: { "questionCount": 2, "difficulty": "medium", "questionTypes": ["single", "multiple"] }）。
  5. 拓展辨析（1页）：type: "slide" — 易错点剖析、知识延伸与现实生活/行业应用。
  6. 总结复盘（最后一页）：type: "slide" — 核心要点回顾卡、思维升华与课后思考（最后一页必须是 slide，严禁以 interactive 或 quiz 结尾）。`;
}
