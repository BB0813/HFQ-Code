/**
 * Remote / local model enumeration for Models UI (`models:list` IPC).
 */

import { normalizeOpenAICompatibleBaseURL } from "./openai-base-url.js";

export type ListModelsSource = "remote" | "config" | "mock" | "unsupported";

export interface ListModelsInput {
  id: string;
  kind: "mock" | "openai_compatible" | "anthropic";
  baseURL?: string;
  apiKey?: string;
  models?: string[];
  defaultModel?: string;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Timeout for remote list (ms). Default 15_000. */
  timeoutMs?: number;
}

export interface ListModelsResult {
  ok: boolean;
  providerId: string;
  source: ListModelsSource;
  models: string[];
  error?: string;
  warning?: string;
  rawCount?: number;
}

function configModels(input: ListModelsInput): string[] {
  const fromCfg = (input.models ?? [])
    .map((m) => String(m ?? "").trim())
    .filter(Boolean);
  if (fromCfg.length) return [...new Set(fromCfg)];
  if (input.defaultModel?.trim()) return [input.defaultModel.trim()];
  return [];
}

function parseOpenAIModelsBody(body: unknown): string[] {
  if (!body) return [];
  if (Array.isArray(body)) {
    return body
      .map((row) => {
        if (typeof row === "string") return row;
        if (row && typeof row === "object" && "id" in row) {
          return String((row as { id?: unknown }).id ?? "");
        }
        return "";
      })
      .filter(Boolean);
  }
  if (typeof body === "object" && body !== null && "data" in body) {
    const data = (body as { data?: unknown }).data;
    return parseOpenAIModelsBody(data);
  }
  return [];
}

/**
 * List models for a provider.
 * - mock → config/mock ids
 * - openai_compatible → GET `{base}/models` with soft fallback to config.models
 * - anthropic → no stable list API; return config with source unsupported
 */
export async function listProviderModels(input: ListModelsInput): Promise<ListModelsResult> {
  const providerId = String(input.id || "").trim() || "unknown";
  const cfgModels = configModels(input);

  if (input.kind === "mock" || providerId === "mock") {
    const models = cfgModels.length ? cfgModels : ["mock-hfq"];
    return { ok: true, providerId, source: "mock", models };
  }

  if (input.kind === "anthropic") {
    return {
      ok: cfgModels.length > 0,
      providerId,
      source: "unsupported",
      models: cfgModels,
      error: cfgModels.length
        ? "Anthropic remote model enumeration is not supported; using config.models"
        : "Anthropic remote model enumeration is not supported and config.models is empty",
    };
  }

  if (input.kind !== "openai_compatible") {
    return {
      ok: false,
      providerId,
      source: "unsupported",
      models: cfgModels,
      error: `unsupported provider kind: ${String(input.kind)}`,
    };
  }

  const base = normalizeOpenAICompatibleBaseURL(String(input.baseURL || "").trim());
  if (!base) {
    return {
      ok: cfgModels.length > 0,
      providerId,
      source: "config",
      models: cfgModels,
      error: "baseURL is required for openai_compatible model list",
    };
  }

  const url = `${base.replace(/\/+$/, "")}/models`;
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      accept: "application/json",
    };
    if (input.apiKey?.trim()) {
      headers.authorization = `Bearer ${input.apiKey.trim()}`;
    }
    const res = await fetchImpl(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      const snippet = text.replace(/\s+/g, " ").trim().slice(0, 200);
      if (cfgModels.length) {
        return {
          ok: true,
          providerId,
          source: "config",
          models: cfgModels,
          warning: `remote list failed ${res.status}: ${snippet || res.statusText}`,
          error: `remote list failed ${res.status}`,
        };
      }
      return {
        ok: false,
        providerId,
        source: "remote",
        models: [],
        error: `remote list failed ${res.status}: ${snippet || res.statusText}`,
      };
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      if (cfgModels.length) {
        return {
          ok: true,
          providerId,
          source: "config",
          models: cfgModels,
          warning: "remote list returned non-JSON; using config.models",
        };
      }
      return {
        ok: false,
        providerId,
        source: "remote",
        models: [],
        error: "remote list returned non-JSON",
      };
    }

    const remote = [...new Set(parseOpenAIModelsBody(parsed))];
    if (!remote.length) {
      if (cfgModels.length) {
        return {
          ok: true,
          providerId,
          source: "config",
          models: cfgModels,
          warning: "remote list empty; using config.models",
          rawCount: 0,
        };
      }
      return {
        ok: false,
        providerId,
        source: "remote",
        models: [],
        error: "remote list empty",
        rawCount: 0,
      };
    }

    return {
      ok: true,
      providerId,
      source: "remote",
      models: remote,
      rawCount: remote.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (cfgModels.length) {
      return {
        ok: true,
        providerId,
        source: "config",
        models: cfgModels,
        warning: `remote list error: ${msg}`,
        error: msg,
      };
    }
    return {
      ok: false,
      providerId,
      source: "remote",
      models: [],
      error: msg,
    };
  } finally {
    clearTimeout(timer);
  }
}
