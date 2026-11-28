/**
 * Saltbox's about page body: who writes it, what each kind of post holds and how to reach
 * the author, set as plain prose so the reading typeset around it does the styling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoBlogHref } from "~/resources/views/demo-blogs";

/** The addresses of Saltbox's pages. */
const href = demoBlogHref("saltbox");

/** The about page's prose, in the author's voice. */
export function SaltboxAbout() {
	return () => (
		<>
			<p>
				I'm Wren, a backend engineer in St. John's. I have spent the last nine years writing Go
				services and keeping the Postgres databases under them healthy, first at a logistics company
				and now for a handful of small businesses that would rather own their servers than rent a
				platform.
			</p>
			<p>
				A saltbox is the house you see all over Newfoundland: a long roof sloping down the back,
				plain clapboard, built to stand up to the weather for a century. That is the kind of
				software I like to write, and the kind of blog I wanted, too.
			</p>
			<h2>What you'll find here</h2>
			<ul>
				<li>
					<a href={`${href()}?type=articles`}>Articles</a> on how Go and Postgres behave once real
					traffic arrives.
				</li>
				<li>
					<a href={`${href()}?type=tutorials`}>Tutorials</a> you can follow on your own server,
					including the three-part{" "}
					<a href={href("tutorials/static-binary-and-systemd")}>Self-hosting a Go service</a>.
				</li>
				<li>
					<a href={`${href()}?type=notes`}>Notes</a>, short things I learned at work this week.
				</li>
				<li>
					<a href={`${href()}?type=links`}>Links</a> to documentation and writing I keep going back
					to.
				</li>
				<li>
					A <a href={`${href()}?type=glossary`}>glossary</a> of the terms the rest leans on.
				</li>
			</ul>
			<h2>Comments and corrections</h2>
			<p>
				Comments are closed, but my inbox is open: reply to any post by email and I read every
				message. When a reader catches a mistake, I fix the post and add a line at the bottom saying
				what changed and who spotted it.
			</p>
		</>
	);
}
