import * as ContentType from "./content-type";

type Init = Omit<RequestInit, "body" | "headers"> & {
	headers?: HeadersInit;
};

/**
 * Creates a Request with JSON body and Content-Type header.
 * Defaults to POST method but can be overridden for PUT, PATCH, etc.
 * @param url - The URL for the request
 * @param body - The data to serialize as JSON
 * @param init - Optional request options (method, headers, etc.)
 * @returns A new Request instance with JSON body
 * @example
 * let req = json("https://api.example.com/users", { name: "John" });
 * @example
 * let req = json("https://api.example.com/users/1", { name: "Jane" }, { method: "PUT" });
 */
export function json<T>(url: string | URL, body: T, init?: Init): Request {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", ContentType.Json);
	return new Request(url, {
		...init,
		method: init?.method ?? "POST",
		headers,
		body: JSON.stringify(body),
	});
}

/**
 * Creates a Request with plain text body and Content-Type header.
 * Defaults to POST method but can be overridden for PUT, PATCH, etc.
 * @param url - The URL for the request
 * @param body - The text content for the request body
 * @param init - Optional request options (method, headers, etc.)
 * @returns A new Request instance with text body
 * @example
 * let req = text("https://api.example.com/notes", "Hello, world!");
 * @example
 * let req = text("https://api.example.com/notes/1", "Updated note", { method: "PUT" });
 */
export function text(url: string | URL, body: string, init?: Init): Request {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", ContentType.Text);
	return new Request(url, { ...init, method: init?.method ?? "POST", headers, body });
}

/**
 * Creates a Request with XML body and Content-Type header.
 * Defaults to POST method but can be overridden for PUT, PATCH, etc.
 * @param url - The URL for the request
 * @param body - The XML content for the request body
 * @param init - Optional request options (method, headers, etc.)
 * @returns A new Request instance with XML body
 * @example
 * let req = xml("https://api.example.com/data", "<user><name>John</name></user>");
 * @example
 * let req = xml("https://api.example.com/data/1", "<user><name>Jane</name></user>", { method: "PUT" });
 */
export function xml(url: string | URL, body: string, init?: Init): Request {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", ContentType.XML);
	return new Request(url, { ...init, method: init?.method ?? "POST", headers, body });
}

/**
 * Creates a Request with multipart form data body.
 * Does not set Content-Type header; the browser sets it with the boundary.
 * @param url - The URL for the request
 * @param body - FormData instance or a Record of string/Blob values
 * @param init - Optional request options (method, headers, etc.)
 * @returns A new Request instance with FormData body
 * @example
 * let req = formData("https://api.example.com/upload", { file: fileBlob, name: "photo.png" });
 * @example
 * let data = new FormData();
 * data.append("avatar", imageBlob);
 * let req = formData("https://api.example.com/users/1/avatar", data, { method: "PUT" });
 */
export function formData(
	url: string | URL,
	body: FormData | Record<string, string | Blob>,
	init?: Init,
): Request {
	let headers = new Headers(init?.headers);

	let data: FormData;

	if (body instanceof FormData) data = body;
	else {
		data = new FormData();
		for (let [key, value] of Object.entries(body)) {
			data.append(key, value);
		}
	}

	return new Request(url, { ...init, method: init?.method ?? "POST", headers, body: data });
}

/**
 * Creates a Request with URL-encoded form body and Content-Type header.
 * Defaults to POST method but can be overridden for PUT, PATCH, etc.
 * @param url - The URL for the request
 * @param body - URLSearchParams or a Record of string key-value pairs
 * @param init - Optional request options (method, headers, etc.)
 * @returns A new Request instance with URL-encoded body
 * @example
 * let req = formURLEncoded("https://api.example.com/login", { username: "john", password: "secret" });
 * @example
 * let params = new URLSearchParams();
 * params.set("grant_type", "refresh_token");
 * let req = formURLEncoded("https://api.example.com/oauth/token", params);
 */
export function formURLEncoded(
	url: string | URL,
	body: URLSearchParams | Record<string, string>,
	init?: Init,
): Request {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", ContentType.FormURLEncoded);

	let params = body instanceof URLSearchParams ? body : new URLSearchParams(body);

	return new Request(url, { ...init, method: init?.method ?? "POST", headers, body: params });
}
