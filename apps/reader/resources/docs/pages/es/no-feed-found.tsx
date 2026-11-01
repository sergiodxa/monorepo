/**
 * The Spanish body of the no-feed symptom page: one section per cause, in the order they
 * are worth trying, each matched to the message Reader shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { UiLabel } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { H2Es } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "no-feed", text: "“En esa dirección no hay ningún feed RSS ni Atom”", level: 2 },
	{ id: "unreachable", text: "“No se pudo llegar a esa dirección”", level: 2 },
	{ id: "invalid", text: "“Esa no es una dirección que esta aplicación pueda pedir”", level: 2 },
	{ id: "already", text: "“Ya sigues ese feed”", level: 2 },
	{ id: "limit", text: "“Tu plan sigue … feeds”", level: 2 },
];

/** The no-feed symptom page's body. */
export default function NoFeedFound(_handle: Handle<DocBody.Props>) {
	return () => (
		<>
			<p>
				Busca el mensaje que Reader mostró bajo el cuadro para seguir y prueba lo que dice su
				sección.
			</p>

			<H2Es id="no-feed">"En esa dirección no hay ningún feed RSS ni Atom"</H2Es>
			<p>
				La página que pegaste no es un feed ni enlaza a uno. Reader busca el enlace que un sitio
				pone en sus páginas para anunciar su feed, y algunos sitios no lo incluyen.
			</p>
			<ul>
				<li>
					Busca en el sitio un enlace <strong>RSS</strong>, <strong>Atom</strong> o{" "}
					<strong>Feed</strong>, a menudo en el pie de página, y pega esa dirección.
				</li>
				<li>
					Prueba con la página de inicio del sitio en lugar de un artículo: es donde la mayoría de
					los sitios anuncian su feed.
				</li>
				<li>
					Prueba las direcciones habituales: el sitio seguido de <code>/feed</code>,{" "}
					<code>/rss</code>, <code>/atom.xml</code> o <code>/index.xml</code>.
				</li>
			</ul>
			<p>Algunos sitios no publican ningún feed. Reader solo puede seguir RSS y Atom.</p>

			<H2Es id="unreachable">"No se pudo llegar a esa dirección"</H2Es>
			<p>
				El sitio no respondió a tiempo o rechazó la petición. Comprueba que la dirección se abre en
				tu navegador y vuelve a intentarlo en un momento.
			</p>

			<H2Es id="invalid">"Esa no es una dirección que esta aplicación pueda pedir"</H2Es>
			<p>
				Pega la dirección completa, empezando por <code>https://</code> o <code>http://</code>.
			</p>

			<H2Es id="already">"Ya sigues ese feed"</H2Es>
			<p>
				El feed ya está en tu barra lateral en <UiLabel>Feeds</UiLabel>, quizá dentro de una
				carpeta, en <UiLabel>Fijados</UiLabel>, o en <UiLabel>Tranquilos</UiLabel> al final.
			</p>

			<H2Es id="limit">"Tu plan sigue … feeds"</H2Es>
			<p>Sigues tantos feeds como permite tu plan. Deja de seguir uno, o cambia de plan.</p>
		</>
	);
}
