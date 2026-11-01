/**
 * Driftwood's how-to guides: each one task, titled as the task, with the steps to do it,
 * the code to paste, and what to check when it doesn't work.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Steps } from "@sdxc/ui/docs";

import type { DemoDocsPage } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { Aside, Code, Fields, Heading, LanguageTabs } from "~/resources/views/demo-docs/blocks";

/** The addresses of Driftwood's pages. */
const href = demoDocsHref("driftwood");

/** Adding a domain: the command, the DNS record per provider, and the checks when it stalls. */
export const CUSTOM_DOMAINS: DemoDocsPage = {
	title: "Add a custom domain",
	description:
		"Serve a Driftwood site from a domain you own. Driftwood issues and renews its certificate for you.",
	updated: "2026-10-24",
	toc: [
		{ id: "add-the-domain", text: "Add the domain", level: 2 },
		{ id: "point-dns", text: "Point DNS at Driftwood", level: 2 },
		{ id: "wait-for-the-certificate", text: "Wait for the certificate", level: 2 },
		{ id: "troubleshooting", text: "Troubleshooting", level: 2 },
		{ id: "dns-not-found", text: "The domain doesn’t resolve", level: 3 },
		{ id: "certificate-pending", text: "The certificate stays pending", level: 3 },
	],
	next: [
		{
			title: "Caching and invalidation",
			href: href("concepts/caching"),
			description: "Why a change can take a minute to show on a new domain.",
		},
		{
			title: "Preview every pull request",
			href: href("guides/preview-deployments"),
			description: "Keep the domain for production and give branches their own URLs.",
		},
	],
	render: () => (
		<>
			<p>
				Add the domain to the project, create one DNS record at your provider, and Driftwood starts
				serving the site there once the record resolves, usually within ten minutes.
			</p>

			<Steps>
				<Steps.Item id="add-the-domain" title="Add the domain">
					<p>Run this in the project’s folder, with the domain you want to serve from.</p>
					<Code
						title="Terminal"
						language="sh"
						code={
							"driftwood domains add docs.example.com\n# Add this record at your DNS provider:\n#   CNAME  docs  my-site.driftwood.app"
						}
					/>
				</Steps.Item>
				<Steps.Item id="point-dns" title="Point DNS at Driftwood">
					<p>Create the record the command printed. Pick your provider for its exact form.</p>
					<LanguageTabs
						syncKey="driftwood-dns"
						aria-label="DNS provider"
						tabs={[
							{
								label: "Cloudflare",
								value: "cloudflare",
								language: "sh",
								title: "Terminal",
								code: "flarectl dns create --zone example.com --type CNAME \\\n  --name docs --content my-site.driftwood.app --proxy=false",
							},
							{
								label: "Route 53",
								value: "route53",
								language: "json",
								title: "change-batch.json",
								code: '{\n  "Changes": [{\n    "Action": "UPSERT",\n    "ResourceRecordSet": {\n      "Name": "docs.example.com",\n      "Type": "CNAME",\n      "TTL": 300,\n      "ResourceRecords": [{ "Value": "my-site.driftwood.app" }]\n    }\n  }]\n}',
							},
							{
								label: "Zone file",
								value: "zone",
								language: "txt",
								title: "example.com.zone",
								code: "docs  300  IN  CNAME  my-site.driftwood.app.",
							},
						]}
					/>
					<Aside kind="warning">
						Turn off your provider’s proxy for this record. A proxied record hides the domain from
						Driftwood, and the certificate is never issued.
					</Aside>
				</Steps.Item>
				<Steps.Item id="wait-for-the-certificate" title="Wait for the certificate">
					<p>
						Check the domain’s status. It reads <code>active</code> once the record resolves and the
						certificate is issued.
					</p>
					<Code
						title="Terminal"
						language="sh"
						code={
							"driftwood domains status docs.example.com\n# docs.example.com  active  certificate renews 2027-01-28"
						}
					/>
				</Steps.Item>
			</Steps>

			<Heading id="troubleshooting">Troubleshooting</Heading>
			<Heading id="dns-not-found" level={3}>
				The domain doesn’t resolve
			</Heading>
			<p>
				Look the record up yourself. If <code>dig</code> prints nothing, the record hasn’t reached
				your provider’s servers yet, or it was created on a different zone.
			</p>
			<Code title="Terminal" language="sh" code="dig +short CNAME docs.example.com" />
			<Heading id="certificate-pending" level={3}>
				The certificate stays pending
			</Heading>
			<p>
				A certificate waits on a CAA record that doesn’t name Driftwood’s issuer. Add{" "}
				<code>0 issue "letsencrypt.org"</code> to the domain’s CAA records, or remove them.
			</p>
		</>
	),
};

/** Preview deployments: the CI workflow per provider, synced, and the comment it posts. */
export const PREVIEW_DEPLOYMENTS: DemoDocsPage = {
	title: "Preview every pull request",
	description:
		"Deploy each branch to its own private URL from CI, and post the link on the pull request.",
	updated: "2026-10-29",
	toc: [
		{ id: "create-a-token", text: "Create a deploy token", level: 2 },
		{ id: "add-the-workflow", text: "Add the workflow", level: 2 },
		{ id: "how-previews-are-named", text: "How previews are named", level: 2 },
		{ id: "clean-up", text: "Clean up old previews", level: 2 },
	],
	next: [
		{
			title: "Use environment variables",
			href: href("guides/environment-variables"),
			description: "Give previews their own API keys, apart from production’s.",
		},
		{
			title: "How a deploy works",
			href: href("concepts/how-deploys-work"),
			description: "Why a preview never touches what production serves.",
		},
	],
	render: () => (
		<>
			<p>
				A preview is a full deploy of a branch at its own URL. It shares nothing with production but
				the project’s settings, so you can try a change on a real address before merging it.
			</p>

			<Heading id="create-a-token">Create a deploy token</Heading>
			<p>
				CI can’t open a browser to log in, so it deploys with a token. Create one scoped to this
				project and save it as a secret named <code>DRIFTWOOD_TOKEN</code> in your CI settings.
			</p>
			<Code
				title="Terminal"
				language="sh"
				code={"driftwood tokens create --project my-site --name ci\n# dw_live_2f9c…  (shown once)"}
			/>

			<Heading id="add-the-workflow">Add the workflow</Heading>
			<p>Commit this file. Every push to a branch with an open pull request deploys a preview.</p>
			<LanguageTabs
				syncKey="driftwood-ci"
				aria-label="CI provider"
				tabs={[
					{
						label: "GitHub Actions",
						value: "github",
						language: "yaml",
						title: ".github/workflows/preview.yml",
						code: "on: pull_request\n\njobs:\n  preview:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npx @driftwood/cli deploy --preview --comment\n        env:\n          DRIFTWOOD_TOKEN: ${{ secrets.DRIFTWOOD_TOKEN }}",
					},
					{
						label: "GitLab CI",
						value: "gitlab",
						language: "yaml",
						title: ".gitlab-ci.yml",
						code: "preview:\n  image: node:22\n  rules:\n    - if: $CI_PIPELINE_SOURCE == 'merge_request_event'\n  script:\n    - npx @driftwood/cli deploy --preview --comment",
					},
				]}
			/>
			<Aside kind="note">
				<code>--comment</code> posts the preview’s URL on the pull request and updates the same
				comment on every push, so the thread holds one link rather than one per commit.
			</Aside>

			<Heading id="how-previews-are-named">How previews are named</Heading>
			<p>
				A preview’s URL is the branch name, cleaned to letters, digits and dashes, before the
				project’s: <code>fix-nav.my-site.driftwood.app</code>. It stays the same for the branch’s
				whole life, so you can share it once.
			</p>

			<Heading id="clean-up">Clean up old previews</Heading>
			<p>
				Driftwood deletes a preview 14 days after its pull request closes. Delete one sooner with{" "}
				<code>driftwood previews rm fix-nav</code>.
			</p>
		</>
	),
};

/** Environment variables: setting them, the scopes, and the variables every deploy gets. */
export const ENVIRONMENT_VARIABLES: DemoDocsPage = {
	title: "Use environment variables",
	description:
		"Give your functions API keys and settings without committing them, with separate values for previews and production.",
	updated: "2026-10-18",
	toc: [
		{ id: "set-a-variable", text: "Set a variable", level: 2 },
		{ id: "read-it-in-a-function", text: "Read it in a function", level: 2 },
		{ id: "built-in-variables", text: "Built-in variables", level: 2 },
	],
	next: [
		{
			title: "Project layout",
			href: href("start/project-layout"),
			description: "Where functions live and which path each one answers.",
		},
		{
			title: "Preview every pull request",
			href: href("guides/preview-deployments"),
			description: "Try a new variable on a preview before production sees it.",
		},
	],
	render: () => (
		<>
			<p>
				Variables are stored encrypted with the project and handed to your functions at run time.
				Static files never see them, so a key can’t leak into the HTML.
			</p>

			<Heading id="set-a-variable">Set a variable</Heading>
			<p>
				Set a value for production, previews or both. A deploy reads the values as they are when it
				starts, so redeploy after changing one.
			</p>
			<Code
				title="Terminal"
				language="sh"
				code={
					"driftwood env set MAILING_LIST_KEY --production\n# Value: ••••••••\ndriftwood env set MAILING_LIST_KEY --preview"
				}
			/>
			<Aside kind="danger" title="Never pass a secret as an argument">
				A value typed after the name ends up in your shell history. Let the command prompt for it,
				or pipe it in from your password manager.
			</Aside>

			<Heading id="read-it-in-a-function">Read it in a function</Heading>
			<Code
				title="functions/api/subscribe.ts"
				language="ts"
				highlight={[2]}
				code={
					'export default async function subscribe(request: Request, env: Env) {\n\tlet key = env.MAILING_LIST_KEY;\n\tlet { email } = await request.json();\n\tawait fetch("https://lists.example.com/v1/members", {\n\t\tmethod: "POST",\n\t\theaders: { Authorization: `Bearer ${key}` },\n\t\tbody: JSON.stringify({ email }),\n\t});\n\treturn new Response(null, { status: 204 });\n}'
				}
			/>

			<Heading id="built-in-variables">Built-in variables</Heading>
			<p>Every deploy also sets these, which you can read but not override.</p>
			<Fields
				label="Built-in variables"
				rows={[
					{
						name: "DRIFTWOOD_ENV",
						type: '"production" | "preview"',
						required: true,
						description: "Which kind of deploy is running.",
					},
					{
						name: "DRIFTWOOD_URL",
						type: "string",
						required: true,
						description: "The deploy’s own URL, such as https://fix-nav.my-site.driftwood.app.",
					},
					{
						name: "DRIFTWOOD_GIT",
						type: "object",
						description: "Set when the deploy came from a Git push.",
						children: [
							{ name: "branch", type: "string", required: true, description: "The branch pushed." },
							{ name: "sha", type: "string", required: true, description: "The commit deployed." },
							{
								name: "pullRequest",
								type: "number",
								description: "The pull request number, on a preview.",
							},
						],
					},
				]}
			/>
		</>
	),
};
