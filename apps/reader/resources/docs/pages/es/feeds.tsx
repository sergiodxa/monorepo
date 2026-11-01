/**
 * The Spanish body of everything a reader does to one feed: following it, checking it on
 * demand, choosing how long its posts stay, keeping its links as published, unfollowing
 * it, and how often a feed is checked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { Callout, UiLabel, UiPath } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { CadenceScene } from "~/resources/components/marketing/scenes";
import { FactTable, H2Es, Scene } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "follow", text: "Sigue un feed", level: 2 },
	{ id: "feed-page", text: "La página de un feed", level: 2 },
	{ id: "checks", text: "Cada cuánto se revisan los feeds", level: 2 },
	{ id: "span", text: "Cuánto tiempo se quedan las entradas", level: 2 },
	{ id: "links", text: "Conserva los parámetros del enlace", level: 2 },
	{ id: "unfollow", text: "Deja de seguir un feed", level: 2 },
];

/** The feeds guide's body. */
export default function Feeds(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<H2Es id="follow">Sigue un feed</H2Es>
				<p>
					Pega una dirección en <UiLabel>Sigue un feed o un sitio…</UiLabel>, en la parte superior
					de Lectura. Sirve cualquier feed RSS o Atom, y también un sitio que anuncie uno. Tu plan
					fija cuántos puedes seguir: {figures.freeFeeds} en Gratis, {figures.paidFeeds} en De pago
					y {figures.premiumFeeds} en Premium.
				</p>

				<H2Es id="feed-page">La página de un feed</H2Es>
				<p>
					Elige un feed en <UiLabel>Feeds</UiLabel>, en la barra lateral, para ver solo sus
					entradas. Su cabecera indica cuándo se revisó por última vez y, si las revisiones están
					fallando, por qué. Ahí hay dos botones: <UiLabel>Revisar feed</UiLabel> y{" "}
					<UiLabel>Marcar feed leído</UiLabel>. Todo lo demás está en{" "}
					<UiLabel>Más acciones</UiLabel>:
				</p>
				<ul>
					<li>
						<UiLabel>Fijar</UiLabel>: consulta{" "}
						<a href={docHref("pins")}>Fijar feeds sobre tu cola</a>.
					</li>
					<li>
						<UiLabel>Avisarme de esta fuente</UiLabel>: consulta{" "}
						<a href={docHref("notifications")}>Recibir avisos de entradas nuevas</a>.
					</li>
					<li>
						<UiLabel>Conservar los parámetros del enlace</UiLabel>, más abajo.
					</li>
					<li>
						<UiLabel>Cuánto tiempo se quedan estas entradas</UiLabel>, más abajo.
					</li>
					<li>
						<UiLabel>En qué carpeta se lee este feed</UiLabel>: consulta{" "}
						<a href={docHref("folders")}>Agrupar feeds en carpetas</a>.
					</li>
					<li>
						<UiLabel>Dejar de seguir</UiLabel>, más abajo.
					</li>
				</ul>

				<H2Es id="checks">Cada cuánto se revisan los feeds</H2Es>
				<p>
					Cada feed se revisa tan a menudo como publica: cada {figures.pollFloor} para un feed que
					publica diez veces al día, a diario para uno tranquilo, y semanalmente cuando lleva un mes
					en silencio. Un feed que casi no publica pasa al grupo <UiLabel>Tranquilos</UiLabel>, al
					final de la barra lateral.
				</p>
				<Scene caption="Un feed activo se revisa cada pocos minutos, uno tranquilo a diario y uno en silencio cada semana.">
					<CadenceScene t={t} />
				</Scene>
				<p>
					Para revisarlo antes, pulsa <UiLabel>Revisar feed</UiLabel> en su página, o{" "}
					<UiLabel>Revisar todos</UiLabel> en Lectura.
				</p>

				<H2Es id="span">Cuánto tiempo se quedan las entradas</H2Es>
				<p>
					Abre <UiPath items={["Más acciones", "Cuánto tiempo se quedan estas entradas"]} /> y elige
					un plazo. Las entradas más antiguas salen de tu cola, leídas o no. Las entradas guardadas
					se quedan siempre. Un feed nuevo conserva sus entradas para siempre hasta que elijas otra
					cosa.
				</p>
				<FactTable
					caption="Los plazos durante los que un feed puede conservar sus entradas."
					head={["Plazo", "Las entradas se quedan"]}
					rows={[
						["De última hora", "3 horas"],
						["Noticias", "18 horas"],
						["Artículos", "3 días"],
						["Ensayos", "2 semanas"],
						["Siempre", "No se va nunca"],
					]}
				/>
				<p>
					Cuando un feed activo lo conserva todo, su página sugiere un plazo más corto para que no
					se convierta en una acumulación de pendientes.
				</p>

				<H2Es id="links">Conserva los parámetros del enlace</H2Es>
				<p>
					Reader quita los parámetros de seguimiento de los enlaces que da un feed. Si los enlaces
					de un sitio se rompen sin ellos, elige{" "}
					<UiPath items={["Más acciones", "Conservar los parámetros del enlace"]} /> y los enlaces
					se abren tal como se publicaron. <UiLabel>Quitar los parámetros del enlace</UiLabel>{" "}
					vuelve a activar la limpieza.
				</p>

				<H2Es id="unfollow">Deja de seguir un feed</H2Es>
				<p>
					Elige <UiPath items={["Más acciones", "Dejar de seguir"]} /> y confirma.
				</p>
				<Callout kind="warning" label="Atención">
					<p>
						Al dejar de seguir un feed se van con él sus entradas y lo que hayas leído de ellas. Las
						entradas guardadas se quedan.
					</p>
				</Callout>
			</>
		);
	};
}
