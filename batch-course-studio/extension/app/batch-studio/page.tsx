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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import type { BatchJob, BatchJobMode, BatchSubTask } from '@/lib/server/batch-generation/types';

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

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<BatchJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<Array<{ id: string; title: string; status: string; progress: number; createdAt: string }>>([]);

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

  const getStepBadge = (task: BatchSubTask) => {
    switch (task.status) {
      case 'extracting':
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">MinerU 解析提取中</Badge>;
      case 'planning_outline':
        return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">大纲规划中</Badge>;
      case 'building_scenes':
        return <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30">场景与互动构建</Badge>;
      case 'generating_tts':
        return <Badge className="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30">TTS 语音合成中</Badge>;
      case 'completed':
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">已完成</Badge>;
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
                  免交互对话 · 批量课件导入 · 全自动生成
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

      {/* 主体区域 */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {activeTab === 'create' ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* 上传卡片 */}
            <Card className="p-6 border-dashed border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 shadow-sm">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center py-8 cursor-pointer text-center group"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <h3 className="font-medium text-base mb-1">
                  拖拽课件文件到此处，或 <span className="text-amber-500 underline underline-offset-4">点击浏览文件</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                  支持多选上传 PPTX、PDF、DOCX、Markdown、TXT 等格式文档。系统将自动调用已配置的 MinerU 进行高精度排版与知识提取。
                </p>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pptx,.pdf,.docx,.doc,.txt,.md"
                  className="hidden"
                />
              </div>

              {files.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 px-1 mb-2">
                    <span>已选文件 ({files.length} 个)</span>
                    <button
                      type="button"
                      onClick={() => setFiles([])}
                      className="text-red-500 hover:underline"
                    >
                      清空全部
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {files.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs border border-slate-200/60 dark:border-slate-700/60"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                          <span className="font-medium truncate">{file.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-slate-400">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(idx);
                            }}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

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

            {/* 附加功能开关 */}
            <div className="flex flex-wrap items-center justify-between p-4 rounded-lg bg-slate-100/70 dark:bg-slate-900/80 gap-4 text-xs">
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={enableTTS} onCheckedChange={setEnableTTS} />
                  <span className="flex items-center gap-1 font-medium">
                    <Volume2 className="w-3.5 h-3.5 text-slate-500" />
                    生成教师讲解语音 (TTS)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={enableImageGeneration} onCheckedChange={setEnableImageGeneration} />
                  <span className="flex items-center gap-1 font-medium">
                    <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                    AI 智能多媒体配图
                  </span>
                </label>
              </div>

              <div className="text-slate-400 text-right">
                自动继承系统已配置的默认大模型与 MinerU 工具
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
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-semibold">{currentJob.title}</h2>
                      <Badge
                        variant={
                          currentJob.status === 'completed'
                            ? 'default'
                            : currentJob.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {currentJob.status === 'completed'
                          ? '全部生产完成'
                          : currentJob.status === 'processing'
                          ? '正在流水线生产'
                          : currentJob.status === 'queued'
                          ? '排队等待执行'
                          : '处理异常'}
                      </Badge>
                      <Badge variant="outline">
                        {currentJob.mode === 'single_merged' ? '多资料合一' : '一对多批量'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      创建时间: {new Date(currentJob.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {currentJob.resultClassroomUrl && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        onClick={() => window.open(currentJob.resultClassroomUrl, '_blank')}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        立即体验完整课堂
                      </Button>
                      {currentJob.resultStageId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/workspace?course=${currentJob.resultStageId}`)}
                          className="gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          进入工作台编辑
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* 总进度条 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span>
                      生产总进度: {currentJob.completedTasks} / {currentJob.totalTasks} 门课完成
                      {currentJob.failedTasks > 0 && ` (${currentJob.failedTasks} 门失败)`}
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
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  课件流水线生产详情列表
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {currentJob.tasks.map((task, idx) => (
                    <Card
                      key={task.id}
                      className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-400">#{idx + 1}</span>
                          <span className="font-medium text-sm truncate">{task.fileName}</span>
                          {getStepBadge(task)}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {task.stepMessage || '等待调度中...'}
                        </p>
                        {task.status !== 'completed' && task.status !== 'failed' && (
                          <div className="w-full max-w-md pt-1">
                            <Progress value={task.progress} className="h-1.5" />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
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
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* 历史批次切换 */}
            {recentJobs.length > 1 && (
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  历史生产批次
                </h4>
                <div className="flex flex-wrap gap-2">
                  {recentJobs.map((j) => (
                    <Button
                      key={j.id}
                      size="sm"
                      variant={activeJobId === j.id ? 'secondary' : 'outline'}
                      onClick={() => {
                        setActiveJobId(j.id);
                        loadJobDetails(j.id);
                      }}
                      className="text-xs gap-2"
                    >
                      <span>{j.title}</span>
                      <span className="text-slate-400 font-mono">({j.progress}%)</span>
                    </Button>
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
