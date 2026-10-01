// =====================================================================
// 첨부 파일에서 검사할 텍스트를 뽑아내는 함수들
// - 텍스트 파일: 그대로 읽기
// - 오피스 문서(docx/xlsx/pptx/hwpx/odt/ods/odp): zip 안의 XML을 브라우저 내장
//   DecompressionStream으로 풀어서 텍스트만 추출 (외부 라이브러리 없음)
// - PDF: 동봉한 Mozilla pdf.js로 텍스트 추출
// 모든 처리는 브라우저 안에서만 이뤄집니다.
// =====================================================================

const SG_LIMITS = {
  textBytes: 5 * 1024 * 1024,     // 텍스트 파일 최대 크기
  docBytes: 25 * 1024 * 1024,     // 오피스/PDF 파일 최대 크기
  xmlBytes: 30 * 1024 * 1024,     // 압축 해제 후 XML 총량 상한 (zip 폭탄 방지)
  pdfPages: 60                    // PDF 최대 검사 페이지
};

const SG_TEXT_EXT = /\.(txt|text|csv|tsv|log|json|jsonl|ya?ml|env|ini|conf|cfg|properties|xml|md|sql|sh|bash|zsh|ps1|bat|cmd|py|js|mjs|ts|jsx|tsx|java|kt|scala|go|rb|php|cs|c|cc|cpp|h|hpp|rs|swift|tf|tfvars|hcl|pem|key|crt|cer|pub|ppk|toml|gradle|html|htm|css|vue|svelte|ipynb)$/i;
const SG_TEXT_NAME = /^(\.env.*|dockerfile|makefile|jenkinsfile|id_rsa|id_dsa|id_ecdsa|id_ed25519|credentials|config|\.npmrc|\.pypirc|\.netrc|\.pgpass|kubeconfig)$/i;
const SG_OFFICE_EXT = /\.(docx|docm|dotx|xlsx|xlsm|xltx|pptx|pptm|potx|hwpx|odt|ods|odp)$/i;
const SG_PDF_EXT = /\.pdf$/i;

// 파일 종류 판별: "text" | "office" | "pdf" | null(검사 안 함)
function sgFileKind(f) {
  const name = f.name || "";
  if (SG_PDF_EXT.test(name) || f.type === "application/pdf") return "pdf";
  if (SG_OFFICE_EXT.test(name)) return "office";
  if ((f.type && f.type.startsWith("text/")) || f.type === "application/json" ||
      SG_TEXT_EXT.test(name) || SG_TEXT_NAME.test(name)) return "text";
  return null;
}

function sgScannable(f) {
  const kind = sgFileKind(f);
  if (!kind) return false;
  return f.size <= (kind === "text" ? SG_LIMITS.textBytes : SG_LIMITS.docBytes);
}

async function sgExtractText(f) {
  switch (sgFileKind(f)) {
    case "text":   return await f.text();
    case "office": return await sgExtractOffice(await f.arrayBuffer());
    case "pdf":    return await sgExtractPdf(await f.arrayBuffer());
    default:       return "";
  }
}

// ---------------------------------------------------------------------
// 오피스 문서 (zip + XML)
// ---------------------------------------------------------------------

// 텍스트가 들어 있는 XML만 골라서 압축 해제 (이미지, 스타일, 테마 등은 건너뜀)
const SG_OFFICE_PARTS = new RegExp([
  "^word/(document|header\\d*|footer\\d*|footnotes|endnotes|comments)\\.xml$",
  "^xl/sharedStrings\\.xml$",
  "^xl/worksheets/sheet\\d+\\.xml$",
  "^xl/comments\\d*\\.xml$",
  "^ppt/(slides/slide|notesSlides/notesSlide|comments/comment)\\d+\\.xml$",
  "^Contents/section\\d+\\.xml$",               // hwpx
  "^content\\.xml$"                              // odt/ods/odp
].join("|"));

async function sgExtractOffice(buf) {
  const entries = sgZipEntries(buf).filter((e) => SG_OFFICE_PARTS.test(e.name));
  const parts = [];
  let total = 0;
  for (const e of entries) {
    if (total + e.size > SG_LIMITS.xmlBytes) break;
    total += e.size;
    const xml = await sgZipRead(buf, e);
    if (xml) parts.push(sgXmlToText(xml));
  }
  return parts.join("\n");
}

// zip 중앙 디렉터리를 읽어 파일 목록을 만듦
function sgZipEntries(buf) {
  const v = new DataView(buf);
  const len = buf.byteLength;
  let eocd = -1;
  for (let i = len - 22; i >= Math.max(0, len - 22 - 65535); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return [];
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = [];
  for (let n = 0; n < count && p + 46 <= len; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const size = v.getUint32(p + 24, true);
    const nlen = v.getUint16(p + 28, true);
    const xlen = v.getUint16(p + 30, true);
    const clen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nlen));
    out.push({ name, method, csize, size, local });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

async function sgZipRead(buf, e) {
  const v = new DataView(buf);
  if (e.local + 30 > buf.byteLength || v.getUint32(e.local, true) !== 0x04034b50) return "";
  const start = e.local + 30 + v.getUint16(e.local + 26, true) + v.getUint16(e.local + 28, true);
  const data = new Uint8Array(buf, start, Math.min(e.csize, buf.byteLength - start));
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) return "";
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

// XML 태그를 걷어내고 텍스트만 남김.
// 워드는 한 단어가 여러 조각(run)으로 쪼개져 저장되므로, 문단/셀 경계에서만 줄을 나누고
// 나머지 태그는 공백 없이 지워서 "900101-" + "1234567" 같은 조각이 다시 붙도록 함
function sgXmlToText(xml) {
  return xml
    .replace(/<\/(w:p|a:p|hp:p|text:p|text:h|si|row|w:tr)>/g, "\n")
    .replace(/<(w:tab|w:br|a:br|hp:lineBreak|text:tab|text:line-break)\b[^>]*\/>/g, " ")
    .replace(/<\/(c|w:tc|table:table-cell)>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

// ---------------------------------------------------------------------
// PDF (Mozilla pdf.js, vendor/ 폴더에 동봉)
// ---------------------------------------------------------------------
let sgPdfjs = null;

async function sgLoadPdfjs() {
  if (sgPdfjs) return sgPdfjs;
  const base = chrome.runtime.getURL("vendor/");
  // 워커 스레드 대신 같은 스레드에서 돌림 (사이트 CSP와 충돌 방지)
  globalThis.pdfjsWorker = await import(base + "pdf.worker.min.mjs");
  sgPdfjs = await import(base + "pdf.min.mjs");
  sgPdfjs.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.mjs";
  return sgPdfjs;
}

async function sgExtractPdf(buf) {
  const pdfjs = await sgLoadPdfjs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    cMapUrl: chrome.runtime.getURL("vendor/cmaps/"),
    cMapPacked: true,
    standardFontDataUrl: chrome.runtime.getURL("vendor/standard_fonts/")
  }).promise;
  const out = [];
  try {
    const pages = Math.min(doc.numPages, SG_LIMITS.pdfPages);
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const items = tc.items.map((it) => it.str || "");
      // 조각을 붙인 버전과 띄운 버전 둘 다 검사 ("900101" "-" "1234567"처럼 쪼개진 경우 대비)
      out.push(items.join(""), items.join(" "));
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return out.join("\n");
}
