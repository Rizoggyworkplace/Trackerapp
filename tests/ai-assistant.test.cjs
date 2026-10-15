/* Unit test Asisten AI Trackers — parser perintah bahasa Indonesia. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const A = require('../assets/js/ai-assistant.js');

const CTX = {
  sites: [
    {name: 'Sendangreto', projectId: '25TS06B0042', workspaceSiteId: ''},
    {name: 'TALANGSELEMAN PAYARAMAN', projectId: '25TS06B0041', workspaceSiteId: ''},
  ],
  banks: [
    {nama: 'Joko', rekening: '1234567890', bank: 'BCA'},
    {nama: 'Baidhowi Muslich', rekening: '1881000011', bank: 'BNI'},
  ],
};

test('parseNominal: variasi format Indonesia', () => {
  assert.equal(A.parseNominal('senilai 700rb').value, 700000);
  assert.equal(A.parseNominal('700 rb').value, 700000);
  assert.equal(A.parseNominal('700ribu').value, 700000);
  assert.equal(A.parseNominal('Nilai Rp 3.309.543').value, 3309543);
  assert.equal(A.parseNominal('Rp 14.500.000').value, 14500000);
  assert.equal(A.parseNominal('1,5jt').value, 1500000);
  assert.equal(A.parseNominal('2 juta').value, 2000000);
  assert.equal(A.parseNominal('2.5jt').value, 2500000);
  assert.equal(A.parseNominal('tujuh ratus ribu').value, 700000);
  assert.equal(A.parseNominal('tiga juta lima ratus ribu').value, 3500000);
  assert.equal(A.parseNominal('tidak ada angka di sini'), null);
});

test('kataToAngka', () => {
  assert.equal(A.kataToAngka(['tujuh', 'ratus', 'ribu']), 700000);
  assert.equal(A.kataToAngka(['seratus', 'ribu']), 100000);
  assert.equal(A.kataToAngka(['dua', 'puluh', 'tiga', 'juta']), 23000000);
});

test('detectIntent', () => {
  assert.equal(A.detectIntent('buatkan PKBON untuk jasa PLN 700rb'), 'buat_pkbon');
  assert.equal(A.detectIntent('Bos @Om Emir tolong dibantu untuk bayarkan multiguna'), 'buat_pkbon');
  assert.equal(A.detectIntent('halo apa kabar'), null);
});

test('contoh asli 1: perintah Oggy', () => {
  const teks = 'buatkan PKBON dengan nomor terbaru untuk pembayaran pelunasan jasa pln senilai 700rb di kirim ke rekening ini';
  const p = A.parsePerintahPKBON(teks, CTX);
  assert.equal(p.intent, 'buat_pkbon');
  assert.equal(p.nominal, 700000);
  assert.equal(p.bank.vague, true);
  assert.ok(p.jenis.includes('pln'), 'jenis mengandung pln: ' + p.jenis);
  assert.equal(p.uraian, 'Pembayaran pelunasan jasa pln');
  assert.ok(p.questions.includes('site'), 'site ditanyakan');
});

test('contoh asli 2: pesan bos (multiguna Sendangreto)', () => {
  const teks = 'Bos @Om Emir tolong dibantu untuk bayarkan multiguna site sendang Reto : Nilai Rp 3.309.543 MG site Sendangreto Transfer ke pak joko seperti ini bro';
  const p = A.parsePerintahPKBON(teks, CTX);
  assert.equal(p.nominal, 3309543);
  assert.equal(p.sites.length, 1);
  assert.equal(p.sites[0].name, 'Sendangreto');
  assert.equal(p.bank.matches.length, 1);
  assert.equal(p.bank.matches[0].nama, 'Joko');
  assert.equal(p.jenis, 'multiguna');
  assert.equal(p.uraian, 'Pembayaran multiguna');
  assert.deepEqual(p.questions, []);
});

test('findBank: gelar + noise di ekor', () => {
  const r = A.findBank('Transfer ke pak joko seperti ini bro', CTX.banks);
  assert.equal(r.matches.length, 1);
  assert.equal(r.matches[0].nama, 'Joko');
  const r2 = A.findBank('dikirim ke rekening ini', CTX.banks);
  assert.equal(r2.vague, true);
});

test('findSite: fuzzy spasi & kapital', () => {
  const r = A.findSite('bayarkan multiguna site sendang Reto', CTX.sites);
  assert.equal(r[0].name, 'Sendangreto');
});

test('parseBankBaru', () => {
  const b = A.parseBankBaru('BCA 1881000011 Joko');
  assert.deepEqual(b, {bank: 'BCA', rekening: '1881000011', nama: 'Joko'});
  assert.equal(A.parseBankBaru('cuma nama'), null);
});

test('formatPkbonNo sama dengan buildPkbonNo', () => {
  assert.equal(A.formatPkbonNo(979, '2026-10-13'), '00979-3/X/2026');
  assert.equal(A.formatPkbonNo(979, '2026-09-29'), '00979-3/IX/2026');
  assert.equal(A.formatPkbonNo(5, '2026-01-02'), '00005-3/I/2026');
});

test('seqDariNomorPkbon', () => {
  assert.equal(A.seqDariNomorPkbon('00934-3/X/2026'), 934);
  assert.equal(A.seqDariNomorPkbon('00931-1/X/2026'), 931);
  assert.equal(A.seqDariNomorPkbon('PKBON'), 0);
  assert.equal(A.seqDariNomorPkbon(null), 0);
});

test('getNextSeqFromSheet: max nomor PKBON + 1', async () => {
  const fakeFetch = async () => ({
    text: async () => '/*O_o*/\ngoogle.visualization.Query.setResponse({"table":{"rows":[' +
      '{"c":[{"v":"PKBON"}]},' +
      '{"c":[{"v":"00929-3/IX/2026"}]},' +
      '{"c":[{"v":"00931-1/X/2026"}]},' +
      '{"c":[{"v":"00934-3/X/2026"}]},' +
      '{"c":[{"v":null}]}' +
      ']}});',
  });
  const seq = await A.getNextSeqFromSheet(fakeFetch);
  assert.equal(seq, 935);
  assert.equal(A.formatPkbonNo(seq, '2026-10-13'), '00935-3/X/2026');
});

test('cariBarisTulis: setelah baris terakhir yang terisi', () => {
  // header + 3 terisi + 1 kosong di tengah + 1 terisi -> tulis setelah yg terakhir
  const col = ['PKBON', '00929-3/IX/2026', '', '00934-3/X/2026', '', ''];
  assert.equal(A.cariBarisTulis(col), 5); // baris 4 terisi -> tulis di baris 5
});

test('barisSheet: susunan kolom C..I', () => {
  const doc = {pkbonNo: '00935-3/X/2026', site: 'Sendangreto', tanggal: '2026-10-13',
    items: [{uraian: 'Pembayaran multiguna', sat: 'Ls', vol: 1, harga: 3309543, keterangan: ''}]};
  assert.deepEqual(A.barisSheet(doc, 'RAFI'),
    ['00935-3/X/2026', '', 'Sendangreto', '13/10/2026', 'Pembayaran multiguna', 'Rp 3.309.543', 'RAFI']);
});

test('tulisKeSheet: PUT ke range yang benar', async () => {
  const gviz = async () => ({text: async () =>
    '/*O_o*/\ngoogle.visualization.Query.setResponse({"table":{"rows":[' +
    '{"c":[{"v":"PKBON"}]},' +
    '{"c":[{"v":"00934-3/X/2026"}]},' +
    '{"c":[{"v":null}]}]}});'});
  const calls = [];
  const fakeFetch = async (url, opt) => {
    calls.push({url, opt});
    if(url.includes('gviz')) return gviz();
    return {ok: true, json: async () => ({})};
  };
  const doc = {pkbonNo: '00935-3/X/2026', site: 'Sendangreto', tanggal: '2026-10-13',
    items: [{uraian: 'Pembayaran multiguna', sat: 'Ls', vol: 1, harga: 3309543, keterangan: ''}]};
  const baris = await A.tulisKeSheet(doc, 'RAFI', {getToken: async () => 'TOKEN123', fetchImpl: fakeFetch});
  assert.equal(baris, 3);
  const put = calls.find(c => c.opt && c.opt.method === 'PUT');
  assert.ok(put.url.includes('values/Sheet2!C3%3AI3'), 'range C3:I3, dapat: ' + put.url);
  assert.ok(put.opt.headers.Authorization === 'Bearer TOKEN123');
  const body = JSON.parse(put.opt.body);
  assert.deepEqual(body.values[0],
    ['00935-3/X/2026', '', 'Sendangreto', '13/10/2026', 'Pembayaran multiguna', 'Rp 3.309.543', 'RAFI']);
});

test('tulisKeSheet: menolak bila nomor sudah ada (anti duplikat)', async () => {
  const gviz = async () => ({text: async () =>
    '/*O_o*/\ngoogle.visualization.Query.setResponse({"table":{"rows":[' +
    '{"c":[{"v":"00935-3/X/2026"}]}]}});'});
  const doc = {pkbonNo: '00935-3/X/2026', site: 'X', tanggal: '2026-10-13', items: []};
  await assert.rejects(
    A.tulisKeSheet(doc, '', {getToken: async () => 'T', fetchImpl: gviz}),
    /sudah ada di sheet/
  );
});
