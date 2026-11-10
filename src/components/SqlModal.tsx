import React, { useState } from 'react';
import { Copy, Check, Database, ExternalLink, X, Terminal, ShieldCheck } from 'lucide-react';
import { SUPABASE_URL } from '../services/supabase';

interface SqlModalProps {
  isOpen: boolean;
  onClose: () => void;
  sqlContent: string;
}

export const SqlModal: React.FC<SqlModalProps> = ({ isOpen, onClose, sqlContent }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-indigo-700 via-indigo-800 to-blue-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Database className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Kịch bản SQL khởi tạo Supabase (schema.sql)</h3>
              <p className="text-xs text-indigo-200">Cấu hình bảng, Index tối ưu tải 3.000 học sinh, RLS và 20 câu hỏi mẫu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs md:text-sm text-indigo-950">
          <div className="flex items-start space-x-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Hướng dẫn kích hoạt 1-Click:</span>
              <ol className="list-decimal list-inside mt-1 text-slate-700 space-y-0.5">
                <li>Nhấn nút <b>"Sao chép toàn bộ mã SQL"</b> bên cạnh.</li>
                <li>Mở Supabase Dashboard của dự án: <span className="font-mono text-indigo-700 font-semibold">{SUPABASE_URL}</span></li>
                <li>Vào mục <b>SQL Editor</b> (biểu tượng icon code), dán toàn bộ mã và nhấn <b>RUN</b>.</li>
              </ol>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <a
              href="https://supabase.com/dashboard/project/dfsjnuifpnlswzcibkao/sql/new"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Mở SQL Editor Supabase
            </a>
            <button
              onClick={handleCopy}
              className={`inline-flex items-center px-4 py-2 font-semibold text-xs rounded-lg shadow-sm transition-all ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1.5" />
                  Đã sao chép!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1.5" />
                  Sao chép toàn bộ mã SQL
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
            <span className="flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>schema.sql</span>
            </span>
            <span>{sqlContent.split('\n').length} dòng</span>
          </div>
          <pre className="whitespace-pre-wrap select-all font-mono">{sqlContent}</pre>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>Hệ thống hỗ trợ đệm tự động (Local Cache) nếu chưa chạy SQL. Sau khi chạy SQL, dữ liệu sẽ tức thì đồng bộ toàn trường!</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-medium text-slate-700"
          >
            Đóng lại
          </button>
        </div>
      </div>
    </div>
  );
};
