'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useI18n } from '@/lib/hooks/use-i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, LogIn, UserPlus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export function AuthDialog() {
  const { authModalOpen, authModalTab, setAuthModalOpen, login, register } = useAuthStore();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>(authModalTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regNickname, setRegNickname] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const handleOpenChange = (open: boolean) => {
    setAuthModalOpen(open);
    if (!open) {
      setError(null);
    } else {
      setActiveTab(authModalTab);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword) {
      setError('请输入用户名和密码');
      return;
    }

    setError(null);
    setLoading(true);
    const res = await login(loginUsername.trim(), loginPassword);
    setLoading(false);

    if (!res.success) {
      setError(res.error || '登录失败，请检查账号密码');
    } else {
      toast.success('登录成功！');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername.trim() || !regPassword) {
      setError('请输入用户名和密码');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (regPassword.length < 6) {
      setError('密码长度不能少于 6 位');
      return;
    }

    setError(null);
    setLoading(true);
    const res = await register({
      username: regUsername.trim(),
      password: regPassword,
      nickname: regNickname.trim() || regUsername.trim(),
      email: regEmail.trim() || undefined,
    });
    setLoading(false);

    if (!res.success) {
      setError(res.error || '注册失败');
    } else {
      toast.success('注册成功并已自动登录！');
    }
  };

  return (
    <Dialog open={authModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl">
        <DialogHeader className="mb-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              OpenMAIC 账号中心
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
            登录后可在不同设备间无缝漫游您的课程、智能体会话与定制技能。
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as 'login' | 'register');
            setError(null);
          }}
          className="w-full mt-2"
        >
          <TabsList className="grid grid-cols-2 w-full mb-4 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <TabsTrigger value="login" className="rounded-lg font-medium text-xs py-2">
              <LogIn className="w-3.5 h-3.5 mr-1.5" />
              账号登录
            </TabsTrigger>
            <TabsTrigger value="register" className="rounded-lg font-medium text-xs py-2">
              <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              新用户注册
            </TabsTrigger>
          </TabsList>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-xs font-medium">
              {error}
            </div>
          )}

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  用户名 / 账号
                </Label>
                <Input
                  type="text"
                  placeholder="例如 admin 或 用户名"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  disabled={loading}
                  className="rounded-xl h-10 text-sm"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  登录密码
                </Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={loading}
                  className="rounded-xl h-10 text-sm"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl h-10 mt-2 font-semibold shadow-md shadow-primary/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    正在登录...
                  </>
                ) : (
                  '立即登录'
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  用户名 <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="仅限字母、数字、下划线（不少于3位）"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  disabled={loading}
                  className="rounded-xl h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  显示昵称（选填）
                </Label>
                <Input
                  type="text"
                  placeholder="用于课堂与讨论中显示"
                  value={regNickname}
                  onChange={(e) => setRegNickname(e.target.value)}
                  disabled={loading}
                  className="rounded-xl h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  电子邮箱（选填）
                </Label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  disabled={loading}
                  className="rounded-xl h-9 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    设置密码 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="password"
                    placeholder="至少 6 位"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    disabled={loading}
                    className="rounded-xl h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    确认密码 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="password"
                    placeholder="再次输入密码"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    disabled={loading}
                    className="rounded-xl h-9 text-sm"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl h-10 mt-2 font-semibold shadow-md shadow-primary/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    正在创建账号...
                  </>
                ) : (
                  '创建新账号'
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
