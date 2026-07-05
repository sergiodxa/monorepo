import type { Handle, RemixNode } from "remix/ui";

import type { Permission } from "../permissions";

/** A CMS sidebar link with the permission that gates it. */
interface CmsNavItem {
	href: string;
	label: string;
	permission?: Permission;
}

/** Props for the CMS chrome layout. */
export interface CmsLayoutProps {
	title: string;
	siteTitle: string;
	/** Display name of the signed-in user. */
	userLabel: string;
	permissions: ReadonlySet<Permission>;
	children: RemixNode;
	/** Optional flash/error banner. */
	notice?: string;
}

const CMS_CSS = /* css */ `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font-family:system-ui,sans-serif;color:#111827;background:#f9fafb;line-height:1.5}
.cms{display:grid;grid-template-columns:220px 1fr;min-height:100vh}
.cms-side{background:#111827;color:#e5e7eb;padding:1rem}
.cms-side h1{font-size:1rem;margin:0 0 1rem}
.cms-side a{display:block;color:#d1d5db;text-decoration:none;padding:.4rem .5rem;border-radius:.375rem}
.cms-side a:hover{background:#1f2937;color:#fff}
.cms-main{padding:1.5rem 2rem;max-width:60rem}
.cms-main h2{margin-top:0}
.cms-user{margin-top:1.5rem;font-size:.8rem;color:#9ca3af}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:.5rem;border-bottom:1px solid #e5e7eb}
label{display:block;margin:.75rem 0 .25rem;font-weight:600;font-size:.875rem}
input[type=text],input[type=url],input[type=email],input[type=date],input[type=datetime-local],textarea,select{width:100%;padding:.5rem;border:1px solid #d1d5db;border-radius:.375rem;font:inherit}
textarea{min-height:12rem;font-family:ui-monospace,monospace}
button,.btn{display:inline-block;background:#2563eb;color:#fff;border:0;padding:.5rem 1rem;border-radius:.375rem;cursor:pointer;text-decoration:none;font:inherit}
button.secondary,.btn.secondary{background:#6b7280}
button.danger,.btn.danger{background:#dc2626}
.notice{background:#fef3c7;border:1px solid #fde68a;padding:.75rem;border-radius:.375rem;margin-bottom:1rem}
.help{color:#6b7280;font-size:.8rem;margin:.25rem 0 0}
`;

/**
 * The CMS admin chrome (sidebar + content), showing only the sections the current
 * user's permissions allow. Rendered with `remix/ui`.
 * @param handle - Component handle exposing the chrome props.
 * @returns A render function producing the admin page markup.
 */
export function CmsLayout(handle: Handle<CmsLayoutProps>) {
	return () => {
		let { title, siteTitle, userLabel, permissions, children, notice } = handle.props;
		let items: CmsNavItem[] = [
			{ href: "/cms", label: "Dashboard" },
			{ href: "/cms/types/article/posts", label: "Posts", permission: "posts.create" },
			{ href: "/cms/post-types", label: "Post Types", permission: "post_types.manage" },
			{ href: "/cms/users", label: "Users", permission: "users.manage" },
			{ href: "/cms/roles", label: "Roles", permission: "roles.manage" },
			{ href: "/cms/settings", label: "Settings", permission: "settings.manage" },
			{ href: "/cms/appearance", label: "Appearance", permission: "appearance.manage" },
		];
		let visible = items.filter((item) => !item.permission || permissions.has(item.permission));

		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>
						{title} · {siteTitle}
					</title>
					<style>{CMS_CSS}</style>
				</head>
				<body>
					<div class="cms">
						<aside class="cms-side">
							<h1>{siteTitle}</h1>
							<nav>
								{visible.map((item) => (
									<a href={item.href} key={item.href}>
										{item.label}
									</a>
								))}
							</nav>
							<div class="cms-user">
								{userLabel}
								<form method="post" action="/auth/logout">
									<button class="secondary" type="submit">
										Sign out
									</button>
								</form>
							</div>
						</aside>
						<main class="cms-main">
							{notice && <div class="notice">{notice}</div>}
							<h2>{title}</h2>
							{children}
						</main>
					</div>
				</body>
			</html>
		);
	};
}
