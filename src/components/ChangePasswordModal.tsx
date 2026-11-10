import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getAppSettings, saveAppSettings, getTeachers, upsertTeachers, supabase } from '../services/supabase';
import { AuthSession } from '../types';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: 'teacher' | 'admin';
  username: string;
  onPasswordChanged?: (newPass: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  userRole,
  username,
  onPasswordChanged,
}) => {
  const { config } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentPassword.trim()) {
      setErrorMsg('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!newPassword.trim() || newPassword.length < 4) {
      setErrorMsg('Mật khẩu mới phải có ít nhất 4 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Xác nhận mật khẩu mới không khớp.');
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMsg('Mật khẩu mới không được trùng với mật khẩu cũ.');
      return;
    }

    setLoading(true);

    try {
      if (userRole === 'teacher') {
        const teachers = await getTeachers();
        const teacher = teachers.find(
          t => t.username.trim().toLowerCase() === username.trim().toLowerCase()
        );

        if (!teacher || teacher.password !== currentPassword.trim()) {
          setErrorMsg('Mật khẩu hiện tại không chính xác.');
          setLoading(false);
          return;
        }

        // 1. Update in Supabase
        const { error } = await supabase
          .from('teachers')
          .update({ password: newPassword.trim() })
          .eq('username', username.trim().toLowerCase());

        if (error) {
          console.error('Supabase update teacher password error:', error);
        }

        // 2. Update local state & session
        await upsertTeachers([{
          ...teacher,
          password: newPassword.trim(),
        }]);

        // Update active session in localStorage
        const rawSession = localStorage.getItem('school_survey_current_session');
        if (rawSession) {
          try {
            const sess: AuthSession = JSON.parse(rawSession);
            if (sess.teacher) {
              sess.teacher.password = newPassword.trim();
              localStorage.setItem('school_survey_current_session', JSON.stringify(sess));
            }
          } catch {}
        }

        setSuccessMsg('Đổi mật khẩu Giáo viên thành công!');
        if (onPasswordChanged) onPasswordChanged(newPassword.trim());
        setTimeout(() => {
          onClose();
        }, 1200);

      } else if (userRole === 'admin') {
        const settings = await getAppSettings();
        const isMasterAdmin = username.trim().toLowerCase() === (settings.admin_username || 'admin').toLowerCase();

        if (isMasterAdmin) {
          // Master Admin
          if (currentPassword.trim() !== (settings.admin_password || '1235')) {
            setErrorMsg('Mật khẩu hiện tại không chính xác.');
            setLoading(false);
            return;
          }

          await saveAppSettings({
            admin_password: newPassword.trim(),
          });

          setSuccessMsg('Đổi mật khẩu Quản trị viên thành công!');
          if (onPasswordChanged) onPasswordChanged(newPassword.trim());
          setTimeout(() => {
            onClose();
          }, 1200);

        } else {
          // Sub-Admin (from teachers list with role='admin')
          const teachers = await getTeachers();
          const adminTeacher = teachers.find(
            t => t.username.trim().toLowerCase() === username.trim().toLowerCase()
          );

          if (!adminTeacher || adminTeacher.password !== currentPassword.trim()) {
            setErrorMsg('Mật khẩu hiện tại không chính xác.');
            setLoading(false);
            return;
          }

          // Update in Supabase
          await supabase
            .from('teachers')
            .update({ password: newPassword.trim() })
            .eq('username', username.trim().toLowerCase());

          await upsertTeachers([{
            ...adminTeacher,
            password: newPassword.trim(),
          }]);

          setSuccessMsg('Đổi mật khẩu Quản trị viên thành công!');
          if (onPasswordChanged) onPasswordChanged(newPassword.trim());
          setTimeout(() => {
            onClose();
          }, 1200);
        }
      }
    } catch (err: any) {
      console.error('Change password error:', err);
      setErrorMsg(err.message || 'Đã có lỗi xảy ra khi đổi mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className={`p-4 ${config.buttonPrimary} flex items-center justify-between`}>
          <div className="flex items-center space-x-2.5">
            <KeyRound className="w-5 h-5 text-white" />
            <div>
              <h3 className="font-bold text-base text-white">Đổi mật khẩu tài khoản</h3>
              <p className="text-xs text-white/80">
                Tài khoản: <strong className="text-white underline">{username}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs font-semibold text-rose-700 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs font-bold text-emerald-800 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Current Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mật khẩu hiện tại <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                autoCapitalize="none"
                autoCorrect="off"
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu đang dùng..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden pr-9"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mật khẩu mới <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                autoCapitalize="none"
                autoCorrect="off"
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 4 ký tự..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden pr-9"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
            </label>
            <input
              type={showNew ? 'text' : 'password'}
              autoCapitalize="none"
              autoCorrect="off"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-2 ${config.buttonPrimary} font-bold rounded-xl text-xs cursor-pointer transition-colors shadow-xs disabled:opacity-50`}
            >
              {loading ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
