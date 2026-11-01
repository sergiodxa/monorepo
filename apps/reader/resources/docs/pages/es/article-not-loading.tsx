/**
 * The Spanish body of the article symptom page: one section per message the post page
 * shows, and the excerpt and link that always remain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { UiLabel } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { FactTable, H2Es } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "messages", text: "Qué significa el mensaje", level: 2 },
	{ id: "anyway", text: "Léelo de todos modos", level: 2 },
];

/** The article symptom page's body. */
export default function ArticleNotLoading(_handle: Handle<DocBody.Props>) {
	return () => (
		<>
			<p>
				En De pago y Premium, la página de una entrada trae el artículo que hay detrás de su enlace
				y lo muestra ahí mismo. Cuando no puede, explica por qué bajo el título{" "}
				<UiLabel>El artículo</UiLabel>.
			</p>

			<H2Es id="messages">Qué significa el mensaje</H2Es>
			<FactTable
				caption="Mensajes que muestra la página de una entrada en lugar del artículo."
				head={["Mensaje", "Qué significa"]}
				rows={[
					[
						"Leer artículos aquí mismo forma parte del plan de pago.",
						"Estás en Gratis. Cambia a De pago o Premium para leer artículos dentro de Reader.",
					],
					["Buscando el artículo…", "Todavía está en camino. Dale un momento."],
					[
						"Este sitio no permite leerlo aquí.",
						"El sitio del medio rechazó la petición, o su robots.txt pide a aplicaciones como Reader que no lo descarguen. Reader lo respeta.",
					],
					[
						"Esta página tardó demasiado en leerse.",
						"El sitio fue demasiado lento, o la página demasiado grande. Vuelve a abrir la entrada más tarde.",
					],
					[
						"No hay nada que leer aquí.",
						"La página llegó, pero no traía nada más allá del extracto que ya tienes.",
					],
				]}
			/>

			<H2Es id="anyway">Léelo de todos modos</H2Es>
			<p>
				Sea cual sea el mensaje, el título, el extracto y el enlace del feed se quedan en la página.
				Pulsa <UiLabel>Abrir el original</UiLabel> para leer la pieza en el sitio del medio.
			</p>
		</>
	);
}
