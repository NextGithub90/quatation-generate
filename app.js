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

/* State */
let quill = null; // WYSIWYG instance
let items = []; // {id, name, qty, unit, base}
let attachments = []; // [{src,name}]

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
  form.addEventListener("reset", () => {
    setTimeout(() => {
      items = [];
      itemsListEl.innerHTML = "";
      addItemRow();
      updateAll();
    }, 0);
  });
  loadEditorBtn.addEventListener("click", enableEditorLazy);

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
  attachments.forEach((img) => {
    const el = document.createElement("img");
    el.src = img.src;
    el.alt = img.name || "image";
    el.loading = "eager";
    attachmentsGridEl.appendChild(el);
  });
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
    alert("Draft disimpan.");
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
        const imgs = Array.from(grid.querySelectorAll("img"));
        imgs.forEach((img) => {
          img.style.width = "calc(33.333% - 8px)"; // 3 kolom kira-kira
          img.style.height = "140px";
          img.style.objectFit = "contain";
          img.style.transform = "none";
          img.style.breakInside = "avoid";
          img.style.pageBreakInside = "avoid";
        });
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
init();
