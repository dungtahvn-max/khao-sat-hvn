import { useState, useEffect } from 'react';
import { AuthSession } from './types';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { StudentPortal } from './components/StudentPortal';
import { TeacherPortal } from './components/TeacherPortal';
import { AdminPortal } from './components/AdminPortal';
import { SqlModal } from './components/SqlModal';
import { getAppSettings, checkSupabaseConnection, ConnectionStatus } from './services/supabase';
import { ThemeProvider } from './context/ThemeContext';

// Raw import of schema.sql so it is always bundled and available to copy in 1 click
import sqlContent from '../schema.sql?raw';

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);

  useEffect(() => {
    // 1. Restore persistent session
    const saved = localStorage.getItem('school_survey_current_session');
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse session', e);
      }
    }

    // 2. Load settings & check Supabase connectivity
    const init = async () => {
      try {
        const [appSettings, status] = await Promise.all([
          getAppSettings(),
          checkSupabaseConnection(false),
        ]);
        if (appSettings?.announcement) {
          setAnnouncement(appSettings.announcement);
        }
        setConnectionStatus(status);
      } catch (e) {
        console.error('Initialization error', e);
      } finally {
        setLoadingInitial(false);
      }
    };
    init();
  }, []);

  const handleLoginSuccess = (newSession: AuthSession) => {
    setSession(newSession);
  };

  const handleLogout = () => {
    localStorage.removeItem('school_survey_current_session');
    setSession(null);
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-12 h-12 border-4 border-[#7a0f2b] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 text-sm font-semibold tracking-wide text-center">
          Đang khởi tạo...
        </p>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans relative overflow-x-hidden">
        {/* Floating gradient spheres for Glassmorphism & Mesh Gradient theme */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 hidden [html[data-theme=glass]_&]:block">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-400/35 to-purple-400/35 blur-3xl animate-pulse"></div>
          <div className="absolute top-1/4 -right-32 w-[30rem] h-[30rem] rounded-full bg-gradient-to-br from-pink-400/30 to-rose-400/30 blur-3xl animate-pulse" style={{ animationDuration: '8s' }}></div>
          <div className="absolute -bottom-32 left-1/3 w-[28rem] h-[28rem] rounded-full bg-gradient-to-br from-sky-400/30 to-teal-400/25 blur-3xl animate-pulse" style={{ animationDuration: '10s' }}></div>
        </div>

        {/* Navigation Header */}
        <Navbar
          session={session}
          onLogout={handleLogout}
          connectionStatus={connectionStatus}
          onOpenSqlModal={() => setShowSqlModal(true)}
        />

        {/* Main Content Area based on Role */}
        <main className="flex-1">
          {!session ? (
            <LoginView
              onLoginSuccess={handleLoginSuccess}
              announcement={announcement}
            />
          ) : session.role === 'student' && session.student ? (
            <StudentPortal
              student={session.student}
              announcement={announcement}
            />
          ) : session.role === 'teacher' && session.teacher ? (
            <TeacherPortal
              teacher={session.teacher}
            />
          ) : session.role === 'admin' ? (
            <AdminPortal
              session={session}
              onOpenSqlModal={() => setShowSqlModal(true)}
            />
          ) : (
            <div className="p-8 text-center text-slate-500">
              Phiên đăng nhập không hợp lệ.{' '}
              <button
                onClick={handleLogout}
                className="text-rose-700 font-bold underline"
              >
                Đăng xuất
              </button>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
            <span>© 2026 Hệ thống Khảo sát Học sinh Toàn trường • Trường THPT Huỳnh Văn Nghệ</span>
          </div>
        </footer>

        {/* SQL Script Viewer & 1-Click Copy Modal */}
        <SqlModal
          isOpen={showSqlModal}
          onClose={() => setShowSqlModal(false)}
          sqlContent={sqlContent}
        />
      </div>
    </ThemeProvider>
  );
}
