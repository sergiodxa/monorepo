/**
 * The `package-groups` tag: the published collection, laid out by the problem each
 * package solves. It is the one tag that reads data rather than its own children, so
 * a package published today is listed today and a description edited in a manifest is
 * the description shown here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { listStyle } from "@sdxc/u/general";
import { gap, grid, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { font, text, tracking, weight } from "@sdxc/u/typography";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import { listPackageGroups } from "~/app/services/packages";

namespace PackageGroups {
	export interface Props extends MarkdownProps {
		/** Where the list comes from; the one value keeps a typo a parse error. */
		source: "registry";
	}
}

/** Renders every published package under its group heading. */
export default function PackageGroups(_handle: Handle<PackageGroups.Props>) {
	return () => (
		<div mix={[vstack({ gap: 10 })]}>
			{listPackageGroups().map((group) => (
				<section key={group.title} mix={[vstack({ gap: 4 })]}>
					<h3 mix={[m(0), text("sm"), weight("semibold"), tracking("wide"), fg("neutral")]}>
						{group.title}
					</h3>

					<ul
						mix={[
							grid(),
							gap(3),
							m(0),
							p(0),
							listStyle("none"),
							gridTemplate({ columns: "1fr" }),
							media(
								"(min-width: 40rem)",
								gridTemplate({ columns: repeat("auto-fill", "minmax(18rem, 1fr)") }),
							),
						]}
					>
						{group.packages.map((entry) => (
							<li key={entry.name} mix={[vstack({ gap: 1 })]}>
								<code mix={[font("mono"), text("sm"), fg("neutral.emphasis")]}>{entry.name}</code>
								<p mix={[m(0), text("sm"), fg("neutral")]}>{entry.description}</p>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}
