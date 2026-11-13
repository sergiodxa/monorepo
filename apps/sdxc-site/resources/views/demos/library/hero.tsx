/**
 * Plumb's opening band: the claim and the install line beside a terminal that installs
 * the library, checks two schemas and benchmarks one, so the first screen is the tool
 * doing what the headline says, with a faint neon glow as the page's one flourish.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { LinkButton } from "@sdxc/ui";
import { AccentText, LandingHero, TypedTerminal } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import { RELEASE } from "~/resources/views/demos/library/data";
import { InstallLine } from "~/resources/views/demos/library/install-line";

/**
 * The session the terminal plays: install, check, benchmark. Every figure matches the
 * benchmark band, and the last line is the one failing fixture, so the run reads as real;
 * each line fits a phone's terminal without scrolling.
 */
const SESSION: readonly TypedTerminal.Line[] = [
	{ kind: "input", text: "bun add plumb" },
	{ kind: "output", text: `+ plumb@${RELEASE.version}  0 dependencies`, status: "muted" },
	{ kind: "input", text: "bunx plumb check src/schemas" },
	{ kind: "output", text: "✓ User     12 fields  0.4 ms", status: "ok" },
	{ kind: "output", text: "✓ Address   5 fields  0.1 ms", status: "ok" },
	{ kind: "input", text: "bunx plumb bench User" },
	{ kind: "output", text: "User.parse  39.6M ops/s  ±0.8%", status: "ok" },
	{ kind: "output", text: "✗ users[812].email  not an email", status: "fail" },
];

/**
 * Renders the hero with the copy at the start and the terminal at the end. The glow is
 * a backdrop behind the terminal, hidden from assistive technology and still under
 * reduced motion.
 *
 * @returns The render function producing the hero.
 */
export function LibraryHero() {
	return () => (
		<LandingHero
			align="start"
			mediaPlacement="end"
			tone="plain"
			entrance
			eyebrow="TypeScript schema validation"
			title={
				<>
					Schemas that <AccentText variant="color">compile</AccentText> to plain ifs
				</>
			}
			description={
				<>
					Plumb turns a schema into straight-line JavaScript once, when the module loads. Parsing a
					request body then runs <strong>the checks you would have written by hand</strong>, with
					the type inferred and every error carrying its path.
				</>
			}
			actions={
				<>
					<InstallLine name="plumb-install-hero" />
					<LinkButton href="#docs" variant="surface" mix={[landingCtaChrome()]}>
						Read the quickstart
					</LinkButton>
				</>
			}
			note="MIT · 0 dependencies · 2.9 kB min+gzip · Node 18+, Bun, Deno and Workers"
			release={
				<a href="#changelog">{`v${RELEASE.version} · Async refinements, ${RELEASE.date}`}</a>
			}
			backdrop={
				<div
					mix={[
						raw({
							position: "absolute",
							inset: "-10% -20%",
							background:
								"radial-gradient(closest-side, color-mix(in oklch, var(--ui-brand-bg-solid) 16%, transparent), transparent)",
							filter: "blur(24px)",
						}),
					]}
				/>
			}
			media={
				<TypedTerminal
					variant="code"
					aria-label="Installing plumb, checking two schemas and benchmarking one"
					pauseLabel="Pause the session"
					title="~/api — zsh"
					prompt="$"
					lines={SESSION}
				/>
			}
		/>
	);
}
