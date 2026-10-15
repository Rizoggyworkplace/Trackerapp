/* Unit test Asisten AI Trackers (full Gemini) — validasi anti-halusinasi,
   penomoran & tulis-balik sheet operasional. */
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
    ok: true,
    json: async () => ({values: [
      ['PKBON'], ['00929-3/IX/2026'], [], ['00931-1/X/2026'], ['00934-3/X/2026'], [],
    ]}),
  });
  const seq = await A.getNextSeqFromSheet(async () => 'T', fakeFetch);
  assert.equal(seq, 935);
  assert.equal(A.formatPkbonNo(seq, '2026-10-13'), '00935-3/X/2026');
});

test('cariBarisTulis: setelah baris terakhir yang terisi di C..I', () => {
  // header + 3 terisi + 1 kosong di tengah + 1 terisi (C kosong, E terisi manual)
  // -> tetap dihitung, tulis di bawah baris terakhir
  const grid = [
    ['PKBON','','SITE','','','',''],
    ['00929-3/IX/2026','','S1','','','',''],
    [], // celah kosong di tengah
    ['00934-3/X/2026','','S2','','','',''],
    ['','','S3-manual','','','',''], // C kosong tapi E terisi
  ];
  assert.equal(A.cariBarisTulis(grid), A.BARIS_MINIMAL + 1); // pengaman 982
  assert.equal(A.BARIS_MINIMAL, 981);
});

test('cariBarisTulis: baris bawah dengan C kosong tetap dihitung', () => {
  // grid panjang: data sampai baris 985, baris 984 C-nya kosong (diisi manual)
  const grid = [['PKBON','','','','','','']];
  for(let i = 0; i < 982; i++) grid.push(['00900-3/X/2026','','S','','','','']); // baris 2..983
  grid.push(['','','manual-tanpa-nomor','','','','']); // baris 984
  grid.push(['00980-3/X/2026','','S','','','','']); // baris 985
  assert.equal(A.cariBarisTulis(grid), 986);
});

test('tulisKeSheet: geser ke bawah bila baris target ada sel terisi', async () => {
  // C terisi sampai baris 982, tapi baris 983 kolom E terisi (tanpa nomor)
  const grid = [['PKBON','','','','','','']];
  for(let i = 0; i < 981; i++) grid.push(['00900-3/X/2026','','S','','','','']); // baris 2..982
  grid.push(['','','catatan-manual','','','','']); // baris 983: C kosong, E terisi
  const calls = [];
  const fakeFetch = async (url, opt) => {
    calls.push({url, opt});
    if(opt && opt.method === 'PUT') return {ok: true, json: async () => ({})};
    return {ok: true, json: async () => ({values: grid.map(r => r)})};
  };
  const doc = {pkbonNo: '00982-3/X/2026', site: 'X', tanggal: '2026-10-15', items: []};
  const baris = await A.tulisKeSheet(doc, '', {getToken: async () => 'T', fetchImpl: fakeFetch});
  assert.equal(baris, 984); // baris 983 ada isinya -> geser ke 984
  const put = calls.find(c => c.opt && c.opt.method === 'PUT');
  assert.ok(put.url.includes('values/Sheet2!C984%3AI984'), 'range C984:I984, dapat: ' + put.url);
});

test('barisSheet: susunan kolom C..I', () => {
  const doc = {pkbonNo: '00935-3/X/2026', site: 'Sendangreto', tanggal: '2026-10-13',
    items: [{uraian: 'Pembayaran multiguna', sat: 'Ls', vol: 1, harga: 3309543, keterangan: ''}]};
  assert.deepEqual(A.barisSheet(doc, 'RAFI'),
    ['00935-3/X/2026', '', 'Sendangreto', '13/10/2026', 'Pembayaran multiguna', 'Rp 3.309.543', 'RAFI']);
});

test('tulisKeSheet: PUT ke range yang benar', async () => {
  const calls = [];
  const fakeFetch = async (url, opt) => {
    calls.push({url, opt});
    if(opt && opt.method === 'PUT') return {ok: true, json: async () => ({})};
    return {ok: true, json: async () => ({values: [['PKBON'], ['00934-3/X/2026'], []]})};
  };
  const doc = {pkbonNo: '00935-3/X/2026', site: 'Sendangreto', tanggal: '2026-10-13',
    items: [{uraian: 'Pembayaran multiguna', sat: 'Ls', vol: 1, harga: 3309543, keterangan: ''}]};
  const baris = await A.tulisKeSheet(doc, 'RAFI', {getToken: async () => 'TOKEN123', fetchImpl: fakeFetch});
  // grid mini: hitungan baris 3, tapi pengaman BARIS_MINIMAL -> 982
  assert.equal(baris, 982);
  const put = calls.find(c => c.opt && c.opt.method === 'PUT');
  assert.ok(put.url.includes('values/Sheet2!C982%3AI982'), 'range C982:I982, dapat: ' + put.url);
  assert.equal(put.opt.headers.Authorization, 'Bearer TOKEN123');
  const body = JSON.parse(put.opt.body);
  assert.deepEqual(body.values[0],
    ['00935-3/X/2026', '', 'Sendangreto', '13/10/2026', 'Pembayaran multiguna', 'Rp 3.309.543', 'RAFI']);
});

test('tulisKeSheet: tulis di ujung bawah walau ada celah kosong di tengah', async () => {
  // Regresi bug 2026-10-15: gviz kepotong di sel kosong pertama (baris 811) sehingga
  // tulis jatuh di tengah data (bahkan menimpa). v4 harus baca sampai ujung (baris 980).
  const values = [['PKBON']];
  for(let i = 0; i < 809; i++) values.push([String(700 + i).padStart(5, '0') + '-1/VII/2026']); // baris 2..810
  values.push([]); // baris 811: celah kosong
  for(let i = 0; i < 169; i++) values.push([String(766 + i).padStart(5, '0') + '-3/VIII/2026']); // baris 812..980
  const calls = [];
  const fakeFetch = async (url, opt) => {
    calls.push({url, opt});
    if(opt && opt.method === 'PUT') return {ok: true, json: async () => ({})};
    return {ok: true, json: async () => ({values})};
  };
  const doc = {pkbonNo: '00935-3/X/2026', site: 'X', tanggal: '2026-10-15', items: []};
  const baris = await A.tulisKeSheet(doc, '', {getToken: async () => 'T', fetchImpl: fakeFetch});
  // baris terakhir terisi = 980 -> hitungan 981, tapi pengaman BARIS_MINIMAL -> 982
  assert.equal(baris, 982);
  const put = calls.find(c => c.opt && c.opt.method === 'PUT');
  assert.ok(put.url.includes('values/Sheet2!C982%3AI982'), 'range C982:I982, dapat: ' + put.url);
});

test('tulisKeSheet: menolak bila nomor sudah ada (anti duplikat)', async () => {
  const fakeFetch = async () => ({ok: true,
    json: async () => ({values: [['00935-3/X/2026']]})});
  const doc = {pkbonNo: '00935-3/X/2026', site: 'X', tanggal: '2026-10-13', items: []};
  await assert.rejects(
    A.tulisKeSheet(doc, '', {getToken: async () => 'T', fetchImpl: fakeFetch}),
    /sudah ada di sheet/
  );
});
test('validasiHasilLLM: draft valid lolos', () => {
  const ctx = {
    sites: [{name: 'Sendangreto', projectId: '25TS06B0042'}],
    banks: [{nama: 'Joko', rekening: '123', bank: 'BCA'}],
  };
  const hasil = {
    intent: 'buat_pkbon',
    draft: {
      site: 'sendangreto', projectId: '25TS06B0042', pekerjaan: 'Multiguna',
      uraian: 'Pembayaran jasa', nominal: 3309543,
      bank: {nama: 'Joko', rekening: '123', bank: 'BCA', isBaru: false},
    },
    butuh: [], tanya: null,
  };
  const m = A.validasiHasilLLM(hasil, ctx);
  assert.ok(m);
  assert.equal(m.site, 'Sendangreto');
  assert.equal(m.nominal, 3309543);
  assert.ok(m.bankMatch);
});

test('validasiHasilLLM: tolak site ngarang', () => {
  const ctx = {sites: [{name: 'Sendangreto', projectId: 'x'}], banks: []};
  const hasil = {intent: 'buat_pkbon',
    draft: {site: 'Site Khayalan', nominal: 1000, bank: {nama: 'A', rekening: '1', bank: 'BCA', isBaru: true}},
    butuh: [], tanya: null};
  assert.equal(A.validasiHasilLLM(hasil, ctx), null);
});

test('validasiHasilLLM: tolak nominal ngarang/nol', () => {
  const ctx = {sites: [{name: 'Sendangreto', projectId: 'x'}],
    banks: [{nama: 'Joko', rekening: '123', bank: 'BCA'}]};
  const hasil = {intent: 'buat_pkbon',
    draft: {site: 'Sendangreto', nominal: 0, bank: {nama: 'Joko', rekening: '123', bank: 'BCA'}},
    butuh: [], tanya: null};
  assert.equal(A.validasiHasilLLM(hasil, ctx), null);
});

test('validasiHasilLLM: bank baru eksplisit diterima', () => {
  const ctx = {sites: [{name: 'Sendangreto', projectId: 'x'}], banks: []};
  const hasil = {intent: 'buat_pkbon',
    draft: {site: 'Sendangreto', nominal: 500000,
      bank: {nama: 'Budi', rekening: '999', bank: 'BNI', isBaru: true}},
    butuh: [], tanya: null};
  const m = A.validasiHasilLLM(hasil, ctx);
  assert.ok(m);
  assert.equal(m.bankMatch, null);
  assert.deepEqual(m.bankBaru, {nama: 'Budi', rekening: '999', bank: 'BNI'});
});
