import type { Handle, RemixNode } from "remix/ui";

const PAGE_CSS = /* css */ `
body{font-family:system-ui,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;color:#111827;line-height:1.5}
a{color:#2563eb}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:.5rem;border-bottom:1px solid #e5e7eb}
label{display:block;margin:.75rem 0 .25rem;font-weight:600}
input,select{width:100%;padding:.5rem;border:1px solid #d1d5db;border-radius:.375rem;font:inherit}
button,.btn{display:inline-block;background:#2563eb;color:#fff;border:0;padding:.5rem 1rem;border-radius:.375rem;cursor:pointer;text-decoration:none;font:inherit}
.btn.danger,button.danger{background:#dc2626}
.muted{color:#6b7280}
`;

/** Minimal dashboard document shell, rendered with `remix/ui`. */
export function Page(handle: Handle<{ title: string; children: RemixNode }>) {
	return () => {
		let { title, children } = handle.props;
		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>{title} · Blog SaaS</title>
					<style>{PAGE_CSS}</style>
				</head>
				<body>{children}</body>
			</html>
		);
	};
}
