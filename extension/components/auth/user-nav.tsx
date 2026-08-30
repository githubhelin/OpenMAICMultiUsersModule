'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogIn, User as UserIcon, Shield, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { AuthDialog } from './auth-dialog';
import { UserProfileDialog } from './user-profile-dialog';
import { UserManagementDialog } from '../admin/user-management-dialog';

export function UserNav({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const [mounted, setMounted] = useState(false);
  const { user, checkAuth, setAuthModalOpen, setProfileModalOpen, setAdminModalOpen, logout } = useAuthStore();

  useEffect(() => {
    setMounted(true);
    checkAuth();
  }, [checkAuth]);

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="rounded-full h-8 px-3 text-xs font-semibold gap-1.5 opacity-50"
      >
        <LogIn className="w-3.5 h-3.5" />
        登录 / 注册
      </Button>
    );
  }

  return (
    <>
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1.5 pr-2.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border border-zinc-200/60 dark:border-zinc-700/60 shadow-xs cursor-pointer">
              <img
                src={user.avatar || '/avatars/user.png'}
                alt={user.nickname || user.username}
                className="w-6 h-6 rounded-full object-cover bg-zinc-100"
              />
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 max-w-[90px] truncate">
                {user.nickname || user.username}
              </span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52 p-1.5 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 text-xs">
            <DropdownMenuLabel className="p-2 font-normal">
              <div className="flex items-center gap-2">
                <img
                  src={user.avatar || '/avatars/user.png'}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover bg-zinc-100 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-xs">
                    {user.nickname || user.username}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono truncate">
                    @{user.username}
                  </div>
                </div>
              </div>
              {user.role === 'admin' && (
                <div className="mt-2 text-[10px] inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                  <Shield className="w-2.5 h-2.5" /> 超级管理员
                </div>
              )}
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem onClick={() => setProfileModalOpen(true)} className="rounded-xl py-2 cursor-pointer">
              <UserIcon className="w-3.5 h-3.5 mr-2 text-zinc-500" />
              个人资料与密码
            </DropdownMenuItem>

            {user.role === 'admin' && (
              <>
                <DropdownMenuItem onClick={() => setAdminModalOpen(true)} className="rounded-xl py-2 cursor-pointer font-medium text-amber-600 dark:text-amber-400 focus:text-amber-600">
                  <Shield className="w-3.5 h-3.5 mr-2" />
                  全站多用户管理
                </DropdownMenuItem>

                {onOpenSettings && (
                  <DropdownMenuItem onClick={onOpenSettings} className="rounded-xl py-2 cursor-pointer">
                    <SettingsIcon className="w-3.5 h-3.5 mr-2 text-zinc-500" />
                    系统服务与模型设置
                  </DropdownMenuItem>
                )}
              </>
            )}

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem
              onClick={() => logout()}
              className="rounded-xl py-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAuthModalOpen(true, 'login')}
          className="rounded-full h-8 px-3 text-xs font-semibold gap-1.5 shadow-xs border-zinc-200 dark:border-zinc-700 hover:border-primary/50 hover:text-primary transition-all"
        >
          <LogIn className="w-3.5 h-3.5" />
          登录 / 注册
        </Button>
      )}

      {/* Global Modals */}
      <AuthDialog />
      <UserProfileDialog />
      <UserManagementDialog />
    </>
  );
}
