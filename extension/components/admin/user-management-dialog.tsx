'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import type { SafeUser } from '@/lib/server/auth/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Shield,
  User as UserIcon,
  Search,
  MoreHorizontal,
  KeyRound,
  UserX,
  UserCheck,
  Trash2,
  UserPlus,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

export function UserManagementDialog() {
  const { user, adminModalOpen, setAdminModalOpen } = useAuthStore();
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Password reset dialog state
  const [resettingUser, setResettingUser] = useState<SafeUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // New user dialog state
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserNickname, setNewUserNickname] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [createLoading, setCreateLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!user || user.role !== 'admin') return;
    setLoading(true);
    try {
      const query = new URLSearchParams({ limit: '100' });
      if (search.trim()) query.set('search', search.trim());
      const res = await fetch(`/api/admin/users?${query.toString()}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
        setTotal(data.total || 0);
      }
    } catch {
      toast.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [user, search]);

  useEffect(() => {
    if (adminModalOpen) {
      fetchUsers();
    }
  }, [adminModalOpen, fetchUsers]);

  if (!user || user.role !== 'admin') return null;

  const handleToggleRole = async (targetUser: SafeUser) => {
    const nextRole = targetUser.role === 'admin' ? 'user' : 'admin';
    if (targetUser.id === user.id) {
      toast.error('不能修改自己的管理员权限');
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`已将 ${targetUser.username} 角色更改为 ${nextRole === 'admin' ? '管理员' : '普通用户'}`);
        fetchUsers();
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch {
      toast.error('网络错误');
    }
  };

  const handleToggleStatus = async (targetUser: SafeUser) => {
    if (targetUser.id === user.id) {
      toast.error('不能禁用自己的管理员账号');
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !targetUser.is_active }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`已${targetUser.is_active ? '禁用' : '启用'}用户 ${targetUser.username}`);
        fetchUsers();
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch {
      toast.error('网络错误');
    }
  };

  const handleDeleteUser = async (targetUser: SafeUser) => {
    if (targetUser.id === user.id) {
      toast.error('不能删除自己的管理员账号');
      return;
    }

    if (!confirm(`确定要彻底注销并删除用户 [${targetUser.username}] 吗？此操作不可逆！`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${targetUser.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`用户 ${targetUser.username} 已删除`);
        fetchUsers();
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch {
      toast.error('网络错误');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !newPassword || newPassword.length < 6) {
      toast.error('新密码至少需要 6 位');
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${resettingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`已重置用户 ${resettingUser.username} 的密码`);
        setResettingUser(null);
        setNewPassword('');
      } else {
        toast.error(data.error || '重置失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newUserPassword || newUserPassword.length < 6) {
      toast.error('用户名必填且密码不少于 6 位');
      return;
    }

    setCreateLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newUserPassword,
          nickname: newUserNickname.trim() || undefined,
          role: newUserRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`用户 ${newUsername} 创建成功`);
        setCreateUserOpen(false);
        setNewUsername('');
        setNewUserNickname('');
        setNewUserPassword('');
        fetchUsers();
      } else {
        toast.error(data.error || '创建失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <>
      <Dialog open={adminModalOpen} onOpenChange={setAdminModalOpen}>
        <DialogContent className="sm:max-w-[780px] max-h-[85vh] flex flex-col p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl">
          <DialogHeader className="mb-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    全站多用户管理控制台
                  </DialogTitle>
                  <DialogDescription className="text-xs text-zinc-500">
                    查看全站注册用户、分配管理员权限、重置密码或管理账户状态（共 {total} 个用户）。
                  </DialogDescription>
                </div>
              </div>
              <Button
                onClick={() => setCreateUserOpen(true)}
                size="sm"
                className="rounded-xl h-8.5 text-xs font-semibold gap-1.5 shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                添加用户
              </Button>
            </div>
          </DialogHeader>

          {/* Search bar */}
          <div className="flex items-center gap-2 my-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="搜索用户名、昵称或邮箱..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                className="pl-8.5 rounded-xl h-9 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUsers}
              disabled={loading}
              className="rounded-xl h-9 px-3 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* User Table */}
          <div className="flex-1 overflow-y-auto border border-zinc-100 dark:border-zinc-800 rounded-xl my-1">
            <Table>
              <TableHeader className="bg-zinc-50 dark:bg-zinc-800/50 sticky top-0">
                <TableRow className="text-[11px]">
                  <TableHead className="w-[180px]">用户</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-xs text-zinc-400">
                      {loading ? '正在加载用户数据...' : '没有找到相关用户'}
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id} className="text-xs hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <img src={u.avatar || '/avatars/user.png'} alt="" className="w-7 h-7 rounded-full bg-zinc-100 object-cover shrink-0" />
                          <div className="min-w-0">
                            <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate flex items-center gap-1">
                              {u.nickname || u.username}
                              {u.id === user.id && (
                                <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.2 rounded font-normal">您</span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono">@{u.username}</div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md">
                            <Shield className="w-2.5 h-2.5" /> 管理员
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                            <UserIcon className="w-2.5 h-2.5" /> 普通用户
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        {u.is_active ? (
                          <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 正常
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-red-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> 已封禁
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-[11px] text-zinc-400">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                      </TableCell>

                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs w-36 rounded-xl">
                            <DropdownMenuItem onClick={() => handleToggleRole(u)}>
                              <Shield className="w-3.5 h-3.5 mr-1.5" />
                              {u.role === 'admin' ? '降为普通用户' : '设为管理员'}
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => setResettingUser(u)}>
                              <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                              重置密码
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => handleToggleStatus(u)}>
                              {u.is_active ? (
                                <>
                                  <UserX className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                                  封禁账号
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                                  解封账号
                                </>
                              )}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => handleDeleteUser(u)}
                              className="text-red-600 dark:text-red-400 focus:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                              注销删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdminModalOpen(false)}
              className="rounded-xl h-8.5 text-xs"
            >
              关闭
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Reset Password Subdialog */}
      <Dialog open={!!resettingUser} onOpenChange={(open) => !open && setResettingUser(null)}>
        <DialogContent className="sm:max-w-[360px] p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              重置密码: @{resettingUser?.username}
            </DialogTitle>
            <DialogDescription className="text-xs">
              为该用户设置一个新的登录密码。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Input
                type="password"
                placeholder="输入新密码（不少于 6 位）"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={resetLoading}
                className="rounded-xl h-9 text-xs"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResettingUser(null)}
                className="rounded-xl h-8.5 text-xs"
              >
                取消
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={resetLoading}
                className="rounded-xl h-8.5 text-xs font-semibold"
              >
                {resetLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : '确认重置'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admin Create User Subdialog */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="sm:max-w-[400px] p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">手动创建用户</DialogTitle>
            <DialogDescription className="text-xs">
              管理员可直接添加新用户并指定初始角色。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-3 mt-2">
            <div className="space-y-1">
              <Input
                placeholder="用户名 (必填)"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                disabled={createLoading}
                className="rounded-xl h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Input
                placeholder="显示昵称 (选填)"
                value={newUserNickname}
                onChange={(e) => setNewUserNickname(e.target.value)}
                disabled={createLoading}
                className="rounded-xl h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Input
                type="password"
                placeholder="初始密码 (至少 6 位)"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                disabled={createLoading}
                className="rounded-xl h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'user')}
                className="w-full h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 text-xs"
              >
                <option value="user">普通用户 (user)</option>
                <option value="admin">超级管理员 (admin)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateUserOpen(false)}
                className="rounded-xl h-8.5 text-xs"
              >
                取消
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createLoading}
                className="rounded-xl h-8.5 text-xs font-semibold"
              >
                {createLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : '立即创建'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
