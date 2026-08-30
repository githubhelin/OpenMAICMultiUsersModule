'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { AVATAR_OPTIONS } from '@/lib/store/user-profile';
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
import { Loader2, ShieldCheck, User as UserIcon, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

export function UserProfileDialog() {
  const { user, profileModalOpen, setProfileModalOpen, updateProfile } = useAuthStore();

  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('/avatars/user.png');
  const [bio, setBio] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setNickname(user.nickname || '');
      setAvatar(user.avatar || '/avatars/user.png');
      setBio(user.bio || '');
    }
  }, [user, profileModalOpen]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword) {
      if (!currentPassword) {
        setError('修改密码时必须输入当前密码');
        return;
      }
      if (newPassword.length < 6) {
        setError('新密码长度不能少于 6 位');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('两次输入的新密码不一致');
        return;
      }
    }

    setLoading(true);
    const res = await updateProfile({
      nickname: nickname.trim(),
      avatar,
      bio: bio.trim(),
      currentPassword: currentPassword || undefined,
      newPassword: newPassword || undefined,
    });
    setLoading(false);

    if (!res.success) {
      setError(res.error || '更新失败');
    } else {
      toast.success('个人资料已更新');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setProfileModalOpen(false);
    }
  };

  return (
    <Dialog open={profileModalOpen} onOpenChange={setProfileModalOpen}>
      <DialogContent className="sm:max-w-[480px] p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl">
        <DialogHeader className="mb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <UserIcon className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              个人资料与账户安全
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
            用户名: <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{user.username}</span>
            {user.role === 'admin' && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md font-semibold">
                <ShieldCheck className="w-3 h-3" /> 超级管理员
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar picker */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              选择头像
            </Label>
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
              {AVATAR_OPTIONS.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setAvatar(av)}
                  className={`relative p-0.5 rounded-full transition-all shrink-0 ${
                    avatar === av
                      ? 'ring-2 ring-primary ring-offset-2 scale-105 shadow-md'
                      : 'opacity-70 hover:opacity-100 hover:scale-100'
                  }`}
                >
                  <img src={av} alt="Avatar" className="w-10 h-10 rounded-full object-cover bg-zinc-100 dark:bg-zinc-800" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              显示昵称
            </Label>
            <Input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={loading}
              className="rounded-xl h-9 text-sm"
            />
          </div>

          {/* Password Section */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              <KeyRound className="w-3.5 h-3.5" />
              修改密码（不填则保持不变）
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-zinc-500">
                当前密码
              </Label>
              <Input
                type="password"
                placeholder="若要改密码请输入当前密码"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading}
                className="rounded-xl h-8.5 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-zinc-500">
                  新密码
                </Label>
                <Input
                  type="password"
                  placeholder="至少 6 位"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  className="rounded-xl h-8.5 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-zinc-500">
                  确认新密码
                </Label>
                <Input
                  type="password"
                  placeholder="再次输入"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="rounded-xl h-8.5 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setProfileModalOpen(false)}
              disabled={loading}
              className="rounded-xl h-9 text-xs"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl h-9 text-xs font-semibold shadow-md shadow-primary/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存修改'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
