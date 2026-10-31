/**
 * The Spanish body of moving to Reader from another feed reader: exporting OPML there,
 * importing it here, and reading the counts the import reports back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { Callout, Steps, UiLabel, UiPath } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { DataScene } from "~/resources/components/marketing/scenes";
import { Faq, H2Es, Scene } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "export", text: "Exporta desde tu lector anterior", level: 2 },
	{ id: "import", text: "Importa el archivo", level: 2 },
	{ id: "results", text: "Lee lo que dice la importación", level: 2 },
	{ id: "questions", text: "Preguntas", level: 2 },
];

/** The import guide's body. */
export default function ImportOpml(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<p>
					OPML es el archivo que usan todos los lectores de feeds para llevar una lista de
					suscripciones. Reader sigue cada feed que contiene y conserva las carpetas que describe.
				</p>

				<H2Es id="export">Exporta desde tu lector anterior</H2Es>
				<p>
					Busca en los ajustes de tu lector anterior <strong>Export</strong>,{" "}
					<strong>Download OPML</strong> o <strong>Subscriptions</strong>. Obtendrás un archivo
					pequeño que termina en <code>.opml</code> o <code>.xml</code>. Feedly, Inoreader, Feedbin
					y NewsBlur lo ofrecen.
				</p>

				<H2Es id="import">Importa el archivo</H2Es>
				<Steps>
					<Steps.Item title="Abre Preferencias">
						<p>
							Abre el menú con tu nombre al pie de la barra lateral y elige{" "}
							<UiLabel>Preferencias</UiLabel>.
						</p>
					</Steps.Item>
					<Steps.Item title="Elige el archivo">
						<p>
							En <UiLabel>Llevarte tus suscripciones</UiLabel>, elige tu archivo en{" "}
							<UiLabel>Archivo OPML</UiLabel>.
						</p>
					</Steps.Item>
					<Steps.Item title="Importa">
						<p>
							Pulsa <UiLabel>Importar</UiLabel>. Reader sigue cada feed del archivo y lo guarda en
							la carpeta que indica el archivo. Las entradas empiezan a llegar a{" "}
							<UiPath items={["Lectura"]} /> en menos de un minuto.
						</p>
					</Steps.Item>
				</Steps>
				<Scene caption="Las suscripciones entran y salen de Reader como OPML, con sus carpetas incluidas.">
					<DataScene t={t} />
				</Scene>

				<H2Es id="results">Lee lo que dice la importación</H2Es>
				<p>Preferencias informa de lo que pasó con cada feed del archivo:</p>
				<ul>
					<li>
						<strong>Ahora sigues</strong>: feeds nuevos que ya están en tu cola.
					</li>
					<li>
						<strong>Ya seguías</strong>: feeds que ya tenías, que se quedan como estaban.
					</li>
					<li>
						<strong>No se pudo obtener</strong>: la dirección no respondió con un feed. Consulta{" "}
						<a href={docHref("no-feed-found")}>Reader dice que un sitio no tiene feed</a>.
					</li>
					<li>
						<strong>Quedó fuera</strong>: feeds que superan el límite de tu plan. Gratis sigue{" "}
						{figures.freeFeeds} feeds, De pago {figures.paidFeeds} y Premium {figures.premiumFeeds}.
					</li>
				</ul>
				<Callout kind="note" label="Nota">
					<p>
						Las carpetas forman parte del plan De pago. En Gratis se siguen igualmente todos los
						feeds del archivo, sin carpeta, y no se crea ninguna carpeta. Un feed que ya sigues
						conserva la carpeta en la que lo pusiste, así que después de mejorar tu plan organizas
						los feeds desde la página de cada uno.
					</p>
				</Callout>

				<H2Es id="questions">Preguntas</H2Es>
				<Faq
					items={[
						{
							question: "¿Puedo importar el mismo archivo dos veces?",
							answer: <p>Sí. Los feeds que ya sigues cuentan como ya seguidos y no se tocan.</p>,
						},
						{
							question: "¿Hay un límite de tamaño?",
							answer: (
								<p>
									Reader lee archivos de hasta un megabyte. Una lista de suscripciones ocupa unos
									cientos de kilobytes como mucho.
								</p>
							),
						},
						{
							question: "¿Se traen mis entradas leídas y guardadas?",
							answer: (
								<p>
									No. OPML solo lleva la lista de feeds. Las entradas recientes de cada feed llegan
									nuevas, sin leer.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}
