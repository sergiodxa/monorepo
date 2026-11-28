/**
 * Low Tide's about page body: who writes it, what it covers and how to get in touch, set as
 * plain prose so the reading typeset around it does the styling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoBlogHref } from "~/resources/views/demo-blogs";

/** The addresses of Low Tide's pages. */
const href = demoBlogHref("lowtide");

/** The about page's prose, in the author's voice. */
export function LowTideAbout() {
	return () => (
		<>
			<p>
				I'm Maren, a platform engineer in Lisbon. For the last six years I have worked on the layer
				between websites and the people waiting for them: CDNs, caches, edge functions and the HTTP
				headers that tie them together.
			</p>
			<p>
				Low Tide is where I write down what I learn. The name is the idea: at low tide you can see
				what the water usually hides, and most of what makes a website fast or slow is hidden under
				the page.
			</p>
			<h2>What you'll find here</h2>
			<ul>
				<li>
					<a href={`${href()}?type=articles`}>Articles</a>, long arguments about how the web is
					delivered and what it costs.
				</li>
				<li>
					<a href={`${href()}?type=tutorials`}>Tutorials</a> you can follow along with, including
					the <a href={href("tutorials/edge-caching-headers")}>Edge caching from scratch</a> series.
				</li>
				<li>
					<a href={`${href()}?type=notes`}>Notes</a>, short things I learned this week.
				</li>
				<li>
					<a href={`${href()}?type=links`}>Links</a> to pages elsewhere, each with why I saved it.
				</li>
				<li>
					A <a href={`${href()}?type=glossary`}>glossary</a> of the words caching leans on.
				</li>
			</ul>
			<h2>Get in touch</h2>
			<p>
				I answer every email, slowly. If something here is wrong, I would rather know: corrections
				go in the post with a note saying what changed. The newsletter sends one email a month with
				everything published since the last.
			</p>
		</>
	);
}
