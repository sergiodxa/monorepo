/**
 * The Spanish body of the stuck-feed symptom page: reading the feed page's last check,
 * checking it on demand, and telling a quiet feed apart from a failing one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { UiLabel } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { FactTable, H2Es } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "look", text: "Mira la última revisión del feed", level: 2 },
	{ id: "check", text: "Revísalo ahora", level: 2 },
	{ id: "failing", text: "Si sus revisiones fallan", level: 2 },
	{ id: "quiet", text: "Si el sitio dejó de publicar", level: 2 },
	{ id: "span", text: "Si las entradas llegan y luego desaparecen", level: 2 },
];

/** The stuck-feed symptom page's body. */
export default function FeedNotUpdating(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures } = handle.props;
		return (
			<>
				<H2Es id="look">Mira la última revisión del feed</H2Es>
				<p>
					Abre el feed en <UiLabel>Feeds</UiLabel>, en la barra lateral. Su cabecera dice cuándo se
					revisó por última vez y, cuando las revisiones fallan, cuántas fallaron seguidas y por
					qué.
				</p>

				<H2Es id="check">Revísalo ahora</H2Es>
				<p>
					Pulsa <UiLabel>Revisar feed</UiLabel>. Reader lo pide en ese momento y te dice si llegaron
					entradas nuevas, si no había nada nuevo o si no se pudo llegar al feed. En Lectura,{" "}
					<UiLabel>Revisar todos</UiLabel> hace lo mismo con cada feed.
				</p>

				<H2Es id="failing">Si sus revisiones fallan</H2Es>
				<FactTable
					caption="Lo que dice la insignia de un feed que falla, y qué hacer."
					head={["La insignia dice", "Qué hacer"]}
					rows={[
						[
							"El sitio respondió con un error",
							"El sitio tiene problemas o cambió su feed de sitio. Abre el sitio; si el feed se movió, sigue su nueva dirección y deja de seguir la antigua.",
						],
						[
							"No se pudo llegar al sitio",
							"El sitio está caído o va lento. Reader espera un poco más y lo vuelve a intentar; no tienes que hacer nada.",
						],
						[
							"No se pudo leer el feed",
							"El sitio envió algo que no es un feed válido. Si sigue pasando, busca en el sitio una nueva dirección del feed y síguela.",
						],
					]}
				/>

				<H2Es id="quiet">Si el sitio dejó de publicar</H2Es>
				<p>
					Un feed se revisa con la misma frecuencia con la que publica, desde cada{" "}
					{figures.pollFloor} para uno activo hasta una vez por semana cuando lleva un mes en
					silencio. Un feed sin nada nuevo pasa a <UiLabel>Tranquilos</UiLabel>, al final de la
					barra lateral. Es el sitio descansando, no Reader fallando.
				</p>

				<H2Es id="span">Si las entradas llegan y luego desaparecen</H2Es>
				<p>
					Puede que el plazo del feed sea corto: con De última hora, las entradas se van a las tres
					horas, leídas o no. Elige uno más largo en{" "}
					<UiLabel>Cuánto tiempo se quedan estas entradas</UiLabel>, o guarda las entradas que
					quieras conservar. Consulta <a href={docHref("feeds")}>Seguir y gestionar feeds</a>.
				</p>
			</>
		);
	};
}
