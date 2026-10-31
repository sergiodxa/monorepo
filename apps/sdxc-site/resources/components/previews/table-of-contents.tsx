/**
 * Live preview for `TableOfContents`: a short guide with its "On this page" rail beside
 * it. Scrolling the guide slides the marker over every section on screen, and the last
 * section is marked once the guide reaches its end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, insBs, sticky, vstack } from "@sdxc/u/layout";
import { is, m, maxIs } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { TableOfContents } from "@sdxc/ui";

/** The guide's headings, the shape a page's Markdown hands the list. */
const ITEMS: TableOfContents.Item[] = [
	{ id: "toc-preview-install", text: "Install the CLI", level: 2 },
	{ id: "toc-preview-login", text: "Log in", level: 2 },
	{ id: "toc-preview-token", text: "Use a token in CI", level: 3 },
	{ id: "toc-preview-monitor", text: "Add a monitor", level: 2 },
	{ id: "toc-preview-next", text: "Next steps", level: 2 },
];

/** One paragraph per section, long enough to scroll past. */
const BODY: Record<string, string> = {
	"toc-preview-install":
		"Install the command line with your package manager. It needs Node 22 or later and runs on macOS, Linux and Windows.",
	"toc-preview-login":
		"Run the login command and approve the request in your browser. The CLI stores a session for this machine only.",
	"toc-preview-token":
		"On a CI runner there is no browser, so create an access token in Settings and expose it as an environment variable.",
	"toc-preview-monitor":
		"Point a monitor at the URL you care about. The first check runs from three regions within a minute.",
	"toc-preview-next":
		"Choose who gets alerted, then publish a status page so customers see what you see.",
};

/** The source the page shows, matching the markup below. */
const CODE = `<TableOfContents
	label="On this page"
	items={[
		{ id: "install", text: "Install the CLI", level: 2 },
		{ id: "login", text: "Log in", level: 2 },
		{ id: "token", text: "Use a token in CI", level: 3 },
		{ id: "monitor", text: "Add a monitor", level: 2 },
		{ id: "next", text: "Next steps", level: 2 },
	]}
/>

{/* Below the rail width, fold it into the sticky bar */}
<TableOfContents label="On this page" items={items} layout="bar" />`;

/** What the preview registry reads: the source to show, and the guide and rail to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), hstack({ gap: 8, align: "start" })]}>
			<article mix={[vstack({ gap: 4 }), maxIs("32rem"), raw({ flex: "1 1 0" })]}>
				{ITEMS.map((item) => {
					let heading = [m(0), text(item.level === 3 ? "base" : "lg"), weight("semibold")];
					return (
						<section key={item.id} mix={[vstack({ gap: 2 })]}>
							{item.level === 3 ? (
								<h3 id={item.id} mix={heading}>
									{item.text}
								</h3>
							) : (
								<h2 id={item.id} mix={heading}>
									{item.text}
								</h2>
							)}
							<p mix={[m(0), fg("neutral"), raw({ minBlockSize: "14rem" })]}>{BODY[item.id]}</p>
						</section>
					);
				})}
			</article>
			<div mix={[sticky(), insBs("1rem"), is("13rem")]}>
				<TableOfContents items={ITEMS} label="On this page" />
			</div>
		</div>
	),
};
