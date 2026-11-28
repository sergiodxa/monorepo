/**
 * Understory's about page body: who tends it, how the garden is organised and why posts get
 * updated rather than replaced, set as plain prose so the reading typeset does the styling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoBlogHref } from "~/resources/views/demo-blogs";

/** The addresses of Understory's pages. */
const href = demoBlogHref("understory");

/** The about page's prose, in the author's voice. */
export function UnderstoryAbout() {
	return () => (
		<>
			<p>
				I'm Wren, a software developer in Bristol. For the last few years I have built apps that
				keep working without a network: a local database on every device, a sync engine between
				them, and the merge rules that decide what happens when two people edit the same thing.
			</p>
			<p>
				An understory is the layer of a forest below the canopy, where most of the growing happens
				out of sight. Sync engines live there too, under the interface, and this blog is where I
				write about them.
			</p>
			<h2>How the garden works</h2>
			<p>
				Posts here are tended, not archived. When I learn something that changes an essay, I update
				it and its card says so. Everything still arrives in one feed in date order, and the filter
				bar narrows it:
			</p>
			<ul>
				<li>
					<a href={`${href()}?type=articles`}>Essays</a>, the long evergreen pieces, starting with{" "}
					<a href={href("articles/the-server-is-a-peer")}>The server is just another peer</a>.
				</li>
				<li>
					<a href={`${href()}?type=tutorials`}>Tutorials</a>, including the three-part{" "}
					<a href={href("tutorials/sync-from-scratch-change-log")}>Sync from scratch</a> series.
				</li>
				<li>
					<a href={`${href()}?type=notes`}>Notes</a>, small observations from the work.
				</li>
				<li>
					<a href={`${href()}?type=links`}>Links</a> to the writing that shaped how I build.
				</li>
				<li>
					A <a href={`${href()}?type=glossary`}>glossary</a> of sync vocabulary, linked from every
					post that uses a term.
				</li>
			</ul>
			<h2>Get in touch</h2>
			<p>
				I like hearing what you are building. Corrections are especially welcome: they go into the
				post, and the post's "tended" date moves. The newsletter sends one letter a season with what
				is new and what changed.
			</p>
		</>
	);
}
