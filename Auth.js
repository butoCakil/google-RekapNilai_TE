// Auth.gs - Autentikasi Guru

function getAuthUrl() {
  return ScriptApp.getService().getUrl();
}

function getUserInfo() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) return null;

    // Cek apakah email terdaftar sebagai guru
    const master = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);
    const sheetGuru = master.getSheetByName(CONFIG.SHEET.GURU);
    const data = sheetGuru.getDataRange().getValues();

    // Cari guru berdasarkan email (skip baris header)
    for (let i = 1; i < data.length; i++) {
      if (data[i][3] === email) { // kolom ke-4 = Email
        return {
          nip         : data[i][1],
          nama        : data[i][2],
          email       : data[i][3],
          mapelDiampu : data[i][4]
        };
      }
    }

    return null; // Email tidak terdaftar sebagai guru

  } catch(e) {
    Logger.log('getUserInfo error: ' + e.message);
    return null;
  }
}

function isGuruValid() {
  const user = getUserInfo();
  return user !== null;
}

function logout() {
  // Apps Script tidak punya logout sejati
  // Arahkan ke halaman index
  return ScriptApp.getService().getUrl();
}