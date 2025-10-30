/* Utility */
const toIDR = (n) => {
  const num = isNaN(n) || n === "" || n === null ? 0 : Number(n);
  return "Rp " + num.toLocaleString("id-ID");
};
const parseNum = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

/* Elements */
const form = document.getElementById("invoiceForm");
const customerNameEl = document.getElementById("customerName");
const customerAddressEl = document.getElementById("customerAddress");
const customerEmailEl = document.getElementById("customerEmail");
const invoiceNumberEl = document.getElementById("invoiceNumber");
const invoiceDateEl = document.getElementById("invoiceDate");
const sellerNameEl = document.getElementById("sellerName");
const refNumberEl = document.getElementById("refNumber");
const validUntilEl = document.getElementById("validUntil");
const attentionToEl = document.getElementById("attentionTo");
const marginSelectEl = document.getElementById("marginSelect");
const marginCustomEl = document.getElementById("marginCustom");
const vatSelectEl = document.getElementById("vatSelect");

const itemsListEl = document.getElementById("itemsList");
const addItemBtn = document.getElementById("addItemBtn");
const notesEl = document.getElementById("shippingNotes");
const loadEditorBtn = document.getElementById("loadEditorBtn");
const editorEl = document.getElementById("editor");
const saveDraftBtn = document.getElementById("saveDraftBtn");
const printBtn = document.getElementById("printBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const logoutBtn = document.getElementById("logoutBtn");

/* Preview elements */
const metaCustomerEl = document.getElementById("metaCustomer");
const metaAttentionEl = document.getElementById("metaAttention");
const metaInvoiceNoEl = document.getElementById("metaInvoiceNo");
const metaDateEl = document.getElementById("metaDate");
const metaSellerEl = document.getElementById("metaSeller");
const metaRefNoEl = document.getElementById("metaRefNo");
const metaValidUntilEl = document.getElementById("metaValidUntil");

const previewItemsEl = document.getElementById("previewItems");
const vatPercentEl = document.getElementById("vatPercent");
const sumTotalEl = document.getElementById("sumTotal");
const sumVatEl = document.getElementById("sumVat");
const sumGrandEl = document.getElementById("sumGrand");
const notesContentEl = document.getElementById("notesContent");
const invoicePreviewEl = document.getElementById("invoicePreview");
const attachmentInputEl = document.getElementById("attachmentInput");
const attachmentsGridEl = document.getElementById("attachmentsGrid");
const clearAttachmentsBtn = document.getElementById("clearAttachmentsBtn");
const saveQuotationBtn = document.getElementById("saveQuotationBtn");
const quotationsTableBodyEl = document.getElementById("quotationsTableBody");
const quotationSearchEl = document.getElementById("quotationSearch");

/* State */
let quill = null; // WYSIWYG instance
let items = []; // {id, name, qty, unit, base}
let attachments = []; // [{src,name}]
let editingQuotationId = null; // mode edit untuk penawaran tersimpan

/* Supabase helpers for cloud sync */
function showToast(type, message, duration = 2600) {
  try {
    const container = document.getElementById('toastContainer') || (() => {
      const c = document.createElement('div');
      c.id = 'toastContainer';
      c.className = 'toast-container';
      document.body.appendChild(c);
      return c;
    })();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 200);
    }, duration);
  } catch(e) {
    console.warn('toast error', e);
  }
}
function toNullableNumber(v) {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}
async function getCurrentUserId() {
  try {
    const client = window.supabaseClient;
    if (!client) return null;
    const { data: { user } } = await client.auth.getUser();
    return user?.id || null;
  } catch (e) {
    return null;
  }
}

function localToSupabaseRow(payload, uid) {
  return {
    id: payload.id,
    user_id: uid,
    invoice_number: payload.invoiceNumber || null,
    invoice_date: payload.invoiceDate || null,
    customer_name: payload.customerName || null,
    customer_address: payload.customerAddress || null,
    customer_email: payload.customerEmail || null,
    seller_name: payload.sellerName || null,
    ref_number: payload.refNumber || null,
    valid_until: payload.validUntil || null,
    attention_to: payload.attentionTo || null,
    margin_select: payload.marginSelect || null,
    margin_custom: toNullableNumber(payload.marginCustom),
    vat_select: toNullableNumber(payload.vatSelect),
    items: payload.items || [],
    notes: payload.notes || "",
    wysiwyg: payload.wysiwyg || "",
    totals: payload.totals || { subTotal: 0, vatAmount: 0, grand: 0 },
    timestamp: payload.timestamp || Date.now(),
  };
}

function supabaseRowToLocal(row) {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number || "",
    invoiceDate: row.invoice_date || "",
    customerName: row.customer_name || "",
    customerAddress: row.customer_address || "",
    customerEmail: row.customer_email || "",
    sellerName: row.seller_name || "",
    refNumber: row.ref_number || "",
    validUntil: row.valid_until || "",
    attentionTo: row.attention_to || "",
    marginSelect: row.margin_select || "",
    marginCustom: row.margin_custom != null ? String(row.margin_custom) : "",
    vatSelect: row.vat_select != null ? String(row.vat_select) : "",
    items: row.items || [],
    notes: row.notes || "",
    wysiwyg: row.wysiwyg || "",
    totals: row.totals || { subTotal: 0, vatAmount: 0, grand: 0 },
    timestamp: row.timestamp || Date.now(),
  };
}

async function saveQuotationRemote(payload) {
  const client = window.supabaseClient;
  if (!client) return;
  const uid = await getCurrentUserId();
  if (!uid) return;
  const row = localToSupabaseRow(payload, uid);
  try {
    const { error } = await client.from("quotations").upsert(row, { onConflict: "id" });
    if (error) throw error;
  } catch (e) {
    console.warn("Supabase upsert failed", e);
  }
}

async function listQuotationsRemote() {
  const client = window.supabaseClient;
  if (!client) return null;
  const uid = await getCurrentUserId();
  if (!uid) return null;
  try {
    const { data, error } = await client
      .from("quotations")
      .select("*")
      .eq("user_id", uid)
      .order("timestamp", { ascending: false });
    if (error) throw error;
    return (data || []).map(supabaseRowToLocal);
  } catch (e) {
    console.warn("Supabase list failed", e);
    return null;
  }
}

async function deleteQuotationRemote(id) {
  const client = window.supabaseClient;
  if (!client) return;
  const uid = await getCurrentUserId();
  if (!uid) return;
  try {
    const { error } = await client.from("quotations").delete().eq("id", id).eq("user_id", uid);
    if (error) throw error;
  } catch (e) {
    console.warn("Supabase delete failed", e);
  }
}

/* Initialize */
function init() {
  // Auto invoice number
  if (!invoiceNumberEl.value) {
    const now = new Date();
    invoiceNumberEl.value = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${now.getTime().toString().slice(-5)}`;
  }
  // Default date today
  if (!invoiceDateEl.value) {
    const today = new Date();
    invoiceDateEl.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }
  // Start with one item row
  addItemRow();
  bindEvents();
  loadDraft();
  updateAll();
}

function bindEvents() {
  [customerNameEl, customerAddressEl, customerEmailEl, invoiceNumberEl, invoiceDateEl, sellerNameEl, refNumberEl, validUntilEl, attentionToEl, marginSelectEl, marginCustomEl, vatSelectEl, notesEl].forEach((el) => {
    el.addEventListener("input", () => {
      validateForm(true);
      updateAll();
    });
    el.addEventListener("change", () => {
      validateForm(true);
      updateAll();
    });
  });

  marginSelectEl.addEventListener("change", () => {
    const isCustom = marginSelectEl.value === "custom";
    marginCustomEl.disabled = !isCustom;
    updateAll();
  });

  addItemBtn.addEventListener("click", () => {
    addItemRow();
    updateAll();
  });
  saveDraftBtn.addEventListener("click", saveDraft);
  printBtn.addEventListener("click", () => window.print());
  downloadPdfBtn.addEventListener("click", generatePDF);
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        if (window.supabaseClient) {
          await window.supabaseClient.auth.signOut();
        }
      } catch (e) {
        console.warn("Supabase signOut error", e);
      } finally {
        window.location.href = "login.html";
      }
    });
  }
  form.addEventListener("reset", () => {
    setTimeout(() => {
      items = [];
      itemsListEl.innerHTML = "";
      addItemRow();
      updateAll();
    }, 0);
  });
  loadEditorBtn.addEventListener("click", enableEditorLazy);

  // Simpan Penawaran
  if (saveQuotationBtn) {
    saveQuotationBtn.addEventListener("click", saveQuotation);
  }

  // Pencarian riwayat
  if (quotationSearchEl) {
    quotationSearchEl.addEventListener("input", renderQuotationList);
  }

  // Delegasi aksi di tabel riwayat
  if (quotationsTableBodyEl) {
    quotationsTableBodyEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (!id || !action) return;

      if (action === "edit") {
        loadQuotation(id, true);
      } else if (action === "delete") {
        deleteQuotation(id);
      } else if (action === "pdf") {
        loadQuotation(id, false);
        generatePDF();
      }
    });
  }

  // Attachments
  if (attachmentInputEl) {
    attachmentInputEl.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []).slice(0, 6);
      const readers = files.map(
        (file) =>
          new Promise((resolve) => {
            const fr = new FileReader();
            fr.onload = () => resolve({ src: fr.result, name: file.name });
            fr.readAsDataURL(file);
          })
      );
      attachments = await Promise.all(readers);
      renderAttachments();
    });
  }
  if (clearAttachmentsBtn) {
    clearAttachmentsBtn.addEventListener("click", () => {
      clearAttachments();
    });
  }
}

/* Items */
let itemIdSeq = 1;
function addItemRow(data) {
  const rowId = `item-${itemIdSeq++}`;
  const wrapper = document.createElement("div");
  wrapper.className = "item-row";
  wrapper.dataset.id = rowId;
  wrapper.innerHTML = `
    <input type="text" class="form-control" placeholder="Nama produk" required data-field="name">
    <input type="number" class="form-control" placeholder="Qty" min="1" value="${data?.qty ?? 1}" required data-field="qty">
    <select class="form-select" data-field="unit">
      <option value="Pcs">Pcs</option>
      <option value="Kg">Kg</option>
      <option value="Meter">Meter</option>
      <option value="Box">Box</option>
    </select>
    <input type="number" class="form-control" placeholder="Harga dasar" min="0" step="0.01" value="${data?.base ?? ""}" required data-field="base">
    <div class="item-actions d-flex gap-1">
      <button type="button" class="btn btn-outline-danger">Hapus</button>
    </div>`;
  itemsListEl.appendChild(wrapper);

  // Prefill nilai dari data tersimpan ke input DOM
  const nameInputEl = wrapper.querySelector('[data-field="name"]');
  if (nameInputEl) nameInputEl.value = data?.name ?? "";
  const unitSelectEl = wrapper.querySelector('[data-field="unit"]');
  if (unitSelectEl) unitSelectEl.value = data?.unit ?? "Pcs";
  const qtyInputEl = wrapper.querySelector('[data-field="qty"]');
  if (qtyInputEl) qtyInputEl.value = String(data?.qty ?? 1);
  const baseInputEl = wrapper.querySelector('[data-field="base"]');
  if (baseInputEl) baseInputEl.value = data?.base ?? "";

  const removeBtn = wrapper.querySelector(".btn-outline-danger");
  removeBtn.addEventListener("click", () => {
    wrapper.remove();
    items = items.filter((it) => it.id !== rowId);
    reindexItems();
    updateAll();
  });

  wrapper.querySelectorAll("input,select").forEach((el) => {
    el.addEventListener("input", () => {
      syncItemsFromDOM();
      updateAll();
    });
    el.addEventListener("change", () => {
      syncItemsFromDOM();
      updateAll();
    });
  });

  // push initial state
  const initial = {
    id: rowId,
    name: data?.name ?? "",
    qty: parseNum(data?.qty ?? 1),
    unit: data?.unit ?? "Pcs",
    base: parseNum(data?.base ?? 0),
  };
  items.push(initial);
  reindexItems();
}

function syncItemsFromDOM() {
  items = Array.from(itemsListEl.querySelectorAll(".item-row")).map((row) => {
    const get = (sel) => row.querySelector(sel);
    return {
      id: row.dataset.id,
      name: get('[data-field="name"]').value.trim(),
      qty: parseNum(get('[data-field="qty"]').value),
      unit: get('[data-field="unit"]').value,
      base: parseNum(get('[data-field="base"]').value),
    };
  });
}

function reindexItems() {
  // not numbering in DOM inputs; numbering for preview only.
}

/* Margin */
function getMarginPercent() {
  const sel = marginSelectEl.value;
  if (sel === "custom") return parseNum(marginCustomEl.value);
  return parseNum(sel);
}

/* Validation */
function validateForm(showErrors = true) {
  let valid = true;

  // Native constraint + custom regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const requiredFields = [customerNameEl, customerAddressEl, customerEmailEl];
  requiredFields.forEach((el) => {
    const raw = el.value ? el.value.trim() : "";
    const isEmpty = !raw;
    let fieldValid = !isEmpty;
    if (el === customerEmailEl) fieldValid = emailRegex.test(raw);

    if (!fieldValid) valid = false;
    if (showErrors) {
      el.classList.toggle("is-invalid", !fieldValid);
    }
  });

  // Items validation
  const rows = itemsListEl.querySelectorAll(".item-row");
  if (rows.length === 0) valid = false;
  rows.forEach((row) => {
    row.querySelectorAll("input[required]").forEach((input) => {
      const ok = !!input.value && (!input.min || Number(input.value) >= Number(input.min));
      if (!ok) valid = false;
      if (showErrors) input.classList.toggle("is-invalid", !ok);
    });
  });

  return valid;
}

/* Update preview */
function updateAll() {
  // Meta
  metaCustomerEl.textContent = `${customerNameEl.value || "-"}${customerAddressEl.value ? " — " + customerAddressEl.value : ""}`;
  metaAttentionEl.textContent = attentionToEl.value || "-";
  metaInvoiceNoEl.textContent = invoiceNumberEl.value || "-";
  metaDateEl.textContent = formatDateDDMMYYYY(invoiceDateEl.value);
  // metaSellerEl.textContent = sellerNameEl.value || 'Koperasi Serasi';
  metaRefNoEl.textContent = refNumberEl.value || "-";
  metaValidUntilEl.textContent = formatDateDDMMYYYY(validUntilEl.value);
  vatPercentEl.textContent = parseNum(vatSelectEl.value);

  // Notes
  const wysiwygHtml = quill ? quill.root.innerHTML : "";
  notesContentEl.innerHTML = wysiwygHtml || (notesEl.value ? escapeHtml(notesEl.value).replace(/\n/g, "<br>") : "");

  // Items preview
  syncItemsFromDOM();
  const marginPct = getMarginPercent();
  previewItemsEl.innerHTML = "";
  let subTotal = 0;
  items.forEach((it, idx) => {
    const salePrice = it.base + it.base * (marginPct / 100);
    const total = salePrice * (it.qty || 0);
    subTotal += total;
    const tr = document.createElement("tr");
    const breakdown = ""; // Hilangkan tampilan "Rp ... + %" di deskripsi
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><div>${escapeHtml(it.name || "")}</div>${breakdown}</td>
      <td>${it.qty || 0}</td>
      <td>${escapeHtml(it.unit || "")}</td>
      <td>${toIDR(salePrice)}</td>
      <td>${toIDR(total)}</td>`;
    previewItemsEl.appendChild(tr);
  });

  const vatPct = parseNum(vatSelectEl.value);
  const vatAmount = subTotal * (vatPct / 100);
  const grand = subTotal + vatAmount;
  sumTotalEl.textContent = toIDR(subTotal);
  sumVatEl.textContent = toIDR(vatAmount);
  sumGrandEl.textContent = toIDR(grand);

  // Render attachments if any
  renderAttachments();
}

function formatDateDDMMYYYY(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function escapeHtml(str) {
  return str.replace(/[&<>\"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function renderAttachments() {
  if (!attachmentsGridEl) return;
  attachmentsGridEl.innerHTML = "";
  attachments.forEach((img, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "attachment-item";

    const el = document.createElement("img");
    el.src = img.src;
    el.alt = img.name || "image";
    el.loading = "eager";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "attachment-remove";
    btn.title = "Hapus gambar";
    btn.setAttribute("aria-label", "Hapus gambar");
    btn.textContent = "×";
    btn.addEventListener("click", () => removeAttachment(idx));

    wrap.appendChild(el);
    wrap.appendChild(btn);
    attachmentsGridEl.appendChild(wrap);
  });
}

function removeAttachment(index) {
  if (index < 0 || index >= attachments.length) return;
  attachments.splice(index, 1);
  renderAttachments();
}

function clearAttachments() {
  attachments = [];
  renderAttachments();
  if (attachmentInputEl) attachmentInputEl.value = ""; // reset input file
}

/* WYSIWYG Lazy Load */
function enableEditorLazy() {
  if (quill) return;
  editorEl.hidden = false;
  // load Quill CDN lazily
  const quillCss = document.createElement("link");
  quillCss.rel = "stylesheet";
  quillCss.href = "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.snow.css";
  document.head.appendChild(quillCss);
  const s = document.createElement("script");
  s.src = "https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.min.js";
  s.onload = () => {
    quill = new Quill("#editor", { theme: "snow", placeholder: "Tulis konten invoice tambahan di sini..." });
    quill.on("text-change", updateAll);
  };
  document.body.appendChild(s);
}

/* Draft (caching) */
function saveDraft() {
  const data = {
    customerName: customerNameEl.value,
    customerAddress: customerAddressEl.value,
    customerEmail: customerEmailEl.value,
    invoiceNumber: invoiceNumberEl.value,
    invoiceDate: invoiceDateEl.value,
    sellerName: sellerNameEl.value,
    refNumber: refNumberEl.value,
    validUntil: validUntilEl.value,
    attentionTo: attentionToEl.value,
    marginSelect: marginSelectEl.value,
    marginCustom: marginCustomEl.value,
    vatSelect: vatSelectEl.value,
    items,
    notes: notesEl.value,
    wysiwyg: quill ? quill.root.innerHTML : null,
  };
  try {
    localStorage.setItem("invoiceDraft", JSON.stringify(data));
    showToast('success', 'Draft disimpan.');
  } catch (e) {
    console.warn(e);
  }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem("invoiceDraft");
    if (!raw) return;
    const d = JSON.parse(raw);
    customerNameEl.value = d.customerName || "";
    customerAddressEl.value = d.customerAddress || "";
    customerEmailEl.value = d.customerEmail || "";
    invoiceNumberEl.value = d.invoiceNumber || invoiceNumberEl.value;
    invoiceDateEl.value = d.invoiceDate || invoiceDateEl.value;
    sellerNameEl.value = d.sellerName || sellerNameEl.value;
    refNumberEl.value = d.refNumber || "";
    validUntilEl.value = d.validUntil || validUntilEl.value;
    attentionToEl.value = d.attentionTo || "";
    marginSelectEl.value = d.marginSelect || marginSelectEl.value;
    marginCustomEl.value = d.marginCustom || "";
    marginCustomEl.disabled = marginSelectEl.value !== "custom";
    vatSelectEl.value = d.vatSelect || vatSelectEl.value;

    // items
    items = [];
    itemsListEl.innerHTML = "";
    (d.items || []).forEach((it) => addItemRow(it));

    // notes
    notesEl.value = d.notes || "";

    // restore WYSIWYG if exist
    if (d.wysiwyg) {
      enableEditorLazy();
      const wait = setInterval(() => {
        if (quill) {
          quill.root.innerHTML = d.wysiwyg;
          clearInterval(wait);
          updateAll();
        }
      }, 100);
    }
  } catch (e) {
    console.warn(e);
  }
}

/* Quotation History */
function getSavedQuotations() {
  try {
    return JSON.parse(localStorage.getItem("quotations") || "[]");
  } catch {
    return [];
  }
}
function setSavedQuotations(list) {
  try {
    localStorage.setItem("quotations", JSON.stringify(list));
  } catch (e) {
    console.warn(e);
    alert("Gagal menyimpan: kapasitas penyimpanan lokal penuh.");
  }
}
function serializeCurrentQuotation() {
  syncItemsFromDOM();
  const marginPct = getMarginPercent();
  let subTotal = 0;
  const itemsSnapshot = items.map((it) => {
    const salePrice = it.base + it.base * (marginPct / 100);
    const total = salePrice * (it.qty || 0);
    subTotal += total;
    return { ...it };
  });
  const vatPct = parseNum(vatSelectEl.value);
  const vatAmount = subTotal * (vatPct / 100);
  const grand = subTotal + vatAmount;

  return {
    invoiceNumber: invoiceNumberEl.value,
    invoiceDate: invoiceDateEl.value,
    sellerName: sellerNameEl.value,
    refNumber: refNumberEl.value,
    validUntil: validUntilEl.value,
    attentionTo: attentionToEl.value,
    customerName: customerNameEl.value,
    customerAddress: customerAddressEl.value,
    customerEmail: customerEmailEl.value,
    marginSelect: marginSelectEl.value,
    marginCustom: marginCustomEl.value,
    vatSelect: vatSelectEl.value,
    items: itemsSnapshot,
    notes: notesEl.value,
    wysiwyg: quill ? quill.root.innerHTML : null,
    totals: { subTotal, vatAmount, grand },
    timestamp: Date.now(),
  };
}
function saveQuotation() {
  const ok = validateForm(true);
  if (!ok) {
    const go = confirm("Beberapa field wajib belum valid/kosong. Simpan penawaran tetap dilanjutkan?");
    if (!go) return;
  }
  // Tampilkan state loading pada tombol simpan
  if (saveQuotationBtn) {
    saveQuotationBtn.disabled = true;
    saveQuotationBtn.dataset.prevText = saveQuotationBtn.textContent;
    saveQuotationBtn.textContent = "Menyimpan...";
  }
  const payload = serializeCurrentQuotation();
  let list = getSavedQuotations();

  if (editingQuotationId) {
    const idx = list.findIndex((q) => q.id === editingQuotationId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...payload };
      list[idx].timestamp = Date.now();
    } else {
      payload.id = editingQuotationId;
      list.push(payload);
    }
    setSavedQuotations(list);
    showToast('success', 'Perubahan penawaran disimpan.');
  } else {
    payload.id = `q-${Date.now()}`;
    list.unshift(payload);
    setSavedQuotations(list);
    showToast('success', 'Penawaran tersimpan.');
  }
  // Render lokal segera agar pengguna melihat hasil langsung
  renderQuotationList();
  // Sync ke Supabase dan refresh list setelah selesai
  showToast('info', 'Sinkronisasi ke cloud...');
  saveQuotationRemote(payload)
    .then(() => showToast('success', 'Sinkronisasi cloud berhasil.'))
    .catch(() => showToast('error', 'Sinkronisasi cloud gagal, data aman di lokal.'))
    .finally(() => {
      renderQuotationList();
      if (saveQuotationBtn) {
        saveQuotationBtn.disabled = false;
        const prev = saveQuotationBtn.dataset.prevText;
        if (prev) {
          saveQuotationBtn.textContent = prev;
          delete saveQuotationBtn.dataset.prevText;
        }
      }
    });
  editingQuotationId = payload.id;
  if (saveQuotationBtn) saveQuotationBtn.textContent = "Simpan Perubahan";
}
async function renderQuotationList() {
  if (!quotationsTableBodyEl) return;
  const remote = await listQuotationsRemote();
  const local = getSavedQuotations();
  let list;
  if (Array.isArray(remote) && remote.length > 0) {
    list = remote;
    // hanya overwrite cache lokal jika cloud ada data
    setSavedQuotations(remote);
  } else {
    list = local;
  }
  const q = (quotationSearchEl?.value || "").toLowerCase().trim();
  if (q) {
    list = list.filter((it) => {
      const tokens = [
        it.customerName || "",
        it.invoiceNumber || "",
        it.refNumber || "",
        formatDateDDMMYYYY(it.invoiceDate || ""),
      ].map((s) => (s || "").toLowerCase());
      return tokens.some((t) => t.includes(q));
    });
  }
  list.sort((a, b) => b.timestamp - a.timestamp);

  quotationsTableBodyEl.innerHTML = "";
  if (list.length === 0) {
    quotationsTableBodyEl.innerHTML = `<tr><td colspan="5" class="text-center text-muted small py-3">Belum ada penawaran tersimpan.</td></tr>`;
    return;
  }
  list.forEach((it) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(it.invoiceNumber || "-")}</td>
      <td>${escapeHtml(it.customerName || "-")}</td>
      <td>${formatDateDDMMYYYY(it.invoiceDate || "")}</td>
      <td class="text-end">${toIDR(it?.totals?.grand || 0)}</td>
      <td class="text-center">
        <div class="btn-group btn-group-sm">
          <button type="button" class="btn btn-outline-primary" data-action="edit" data-id="${it.id}"><i class="bi bi-pencil"></i></button>
          <button type="button" class="btn btn-outline-secondary" data-action="pdf" data-id="${it.id}"><i class="bi bi-file-earmark-pdf"></i></button>
          <button type="button" class="btn btn-outline-danger" data-action="delete" data-id="${it.id}"><i class="bi bi-trash"></i></button>
        </div>
      </td>`;
    quotationsTableBodyEl.appendChild(tr);
  });
}
function applyQuotationToForm(d) {
  customerNameEl.value = d.customerName || "";
  customerAddressEl.value = d.customerAddress || "";
  customerEmailEl.value = d.customerEmail || "";
  invoiceNumberEl.value = d.invoiceNumber || invoiceNumberEl.value;
  invoiceDateEl.value = d.invoiceDate || invoiceDateEl.value;
  sellerNameEl.value = d.sellerName || sellerNameEl.value;
  refNumberEl.value = d.refNumber || "";
  validUntilEl.value = d.validUntil || validUntilEl.value;
  attentionToEl.value = d.attentionTo || "";
  marginSelectEl.value = d.marginSelect || marginSelectEl.value;
  marginCustomEl.value = d.marginCustom || "";
  marginCustomEl.disabled = marginSelectEl.value !== "custom";
  vatSelectEl.value = d.vatSelect || vatSelectEl.value;

  // items
  items = [];
  itemsListEl.innerHTML = "";
  (d.items || []).forEach((it) => addItemRow(it));

  // notes
  notesEl.value = d.notes || "";

  if (d.wysiwyg) {
    enableEditorLazy();
    const wait = setInterval(() => {
      if (quill) {
        quill.root.innerHTML = d.wysiwyg;
        clearInterval(wait);
        updateAll();
      }
    }, 100);
  } else {
    updateAll();
  }
}
function loadQuotation(id, asEdit = false) {
  const list = getSavedQuotations();
  const found = list.find((q) => q.id === id);
  if (!found) return;
  applyQuotationToForm(found);
  editingQuotationId = asEdit ? id : null;
  if (saveQuotationBtn) {
    saveQuotationBtn.textContent = asEdit ? "Simpan Perubahan" : "Simpan Penawaran";
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function deleteQuotation(id) {
  let list = getSavedQuotations();
  const found = list.find((q) => q.id === id);
  if (!found) return;
  const ok = confirm(`Hapus penawaran "${found.invoiceNumber || id}"?`);
  if (!ok) return;
  list = list.filter((q) => q.id !== id);
  setSavedQuotations(list);
  showToast('success', 'Penawaran dihapus.');
  if (editingQuotationId === id) {
    editingQuotationId = null;
    if (saveQuotationBtn) saveQuotationBtn.textContent = "Simpan Penawaran";
  }
  deleteQuotationRemote(id)
    .then(() => showToast('success', 'Cloud diperbarui.'))
    .catch(() => showToast('error', 'Gagal menghapus di cloud.'))
    .finally(() => {
      renderQuotationList();
    });
}

/* PDF Generation */
async function generatePDF() {
  const ok = validateForm(true);
  if (!ok) {
    const go = confirm("Beberapa field wajib belum valid/kosong. Tetap lanjut generate PDF?");
    if (!go) return;
  }
  updateAll();

  // Pastikan semua gambar di area preview sudah selesai dimuat
  await ensureImagesLoaded(invoicePreviewEl);

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");

  // Convert preview to canvas, then add to PDF with pagination
  // Paksa lebar A4 (sekitar 794px @96DPI) saat proses capture agar konsisten di mobile
  const A4_WIDTH_PX = Math.round((210 / 25.4) * 96); // 210mm -> px
  const A4_HEIGHT_PX = Math.round((297 / 25.4) * 96); // 297mm -> px
  const canvas = await html2canvas(invoicePreviewEl, {
    scale: 1.5, // lebih ringan agar tidak blank
    useCORS: true,
    imageTimeout: 10000,
    backgroundColor: "#ffffff",
    // gunakan renderer default untuk stabilitas; FO kadang menghasilkan canvas kosong
    // foreignObjectRendering: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: A4_WIDTH_PX + 40,
    windowHeight: A4_HEIGHT_PX + 120,
    onclone: (docClone) => {
      const el = docClone.querySelector("#invoicePreview");
      if (el) {
        el.style.width = A4_WIDTH_PX + "px";
        el.style.minHeight = A4_HEIGHT_PX + "px";
        el.style.display = "flex";
        el.style.flexDirection = "column";
      }
      // Perbaiki rendering Grid di clone: ubah grid lampiran menjadi flex agar stabil di html2canvas
      const grid = docClone.querySelector("#attachmentsGrid");
      if (grid) {
        grid.style.display = "flex";
        grid.style.flexWrap = "wrap";
        grid.style.gap = "12px";
        const items = Array.from(grid.querySelectorAll(".attachment-item"));
        items.forEach((item) => {
          item.style.width = "calc(33.333% - 8px)"; // 3 kolom
          item.style.aspectRatio = "3 / 4"; // jaga proporsi kotak
          item.style.display = "flex";
          item.style.alignItems = "center";
          item.style.justifyContent = "center";
          item.style.breakInside = "avoid";
          item.style.pageBreakInside = "avoid";
        });
        const imgs = Array.from(grid.querySelectorAll("img"));
        imgs.forEach((img) => {
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "contain"; // tidak distorsi
          img.style.transform = "none";
          img.style.breakInside = "avoid";
          img.style.pageBreakInside = "avoid";
        });
        const removes = Array.from(grid.querySelectorAll(".attachment-remove"));
        removes.forEach((btn) => (btn.style.display = "none"));
      }
    },
  });
  // Gunakan JPEG agar ukuran lebih kecil dan lebih stabil di jsPDF; fallback ke PNG jika gagal
  let imgData;
  let imgFormat = "JPEG";
  try {
    imgData = canvas.toDataURL("image/jpeg", 0.92);
  } catch (e) {
    console.warn("JPEG toDataURL gagal, fallback ke PNG", e);
    imgData = canvas.toDataURL("image/png");
    imgFormat = "PNG";
  }
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Calculate image dimensions to fit width
  const imgWidth = pageWidth - 20; // margin
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const margin = 10; // top/bottom margin in mm
  let yOffset = 0; // how much of the image height has been placed
  try {
    pdf.addImage(imgData, imgFormat, margin, margin, imgWidth, imgHeight);
  } catch (e) {
    console.warn("addImage gagal, coba fallback PNG", e);
    const png = canvas.toDataURL("image/png");
    pdf.addImage(png, "PNG", margin, margin, imgWidth, imgHeight);
    imgData = png;
    imgFormat = "PNG";
  }
  yOffset += pageHeight - margin * 2;

  while (yOffset < imgHeight) {
    pdf.addPage();
    pdf.addImage(imgData, imgFormat, margin, margin - yOffset, imgWidth, imgHeight);
    yOffset += pageHeight - margin * 2;
  }

  // Header & footer (simple consistent)
  addHeaderFooter(pdf);

  // Pastikan metadata PDF tidak menampilkan 'Koperasi Serasi' sebagai judul viewer
  pdf.setProperties({
    title: invoiceNumberEl.value ? `Quotation ${invoiceNumberEl.value}` : "Quotation",
    subject: "",
    author: "",
    keywords: "",
    creator: "",
  });

  pdf.save(`${invoiceNumberEl.value || "invoice"}.pdf`);
}

// Utility: wait until all images inside an element are loaded
function ensureImagesLoaded(root) {
  const imgs = Array.from(root.querySelectorAll("img"));
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
}

function addHeaderFooter(pdf) {
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(30);
    pdf.text(`Halaman ${i}/${pageCount}`, pdf.internal.pageSize.getWidth() - 40, pdf.internal.pageSize.getHeight() - 7);
  }
}

/* Start */
function initStart() {
  init();
  renderQuotationList();
}
initStart();
