/**
 * Live preview island for `Typeset`. The layer decides sizes, spacing and color for
 * markup it does not own, so a short pair of elements shows nothing: the example is
 * a full article excerpt — heading, lead, list, quote, code block, table and inline
 * link — rendered under the `reading` preset, plus a subtree opted out through
 * `data-not-typeset` so the escape hatch is visible too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { Badge, Typeset } from "@sdxc/ui";
import { clientEntry } from "remix/ui";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const TYPESET_CODE = `<Typeset preset="reading">
	<h2>Every fallible call answers with a Result</h2>

	<p>
		A function that can fail returns a <code>Result</code> instead of throwing, so the
		failure is part of the signature and the caller decides what to do with it. See the
		<a href="/api/result">result package</a> for the full surface.
	</p>

	<ul>
		<li>No exception escapes a package boundary.</li>
		<li>Every error case is named in the type.</li>
		<li>A caller that ignores the failure does not typecheck.</li>
	</ul>

	<blockquote>
		<p>The compiler is the only reviewer that reads every line.</p>
	</blockquote>

	<pre><code>{"let user = await findUser(id);\\nif (user.isErr) return notFound();"}</code></pre>

	<table>
		<thead>
			<tr>
				<th>Method</th>
				<th>Returns</th>
			</tr>
		</thead>
		<tbody>
			<tr>
				<td><code>unwrap()</code></td>
				<td>The value, or throws</td>
			</tr>
			<tr>
				<td><code>unwrapOr(fallback)</code></td>
				<td>The value, or the fallback</td>
			</tr>
		</tbody>
	</table>

	<div data-not-typeset>
		<Badge color="brand">Opted out of the layer</Badge>
	</div>
</Typeset>`;

/** A full article excerpt under the reading preset, hydrated alongside the rest of the catalogue. */
export const TypesetPreview = clientEntry(
	"/resources/components/previews/typeset.tsx#TypesetPreview",
	function TypesetPreview() {
		return () => (
			<Typeset preset="reading" mix={[is("100%"), maxIs("34rem")]}>
				<h2>Every fallible call answers with a Result</h2>

				<p>
					A function that can fail returns a <code>Result</code> instead of throwing, so the failure
					is part of the signature and the caller decides what to do with it. See the{" "}
					<a href="/api/result">result package</a> for the full surface.
				</p>

				<ul>
					<li>No exception escapes a package boundary.</li>
					<li>Every error case is named in the type.</li>
					<li>A caller that ignores the failure does not typecheck.</li>
				</ul>

				<blockquote>
					<p>The compiler is the only reviewer that reads every line.</p>
				</blockquote>

				<pre>
					<code>{"let user = await findUser(id);\nif (user.isErr) return notFound();"}</code>
				</pre>

				<table>
					<thead>
						<tr>
							<th>Method</th>
							<th>Returns</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>unwrap()</code>
							</td>
							<td>The value, or throws</td>
						</tr>
						<tr>
							<td>
								<code>unwrapOr(fallback)</code>
							</td>
							<td>The value, or the fallback</td>
						</tr>
					</tbody>
				</table>

				<div data-not-typeset>
					<Badge color="brand">Opted out of the layer</Badge>
				</div>
			</Typeset>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: TYPESET_CODE, render: () => <TypesetPreview /> };
