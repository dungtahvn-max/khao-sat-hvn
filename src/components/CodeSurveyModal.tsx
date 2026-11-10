import React, { useState } from 'react';
import { Survey } from '../types';
import { isValidUUID, generateUUID } from '../services/supabase';
import { Code, Download, FileJson, Check, X, Sparkles, BookOpen } from 'lucide-react';

interface CodeSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSurveyFromCode: (survey: Survey) => void;
  defaultDriveFolderId?: string;
}

export const CodeSurveyModal: React.FC<CodeSurveyModalProps> = ({
  isOpen,
  onClose,
  onSaveSurveyFromCode,
  defaultDriveFolderId = '1pS2VfhHEUbc2fWs0K_K6bSjivy0n8OMT',
}) => {
  const [latexOption, setLatexOption] = useState<'latex' | 'no_latex'>('latex');
  const [codeText, setCodeText] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen) return null;

  // Sample with rich LaTeX & TikZ graph
  const SAMPLE_EXAM_WITH_LATEX = JSON.stringify(
    {
      title: "Bài kiểm tra Toán học THPT - Định dạng đề thi 2025 (Có mã LaTeX & TikZ)",
      description: "Cấu trúc đề kiểm tra đánh giá năng lực gồm 3 phần: Trắc nghiệm 4 lựa chọn, Trắc nghiệm Đúng - Sai và Trả lời ngắn (điền số & điền từ).",
      survey_type: "exam",
      target_classes: [], // Để trống [] là áp dụng Toàn trường, hoặc nhập danh sách lớp vd: ["10.1", "10.2"]
      shuffle_questions: false,
      shuffle_options: false,
      exam_config: {
        part1_points: 3.0, // Điểm phần Trắc nghiệm (tự chia đều các câu)
        part2_points: 4.0, // Điểm phần Đúng-Sai (tự chia đều các câu)
        part3_points: 3.0  // Điểm phần Trả lời ngắn (tự chia đều các câu)
      },
      questions: [
        // Phần 1: Trắc nghiệm 4 phương án
        {
          id: "q1",
          question: "Tính tích phân $I = \\int_0^1 (2x + 1)\\,dx$. Khẳng định nào sau đây đúng?",
          type: "single_choice",
          options: [
            "$I = 2$",
            "$I = 1$",
            "$I = 3$",
            "$I = \\frac{3}{2}$"
          ],
          correct_answer: 0,
          points: 1.5,
          explanation: "Ta có $\\int_0^1 (2x+1)dx = [x^2 + x]_0^1 = (1+1) - 0 = 2$."
        },
        {
          id: "q2",
          question: "Nghiệm của phương trình $2^{x-1} = 8$ là:",
          type: "single_choice",
          options: [
            "$x = 4$",
            "$x = 3$",
            "$x = 2$",
            "$x = 5$"
          ],
          correct_answer: 0,
          points: 1.5,
          explanation: "Ta có $8 = 2^3 \\implies x - 1 = 3 \\implies x = 4$."
        },

        // Phần 2: Trắc nghiệm Đúng - Sai (4 ý a, b, c, d)
        {
          id: "q3",
          question: "Cho hàm số $y = f(x) = x^3 - 3x + 2$. Xét tính đúng sai của các mệnh đề sau:\\n\\begin{tikzpicture}[>=stealth,scale=0.8]\\n\\draw[->] (-3,0) -- (3,0) node[right] {$x$};\\n\\draw[->] (0,-2) -- (0,5) node[above] {$y$};\\n\\draw[domain=-2.1:2.1,samples=60] plot (\\x, {(\\x)^3 - 3*(\\x) + 2});\\n\\end{tikzpicture}",
          type: "true_false",
          options: [
            "Hàm số đồng biến trên khoảng $(1; +\\infty)$",
            "Điểm cực tiểu của đồ thị hàm số là $(1; 0)$",
            "Giá trị lớn nhất của hàm số trên đoạn $[-2; 2]$ bằng $4$",
            "Phương trình $f(x) = 0$ có 3 nghiệm phân biệt"
          ],
          correct_answers: [true, true, true, false],
          points: 4.0,
          explanation: "Đạo hàm $y' = 3x^2 - 3 = 0 \\iff x = \\pm 1$. Ý a, b, c đúng; ý d sai vì $f(x) = (x-1)^2(x+2) = 0$ có nghiệm kép x = 1 và nghiệm đơn x = -2 (chỉ có 2 nghiệm phân biệt)."
        },

        // Phần 3: Trả lời ngắn (Điền số & Điền từ)
        {
          id: "q4",
          question: "Biết $\\int_1^3 f(x)\\,dx = 7$. Tính giá trị của biểu thức $K = \\int_1^3 [2f(x) - 1]\\,dx$ (Nhập kết quả bằng số):",
          type: "short_number",
          correct_answer: "12",
          points: 1.5,
          explanation: "$K = 2\\int_1^3 f(x)dx - \\int_1^3 1dx = 2(7) - (3 - 1) = 14 - 2 = 12$."
        },
        {
          id: "q5",
          question: "Tập hợp các điểm trong không gian cách đều một điểm $O$ cố định một khoảng bằng $R > 0$ được gọi là mặt gì?",
          type: "short_text",
          correct_answer: "mat cau",
          points: 1.5,
          explanation: "Mặt cầu tâm O bán kính R là tập hợp các điểm M trong không gian sao cho OM = R."
        }
      ]
    },
    null,
    2
  );

  // Sample without LaTeX
  const SAMPLE_EXAM_NO_LATEX = JSON.stringify(
    {
      title: "Bài kiểm tra Đánh giá Năng lực Tổng hợp THPT (Không dùng mã LaTeX)",
      description: "Đề thi gồm 3 phần: Trắc nghiệm 4 lựa chọn, Trắc nghiệm Đúng - Sai và Trả lời ngắn.",
      survey_type: "exam",
      target_classes: [],
      shuffle_questions: false,
      shuffle_options: false,
      exam_config: {
        part1_points: 3.0,
        part2_points: 4.0,
        part3_points: 3.0
      },
      questions: [
        // Phần 1: Trắc nghiệm
        {
          id: "q1",
          question: "Nước Việt Nam Dân chủ Cộng hòa được thành lập vào năm nào?",
          type: "single_choice",
          options: [
            "Năm 1945",
            "Năm 1954",
            "Năm 1975",
            "Năm 1930"
          ],
          correct_answer: 0,
          points: 1.5,
          explanation: "Ngày 2/9/1945 tại Quảng trường Ba Đình, Chủ tịch Hồ Chí Minh đọc bản Tuyên ngôn Độc lập khai sinh nước Việt Nam Dân chủ Cộng hòa."
        },
        {
          id: "q2",
          question: "Tác phẩm 'Nam quốc sơn hà' thường được ví như bản Tuyên ngôn độc lập thứ mấy của dân tộc ta?",
          type: "single_choice",
          options: [
            "Bản Tuyên ngôn độc lập thứ nhất",
            "Bản Tuyên ngôn độc lập thứ hai",
            "Bản Tuyên ngôn độc lập thứ ba",
            "Bản Tuyên ngôn độc lập thứ tư"
          ],
          correct_answer: 0,
          points: 1.5,
          explanation: "'Nam quốc sơn hà' được xem là bản Tuyên ngôn độc lập đầu tiên của nước ta."
        },

        // Phần 2: Đúng - Sai
        {
          id: "q3",
          question: "Khi nói về Chiến dịch Điện Biên Phủ năm 1954, xét tính đúng sai của các nhận định sau:",
          type: "true_false",
          options: [
            "Chiến dịch diễn ra trong 56 ngày đêm 'khoét núi, ngủ hầm, mưa dầm, cơm vắt'",
            "Đại tướng Võ Nguyên Giáp là Tổng tư lệnh chiến dịch",
            "Chiến dịch kết thúc thắng lợi vào ngày 7 tháng 5 năm 1954",
            "Đây là chiến thắng kết thúc hoàn toàn cuộc kháng chiến chống Mỹ cứu nước"
          ],
          correct_answers: [true, true, true, false],
          points: 4.0,
          explanation: "Ý d sai vì Chiến dịch Điện Biên Phủ 1954 kết thúc cuộc kháng chiến chống thực dân Pháp, không phải chống Mỹ."
        },

        // Phần 3: Trả lời ngắn
        {
          id: "q4",
          question: "Trường THPT Huỳnh Văn Nghệ được thành lập vào năm nào? (Nhập đáp án bằng số)",
          type: "short_number",
          correct_answer: "1959",
          points: 1.5,
          explanation: "Trường THPT Huỳnh Văn Nghệ có truyền thống lâu đời được thành lập từ năm 1959."
        },
        {
          id: "q5",
          question: "Nhà thơ, chiến sĩ Huỳnh Văn Nghệ nổi tiếng với hai câu thơ 'Từ thuở mang gươm đi mở cõi / Trời Nam thương nhớ đất...' gì?",
          type: "short_text",
          correct_answer: "thang long",
          points: 1.5,
          explanation: "'Từ thuở mang gươm đi mở cõi / Trời Nam thương nhớ đất Thăng Long'."
        }
      ]
    },
    null,
    2
  );

  const getActiveSample = () => {
    return latexOption === 'latex' ? SAMPLE_EXAM_WITH_LATEX : SAMPLE_EXAM_NO_LATEX;
  };

  const handleDownloadSample = () => {
    const sample = getActiveSample();
    const fileName = latexOption === 'latex'
      ? 'khao_sat_mau_kiem_tra_latex.json'
      : 'khao_sat_mau_kiem_tra_khong_latex.json';

    const blob = new Blob([sample], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleInsertSample = () => {
    setCodeText(getActiveSample());
    setErrorMessage('');
  };

  const handleValidateAndSubmit = () => {
    setErrorMessage('');
    if (!codeText.trim()) {
      setErrorMessage('Vui lòng dán đoạn mã JSON đề thi / khảo sát vào ô soạn thảo!');
      return;
    }

    try {
      const parsed = JSON.parse(codeText);
      if (!parsed.title || !parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        setErrorMessage('Mã JSON không hợp lệ: Cần có trường "title" và mảng "questions" có ít nhất 1 câu hỏi!');
        return;
      }

      const surveyId = (parsed.id && isValidUUID(parsed.id)) ? parsed.id : generateUUID();
      const surveyType = (parsed.survey_type === 'exam' || parsed.survey_type === 'quiz' || parsed.survey_type === 'form')
        ? parsed.survey_type
        : 'exam';

      const surveyToSave: Survey = {
        id: surveyId,
        title: String(parsed.title).trim(),
        description: parsed.description || '',
        survey_type: surveyType,
        is_active: parsed.is_active !== undefined ? Boolean(parsed.is_active) : true,
        show_answers: parsed.show_answers !== undefined ? Boolean(parsed.show_answers) : false,
        allow_multiple_attempts: parsed.allow_multiple_attempts !== undefined ? Boolean(parsed.allow_multiple_attempts) : false,
        google_drive_folder_id: surveyType === 'form' ? (parsed.google_drive_folder_id || defaultDriveFolderId) : '',
        target_classes: Array.isArray(parsed.target_classes) ? parsed.target_classes : [],
        shuffle_questions: Boolean(parsed.shuffle_questions),
        shuffle_options: Boolean(parsed.shuffle_options),
        exam_config: parsed.exam_config || { part1_points: 3, part2_points: 4, part3_points: 3 },
        questions: parsed.questions.map((q: any, i: number) => ({
          id: q.id || `q_${i + 1}`,
          question: q.question || `Câu hỏi ${i + 1}`,
          type: q.type || 'single_choice',
          options: Array.isArray(q.options) ? q.options : (q.type === 'single_choice' || !q.type ? ['', '', '', ''] : []),
          correct_answer: q.correct_answer !== undefined ? q.correct_answer : 0,
          correct_answers: Array.isArray(q.correct_answers) ? q.correct_answers : [false, false, false, false],
          points: typeof q.points === 'number' ? q.points : 1,
          image_url: q.image_url || '',
          explanation: q.explanation || '',
          required: q.required ?? true,
          file_code_prefix: q.file_code_prefix || '',
        })),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      onSaveSurveyFromCode(surveyToSave);
      onClose();
    } catch (err: any) {
      setErrorMessage(`Lỗi cú pháp JSON: ${err.message}. Hãy kiểm tra các dấu ngoặc kép và dấu phẩy.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Code className="w-5 h-5 text-rose-300" />
            <h3 className="font-bold text-base">Nhập khảo sát & Bài kiểm tra bằng Mã (JSON)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {/* Options & Sample Actions Bar */}
          <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-[#7a0f2b] block text-xs sm:text-sm">
                  Tùy chọn tải đoạn mã mẫu:
                </span>
                <span className="text-[11px] text-slate-600">
                  Hỗ trợ đầy đủ 4 dạng câu hỏi: Trắc nghiệm, Đúng-Sai 4 ý, Điền số, Điền từ và đồ thị TikZ.
                </span>
              </div>

              {/* Toggle LaTeX or No LaTeX */}
              <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-rose-300 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setLatexOption('latex')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                    latexOption === 'latex'
                      ? 'bg-[#7a0f2b] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Có dùng LaTeX & TikZ
                </button>
                <button
                  type="button"
                  onClick={() => setLatexOption('no_latex')}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                    latexOption === 'no_latex'
                      ? 'bg-[#7a0f2b] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Không dùng LaTeX
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-rose-200/60">
              <button
                type="button"
                onClick={handleDownloadSample}
                className="px-3 py-1.5 bg-white text-[#7a0f2b] border border-rose-300 rounded-xl font-bold hover:bg-rose-100 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                Tải file code mẫu ({latexOption === 'latex' ? 'Có LaTeX' : 'Không LaTeX'})
              </button>
              <button
                type="button"
                onClick={handleInsertSample}
                className="px-3.5 py-1.5 bg-[#7a0f2b] text-white rounded-xl font-bold hover:bg-[#8f1334] flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <FileJson className="w-3.5 h-3.5" />
                Chèn trực tiếp mã mẫu vào ô soạn thảo
              </button>
            </div>
          </div>

          {/* JSON Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-800 text-xs">
                Nội dung mã JSON của bài kiểm tra / khảo sát:
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {codeText.length > 0 ? `${codeText.length} ký tự` : 'Chưa có nội dung'}
              </span>
            </div>
            <textarea
              rows={15}
              value={codeText}
              onChange={e => setCodeText(e.target.value)}
              placeholder="Dán đoạn mã JSON vào đây..."
              className="w-full p-3 font-mono text-xs bg-slate-950 text-emerald-400 rounded-xl border border-slate-800 focus:ring-2 focus:ring-[#7a0f2b] focus:outline-none"
            ></textarea>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 text-rose-700 font-semibold rounded-xl border border-rose-200">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 cursor-pointer"
          >
            Đóng lại
          </button>
          <button
            type="button"
            onClick={handleValidateAndSubmit}
            className="px-6 py-2.5 bg-[#7a0f2b] hover:bg-[#8f1334] text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            Kiểm tra & Tạo khảo sát từ Code
          </button>
        </div>
      </div>
    </div>
  );
};
