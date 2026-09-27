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
    structure: '情境导入 ➔ 核心精讲 ➔ 互动探究 ➔ 随堂小测 ➔ 要点总结',
  },
  standard: {
    id: 'standard',
    label: '标准课时',
    badge: '10~13页',
    slides: '10~13 页',
    description: '双核螺旋，深度交替',
    structure: '导入 ➔ 基础精讲 ➔ 互动探究 ➔ 巩固小测 ➔ 进阶精讲 ➔ 实战挑战 ➔ 应用小测 ➔ 总结复盘',
  },
  thematic: {
    id: 'thematic',
    label: '专题大课',
    badge: '16~20页',
    slides: '16~20 页',
    description: '多阶递进，深度实战',
    structure: '路线图 ➔ 三阶段「理论+实验+小测」螺旋递进 ➔ 避坑辨析 ➔ 终极知识图谱',
  },
};

export function buildCourseScaleInstruction(scale?: CourseScale): string {
  if (scale === 'micro') {
    return `

【课程篇幅与教学结构规范 - 微课精讲模式 (6~8页)】
- 遵循 OpenMAIC 标准教学范式，绝不随意精简或压缩教学逻辑，保持知识呈现的完整度与深度。
- 目标页数：总场景数严格控制在 6~8 页。
- 教学结构必须严格按照以下场景类型与螺旋链路交替展开：
  1. [第1页] type: "slide" — 核心情境驱动、痛点问题导入与本课学习目标。
  2. [第2~3页] type: "slide" — 核心概念、关键原理、数学公式或算法机制层层深入精讲。
  3. [第4页] type: "interactive" — 针对核心概念的互动仿真实验/探究游戏（必须提供 widgetType 与 widgetOutline，让学生动手操控变量探究规律）。
  4. [第5页] type: "slide" — 进阶参数规律、应用技巧或要点提炼。
  5. [倒数第2页] type: "quiz" — 随堂过关小测验，检测关键概念掌握程度（必须提供 quizConfig: { "questionCount": 2, "difficulty": "medium", "questionTypes": ["single", "multiple"] }）。
  6. [末页/最后一页] type: "slide" — 要点速记卡、关键结论梳理与全课总结展望（最后一页必须是 slide，严禁以 interactive 或 quiz 结尾）。
- 【场景编排硬性铁律】：严禁连续两页或多页出现同一非幻灯片场景类型，全课仅安排 1 次随堂过关小测，绝不能连续安排多个小测。`;
  }
  if (scale === 'thematic') {
    return `

【课程篇幅与教学结构规范 - 专题大课模式 (16~20页)】
- 遵循 OpenMAIC 标准教学范式，体系化展开复杂专题，绝不省略推导过程与分层认知建构，保障大体量课程的严谨与充实。
- 目标页数：总场景数展开为 16~20 页深度篇幅。
- 教学结构必须严格遵循“多阶段认知螺旋进阶体系”（各阶段内：理论精讲 ➔ 动手实验 ➔ 即时达标小测，阶段交替推进）：
  - 【阶段一：宏观导引与基石理论闭环（第1~5页）】
    1. [第1页] type: "slide" — 专题大背景、工程/学术挑战与全课学习路线图。
    2. [第2~3页] type: "slide" — 基础概念体系剖析与底层原理深度推导。
    3. [第4页] type: "interactive" — 针对基础原理的科学仿真实验或动态参数图解（必须提供 widgetType 与 widgetOutline）。
    4. [第5页] type: "quiz" — 【阶段一随堂小测：基础原理达标】（必须提供 quizConfig: 2题）。
  - 【阶段二：核心规律与进阶机制闭环（第6~10页）】
    5. [第6~7页] type: "slide" — 进阶机制推导、系统流程与多维度对比分析。
    6. [第8~9页] type: "interactive" — 复杂算法可视化沙箱、动态模拟器或多变量对比实验。
    7. [第10页] type: "quiz" — 【阶段二随堂小测：进阶机制与规律分析】（必须提供 quizConfig: 2题）。
  - 【阶段三：工程实战与排障攻坚闭环（第11~15页）】
    8. [第11~12页] type: "slide" — 工业级/现实复杂案例深度剖析与系统架构拆解。
    9. [第13~14页] type: "interactive" — 综合挑战工坊、故障排查沙盘或决策模拟游戏。
    10. [第15页] type: "quiz" — 【阶段三随堂小测：综合实战与排障过关】（必须提供 quizConfig: 2题）。
  - 【阶段四：经验沉淀与终极收官（第16~18/20页）】
    11. [倒数第2~3页] type: "slide" — 常见误区避坑指南、工程最佳实践与前沿拓展。
    12. [最后一页] type: "slide" — 全课知识图谱梳理、思维导图总结、能力进阶勋章与课后实战探究（最后一页必须是 slide，严禁以 interactive 或 quiz 结尾）。
- 【场景编排硬性铁律（绝对禁止连续连刷）】：
  1. 严禁任何连续两页都是 type: "quiz"！每一次随堂小测必须紧跟在对应知识小节的互动实验之后，作为该阶段的过关检测；测验完成后必须进入下一阶段的理论精讲，坚决杜绝“连续两页做题”。
  2. 严禁所有互动场景集中堆叠在一起，必须与理论精讲交替穿插，形成“讲解 ➔ 实验 ➔ 小测 ➔ 进阶”的生动节奏。`;
  }
  // 'standard' or default
  return `

【课程篇幅与教学结构规范 - 标准课时模式 (10~13页)】
- 遵循 OpenMAIC 经典标准课堂教学范式，扎实推进认知闭环，绝不随意精简理论讲解、实验探索与测验复盘任何一个核心环节。
- 目标页数：总场景数保持在 10~13 页的标准完整课堂体量。
- 教学结构必须严格按照“双阶段认知进阶螺旋”交替递进展开：
  - 【阶段一：基础认知与即时过关（第1~5页）】
    1. [第1页] type: "slide" — 贴近现实的情境启发、核心悬念与学习目标铺垫。
    2. [第2~3页] type: "slide" — 由浅入深、梯度递进的概念定义、原理机制与结构化图表精讲。
    3. [第4页] type: "interactive" — 针对基础原理的科学仿真、交互图解或动态沙盒（必须提供 widgetType 与 widgetOutline，引导学生动手验证）。
    4. [第5页] type: "quiz" — 【第1次随堂小测：基础知识巩固】（必须提供 quizConfig: { "questionCount": 2, "difficulty": "medium", "questionTypes": ["single", "multiple"] }），检验基础概念理解。
  - 【阶段二：进阶深化与实战应用（第6~9页）】
    5. [第6~7页] type: "slide" — 进阶机制推导、复杂场景剖析或算法/工程案例深度解析。
    6. [第8页] type: "interactive" — 针对进阶难点的深度实验沙盒、代码工坊或决策闯关挑战（必须提供 widgetType 与 widgetOutline）。
    7. [第9页] type: "quiz" — 【第2次随堂小测：实战应用闯关】（必须提供 quizConfig: { "questionCount": 2, "difficulty": "medium", "questionTypes": ["single", "multiple"] }），检验实战应用与迁移能力。
  - 【阶段三：拓展辨析与全课收官（第10~11/12页）】
    8. [倒数第2页] type: "slide" — 易错点剖析、知识延伸与现实生活/行业应用。
    9. [末页/最后一页] type: "slide" — 核心要点回顾卡、思维升华与课后思考（最后一页必须是 slide，严禁以 interactive 或 quiz 结尾）。
- 【场景编排硬性铁律（绝对禁止连续连刷）】：
  1. 严禁连续两页或多页出现 type: "quiz"！两次随堂小测必须分别位于阶段一和阶段二末尾，中间必须相隔阶段二的进阶精讲与互动实验，坚决杜绝“连续两页做题刷题”！
  2. 严禁所有互动场景（interactive）连续堆叠排列，必须与理论精讲（slide）形成“讲解 ➔ 探究 ➔ 检测 ➔ 进阶 ➔ 挑战 ➔ 测验”的交替渐进节奏。`;
}
