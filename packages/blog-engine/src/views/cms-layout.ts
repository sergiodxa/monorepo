import type { Permission } from "../domain/permissions";

import { attr, escape } from "./html";

/** A CMS sidebar link with the permission that gates it. */
interface CmsNavItem {
	href: string;
	label: string;
	permission?: Permission;
}

/** Options for the CMS chrome layout. */
export interface CmsLayoutOptions {
	title: string;
	siteTitle: string;
	/** Display name of the signed-in user. */
	userLabel: string;
	permissions: ReadonlySet<Permission>;
	/** Inner HTML for the content column (already trusted/escaped). */
	body: string;
	/** Optional per-page flash/error banner (escaped by caller). */
	notice?: string;
}

const CMS_CSS = /* css */ `
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; color: #111827; background: #f9fafb; line-height: 1.5; }
.cms { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }
.cms-side { background: #111827; color: #e5e7eb; padding: 1rem; }
.cms-side h1 { font-size: 1rem; margin: 0 0 1rem; }
.cms-side a { display: block; color: #d1d5db; text-decoration: none; padding: 0.4rem 0.5rem; border-radius: 0.375rem; }
.cms-side a:hover { background: #1f2937; color: #fff; }
.cms-main { padding: 1.5rem 2rem; max-width: 60rem; }
.cms-main h2 { margin-top: 0; }
.cms-user { margin-top: auto; font-size: 0.8rem; color: #9ca3af; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #e5e7eb; }
label { display: block; margin: 0.75rem 0 0.25rem; font-weight: 600; font-size: 0.875rem; }
input[type=text], input[type=url], input[type=email], input[type=date], input[type=datetime-local], textarea, select {
	width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font: inherit;
}
textarea { min-height: 12rem; font-family: ui-monospace, monospace; }
button, .btn { display: inline-block; background: #2563eb; color: #fff; border: 0; padding: 0.5rem 1rem; border-radius: 0.375rem; cursor: pointer; text-decoration: none; font: inherit; }
button.secondary, .btn.secondary { background: #6b7280; }
button.danger, .btn.danger { background: #dc2626; }
.notice { background: #fef3c7; border: 1px solid #fde68a; padding: 0.75rem; border-radius: 0.375rem; margin-bottom: 1rem; }
.help { color: #6b7280; font-size: 0.8rem; margin: 0.25rem 0 0; }
`;

/**
 * Renders the CMS admin chrome (sidebar + content), showing only the sections the
 * current user's permissions allow.
 * @param options - Chrome content, user label, and permission set.
 * @returns A full HTML document string for an admin page.
 */
export function cmsLayout(options: CmsLayoutOptions): string {
	let items: CmsNavItem[] = [
		{ href: "/cms", label: "Dashboard" },
		{ href: "/cms/types/article/posts", label: "Posts", permission: "posts.create" },
		{ href: "/cms/post-types", label: "Post Types", permission: "post_types.manage" },
		{ href: "/cms/users", label: "Users", permission: "users.manage" },
		{ href: "/cms/roles", label: "Roles", permission: "roles.manage" },
		{ href: "/cms/settings", label: "Settings", permission: "settings.manage" },
		{ href: "/cms/appearance", label: "Appearance", permission: "appearance.manage" },
	];
	let nav = items
		.filter((item) => !item.permission || options.permissions.has(item.permission))
		.map((item) => `<a href="${attr(item.href)}">${escape(item.label)}</a>`)
		.join("");

	return (
		`<!doctype html><html lang="en"><head><meta charset="utf-8">` +
		`<meta name="viewport" content="width=device-width, initial-scale=1">` +
		`<title>${escape(options.title)} · ${escape(options.siteTitle)}</title>` +
		`<style>${CMS_CSS}</style></head><body><div class="cms">` +
		`<aside class="cms-side">` +
		`<h1>${escape(options.siteTitle)}</h1>` +
		`<nav>${nav}</nav>` +
		`<p class="cms-user">${escape(options.userLabel)}<br>` +
		`<form method="post" action="/auth/logout"><button class="secondary" type="submit">Sign out</button></form>` +
		`</p>` +
		`</aside>` +
		`<main class="cms-main">` +
		(options.notice ? `<div class="notice">${options.notice}</div>` : "") +
		`<h2>${escape(options.title)}</h2>` +
		options.body +
		`</main></div></body></html>`
	);
}
