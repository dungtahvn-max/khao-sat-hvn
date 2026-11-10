import React, { useState } from 'react';
import { AuthSession, UserRole, Student } from '../types';
import { supabase, getStudents, getTeachers, getAppSettings } from '../services/supabase';
import { GraduationCap, BookOpen, Shield, ArrowRight, UserCheck, KeyRound, AlertCircle, Sparkles } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (session: AuthSession) => void;
  announcement?: string;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, announcement }) => {
  const [activeTab, setActiveTab] = useState<UserRole>('student');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleTabChange = (tab: UserRole) => {
    setActiveTab(tab);
    setErrorMessage('');
    setUsername('');
    setPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const trimmedUser = username.trim();
      const trimmedPass = password.trim();

      if (!trimmedUser || !trimmedPass) {
        setErrorMessage('Vui lòng điền đầy đủ tài khoản và mật khẩu.');
        setLoading(false);
        return;
      }

      if (activeTab === 'student') {
        const cleanCccd = trimmedUser.replace(/[^0-9]/g, '');
        let student: Student | undefined;

        // 1. Direct fast lookup by CCCD in Supabase (sub-second response for thousands of students)
        try {
          const { data, error } = await supabase
            .from('students')
            .select('*')
            .eq('cccd', cleanCccd)
            .maybeSingle();
          if (!error && data) {
            student = data as Student;
          }
        } catch {
          // ignore, fallback below
        }

        // 2. Fallback to local cache / getStudents
        if (!student) {
          const students = await getStudents();
          student = students.find(
            s => s.cccd.trim() === cleanCccd || s.cccd.trim().toLowerCase() === trimmedUser.toLowerCase()
          );
        }

        if (!student) {
          setErrorMessage('Không tìm thấy học sinh với số CCCD này trong hệ thống. Vui lòng kiểm tra lại hoặc liên hệ GVCN.');
          setLoading(false);
          return;
        }

        if (student.dob_password !== trimmedPass) {
          setErrorMessage('Mật khẩu không chính xác! Mật khẩu là ngày tháng năm sinh gồm 8 chữ số viết liền ddmmyyyy.');
          setLoading(false);
          return;
        }

        const session: AuthSession = {
          role: 'student',
          student,
        };
        localStorage.setItem('school_survey_current_session', JSON.stringify(session));
        onLoginSuccess(session);
        return;
      }

      if (activeTab === 'teacher') {
        const teachers = await getTeachers();
        const teacher = teachers.find(
          t => t.username.trim().toLowerCase() === trimmedUser.toLowerCase() && t.password.trim() === trimmedPass
        );

        if (!teacher) {
          setErrorMessage('Tên đăng nhập hoặc mật khẩu Giáo viên không chính xác. Vui lòng liên hệ Quản trị viên để được cấp lại.');
          setLoading(false);
          return;
        }

        // If this teacher account has admin role, grant admin session
        if (teacher.role === 'admin') {
          const session: AuthSession = {
            role: 'admin',
            admin: { username: teacher.username, fullName: teacher.full_name },
          };
          localStorage.setItem('school_survey_current_session', JSON.stringify(session));
          onLoginSuccess(session);
          return;
        }

        const session: AuthSession = {
          role: 'teacher',
          teacher,
        };
        localStorage.setItem('school_survey_current_session', JSON.stringify(session));
        onLoginSuccess(session);
        return;
      }

      if (activeTab === 'admin') {
        const [settings, teachers] = await Promise.all([getAppSettings(), getTeachers()]);

        // 1. Check default admin settings
        const isMasterAdmin = 
          trimmedUser.toLowerCase() === (settings.admin_username || 'admin').toLowerCase() &&
          trimmedPass === (settings.admin_password || '1235');

        if (isMasterAdmin) {
          const session: AuthSession = {
            role: 'admin',
            admin: { username: settings.admin_username || 'admin', fullName: 'Quản trị viên' },
          };
          localStorage.setItem('school_survey_current_session', JSON.stringify(session));
          onLoginSuccess(session);
          return;
        }

        // 2. Check if it is an admin account created in teachers/staff list
        const adminTeacher = teachers.find(
          t => t.role === 'admin' &&
               t.username.trim().toLowerCase() === trimmedUser.toLowerCase() &&
               t.password.trim() === trimmedPass
        );

        if (adminTeacher) {
          const session: AuthSession = {
            role: 'admin',
            admin: { username: adminTeacher.username, fullName: adminTeacher.full_name },
          };
          localStorage.setItem('school_survey_current_session', JSON.stringify(session));
          onLoginSuccess(session);
          return;
        }

        setErrorMessage('Tài khoản hoặc mật khẩu Quản trị viên không chính xác.');
        setLoading(false);
        return;
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err.message || 'Đã có lỗi xảy ra trong quá trình đăng nhập.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center py-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#fcf7f8] via-[#f7eef0] to-[#f4e6e8]">
      <div className="max-w-md w-full space-y-6">
        {/* Header Branding */}
        <div className="text-center">
          <img
            src="/assets/aistudio/logo_149a2a0f.png"
            alt="Logo Trường THPT Huỳnh Văn Nghệ"
            className="mx-auto w-24 h-24 object-contain drop-shadow-md"
          />
          <h1 className="mt-3 text-lg font-black text-[#7a0f2b] uppercase tracking-tight">
            TRƯỜNG THPT HUỲNH VĂN NGHỆ
          </h1>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-900 tracking-tight">
            Đăng nhập hệ thống
          </h2>
        </div>

        {/* Announcement Banner */}
        {announcement && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-[#7a0f2b] flex items-start space-x-2.5 shadow-xs">
            <Sparkles className="w-4 h-4 text-[#8b112c] flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-[#5a0a1f]">Thông báo từ Ban quản trị:</span>{' '}
              {announcement}
            </div>
          </div>
        )}

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-rose-950/5 border border-rose-100 overflow-hidden">
          {/* Role Tabs */}
          <div className="grid grid-cols-3 border-b border-rose-100 bg-[#faf2f4] p-1.5 gap-1.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleTabChange('student')}
              className={`flex items-center justify-center py-2.5 px-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'student'
                  ? 'bg-white text-[#7a0f2b] shadow-xs font-bold border border-rose-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
              <span>Học sinh</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('teacher')}
              className={`flex items-center justify-center py-2.5 px-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'teacher'
                  ? 'bg-white text-[#7a0f2b] shadow-xs font-bold border border-rose-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
              <span>Giáo viên</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('admin')}
              className={`flex items-center justify-center py-2.5 px-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-white text-[#7a0f2b] shadow-xs font-bold border border-rose-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50'
              }`}
            >
              <Shield className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
              <span>Quản trị</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Student Guide */}
            {activeTab === 'student' && (
              <div className="p-3 bg-rose-50/70 border border-rose-200/80 rounded-xl text-xs text-[#7a0f2b] space-y-1">
                <p className="font-semibold text-[#5a0a1f]">📋 Hướng dẫn đăng nhập cho học sinh:</p>
                <p>• <b>Tài khoản:</b> Số Căn cước công dân (12 chữ số).</p>
                <p>• <b>Mật khẩu:</b> Ngày tháng năm sinh dạng <b>ddmmyyyy</b> (8 số viết liền, ví dụ sinh ngày 05/08/2009 nhập <code className="bg-white px-1 rounded text-[#7a0f2b] font-bold">05082009</code>).</p>
              </div>
            )}

            {/* Username / CCCD Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {activeTab === 'student' ? 'Số CCCD (12 chữ số)' : 'Tên đăng nhập'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={
                    activeTab === 'student'
                      ? 'Nhập 12 số CCCD'
                      : 'Nhập tên đăng nhập'
                  }
                  maxLength={activeTab === 'student' ? 12 : 50}
                  className="block w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#7a0f2b] focus:bg-white focus:border-[#7a0f2b] transition-colors"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {activeTab === 'student' ? 'Mật khẩu (Ngày sinh ddmmyyyy)' : 'Mật khẩu'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    activeTab === 'student'
                      ? 'Nhập 8 chữ số ngày sinh'
                      : 'Nhập mật khẩu'
                  }
                  maxLength={activeTab === 'student' ? 8 : 50}
                  className="block w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#7a0f2b] focus:bg-white focus:border-[#7a0f2b] transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-2.5 px-4 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-[#7a0f2b] via-[#941437] to-[#600b21] hover:from-[#8b112c] hover:to-[#700d27] shadow-md shadow-rose-950/20 transition-all disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Đang kiểm tra...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5">
                  <span>Đăng nhập</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
