# 크롬 웹스토어 등록용 문구

개발자 대시보드(https://chrome.google.com/webstore/devconsole)에 그대로 붙여넣으면 됩니다.
작성자: 김의엽 (Kim Eui Yeob) · rladmlduq47@gmail.com

---

## 1. 스토어 등록정보 (Store listing)

**이름**: Secret Guard for AI Chat

**요약 (132자 이내)**
- 한국어: AI 채팅에 API 키·비밀번호·주민번호가 전송되기 전에 막아줍니다. 모든 검사는 브라우저 안에서만 동작합니다.
- English: Blocks API keys, passwords and personal data before they reach AI chats. Runs 100% locally, collects nothing.

**카테고리**: Privacy & Security (목록에 없으면 Tools)

**언어**: 한국어 (영어 설명은 영어 로케일로 추가)

### 상세 설명 (한국어)

```
ChatGPT, Claude, Gemini에 로그나 설정 파일을 붙여넣다가 AWS 키나 DB 비밀번호까지 같이 보내버린 적 있나요?

Secret Guard는 AI 채팅에 민감한 값이 전송되는 순간을 잡아서 막아줍니다.

■ 막아주는 경로
• 붙여넣기 (Ctrl+V)
• 직접 입력 후 Enter
• 전송 버튼 클릭
• 드래그 앤 드롭
• 파일 첨부: 엑셀, 워드, 파워포인트, PDF, 한글(hwpx), 텍스트·설정·소스코드 파일

■ 탐지 항목 (60여 종)
• 클라우드 키: AWS, Alibaba Cloud, GCP, Azure, Tencent, DigitalOcean
• 개인키: RSA, OpenSSH, PGP, PuTTY, kubeconfig
• 개발 도구 토큰: GitHub, GitLab, npm, PyPI, Docker Hub, Vault, Terraform
• SaaS API 키: OpenAI, Anthropic, Stripe, Slack, Hugging Face 등
• 접속 정보: JWT, Bearer 토큰, DB 접속 문자열, password=... 할당
• 한국 개인정보: 주민/외국인등록번호, 휴대폰, 운전면허, 여권, 사업자번호, 카드번호

■ 오탐일 땐
경고창의 "이번만 허용"을 누르면 15초 동안 검사를 건너뜁니다.

■ 개인정보 걱정 없음
모든 검사는 브라우저 안에서만 이뤄집니다. 어떤 데이터도 수집·저장·전송하지 않으며, 네트워크 요청 코드 자체가 없습니다. 소스 코드는 GitHub에 공개되어 있습니다.

■ 지원 사이트
claude.ai, ChatGPT, Gemini, Microsoft Copilot, Microsoft 365 Copilot, DeepSeek, Perplexity, Mistral Le Chat, Grok, 뤼튼

※ 실수 방지용 도구입니다. 값을 변형해서 입력하거나, 이미지·스캔 PDF·구버전 hwp/doc/xls 파일, 데스크톱 앱은 검사하지 않습니다.

소스 코드: https://github.com/kimeuiyeob/secret-guard-release
```

### Detailed description (English)

```
Ever pasted a log or config file into ChatGPT, Claude or Gemini and realized it had your AWS key or database password in it?

Secret Guard catches sensitive values right before they are sent to an AI chat.

■ What it intercepts
• Paste (Ctrl+V)
• Typing then pressing Enter
• Clicking the send button
• Drag & drop
• File attachments: Excel, Word, PowerPoint, PDF, HWPX, plus text, config and source files

■ What it detects (60+ types)
• Cloud keys: AWS, GCP, Azure, Alibaba Cloud, Tencent, DigitalOcean
• Private keys: RSA, OpenSSH, PGP, PuTTY, kubeconfig
• Dev tokens: GitHub, GitLab, npm, PyPI, Docker Hub, Vault, Terraform
• SaaS API keys: OpenAI, Anthropic, Stripe, Slack, Hugging Face and more
• Credentials: JWTs, Bearer tokens, DB connection strings, password=... assignments
• Personal data: credit card numbers (Luhn-checked), Korean national ID numbers

■ False positive?
Click "Allow once" to skip checks for 15 seconds.

■ Private by design
Everything runs inside your browser. Nothing is collected, stored or transmitted — the extension contains no network code at all. Fully open source.

■ Supported sites
claude.ai, ChatGPT, Gemini, Microsoft Copilot, Microsoft 365 Copilot, DeepSeek, Perplexity, Mistral Le Chat, Grok, Wrtn

Note: this is a guard rail against mistakes. Obfuscated values, images, scanned PDFs, legacy .doc/.xls files and desktop apps are not covered.

Source: https://github.com/kimeuiyeob/secret-guard-release
```

### 이미지
| 항목 | 파일 | 필수 |
|---|---|---|
| 스토어 아이콘 128×128 | `extension/icons/icon128.png` | 필수 |
| 스크린샷 1280×800 | 직접 캡처 (아래 참고) | 최소 1장 필수 |
| 작은 프로모 타일 440×280 | `store-assets/promo-small-440x280.png` | 권장 |
| 마키 프로모 타일 1400×560 | `store-assets/promo-marquee-1400x560.png` | 선택 |

**스크린샷 찍는 법**: 브라우저 창 크기를 1280×800 근처로 맞추고 claude.ai에서 `AKIAIOSFODNN7EXAMPLE`를 붙여넣어 빨간 차단 배너가 뜬 화면을 캡처. "이번만 허용" 누른 초록 배너 화면도 한 장 더 있으면 좋습니다.

---

## 2. 개인정보 보호 관행 (Privacy practices)

### 단일 목적 (Single purpose)
```
Prevents users from accidentally sending API keys, passwords, private keys and personal data to AI chat websites by checking input locally before it is sent.
```

### 권한 사용 이유 (Permission justification)

**호스트 권한 (content script가 도는 사이트들)**
```
The content script runs only on the listed AI chat websites. It inspects text the user pastes, types, drops or attaches on those pages, entirely within the browser, and blocks the action if a secret pattern is found. No data leaves the browser.
```

(이 버전은 `storage`, `tabs`, `scripting` 등 다른 권한을 쓰지 않습니다.)

**web_accessible_resources (vendor/*)** — 심사에서 물어보면:
```
The bundled Mozilla pdf.js library (vendor/) is loaded by the content script via dynamic import to extract text from PDF attachments locally. It is only exposed to the same AI chat sites the content script runs on.
```

### 원격 코드 (Remote code)
**아니요, 원격 코드를 사용하지 않습니다** 선택.
(PDF 검사용 pdf.js는 확장 안 `vendor/` 폴더에 동봉돼 있고 외부에서 받아오지 않으므로 원격 코드가 아닙니다)

### 데이터 사용 (Data usage)
수집하는 데이터 항목: **모두 체크하지 않음**
(개인 식별 정보, 건강, 금융, 인증 정보, 개인 통신, 위치, 웹 기록, 사용자 활동, 웹사이트 콘텐츠 → 전부 미체크. 웹사이트 콘텐츠를 "읽기"는 하지만 수집·전송하지 않으므로 해당 없음)

아래 세 항목은 **모두 체크**:
- 승인된 사용 사례 외에 제3자에게 사용자 데이터를 판매하거나 전송하지 않습니다
- 단일 목적과 관련 없는 목적으로 사용자 데이터를 사용하거나 전송하지 않습니다
- 신용도 판단이나 대출 목적으로 사용자 데이터를 사용하거나 전송하지 않습니다

### 개인정보처리방침 URL
```
https://kimeuiyeob.github.io/secret-guard-release/
```
(저장소 Settings → Pages → Branch: main, Folder: /docs 로 설정하면 `docs/index.html`이 이 주소로 게시됩니다)

---

## 3. 업로드할 파일

`extension` 폴더 **안의 파일들**을 zip으로 묶어서 올립니다. `manifest.json`이 zip 최상위에 있어야 합니다.
동봉된 `secret-guard-store-upload.zip`이 이 형식으로 만들어져 있습니다.

## 4. 새 버전 올릴 때
1. `manifest.json`의 `version`을 올림 (예: 1.2.0 → 1.2.1)
2. 다시 zip으로 묶어서 대시보드에서 새 패키지 업로드
3. 심사 통과 후 설치된 사용자에게 자동 업데이트
