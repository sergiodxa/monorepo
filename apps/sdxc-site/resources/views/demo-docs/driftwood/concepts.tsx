/**
 * Driftwood's concept pages: how a deploy moves from a folder to a visitor, and how the
 * cache decides what a visitor sees, written to explain the why behind the guides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoDocsPage } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { Aside, Code, Heading } from "~/resources/views/demo-docs/blocks";

/** The addresses of Driftwood's pages. */
const href = demoDocsHref("driftwood");

/** How a deploy works: the four stages, and what makes the switch atomic. */
export const HOW_DEPLOYS_WORK: DemoDocsPage = {
	title: "How a deploy works",
	description:
		"What happens between running a deploy and its first visitor, and why a visitor never sees half a deploy.",
	updated: "2026-10-12",
	toc: [
		{ id: "build", text: "Build", level: 2 },
		{ id: "upload", text: "Upload what changed", level: 2 },
		{ id: "switch", text: "Switch traffic", level: 2 },
		{ id: "roll-back", text: "Roll back", level: 2 },
	],
	next: [
		{
			title: "Caching and invalidation",
			href: href("concepts/caching"),
			description: "What the switch means for the copies the edge already holds.",
		},
		{
			title: "Preview every pull request",
			href: href("guides/preview-deployments"),
			description: "Put the same four stages to work on every branch.",
		},
	],
	render: () => (
		<>
			<p>
				Every deploy makes a new version of the whole site, uploads only the files no earlier
				version had, and then points the site’s URL at it in one step. Old versions stay, which is
				what makes a rollback instant.
			</p>

			<Heading id="build">Build</Heading>
			<p>
				When <code>driftwood.toml</code> has a <code>[build]</code> command, it runs on your machine
				or your CI runner first. Driftwood never builds on its servers, so the output is exactly
				what you tested.
			</p>

			<Heading id="upload">Upload what changed</Heading>
			<p>
				The CLI hashes every file in <code>public/</code> and asks which hashes Driftwood has never
				seen. Only those upload; a one-line change to a large site uploads one file.
			</p>
			<Code
				title="Terminal"
				language="sh"
				code={"driftwood deploy --verbose\n# 412 files, 3 new (28 KB)\n# ✓ Version v_8k2m created"}
			/>

			<Heading id="switch">Switch traffic</Heading>
			<p>
				Once every file of the version is stored, the site’s URL is pointed at it. The pointer is
				one record, changed in one write, so a request is answered entirely by the old version or
				entirely by the new one.
			</p>
			<Aside kind="note">
				A visitor already on the page keeps the HTML they loaded. Files it asks for later come from
				the new version, which is why asset names should carry their hash.
			</Aside>

			<Heading id="roll-back">Roll back</Heading>
			<p>
				Rolling back is the same switch, pointed at an older version. Nothing rebuilds or
				re-uploads, so it takes as long as the first switch did.
			</p>
			<Code
				title="Terminal"
				language="sh"
				code={"driftwood rollback v_7q1d\n# ✓ my-site.driftwood.app now serves v_7q1d"}
			/>
		</>
	),
};

/** Caching: the default lifetimes, the headers to change them, and purging. */
export const CACHING: DemoDocsPage = {
	title: "Caching and invalidation",
	description:
		"How long the edge keeps each file, how to change that per path, and why you rarely need to purge.",
	updated: "2026-10-09",
	toc: [
		{ id: "defaults", text: "The defaults", level: 2 },
		{ id: "headers", text: "Set headers per path", level: 2 },
		{ id: "purge", text: "Purge by hand", level: 2 },
	],
	next: [
		{
			title: "Project layout",
			href: href("start/project-layout"),
			description: "Where the headers table lives in driftwood.toml.",
		},
		{
			title: "How a deploy works",
			href: href("concepts/how-deploys-work"),
			description: "Why a deploy invalidates HTML without a purge.",
		},
	],
	render: () => (
		<>
			<p>
				The edge keeps HTML until the next deploy and every other file for a year. A deploy changes
				which version the URL points at, so stale HTML is never served after one.
			</p>

			<Heading id="defaults">The defaults</Heading>
			<table>
				<thead>
					<tr>
						<th>Files</th>
						<th>Kept at the edge</th>
						<th>Kept in the browser</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>
							<code>*.html</code>
						</td>
						<td>Until the next deploy</td>
						<td>Revalidated every visit</td>
					</tr>
					<tr>
						<td>Everything else</td>
						<td>1 year</td>
						<td>1 hour</td>
					</tr>
				</tbody>
			</table>

			<Heading id="headers">Set headers per path</Heading>
			<p>
				Add a <code>[headers]</code> table to <code>driftwood.toml</code>. A key is a path pattern
				and its value the lifetime; the first pattern that matches wins.
			</p>
			<Code
				title="driftwood.toml"
				language="toml"
				add={[3]}
				code={
					'[headers]\n"/assets/*" = { cache = "1y", immutable = true }\n"/feed.xml" = { cache = "10m" }'
				}
			/>

			<Heading id="purge">Purge by hand</Heading>
			<p>
				Purge only a file whose name doesn’t change when its content does, such as an image you
				replaced in place.
			</p>
			<Code title="Terminal" language="sh" code="driftwood purge /images/team.jpg" />
			<Aside kind="tip">
				Give such files a hash or a version in their name and you’ll never need to purge them.
			</Aside>
		</>
	),
};
