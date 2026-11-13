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
    var className = data.className ? String(data.className).trim() : '';
    var fileBaseName = data.fileBaseName ? String(data.fileBaseName).trim() : '';
    var oldFileId = data.oldFileId ? String(data.oldFileId).trim() : '';

    if (!folderId || !fileName || !base64Data) {
      return responseJSON({
        success: false,
        error: 'Thiếu dữ liệu bắt buộc (folderId, fileName hoặc base64Data).'
      });
    }

    // Lấy thư mục Google Drive gốc theo folderId
    var rootFolder;
    try {
      rootFolder = DriveApp.getFolderById(folderId);
    } catch (err) {
      return responseJSON({
        success: false,
        error: 'Không tìm thấy thư mục Google Drive với ID: ' + folderId + '. Vui lòng kiểm tra lại quyền truy cập hoặc ID thư mục.'
      });
    }

    // Nếu có tên lớp, kiểm tra thư mục lớp bên trong thư mục gốc; nếu chưa có thì tự tạo mới
    var targetFolder = rootFolder;
    if (className !== '') {
      var cleanClassFolderName = className.replace(/[\\/:*?"<>|]/g, '_');
      var subFolders = rootFolder.getFoldersByName(cleanClassFolderName);
      if (subFolders.hasNext()) {
        targetFolder = subFolders.next();
      } else {
        targetFolder = rootFolder.createFolder(cleanClassFolderName);
      }
    }

    // Tách phần tiền tố base64 nếu có (ví dụ: data:image/png;base64,...)
    var cleanBase64 = base64Data;
    if (cleanBase64.indexOf('base64,') > -1) {
      cleanBase64 = cleanBase64.split('base64,')[1];
    }

    // Giải mã base64 thành Blob
    var decodedBytes = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

    // 1. Xóa file cũ theo oldFileId nếu học sinh nộp lại / thay thế tệp
    if (oldFileId !== '') {
      try {
        var prevFile = DriveApp.getFileById(oldFileId);
        if (prevFile) {
          prevFile.setTrashed(true);
        }
      } catch (errOldId) {
        // Bỏ qua nếu file cũ không tồn tại hoặc đã bị xóa trước đó
      }
    }

    // Helper xóa các tệp trùng tên hoặc cùng tiền tố định danh học sinh (dù khác phần mở rộng)
    function trashMatchingFilesInFolder(searchFolder) {
      if (!searchFolder) return;
      var exactFiles = searchFolder.getFilesByName(fileName);
      while (exactFiles.hasNext()) {
        var fExact = exactFiles.next();
        try {
          fExact.setTrashed(true);
        } catch (errT1) {}
      }

      if (fileBaseName !== '') {
        var allFiles = searchFolder.getFiles();
        while (allFiles.hasNext()) {
          var f = allFiles.next();
          var fName = f.getName();
          if (fName === fileBaseName || fName.indexOf(fileBaseName + '.') === 0) {
            try {
              f.setTrashed(true);
            } catch (errT2) {}
          }
        }
      }
    }

    // 2. Xóa tệp cũ trong thư mục lớp (và cả thư mục gốc nếu trước đó từng lưu ở gốc)
    trashMatchingFilesInFolder(targetFolder);
    if (targetFolder.getId() !== rootFolder.getId()) {
      trashMatchingFilesInFolder(rootFolder);
    }

    // Tạo tệp mới trong thư mục lớp
    var file = targetFolder.createFile(blob);

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
      downloadUrl: file.getDownloadUrl(),
      folderId: targetFolder.getId(),
      folderName: targetFolder.getName()
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
