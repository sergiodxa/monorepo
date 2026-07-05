/**
 * The CMS admin chrome component ({@link CmsLayout}): a sidebar-plus-content document
 * whose navigation shows only the sections the current user's permissions allow.
 * Wraps every admin page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Handle, RemixNode } from "remix/ui";

import type { Permission } from "../permissions";

import * as s from "./styles";

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

/**
 * The CMS admin chrome (sidebar + content), showing only the sections the current
 * user's permissions allow. Styled with `remix/ui` `css()` mixins (see `./styles`).
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
					<style>{s.RESET_CSS}</style>
				</head>
				<body mix={[s.cmsBody]}>
					<div mix={[s.cmsShell]}>
						<aside mix={[s.cmsSide]}>
							<h1>{siteTitle}</h1>
							<nav>
								{visible.map((item) => (
									<a mix={[s.cmsSideLink]} href={item.href} key={item.href}>
										{item.label}
									</a>
								))}
							</nav>
							<div mix={[s.cmsUser]}>
								{userLabel}
								<form method="post" action="/auth/logout">
									<button mix={[s.button, s.buttonSecondary]} type="submit">
										Sign out
									</button>
								</form>
							</div>
						</aside>
						<main mix={[s.cmsMain]}>
							{notice && <div mix={[s.notice]}>{notice}</div>}
							<h2>{title}</h2>
							{children}
						</main>
					</div>
				</body>
			</html>
		);
	};
}
