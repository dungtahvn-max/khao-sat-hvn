/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT - HỆ THỐNG LƯU TỆP KHẢO SÁT HỌC SINH VÀO GOOGLE DRIVE
 * Trường THPT Huỳnh Văn Nghệ
 * URL Web App: https://script.google.com/macros/s/AKfycbwo5HhBsB54UxISYlxQGgtxD7mJMpzaUM3lgMK4WLUokR_YEvaGGkdedeWbrzsZX2qpeQ/exec
 * ==============================================================================
 * 
 * HƯỚNG DẪN CÀI ĐẶT:
 * 1. Mở dự án Google Apps Script của bạn.
 * 2. Dán toàn bộ nội dung file này vào tệp `Code.gs`.
 * 3. Nhấn "Triển khai" (Deploy) -> "Quản lý bản triển khai" (Manage deployments)
 *    hoặc "Bản triển khai mới" (New deployment).
 * 4. Cấu hình triển khai:
 *    - Loại triển khai: Ứng dụng web (Web app).
 *    - Thực thi dưới dạng: Tôi (Tài khoản Google của bạn).
 *    - Ai có quyền truy cập: Bất kỳ ai (Anyone).
 * 5. Cấp quyền truy cập Google Drive khi được yêu cầu.
 */

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);

    var folderId = data.folderId;
    var fileName = data.fileName;
    var base64Data = data.base64;
    var mimeType = data.mimeType || 'application/octet-stream';

    if (!folderId || !fileName || !base64Data) {
      return responseJSON({
        success: false,
        error: 'Thiếu dữ liệu bắt buộc (folderId, fileName hoặc base64Data).'
      });
    }

    // Lấy thư mục Google Drive theo folderId
    var folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (err) {
      return responseJSON({
        success: false,
        error: 'Không tìm thấy thư mục Google Drive với ID: ' + folderId + '. Vui lòng kiểm tra lại quyền truy cập hoặc ID thư mục.'
      });
    }

    // Tách phần tiền tố base64 nếu có (ví dụ: data:image/png;base64,...)
    var cleanBase64 = base64Data;
    if (cleanBase64.indexOf('base64,') > -1) {
      cleanBase64 = cleanBase64.split('base64,')[1];
    }

    // Giải mã base64 thành Blob
    var decodedBytes = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

    // Tự động kiểm tra và ghi đè: nếu học sinh đã tải file đó rồi, xóa tệp cũ để ghi đè tệp mới
    var existingFiles = folder.getFilesByName(fileName);
    while (existingFiles.hasNext()) {
      var oldFile = existingFiles.next();
      try {
        oldFile.setTrashed(true);
      } catch (errTrash) {
        // Bỏ qua nếu xảy ra lỗi quyền xóa
      }
    }

    // Tạo tệp trong thư mục chỉ định
    var file = folder.createFile(blob);
    
    // Đặt quyền truy cập công khai để xem tệp nếu cần
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (eShare) {
      // Bỏ qua nếu tổ chức chặn chia sẻ ngoài
    }

    return responseJSON({
      success: true,
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl(),
      downloadUrl: file.getDownloadUrl()
    });

  } catch (error) {
    return responseJSON({
      success: false,
      error: error.toString()
    });
  }
}

function doGet(e) {
  return responseJSON({
    status: 'online',
    message: 'Google Apps Script Drive Uploader - THPT Huỳnh Văn Nghệ đang hoạt động bình thường.'
  });
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
