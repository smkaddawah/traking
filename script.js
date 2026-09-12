// ==========================================
// 1. KONFIGURASI SUPABASE & GEMINI API
// ==========================================
const SUPABASE_URL = 'https://uzbetawwsxvqnerlrmpw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LJn-AYxrSlJ6BzIfhJxh3w_vHHvHupD'; 

// Menggunakan nama variabel 'db' agar tidak bentrok dengan global 'supabase' dari CDN
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentSaldo = 0;

document.addEventListener('DOMContentLoaded', () => {
    // Inisialisasi semua fitur
    // Set default tanggal transaksi kasir ke hari ini
    const inputTanggal = document.getElementById('inputTanggalTransaksi');
    if (inputTanggal) {
        // Mendapatkan tanggal hari ini dengan format YYYY-MM-DD
        const today = new Date();
        // Menyesuaikan zona waktu lokal (WIB)
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        inputTanggal.value = `${yyyy}-${mm}-${dd}`;
    }
    initNavLongPressAndRightClick();
    initCameraScanner();
    initAutoCompleteGR();
    
    // Setup format input Rupiah (titik otomatis)
    setupInputRupiah('inputSaldo');
    setupInputRupiah('inputHarga');

    // Load data dari database dan AI
    loadDataFromSupabase();
    fetchGeminiAIInsights();
    loadAIInsightDariDatabase();

    // Event listener tombol simpan
    document.getElementById('formBelanja').addEventListener('submit', handleSimpanBelanja);
    document.getElementById('btnSimpanSaldo').addEventListener('click', handleSimpanSaldo);
});

// ==========================================
// 2. FITUR LONG-PRESS & KLIK KANAN (PIN MENU)
// ==========================================
function initNavLongPressAndRightClick() {
    const btnHome = document.getElementById('btnHome');
    const offcanvasElement = document.getElementById('bottomSheetPinMenu');
    
    if (!btnHome || !offcanvasElement) return;
    
    const bsOffcanvas = new bootstrap.Offcanvas(offcanvasElement);
    let pressTimer;

    const openPinMenu = (e) => {
        e.preventDefault();
        bsOffcanvas.show();
    };

    btnHome.addEventListener('contextmenu', openPinMenu);

    btnHome.addEventListener('touchstart', (e) => {
        pressTimer = setTimeout(() => openPinMenu(e), 600); 
    });
    btnHome.addEventListener('touchend', () => clearTimeout(pressTimer));
    btnHome.addEventListener('touchmove', () => clearTimeout(pressTimer));

    document.querySelectorAll('.btn-add-pin').forEach(item => {
        item.addEventListener('click', function() {
            const name = this.getAttribute('data-name');
            const icon = this.getAttribute('data-icon');
            pinMenuToNav(name, icon);
            bsOffcanvas.hide();
        });
    });
}

function pinMenuToNav(name, iconClass) {
    const container = document.getElementById('navMenuContainer');
    if (container.children.length >= 3) {
        container.removeChild(container.lastElementChild);
    }
    
    const newNavHtml = `
        <div class="nav-item text-center" style="cursor: pointer;" onclick="alert('Membuka menu ${name}')">
            <div class="nav-icon-bg mx-auto mb-1">
                <i class="bi ${iconClass} fs-5 text-pink"></i>
            </div>
            <span class="d-block fw-bold text-muted" style="font-size: 0.7rem;">${name}</span>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', newNavHtml);
}

// ==========================================
// 3. KAMERA SCANNER
// ==========================================
function initCameraScanner() {
    const scannerBox = document.getElementById('kameraScanner');
    if (!scannerBox) return;

    scannerBox.addEventListener('click', async () => {
        try {
            scannerBox.innerHTML = `<video id="previewVideo" autoplay playsinline muted class="w-100 h-100 object-fit-cover rounded-4"></video>`;
            const videoElement = document.getElementById('previewVideo');
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert('Browser Anda tidak mendukung akses kamera, atau pastikan membuka via Localhost / HTTPS.');
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            videoElement.srcObject = stream;
            alert('Kamera aktif! Arahkan ke barcode.');
        } catch (err) {
            alert('Gagal mengakses kamera: Pastikan Anda memberikan izin akses kamera di browser dan menggunakan Localhost/HTTPS. Error: ' + err.message);
        }
    });
}

// ==========================================
// 4. AUTOCOMPLETE & AUTO-GENERATE KODE "GR"
// ==========================================
function initAutoCompleteGR() {
    const inputKode = document.getElementById('inputKode');
    const dropdown = document.getElementById('dropdownKode');
    if (!inputKode || !dropdown) return;

    inputKode.addEventListener('input', async function() {
        const val = this.value.trim();
        
        if (val.length > 0) {
            const { data: barangList, error } = await db
                .from('barang')
                .select('*')
                .or(`kode_gr.ilike.%${val}%,nama_barang.ilike.%${val}%`)
                .limit(5);

            if (!error && barangList && barangList.length > 0) {
                dropdown.innerHTML = barangList.map(b => `
                    <li class="list-group-item list-group-item-action small py-2 dropdown-item-custom" 
                        data-kode="${b.kode_gr}" 
                        data-nama="${b.nama_barang}" 
                        data-kategori="${b.kategori}" 
                        data-harga="${b.harga_satuan}" 
                        data-stok="${b.stok_saat_ini}" style="cursor: pointer;">
                        <b>${b.kode_gr}</b> - ${b.nama_barang} (${b.kategori}) [Stok: ${b.stok_saat_ini}]
                    </li>
                `).join('') + `
                    <li class="list-group-item list-group-item-action small py-2 text-pink fw-bold dropdown-create-new" style="cursor:pointer;">
                        <i class="bi bi-plus-circle me-1"></i> Buat Kode Baru Berawalan GR...
                    </li>
                `;
                dropdown.classList.remove('d-none');
            } else {
                dropdown.innerHTML = `
                    <li class="list-group-item list-group-item-action small py-2 text-pink fw-bold dropdown-create-new" style="cursor:pointer;">
                        <i class="bi bi-plus-circle me-1"></i> Buat Kode Baru Berawalan GR...
                    </li>
                `;
                dropdown.classList.remove('d-none');
            }
        } else {
            dropdown.classList.add('d-none');
        }
    });

    dropdown.addEventListener('mousedown', function(e) {
        e.preventDefault(); 
    });

    dropdown.addEventListener('click', function(e) {
        const item = e.target.closest('.dropdown-item-custom');
        const createNew = e.target.closest('.dropdown-create-new');

        if (item) {
            const kode = item.getAttribute('data-kode');
            const nama = item.getAttribute('data-nama');
            const kategori = item.getAttribute('data-kategori');
            const harga = item.getAttribute('data-harga');
            const stokLama = item.getAttribute('data-stok'); // Mengambil stok dari atribut data-stok
            
            selectBarang(kode, nama, kategori, harga, stokLama); // Mengirim stokLama ke fungsi selectBarang
            dropdown.classList.add('d-none');
        } else if (createNew) {
            createNewGRCode();
            dropdown.classList.add('d-none');
        }
    });
}
window.selectBarang = function(kode, nama, kategori, harga) {
    document.getElementById('inputKode').value = kode;
    document.getElementById('inputNama').value = nama;
    document.getElementById('inputKategori').value = kategori;
    document.getElementById('inputHarga').value = formatRupiah(harga);
    document.getElementById('dropdownKode').classList.add('d-none');

    // Munculkan kotak pertanyaan sisa stok karena barang ini sudah ada di database
    const boxStok = document.getElementById('boxKonfirmasiStok');
    if (boxStok) {
        boxStok.classList.remove('d-none');
        document.getElementById('labelInfoStokinnerHTML', `Kemarin kamu beli "${nama}", sisa stoknya sekarang berapa?`);
    }
};

window.createNewGRCode = function() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const generatedCode = `GR-${randomNum}`;
    document.getElementById('inputKode').value = generatedCode;
    document.getElementById('inputNama').value = '';
    document.getElementById('inputHarga').value = '';
    document.getElementById('dropdownKode').classList.add('d-none');
    
    // Sembunyikan kotak konfirmasi karena ini barang baru
    const boxStok = document.getElementById('boxKonfirmasiStok');
    if (boxStok) boxStok.classList.add('d-none');

    alert(`Kode otomatis dibuat: ${generatedCode}`);
};

// ==========================================
// 5. INTEGRASI GEMINI AI (INSIGHTS)
// ==========================================

        async function fetchGeminiAIInsights() {
    const aiText1 = document.getElementById('ai-text-1');
    const aiText2 = document.getElementById('ai-text-2');
    if (!aiText1) return;

    if (GEMINI_API_KEY === 'GANTI_DENGAN_API_KEY_GEMINI_ANDA' || GEMINI_API_KEY.trim() === '') {
        aiText1.innerText = "Error: Masukkan API Key di script.js.";
        return;
    }

    aiText1.innerText = "Lagi mikir & meracik analisis dari datamu...";
    if (aiText2) aiText2.innerText = "Sabar ya, tunggu sebentar...";

    try {
        // 1. AMBIL DATA DARI DATABASE (SUPABASE)
        const { data: trxData, error: errTrx } = await db.from('transaksi').select('*, barang(nama_barang, kategori, harga_satuan, stok_saat_ini)').order('tanggal_transaksi', { ascending: false });
        const { data: barangData, error: errBarang } = await db.from('barang').select('*');

        // CEK DI CONSOLE (F12) - Bukti bahwa data berhasil diambil dari database
        console.log("Data Transaksi:", trxData);
        console.log("Error Transaksi:", errTrx);
        console.log("Data Barang:", barangData);

        let infoBarang = barangData && barangData.length > 0 ? barangData.map(b => `- ${b.nama_barang} (Kat: ${b.kategori}, Stok: ${b.stok_saat_ini})`).join('\n') : "Belum ada barang.";
        let infoTrx = trxData && trxData.length > 0 ? trxData.map(t => `- Beli ${t.barang?.nama_barang || 'Barang'} (${t.jumlah_beli}x) pd ${new Date(t.tanggal_transaksi).toLocaleDateString('id-ID')}`).join('\n') : "Belum ada transaksi.";

        const promptText = `Sebagai penasihat keuangan dan sahabat santai. Data barang: [${infoBarang}]. Data transaksi: [${infoTrx}]. 
        Bagi 2 bagian dipisah '|||':
        1. Ulasan mendalam soal pola konsumsi barang (ingatkan santai misal takaran bulanan habis cepat).
        2. Saran kelola uang dari pola itu.
        Pakai bahasa santai akrab.`;

        // 2. KIRIM KE GEMINI (Kembali menggunakan ?key= di URL)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error("Gemini API Error:", data.error.message);
            aiText1.innerText = "Gagal memuat AI: " + data.error.message;
            return;
        }

        if (data.candidates && data.candidates.length > 0) {
            const fullText = data.candidates[0].content.parts[0].text;
            const parts = fullText.split('|||');

            const teksPertama = parts[0] ? parts[0].trim() : fullText;
            const teksKedua = parts[1] ? parts[1].trim() : "Terus semangat catat keuanganmu!";

            aiText1.innerText = teksPertama;
            if (aiText2) aiText2.innerText = teksKedua;

            await db.from('ai_insight').upsert([{
                id: 1,
                teks_utama: teksPertama,
                teks_analisis: teksKedua
            }]);
            
            const detailCatatan = document.getElementById('detailCatatanAI');
            if (detailCatatan) detailCatatan.innerText = teksPertama;
        }
    } catch (error) {
        console.error("Error:", error);
        aiText1.innerText = "Error Sistem: " + error.message;
    }
}


        
// ==========================================
// 6. KONEKSI SUPABASE: LOAD & SIMPAN DATA
// ==========================================
async function loadDataFromSupabase() {
    // 1. Ambil Saldo
    const { data: saldoData, error: saldoError } = await db
        .from('saldo')
        .select('*')
        .order('id', { ascending: false })
        .limit(1);

    if (!saldoError && saldoData && saldoData.length > 0) {
        currentSaldo = parseFloat(saldoData[0].total_saldo);
        const saldoElement = document.getElementById('totalSaldoText');
        if(saldoElement) saldoElement.innerText = `Rp ${formatRupiah(currentSaldo)}`;
    }

    // 2. Ambil Riwayat Transaksi Terakhir
    const { data: trxData, error: trxError } = await db
        .from('transaksi')
        .select('*, barang(nama_barang, kategori, kode_gr)')
        .order('tanggal_transaksi', { ascending: false })
        .limit(5);

    const listContainer = document.getElementById('listTransaksi');
    if (!listContainer) return;

    if (!trxError && trxData && trxData.length > 0) {
        listContainer.innerHTML = trxData.map(t => `
            <div class="card border-0 shadow-sm mb-2 rounded-3">
                <div class="card-body p-3 d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <div class="bg-pink-light text-pink rounded p-2 me-3 d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                            <i class="bi bi-bag-check-fill fs-5"></i>
                        </div>
                        <div>
                            <h6 class="mb-0 fw-bold" style="font-size: 0.9rem;">${t.barang?.nama_barang || 'Barang'} (${t.barang?.kode_gr || '-'})</h6>
                            <span class="badge bg-pink text-white" style="font-size: 0.65rem;">${t.barang?.kategori || 'Umum'}</span>
                            <span class="text-muted ms-1" style="font-size: 0.75rem;">${t.jumlah_beli} Item</span>
                        </div>
                    </div>
                    <span class="fw-bold text-danger" style="font-size: 0.9rem;">-Rp ${formatRupiah(t.total_harga)}</span>
                </div>
            </div>
        `).join('');
    } else {
        listContainer.innerHTML = `
            <div class="card-body p-3 text-center text-muted small">
                Belum ada transaksi dicatat.
            </div>
        `;
    }
}

async function handleSimpanSaldo() {
    const inputVal = document.getElementById('inputSaldo').value;
    const nominal = parseRupiah(inputVal);
    
    if (nominal <= 0) {
        alert('Masukkan nominal saldo yang valid!');
        return;
    }

    const newSaldo = currentSaldo + nominal;

    const { error } = await db
        .from('saldo')
        .insert([{ total_saldo: newSaldo }]);

    if (error) {
        alert('Gagal menyimpan saldo. Pastikan RLS di Supabase sudah dimatikan. Error: ' + error.message);
        return;
    }

    currentSaldo = newSaldo;
    document.getElementById('totalSaldoText').innerText = `Rp ${formatRupiah(currentSaldo)}`;
    alert(`Berhasil menambah saldo sebesar Rp ${formatRupiah(nominal)}`);
    
    const modalEl = document.getElementById('modalTambahSaldo');
    bootstrap.Modal.getInstance(modalEl).hide();
    document.getElementById('inputSaldo').value = '';
}

async function handleSimpanBelanja(e) {
    e.preventDefault();
    
    // --- TAMBAHAN BARU: CEGAH BENTROK DENGAN KERANJANG ---
    // Jika keranjang ada isinya, batalkan fungsi simpan satuan ini
    // Biarkan fungsi keranjang yang bekerja
    if (keranjangBelanja.length > 0) return; 
    // -----------------------------------------------------

    const kode = document.getElementById('inputKode').value.trim();
    const nama = document.getElementById('inputNama').value.trim();
    const kategori = document.getElementById('inputKategori').value;
    const qty = parseInt(document.getElementById('inputQty').value) || 1;
    // ... (biarkan sisa kodenya ke bawah sama persis)
    
    // Ambil sisa stok lama yang diinput user
    const sisaStokLama = parseInt(document.getElementById('inputSisaStokLama')?.value) || 0;

    const hargaVal = document.getElementById('inputHarga').value;
    const harga = parseRupiah(hargaVal);
    const totalBelanja = qty * harga;

    if (!kode || !nama || harga <= 0) {
        alert('Mohon lengkapi kode, nama barang, dan harga dengan benar!');
        return;
    }

    if (currentSaldo < totalBelanja) {
        alert('Peringatan: Saldo Anda tidak mencukupi untuk transaksi ini!');
    }

    let barangId = null;
    const { data: existingBarang } = await db
        .from('barang')
        .select('*')
        .eq('kode_gr', kode)
        .maybeSingle();

    if (existingBarang) {
        barangId = existingBarang.id;
        
        // Update stok saat ini di database dengan rumus: (sisa stok lama + pembelian baru)
        const stokBaruTotal = sisaStokLama + qty;
        await db
            .from('barang')
            .update({ 
                stok_saat_ini: stokBaruTotal,
                harga_satuan: harga 
            })
            .eq('id', barangId);
            
    } else {
        // Insert barang baru
        const { data: newBarang, error: errBarang } = await db
            .from('barang')
            .insert([{
                kode_gr: kode,
                nama_barang: nama,
                kategori: kategori,
                harga_satuan: harga,
                stok_saat_ini: qty
            }])
            .select()
            .single();

        if (errBarang) {
            alert('Gagal menyimpan master barang: ' + errBarang.message);
            return;
        }
        barangId = newBarang.id;
    }

    // Ambil tanggal dari input kalender (jika kosong otomatis pakai hari ini)
    let tanggalPilihan = document.getElementById('inputTanggalTransaksi')?.value;
    if (!tanggalPilihan) tanggalPilihan = new Date().toISOString().split('T')[0];

    // Proses Simpan ke Supabase (tabel transaksi)
    const { error: errTrx } = await db.from('transaksi').insert([
        {
            barang_id: barangId, 
            jumlah_beli: qty, 
            total_harga: totalBelanja, 
            tanggal_transaksi: `${tanggalPilihan}T12:00:00+07:00` 
        }
    ]);
    if (errTrx) {
        alert('Gagal menyimpan transaksi: ' + errTrx.message);
        return;
    }

    // Update Saldo
    const updatedSaldo = currentSaldo - totalBelanja;
    await db.from('saldo').insert([{ total_saldo: updatedSaldo }]);

    alert('Transaksi dan konfirmasi sisa stok berhasil disimpan!');
    
    const modalEl = document.getElementById('modalBelanja');
    bootstrap.Modal.getInstance(modalEl).hide();
    document.getElementById('formBelanja').reset();
    
    // Sembunyikan kembali kotak sisa stok
    document.getElementById('boxKonfirmasiStok')?.classList.add('d-none');
    
    loadDataFromSupabase();
}

// ==========================================
// 7. FUNGSI HELPER (FORMAT RUPIAH)
// ==========================================
window.formatRupiah = function(angka) {
    if (!angka) return "0";
    return angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

window.parseRupiah = function(str) {
    if (!str) return 0;
    return parseFloat(str.toString().replace(/\./g, '')) || 0;
};

window.setupInputRupiah = function(idElement) {
    const input = document.getElementById(idElement);
    if (!input) return;
    input.addEventListener('input', function() {
        let value = this.value.replace(/[^0-9]/g, '');
        if (value) {
            this.value = formatRupiah(value);
        } else {
            this.value = '';
        }
    });
};

// Event listener untuk tombol Daftar Barang
document.addEventListener('DOMContentLoaded', () => {
    const btnDaftarBarang = document.getElementById('btnDaftarBarang');
    if (btnDaftarBarang) {
        btnDaftarBarang.addEventListener('click', loadMasterBarang);
    }
});

async function loadMasterBarang() {
    const container = document.getElementById('containerMasterBarang');
    container.innerHTML = `<p class="text-center text-muted small py-3">Memuat data barang...</p>`;

    const { data: barangList, error } = await db
        .from('barang')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p class="text-center text-danger small py-3">Gagal memuat data: ${error.message}</p>`;
        return;
    }

    if (barangList && barangList.length > 0) {
        container.innerHTML = barangList.map(b => `
            <div class="card border-0 shadow-sm rounded-3 p-3">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1 fw-bold text-dark" style="font-size: 0.9rem;">${b.nama_barang}</h6>
                        <span class="badge bg-pink text-white" style="font-size: 0.65rem;">${b.kategori}</span>
                        <span class="text-muted ms-1" style="font-size: 0.75rem;">Kode: <b>${b.kode_gr}</b></span>
                    </div>
                    <div class="text-end">
                        <span class="d-block fw-bold text-pink" style="font-size: 0.85rem;">Rp ${formatRupiah(b.harga_satuan)}</span>
                        <span class="text-muted" style="font-size: 0.75rem;">Stok: ${b.stok_saat_ini}</span>
                    </div>
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = `<p class="text-center text-muted small py-3">Belum ada master barang tersimpan.</p>`;
    }
}

let keranjangBelanja = [];
let maxStokSebelumnya = 0; // Menyimpan data stok lama untuk validasi

// Update bagian selectBarang agar menampilkan jumlah stok lama
window.selectBarang = function(kode, nama, kategori, harga, stokLama) {
    document.getElementById('inputKode').value = kode;
    document.getElementById('inputNama').value = nama;
    document.getElementById('inputKategori').value = kategori;
    document.getElementById('inputHarga').value = formatRupiah(harga);
    document.getElementById('dropdownKode').classList.add('d-none');

    maxStokSebelumnya = parseInt(stokLama) || 0;

    const boxStok = document.getElementById('boxKonfirmasiStok');
    const labelInfoStok = document.getElementById('labelInfoStok');
    if (boxStok && labelInfoStok) {
        boxStok.classList.remove('d-none');
        labelInfoStok.innerHTML = `<i class="bi bi-question-circle-fill me-1"></i> "${nama}" kemarin kamu beli sebanyak <b>${maxStokSebelumnya}</b>. Sisa stok sekarang berapa?`;
        document.getElementById('inputSisaStokLama').value = "0";
    }
};

window.createNewGRCode = function() {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const generatedCode = `GR-${randomNum}`;
    document.getElementById('inputKode').value = generatedCode;
    document.getElementById('inputNama').value = '';
    document.getElementById('inputHarga').value = '';
    document.getElementById('dropdownKode').classList.add('d-none');
    
    maxStokSebelumnya = 0;
    const boxStok = document.getElementById('boxKonfirmasiStok');
    if (boxStok) boxStok.classList.add('d-none');
};

// Event listener untuk tombol "Masukkan ke Keranjang"
document.addEventListener('DOMContentLoaded', () => {
    const btnTambah = document.getElementById('btnTambahKeranjang');
    if (btnTambah) {
        btnTambah.addEventListener('click', tambahKeKeranjang);
    }

    // === TAMBAHKAN 4 BARIS INI UNTUK MENGAKTIFKAN TOMBOL SIMPAN ===
    const btnSimpanSemua = document.getElementById('btnSimpanSemua');
    if (btnSimpanSemua) {
        btnSimpanSemua.addEventListener('click', prosesSimpanSemuaTransaksi);
    }
    // =============================================================

    
    // Validasi real-time input sisa stok agar tidak lebih besar dari stok sebelumnya
    const inputSisaStok = document.getElementById('inputSisaStokLama');
    if (inputSisaStok) {
        inputSisaStok.addEventListener('input', function() {
            const val = parseInt(this.value) || 0;
            const errorMsg = document.getElementById('errorStokMsg');
            const btnTambah = document.getElementById('btnTambahKeranjang');
            
            if (val > maxStokSebelumnya) {
                errorMsg.classList.remove('d-none');
                errorMsg.innerText = `Kesalahan: Sisa stok (${val}) tidak boleh melebihi jumlah kemarin (${maxStokSebelumnya})!`;
                btnTambah.disabled = true;
            } else {
                errorMsg.classList.add('d-none');
                btnTambah.disabled = false;
            }
        });
    }
});

function tambahKeKeranjang() {
    const kode = document.getElementById('inputKode').value.trim();
    const nama = document.getElementById('inputNama').value.trim();
    const kategori = document.getElementById('inputKategori').value;
    const qty = parseInt(document.getElementById('inputQty').value) || 1;
    const sisaStokLama = parseInt(document.getElementById('inputSisaStokLama')?.value) || 0;
    
    const hargaVal = document.getElementById('inputHarga').value;
    const harga = parseRupiah(hargaVal);
    const subtotal = qty * harga;

    if (!kode || !nama || harga <= 0) {
        alert('Mohon lengkapi kode, nama barang, dan harga dengan benar!');
        return;
    }

    // Masukkan ke array keranjang
    keranjangBelanja.push({
        kode, nama, kategori, qty, harga, subtotal, sisaStokLama
    });

    renderKeranjang();
    
    // Reset form item kecil
    document.getElementById('inputKode').value = '';
    document.getElementById('inputNama').value = '';
    document.getElementById('inputQty').value = '1';
    document.getElementById('inputHarga').value = '';
    document.getElementById('boxKonfirmasiStok').classList.add('d-none');
}

function renderKeranjang() {
    const container = document.getElementById('listKeranjang');
    const totalText = document.getElementById('totalBelanjaKasir');
    const btnSimpanSemua = document.getElementById('btnSimpanSemua');

    if (keranjangBelanja.length === 0) {
        container.innerHTML = `<span class="text-muted small text-center py-2">Keranjang masih kosong</span>`;
        totalText.innerText = `Rp 0`;
        btnSimpanSemua.disabled = true;
        return;
    }

    let totalSemua = 0;
    container.innerHTML = keranjangBelanja.map((item, index) => {
        totalSemua += item.subtotal;
        return `
            <div class="d-flex justify-content-between align-items-center bg-light p-2 rounded-3" style="font-size: 0.8rem;">
                <div>
                    <b>${item.nama}</b> (${item.qty}x @Rp ${formatRupiah(item.harga)})
                    <div class="text-muted" style="font-size: 0.7rem;">Kategori: ${item.kategori} | Sisa lalu: ${item.sisaStokLama}</div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="fw-bold text-danger">-Rp ${formatRupiah(item.subtotal)}</span>
                    <button type="button" class="btn btn-sm text-danger p-0" onclick="hapusItemKeranjang(${index})"><i class="bi bi-trash-fill"></i></button>
                </div>
            </div>
        `;
    }).join('');

    totalText.innerText = `Rp ${formatRupiah(totalSemua)}`;
    btnSimpanSemua.disabled = false;
}

window.hapusItemKeranjang = function(index) {
    keranjangBelanja.splice(index, 1);
    renderKeranjang();
};

async function prosesSimpanSemuaTransaksi(e) {
    if (e) e.preventDefault(); // Mencegah form reload yang bikin gagal simpan

    if (keranjangBelanja.length === 0) return;

    let totalSemuaBelanja = keranjangBelanja.reduce((sum, item) => sum + item.subtotal, 0);

    if (currentSaldo < totalSemuaBelanja) {
        alert('Peringatan: Total saldo Anda tidak mencukupi untuk membayar semua transaksi ini!');
        return;
    }

    // Ambil tanggal dari kalender
    let tanggalPilihan = document.getElementById('inputTanggalTransaksi')?.value;
    if (!tanggalPilihan) tanggalPilihan = new Date().toISOString().split('T')[0];

    // Ganti tombol jadi loading agar user tidak klik 2x
    const btnSimpan = document.getElementById('btnSimpanSemua');
    if (btnSimpan) {
        btnSimpan.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyimpan...';
        btnSimpan.disabled = true;
    }

    try {
        // Proses loop simpan setiap item ke Supabase
        for (const item of keranjangBelanja) {
            let barangId = null;
            const { data: existingBarang, error: errCek } = await db
                .from('barang')
                .select('*')
                .eq('kode_gr', item.kode)
                .maybeSingle();

            if (existingBarang) {
                barangId = existingBarang.id;
                const stokBaruTotal = item.sisaStokLama + item.qty;
                await db.from('barang').update({ 
                    stok_saat_ini: stokBaruTotal,
                    harga_satuan: item.harga 
                }).eq('id', barangId);
            } else {
                const { data: newBarang, error: errBarang } = await db.from('barang').insert([{
                    kode_gr: item.kode,
                    nama_barang: item.nama,
                    kategori: item.kategori,
                    harga_satuan: item.harga,
                    stok_saat_ini: item.qty
                }]).select().single();

                if (errBarang) throw errBarang;
                barangId = newBarang.id;
            }

            // Simpan ke tabel transaksi dengan pengecekan error ketat
            const { error: errTrx } = await db.from('transaksi').insert([{
                barang_id: barangId,
                jumlah_beli: item.qty,
                total_harga: item.subtotal,
                tanggal_transaksi: `${tanggalPilihan}T12:00:00+07:00`
            }]);

            if (errTrx) throw errTrx;
        }

        // Update Saldo Terakhir sekaligus
        currentSaldo -= totalSemuaBelanja;
        await db.from('saldo').insert([{ total_saldo: currentSaldo }]);

        alert('Semua transaksi kasir berhasil disimpan!');
        
        // Kosongkan keranjang & tutup modal
        keranjangBelanja = [];
        renderKeranjang();
        
        const modalEl = document.getElementById('modalBelanja');
        if (modalEl) bootstrap.Modal.getInstance(modalEl).hide();
        
        loadDataFromSupabase();

    } catch (error) {
        console.error("Error Simpan Keranjang:", error);
        alert("Gagal menyimpan data ke database! Buka F12 (Console) untuk melihat detail errornya.");
    } finally {
        // Kembalikan tombol seperti semula
        if (btnSimpan) {
            btnSimpan.innerHTML = 'Simpan & Bayar Semua Transaksi';
            btnSimpan.disabled = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Jika ada tombol menu Analisis, pasang event klik
    // (Bisa dipasang ke tombol menu Analisis Anda)
});

async function bukaDetailAnalisis() {
    const modalEl = new bootstrap.Modal(document.getElementById('modalDetailAnalisis'));
    modalEl.show();

    // 1. Hitung total pemasukan dari riwayat saldo masuk
    const { data: saldoData } = await db.from('saldo').select('*').order('id', { ascending: true });
    let totalPemasukan = 0;
    if (saldoData && saldoData.length > 0) {
        // Pemasukan adalah akumulasi penambahan saldo positif
        totalPemasukan = saldoData[saldoData.length - 1].total_saldo; // atau logika selisih positif
    }

    // 2. Ambil data transaksi beserta kategori barangnya
    const { data: trxData } = await db
        .from('transaksi')
        .select('*, barang(kategori, nama_barang)');

    let totalPengeluaran = 0;
    let expHarian = 0;
    let expMingguan = 0;
    let expBulanan = 0;

    if (trxData && trxData.length > 0) {
        trxData.forEach(t => {
            const nominal = t.total_harga || 0;
            totalPengeluaran += nominal;
            const kat = t.barang?.kategori ? t.barang.kategori.toLowerCase() : 'harian';

            if (kat === 'harian') expHarian += nominal;
            else if (kat === 'mingguan') expMingguan += nominal;
            else if (kat === 'bulanan') expBulanan += nominal;
        });
    }

    // Render ke Tampilan Modal
    document.getElementById('detailTotalPemasukan').innerText = `Rp ${formatRupiah(totalPemasukan)}`;
    document.getElementById('detailTotalPengeluaran').innerText = `Rp ${formatRupiah(totalPengeluaran)}`;

    document.getElementById('valHarian').innerText = `Rp ${formatRupiah(expHarian)}`;
    document.getElementById('valMingguan').innerText = `Rp ${formatRupiah(expMingguan)}`;
    document.getElementById('valBulanan').innerText = `Rp ${formatRupiah(expBulanan)}`;

    // Hitung persentase untuk Progress Bar
    const maxVal = totalPengeluaran > 0 ? totalPengeluaran : 1;
    document.getElementById('barHarian').style.width = `${(expHarian / maxVal) * 100}%`;
    document.getElementById('barMingguan').style.width = `${(expMingguan / maxVal) * 100}%`;
    document.getElementById('barBulanan').style.width = `${(expBulanan / maxVal) * 100}%`;

    // Tarik teks AI untuk ditampilkan di detail
    const aiTextElement = document.getElementById('ai-text-1');
    document.getElementById('detailCatatanAI').innerText = aiTextElement ? aiTextElement.innerText : "Aman, keuanganmu terkendali!";
}

// ==========================================
// 8. FITUR DETAIL ANALISIS & GRAFIK KEUANGAN
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Menangkap klik pada pin menu "Analisis" di bawah jika ada
    document.addEventListener('click', function(e) {
        const targetMenu = e.target.closest('.nav-item');
        if (targetMenu && targetMenu.innerText.includes('Analisis')) {
            bukaDetailAnalisis();
        }
    });

    // Jika ingin menghubungkan langsung ke tombol analisis lain jika ada
    const btnBukaAnalisis = document.getElementById('btnBukaAnalisis');
    if (btnBukaAnalisis) {
        btnBukaAnalisis.addEventListener('click', bukaDetailAnalisis);
    }
});

async function bukaDetailAnalisis() {
    const modalEl = new bootstrap.Modal(document.getElementById('modalDetailAnalisis'));
    modalEl.show();

    // 1. Ambil data saldo terakhir (total pemasukan tercatat dari baris terakhir saldo)
    const { data: saldoData } = await db.from('saldo').select('*').order('id', { ascending: false }).limit(1);
    let totalPemasukan = 0;
    if (saldoData && saldoData.length > 0) {
        totalPemasukan = parseFloat(saldoData[0].total_saldo) || 0;
    }

    // 2. Ambil data transaksi beserta kategori barangnya
    const { data: trxData } = await db
        .from('transaksi')
        .select('*, barang(kategori, nama_barang)');

    let totalPengeluaran = 0;
    let expHarian = 0;
    let expMingguan = 0;
    let expBulanan = 0;

    if (trxData && trxData.length > 0) {
        trxData.forEach(t => {
            const nominal = t.total_harga || 0;
            totalPengeluaran += nominal;
            const kat = t.barang?.kategori ? t.barang.kategori.toLowerCase() : 'harian';

            if (kat === 'harian') expHarian += nominal;
            else if (kat === 'mingguan') expMingguan += nominal;
            else if (kat === 'bulanan') expBulanan += nominal;
        });
    }

    // Render angka ke Modal Detail
    document.getElementById('detailTotalPemasukan').innerText = `Rp ${formatRupiah(totalPemasukan)}`;
    document.getElementById('detailTotalPengeluaran').innerText = `Rp ${formatRupiah(totalPengeluaran)}`;

    document.getElementById('valHarian').innerText = `Rp ${formatRupiah(expHarian)}`;
    document.getElementById('valMingguan').innerText = `Rp ${formatRupiah(expMingguan)}`;
    document.getElementById('valBulanan').innerText = `Rp ${formatRupiah(expBulanan)}`;

    // Hitung persentase untuk Progress Bar Grafik
    const maxVal = totalPengeluaran > 0 ? totalPengeluaran : 1;
    document.getElementById('barHarian').style.width = `${(expHarian / maxVal) * 100}%`;
    document.getElementById('barMingguan').style.width = `${(expMingguan / maxVal) * 100}%`;
    document.getElementById('barBulanan').style.width = `${(expBulanan / maxVal) * 100}%`;

    // Tarik teks catatan AI yang santai ke dalam modal detail
    const aiTextElement = document.getElementById('ai-text-1');
    const catatanAI = document.getElementById('detailCatatanAI');
    if (catatanAI) {
        catatanAI.innerText = aiTextElement && aiTextElement.innerText !== "Menganalisis pola belanja dan stok barang Anda..." 
            ? aiTextElement.innerText 
            : "Santai, keuanganmu lagi kita pantau bareng kok. Input terus datanya biar makin akurat!";
    }
}

// Fungsi untuk memuat teks AI yang tersimpan di Supabase
async function loadAIInsightDariDatabase() {
    const aiText1 = document.getElementById('ai-text-1');
    const aiText2 = document.getElementById('ai-text-2');

    const { data, error } = await db
        .from('ai_insight')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

    if (data && !error) {
        if (aiText1) aiText1.innerText = data.teks_utama || "Belum ada analisis.";
        if (aiText2) aiText2.innerText = data.teks_analisis || "Klik tombol Refresh AI untuk memuat data pertama kalinya.";
    } else {
        if (aiText1) aiText1.innerText = "Belum ada analisis. Silakan klik Refresh AI.";
    }
}

// ==========================================
// 9. FITUR BARCODE SCANNER KAMERA
// ==========================================
let html5QrCode;

function mulaiScan() {
    const placeholder = document.getElementById('kameraPlaceholder');
    const reader = document.getElementById('reader');
    const overlay = document.getElementById('scannerOverlay');

    // Sembunyikan placeholder, tampilkan kamera & animasi
    placeholder.classList.add('d-none');
    reader.style.display = 'block';
    overlay.classList.remove('d-none');

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 100 }, // Bentuk melebar untuk baca barcode batang
        aspectRatio: 1.0
    };

    // Nyalakan kamera belakang (environment)
    html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        async (decodedText, decodedResult) => {
            // Jika berhasil scan:
            console.log(`Scan berhasil: ${decodedText}`);
            
            // 1. Masukkan hasil scan ke kolom input kode
            const inputKode = document.getElementById('inputKode');
            inputKode.value = decodedText;
            
            // 2. Matikan kamera agar tidak nyala terus
            matikanKamera();

            // 3. Picu pencarian data otomatis di dropdown
            const eventInput = new Event('input', { bubbles: true });
            inputKode.dispatchEvent(eventInput);
        },
        (errorMessage) => {
            // Proses mencari barcode (abaikan error karena frame belum pas)
        }
    ).catch(err => {
        console.error("Kamera gagal:", err);
        alert("Gagal mengakses kamera. Pastikan kamu sudah memberikan izin akses kamera di browser.");
        matikanKamera();
    });
}

function matikanKamera() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            document.getElementById('reader').style.display = 'none';
            document.getElementById('scannerOverlay').classList.add('d-none');
            document.getElementById('kameraPlaceholder').classList.remove('d-none');
        }).catch(err => console.log(err));
    }
}

// Pastikan kamera mati jika modal ditutup (biar kamera gak nyala di background)
document.addEventListener('DOMContentLoaded', () => {
    const modalBelanjaEl = document.getElementById('modalBelanja');
    if (modalBelanjaEl) {
        modalBelanjaEl.addEventListener('hidden.bs.modal', function () {
            matikanKamera();
        });
    }
});
