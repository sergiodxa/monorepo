/**
 * Taking data out of Reader: the OPML of subscriptions, and the ZIP of everything kept,
 * with what each file in it holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { UiLabel, UiPath } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { DataScene } from "~/resources/components/marketing/scenes";
import { FactTable, H2, Scene } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "opml", text: "Download your subscriptions", level: 2 },
	{ id: "zip", text: "Download all your data", level: 2 },
];

/** The export guide's body. */
export default function Export(handle: Handle<DocBody.Props>) {
	return () => {
		let { t } = handle.props;
		return (
			<>
				<p>
					Everything you follow and keep is yours to take, on every plan. Both downloads are in{" "}
					<UiPath items={["Settings", "Carrying your subscriptions"]} />.
				</p>

				<H2 id="opml">Download your subscriptions</H2>
				<p>
					Press <UiLabel>Download as OPML</UiLabel>. The file lists every feed you follow, filed
					under your folders, and any other feed reader can import it.
				</p>

				<H2 id="zip">Download all your data</H2>
				<p>
					Press <UiLabel>Download all your data</UiLabel> for one ZIP holding:
				</p>
				<FactTable
					caption="What the ZIP of all your data holds."
					head={["Part", "What it holds"]}
					rows={[
						["Subscriptions, as OPML", "Every feed you follow, with its folder."],
						["Saved posts, as CSV", "Each saved post's title, link, excerpt and labels."],
						["Both, as JSON", "The same data, for scripts and other apps."],
					]}
				/>
				<p>The export holds each saved post's excerpt and link, not the article behind it.</p>
				<Scene caption="Your subscriptions and saved posts leave Reader as OPML, CSV and JSON.">
					<DataScene t={t} />
				</Scene>
			</>
		);
	};
}
