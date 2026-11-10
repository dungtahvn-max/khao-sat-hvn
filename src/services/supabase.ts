import { createClient } from '@supabase/supabase-js';
import { Student, Teacher, Survey, SurveyResponse, AppSettings, AppTheme } from '../types';
import { DEFAULT_SURVEY, INITIAL_STUDENTS, INITIAL_TEACHERS } from '../data/defaultSurvey';
import { compareClassNames } from '../utils/classOrder';

export const SUPABASE_URL = "https://dfsjnuifpnlswzcibkao.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmc2pudWlmcG5sc3d6Y2lia2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwMTM0MTYsImV4cCI6MjEwOTU4OTQxNn0.MkQ5TeIAAOhkgOPrGPgCbmqlqVdK42utvKpkfQzPvHc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Local Storage Keys for reliable caching / fallback mode
const STORAGE_KEYS = {
  STUDENTS: 'school_survey_students_v1',
  TEACHERS: 'school_survey_teachers_v1',
  SURVEYS: 'school_survey_surveys_v1',
  RESPONSES: 'school_survey_responses_v1',
  SETTINGS: 'school_survey_settings_v1',
};

export function safeGetStorage(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {}
  return null;
}

export function safeSetStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch (err) {
    console.warn(`LocalStorage quota or access warning for ${key}:`, err);
  }
}

// Check if localStorage is initialized
function initLocalStore() {
  if (!safeGetStorage(STORAGE_KEYS.STUDENTS)) {
    safeSetStorage(STORAGE_KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
  }
  if (!safeGetStorage(STORAGE_KEYS.TEACHERS)) {
    safeSetStorage(STORAGE_KEYS.TEACHERS, JSON.stringify(INITIAL_TEACHERS));
  }
  if (!safeGetStorage(STORAGE_KEYS.SURVEYS)) {
    safeSetStorage(STORAGE_KEYS.SURVEYS, JSON.stringify([DEFAULT_SURVEY]));
  }
  if (!safeGetStorage(STORAGE_KEYS.RESPONSES)) {
    safeSetStorage(STORAGE_KEYS.RESPONSES, JSON.stringify([]));
  }
  if (!safeGetStorage(STORAGE_KEYS.SETTINGS)) {
    safeSetStorage(STORAGE_KEYS.SETTINGS, JSON.stringify({
      id: 1,
      admin_username: 'admin',
      admin_password: '1235',
      announcement: 'Chào mừng các em học sinh và quý thầy cô đến với Hệ thống Khảo sát & Thu thập Thông tin Học sinh Toàn trường!'
    }));
  }
}
initLocalStore();

export interface ConnectionStatus {
  isSupabaseLive: boolean;
  checked: boolean;
  missingTables: string[];
}

let cachedConnectionStatus: ConnectionStatus | null = null;

export async function checkSupabaseConnection(forceRefresh = false): Promise<ConnectionStatus> {
  if (cachedConnectionStatus && !forceRefresh) {
    return cachedConnectionStatus;
  }
  
  const tables = ['students', 'teachers', 'surveys', 'survey_responses', 'app_settings'];
  const missingTables: string[] = [];

  try {
    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error) {
        missingTables.push(table);
      }
    }

    const isSupabaseLive = missingTables.length === 0;
    cachedConnectionStatus = {
      isSupabaseLive,
      checked: true,
      missingTables,
    };
    return cachedConnectionStatus;
  } catch {
    cachedConnectionStatus = {
      isSupabaseLive: false,
      checked: true,
      missingTables: tables,
    };
    return cachedConnectionStatus;
  }
}

// ----------------- STUDENTS -----------------
export async function getStudents(): Promise<Student[]> {
  try {
    const status = await checkSupabaseConnection();
    if (status.isSupabaseLive) {
      // Supabase / PostgREST limits queries to 1,000 rows by default.
      // Use pagination with .range() to retrieve ALL students (1,000 to 5,000+).
      let allStudents: Student[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .order('class_name', { ascending: true })
          .order('stt', { ascending: true })
          .range(from, to);

        if (error) {
          console.error(`Error fetching students page ${page}:`, error);
          break;
        }

        if (data && data.length > 0) {
          allStudents = allStudents.concat(data as Student[]);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      if (allStudents.length > 0) {
        allStudents.sort((a, b) => {
          const c = compareClassNames(a.class_name, b.class_name);
          if (c !== 0) return c;
          return (a.stt || 0) - (b.stt || 0);
        });
        safeSetStorage(STORAGE_KEYS.STUDENTS, JSON.stringify(allStudents));
        return allStudents;
      }
    }
  } catch (err) {
    console.warn('Falling back to local students storage', err);
  }
  const raw = safeGetStorage(STORAGE_KEYS.STUDENTS);
  const fallbackList: Student[] = raw ? JSON.parse(raw) : INITIAL_STUDENTS;
  return [...fallbackList].sort((a, b) => {
    const c = compareClassNames(a.class_name, b.class_name);
    if (c !== 0) return c;
    return (a.stt || 0) - (b.stt || 0);
  });
}

export async function upsertStudents(
  students: Partial<Student>[],
  onProgress?: (percent: number, currentBatch: number, totalBatches: number, processedCount: number) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    if (!students || students.length === 0) {
      return { success: true, count: 0 };
    }

    // 1. Deduplicate by CCCD in the incoming list so PostgreSQL does not error with
    // "ON CONFLICT DO UPDATE command cannot affect row a second time" if the Excel had duplicate CCCDs.
    const uniqueStudentsMap = new Map<string, Partial<Student>>();
    students.forEach(s => {
      if (s.cccd && s.cccd.trim()) {
        const cccdKey = s.cccd.trim();
        uniqueStudentsMap.set(cccdKey, s);
      }
    });
    const uniqueStudents = Array.from(uniqueStudentsMap.values());

    const status = await checkSupabaseConnection();
    // 2. Batch size of 150-200 provides optimal performance and reliability without timeout
    const batchSize = 150;
    const totalBatches = Math.ceil(uniqueStudents.length / batchSize);

    if (status.isSupabaseLive) {
      for (let i = 0; i < uniqueStudents.length; i += batchSize) {
        const rawBatch = uniqueStudents.slice(i, i + batchSize);

        // Sanitize batch payload: clean strings and only include UUID id if valid
        const cleanBatch = rawBatch.map(s => {
          const item: any = {
            full_name: String(s.full_name || '').trim(),
            dob_display: String(s.dob_display || '').trim(),
            dob_password: String(s.dob_password || '').trim(),
            cccd: String(s.cccd || '').trim(),
            class_name: String(s.class_name || '').trim().toUpperCase(),
          };
          if (s.stt !== undefined && s.stt !== null && !isNaN(Number(s.stt))) {
            item.stt = Number(s.stt);
          }
          // Only send id if it's a valid UUID; otherwise let Postgres generate gen_random_uuid()
          if (s.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id)) {
            item.id = s.id;
          }
          return item;
        });

        const { error } = await supabase
          .from('students')
          .upsert(cleanBatch, { onConflict: 'cccd' });

        if (error) {
          console.error(`Error saving students batch ${Math.floor(i / batchSize) + 1}:`, error);
          throw new Error(`Lỗi lưu lô ${Math.floor(i / batchSize) + 1}/${totalBatches}: ${error.message}`);
        }

        const currentBatch = Math.floor(i / batchSize) + 1;
        const processedCount = Math.min(i + batchSize, uniqueStudents.length);
        if (onProgress) {
          const percent = Math.round((currentBatch / totalBatches) * 100);
          onProgress(percent, currentBatch, totalBatches, processedCount);
        }
      }
    }

    // 3. Update local cache with newly imported students
    const existing = await getStudents();
    const map = new Map<string, Student>();
    existing.forEach(s => map.set(s.cccd, s));
    uniqueStudents.forEach(s => {
      if (s.cccd) {
        const prev = map.get(s.cccd) || ({} as Student);
        map.set(s.cccd, {
          ...prev,
          ...s,
          id: s.id || prev.id || `s_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        } as Student);
      }
    });

    const updated = Array.from(map.values());
    safeSetStorage(STORAGE_KEYS.STUDENTS, JSON.stringify(updated));

    if (onProgress) {
      onProgress(100, totalBatches, totalBatches, uniqueStudents.length);
    }

    return { success: true, count: uniqueStudents.length };
  } catch (error: any) {
    console.error('Error upserting students:', error);
    return { success: false, count: 0, error: error.message || 'Lỗi lưu học sinh' };
  }
}

export async function deleteStudent(id: string, cccd: string): Promise<boolean> {
  try {
    const status = await checkSupabaseConnection();
    if (status.isSupabaseLive) {
      await supabase.from('students').delete().eq('cccd', cccd);
    }
    const current = await getStudents();
    const updated = current.filter(s => s.cccd !== cccd && s.id !== id);
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(updated));
    return true;
  } catch (e) {
    console.error('Error deleting student', e);
    return false;
  }
}

export async function deleteAllStudents(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const current = await getStudents();
    const count = current.length;
    const status = await checkSupabaseConnection();
    if (status.isSupabaseLive) {
      const { error } = await supabase.from('students').delete().neq('cccd', '');
      if (error) console.warn('Supabase delete all students warning:', error);
    }
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([]));
    return { success: true, count };
  } catch (e: any) {
    console.error('Error deleting all students', e);
    return { success: false, count: 0, error: e.message || 'Lỗi khi xóa học sinh' };
  }
}


// ----------------- TEACHERS -----------------
export async function getTeachers(): Promise<Teacher[]> {
  try {
    const status = await checkSupabaseConnection();
    if (status.isSupabaseLive) {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .order('homeroom_class', { ascending: true });
      if (!error && data) {
        const mappedTeachers: Teacher[] = data.map((t: any) => ({
          ...t,
          role: (t.homeroom_class === 'BGH' || t.homeroom_class === 'ADMIN') ? 'admin' : (t.role || 'teacher'),
        }));
        mappedTeachers.sort((a, b) => compareClassNames(a.homeroom_class || '', b.homeroom_class || ''));
        safeSetStorage(STORAGE_KEYS.TEACHERS, JSON.stringify(mappedTeachers));
        return mappedTeachers;
      }
    }
  } catch (err) {
    console.warn('Falling back to local teachers storage', err);
  }
  const raw = safeGetStorage(STORAGE_KEYS.TEACHERS);
  const fallbackTeachers: Teacher[] = raw ? JSON.parse(raw) : INITIAL_TEACHERS;
  return [...fallbackTeachers].sort((a, b) => compareClassNames(a.homeroom_class || '', b.homeroom_class || ''));
}

export async function upsertTeachers(teachers: Partial<Teacher>[]): Promise<boolean> {
  try {
    if (!teachers || teachers.length === 0) return true;

    // Deduplicate by username to prevent PostgreSQL "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const uniqueMap = new Map<string, Partial<Teacher>>();
    teachers.forEach(t => {
      if (t.username && t.username.trim()) {
        uniqueMap.set(t.username.trim().toLowerCase(), t);
      }
    });
    const uniqueTeachers = Array.from(uniqueMap.values());

    const status = await checkSupabaseConnection();
    if (status.isSupabaseLive) {
      // Clean payload: strictly send ONLY columns that exist in the Supabase `teachers` table:
      // (username, password, full_name, homeroom_class, and id if valid UUID).
      // Never send `role` to Supabase as `teachers` table has no role column.
      const cleanTeachers = uniqueTeachers.map(t => {
        const item: any = {
          username: String(t.username || '').trim().toLowerCase(),
          password: String(t.password || '').trim(),
          full_name: String(t.full_name || '').trim(),
          homeroom_class: t.role === 'admin'
            ? 'BGH'
            : String(t.homeroom_class || '').trim().toUpperCase(),
        };
        if (t.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.id)) {
          item.id = t.id;
        }
        return item;
      });

      const { error } = await supabase
        .from('teachers')
        .upsert(cleanTeachers, { onConflict: 'username' });
      if (error) {
        console.error('Supabase upsert teachers error:', error);
        throw error;
      }
    }

    const existing = await getTeachers();
    const map = new Map<string, Teacher>();
    existing.forEach(t => map.set(t.username, t));
    uniqueTeachers.forEach(t => {
      if (t.username) {
        const u = t.username.trim().toLowerCase();
        const prev = map.get(u) || ({} as Teacher);
        map.set(u, {
          ...prev,
          ...t,
          username: u,
          id: t.id || prev.id || `t_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          role: t.role || ((t.homeroom_class === 'BGH' || t.homeroom_class === 'ADMIN') ? 'admin' : (prev.role || 'teacher')),
        } as Teacher);
      }
    });
    safeSetStorage(STORAGE_KEYS.TEACHERS, JSON.stringify(Array.from(map.values())));
    return true;
  } catch (err) {
    console.error('Error saving teachers:', err);
    return false;
  }
}

export async function deleteTeacher(id: string, username: string): Promise<boolean> {
  try {
    const status = await checkSupabaseConnection();
    if (status.isSupabaseLive) {
      await supabase.from('teachers').delete().eq('username', username);
    }
    const current = await getTeachers();
    const updated = current.filter(t => t.username !== username && t.id !== id);
    localStorage.setItem(STORAGE_KEYS.TEACHERS, JSON.stringify(updated));
    return true;
  } catch (e) {
    console.error('Error deleting teacher', e);
    return false;
  }
}

export function isValidUUID(str?: string): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim());
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // ignore
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ----------------- SURVEYS -----------------
export async function getSurveys(): Promise<Survey[]> {
  try {
    const status = await checkSupabaseConnection();
    if (status.isSupabaseLive) {
      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        const mapped: Survey[] = data.map((row: any) => {
          let gdriveId = row.google_drive_folder_id || '';
          let desc = row.description || '';
          const match = desc.match(/<!-- GDRIVE:(.*?) -->/);
          if (match) {
            gdriveId = match[1];
            desc = desc.replace(/<!-- GDRIVE:(.*?) -->/g, '').trim();
          }
          return {
            ...row,
            description: desc,
            google_drive_folder_id: gdriveId,
          };
        });
        safeSetStorage(STORAGE_KEYS.SURVEYS, JSON.stringify(mapped));
        return mapped;
      }
    }
  } catch (err) {
    console.warn('Falling back to local surveys', err);
  }
  const raw = safeGetStorage(STORAGE_KEYS.SURVEYS);
  if (raw) {
    try {
      const parsed: Survey[] = JSON.parse(raw);
      return parsed.map((s: any) => {
        let gdriveId = s.google_drive_folder_id || '';
        let desc = s.description || '';
        const match = desc.match(/<!-- GDRIVE:(.*?) -->/);
        if (match) {
          gdriveId = match[1];
          desc = desc.replace(/<!-- GDRIVE:(.*?) -->/g, '').trim();
        }
        return {
          ...s,
          description: desc,
          google_drive_folder_id: gdriveId,
        };
      });
    } catch {
      // ignore
    }
  }
  return [DEFAULT_SURVEY];
}

export async function saveSurvey(survey: Survey): Promise<boolean> {
  try {
    // 1. Ensure valid UUID for PostgreSQL UUID column
    const finalId = isValidUUID(survey.id) ? survey.id.trim() : generateUUID();
    const cleanSurvey: Survey = {
      ...survey,
      id: finalId,
      created_at: survey.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 2. Prepare description with embedded GDRIVE id if present (so it persists across all devices)
    let descriptionToSave = cleanSurvey.description || '';
    if (cleanSurvey.google_drive_folder_id?.trim()) {
      descriptionToSave = descriptionToSave.replace(/<!-- GDRIVE:.*? -->/g, '').trim() +
        `\n<!-- GDRIVE:${cleanSurvey.google_drive_folder_id.trim()} -->`;
    }

    // 3. Prepare payload matching existing Supabase columns
    const supabasePayload = {
      id: cleanSurvey.id,
      title: cleanSurvey.title,
      description: descriptionToSave,
      survey_type: cleanSurvey.survey_type || 'form',
      is_active: cleanSurvey.is_active ?? true,
      show_answers: cleanSurvey.show_answers ?? false,
      allow_multiple_attempts: cleanSurvey.allow_multiple_attempts ?? false,
      questions: cleanSurvey.questions || [],
      created_at: cleanSurvey.created_at,
      updated_at: cleanSurvey.updated_at,
    };

    const status = await checkSupabaseConnection();
    if (status.isSupabaseLive) {
      const { error } = await supabase
        .from('surveys')
        .upsert(supabasePayload, { onConflict: 'id' });
      if (error) {
        console.error('Supabase survey save error:', error);
      }
    }

    // 4. Update local storage cache directly with cleanSurvey so UI never loses it
    const currentRaw = safeGetStorage(STORAGE_KEYS.SURVEYS);
    let current: Survey[] = currentRaw ? JSON.parse(currentRaw) : [];
    const exists = current.some(s => s.id === cleanSurvey.id || (survey.id && s.id === survey.id));
    const updated = exists
      ? current.map(s => (s.id === cleanSurvey.id || s.id === survey.id) ? cleanSurvey : s)
      : [cleanSurvey, ...current];
    safeSetStorage(STORAGE_KEYS.SURVEYS, JSON.stringify(updated));

    // Also update survey object in-place so caller has the guaranteed valid UUID
    survey.id = cleanSurvey.id;

    return true;
  } catch (e) {
    console.error('Error saving survey', e);
    return false;
  }
}

export async function deleteSurvey(id: string): Promise<boolean> {
  try {
    const status = await checkSupabaseConnection();
    if (status.isSupabaseLive && isValidUUID(id)) {
      // 1. Delete associated responses from Supabase to prevent foreign key issues
      const { error: respErr } = await supabase.from('survey_responses').delete().eq('survey_id', id);
      if (respErr) console.warn('Supabase survey_responses delete warning:', respErr);

      // 2. Delete survey from Supabase
      const { error: svErr } = await supabase.from('surveys').delete().eq('id', id);
      if (svErr) console.error('Supabase survey delete error:', svErr);
    }
    // 3. Clean up cached surveys
    const currentRaw = safeGetStorage(STORAGE_KEYS.SURVEYS);
    const current: Survey[] = currentRaw ? JSON.parse(currentRaw) : [];
    const updated = current.filter(s => s.id !== id);
    safeSetStorage(STORAGE_KEYS.SURVEYS, JSON.stringify(updated));

    // 4. Clean up cached responses
    const currentRespRaw = safeGetStorage(STORAGE_KEYS.RESPONSES);
    if (currentRespRaw) {
      try {
        const respList: SurveyResponse[] = JSON.parse(currentRespRaw);
        safeSetStorage(STORAGE_KEYS.RESPONSES, JSON.stringify(respList.filter(r => r.survey_id !== id)));
      } catch {}
    }
    return true;
  } catch (e) {
    console.error('Error deleting survey', e);
    return false;
  }
}

// ----------------- RESPONSES -----------------
export async function getResponses(surveyId?: string): Promise<SurveyResponse[]> {
  try {
    const status = await checkSupabaseConnection();
    if (status.isSupabaseLive) {
      let allResponses: SurveyResponse[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
          .from('survey_responses')
          .select('*')
          .order('submitted_at', { ascending: false })
          .range(from, to);

        if (surveyId) {
          query = query.eq('survey_id', surveyId);
        }

        const { data, error } = await query;
        if (error) {
          console.error(`Error fetching responses page ${page}:`, error);
          break;
        }

        if (data && data.length > 0) {
          allResponses = allResponses.concat(data as SurveyResponse[]);
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      // Merge with any local cache records to ensure complete data
      try {
        const currentLocal = JSON.parse(safeGetStorage(STORAGE_KEYS.RESPONSES) || '[]') as SurveyResponse[];
        const map = new Map<string, SurveyResponse>();
        currentLocal.forEach(r => map.set(`${r.survey_id}_${r.student_cccd}`, r));
        allResponses.forEach(r => map.set(`${r.survey_id}_${r.student_cccd}`, r));
        const mergedList = Array.from(map.values());
        safeSetStorage(STORAGE_KEYS.RESPONSES, JSON.stringify(mergedList));
        return surveyId ? mergedList.filter(r => r.survey_id === surveyId) : mergedList;
      } catch (storageErr) {
        console.warn('LocalStorage quota warning when caching responses:', storageErr);
        return surveyId ? allResponses.filter(r => r.survey_id === surveyId) : allResponses;
      }
    }
  } catch (err) {
    console.warn('Falling back to local survey responses', err);
  }
  const raw = safeGetStorage(STORAGE_KEYS.RESPONSES);
  const all: SurveyResponse[] = raw ? JSON.parse(raw) : [];
  return surveyId ? all.filter(r => r.survey_id === surveyId) : all;
}

export async function saveResponse(response: SurveyResponse): Promise<boolean> {
  try {
    // 1. Ensure valid UUID for PostgreSQL UUID id column
    const finalId = isValidUUID(response.id) ? response.id.trim() : generateUUID();
    const cleanResponse: SurveyResponse = {
      ...response,
      id: finalId,
      submitted_at: response.submitted_at || new Date().toISOString(),
    };

    const status = await checkSupabaseConnection();
    if (status.isSupabaseLive) {
      const { error } = await supabase
        .from('survey_responses')
        .upsert(cleanResponse, { onConflict: 'survey_id,student_cccd' });
      if (error) {
        console.error('Supabase response save error:', error);
      }
    }

    // 2. Update local storage cache safely
    const raw = safeGetStorage(STORAGE_KEYS.RESPONSES);
    const list: SurveyResponse[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(r => r.survey_id === cleanResponse.survey_id && r.student_cccd === cleanResponse.student_cccd);
    if (idx >= 0) {
      list[idx] = cleanResponse;
    } else {
      list.push(cleanResponse);
    }
    safeSetStorage(STORAGE_KEYS.RESPONSES, JSON.stringify(list));

    // Update passed reference
    response.id = cleanResponse.id;

    return true;
  } catch (err) {
    console.error('Error saving survey response', err);
    return false;
  }
}

// ----------------- APP SETTINGS -----------------
export async function getAppSettings(): Promise<AppSettings> {
  const fallback: AppSettings = {
    id: 1,
    admin_username: 'admin',
    admin_password: '1235',
    announcement: 'Chào mừng các em học sinh và quý thầy cô đến với Hệ thống Khảo sát & Thu thập Thông tin Học sinh Toàn trường!',
    theme: (safeGetStorage('school_survey_global_theme') as AppTheme) || 'burgundy',
  };

  try {
    const status = await checkSupabaseConnection();
    if (status.isSupabaseLive) {
      const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single();
      if (!error && data) {
        let theme: AppTheme = 'burgundy';
        let cleanAnnouncement = data.announcement || '';
        // If data.theme column exists in PostgreSQL
        if (data.theme && (data.theme === 'burgundy' || data.theme === 'blue' || data.theme === 'green' || data.theme === 'glass')) {
          theme = data.theme;
        }
        const match = cleanAnnouncement.match(/^\[THEME:(burgundy|blue|green|glass)\]\s*/i);
        if (match) {
          theme = match[1].toLowerCase() as AppTheme;
          cleanAnnouncement = cleanAnnouncement.replace(/^\[THEME:(burgundy|blue|green|glass)\]\s*/i, '');
        } else if (!data.theme) {
          const cachedTheme = safeGetStorage('school_survey_global_theme') as AppTheme | null;
          if (cachedTheme && (cachedTheme === 'burgundy' || cachedTheme === 'blue' || cachedTheme === 'green' || cachedTheme === 'glass')) {
            theme = cachedTheme;
          }
        }

        const fullData: AppSettings = {
          ...data,
          theme,
          announcement: cleanAnnouncement,
        };

        safeSetStorage(STORAGE_KEYS.SETTINGS, JSON.stringify(fullData));
        safeSetStorage('school_survey_global_theme', theme);
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', theme);
        }
        return fullData;
      }
    }
  } catch {
    // fallback
  }

  const raw = safeGetStorage(STORAGE_KEYS.SETTINGS);
  return raw ? JSON.parse(raw) : fallback;
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<boolean> {
  try {
    const current = await getAppSettings();
    const updatedTheme: AppTheme = settings.theme || current.theme || 'burgundy';
    const targetAnnouncement = settings.announcement !== undefined ? settings.announcement : current.announcement;
    const cleanAnnouncement = (targetAnnouncement || '').replace(/^\[THEME:(burgundy|blue|green|glass)\]\s*/i, '');
    const encodedAnnouncement = `[THEME:${updatedTheme}] ${cleanAnnouncement}`;

    const updated: AppSettings = {
      id: 1,
      admin_username: settings.admin_username !== undefined ? settings.admin_username : current.admin_username,
      admin_password: settings.admin_password !== undefined ? settings.admin_password : current.admin_password,
      announcement: cleanAnnouncement,
      theme: updatedTheme,
    };

    const status = await checkSupabaseConnection();
    if (status.isSupabaseLive) {
      const dbPayload: any = {
        id: 1,
        admin_username: updated.admin_username,
        admin_password: updated.admin_password,
        announcement: encodedAnnouncement,
      };
      try {
        const { error } = await supabase.from('app_settings').upsert({ ...dbPayload, theme: updatedTheme }, { onConflict: 'id' });
        if (error) {
          await supabase.from('app_settings').upsert(dbPayload, { onConflict: 'id' });
        }
      } catch {
        await supabase.from('app_settings').upsert(dbPayload, { onConflict: 'id' });
      }
    }

    safeSetStorage(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    safeSetStorage('school_survey_global_theme', updatedTheme);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', updatedTheme);
    }
    return true;
  } catch (e) {
    console.error('Error saving settings', e);
    return false;
  }
}
