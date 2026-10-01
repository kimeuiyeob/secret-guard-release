(() => {
  // =====================================================================
  // Secret Guard for AI Chat
  // 모든 검사는 브라우저 안에서만 이뤄지며, 어떤 데이터도 외부로 전송하지 않습니다.
  // All checks run locally in the browser. Nothing is ever sent anywhere.
  // =====================================================================

  const ALLOW_MS = 15000;                 // "이번만 허용" 유지 시간
  // 파일 종류 판별·크기 제한·텍스트 추출은 extractors.js 참고

  // ---------------- 메시지 (한/영) ----------------
  const KO = (navigator.language || "").toLowerCase().startsWith("ko");
  const T = KO ? {
    blocked: (what, where) => `${where}민감 정보가 감지돼 전송을 막았습니다: ${what}`,
    inFile: (name) => `첨부 파일 "${name}"에서 `,
    allow: "이번만 허용",
    allowed: `${ALLOW_MS / 1000}초 동안 허용됩니다. 다시 시도하세요.`,
    close: "닫기"
  } : {
    blocked: (what, where) => `${where}Looks like ${what}. Sending was blocked.`,
    inFile: (name) => `Attached file "${name}": `,
    allow: "Allow once",
    allowed: `Allowed for ${ALLOW_MS / 1000} seconds. Try again.`,
    close: "Close"
  };

  // ---------------- 허용 상태 ----------------
  let allowUntil = 0;
  const isAllowed = () => Date.now() < allowUntil;

  // =====================================================================
  // 입력창 텍스트 수집
  // =====================================================================
  function editableRoot(el) {
    if (!el) return null;
    if (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.type === "text")) return el;
    if (el.isContentEditable) {
      let root = el;
      while (root.parentElement && root.parentElement.isContentEditable) root = root.parentElement;
      return root;
    }
    return null;
  }

  function textOf(el) {
    if (!el) return "";
    return (el.tagName === "TEXTAREA" || el.tagName === "INPUT") ? el.value : (el.innerText || el.textContent || "");
  }

  // 전송 버튼 클릭 시엔 포커스가 버튼으로 가 있으므로 페이지의 모든 입력창을 검사
  function allComposerText() {
    const els = document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""]');
    return Array.from(els).map(textOf).join("\n");
  }

  // =====================================================================
  // 알림 (Shadow DOM으로 사이트 CSS와 격리)
  // =====================================================================
  let toastTimer = null;

  function showToast(hits, fileName) {
    document.getElementById("secret-guard-host")?.remove();
    clearTimeout(toastTimer);

    const host = document.createElement("div");
    host.id = "secret-guard-host";
    host.style.cssText = "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        .box { display:flex; align-items:center; gap:12px; background:#b42318; color:#fff;
               padding:12px 14px 12px 18px; border-radius:10px; max-width:min(640px, 90vw);
               font:14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
               box-shadow:0 6px 24px rgba(0,0,0,.35); }
        .msg { flex:1; }
        button { font:inherit; font-size:13px; border-radius:6px; cursor:pointer; padding:6px 10px;
                 white-space:nowrap; }
        .allow { background:#fff; color:#b42318; border:0; font-weight:600; }
        .close { background:transparent; color:#fff; border:1px solid rgba(255,255,255,.6); }
        .ok { background:#067647; }
      </style>
      <div class="box" role="alert">
        <span class="msg"></span>
        <button type="button" class="allow"></button>
        <button type="button" class="close"></button>
      </div>`;

    const box = root.querySelector(".box");
    const msg = root.querySelector(".msg");
    const allowBtn = root.querySelector(".allow");
    const closeBtn = root.querySelector(".close");

    msg.textContent = "🔒 " + T.blocked(hits.join(", "), fileName ? T.inFile(fileName) : "");
    allowBtn.textContent = T.allow;
    closeBtn.textContent = T.close;

    // 사이트의 캡처 리스너가 우리 버튼 클릭을 가로채지 않도록 shadow 안에서 처리
    allowBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      allowUntil = Date.now() + ALLOW_MS;
      box.classList.add("ok");
      msg.textContent = "✅ " + T.allowed;
      allowBtn.remove();
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => host.remove(), 4000);
    });
    closeBtn.addEventListener("click", (e) => { e.stopPropagation(); host.remove(); });

    (document.body || document.documentElement).appendChild(host);
    toastTimer = setTimeout(() => host.remove(), 10000);
  }

  // 안내용 배너 (초록색, 허용 버튼 없음)
  function showInfo(text) {
    showToast([], null);
    const root = document.getElementById("secret-guard-host")?.shadowRoot;
    if (!root) return;
    root.querySelector(".box").classList.add("ok");
    root.querySelector(".msg").textContent = text;
    root.querySelector(".allow")?.remove();
  }

  function stop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function block(e, hits) {
    stop(e);
    showToast(hits);
  }

  const fromOurToast = (e) => e.composedPath?.().some((n) => n?.id === "secret-guard-host");

  // =====================================================================
  // 파일 검사
  // =====================================================================
  function scannable(files) {
    return files.filter(sgScannable);
  }

  // 처음 걸린 파일의 이름과 탐지 결과를 반환. 모두 깨끗하면 null
  async function scanFiles(files) {
    for (const f of scannable(files)) {
      try {
        const hits = detectSecrets(await sgExtractText(f));
        if (hits.length) return { hits, fileName: f.name };
      } catch (err) {
        // 손상된 파일, 암호 걸린 PDF 등은 검사하지 못하고 통과시킴
        console.warn("[Secret Guard] could not scan", f.name, err);
      }
    }
    return null;
  }

  // 검사 통과 후 사이트에 다시 넘겨주는 이벤트엔 표시를 달아 재검사하지 않음
  const PASSED = "__secretGuardPassed";

  function cloneTransfer(files) {
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);
    return dt;
  }

  function fire(target, ev) {
    ev[PASSED] = true;
    target.dispatchEvent(ev);
  }

  // ---------- 검사 통과한 파일을 사이트에 넘기기 ----------
  // 실제 사이트(claude.ai 등)는 스크립트로 만든 drop/paste 이벤트를 받아주지 않는 경우가 많음.
  // 그래서 사이트의 파일 선택 입력칸(📎 버튼 뒤 input[type=file])에 파일을 넣고
  // input/change 이벤트를 보내는 방식을 씀. 자동화 도구들이 실제 사이트에 파일을 올리는 방식과 같음.
  function acceptsFile(input, f) {
    const accept = (input.getAttribute("accept") || "").trim();
    if (!accept) return true;
    const name = f.name.toLowerCase(), type = (f.type || "").toLowerCase();
    return accept.split(",").map((s) => s.trim().toLowerCase()).some((a) =>
      a.startsWith(".") ? name.endsWith(a) :
      a.endsWith("/*") ? type.startsWith(a.slice(0, -1)) :
      a === type);
  }

  function depthOfCommonAncestor(a, b) {
    if (!a || !b) return 0;
    const chain = new Set();
    for (let n = a; n; n = n.parentNode) chain.add(n);
    let d = 0, n = b;
    while (n && !chain.has(n)) n = n.parentNode;
    for (; n; n = n.parentNode) d++;
    return d;
  }

  function findFileInput(files, near) {
    const inputs = Array.from(document.querySelectorAll('input[type="file"]')).filter((i) => !i.disabled);
    let best = null, bestScore = -1;
    for (const input of inputs) {
      const fits = files.filter((f) => acceptsFile(input, f)).length;
      if (!fits) continue;
      const score = fits * 1000 +
        (files.length > 1 && input.multiple ? 500 : 0) +
        depthOfCommonAncestor(input, near);
      if (score > bestScore) { best = input; bestScore = score; }
    }
    return best;
  }

  function injectFiles(files, near, fallback) {
    const input = findFileInput(files, near);
    if (!input) {
      // 파일 입력칸을 못 찾으면 드롭 이벤트로 시도하고, 안 될 수도 있으니 안내를 띄움
      showInfo(KO ? "✅ 검사를 통과했습니다. 파일이 첨부되지 않았다면 📎 버튼으로 첨부해 주세요."
                  : "✅ Scan passed. If the file was not attached, please use the 📎 button.");
      return fallback();
    }
    const usable = input.multiple ? files : files.slice(0, 1);
    try {
      input.files = cloneTransfer(usable.filter((f) => acceptsFile(input, f))).files;
    } catch (_) {
      return fallback();
    }
    fire(input, new Event("input", { bubbles: true, composed: true }));
    fire(input, new Event("change", { bubbles: true, composed: true }));
  }

  // ---------- 파일 드래그는 확장이 직접 받음 ----------
  // 사이트에 드래그를 보여준 뒤 드롭만 막으면, 사이트는 드래그가 끝난 걸 몰라서
  // "파일을 여기에 놓으세요" 화면이 남음. 그래서 검사 대상이 될 수 있는 파일 드래그는
  // 들어오는 순간부터 사이트에 안 보여주고, 확장이 받아서 검사한 뒤 📎 입력칸으로 넣어줌.
  // 이미지만 끌어오는 경우는 검사 대상이 아니라 원래대로 사이트가 처리.
  function isGuardedDrag(dt) {
    if (!dt || !Array.from(dt.types || []).includes("Files")) return false;
    const items = Array.from(dt.items || []).filter((i) => i.kind === "file");
    if (!items.length) return true;
    return items.some((i) => !(i.type || "").startsWith("image/"));
  }

  let hintHost = null, hintTimer = null;
  function showDragHint() {
    clearTimeout(hintTimer);
    // dragover는 드래그 중 계속 발생 → 끊기면 드래그가 끝났거나 창 밖으로 나간 것
    hintTimer = setTimeout(hideDragHint, 250);
    if (hintHost?.isConnected) return;
    hintHost = document.createElement("div");
    hintHost.id = "secret-guard-drag-hint";
    hintHost.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;";
    const root = hintHost.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        .wrap { position:absolute; inset:8px; border:2px dashed rgba(79,70,229,.8); border-radius:14px;
                background:rgba(79,70,229,.08); display:flex; align-items:center; justify-content:center; }
        .msg { background:#4f46e5; color:#fff; padding:10px 16px; border-radius:10px;
               font:14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow:0 6px 24px rgba(0,0,0,.3); }
      </style>
      <div class="wrap"><div class="msg"></div></div>`;
    root.querySelector(".msg").textContent = KO ? "🔒 Secret Guard가 검사한 뒤 첨부합니다" : "🔒 Secret Guard will scan before attaching";
    (document.body || document.documentElement).appendChild(hintHost);
  }
  function hideDragHint() {
    clearTimeout(hintTimer);
    hintHost?.remove();
    hintHost = null;
  }

  for (const type of ["dragenter", "dragover", "dragleave"]) {
    window.addEventListener(type, (e) => {
      if (e[PASSED] || isAllowed() || !isGuardedDrag(e.dataTransfer)) return;
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (type !== "dragleave") {
        e.preventDefault();                      // 이걸 해야 드롭이 허용됨 (안 하면 브라우저가 파일을 새 탭으로 엶)
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        showDragHint();
      }
    }, true);
  }

  // ---------- 파일 선택창 (input type=file) ----------
  for (const type of ["input", "change"]) {
    window.addEventListener(type, (e) => {
      const input = e.target;
      if (e[PASSED] || isAllowed()) return;
      if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
      const files = Array.from(input.files || []);
      if (!scannable(files).length) return;

      // 검사가 끝날 때까지 사이트가 파일을 받지 못하게 먼저 멈춤
      e.stopPropagation();
      e.stopImmediatePropagation();

      scanFiles(files).then((res) => {
        if (res) {
          input.value = "";
          showToast(res.hits, res.fileName);
        } else {
          fire(input, new Event(type, { bubbles: true, composed: true }));
        }
      });
    }, true);
  }

  // =====================================================================
  // 1) 붙여넣기 (텍스트 + 파일)
  // =====================================================================
  window.addEventListener("paste", (e) => {
    if (e[PASSED] || isAllowed()) return;
    const hits = detectSecrets(e.clipboardData?.getData("text") || "");
    if (hits.length) return block(e, hits);

    const files = Array.from(e.clipboardData?.files || []);
    if (!scannable(files).length) return;
    const target = e.target;
    stop(e);
    scanFiles(files).then((res) => {
      if (res) return showToast(res.hits, res.fileName);
      injectFiles(files, target, () =>
        fire(target, new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: cloneTransfer(files) })));
    });
  }, true);

  // =====================================================================
  // 2) 드래그 앤 드롭 (텍스트 + 파일)
  // =====================================================================
  window.addEventListener("drop", (e) => {
    if (e[PASSED] || isAllowed()) return;
    const target = e.target;

    // 텍스트를 끌어다 놓는 경우
    const hits = detectSecrets(e.dataTransfer?.getData("text") || "");
    if (hits.length) {
      hideDragHint();
      return block(e, hits);
    }

    // 파일: 드래그 단계부터 확장이 받아온 경우만 처리 (이미지만 있으면 사이트가 처리)
    if (!isGuardedDrag(e.dataTransfer)) return;
    stop(e);
    hideDragHint();
    const files = Array.from(e.dataTransfer.files || []);
    const deliver = () => injectFiles(files, target, () =>
      fire(target, new DragEvent("drop", { bubbles: true, cancelable: true, composed: true, dataTransfer: cloneTransfer(files) })));
    if (!scannable(files).length) return deliver();     // zip, 동영상 등 검사 대상 아님 → 그대로 첨부
    scanFiles(files).then((res) => {
      if (res) return showToast(res.hits, res.fileName);
      deliver();
    });
  }, true);

  // =====================================================================
  // 3) Enter 전송 (직접 타이핑한 경우)
  // =====================================================================
  window.addEventListener("keydown", (e) => {
    if (isAllowed() || e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    const root = editableRoot(e.target);
    if (!root) return;
    const hits = detectSecrets(textOf(root));
    if (hits.length) block(e, hits);
  }, true);

  // =====================================================================
  // 4) 전송 버튼 클릭
  // =====================================================================
  const SEND_LABEL = /send|submit|전송|보내기/i;
  function isSendButton(el) {
    const btn = el?.closest?.("button");
    if (!btn) return false;
    const label = [btn.getAttribute("aria-label"), btn.getAttribute("data-testid"), btn.title, btn.getAttribute("type")]
      .filter(Boolean).join(" ");
    return SEND_LABEL.test(label);
  }
  for (const type of ["pointerdown", "mousedown", "click"]) {
    window.addEventListener(type, (e) => {
      if (isAllowed() || fromOurToast(e) || !isSendButton(e.target)) return;
      const hits = detectSecrets(allComposerText());
      if (hits.length) block(e, hits);
    }, true);
  }

  // =====================================================================
  // 5) form submit (일부 사이트)
  // =====================================================================
  window.addEventListener("submit", (e) => {
    if (isAllowed()) return;
    const hits = detectSecrets(allComposerText());
    if (hits.length) block(e, hits);
  }, true);
})();
