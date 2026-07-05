/** Escapes text for safe HTML interpolation. */
export function escape(value: unknown): string {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/** Escapes a value for use inside a double-quoted HTML attribute. */
export function attr(value: unknown): string {
	return escape(value);
}

/** Wraps content in a minimal dashboard HTML document. */
export function page(title: string, body: string): string {
	return (
		`<!doctype html><html lang="en"><head><meta charset="utf-8">` +
		`<meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)} · Blog SaaS</title>` +
		`<style>body{font-family:system-ui,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;color:#111827;line-height:1.5}` +
		`a{color:#2563eb}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:.5rem;border-bottom:1px solid #e5e7eb}` +
		`label{display:block;margin:.75rem 0 .25rem;font-weight:600}input,select{width:100%;padding:.5rem;border:1px solid #d1d5db;border-radius:.375rem;font:inherit}` +
		`button,.btn{display:inline-block;background:#2563eb;color:#fff;border:0;padding:.5rem 1rem;border-radius:.375rem;cursor:pointer;text-decoration:none;font:inherit}` +
		`.btn.danger,button.danger{background:#dc2626}.muted{color:#6b7280}</style></head><body>${body}</body></html>`
	);
}
