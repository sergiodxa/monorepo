/**
 * Live preview for `DocsHub`: the home of a product's help docs, opening on a search and
 * four topic chips, then the two pages a newcomer starts from, the sections with their page
 * counts, and the articles readers open most.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { HeadingScope, SearchField } from "@sdxc/ui";
import { DocsHub } from "@sdxc/ui/docs";

/** The source the page shows, matching the markup below. */
const CODE = `<DocsHub
	eyebrow="Help center"
	title="How can we help?"
	lead="Watch your sites, page the right person, and keep customers posted."
	search={
		<SearchField aria-label="Search the docs">
			<SearchField.Input name="q" placeholder="Search the docs" />
		</SearchField>
	}
	labels={{
		start: "Start here",
		sections: "Browse by topic",
		topics: "Popular topics",
		popular: "Popular articles",
	}}
	formatCount={(count) => (count === 1 ? "1 page" : \`\${count} pages\`)}
	topics={[
		{ title: "SMS alerts", href: "/examples/docs/alerts/sms" },
		{ title: "Check intervals", href: "/examples/docs/monitors/intervals" },
		{ title: "Custom domains", href: "/examples/docs/status-pages/domains" },
		{ title: "Invite your team", href: "/examples/docs/teams/invite" },
	]}
	start={[
		{
			eyebrow: "Quickstart",
			title: "Add your first monitor",
			href: "/examples/docs/quickstart",
			description: "Paste a URL and get paged the first time it stops answering.",
			cta: "Read the guide",
		},
		{
			eyebrow: "API",
			title: "Create monitors from code",
			href: "/examples/docs/api/overview",
			description: "Get a token, then create, pause and delete monitors over HTTP.",
			cta: "Read the overview",
		},
	]}
	sections={[
		{ title: "Monitors", href: "/examples/docs/monitors", description: "What gets checked, from where, and how often.", count: 9 },
		{ title: "Alerts", href: "/examples/docs/alerts", description: "Who gets paged, on which channel, and when.", count: 6 },
		{ title: "Status pages", href: "/examples/docs/status-pages", description: "Tell customers what is happening.", count: 4 },
		{ title: "Fix a problem", href: "/examples/docs/troubleshooting", description: "Alerts while your site is up, missing emails.", count: 7 },
	]}
	popular={[
		{ title: "I'm getting alerts but my site is up", href: "/examples/docs/troubleshooting/false-alerts" },
		{ title: "Send alerts to Slack", href: "/examples/docs/alerts/slack" },
		{ title: "Change how often a monitor runs", href: "/examples/docs/monitors/intervals" },
	]}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<HeadingScope>
				<DocsHub
					eyebrow="Help center"
					title="How can we help?"
					lead="Watch your sites, page the right person, and keep customers posted."
					search={
						<SearchField aria-label="Search the docs">
							<SearchField.Input name="q" placeholder="Search the docs" />
						</SearchField>
					}
					labels={{
						start: "Start here",
						sections: "Browse by topic",
						topics: "Popular topics",
						popular: "Popular articles",
					}}
					formatCount={(count) => (count === 1 ? "1 page" : `${count} pages`)}
					topics={[
						{ title: "SMS alerts", href: "/examples/docs/alerts/sms" },
						{ title: "Check intervals", href: "/examples/docs/monitors/intervals" },
						{ title: "Custom domains", href: "/examples/docs/status-pages/domains" },
						{ title: "Invite your team", href: "/examples/docs/teams/invite" },
					]}
					start={[
						{
							eyebrow: "Quickstart",
							title: "Add your first monitor",
							href: "/examples/docs/quickstart",
							description: "Paste a URL and get paged the first time it stops answering.",
							cta: "Read the guide",
						},
						{
							eyebrow: "API",
							title: "Create monitors from code",
							href: "/examples/docs/api/overview",
							description: "Get a token, then create, pause and delete monitors over HTTP.",
							cta: "Read the overview",
						},
					]}
					sections={[
						{
							title: "Monitors",
							href: "/examples/docs/monitors",
							description: "What gets checked, from where, and how often.",
							count: 9,
						},
						{
							title: "Alerts",
							href: "/examples/docs/alerts",
							description: "Who gets paged, on which channel, and when.",
							count: 6,
						},
						{
							title: "Status pages",
							href: "/examples/docs/status-pages",
							description: "Tell customers what is happening.",
							count: 4,
						},
						{
							title: "Fix a problem",
							href: "/examples/docs/troubleshooting",
							description: "Alerts while your site is up, missing emails.",
							count: 7,
						},
					]}
					popular={[
						{
							title: "I'm getting alerts but my site is up",
							href: "/examples/docs/troubleshooting/false-alerts",
						},
						{ title: "Send alerts to Slack", href: "/examples/docs/alerts/slack" },
						{ title: "Change how often a monitor runs", href: "/examples/docs/monitors/intervals" },
					]}
				/>
			</HeadingScope>
		</div>
	),
};
