/**
 * The compile band: a schema beside the function Plumb generates from it, as two file
 * tabs, so the page's central claim is shown as the code it produces. The copy names the
 * one place compiling at runtime does not fit and how Plumb handles it.
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

/** The schema a reader writes. */
const SCHEMA = `import { p } from "plumb";

export const User = p.object({
  id: p.string().uuid(),
  email: p.string().email(),
  name: p.string().min(1).max(80),
  age: p.number().int().min(13).optional(),
  roles: p.array(p.enum(["admin", "editor", "viewer"])),
});

export type User = p.Infer<typeof User>;`;

/** What \`plumb inspect User\` prints: the function the schema compiles to. */
const COMPILED = `// plumb inspect User
function parseUser(v, out) {
  if (typeof v !== "object" || v === null)
    return out.fail([], "object", v);
  let id = v.id;
  if (typeof id !== "string" || !UUID.test(id))
    return out.fail(["id"], "uuid", id);
  let email = v.email;
  if (typeof email !== "string" || !EMAIL.test(email))
    return out.fail(["email"], "email", email);
  let name = v.name;
  if (typeof name !== "string" || name.length < 1 || name.length > 80)
    return out.fail(["name"], "string(1..80)", name);
  let age = v.age;
  if (age !== undefined && !(Number.isInteger(age) && age >= 13))
    return out.fail(["age"], "int >= 13", age);
  let roles = v.roles;
  if (!Array.isArray(roles)) return out.fail(["roles"], "array", roles);
  for (let i = 0; i < roles.length; i++) {
    let r = roles[i];
    if (r !== "admin" && r !== "editor" && r !== "viewer")
      return out.fail(["roles", i], "enum", r);
  }
  return { id, email, name, age, roles };
}`;

/**
 * Renders the band: the claim and its guarantees at the start, the two files at the end,
 * opening on the schema so the generated code is one click away.
 *
 * @returns The render function producing the band.
 */
export function CompileChapter() {
	return () => (
		<LandingSection id="compile" ruled mix={[renderNearView(439, 881)]}>
			<Split lean="media">
				<Split.Copy>
					<LandingHeader
						eyebrow="$ plumb inspect"
						description={
							<>
								Plumb walks your schema once and emits one function: no loop over rules, no
								closures, <strong>no allocation on the happy path</strong>. Print it with{" "}
								<code>plumb inspect</code> and read it like code you wrote.
							</>
						}
					>
						Read the code it runs
					</LandingHeader>
					<CheckList>
						<CheckRow>Compiled once, when the module loads</CheckRow>
						<CheckRow>Every issue keeps its path, like roles[2]</CheckRow>
						<CheckRow>Strict CSP and Workers: precompile with plumb build</CheckRow>
					</CheckList>
				</Split.Copy>
				<Split.Media>
					<CodeStage
						variant="code"
						lineNumbers
						name="plumb-compile"
						tabs={[
							{ label: "user.ts", content: SCHEMA, language: "ts" },
							{ label: "user.compiled.js", content: COMPILED, language: "js" },
						]}
					/>
				</Split.Media>
			</Split>
		</LandingSection>
	);
}
