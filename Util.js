// Util.js - Fungsi bantu umum lintas fitur Tugas

function buatId(prefix) {
  const waktu = new Date().getTime();
  const acak = Math.floor(Math.random() * 1000);
  return prefix + '-' + waktu + '-' + acak;
}