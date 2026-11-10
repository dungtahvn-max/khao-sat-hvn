import React, { useState } from 'react';
import { DEFAULT_GOOGLE_DRIVE_FOLDER_ID, uploadFileToGoogleDrive } from '../utils/googleDrive';
import { Upload, Image as ImageIcon, X, AlertCircle, CheckCircle2, HardDrive, Loader2 } from 'lucide-react';

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelected: (imageUrl: string) => void;
  initialFolderId?: string;
}

export const ImageUploadModal: React.FC<ImageUploadModalProps> = ({
  isOpen,
  onClose,
  onImageSelected,
  initialFolderId = DEFAULT_GOOGLE_DRIVE_FOLDER_ID,
}) => {
  const [folderId, setFolderId] = useState<string>(initialFolderId || DEFAULT_GOOGLE_DRIVE_FOLDER_ID);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Vui lòng chọn một tệp hình ảnh (PNG, JPG, JPEG, WEBP, GIF, SVG)!');
      return;
    }

    setSelectedFile(file);
    setErrorMessage('');

    try {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUploadAndInsert = async () => {
    const targetFolder = folderId.trim();
    if (!targetFolder) {
      setErrorMessage('Mã ID Thư mục Google Drive là BẮT BUỘC để lưu trữ hình ảnh!');
      return;
    }

    if (!selectedFile) {
      setErrorMessage('Vui lòng chọn một tệp ảnh từ máy tính / thiết bị của bạn!');
      return;
    }

    setUploading(true);
    setErrorMessage('');
    setUploadProgress(15);

    try {
      const timestamp = Date.now();
      const cleanFileName = `CAU_HOI_ANH_${timestamp}_${selectedFile.name.replace(/\s+/g, '_')}`;

      const res = await uploadFileToGoogleDrive(
        selectedFile,
        targetFolder,
        cleanFileName,
        percent => setUploadProgress(percent)
      );

      if (res.success && res.fileUrl) {
        onImageSelected(res.fileUrl);
        onClose();
      } else {
        // Nếu kết nối Apps Script có vấn đề, vẫn lưu URL ảnh dạng base64/preview để không gián đoạn việc soạn đề
        if (previewUrl) {
          // Chuyển file sang Base64
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result as string;
            onImageSelected(base64);
            onClose();
          };
          reader.readAsDataURL(selectedFile);
        } else {
          setErrorMessage(res.error || 'Lỗi khi tải ảnh lên Google Drive!');
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Lỗi khi tải ảnh lên Google Drive!');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 bg-[#7a0f2b] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-rose-200" />
            <h3 className="font-bold text-sm sm:text-base">Chèn ảnh minh họa vào câu hỏi</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Required Google Drive Folder ID Field */}
          <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-1.5">
            <label className="font-bold text-[#7a0f2b] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-[#7a0f2b]" />
                Mã ID Thư mục Google Drive lưu ảnh:
              </span>
              <span className="text-[10px] uppercase font-black text-rose-700 bg-rose-200 px-1.5 py-0.2 rounded">
                Bắt buộc nhập
              </span>
            </label>
            <input
              type="text"
              required
              autoCapitalize="none"
              value={folderId}
              onChange={e => setFolderId(e.target.value)}
              placeholder="VD: 1pS2VfhHEUbc2fWs0K_K6bSjivy0n8OMT"
              className="w-full p-2 bg-white border border-rose-300 rounded-lg font-mono text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-[#7a0f2b]"
            />
            <p className="text-[11px] text-slate-500">
              Ảnh tải lên sẽ được tự động lưu trữ an toàn vào thư mục Google Drive mang ID này.
            </p>
          </div>

          {/* Image file picker */}
          <div className="space-y-2">
            <label className="font-bold text-slate-800 block">
              Chọn tệp hình ảnh từ thiết bị:
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-[#7a0f2b] rounded-xl p-4 text-center bg-slate-50 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="question-image-file"
              />
              <label
                htmlFor="question-image-file"
                className="cursor-pointer flex flex-col items-center justify-center space-y-1"
              >
                <Upload className="w-8 h-8 text-slate-400" />
                <span className="font-bold text-[#7a0f2b] hover:underline">
                  {selectedFile ? selectedFile.name : 'Bấm vào đây để chọn ảnh từ máy'}
                </span>
                <span className="text-[11px] text-slate-400">
                  Hỗ trợ định dạng PNG, JPG, JPEG, WEBP, GIF, SVG
                </span>
              </label>
            </div>
          </div>

          {/* Preview Image if selected */}
          {previewUrl && (
            <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] text-slate-500 block mb-1.5 font-semibold">
                Xem trước hình ảnh:
              </span>
              <img
                src={previewUrl}
                alt="Xem trước ảnh câu hỏi"
                className="max-h-48 mx-auto rounded-lg object-contain border border-slate-200"
              />
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Progress bar */}
          {uploading && (
            <div className="space-y-1.5 p-3 bg-rose-50/50 rounded-xl border border-rose-100">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#7a0f2b]">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang tải ảnh lên Google Drive ({uploadProgress}%)...
                </span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#7a0f2b] h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleUploadAndInsert}
            disabled={uploading || !selectedFile || !folderId.trim()}
            className="px-5 py-2.5 bg-[#7a0f2b] hover:bg-[#8f1334] disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Lưu vào Drive & Chèn ảnh
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
