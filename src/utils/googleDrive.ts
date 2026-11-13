import { Student } from '../types';

export const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwo5HhBsB54UxISYlxQGgtxD7mJMpzaUM3lgMK4WLUokR_YEvaGGkdedeWbrzsZX2qpeQ/exec';
export const DEFAULT_GOOGLE_DRIVE_FOLDER_ID = '1pS2VfhHEUbc2fWs0K_K6bSjivy0n8OMT';

/**
 * Removes tone marks/diacritics for clean file naming if desired, or standardizes spaces to underscores.
 */
export function sanitizeFileNamePart(str: string): string {
  return str
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[\\/:*?"<>|]/g, '');
}

export function getStudentFileBaseName(
  fileCodePrefix: string,
  student: Student
): string {
  const cleanPrefix = sanitizeFileNamePart(fileCodePrefix || 'TEP_DINH_KEM');
  const cleanStt = student.stt !== undefined && student.stt !== null ? String(student.stt) : '0';
  const cleanName = sanitizeFileNamePart(student.full_name);
  const cleanCccd = student.cccd.trim();

  return `${cleanPrefix}-${cleanStt}-${cleanName}-${cleanCccd}`;
}

export function extractGoogleDriveFileId(fileUrl?: string): string {
  if (!fileUrl || typeof fileUrl !== 'string') return '';
  const match = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || fileUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : '';
}

/**
 * Generates the standardized file name according to user requirement:
 * [mã tệp]-[STT]-[họ và tên học sinh]-[số cccd].[phần mở rộng tệp]
 */
export function generateStudentFileName(
  fileCodePrefix: string,
  student: Student,
  originalFileName: string
): string {
  const ext = originalFileName.includes('.')
    ? originalFileName.substring(originalFileName.lastIndexOf('.'))
    : '';

  return `${getStudentFileBaseName(fileCodePrefix, student)}${ext}`;
}

/**
 * Uploads a file to Google Drive via the pre-configured Google Apps Script Web App
 */
export async function uploadFileToGoogleDrive(
  file: File,
  folderId: string,
  formattedFileName: string,
  onProgress?: (progressPercent: number) => void,
  options?: {
    className?: string;
    fileBaseName?: string;
    oldFileId?: string;
  }
): Promise<{ success: boolean; fileId?: string; fileUrl?: string; fileName?: string; folderName?: string; error?: string }> {
  try {
    const targetFolderId = (folderId && folderId.trim()) ? folderId.trim() : DEFAULT_GOOGLE_DRIVE_FOLDER_ID;
    if (!targetFolderId) {
      return {
        success: false,
        error: 'Chưa cấu hình Google Drive Folder ID cho bài khảo sát này.',
      };
    }

    if (onProgress) onProgress(20);

    // Convert file to Base64
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });

    if (onProgress) onProgress(50);

    const payload = {
      folderId: targetFolderId,
      fileName: formattedFileName,
      mimeType: file.type || 'application/octet-stream',
      base64: base64Data,
      className: options?.className || '',
      fileBaseName: options?.fileBaseName || '',
      oldFileId: options?.oldFileId || '',
    };

    // Google Apps Script requires text/plain or no-cors / normal POST
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
    });

    if (onProgress) onProgress(90);

    const result = await response.json();
    if (result && result.success) {
      if (onProgress) onProgress(100);
      return {
        success: true,
        fileId: result.fileId,
        fileUrl: result.fileUrl || `https://drive.google.com/file/d/${result.fileId}/view`,
        fileName: formattedFileName,
        folderName: result.folderName,
      };
    } else {
      return {
        success: false,
        error: result?.error || 'Lỗi khi tải tệp lên Google Drive.',
      };
    }
  } catch (err: any) {
    console.error('Google Drive Upload Error:', err);
    return {
      success: false,
      error: err.message || 'Không thể kết nối đến máy chủ Google Drive. Vui lòng kiểm tra lại kết nối mạng.',
    };
  }
}
