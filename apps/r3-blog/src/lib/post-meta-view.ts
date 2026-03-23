function toRecord(meta: object): Record<string, unknown> {
	return meta as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	let trimmed = value.trim();
	if (!trimmed) return undefined;
	return trimmed;
}

export function metaValue(meta: object, keys: Array<string>): string | undefined {
	let record = toRecord(meta);

	for (let key of keys) {
		let value = asString(record[key]);
		if (value) return value;
	}

	return undefined;
}

export function metaTitle(meta: object, fallback: string): string {
	let value = metaValue(meta, ["title", "term", "note", "name", "label", "slug", "path", "url"]);
	if (value) return value;
	return fallback;
}

export function metaSlug(meta: object): string | undefined {
	let direct = metaValue(meta, ["slug", "id", "permalink"]);
	if (direct) return direct;

	let path = metaValue(meta, ["path", "pathname", "url"]);
	if (!path) return undefined;

	let cleanedPath = path;
	try {
		if (cleanedPath.startsWith("http://") || cleanedPath.startsWith("https://")) {
			cleanedPath = new URL(cleanedPath).pathname;
		}
	} catch {}

	let segments = cleanedPath.split("/").filter(Boolean);
	if (segments.length === 0) return undefined;
	return segments[segments.length - 1];
}

export function metaPath(meta: object, basePath: string): string {
	let path = metaValue(meta, ["path", "pathname", "permalink"]);
	if (path) {
		if (path.startsWith("http://") || path.startsWith("https://")) {
			try {
				return new URL(path).pathname;
			} catch {}
		}

		if (path.startsWith("/")) return path;
		return `/${path}`;
	}

	let slug = metaSlug(meta);
	if (slug) return `${basePath}/${slug}`;

	return basePath;
}

export function metaExternalUrl(meta: object): string | undefined {
	let url = metaValue(meta, ["url", "href", "link", "sourceUrl", "source_url"]);
	if (!url) return undefined;

	if (url.startsWith("http://") || url.startsWith("https://")) {
		return url;
	}

	if (url.startsWith("/")) return url;

	return `https://${url}`;
}
