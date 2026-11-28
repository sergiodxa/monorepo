/**
 * Plinth's about page body: who writes it, what each kind of post is for and how to get in
 * touch, set as plain prose so the reading typeset around it does the styling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoBlogHref } from "~/resources/views/demo-blogs";

/** The addresses of Plinth's pages. */
const href = demoBlogHref("plinth");

/** The about page's prose, in the author's voice. */
export function PlinthAbout() {
	return () => (
		<>
			<p>
				I'm Teodora, a design-systems engineer in Rotterdam. I have spent eight years on the layer
				under product teams: the type scale, the colour tokens, the spacing rules and the components
				that turn all of it into something people can ship with.
			</p>
			<p>
				A plinth is the block a statue stands on. Nobody visits for the plinth, but without it the
				work sits in the mud. That is the job, and this is where I write down how I do it.
			</p>
			<h2>What you'll find here</h2>
			<ul>
				<li>
					<a href={`${href()}?type=articles`}>Articles</a> arguing for one way of building a system
					over another, with the reasons.
				</li>
				<li>
					<a href={`${href()}?type=tutorials`}>Tutorials</a> to follow along with, including the
					three-part <a href={href("tutorials/token-pipeline-source")}>Build a token pipeline</a>{" "}
					series.
				</li>
				<li>
					<a href={`${href()}?type=notes`}>Notes</a>, one CSS or type detail each, which open right
					in the index.
				</li>
				<li>
					<a href={`${href()}?type=links`}>Links</a> to tools and reading, each with why I keep it.
				</li>
				<li>
					A <a href={`${href()}?type=glossary`}>glossary</a> of the terms the rest of the site uses.
				</li>
			</ul>
			<h2>Corrections and contact</h2>
			<p>
				CSS moves quickly and I get things wrong. When I do, the post is corrected in place with a
				note saying what changed. The newsletter goes out every other Sunday with everything
				published since the last one, and replies reach me directly.
			</p>
		</>
	);
}
