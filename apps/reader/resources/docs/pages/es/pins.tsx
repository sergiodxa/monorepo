/**
 * The Spanish body of the pins guide: what the strip above the queue shows, where a pin is
 * set and taken off, and how many each plan pins.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { UiLabel, UiPath } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { H2Es } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "pin", text: "Fija un feed", level: 2 },
	{ id: "strip", text: "Qué muestra la franja", level: 2 },
	{ id: "limit", text: "Cuántos puedes fijar", level: 2 },
];

/** The pins guide's body. */
export default function Pins(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures } = handle.props;
		return (
			<>
				<p>
					Fija los pocos feeds que nunca quieres perderte. Se quedan en una franja encima de tu
					cola, y primero en la barra lateral, así que los ves antes que todo lo demás.
				</p>

				<H2Es id="pin">Fija un feed</H2Es>
				<p>
					Abre la página del feed y elige <UiPath items={["Más acciones", "Fijar"]} />. En un feed
					fijado, el mismo menú dice <UiLabel>Dejar de fijar</UiLabel>.
				</p>

				<H2Es id="strip">Qué muestra la franja</H2Es>
				<p>
					La franja está arriba de Lectura. Cada feed fijado muestra cuántas entradas te esperan, o{" "}
					<UiLabel>Nada nuevo.</UiLabel> cuando estás al día. En la barra lateral, los feeds fijados
					aparecen primero, bajo <UiLabel>Fijados</UiLabel>.
				</p>

				<H2Es id="limit">Cuántos puedes fijar</H2Es>
				<p>
					Gratis fija {figures.freePins} feeds; De pago y Premium fijan {figures.pinLimit}. Cuando
					llegues a tu límite, deja de fijar uno o cambia a un plan mayor para fijar otro.
				</p>
			</>
		);
	};
}
