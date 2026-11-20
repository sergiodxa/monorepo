/**
 * A sticky row of chips linking to the sections of one long page, such as a menu's
 * categories or a product's specs. The links work as plain anchors; once its island loads,
 * the chip of the section being read is marked and slides into view inside the row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { clientEntry } from "remix/component";

/** Prop types for {@link SectionBar}. */
export namespace SectionBar {
	/** One section the bar links to. */
	export interface Item {
		/** The section element's `id`, which the chip links to as `#id`. */
		id: string;
		label: string;
		/** A count after the label, such as how many dishes the category holds. */
		count?: number;
	}

	/** Props accepted by {@link SectionBar}; the host is a `<nav>`. */
	export interface Props extends Omit<TagProps<"nav">, "children"> {
		/** The bar's `id`, unique on the page; its island finds the bar by it. */
		id: string;
		/** The landmark's name, such as "Menu categories". */
		label: string;
		items: Item[];
		/**
		 * Where the bar sticks, as a CSS length from the top of the viewport, such as the
		 * height of a sticky top bar above it. Each section gives itself a `scroll-margin-top`
		 * of at least this plus the bar's own height, so a jump lands below the bar.
		 *
		 * @default "0px"
		 */
		top?: string;
	}

	/** Props {@link SectionBarSpy} serializes for hydration. */
	export type SpyProps = {
		/** The bar's `id`. */
		bar: string;
	};
}

/** The bar's own height, which a section's `scroll-margin-top` adds to the sticky offset. */
export const SECTION_BAR_BLOCK_SIZE = "3.25rem";

/**
 * Renders the bar: a `<nav>` holding a sideways-scrolling row of chip links, the first one
 * marked current until the island reads the scroll.
 *
 * @example
 * <SectionBar id="menu-bar" label="Menu categories" top="4rem" items={[{ id: "tacos", label: "Tacos", count: 3 }]} />
 */
export function SectionBar(handle: Handle<SectionBar.Props>) {
	return () => {
		let { id, label, items, top = "0px", mix, ...rest } = handle.props;
		return (
			<nav
				{...rest}
				id={id}
				aria-label={label}
				data-slot="section-bar"
				mix={mergeMix(
					[
						raw({
							position: "sticky",
							insetBlockStart: top,
							zIndex: "10",
							blockSize: SECTION_BAR_BLOCK_SIZE,
							display: "flex",
							alignItems: "center",
							backgroundColor: "color-mix(in oklch, var(--ui-bg, Canvas) 92%, transparent)",
							backdropFilter: "blur(12px) saturate(1.3)",
							WebkitBackdropFilter: "blur(12px) saturate(1.3)",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
					],
					mix,
				)}
			>
				<ul
					data-slot="section-bar-row"
					mix={[
						raw({
							display: "flex",
							gap: "0.375rem",
							inlineSize: "100%",
							margin: "0",
							paddingBlock: "0.5rem",
							paddingInline: "var(--ui-section-bar-inset, 1rem)",
							listStyle: "none",
							overflowX: "auto",
							overscrollBehaviorInline: "contain",
							scrollbarWidth: "none",
							scrollPaddingInline: "var(--ui-section-bar-inset, 1rem)",
							"&::-webkit-scrollbar": { display: "none" },
						}),
					]}
				>
					{items.map((item, index) => (
						<li mix={[raw({ flexShrink: "0" })]}>
							<a
								href={`#${item.id}`}
								data-section={item.id}
								aria-current={index === 0 ? "true" : undefined}
								mix={[
									raw({
										display: "inline-flex",
										alignItems: "center",
										gap: "0.375rem",
										blockSize: "2.25rem",
										paddingInline: "0.875rem",
										borderRadius: "999px",
										fontSize: "0.875rem",
										fontWeight: "550",
										whiteSpace: "nowrap",
										color: "var(--ui-neutral-fg)",
										textDecoration: "none",
										transition: "background-color 160ms ease, color 160ms ease",
									}),
									when(
										"&:hover",
										raw({
											color: "var(--ui-neutral-fg-emphasis)",
											backgroundColor: "var(--ui-neutral-bg-tint)",
										}),
									),
									when(
										"&[aria-current='true']",
										raw({
											color: "var(--ui-neutral-fg-on-solid)",
											backgroundColor: "var(--ui-neutral-bg-solid)",
										}),
									),
									when(
										"&:focus-visible",
										raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" }),
									),
									motionReduce(raw({ transition: "none" })),
								]}
							>
								{item.label}
								{item.count === undefined ? null : (
									<span
										data-slot="section-bar-count"
										mix={[
											raw({
												fontVariantNumeric: "tabular-nums",
												fontWeight: "500",
												opacity: "0.65",
											}),
										]}
									>
										{item.count}
									</span>
								)}
							</a>
						</li>
					))}
				</ul>
				<SectionBarSpy bar={id} />
			</nav>
		);
	};
}

/**
 * The island that follows the scroll: on each frame the page scrolls, the current section is
 * the last one whose top has passed under the bar, and its chip is marked and scrolled into
 * the row's view. A page scrolled to its end marks the last section, however short it is.
 */
export const SectionBarSpy: EntryComponent<SectionBar.SpyProps> = clientEntry(
	"@sdxc/ui/section-bar#SectionBarSpy",
	function SectionBarSpy(handle: Handle<SectionBar.SpyProps>) {
		let pending = false;
		let current = "";

		/** Marks one chip current and brings it into the row's view. */
		function mark(bar: HTMLElement, links: HTMLAnchorElement[], id: string) {
			if (id === current) return;
			current = id;
			let row = bar.querySelector<HTMLElement>('[data-slot="section-bar-row"]');
			for (let link of links) {
				let on = link.dataset.section === id;
				if (on) link.setAttribute("aria-current", "true");
				else link.removeAttribute("aria-current");
				if (on && row !== null) {
					let left = link.offsetLeft - (row.clientWidth - link.offsetWidth) / 2;
					let smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
					row.scrollTo({ left: Math.max(left, 0), behavior: smooth ? "smooth" : "instant" });
				}
			}
		}

		/** Reads which section is under the bar now. */
		function update(bar: HTMLElement) {
			pending = false;
			let links = [...bar.querySelectorAll<HTMLAnchorElement>("a[data-section]")];
			let line = bar.getBoundingClientRect().bottom + 8;
			let found = links[0]?.dataset.section ?? "";
			for (let link of links) {
				let section = document.getElementById(link.dataset.section ?? "");
				if (section !== null && section.getBoundingClientRect().top <= line) {
					found = link.dataset.section ?? found;
				}
			}
			let atEnd =
				Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2;
			if (atEnd) found = links.at(-1)?.dataset.section ?? found;
			mark(bar, links, found);
		}

		handle.queueTask(() => {
			let bar = document.getElementById(handle.props.bar);
			if (bar === null || handle.signal.aborted) return;
			let target = bar;
			let schedule = () => {
				if (pending) return;
				pending = true;
				requestAnimationFrame(() => update(target));
			};
			window.addEventListener("scroll", schedule, { passive: true, signal: handle.signal });
			window.addEventListener("resize", schedule, { passive: true, signal: handle.signal });
			update(target);
		});

		return () => <span hidden data-slot="section-bar-spy" />;
	},
);
