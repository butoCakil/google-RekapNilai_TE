// DriveUpload.js - Upload berkas tugas ke Drive (milik akun deployer / guru)
//
// STRATEGI UPLOAD:
// - File besar / video: klien melakukan "resumable upload" langsung ke Drive REST API
//   memakai OAuth token milik akun deployer (dipinjamkan sementara lewat mintUpload*).
//   Ini menembus batas ~50MB request Apps Script.
// - File kecil: bisa lewat jalur base64 di Upload.js (uploadTugasKecil).
//
// CATATAN KEAMANAN (disepakati untuk alat internal sekolah):
// - mintUploadTugasSiswa hanya mengembalikan token bila token sesi siswa valid DAN
//   tugas memang untuk kelas siswa tsb. Token Drive berlaku ~1 jam, hanya untuk
//   akun deployer. Saat finalisasi, setiap fileId diverifikasi benar-benar berada di
//   folder tugas yang dituju dan baru dibuat, sebelum dicatat.

// ------------------------------------------------
// FOLDER
// ------------------------------------------------
function getFolderRootTugas() {
  return _getOrBuatFolder(CONFIG.FOLDER_ROOT_TUGAS, DriveApp.getRootFolder());
}

function getFolderTugas(tugasId, judul) {
  const nama = tugasId + ' - ' + String(judul || '').replace(/[\\/:*?"<>|]/g, ' ').slice(0, 80);
  return _getOrBuatFolder(nama, getFolderRootTugas());
}

function _getOrBuatFolder(nama, parent) {
  const it = parent.getFoldersByName(nama);
  return it.hasNext() ? it.next() : parent.createFolder(nama);
}

// ------------------------------------------------
// MINT TOKEN UPLOAD
// ------------------------------------------------
function mintUploadTugasSiswa(token, tugasId) {
  const nis = getNisDariToken(token);
  if (!nis) return { ok: false, pesan: 'Sesi kedaluwarsa, silakan login ulang' };
  const siswa = getSiswaByNis(nis);
  if (!siswa) return { ok: false, pesan: 'NIS tidak valid' };

  const tugas = getTugasById(tugasId);
  if (!tugas) return { ok: false, pesan: 'Tugas tidak ditemukan' };
  if (tugas.Kelas !== siswa.kelas) return { ok: false, pesan: 'Tugas ini bukan untuk kelas Anda' };

  const folder = getFolderTugas(tugasId, tugas.Judul);
  return {
    ok: true,
    accessToken: ScriptApp.getOAuthToken(),
    folderId: folder.getId(),
    prefixNama: String(siswa.nis) + '_' + siswa.nama + '_',
    jenisFile: _jenisFileArr(tugas.JenisFile)
  };
}

function mintUploadTugasGuru(tugasId, nis) {
  const guru = getUserInfo();
  if (!guru) return { ok: false, pesan: 'Akses ditolak' };
  const tugas = getTugasById(tugasId);
  if (!tugas) return { ok: false, pesan: 'Tugas tidak ditemukan' };
  const siswa = getSiswaByNis(nis);
  if (!siswa) return { ok: false, pesan: 'NIS tidak ditemukan' };
  if (siswa.kelas !== tugas.Kelas) return { ok: false, pesan: 'Siswa tidak berada di kelas tugas ini' };

  const folder = getFolderTugas(tugasId, tugas.Judul);
  return {
    ok: true,
    accessToken: ScriptApp.getOAuthToken(),
    folderId: folder.getId(),
    prefixNama: String(siswa.nis) + '_' + siswa.nama + '_'
  };
}

// ------------------------------------------------
// FINALISASI (catat submission setelah file ada di Drive)
// files: [{ id, nama, mime, size }]
// ------------------------------------------------
function finalisasiUploadSiswa(token, tugasId, files) {
  const nis = getNisDariToken(token);
  if (!nis) return { sukses: false, pesan: 'Sesi kedaluwarsa' };
  const siswa = getSiswaByNis(nis);
  const tugas = getTugasById(tugasId);
  if (!siswa || !tugas) return { sukses: false, pesan: 'Data tidak valid' };
  if (tugas.Kelas !== siswa.kelas) return { sukses: false, pesan: 'Tugas bukan untuk kelas Anda' };

  return _catatSubmission(tugas, siswa, files, 'siswa');
}

function finalisasiUploadGuru(tugasId, nis, files) {
  const guru = getUserInfo();
  if (!guru) return { sukses: false, pesan: 'Akses ditolak' };
  const siswa = getSiswaByNis(nis);
  const tugas = getTugasById(tugasId);
  if (!siswa || !tugas) return { sukses: false, pesan: 'Data tidak valid' };
  if (siswa.kelas !== tugas.Kelas) return { sukses: false, pesan: 'Siswa tidak di kelas tugas ini' };

  return _catatSubmission(tugas, siswa, files, 'guru:' + guru.nama);
}

function _catatSubmission(tugas, siswa, files, diuploadOleh) {
  try {
    if (!files || !files.length) return { sukses: false, pesan: 'Tidak ada berkas' };

    const folder = getFolderTugas(tugas.ID, tugas.Judul);
    const folderId = folder.getId();
    const emailDeployer = _emailDeployer();
    const izinFile = _jenisFileArr(tugas.JenisFile);

    const lampiran = [];
    files.forEach(function (f) {
      let file;
      try { file = DriveApp.getFileById(f.id); }
      catch (e) { throw new Error('Berkas tidak ditemukan di Drive: ' + f.id); }

      // Verifikasi: file ada di folder tugas & dibuat < 2 jam lalu (baru diupload)
      const parents = file.getParents();
      let diFolder = false;
      while (parents.hasNext()) { if (parents.next().getId() === folderId) { diFolder = true; break; } }
      if (!diFolder) throw new Error('Berkas "' + file.getName() + '" tidak berada di folder tugas');

      const umurMenit = (new Date() - file.getDateCreated()) / 60000;
      if (umurMenit > 120) throw new Error('Berkas "' + file.getName() + '" bukan berkas upload baru');

      if (!fileTipeCocok(file.getName(), file.getMimeType(), izinFile)) {
        // buang berkas yang tidak sesuai supaya tidak menyampah di Drive
        try { file.setTrashed(true); } catch (e) {}
        throw new Error('Berkas "' + file.getName() + '" tidak sesuai. Yang diizinkan: ' + labelIzinFile(izinFile));
      }

      try {
        if (emailDeployer && file.getOwner() && file.getOwner().getEmail() !== emailDeployer) {
          throw new Error('Kepemilikan berkas tidak sah');
        }
      } catch (e) { /* getOwner bisa gagal di Shared Drive - abaikan */ }

      _setSharingAnyone(file);
      lampiran.push({
        id: file.getId(),
        url: file.getUrl(),
        nama: file.getName(),
        mime: file.getMimeType(),
        size: Number(f.size) || file.getSize()
      });
    });

    const lama = getSubmission(tugas.ID, siswa.nis);
    const ss = _ssRekap();
    const baris = {
      ID          : lama ? lama.ID : buatId('SUB'),
      TugasID     : tugas.ID,
      NIS         : String(siswa.nis),
      Nama        : siswa.nama,
      Kelas       : siswa.kelas,
      FileURL     : lampiran[0].url,
      FileDriveID : lampiran[0].id,
      WaktuUpload : new Date(),
      Status      : STATUS_SUBMISSION.MENUNGGU,
      NilaiAngka  : '',
      NilaiHuruf  : '',
      Catatan     : '',
      WaktuDinilai: '',
      DinilaiOleh : '',
      LampiranJSON: JSON.stringify(lampiran),
      DiuploadOleh: diuploadOleh
    };

    // Hapus berkas lama yang tidak dipakai lagi (kalau re-upload)
    if (lama) {
      const lampiranLama = amanParseJson(lama.LampiranJSON, []);
      const idBaru = lampiran.map(function (l) { return l.id; });
      lampiranLama.forEach(function (l) {
        if (idBaru.indexOf(l.id) === -1) {
          try { DriveApp.getFileById(l.id).setTrashed(true); } catch (e) {}
        }
      });
      updateBarisObjek(ss, CONFIG.SHEET.SUBMISSION, lama.__row, baris);
    } else {
      appendObjek(ss, CONFIG.SHEET.SUBMISSION, baris);
    }

    const labelSiapa = diuploadOleh.indexOf('guru') === 0 ? ' (diunggah guru)' : '';
    kirimNotifikasiKeSiswa(siswa.nis, 'submission',
      'Tugas "' + tugas.Judul + '" berhasil dikumpulkan' + labelSiapa, tugas.ID);

    return {
      sukses: true,
      pesan: 'Tugas berhasil dikumpulkan',
      submission: normalisasiSubmission(_reloadSubmission(baris.ID))
    };
  } catch (e) {
    Logger.log('_catatSubmission error: ' + e.stack);
    return { sukses: false, pesan: e.message };
  }
}

function _reloadSubmission(id) {
  const list = getSemuaSubmission();
  for (let i = 0; i < list.length; i++) if (list[i].ID === id) return list[i];
  return null;
}

function _setSharingAnyone(file) {
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
  catch (e) { Logger.log('setSharing gagal: ' + e.message); }
}

function _emailDeployer() {
  try { return Session.getEffectiveUser().getEmail() || null; } catch (e) { return null; }
}
