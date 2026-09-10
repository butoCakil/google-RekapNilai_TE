// TugasSiswa.js - Logic sisi siswa untuk dashboard, roadmap, dan detail tugas

function getSemuaTugasSiswa(nis) {
  const siswa = getSiswaByNis(nis);
  if (!siswa) return [];

  const rekap = SpreadsheetApp.openById(CONFIG.REKAP_SPREADSHEET_ID);
  const dataTugas = rekap.getSheetByName('Tugas').getDataRange().getValues();
  const dataSub   = rekap.getSheetByName('Submission').getDataRange().getValues();

  const hasil = [];
  for (let i = 1; i < dataTugas.length; i++) {
    if (dataTugas[i][3] !== siswa.kelas) continue;

    const tugasId = dataTugas[i][0];
    let submisi = null;
    for (let j = 1; j < dataSub.length; j++) {
      if (dataSub[j][1] === tugasId && String(dataSub[j][2]) === String(nis)) {
        submisi = {
          submissionId: dataSub[j][0], fileUrl: dataSub[j][5],
          waktuUpload: dataSub[j][7] ? new Date(dataSub[j][7]).toISOString() : null,
          status: dataSub[j][8], nilaiAngka: dataSub[j][9], nilaiHuruf: dataSub[j][10],
          catatan: dataSub[j][11]
        };
        break;
      }
    }

    hasil.push({
      tugasId: tugasId,
      judul: dataTugas[i][1],
      deskripsi: dataTugas[i][2],
      deadline: new Date(dataTugas[i][4]).toISOString(),
      lampiranUrl: dataTugas[i][6],
      jenisPenilaian: dataTugas[i][7],
      tglDibuat: new Date(dataTugas[i][8]).toISOString(),
      submisi: submisi,
      status: submisi ? submisi.status : 'Belum Upload'
    });
  }
  return hasil;
}

function getDashboardSiswa(nis) {
  // Urutkan: deadline terdekat duluan - paling relevan buat kartu "harus dikerjakan"
  return getSemuaTugasSiswa(nis).sort(function (a, b) {
    return new Date(a.deadline) - new Date(b.deadline);
  });
}

function getRoadmapSiswa(nis) {
  // Urutkan kronologis - buat tampilan linimasa
  return getSemuaTugasSiswa(nis).sort(function (a, b) {
    return new Date(a.tglDibuat) - new Date(b.tglDibuat);
  });
}

function getDetailTugasSiswa(tugasId, nis) {
  const semua = getSemuaTugasSiswa(nis);
  return semua.find(function (t) { return t.tugasId === tugasId; }) || null;
}