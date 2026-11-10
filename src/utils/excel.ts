import * as XLSX from 'xlsx';
import { Student, Teacher, Survey, SurveyResponse } from '../types';

/**
 * Normalizes CCCD to a clean 12-digit string.
 * Excel often truncates leading zero from numbers like 001209... -> 1209... (11 digits).
 */
export function normalizeCCCD(raw: any): { value: string; isValid: boolean; error?: string } {
  if (raw === undefined || raw === null) {
    return { value: '', isValid: false, error: 'Thiếu số CCCD' };
  }
  let str = String(raw).trim().replace(/[^0-9]/g, '');

  // If 11 digits, pad with a single leading 0
  if (str.length === 11) {
    str = '0' + str;
  } else if (str.length === 10) {
    str = '00' + str;
  }

  if (str.length !== 12) {
    return {
      value: str,
      isValid: false,
      error: `CCCD phải gồm đúng 12 chữ số (hiện có ${str.length} số)`
    };
  }

  return { value: str, isValid: true };
}

/**
 * Normalizes Date of Birth.
 * Accepts:
 * - Excel serial date numbers (e.g., 39999)
 * - Strings like "05/08/2009", "5/8/2009", "05-08-2009", "2009-08-05", "05082009"
 * Returns { dobDisplay: "dd/mm/yyyy", dobPassword: "ddmmyyyy", isValid: boolean }
 */
export function normalizeDOB(raw: any): {
  dobDisplay: string;
  dobPassword: string;
  isValid: boolean;
  error?: string;
} {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { dobDisplay: '', dobPassword: '', isValid: false, error: 'Thiếu ngày sinh' };
  }

  // Handle Excel Serial Date Number
  if (typeof raw === 'number' || (!isNaN(Number(raw)) && Number(raw) > 10000 && Number(raw) < 70000)) {
    try {
      const dateObj = XLSX.SSF.parse_date_code(Number(raw));
      if (dateObj && dateObj.y && dateObj.m && dateObj.d) {
        const d = String(dateObj.d).padStart(2, '0');
        const m = String(dateObj.m).padStart(2, '0');
        const y = String(dateObj.y);
        return {
          dobDisplay: `${d}/${m}/${y}`,
          dobPassword: `${d}${m}${y}`,
          isValid: true,
        };
      }
    } catch {
      // ignore
    }
  }

  const str = String(raw).trim();

  // If already 8 digits "ddmmyyyy"
  if (/^\d{8}$/.test(str)) {
    const d = str.slice(0, 2);
    const m = str.slice(2, 4);
    const y = str.slice(4, 8);
    const dNum = parseInt(d, 10);
    const mNum = parseInt(m, 10);
    const yNum = parseInt(y, 10);
    if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12 && yNum >= 1900 && yNum <= 2030) {
      return {
        dobDisplay: `${d}/${m}/${y}`,
        dobPassword: `${d}${m}${y}`,
        isValid: true,
      };
    }
  }

  // Handle dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return {
      dobDisplay: `${d}/${m}/${y}`,
      dobPassword: `${d}${m}${y}`,
      isValid: true,
    };
  }

  // Handle yyyy-mm-dd (ISO format)
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return {
      dobDisplay: `${d}/${m}/${y}`,
      dobPassword: `${d}${m}${y}`,
      isValid: true,
    };
  }

  return {
    dobDisplay: str,
    dobPassword: '',
    isValid: false,
    error: `Định dạng ngày sinh không hợp lệ: "${str}". Hỗ trợ dạng dd/mm/yyyy`,
  };
}

// ----------------- DOWNLOAD TEMPLATES -----------------

export function downloadStudentTemplate() {
  const data = [
    {
      'STT': 1,
      'Họ và tên': 'Nguyễn Văn An',
      'Ngày sinh': '05/08/2009',
      'Số CCCD': '001209001234',
      'Lớp': '10A1',
    },
    {
      'STT': 2,
      'Họ và tên': 'Trần Thị Bình',
      'Ngày sinh': '12/10/2009',
      'Số CCCD': '001209005678',
      'Lớp': '10A1',
    },
    {
      'STT': 3,
      'Họ và tên': 'Lê Hoàng Nam',
      'Ngày sinh': '20/03/2009',
      'Số CCCD': '001209009012',
      'Lớp': '10A2',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  // Set column widths
  ws['!cols'] = [
    { wch: 8 },  // STT
    { wch: 25 }, // Họ và tên
    { wch: 15 }, // Ngày sinh
    { wch: 20 }, // Số CCCD
    { wch: 12 }, // Lớp
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachHocSinh');
  XLSX.writeFile(wb, 'Mau_Import_HocSinh_ToanTruong.xlsx');
}

export function downloadTeacherTemplate() {
  const data = [
    {
      'Tên đăng nhập': 'gv_10a1',
      'Mật khẩu': '123456',
      'Họ và tên': 'Cô Nguyễn Thị Mai',
      'Lớp chủ nhiệm': '10A1',
    },
    {
      'Tên đăng nhập': 'gv_10a2',
      'Mật khẩu': '123456',
      'Họ và tên': 'Thầy Trần Văn Hùng',
      'Lớp chủ nhiệm': '10A2',
    },
    {
      'Tên đăng nhập': 'gv_11b1',
      'Mật khẩu': '123456',
      'Họ và tên': 'Cô Lê Thị Hương',
      'Lớp chủ nhiệm': '11B1',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 18 }, // Tên đăng nhập
    { wch: 15 }, // Mật khẩu
    { wch: 25 }, // Họ và tên
    { wch: 15 }, // Lớp chủ nhiệm
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachGiaoVien');
  XLSX.writeFile(wb, 'Mau_Import_GiaoVien_ChuNhiem.xlsx');
}

// ----------------- PARSE EXCEL FILES -----------------

export interface ParsedStudentRow {
  rowNumber: number;
  stt?: number;
  full_name: string;
  dob_display: string;
  dob_password: string;
  cccd: string;
  class_name: string;
  isValid: boolean;
  errors: string[];
}

export async function parseStudentExcel(file: File): Promise<{
  rows: ParsedStudentRow[];
  validCount: number;
  errorCount: number;
}> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  
  // Read as raw json with header array
  const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const rows: ParsedStudentRow[] = [];

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // +1 for header, +1 for 1-based index
    const errors: string[] = [];

    // Map column aliases flexibly
    const rawStt = row['STT'] || row['stt'] || index + 1;
    const rawName = String(row['Họ và tên'] || row['Họ và Tên'] || row['Họ tên'] || row['Full Name'] || '').trim();
    const rawDob = row['Ngày sinh'] || row['Ngày Sinh'] || row['DOB'] || '';
    const rawCccd = row['Số CCCD'] || row['CCCD'] || row['Số CMND'] || row['CMND'] || '';
    const rawClass = String(row['Lớp'] || row['Lớp chủ nhiệm'] || row['Class'] || '').trim().toUpperCase();

    if (!rawName) {
      errors.push('Thiếu họ và tên');
    }

    const cccdResult = normalizeCCCD(rawCccd);
    if (!cccdResult.isValid) {
      errors.push(cccdResult.error || 'CCCD không hợp lệ');
    }

    const dobResult = normalizeDOB(rawDob);
    if (!dobResult.isValid) {
      errors.push(dobResult.error || 'Ngày sinh không hợp lệ');
    }

    if (!rawClass) {
      errors.push('Thiếu thông tin lớp');
    }

    rows.push({
      rowNumber,
      stt: Number(rawStt) || index + 1,
      full_name: rawName,
      dob_display: dobResult.dobDisplay,
      dob_password: dobResult.dobPassword,
      cccd: cccdResult.value,
      class_name: rawClass,
      isValid: errors.length === 0,
      errors,
    });
  });

  const validCount = rows.filter(r => r.isValid).length;
  const errorCount = rows.length - validCount;

  return { rows, validCount, errorCount };
}

export interface ParsedTeacherRow {
  rowNumber: number;
  username: string;
  password: string;
  full_name: string;
  homeroom_class: string;
  isValid: boolean;
  errors: string[];
}

export async function parseTeacherExcel(file: File): Promise<{
  rows: ParsedTeacherRow[];
  validCount: number;
  errorCount: number;
}> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  
  // Read as array of arrays (AOA) to inspect raw cells and locate header row reliably
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!aoa || aoa.length === 0) {
    return { rows: [], validCount: 0, errorCount: 0 };
  }

  const normalizeStr = (val: any): string => {
    return String(val || '').normalize('NFC').trim().toLowerCase().replace(/[\r\n\t_]/g, ' ');
  };

  // 1. Detect header row by matching keywords across the first 10 rows
  let headerIndex = -1;
  let colMap = { username: -1, password: -1, fullName: -1, homeroomClass: -1 };

  for (let r = 0; r < Math.min(aoa.length, 10); r++) {
    const row = aoa[r] || [];
    let uCol = -1, pCol = -1, nCol = -1, cCol = -1;

    row.forEach((cell, c) => {
      const norm = normalizeStr(cell);
      if (!norm) return;

      if (/tên đăng nhập|tài khoản|tai khoan|username|user|mã gv|ma gv|tk/i.test(norm)) {
        uCol = c;
      } else if (/mật khẩu|mat khau|password|pass|mk/i.test(norm)) {
        pCol = c;
      } else if (/họ và tên|họ tên|ho va ten|ho ten|full name|tên gv|ten gv|gvcn|họ và tên gv/i.test(norm)) {
        nCol = c;
      } else if (/lớp chủ nhiệm|lớp cn|lop chu nhiem|lop cn|lớp|class|lớp dạy|phụ trách/i.test(norm)) {
        cCol = c;
      }
    });

    // If at least 2 key columns or username column are found, this is our header
    if (uCol !== -1 || (nCol !== -1 && cCol !== -1)) {
      headerIndex = r;
      colMap = {
        username: uCol !== -1 ? uCol : 0,
        password: pCol !== -1 ? pCol : 1,
        fullName: nCol !== -1 ? nCol : 2,
        homeroomClass: cCol !== -1 ? cCol : 3,
      };
      break;
    }
  }

  // If no explicit header row was identified by keywords, default to row 0 with positional standard:
  // Col 0: Tên đăng nhập | Col 1: Mật khẩu | Col 2: Họ và tên | Col 3: Lớp chủ nhiệm
  if (headerIndex === -1) {
    headerIndex = 0;
    colMap = { username: 0, password: 1, fullName: 2, homeroomClass: 3 };
  }

  const rows: ParsedTeacherRow[] = [];

  for (let r = headerIndex + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const rowNumber = r + 1;

    const rawUser = row[colMap.username];
    const rawPass = row[colMap.password];
    const rawName = row[colMap.fullName];
    const rawClass = row[colMap.homeroomClass];

    // Skip completely empty rows
    const hasAnyData = [rawUser, rawPass, rawName, rawClass].some(
      v => v !== undefined && v !== null && String(v).trim() !== ''
    );
    if (!hasAnyData) continue;

    const errors: string[] = [];

    const username = String(rawUser !== undefined && rawUser !== null ? rawUser : '').trim().toLowerCase();
    const password = String(rawPass !== undefined && rawPass !== null ? rawPass : '').trim();
    const full_name = String(rawName !== undefined && rawName !== null ? rawName : '').normalize('NFC').trim();
    const homeroom_class = String(rawClass !== undefined && rawClass !== null ? rawClass : '').trim().toUpperCase();

    if (!username) errors.push('Thiếu tên đăng nhập');
    if (!password) errors.push('Thiếu mật khẩu');
    if (!full_name) errors.push('Thiếu họ và tên');
    if (!homeroom_class) errors.push('Thiếu lớp chủ nhiệm');

    rows.push({
      rowNumber,
      username,
      password,
      full_name,
      homeroom_class,
      isValid: errors.length === 0,
      errors,
    });
  }

  const validCount = rows.filter(r => r.isValid).length;
  const errorCount = rows.length - validCount;

  return { rows, validCount, errorCount };
}

// ----------------- EXPORT REPORTS -----------------

export function exportClassResultsToExcel(
  className: string,
  surveyTitle: string,
  students: Student[],
  responses: SurveyResponse[],
  survey: Survey
) {
  const responseMap = new Map<string, SurveyResponse>();
  responses.forEach(r => responseMap.set(r.student_cccd, r));

  const rows = students.map((s, idx) => {
    const resp = responseMap.get(s.cccd);
    const isCompleted = !!resp;
    const scoreText = resp && resp.score !== undefined ? `${resp.score}/${resp.total_questions || survey.questions.length}` : '-';
    const percent = resp && resp.total_questions ? `${Math.round((resp.score || 0) / resp.total_questions * 100)}%` : '-';
    const submitTime = resp ? new Date(resp.submitted_at).toLocaleString('vi-VN') : 'Chưa tham gia';

    const baseRow: any = {
      'STT': s.stt || idx + 1,
      'Họ và tên': s.full_name,
      'Số CCCD': s.cccd,
      'Ngày sinh': s.dob_display,
      'Lớp': s.class_name,
      'Trạng thái': isCompleted ? 'Đã hoàn thành' : 'Chưa hoàn thành',
      'Điểm số': scoreText,
      'Tỷ lệ đúng': percent,
      'Thời gian nộp': submitTime,
    };

    // Include student answer for each question
    survey.questions.forEach((q, qIndex) => {
      const qKey = `Câu ${qIndex + 1}`;
      if (resp && resp.answers) {
        const ans = resp.answers[q.id];
        if (ans !== undefined) {
          if (typeof ans === 'number' && q.options && q.options[ans]) {
            baseRow[qKey] = `${String.fromCharCode(65 + ans)}. ${q.options[ans]}`;
          } else {
            baseRow[qKey] = String(ans);
          }
        } else {
          baseRow[qKey] = 'Bỏ trống';
        }
      } else {
        baseRow[qKey] = '-';
      }
    });

    return baseRow;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Lop_${className}`);
  
  const cleanTitle = surveyTitle.replace(/[\\/*?:[\]]/g, '').slice(0, 25);
  XLSX.writeFile(wb, `KetQua_${className}_${cleanTitle}.xlsx`);
}

export function exportSchoolSummaryToExcel(
  surveyTitle: string,
  classStats: Array<{
    className: string;
    totalStudents: number;
    completedCount: number;
    pendingCount: number;
    completionRate: number;
    averageScore?: number;
  }>
) {
  const rows = classStats.map((item, idx) => ({
    'STT': idx + 1,
    'Lớp': item.className,
    'Sĩ số': item.totalStudents,
    'Đã tham gia': item.completedCount,
    'Chưa tham gia': item.pendingCount,
    'Tỷ lệ hoàn thành (%)': `${item.completionRate}%`,
    'Điểm trung bình': item.averageScore !== undefined ? item.averageScore.toFixed(2) : '-',
  }));

  const totalStudents = classStats.reduce((sum, c) => sum + c.totalStudents, 0);
  const totalCompleted = classStats.reduce((sum, c) => sum + c.completedCount, 0);
  const totalPending = classStats.reduce((sum, c) => sum + c.pendingCount, 0);
  const overallRate = totalStudents > 0 ? Math.round((totalCompleted / totalStudents) * 100) : 0;

  // Add total summary row
  rows.push({
    'STT': rows.length + 1,
    'Lớp': 'TOÀN TRƯỜNG',
    'Sĩ số': totalStudents,
    'Đã tham gia': totalCompleted,
    'Chưa tham gia': totalPending,
    'Tỷ lệ hoàn thành (%)': `${overallRate}%`,
    'Điểm trung bình': '-',
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ThongKeToanTruong');

  const cleanTitle = surveyTitle.replace(/[\\/*?:[\]]/g, '').slice(0, 25);
  XLSX.writeFile(wb, `BaoCao_ToanTruong_${cleanTitle}.xlsx`);
}

/**
 * Trích xuất Khối từ tên lớp (ví dụ: 10A1 -> Khối 10, 11B2 -> Khối 11, 12C3 -> Khối 12)
 */
export function getGradeFromClassName(className: string): string {
  const match = (className || '').trim().match(/^(\d{1,2})/);
  return match ? `Khối ${match[1]}` : 'Khác';
}

/**
 * Xuất Excel danh sách từng học sinh theo bộ lọc linh hoạt: Toàn trường / Khối / Lớp & Đã làm / Chưa làm
 */
export function exportFilteredSurveyResponsesToExcel(
  survey: Survey,
  students: Student[],
  responses: SurveyResponse[],
  scopeLabel: string,
  statusLabel: string
) {
  const responseMap = new Map<string, SurveyResponse>();
  responses.forEach(r => responseMap.set(r.student_cccd, r));

  const rows = students.map((s, idx) => {
    const resp = responseMap.get(s.cccd);
    const isCompleted = !!resp;
    const scoreText = resp && resp.score !== undefined ? `${resp.score}/${resp.total_questions || survey.questions.length}` : '-';
    const percent = resp && resp.total_questions ? `${Math.round((resp.score || 0) / resp.total_questions * 100)}%` : '-';
    const submitTime = resp ? new Date(resp.submitted_at).toLocaleString('vi-VN') : 'Chưa tham gia';

    const baseRow: any = {
      'STT': s.stt || idx + 1,
      'Họ và tên': s.full_name,
      'Khối': getGradeFromClassName(s.class_name),
      'Lớp': s.class_name,
      'Số CCCD': s.cccd,
      'Ngày sinh': s.dob_display,
      'Trạng thái': isCompleted ? 'Đã thực hiện' : 'Chưa thực hiện',
      'Điểm số': scoreText,
      'Tỷ lệ đúng': percent,
      'Thời gian nộp': submitTime,
    };

    // Chi tiết câu trả lời từng câu
    survey.questions.forEach((q, qIndex) => {
      const qKey = `Câu ${qIndex + 1}`;
      if (resp && resp.answers) {
        const ans = resp.answers[q.id];
        if (ans !== undefined && ans !== null) {
          if (typeof ans === 'object' && ans.fileUrl) {
            // Tệp đính kèm tải lên Google Drive
            baseRow[qKey] = `${ans.fileName || 'Tệp tải lên'}: ${ans.fileUrl}`;
          } else if (typeof ans === 'number' && q.options && q.options[ans]) {
            baseRow[qKey] = `${String.fromCharCode(65 + ans)}. ${q.options[ans]}`;
          } else {
            baseRow[qKey] = String(ans);
          }
        } else {
          baseRow[qKey] = 'Bỏ trống';
        }
      } else {
        baseRow[qKey] = '-';
      }
    });

    return baseRow;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  const cleanSheetName = (scopeLabel || 'DanhSach').replace(/[\\/*?:[\]]/g, '').slice(0, 30);
  XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);

  const cleanScope = scopeLabel.replace(/[\\/*?:[\]\s]/g, '_');
  const cleanStatus = statusLabel.replace(/[\\/*?:[\]\s]/g, '_');
  const cleanSurvey = survey.title.replace(/[\\/*?:[\]]/g, '').slice(0, 20);
  XLSX.writeFile(wb, `KetQua_${cleanScope}_${cleanStatus}_${cleanSurvey}.xlsx`);
}

