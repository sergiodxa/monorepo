/**
 * Live preview for `TitleHero`: a series' hero with its drawn art behind the text, an eyebrow,
 * the title, its rating and facts, a summary and the Play and My List actions. The art is a
 * gradient standing in for key art, and it holds still under reduced motion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Button, LinkButton } from "@sdxc/ui";
import { TitleHero } from "@sdxc/ui/video";

/** The source the page shows, matching the markup below apart from the drawn art. */
const CODE = `<TitleHero
	size="title"
	art={<img src="/art/tidewater.jpg" alt="" />}
	aria-labelledby="tidewater-title"
>
	<TitleHero.Eyebrow>Original series</TitleHero.Eyebrow>
	<TitleHero.Title id="tidewater-title" level={1}>Tidewater</TitleHero.Title>
	<TitleHero.Facts>
		<TitleHero.Rating>16+</TitleHero.Rating>
		<span>2026</span>
		<span>2 seasons</span>
		<span>Drama · Mystery</span>
	</TitleHero.Facts>
	<TitleHero.Summary>
		When the last ferry of the year comes in a passenger short, the harbourmaster
		starts asking questions the island has spent forty winters not answering.
	</TitleHero.Summary>
	<TitleHero.Actions>
		<LinkButton href="/watch/tidewater/1-1" color="brand">Play S1:E1</LinkButton>
		<Button variant="surface">My List</Button>
	</TitleHero.Actions>
</TitleHero>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			class="dark"
			mix={[
				raw({
					inlineSize: "100%",
					overflow: "clip",
					borderRadius: "0.75rem",
					backgroundColor: "var(--ui-bg)",
					"--ui-title-hero-title-size": "26rem",
					"--ui-title-hero-inset": "2rem",
				}),
			]}
		>
			<TitleHero
				size="title"
				aria-labelledby="title-hero-preview"
				art={
					<span
						mix={[
							raw({
								background:
									"radial-gradient(circle at 72% 64%, oklch(0.9 0.08 85) 0 6%, transparent 7%), radial-gradient(ellipse at 72% 70%, oklch(0.8 0.08 85 / 0.35), transparent 40%), linear-gradient(oklch(0.2 0.05 235), oklch(0.5 0.09 205) 68%, oklch(0.24 0.05 220))",
							}),
						]}
					/>
				}
			>
				<TitleHero.Eyebrow>Original series</TitleHero.Eyebrow>
				<TitleHero.Title
					id="title-hero-preview"
					level={2}
					mix={[raw({ fontFamily: "Didot, 'Bodoni 72', Georgia, serif", fontWeight: "400" })]}
				>
					Tidewater
				</TitleHero.Title>
				<TitleHero.Facts>
					<TitleHero.Rating>16+</TitleHero.Rating>
					<span>2026</span>
					<span>2 seasons</span>
					<span>Drama · Mystery</span>
				</TitleHero.Facts>
				<TitleHero.Summary>
					When the last ferry of the year comes in a passenger short, the harbourmaster starts
					asking questions the island has spent forty winters not answering.
				</TitleHero.Summary>
				<TitleHero.Actions>
					<LinkButton href="#play" color="brand">
						Play S1:E1
					</LinkButton>
					<Button variant="surface">My List</Button>
				</TitleHero.Actions>
			</TitleHero>
		</div>
	),
};
