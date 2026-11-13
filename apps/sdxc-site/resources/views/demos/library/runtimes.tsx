/**
 * The runtimes band: the same `User` schema validating a request body in four servers, one
 * file tab each, so a reader finds their own stack and sees the call is the same in all of
 * them. The Workers tab imports the precompiled module, as Workers forbid runtime codegen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	CheckList,
	CheckRow,
	CodeStage,
	LandingHeader,
	LandingSection,
	Split,
} from "@sdxc/ui/landing";

import { renderNearView } from "~/resources/views/demos/near-view";

/** A Remix route: the action reads the body from the request the router hands it. */
const REMIX = `import { route } from "remix/routes";
import { createRouter } from "remix/router";
import { User } from "./schemas";

let routes = route({ users: "/users" });
let router = createRouter();

router.post(routes.users, async ({ request }) => {
  let result = User.safeParse(await request.json());
  if (!result.ok) return Response.json(result.issues, { status: 422 });
  let user = await db.users.insert(result.value);
  return Response.json(user, { status: 201 });
});`;

/** A Hono route. */
const HONO = `import { Hono } from "hono";
import { User } from "./schemas";

let app = new Hono();

app.post("/users", async (c) => {
  let result = User.safeParse(await c.req.json());
  if (!result.ok) return c.json(result.issues, 422);
  return c.json(await db.users.insert(result.value), 201);
});`;

/** A Next.js route handler. */
const NEXT = `import { User } from "@/schemas";

export async function POST(request: Request) {
  let result = User.safeParse(await request.json());
  if (!result.ok) {
    return Response.json(result.issues, { status: 422 });
  }
  let user = await db.users.insert(result.value);
  return Response.json(user, { status: 201 });
}`;

/** A Cloudflare Worker, reading the module \`plumb build\` wrote at build time. */
const WORKER = `// precompiled by \`plumb build\`: Workers forbid eval
import { User } from "./schemas.plumb.js";

export default {
  async fetch(request, env) {
    let result = User.safeParse(await request.json());
    if (!result.ok) return Response.json(result.issues, { status: 422 });
    let user = await env.DB.insertUser(result.value);
    return Response.json(user, { status: 201 });
  },
};`;

/**
 * Renders the band: the guarantees at the start and the four files at the end, bleeding
 * off the page's edge so the code reads as a window onto a longer file.
 *
 * @returns The render function producing the band.
 */
export function RuntimesChapter() {
	return () => (
		<LandingSection id="runtimes" ruled mix={[renderNearView(417, 718)]}>
			<Split lean="media">
				<Split.Copy>
					<LandingHeader
						eyebrow="examples/"
						description={
							<>
								A schema is a value you import. <code>safeParse</code> returns the typed value or a
								list of issues, <strong>never throws</strong>, and reads the same in every server.
							</>
						}
					>
						One schema, every server
					</LandingHeader>
					<CheckList>
						<CheckRow>Implements Standard Schema v1</CheckRow>
						<CheckRow>ESM and CommonJS, types included</CheckRow>
						<CheckRow>Issues serialize to JSON as they are</CheckRow>
					</CheckList>
				</Split.Copy>
				<Split.Media bleed="end">
					<CodeStage
						variant="code"
						lineNumbers
						name="plumb-runtimes"
						tabs={[
							{ label: "remix.ts", content: REMIX, language: "ts" },
							{ label: "hono.ts", content: HONO, language: "ts" },
							{ label: "next.ts", content: NEXT, language: "ts" },
							{ label: "worker.js", content: WORKER, language: "js" },
						]}
					/>
				</Split.Media>
			</Split>
		</LandingSection>
	);
}
