/**
 * Normalize OpenAI-compatible base URLs so HFQ always hits
 * `{base}/chat/completions` correctly for common third-party hosts.
 */

/** Hosts / path prefixes that need a trailing `/v1` for chat completions. */
const OPENAI_V1_HINTS: Array<{ test: (u: URL) => boolean; note: string }> = [
  {
    // OpenCode Zen portal page is /zen; API is /zen/v1
    test: (u) =>
      (u.hostname === "opencode.ai" || u.hostname.endsWith(".opencode.ai")) &&
      (u.pathname === "/zen" || u.pathname === "/zen/"),
    note: "OpenCode Zen API is https://opencode.ai/zen/v1",
  },
  {
    test: (u) =>
      u.hostname === "api.openai.com" &&
      (u.pathname === "" || u.pathname === "/"),
    note: "OpenAI API base is https://api.openai.com/v1",
  },
  {
    test: (u) =>
      u.hostname === "api.deepseek.com" &&
      (u.pathname === "" || u.pathname === "/"),
    note: "DeepSeek API base is https://api.deepseek.com/v1",
  },
  {
    test: (u) =>
      u.hostname === "api.groq.com" &&
      (u.pathname === "/openai" || u.pathname === "/openai/"),
    note: "Groq OpenAI-compat base is https://api.groq.com/openai/v1",
  },
  {
    test: (u) =>
      u.hostname === "api.moonshot.cn" &&
      (u.pathname === "" || u.pathname === "/"),
    note: "Moonshot API base is https://api.moonshot.cn/v1",
  },
  {
    test: (u) =>
      (u.hostname === "dashscope.aliyuncs.com" ||
        u.hostname.endsWith(".dashscope.aliyuncs.com")) &&
      (u.pathname === "/compatible-mode" || u.pathname === "/compatible-mode/"),
    note: "DashScope compatible-mode base ends with /v1",
  },
];

/**
 * Strip trailing slashes; optionally append /v1 when the URL matches a known
 * third-party pattern that commonly omits it.
 */
export function normalizeOpenAICompatibleBaseURL(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return trimmed.replace(/\/+$/, "");
  }

  // Already ends with /v1 or /v1beta etc. — keep path, drop trailing slash
  const path = url.pathname.replace(/\/+$/, "") || "";
  if (/\/v\d+[a-z]*$/i.test(path)) {
    url.pathname = path;
    return url.toString().replace(/\/+$/, "");
  }

  for (const hint of OPENAI_V1_HINTS) {
    if (hint.test(url)) {
      url.pathname = `${path || ""}/v1`.replace(/\/{2,}/g, "/");
      return url.toString().replace(/\/+$/, "");
    }
  }

  url.pathname = path || "/";
  if (url.pathname === "/") {
    // bare origin with no path — leave as-is (user may use reverse proxy root)
    return url.origin;
  }
  return url.toString().replace(/\/+$/, "");
}

/**
 * Turn raw provider HTTP errors into short, actionable Chinese/English hints.
 * Keeps a short body excerpt for debugging.
 */
export function formatProviderHttpError(opts: {
  providerId: string;
  status: number;
  body: string;
  requestUrl?: string;
}): string {
  const { providerId, status, requestUrl } = opts;
  const body = String(opts.body || "");
  const head = body.slice(0, 400).replace(/\s+/g, " ").trim();
  const looksHtml =
    /^\s*</.test(body) ||
    /<!DOCTYPE/i.test(body) ||
    /<html[\s>]/i.test(body) ||
    /text\/html/i.test(body);

  const hints: string[] = [];

  if (looksHtml) {
    hints.push(
      "返回了网页 HTML，通常是 baseURL 指到了站点首页而不是 API（OpenAI 兼容一般以 /v1 结尾）",
    );
    if (requestUrl?.includes("opencode.ai/zen") && !requestUrl.includes("/zen/v1")) {
      hints.push("OpenCode Zen 请用 https://opencode.ai/zen/v1");
    }
  }

  if (status === 401 || status === 403) {
    hints.push("鉴权失败：检查 API Key 是否有效、是否属于该渠道");
  }
  if (status === 404 && !looksHtml) {
    hints.push("路径不存在：确认 baseURL 是否少/多了一层 /v1");
  }
  if (status === 429) {
    hints.push("限流：稍后重试或换 Key / 套餐");
  }
  if (status >= 500) {
    if (/auth_unavailable|no auth available/i.test(body)) {
      hints.push(
        "上游未配置该模型鉴权（中转站未开通对应厂商 Key / 套餐）",
      );
    } else {
      hints.push("服务端错误：多半是中转站或上游故障");
    }
  }

  // Try extract JSON error message
  let jsonMsg = "";
  try {
    const j = JSON.parse(body) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof j.error === "string") jsonMsg = j.error;
    else if (j.error && typeof j.error === "object" && j.error.message) {
      jsonMsg = j.error.message;
    } else if (j.message) jsonMsg = j.message;
  } catch {
    /* not json */
  }

  const parts = [
    `provider ${providerId} ${status}`,
    jsonMsg || (looksHtml ? "(HTML 错误页)" : head.slice(0, 240)),
    hints.length ? `提示: ${hints.join("；")}` : "",
    requestUrl ? `url: ${requestUrl}` : "",
  ].filter(Boolean);

  return parts.join(" — ").slice(0, 900);
}
