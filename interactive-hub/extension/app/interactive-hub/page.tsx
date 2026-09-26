'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Gamepad2,
  Atom,
  GitBranch,
  Code2,
  Search,
  ExternalLink,
  Download,
  BookOpen,
  Sparkles,
  Maximize2,
  Minimize2,
  X,
  Play,
  Layers,
  LayoutGrid,
  ChevronRight,
  ArrowLeft,
  Loader2,
  FolderOpen,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface InteractiveItem {
  sceneId: string;
  order: number;
  title: string;
  widgetType: string;
  fileName: string;
  concept?: string;
  description?: string;
  size: number;
  createdAt: number;
  stageId: string;
  courseName: string;
}

interface CourseGroup {
  stageId: string;
  courseName: string;
  folderName: string;
  updatedAt: number;
  items: InteractiveItem[];
}

interface OverviewData {
  courses: Array<{
    stageId: string;
    courseName: string;
    folderName: string;
    updatedAt: number;
    items: Array<Omit<InteractiveItem, 'stageId' | 'courseName'>>;
  }>;
  totalItems: number;
  typeCounts: {
    game: number;
    simulation: number;
    diagram: number;
    code: number;
    other: number;
  };
}

export default function InteractiveHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [data, setData] = useState<OverviewData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'flat' | 'course'>('flat');

  // Active playing item in modal
  const [activeItem, setActiveItem] = useState<InteractiveItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Load interactive library data
  const loadData = async (forceSync = false) => {
    try {
      if (forceSync) {
        setSyncing(true);
      } else {
        setLoading(true);
      }
      const url = forceSync ? '/api/interactive-library?refresh=1' : '/api/interactive-library';
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const payload = json.data || (json.courses ? json : null);
        if (payload) {
          setData(payload);
          if (forceSync) {
            setSyncMessage(`已成功完成归集！当前收录 ${payload.totalItems} 个互动场景，涵盖 ${payload.courses.length} 门课程`);
            setTimeout(() => setSyncMessage(null), 4000);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load interactive library:', err);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  // Trigger server-side full rescan & packaging
  const triggerForceRescan = async (deepForce = false) => {
    try {
      setSyncing(true);
      const res = await fetch('/api/interactive-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: deepForce }),
      });
      if (res.ok) {
        const json = await res.json();
        const payload = json.data || (json.courses ? json : null);
        if (payload) {
          setData(payload);
          setSyncMessage(
            `全量扫描与同步归集成功！共检索到 ${payload.totalItems} 个互动场景（涵盖 ${payload.courses.length} 门课程）`
          );
          setTimeout(() => setSyncMessage(null), 4500);
        }
      }
    } catch (err) {
      console.error('Failed to sync interactive library:', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Flatten all items with course details attached
  const allItems: InteractiveItem[] = useMemo(() => {
    if (!data?.courses) return [];
    const list: InteractiveItem[] = [];
    for (const c of data.courses) {
      for (const item of c.items) {
        list.push({
          ...item,
          stageId: c.stageId,
          courseName: c.courseName,
        });
      }
    }
    return list;
  }, [data]);

  // Filter items by type and search query
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      const matchesType =
        selectedType === 'all' || item.widgetType.toLowerCase() === selectedType.toLowerCase();

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.courseName.toLowerCase().includes(q) ||
        (item.concept && item.concept.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q));

      return matchesType && matchesSearch;
    });
  }, [allItems, selectedType, searchQuery]);

  // Group filtered items by course
  const courseGroups = useMemo(() => {
    const map = new Map<string, CourseGroup>();
    for (const item of filteredItems) {
      if (!map.has(item.stageId)) {
        map.set(item.stageId, {
          stageId: item.stageId,
          courseName: item.courseName,
          folderName: `${item.courseName}_${item.stageId}`,
          updatedAt: item.createdAt,
          items: [],
        });
      }
      map.get(item.stageId)!.items.push(item);
    }
    return Array.from(map.values());
  }, [filteredItems]);

  const getTypeMeta = (type: string) => {
    const t = type.toLowerCase();
    switch (t) {
      case 'game':
        return {
          label: '互动游戏',
          color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
          badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
          icon: Gamepad2,
        };
      case 'simulation':
        return {
          label: '科学仿真',
          color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
          icon: Atom,
        };
      case 'diagram':
        return {
          label: '算法图解',
          color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
          icon: GitBranch,
        };
      case 'code':
        return {
          label: '代码工坊',
          color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
          icon: Code2,
        };
      default:
        return {
          label: '互动实验',
          color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
          icon: Sparkles,
        };
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* 顶部主导航条 */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/')}
              className="gap-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>首页</span>
            </Button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-xs">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  互动展厅
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                    独立离线应用
                  </Badge>
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  全站仿真模拟、闯关游戏与图解实验集成中心
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerForceRescan(false)}
              disabled={syncing || loading}
              className="gap-1.5 text-xs text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40"
              title="重新扫描全站课程并归集所有互动内容"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? '正在归集...' : '强制同步归集'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/my-courses')}
              className="gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
            >
              <BookOpen className="w-3.5 h-3.5" />
              我的课程
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/batch-studio')}
              className="gap-1.5 text-xs text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
            >
              <Sparkles className="w-3.5 h-3.5" />
              批量制课
            </Button>
          </div>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* 同步提示通知条 */}
        {syncMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-2xl text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="font-medium">{syncMessage}</span>
            </div>
            <button
              onClick={() => setSyncMessage(null)}
              className="text-emerald-500 hover:text-emerald-700 text-xs px-2 py-0.5 rounded-md hover:bg-emerald-500/10"
            >
              关闭
            </button>
          </div>
        )}
        {/* 顶部统计面板 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <div
            onClick={() => setSelectedType('all')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              selectedType === 'all'
                ? 'bg-white dark:bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500">全部互动内容</span>
              <Layers className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight">{data?.totalItems ?? 0}</div>
            <div className="text-[10px] text-slate-400">涵盖 {data?.courses.length ?? 0} 门课程</div>
          </div>

          <div
            onClick={() => setSelectedType('game')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              selectedType === 'game'
                ? 'bg-white dark:bg-slate-900 border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">🎮 互动小游戏</span>
              <Gamepad2 className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
              {data?.typeCounts.game ?? 0}
            </div>
            <div className="text-[10px] text-slate-400">通关与趣味策略</div>
          </div>

          <div
            onClick={() => setSelectedType('simulation')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              selectedType === 'simulation'
                ? 'bg-white dark:bg-slate-900 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">🔬 科学与算法仿真</span>
              <Atom className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {data?.typeCounts.simulation ?? 0}
            </div>
            <div className="text-[10px] text-slate-400">动态参数与机理推演</div>
          </div>

          <div
            onClick={() => setSelectedType('diagram')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              selectedType === 'diagram'
                ? 'bg-white dark:bg-slate-900 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">📊 动态流程图解</span>
              <GitBranch className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {data?.typeCounts.diagram ?? 0}
            </div>
            <div className="text-[10px] text-slate-400">结构透视与算法导图</div>
          </div>

          <div
            onClick={() => setSelectedType('code')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              selectedType === 'code'
                ? 'bg-white dark:bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">💻 代码交互工坊</span>
              <Code2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {data?.typeCounts.code ?? 0}
            </div>
            <div className="text-[10px] text-slate-400">代码拼装与状态执行</div>
          </div>
        </div>

        {/* 筛选与搜索工具条 */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="搜索互动游戏、仿真实验或课程名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
            {/* 快速刷新按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerForceRescan(false)}
              disabled={syncing || loading}
              className="gap-1 px-2.5 h-8 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 border-slate-200 dark:border-slate-700"
              title="刷新全量归集数据"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{syncing ? '同步中...' : '刷新'}</span>
            </Button>

            {/* 视图切换按钮 */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
              <button
                onClick={() => setViewMode('flat')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'flat'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                全部卡片 ({filteredItems.length})
              </button>
              <button
                onClick={() => setViewMode('course')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'course'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                按课程归类 ({courseGroups.length})
              </button>
            </div>
          </div>
        </div>

        {/* 内容展示区 */}
        {loading ? (
          <div className="py-24 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
            <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
              正在加载互动展厅...
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
            <Gamepad2 className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
              未找到匹配的互动内容
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              尝试清除筛选条件，或点击下方按钮执行全量重新扫描与归集。
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedType('all');
                  setSearchQuery('');
                }}
              >
                重置筛选条件
              </Button>
              <Button
                size="sm"
                onClick={() => triggerForceRescan(false)}
                disabled={syncing}
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? '正在扫描全量课程...' : '全量重新扫描与归集'}
              </Button>
            </div>
          </div>
        ) : viewMode === 'flat' ? (
          /* 全部卡片网格流 */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const meta = getTypeMeta(item.widgetType);
              const Icon = meta.icon;
              return (
                <div
                  key={`${item.stageId}-${item.sceneId}`}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 flex flex-col justify-between hover:shadow-md hover:border-indigo-500/30 transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${meta.color}`}
                      >
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatFileSize(item.size)} · 离线HTML
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                      {item.title}
                    </h3>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl mb-3 line-clamp-2">
                      {item.description || item.concept || '独立自包含交互式单页面应用，支持脱机运行'}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate" title={item.courseName}>
                        {item.courseName}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">·</span>
                      <span className="shrink-0 text-slate-400">P{item.order}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      onClick={() => setActiveItem(item)}
                      className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs h-8 px-3 font-medium flex-1 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      在线体验
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        window.open(
                          `/api/interactive-library/${item.stageId}/${encodeURIComponent(item.fileName)}`,
                          '_blank',
                        )
                      }
                      title="在新标签页独立打开"
                      className="w-8 h-8 rounded-xl border-slate-200 dark:border-slate-800 cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    </Button>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        window.open(
                          `/api/interactive-library/${item.stageId}/${encodeURIComponent(item.fileName)}?download=1`,
                          '_blank',
                        )
                      }
                      title="下载单文件自包含 HTML"
                      className="w-8 h-8 rounded-xl border-slate-200 dark:border-slate-800 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 按课程归类折叠视图 */
          <div className="space-y-6">
            {courseGroups.map((group) => (
              <div
                key={group.stageId}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs"
              >
                <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        {group.courseName}
                      </h2>
                      <div className="text-[11px] text-slate-400">
                        课程 ID: {group.stageId} · 包含 {group.items.length} 个独立互动页面
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/classroom/${group.stageId}`)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 gap-1"
                  >
                    <span>进入授课</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {group.items.map((item) => {
                    const meta = getTypeMeta(item.widgetType);
                    const Icon = meta.icon;
                    return (
                      <div
                        key={item.sceneId}
                        className="bg-slate-50 dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200/60 dark:border-slate-800/80 flex flex-col justify-between hover:bg-slate-100/80 dark:hover:bg-slate-900 transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border flex items-center gap-1 ${meta.color}`}
                            >
                              <Icon className="w-2.5 h-2.5" />
                              {meta.label}
                            </span>
                            <span className="text-[10px] text-slate-400">第 {item.order} 页</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1 line-clamp-1">
                            {item.title}
                          </h4>
                          <p className="text-[10px] text-slate-500 line-clamp-2 mb-3">
                            {item.description || item.concept || '单文件自包含 HTML 应用'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/50 dark:border-slate-800">
                          <Button
                            size="sm"
                            onClick={() => setActiveItem(item)}
                            className="h-7 text-[11px] px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white flex-1 rounded-lg gap-1 cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            体验
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              window.open(
                                `/api/interactive-library/${item.stageId}/${encodeURIComponent(item.fileName)}`,
                                '_blank',
                              )
                            }
                            className="h-7 w-7 rounded-lg"
                            title="新窗口打开"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              window.open(
                                `/api/interactive-library/${item.stageId}/${encodeURIComponent(item.fileName)}?download=1`,
                                '_blank',
                              )
                            }
                            className="h-7 w-7 rounded-lg"
                            title="下载 HTML"
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 在线体验弹窗播放器 (Modal Player) */}
      <Dialog open={Boolean(activeItem)} onOpenChange={(open) => !open && setActiveItem(null)}>
        <DialogContent
          className={`p-0 gap-0 overflow-hidden bg-slate-950 border-slate-800 transition-all ${
            isFullscreen
              ? 'fixed inset-0 w-screen h-screen max-w-none rounded-none'
              : 'max-w-5xl h-[85vh] rounded-2xl'
          }`}
          showCloseButton={false}
        >
          {activeItem && (
            <div className="flex flex-col h-full w-full">
              {/* 弹窗顶部栏 */}
              <div className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between gap-3 text-white shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded font-medium shrink-0">
                    {getTypeMeta(activeItem.widgetType).label}
                  </span>
                  <span className="text-xs font-bold truncate text-slate-100">
                    {activeItem.title}
                  </span>
                  <span className="text-slate-600 hidden sm:inline">|</span>
                  <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                    {activeItem.courseName} (第 {activeItem.order} 页)
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      window.open(
                        `/api/interactive-library/${activeItem.stageId}/${encodeURIComponent(activeItem.fileName)}`,
                        '_blank',
                      )
                    }
                    className="h-8 px-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800"
                    title="新窗口打开"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    <span>新窗口</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      window.open(
                        `/api/interactive-library/${activeItem.stageId}/${encodeURIComponent(activeItem.fileName)}?download=1`,
                        '_blank',
                      )
                    }
                    className="h-8 px-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800"
                    title="下载单文件 HTML"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    <span>下载</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                    title={isFullscreen ? '退出全屏' : '全屏'}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setActiveItem(null);
                      setIsFullscreen(false);
                    }}
                    className="h-8 w-8 text-slate-400 hover:text-white hover:bg-red-950/60 hover:text-red-400"
                    title="关闭"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* iframe 沙箱播放容器 */}
              <div className="flex-1 w-full h-full bg-white relative">
                <iframe
                  src={`/api/interactive-library/${activeItem.stageId}/${encodeURIComponent(activeItem.fileName)}`}
                  className="w-full h-full border-0 absolute inset-0"
                  title={activeItem.title}
                  sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
