// Preview.js - Informasi pratinjau berkas untuk guru & siswa.
// Mengembalikan URL yang bisa dipakai <iframe> / <img> / <video> di klien.

function getPreviewInfo(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    _setSharingAnyone(file); // pastikan bisa di-embed
    const mime = file.getMimeType();
    const nama = file.getName();
    const size = file.getSize();

    let mode = 'iframe'; // default: viewer Google
    if (mime.indexOf('image/') === 0) mode = 'gambar';
    else if (mime.indexOf('video/') === 0) mode = 'video';
    else if (mime.indexOf('audio/') === 0) mode = 'audio';
    else if (mime === 'text/plain') mode = 'teks';

    return {
      ok: true,
      id: fileId,
      nama: nama,
      mime: mime,
      size: size,
      mode: mode,
      urlPreview : 'https://drive.google.com/file/d/' + fileId + '/preview',
      urlUnduh   : 'https://drive.google.com/uc?export=download&id=' + fileId,
      urlLangsung: 'https://drive.google.com/uc?export=view&id=' + fileId,
      urlThumb   : 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1600',
      urlBuka    : file.getUrl(),
      teks       : mode === 'teks' && size < 200000 ? file.getBlob().getDataAsString() : null
    };
  } catch (e) {
    Logger.log('getPreviewInfo error: ' + e.message);
    return { ok: false, pesan: e.message };
  }
}

// Beberapa file sekaligus (dipakai panel koreksi guru)
function getPreviewBanyak(fileIds) {
  return (fileIds || []).map(function (id) { return getPreviewInfo(id); });
}
