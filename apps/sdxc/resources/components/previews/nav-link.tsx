/**
 * Live preview island for `NavLink`. What distinguishes it from `Link` is the current
 * page, so the preview is a settings sidebar with one entry marked `aria-current="page"`
 * — once as the plain underlined link and once as the padded, background-filled row an
 * app renders when the active entry carries its own fill.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { hstack, vstack } from "@sdxc/u/layout";
import { m, pb, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";
import { Header, NavLink } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/** The page the sidebar is rendered for, which is what decides `aria-current`. */
const ACTIVE_PATH = "/settings/billing";

/** The source the page shows, matching the markup below. */
const CODE = `let pathname = useCurrentPath();

let entries = [
	{ href: "/settings/profile", label: "Profile" },
	{ href: "/settings/billing", label: "Billing" },
	{ href: "/settings/members", label: "Members" },
	{ href: "/settings/webhooks", label: "Webhooks" },
];

<div mix={[hstack({ gap: 10, align: "start" })]}>
	<nav mix={[vstack({ gap: 2, align: "start" })]}>
		<Header>Underlined</Header>
		{entries.map((entry) => (
			<NavLink
				key={entry.href}
				href={entry.href}
				aria-current={pathname === entry.href ? "page" : undefined}
			>
				{entry.label}
			</NavLink>
		))}
	</nav>

	<nav mix={[vstack({ gap: 1, align: "stretch" })]}>
		<Header>Filled</Header>
		{entries.map((entry) => (
			<NavLink
				key={entry.href}
				href={entry.href}
				hasBackground
				aria-current={pathname === entry.href ? "page" : undefined}
				mix={[
					pi(3),
					pb(2),
					rounded("md"),
					text("sm"),
					when('&[aria-current="page"]', bg("brand.tint")),
				]}
			>
				{entry.label}
			</NavLink>
		))}
	</nav>
</div>`;

/** The entries both columns render, so the two differ only in how the active one is drawn. */
const ENTRIES = [
	{ href: "/settings/profile", label: "Profile" },
	{ href: "/settings/billing", label: "Billing" },
	{ href: "/settings/members", label: "Members" },
	{ href: "/settings/webhooks", label: "Webhooks" },
];

/** A settings sidebar, hydrated so the page loads this example's chunk alone. */
export const NavLinkPreview = clientEntry(
	"/resources/components/previews/nav-link.tsx#NavLinkPreview",
	function NavLinkPreview() {
		return () => (
			<div mix={[hstack({ gap: 10, align: "start" })]}>
				<nav mix={[vstack({ gap: 2, align: "start" })]}>
					<Header mix={[m(0)]}>Underlined</Header>
					{ENTRIES.map((entry) => (
						<NavLink
							key={entry.href}
							href={entry.href}
							aria-current={entry.href === ACTIVE_PATH ? "page" : undefined}
						>
							{entry.label}
						</NavLink>
					))}
				</nav>

				<nav mix={[vstack({ gap: 1, align: "stretch" })]}>
					<Header mix={[m(0)]}>Filled</Header>
					{ENTRIES.map((entry) => (
						<NavLink
							key={entry.href}
							href={entry.href}
							hasBackground
							aria-current={entry.href === ACTIVE_PATH ? "page" : undefined}
							mix={[
								pi(3),
								pb(2),
								rounded("md"),
								text("sm"),
								fg("neutral.emphasis"),
								when('&[aria-current="page"]', bg("brand.tint")),
							]}
						>
							{entry.label}
						</NavLink>
					))}
				</nav>
			</div>
		);
	},
);

export default { code: CODE, render: () => <NavLinkPreview /> };
