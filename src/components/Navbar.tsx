import React, { useState } from 'react';
import { AuthSession } from '../types';
import { LogOut, User, Shield, BookOpen, KeyRound } from 'lucide-react';
import { ConnectionStatus } from '../services/supabase';
import { useTheme } from '../context/ThemeContext';
import { ChangePasswordModal } from './ChangePasswordModal';
import { formatClassDisplay } from '../utils/classOrder';

interface NavbarProps {
  session: AuthSession | null;
  onLogout: () => void;
  connectionStatus?: ConnectionStatus | null;
  onOpenSqlModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  session,
  onLogout,
}) => {
  const { config } = useTheme();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  return (
    <>
      <header className="bg-gradient-to-r from-[#5a0a1f] via-[#7a0f2b] to-[#400615] text-white sticky top-0 z-40 shadow-md border-b border-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & School Name */}
            <div className="flex items-center space-x-3">
              <img
                src="/assets/aistudio/logo_149a2a0f.png"
                alt="Logo THPT Huỳnh Văn Nghệ"
                className="w-11 h-11 object-contain flex-shrink-0 drop-shadow-xs"
              />
              <div>
                <span className="font-extrabold text-white tracking-tight text-base sm:text-lg drop-shadow-xs">
                  CỔNG KHẢO SÁT HỌC SINH
                </span>
              </div>
            </div>

            {/* Right Action & User Profile */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {session && (
                <>
                  {/* User Info Badge */}
                  <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-xl text-xs font-medium text-white shadow-2xs">
                    {session.role === 'student' && (
                      <>
                        <User className="w-3.5 h-3.5 text-rose-200" />
                        <span className="font-bold text-white">{session.student?.full_name}</span>
                        <span className="font-bold bg-white/20 text-white px-1.5 py-0.5 rounded border border-white/20">
                          Lớp {formatClassDisplay(session.student?.class_name || '')}
                        </span>
                      </>
                    )}
                    {session.role === 'teacher' && (
                      <>
                        <BookOpen className="w-3.5 h-3.5 text-rose-200" />
                        <span className="font-bold text-white">GVCN: {session.teacher?.full_name}</span>
                        <span className="font-bold bg-white/20 text-white px-1.5 py-0.5 rounded border border-white/20">
                          Lớp {formatClassDisplay(session.teacher?.homeroom_class || '')}
                        </span>
                      </>
                    )}
                    {session.role === 'admin' && (
                      <>
                        <Shield className="w-3.5 h-3.5 text-rose-200" />
                        <span className="font-bold text-white">
                          Quản trị viên ({session.admin?.fullName || session.admin?.username || 'Admin'})
                        </span>
                      </>
                    )}
                  </div>

                  {/* Change Password button for Teacher & Admin */}
                  {(session.role === 'teacher' || session.role === 'admin') && (
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl transition-colors cursor-pointer shadow-2xs"
                      title="Đổi mật khẩu tài khoản"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-rose-200" />
                      <span className="hidden sm:inline">Đổi MK</span>
                    </button>
                  )}

                  {/* Logout Button */}
                  <button
                    onClick={onLogout}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-rose-100 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-400/30 rounded-xl transition-colors cursor-pointer shadow-2xs"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Đăng xuất</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Change Password Modal */}
      {showPasswordModal && session && (session.role === 'teacher' || session.role === 'admin') && (
        <ChangePasswordModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          userRole={session.role}
          username={session.role === 'teacher' ? (session.teacher?.username || '') : (session.admin?.username || 'admin')}
        />
      )}
    </>
  );
};
