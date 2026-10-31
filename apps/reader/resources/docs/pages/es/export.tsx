/**
 * The Spanish body of the export page: the OPML of subscriptions, and the ZIP of
 * everything kept, with what each file in it holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { UiLabel, UiPath } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { DataScene } from "~/resources/components/marketing/scenes";
import { FactTable, H2Es, Scene } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "opml", text: "Descarga tus suscripciones", level: 2 },
	{ id: "zip", text: "Descarga todos tus datos", level: 2 },
];

/** The export guide's body. */
export default function Export(handle: Handle<DocBody.Props>) {
	return () => {
		let { t } = handle.props;
		return (
			<>
				<p>
					Todo lo que sigues y guardas es tuyo para llevártelo, en cualquier plan. Las dos descargas
					están en <UiPath items={["Preferencias", "Llevarte tus suscripciones"]} />.
				</p>

				<H2Es id="opml">Descarga tus suscripciones</H2Es>
				<p>
					Pulsa <UiLabel>Descargar como OPML</UiLabel>. El archivo lista cada feed que sigues,
					ordenado en tus carpetas, y cualquier otro lector de feeds puede importarlo.
				</p>

				<H2Es id="zip">Descarga todos tus datos</H2Es>
				<p>
					Pulsa <UiLabel>Descargar todos tus datos</UiLabel> para obtener un ZIP que contiene:
				</p>
				<FactTable
					caption="Lo que contiene el ZIP con todos tus datos."
					head={["Parte", "Qué contiene"]}
					rows={[
						["Suscripciones, en OPML", "Cada feed que sigues, con su carpeta."],
						[
							"Entradas guardadas, en CSV",
							"El título, el enlace, el extracto y las etiquetas de cada entrada guardada.",
						],
						["Ambos, en JSON", "Los mismos datos, para scripts y otras aplicaciones."],
					]}
				/>
				<p>
					La exportación incluye el extracto y el enlace de cada entrada guardada, no el artículo
					que hay detrás.
				</p>
				<Scene caption="Tus suscripciones y entradas guardadas salen de Reader en OPML, CSV y JSON.">
					<DataScene t={t} />
				</Scene>
			</>
		);
	};
}
