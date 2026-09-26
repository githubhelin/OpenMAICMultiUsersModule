'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileText,
  Layers,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  ExternalLink,
  Edit3,
  Trash2,
  Volume2,
  Image as ImageIcon,
  Check,
  Ban,
  XCircle,
  Zap,
  Target,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import type { BatchJob, BatchJobMode, BatchSubTask } from '@/lib/server/batch-generation/types';
import { type CourseScale, COURSE_SCALES } from '@/lib/types/course-scale';

export default function BatchStudioPage() {
  const router = useRouter();

  // 状态
  const [activeTab, setActiveTab] = useState<'create' | 'board'>('create');
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<BatchJobMode>('batch_independent');
  const [prompt, setPrompt] = useState<string>(
    '提炼核心教学重难点，为每一页生成生动精彩的教师讲解台词与互动问答，制作富有沉浸感的互动微课堂。',
  );
  const [enableTTS, setEnableTTS] = useState<boolean>(true);
  const [enableImageGeneration, setEnableImageGeneration] = useState<boolean>(true);
  const [enableInteractiveMode, setEnableInteractiveMode] = useState<boolean>(false);
  const [courseScale, setCourseScale] = useState<CourseScale>('standard');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [cancellingJob, setCancellingJob] = useState<boolean>(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<BatchJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<
    Array<{
      id: string;
      title: string;
      status: string;
      progress: number;
      createdAt: string;
      totalTasks: number;
      completedTasks: number;
      cancelledTasks?: number;
    }>
  >([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 文件选择与拖拽
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selected]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const dropped = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...dropped]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 提交任务
  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error('请至少上传一个课件文件！');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('mode', mode);
    formData.append('prompt', prompt);
    formData.append('enableTTS', enableTTS ? 'true' : 'false');
    formData.append('enableImageGeneration', enableImageGeneration ? 'true' : 'false');
    formData.append('enableInteractiveMode', enableInteractiveMode ? 'true' : 'false');
    formData.append('courseScale', courseScale);

    try {
      const res = await fetch('/api/batch-generate', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || '创建批量制课任务失败');
      }

      toast.success('批量制课任务已成功提交，后台正在全力流水线生产中！');
      setActiveJobId(data.batchId);
      setActiveTab('board');
      setFiles([]);
      loadJobDetails(data.batchId);
      loadRecentJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '提交任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 查询当前作业详情
  const loadJobDetails = async (jobId: string) => {
    try {
      const res = await fetch(`/api/batch-generate/${jobId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.job) {
          setCurrentJob(data.job);
        }
      }
    } catch {
      // 忽略轻微轮询错误
    }
  };

  // 查询历史作业列表
  const loadRecentJobs = async () => {
    try {
      const res = await fetch('/api/batch-generate');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.jobs) {
          setRecentJobs(data.jobs);
          if (!activeJobId && data.jobs.length > 0) {
            setActiveJobId(data.jobs[0].id);
          }
        }
      }
    } catch {
      // 忽略轻微错误
    }
  };

  useEffect(() => {
    loadRecentJobs();
  }, []);

  // 自动轮询进度
  useEffect(() => {
    if (!activeJobId) return;

    loadJobDetails(activeJobId);

    const isRunning =
      !currentJob || currentJob.status === 'queued' || currentJob.status === 'processing';

    if (isRunning) {
      const timer = setInterval(() => {
        loadJobDetails(activeJobId);
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [activeJobId, currentJob?.status]);

  // 中断整个任务
  const handleCancelJob = async () => {
    if (!currentJob) return;

    const confirmed = window.confirm(
      '确定要中断当前批量制课任务吗？\n\n中断后将立即停止正在运行的生成，并取消所有队列中尚未制作的课件，避免额外浪费 Token 资源。',
    );
    if (!confirmed) return;

    setCancellingJob(true);
    try {
      const res = await fetch(`/api/batch-generate/${currentJob.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '中断任务失败');
      }
      toast.success('任务已成功中断，已停止后续文件生成与 Token 消耗');
      await loadJobDetails(currentJob.id);
      await loadRecentJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '中断操作失败');
    } finally {
      setCancellingJob(false);
    }
  };

  // 从队列中移除/取消某个待生成的子任务
  const handleCancelSubTask = async (taskId: string, fileName: string) => {
    if (!currentJob) return;

    const confirmed = window.confirm(
      `确定要将课件「${fileName}」从生成队列中移除吗？\n\n移除后该课件将不会被制作，为您节省大模型 Token。`,
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/batch-generate/${currentJob.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel_task', taskId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '移除子任务失败');
      }
      toast.success(`已将「${fileName}」从队列中移除`);
      await loadJobDetails(currentJob.id);
      await loadRecentJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '移除失败');
    }
  };

  // 删除任务记录
  const handleDeleteJob = async (jobId: string) => {
    const confirmed = window.confirm(
      '确定要彻底删除该批处理任务记录吗？相关临时缓存文件也将被清理。',
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/batch-generate/${jobId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || '删除记录失败');
      }
      toast.success('任务记录已彻底删除');
      if (activeJobId === jobId) {
        setActiveJobId(null);
        setCurrentJob(null);
      }
      await loadRecentJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const getStepBadge = (task: BatchSubTask) => {
    switch (task.status) {
      case 'extracting':
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
            MinerU 解析提取中
          </Badge>
        );
      case 'planning_outline':
        return (
          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">
            大纲规划中
          </Badge>
        );
      case 'building_scenes':
        return (
          <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30">
            场景与互动构建
          </Badge>
        );
      case 'generating_tts':
        return (
          <Badge className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
            TTS 语音合成中
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            已完成
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="outline" className="border-slate-300 text-slate-400 dark:border-slate-700">
            已取消/已移除
          </Badge>
        );
      case 'failed':
        return <Badge variant="destructive">生成失败</Badge>;
      default:
        return <Badge variant="outline">队列排队中</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* 顶部导航 */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="gap-1.5 text-slate-600 dark:text-slate-300"
            >
              <ArrowLeft className="w-4 h-4" />
              返回首页
            </Button>
            <div className="h-4 w-px bg-slate-200 dark:border-slate-700" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white shadow-sm shadow-orange-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h1 className="font-semibold text-base leading-tight">批量快速制课工坊</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  免交互对话 · 批量课件导入 · 全自动生产
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'create' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('create')}
              className="gap-1.5"
            >
              <UploadCloud className="w-4 h-4" />
              新建任务
            </Button>
            <Button
              variant={activeTab === 'board' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setActiveTab('board');
                if (!activeJobId && recentJobs.length > 0) {
                  setActiveJobId(recentJobs[0].id);
                }
              }}
              className="gap-1.5 relative"
            >
              <Layers className="w-4 h-4" />
              任务看板
              {currentJob && currentJob.status === 'processing' && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse absolute -top-0.5 -right-0.5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* 主工作区 */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {activeTab === 'create' ? (
          /* 新建批量制课任务 */
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight mb-1">新建批量制课任务</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                上传一个或多个课件资料，选择制课策略，系统将在后台自动解析并完成课程组装。
              </p>
            </div>

            {/* 文件上传区 */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500/70 dark:hover:border-amber-500/70 rounded-2xl p-8 text-center cursor-pointer transition-all bg-white dark:bg-slate-900/50 hover:bg-amber-50/20 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pptx,.pdf,.docx,.txt,.md"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="font-medium text-sm mb-1">
                点击或拖拽课件文件到此处（支持批量多选）
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                支持 PPTX、PDF（高精 MinerU 解析）、DOCX、Markdown、TXT 格式
              </p>
            </div>

            {/* 已选文件列表 */}
            {files.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>已选择 {files.length} 个课件文件：</span>
                  <button
                    onClick={() => setFiles([])}
                    className="text-red-500 hover:underline hover:text-red-600"
                  >
                    清空列表
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {files.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs shadow-xs"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="truncate font-medium">{file.name}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(idx);
                        }}
                        className="text-slate-400 hover:text-red-500 p-1 shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 模式选择 */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                生成模式选择
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => setMode('batch_independent')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    mode === 'batch_independent'
                      ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-500" />
                      批量独立生成 (一对一)
                    </span>
                    {mode === 'batch_independent' && (
                      <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    每个文件生成一门独立的微课堂。后台自动化队列排队依次生产（上传 10 个课件即生成 10 门课）。
                  </p>
                </div>

                <div
                  onClick={() => setMode('single_merged')}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    mode === 'single_merged'
                      ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      多资料融合为一课 (多合一)
                    </span>
                    {mode === 'single_merged' && (
                      <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    将上传的所有资料内容深度融合、萃取关键考点，制作一门章节知识全面的综合互动微课。
                  </p>
                </div>
              </div>
            </div>

            {/* 指导要求配置 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                教学总要求 / 提示词指导 (Prompt)
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="w-full text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                placeholder="输入指导生成的总要求，例如：语气亲切幽默，增加针对性测验..."
              />
            </div>

            {/* 课程篇幅与形态规格选择 */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-500" />
                  课程篇幅与教学形态
                </span>
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  针对不同教学场景控制课件总页数与互动结构
                </span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(Object.keys(COURSE_SCALES) as CourseScale[]).map((scaleKey) => {
                  const item = COURSE_SCALES[scaleKey];
                  const isSelected = courseScale === scaleKey;
                  return (
                    <div
                      key={scaleKey}
                      onClick={() => setCourseScale(scaleKey)}
                      className={`cursor-pointer p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/40'
                          : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-semibold text-xs flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                          {scaleKey === 'micro' && <Zap className="w-3.5 h-3.5 text-amber-500" />}
                          {scaleKey === 'standard' && <Target className="w-3.5 h-3.5 text-cyan-500" />}
                          {scaleKey === 'thematic' && <BookOpen className="w-3.5 h-3.5 text-violet-500" />}
                          {item.label}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {item.description}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 line-clamp-1">
                        {item.structure}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 附加功能开关（包含深度交互、TTS、配图） */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {/* 深度交互模式 */}
                <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 hover:border-amber-500/40 transition-colors">
                  <Switch
                    checked={enableInteractiveMode}
                    onCheckedChange={setEnableInteractiveMode}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      深度交互模式
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      强化互动与练习，优先生成互动探究与问答场景
                    </p>
                  </div>
                </label>

                {/* 语音旁白 */}
                <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 hover:border-amber-500/40 transition-colors">
                  <Switch
                    checked={enableTTS}
                    onCheckedChange={setEnableTTS}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                      <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                      教师语音旁白 (TTS)
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      使用系统配置的语音合成引擎生成拟真讲课台词
                    </p>
                  </div>
                </label>

                {/* AI 生图 */}
                <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 hover:border-amber-500/40 transition-colors">
                  <Switch
                    checked={enableImageGeneration}
                    onCheckedChange={setEnableImageGeneration}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                      <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                      AI 视觉配图
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      根据教学知识点智能生成生动的黑板多媒体插图
                    </p>
                  </div>
                </label>
              </div>

              <div className="text-[11px] text-slate-400 text-right pt-1">
                💡 自动继承系统默认配置的大模型、MinerU 解析与音色参数
              </div>
            </div>

            {/* 提交按钮 */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || files.length === 0}
              className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium text-sm gap-2 shadow-md shadow-orange-500/20"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  正在分发上传与解析...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  提交批量制课任务 {files.length > 0 && `(共 ${files.length} 个课件)`}
                </>
              )}
            </Button>
          </div>
        ) : (
          /* 任务看板 */
          <div className="space-y-6">
            {/* 顶部作业总览 */}
            {currentJob ? (
              <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-lg font-semibold">{currentJob.title}</h2>
                      <Badge
                        variant={
                          currentJob.status === 'completed'
                            ? 'default'
                            : currentJob.status === 'cancelled'
                            ? 'outline'
                            : currentJob.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className={
                          currentJob.status === 'cancelled'
                            ? 'border-red-400/40 text-red-500 bg-red-50/50 dark:bg-red-950/20'
                            : ''
                        }
                      >
                        {currentJob.status === 'completed'
                          ? '全部生产完成'
                          : currentJob.status === 'processing'
                          ? '正在流水线生产'
                          : currentJob.status === 'queued'
                          ? '排队等待执行'
                          : currentJob.status === 'cancelled'
                          ? '任务已中断取消'
                          : '处理异常'}
                      </Badge>
                      <Badge variant="outline">
                        {currentJob.mode === 'single_merged' ? '多资料合一' : '一对多批量'}
                      </Badge>
                      {currentJob.enableInteractiveMode && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                        >
                          深度交互模式
                        </Badge>
                      )}
                      {currentJob.courseScale && (
                        <Badge
                          variant="outline"
                          className="border-cyan-500/40 text-cyan-600 dark:text-cyan-400 bg-cyan-500/10"
                        >
                          {COURSE_SCALES[currentJob.courseScale]?.label || currentJob.courseScale} (
                          {COURSE_SCALES[currentJob.courseScale]?.badge || ''})
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      创建时间: {new Date(currentJob.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 中断运行中的任务 */}
                    {(currentJob.status === 'queued' || currentJob.status === 'processing') && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleCancelJob}
                        disabled={cancellingJob}
                        className="gap-1.5 h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                        title="立即中断当前任务，取消后续排队文件以避免浪费 Token"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        {cancellingJob ? '正在中断...' : '中断任务 (停止消耗 Token)'}
                      </Button>
                    )}

                    {/* 删除任务记录 */}
                    {(currentJob.status === 'completed' ||
                      currentJob.status === 'failed' ||
                      currentJob.status === 'cancelled' ||
                      currentJob.status === 'partially_failed') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteJob(currentJob.id)}
                        className="gap-1.5 h-8 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                        title="删除该批次任务记录"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除记录
                      </Button>
                    )}

                    {currentJob.resultClassroomUrl && (
                      <>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs"
                          onClick={() => window.open(currentJob.resultClassroomUrl, '_blank')}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          立即体验完整课堂
                        </Button>
                        {currentJob.resultStageId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              router.push(`/workspace?course=${currentJob.resultStageId}`)
                            }
                            className="gap-1.5 h-8 text-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            进入工作台编辑
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 总进度条 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span>
                      生产总进度: {currentJob.completedTasks} / {currentJob.totalTasks} 门课完成
                      {currentJob.failedTasks > 0 && ` (${currentJob.failedTasks} 门失败)`}
                      {(currentJob.cancelledTasks || 0) > 0 &&
                        ` (${currentJob.cancelledTasks} 门已取消)`}
                    </span>
                    <span className="text-amber-500 font-semibold">{currentJob.progress}%</span>
                  </div>
                  <Progress value={currentJob.progress} className="h-2.5" />
                </div>
              </Card>
            ) : (
              <div className="p-8 text-center text-slate-400 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl">
                暂未选中任何批处理任务，请点击“新建任务”发起课件生产。
              </div>
            )}

            {/* 子任务明细列表 */}
            {currentJob && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    课件流水线生产详情列表
                  </h3>
                  <span className="text-xs text-slate-400">
                    排队中的课件可点击「移除」跳过生成以节省资源
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {currentJob.tasks.map((task, idx) => (
                    <Card
                      key={task.id}
                      className={`p-4 border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                        task.status === 'cancelled'
                          ? 'bg-slate-100/50 dark:bg-slate-900/30 opacity-70'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-slate-400">#{idx + 1}</span>
                          <span className="font-medium text-sm truncate">{task.fileName}</span>
                          {getStepBadge(task)}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {task.stepMessage || '等待调度中...'}
                        </p>
                        {task.status !== 'completed' &&
                          task.status !== 'failed' &&
                          task.status !== 'cancelled' && (
                            <div className="w-full max-w-md pt-1">
                              <Progress value={task.progress} className="h-1.5" />
                            </div>
                          )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* 如果该任务处于 queued 队列排队状态，且整个作业未结束，允许单独移除 */}
                        {(currentJob.status === 'queued' ||
                          currentJob.status === 'processing') &&
                          task.status === 'queued' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 gap-1"
                              onClick={() => handleCancelSubTask(task.id, task.fileName)}
                              title="从制作队列中移除此文件，跳过制作以节省 Token"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              从队列移除
                            </Button>
                          )}

                        {task.classroomUrl && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => window.open(task.classroomUrl, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3" />
                              体验课堂
                            </Button>
                            {task.stageId && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1"
                                onClick={() => router.push(`/workspace?course=${task.stageId}`)}
                              >
                                <Edit3 className="w-3 h-3" />
                                工作区精修
                              </Button>
                            )}
                          </>
                        )}

                        {task.status === 'failed' && (
                          <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {task.error || '生成失败'}
                          </span>
                        )}

                        {task.status === 'cancelled' && (
                          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                            <Ban className="w-3 h-3" />
                            已取消
                          </span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* 历史批次切换 */}
            {recentJobs.length > 1 && (
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    历史生产批次
                  </h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={loadRecentJobs}
                    className="h-7 text-xs gap-1 text-slate-400 hover:text-slate-600"
                  >
                    <RefreshCw className="w-3 h-3" />
                    刷新
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentJobs.map((j) => (
                    <div key={j.id} className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={activeJobId === j.id ? 'secondary' : 'outline'}
                        onClick={() => {
                          setActiveJobId(j.id);
                          loadJobDetails(j.id);
                        }}
                        className={`text-xs gap-2 ${
                          j.status === 'cancelled'
                            ? 'border-red-200 dark:border-red-900/40 text-red-600/80 dark:text-red-400/80'
                            : ''
                        }`}
                      >
                        <span>{j.title}</span>
                        <span className="text-slate-400 font-mono">({j.progress}%)</span>
                      </Button>
                      <button
                        onClick={() => handleDeleteJob(j.id)}
                        className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                        title="删除此批次"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
