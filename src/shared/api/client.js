import { apiUrl } from "@shared/lib/apiUrl.js";

export class ApiError extends Error {
  constructor(message, { status = 0, data = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function buildInit(options = {}) {
  const { method = "GET", headers = {}, body, credentials = "include" } = options;
  const hasBody = body !== undefined;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const finalHeaders = {
    Accept: "application/json",
    ...headers,
  };

  if (hasBody && !isFormData && !finalHeaders["Content-Type"]) {
    finalHeaders["Content-Type"] = "application/json";
  }

  return {
    method,
    credentials,
    headers: finalHeaders,
    ...(hasBody
      ? {
          body:
            isFormData || typeof body === "string"
              ? body
              : JSON.stringify(body),
        }
      : {}),
  };
}

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export async function httpRequest(path, options = {}) {
  let res;
  try {
    res = await fetch(apiUrl(path), buildInit(options));
  } catch (error) {
    throw new ApiError(error?.message || "Network error");
  }

  const data = await parseResponse(res);
  if (!res.ok) {
    throw new ApiError(data?.error || `HTTP ${res.status}`, {
      status: res.status,
      data,
    });
  }

  return data;
}

export async function httpRequestRaw(path, options = {}) {
  try {
    return await fetch(apiUrl(path), buildInit(options));
  } catch (error) {
    throw new ApiError(error?.message || "Network error");
  }
}
