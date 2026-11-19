/**
 * Bocado's gallery miniature: the cream bar with the mark and a cart pill, a row of cuisine
 * chips and two restaurant cards with their dishes, so the card reads as a delivery app
 * before its name is read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { Backdrop, DishArt } from "./art";
import { CUISINES, findRestaurant } from "./data";
import { BocadoMark } from "./shell";

/** The two cards the miniature shows. */
const CARDS = ["tres-empanadas", "todo-con-philadelphia"];

/** Renders the miniature on its own cream ground, whatever the gallery's scheme. */
export function BocadoThumbnail() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "grid",
					gridTemplateRows: "auto auto 1fr",
					gap: "6%",
					padding: "5% 6%",
					overflow: "clip",
					backgroundColor: "oklch(0.985 0.006 80)",
					color: "oklch(0.21 0.012 0)",
					fontFamily: "var(--ui-font-sans)",
				}),
			]}
		>
			<div
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.375rem",
						fontWeight: "800",
						fontSize: "0.875rem",
					}),
				]}
			>
				<BocadoMark size={18} />
				bocado
				<span mix={[raw({ flex: "1" })]} />
				<span
					mix={[
						raw({
							paddingInline: "0.5rem",
							paddingBlock: "0.125rem",
							borderRadius: "999px",
							fontSize: "0.625rem",
							color: "white",
							backgroundColor: "oklch(0.5 0.19 355)",
						}),
					]}
				>
					2 · $24.10
				</span>
			</div>
			<div mix={[raw({ display: "flex", gap: "4%" })]}>
				{CUISINES.slice(0, 5).map((cuisine) => (
					<span
						mix={[
							raw({
								inlineSize: "16%",
								aspectRatio: "1",
								padding: "2%",
								borderRadius: "0.5rem",
								backgroundColor: "oklch(0.95 0.012 70)",
							}),
						]}
					>
						<DishArt dish={cuisine.dish} />
					</span>
				))}
			</div>
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "1fr 1fr",
						gap: "5%",
						alignContent: "start",
					}),
				]}
			>
				{CARDS.map((id) => {
					let restaurant = findRestaurant(id)!;
					return (
						<div mix={[raw({ display: "grid", gap: "0.25rem" })]}>
							<span
								mix={[
									raw({
										display: "block",
										aspectRatio: "3 / 2",
										overflow: "clip",
										borderRadius: "0.5rem",
									}),
								]}
							>
								<Backdrop restaurant={restaurant}>
									<span mix={[raw({ inlineSize: "46%" })]}>
										<DishArt dish={restaurant.dish} />
									</span>
								</Backdrop>
							</span>
							<span
								mix={[
									raw({
										fontSize: "0.625rem",
										fontWeight: "750",
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
									}),
								]}
							>
								{restaurant.name}
							</span>
							<span
								mix={[
									raw({
										blockSize: "0.3rem",
										inlineSize: "70%",
										borderRadius: "999px",
										backgroundColor: "oklch(0.86 0.014 60)",
									}),
								]}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
}
