-- ============================================================================
-- HỆ THỐNG KHẢO SÁT & THU THẬP THÔNG TIN HỌC SINH TOÀN TRƯỜNG
-- KỊCH BẢN KHỞI TẠO CƠ SỞ DỮ LIỆU SUPABASE (POSTGRESQL)
-- Chạy toàn bộ file này trong Supabase Dashboard -> SQL Editor -> Nhấn "Run"
-- ============================================================================

-- 1. Bảng cấu hình hệ thống & thông báo
CREATE TABLE IF NOT EXISTS public.app_settings (
    id SERIAL PRIMARY KEY,
    admin_username TEXT NOT NULL DEFAULT 'admin',
    admin_password TEXT NOT NULL DEFAULT '1235',
    announcement TEXT DEFAULT 'Chào mừng các em học sinh và quý thầy cô đến với Hệ thống Khảo sát & Thu thập Thông tin Học sinh Toàn trường!',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Khởi tạo thiết lập mặc định nếu chưa có
INSERT INTO public.app_settings (id, admin_username, admin_password, announcement)
VALUES (1, 'admin', '1235', 'Chào mừng các em học sinh và quý thầy cô đến với Hệ thống Khảo sát & Thu thập Thông tin Học sinh Toàn trường!')
ON CONFLICT (id) DO NOTHING;

-- 2. Bảng Danh sách Học sinh toàn trường
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stt INTEGER,
    full_name TEXT NOT NULL,
    dob_display TEXT NOT NULL,      -- Dạng dd/mm/yyyy hiển thị
    dob_password TEXT NOT NULL,     -- Dạng ddmmyyyy (8 số) làm mật khẩu đăng nhập
    cccd TEXT NOT NULL UNIQUE,      -- Chuỗi 12 chữ số duy nhất
    class_name TEXT NOT NULL,       -- Ví dụ: 10A1, 11B2, 12C3
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng Giáo viên chủ nhiệm (GVCN)
CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,  -- Tên đăng nhập
    password TEXT NOT NULL,         -- Mật khẩu
    full_name TEXT NOT NULL,        -- Họ tên GVCN
    homeroom_class TEXT NOT NULL,   -- Lớp chủ nhiệm (khớp với class_name của học sinh)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bảng Đợt Khảo sát & Biểu mẫu thu thập thông tin
CREATE TABLE IF NOT EXISTS public.surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    survey_type TEXT NOT NULL DEFAULT 'quiz', -- 'quiz' (trắc nghiệm có chấm điểm) hoặc 'form' (thu thập thông tin)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,   -- Trạng thái Mở (true) hoặc Đóng (false)
    show_answers BOOLEAN NOT NULL DEFAULT FALSE, -- Cho phép xem đáp án & giải thích sau khi nộp
    allow_multiple_attempts BOOLEAN NOT NULL DEFAULT FALSE, -- Cho phép làm lại bài
    questions JSONB NOT NULL DEFAULT '[]'::JSONB, -- Danh sách câu hỏi, lựa chọn, đáp án, giải thích
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Bảng Kết quả nộp bài khảo sát (Survey Responses)
CREATE TABLE IF NOT EXISTS public.survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
    student_cccd TEXT NOT NULL,
    student_name TEXT NOT NULL,
    class_name TEXT NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}'::JSONB, -- Lưu câu trả lời của học sinh: { [questionId]: answerValue }
    score INTEGER DEFAULT 0,                    -- Số câu đúng (nếu là quiz)
    total_questions INTEGER DEFAULT 0,          -- Tổng số câu hỏi
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_survey_student UNIQUE (survey_id, student_cccd)
);

-- 6. Tối ưu hóa truy vấn (CREATE INDEX) cho tải 1.000 - 3.000 truy cập đồng thời (< 50ms)
CREATE INDEX IF NOT EXISTS idx_students_cccd ON public.students(cccd);
CREATE INDEX IF NOT EXISTS idx_students_class ON public.students(class_name);
CREATE INDEX IF NOT EXISTS idx_teachers_username ON public.teachers(username);
CREATE INDEX IF NOT EXISTS idx_teachers_class ON public.teachers(homeroom_class);
CREATE INDEX IF NOT EXISTS idx_surveys_active ON public.surveys(is_active);
CREATE INDEX IF NOT EXISTS idx_responses_lookup ON public.survey_responses(survey_id, student_cccd);
CREATE INDEX IF NOT EXISTS idx_responses_class ON public.survey_responses(survey_id, class_name);
CREATE INDEX IF NOT EXISTS idx_responses_student ON public.survey_responses(student_cccd);

-- 7. Thiết lập Row Level Security (RLS) cho phép truy cập qua Supabase Anon Key
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

-- Cấp quyền công khai cho Anon Key đối với các bảng
DROP POLICY IF EXISTS "Allow anon all on app_settings" ON public.app_settings;
CREATE POLICY "Allow anon all on app_settings" ON public.app_settings FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on students" ON public.students;
CREATE POLICY "Allow anon all on students" ON public.students FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on teachers" ON public.teachers;
CREATE POLICY "Allow anon all on teachers" ON public.teachers FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on surveys" ON public.surveys;
CREATE POLICY "Allow anon all on surveys" ON public.surveys FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on survey_responses" ON public.survey_responses;
CREATE POLICY "Allow anon all on survey_responses" ON public.survey_responses FOR ALL TO anon USING (true) WITH CHECK (true);

-- 8. Thêm khảo sát mặc định: "Phòng, chống bạo lực học đường và xâm hại trẻ em" (20 câu hỏi)
INSERT INTO public.surveys (id, title, description, survey_type, is_active, show_answers, allow_multiple_attempts, questions)
VALUES (
    'b1000000-0000-0000-0000-000000000001',
    'Khảo sát kiến thức: Phòng, chống bạo lực học đường và xâm hại trẻ em',
    'Khảo sát nhằm nâng cao hiểu biết pháp luật, kỹ năng tự bảo vệ bản thân và xây dựng môi trường học đường an toàn, thân thiện.',
    'quiz',
    true,
    false,
    false,
    '[
      {
        "id": "q1",
        "question": "Hành vi nào sau đây là bạo lực tinh thần?",
        "options": [
          "Xô đẩy bạn ở hành lang",
          "Đặt biệt danh xấu, chế giễu ngoại hình của bạn",
          "Giật đồ dùng học tập của bạn",
          "Đánh nhau sau giờ học"
        ],
        "correct_answer": 1,
        "explanation": "Bạo lực tinh thần là lời nói, hành vi làm tổn thương danh dự, cảm xúc như chế giễu, lăng mạ, đe dọa, cô lập."
      },
      {
        "id": "q2",
        "question": "Bạo lực học đường gồm những hình thức nào?",
        "options": [
          "Chỉ có đánh nhau",
          "Chỉ có chửi bới",
          "Bạo lực thể chất, bạo lực tinh thần và bạo lực trên không gian mạng",
          "Chỉ những gì xảy ra trong lớp học"
        ],
        "correct_answer": 2,
        "explanation": "Bạo lực có thể xảy ra ở trường, trên đường và cả trên mạng xã hội."
      },
      {
        "id": "q3",
        "question": "Hành vi nào là bạo lực trên không gian mạng?",
        "options": [
          "Nhắn tin hỏi bài",
          "Lập nhóm chat để nói xấu, đăng ảnh chế, bình luận xúc phạm một bạn",
          "Chia sẻ tài liệu học tập",
          "Chơi game online cùng nhau"
        ],
        "correct_answer": 1,
        "explanation": "Nội dung lan truyền trên mạng rất nhanh và khó xóa, gây tổn thương lâu dài cho nạn nhân."
      },
      {
        "id": "q4",
        "question": "Khi chứng kiến một bạn đang bị đánh, em nên làm gì?",
        "options": [
          "Quay video đăng lên mạng",
          "Đứng xem và cổ vũ",
          "Báo ngay thầy cô, người lớn gần nhất; gọi 113 nếu nguy hiểm",
          "Bỏ đi coi như không biết"
        ],
        "correct_answer": 2,
        "explanation": "Đảm bảo an toàn cho mình trước, không lao vào can thiệp nếu nguy hiểm, nhưng không được im lặng."
      },
      {
        "id": "q5",
        "question": "Quay clip cảnh bạn bị đánh rồi đăng lên mạng là hành vi:",
        "options": [
          "Vô hại vì mình không đánh",
          "Giúp mọi người biết sự việc",
          "Có thể xâm phạm danh dự, đời tư của nạn nhân và bị xử lý theo quy định",
          "Đáng được khen"
        ],
        "correct_answer": 2,
        "explanation": "Hãy cung cấp clip cho thầy cô hoặc công an làm bằng chứng, không phát tán."
      },
      {
        "id": "q6",
        "question": "Theo Bộ luật Hình sự, người từ đủ bao nhiêu tuổi phải chịu trách nhiệm hình sự về tội phạm rất nghiêm trọng, tội phạm đặc biệt nghiêm trọng?",
        "options": [
          "12 tuổi",
          "14 tuổi",
          "16 tuổi",
          "18 tuổi"
        ],
        "correct_answer": 1,
        "explanation": "Người từ đủ 14 đến dưới 16 tuổi chịu trách nhiệm hình sự về tội phạm rất nghiêm trọng, đặc biệt nghiêm trọng đối với một số tội theo Điều 12 Bộ luật Hình sự."
      },
      {
        "id": "q7",
        "question": "Khi bị nhắn tin đe dọa trên mạng, em nên:",
        "options": [
          "Nhắn lại chửi cho bõ tức",
          "Xóa hết tin nhắn cho khỏi nhìn thấy",
          "Không trả lời, chụp màn hình lưu bằng chứng, chặn và báo người lớn",
          "Rủ bạn đi trả thù"
        ],
        "correct_answer": 2,
        "explanation": "Bằng chứng giúp thầy cô, gia đình và cơ quan chức năng xử lý đúng người, đúng việc."
      },
      {
        "id": "q8",
        "question": "Văn bản nào quy định về môi trường giáo dục an toàn, lành mạnh, thân thiện, phòng, chống bạo lực học đường?",
        "options": [
          "Nghị định 80/2017/NĐ-CP",
          "Luật Đất đai",
          "Luật Hôn nhân và gia đình",
          "Luật Thuế thu nhập cá nhân"
        ],
        "correct_answer": 0,
        "explanation": "Nghị định 80/2017/NĐ-CP của Chính phủ."
      },
      {
        "id": "q9",
        "question": "Cô lập, tẩy chay, không cho một bạn tham gia nhóm là:",
        "options": [
          "Chuyện bình thường",
          "Một hình thức bạo lực tinh thần",
          "Quyền của mỗi người",
          "Một trò đùa"
        ],
        "correct_answer": 1,
        "explanation": "Bị cô lập kéo dài khiến bạn buồn bã, sợ đến trường, ảnh hưởng học tập và sức khỏe tâm thần."
      },
      {
        "id": "q10",
        "question": "Nếu đang bị bắt nạt, việc đầu tiên em nên làm là:",
        "options": [
          "Im lặng chịu đựng",
          "Mang dao, gậy đi học để tự vệ",
          "Tránh xa nơi nguy hiểm và nói ngay với người lớn tin cậy",
          "Nghỉ học"
        ],
        "correct_answer": 2,
        "explanation": "Mang hung khí vừa vi phạm nội quy, pháp luật vừa khiến mọi việc nguy hiểm hơn."
      },
      {
        "id": "q11",
        "question": "Theo Luật Trẻ em năm 2016, trẻ em là người:",
        "options": [
          "Dưới 18 tuổi",
          "Dưới 16 tuổi",
          "Dưới 15 tuổi",
          "Dưới 14 tuổi"
        ],
        "correct_answer": 1,
        "explanation": "Trẻ em là người dưới 16 tuổi."
      },
      {
        "id": "q12",
        "question": "Theo Luật Trẻ em, xâm hại trẻ em bao gồm:",
        "options": [
          "Chỉ có đánh đập",
          "Bạo lực, bóc lột, xâm hại tình dục, mua bán, bỏ rơi, bỏ mặc trẻ em",
          "Chỉ có mắng mỏ",
          "Chỉ có bỏ rơi"
        ],
        "correct_answer": 1,
        "explanation": "Xâm hại có nhiều hình thức, cả thể chất lẫn tinh thần."
      },
      {
        "id": "q13",
        "question": "Ví dụ nào là xâm hại về tinh thần đối với trẻ em?",
        "options": [
          "Thường xuyên chửi mắng, đe dọa, làm nhục trước người khác",
          "Khen ngợi khi em làm tốt",
          "Nhắc nhở em học bài",
          "Động viên khi em buồn"
        ],
        "correct_answer": 0,
        "explanation": "Tổn thương tinh thần không để lại vết thương trên da nhưng ảnh hưởng rất lâu dài."
      },
      {
        "id": "q14",
        "question": "Khi ai đó (kể cả người quen) có hành vi đụng chạm khiến em sợ hãi, khó chịu, em nên:",
        "options": [
          "Im lặng vì đó là người quen",
          "Nói “KHÔNG”, rời đi ngay và kể với người lớn tin cậy",
          "Giữ bí mật như họ dặn",
          "Tự trách mình"
        ],
        "correct_answer": 1,
        "explanation": "Ba bước: Nói KHÔNG – Rời đi – Kể lại. Cơ thể em là của em."
      },
      {
        "id": "q15",
        "question": "Một người lạ trên mạng khen em, xin ảnh riêng tư và dặn “đừng kể với ai”. Đây là:",
        "options": [
          "Tình bạn đẹp",
          "Dấu hiệu nguy hiểm – cần từ chối, chặn và báo người lớn",
          "Cơ hội nổi tiếng",
          "Chuyện không đáng lo"
        ],
        "correct_answer": 1,
        "explanation": "Lời dặn giữ bí mật là dấu hiệu cảnh báo rất rõ."
      },
      {
        "id": "q16",
        "question": "Bí mật nào em KHÔNG nên giữ?",
        "options": [
          "Bí mật về món quà sinh nhật định tặng mẹ",
          "Bí mật khiến em sợ hãi, khó chịu, hoặc bị dặn không được kể với bố mẹ",
          "Bí mật về bữa tiệc bất ngờ cho bạn",
          "Bí mật đáp án trò chơi"
        ],
        "correct_answer": 1,
        "explanation": "“Bí mật vui” thì có thể giữ; “bí mật làm em sợ” thì phải kể với người lớn tin cậy."
      },
      {
        "id": "q17",
        "question": "Tổng đài điện thoại quốc gia bảo vệ trẻ em là số nào?",
        "options": [
          "111",
          "113",
          "114",
          "115"
        ],
        "correct_answer": 0,
        "explanation": "Tổng đài 111 miễn phí, hoạt động 24/7."
      },
      {
        "id": "q18",
        "question": "Tình huống nào có nguy cơ bị xâm hại cao nhất?",
        "options": [
          "Đi học cùng nhóm bạn",
          "Một mình đi theo người mới quen qua mạng đến nơi vắng",
          "Về nhà đúng giờ",
          "Báo bố mẹ nơi mình đến"
        ],
        "correct_answer": 1,
        "explanation": "Không gặp người quen qua mạng một mình; nếu cần gặp phải có bố mẹ biết và đi cùng."
      },
      {
        "id": "q19",
        "question": "Nếu bị xâm hại, đó là lỗi của ai?",
        "options": [
          "Của nạn nhân",
          "Không phải lỗi của nạn nhân – lỗi thuộc về người xâm hại",
          "Của bạn bè nạn nhân",
          "Không ai có lỗi"
        ],
        "correct_answer": 1,
        "explanation": "Nạn nhân cần được tin tưởng, bảo vệ và hỗ trợ, không bị trách móc."
      },
      {
        "id": "q20",
        "question": "Khi bạn thân tâm sự rằng bạn ấy đang bị người khác làm hại, em nên:",
        "options": [
          "Kể cho cả lớp biết",
          "Lắng nghe, tin bạn, động viên và cùng bạn báo người lớn tin cậy hoặc gọi 111",
          "Bảo bạn im lặng cho qua",
          "Không quan tâm"
        ],
        "correct_answer": 1,
        "explanation": "Giữ kín chuyện của bạn với người ngoài, nhưng phải báo người lớn có trách nhiệm để bảo vệ bạn."
      }
    ]'::JSONB
)
ON CONFLICT (id) DO UPDATE 
SET title = EXCLUDED.title,
    description = EXCLUDED.description,
    questions = EXCLUDED.questions;

-- 9. Thêm tài khoản mẫu để trải nghiệm thử nghiệm ngay lập tức
INSERT INTO public.teachers (username, password, full_name, homeroom_class)
VALUES 
    ('gv_10a1', '123456', 'Cô Nguyễn Thị Mai', '10A1'),
    ('gv_11a2', '123456', 'Thầy Trần Văn Hùng', '11A2')
ON CONFLICT (username) DO NOTHING;

INSERT INTO public.students (stt, full_name, dob_display, dob_password, cccd, class_name)
VALUES
    (1, 'Nguyễn Văn An', '05/08/2009', '05082009', '001209001234', '10A1'),
    (2, 'Trần Thị Bình', '12/10/2009', '12102009', '001209005678', '10A1'),
    (3, 'Lê Hoàng Nam', '20/03/2009', '20032009', '001209009012', '10A1'),
    (4, 'Phạm Quỳnh Chi', '15/11/2008', '15112008', '001208003456', '11A2'),
    (5, 'Vũ Đức Minh', '08/04/2008', '08042008', '001208007890', '11A2')
ON CONFLICT (cccd) DO NOTHING;
