// =====================================================================
// Secret Guard 탐지 패턴
// - name: 경고창/로그에 표시되는 이름 (실제 매칭 값은 어디에도 남기지 않음)
// - re: 정규식
// - validate(선택): 매칭된 값을 추가 검증하는 함수 (true면 탐지)
// 추가/삭제 후 chrome://extensions 에서 확장 새로고침(↻) + 대상 탭 새로고침
// =====================================================================

// 카드번호 오탐 방지용 Luhn 체크섬
function luhn(value) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0, dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = +digits[i];
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return sum % 10 === 0;
}

const SECRET_PATTERNS = [
  // ---------------- 클라우드 ----------------
  { name: "AWS Access Key ID",          re: /\b(AKIA|ASIA|ABIA|ACCA|AGPA|AIDA|AIPA|ANPA|ANVA|AROA|APKA)[0-9A-Z]{16}\b/ },
  { name: "AWS Secret Access Key",      re: /aws.{0,20}(secret|sk).{0,20}['"=:\s][A-Za-z0-9\/+]{40}(?![A-Za-z0-9\/+])/i },
  { name: "AWS Session Token",          re: /aws.{0,20}session.{0,20}token.{0,5}['"=:\s][A-Za-z0-9\/+=]{100,}/i },
  { name: "Alibaba Cloud AccessKey",    re: /\bL?TAI[0-9A-Za-z]{12,24}\b/ },
  { name: "Alibaba Cloud AccessKey Secret", re: /ALIBABA.{0,30}SECRET\s*[:=]\s*['"]?[A-Za-z0-9]{30}\b/i },
  { name: "Tencent Cloud SecretId",     re: /\bAKID[0-9A-Za-z]{32}\b/ },
  { name: "GCP Service Account Key",    re: /"type"\s*:\s*"service_account"[\s\S]{0,500}"private_key"/ },
  { name: "Google API Key",             re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "Google OAuth Client Secret", re: /\bGOCSPX-[0-9A-Za-z_-]{28}\b/ },
  { name: "Google OAuth Access Token",  re: /\bya29\.[0-9A-Za-z_-]{30,}\b/ },
  { name: "Azure Storage Account Key",  re: /AccountKey=[A-Za-z0-9+\/]{86}==/ },
  { name: "Azure Shared Access Key",    re: /SharedAccessKey=[A-Za-z0-9+\/=]{40,}/ },
  { name: "Azure SAS Token",            re: /[?&]sig=[A-Za-z0-9%+\/=]{40,}/ },
  { name: "DigitalOcean Token",         re: /\bdo[opr]_v1_[a-f0-9]{64}\b/ },

  // ---------------- 개인키 ----------------
  { name: "Private Key",                re: /-----BEGIN ((RSA|DSA|EC|OPENSSH|ENCRYPTED) )?PRIVATE KEY-----/ },
  { name: "PGP Private Key",            re: /-----BEGIN PGP PRIVATE KEY BLOCK-----/ },
  { name: "PuTTY Private Key",          re: /PuTTY-User-Key-File-\d/ },
  { name: "Kubeconfig Client Key",      re: /client-key-data:\s*[A-Za-z0-9+\/=]{40,}/ },

  // ---------------- 코드 저장소 / CI ----------------
  { name: "GitHub Token",               re: /\b(ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{36}\b|\bgithub_pat_[0-9A-Za-z_]{60,}\b/ },
  { name: "GitLab Token",               re: /\bgl(pat|ptt|dt|rt|oas|cbt|imt|agent|ft|soat)-[0-9A-Za-z_-]{20,}\b/ },
  { name: "Atlassian API Token",        re: /\bATATT3[0-9A-Za-z_=-]{150,}\b/ },
  { name: "npm Token",                  re: /\bnpm_[0-9A-Za-z]{36}\b/ },
  { name: "PyPI Token",                 re: /\bpypi-AgEIcHlwaS5vcmc[0-9A-Za-z_-]{50,}\b/ },
  { name: "Docker Hub Token",           re: /\bdckr_pat_[0-9A-Za-z_-]{27,}\b/ },
  { name: "HashiCorp Vault Token",      re: /\bhv[sbr]\.[0-9A-Za-z_-]{24,}\b/ },
  { name: "Terraform Cloud Token",      re: /\b[0-9A-Za-z]{14}\.atlasv1\.[0-9A-Za-z_-]{60,}\b/ },
  { name: "Pulumi Token",               re: /\bpul-[a-f0-9]{40}\b/ },
  { name: "Doppler Token",              re: /\bdp\.(st|ct|sa|scim|audit)\.[0-9A-Za-z_-]{40,}\b/ },

  // ---------------- 메신저 / 웹훅 ----------------
  { name: "Slack Token",                re: /\bxox[baprse]-[0-9A-Za-z-]{10,}\b/ },
  { name: "Slack Webhook",              re: /hooks\.slack\.com\/(services|workflows)\/[A-Za-z0-9\/_-]{20,}/ },
  { name: "Discord Webhook",            re: /discord(app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]{30,}/ },
  { name: "Telegram Bot Token",         re: /\b\d{8,10}:AA[0-9A-Za-z_-]{33}\b/ },
  { name: "Microsoft Teams Webhook",    re: /\.webhook\.office\.com\/webhookb2\/[A-Za-z0-9@\/_-]{40,}/ },

  // ---------------- AI / SaaS API ----------------
  { name: "Anthropic API Key",          re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: "OpenAI API Key",             re: /\bsk-(proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: "Hugging Face Token",         re: /\bhf_[A-Za-z]{34}\b/ },
  { name: "Stripe Secret Key",          re: /\b(sk|rk)_(live|test)_[0-9A-Za-z]{20,}\b/ },
  { name: "Twilio API Key",             re: /\bSK[0-9a-f]{32}\b/ },
  { name: "SendGrid API Key",           re: /\bSG\.[0-9A-Za-z_-]{22}\.[0-9A-Za-z_-]{43}\b/ },
  { name: "Mailgun API Key",            re: /\bkey-[0-9a-z]{32}\b/ },
  { name: "Shopify Token",              re: /\bshp(at|ss|ca|pa)_[a-fA-F0-9]{32}\b/ },
  { name: "Databricks Token",           re: /\bdapi[a-f0-9]{32}(-\d)?\b/ },
  { name: "Grafana Token",              re: /\b(glsa_[A-Za-z0-9]{32}_[a-f0-9]{8}|glc_[A-Za-z0-9+\/]{32,}={0,2})/ },
  { name: "New Relic Key",              re: /\bNR(AK|AA|II)-[A-Z0-9]{27}\b/ },
  { name: "Notion Token",               re: /\b(secret_[A-Za-z0-9]{43}|ntn_[A-Za-z0-9]{40,})\b/ },
  { name: "Linear API Key",             re: /\blin_api_[A-Za-z0-9]{40}\b/ },
  { name: "Figma Token",                re: /\bfigd_[A-Za-z0-9_-]{40,}\b/ },
  { name: "Sentry DSN",                 re: /https:\/\/[a-f0-9]{32}@[a-z0-9.-]*sentry\.io\/\d+/ },

  // ---------------- 인증 헤더 / 접속 문자열 ----------------
  { name: "JWT",                        re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { name: "Bearer Token",               re: /\bBearer\s+[A-Za-z0-9._~+\/-]{30,}=*/ },
  { name: "Basic Auth Header",          re: /\bAuthorization:\s*Basic\s+[A-Za-z0-9+\/]{16,}={0,2}/i },
  { name: "DB Connection String",       re: /\b(mysql|mariadb|postgres(ql)?|mongodb(\+srv)?|redis|rediss|amqps?|mssql|sqlserver|oracle|jdbc:[a-z]+):\/\/[^\s:@\/]+:[^\s@\/]+@[^\s]+/i },
  { name: "URL with Credentials",       re: /\bhttps?:\/\/[^\s:@\/]+:[^\s@\/]{6,}@[^\s]+/i },

  // ---------------- 키=값 형태 할당 ----------------
  // 값에 숫자가 최소 1개 있어야 탐지 (settings.DB_PASSWORD 같은 변수 참조 오탐 방지)
  { name: "Secret assignment",          re: /(?<![A-Za-z])(password|passwd|pwd|pass|secret|token|api[_-]?key|apikey|access[_-]?key|secret[_-]?key|client[_-]?secret|private[_-]?key|auth[_-]?token|credentials?)\s*[:=]\s*['"]?(?![$\{<])(?=[^\s'"(){}]*\d)[^\s'"(){}]{8,}['"]?(?=[\s,;]|$)/i },

  // ---------------- 한국 개인정보 ----------------
  { name: "주민/외국인등록번호",          re: /(?<!\d)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])-?[1-8]\d{6}(?!\d)/ },
  { name: "휴대폰번호",                  re: /(?<!\d)01[016789]-?\d{3,4}-?\d{4}(?!\d)/ },
  { name: "운전면허번호",                re: /(?<!\d)(1[1-9]|2[0-8])-\d{2}-\d{6}-\d{2}(?!\d)/ },
  { name: "여권번호",                    re: /\b[MSRODG]\d{8}\b/ },
  { name: "사업자등록번호",              re: /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/ },
  { name: "카드번호",                    re: /(?<!\d)(?:\d{4}[- ]?){3}\d{1,4}(?!\d)/, validate: luhn }
];

function detectSecrets(text) {
  if (!text) return [];
  const hits = [];
  for (const p of SECRET_PATTERNS) {
    if (!p.validate) {
      if (p.re.test(text)) hits.push(p.name);
      continue;
    }
    const g = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g");
    for (const m of text.matchAll(g)) {
      if (p.validate(m[0])) { hits.push(p.name); break; }
    }
  }
  return hits;
}
