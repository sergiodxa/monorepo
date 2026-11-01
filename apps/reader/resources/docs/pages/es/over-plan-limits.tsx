/**
 * The Spanish body of the over-limits symptom page, after a downgrade, a lapse or a limit
 * change: what is kept, what pauses, and the two ways back inside.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { Callout, UiLabel, UiPath } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { H2Es } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "kept", text: "Qué se queda", level: 2 },
	{ id: "paused", text: "Qué se pausa", level: 2 },
	{ id: "back", text: "Vuelve a estar dentro de tu plan", level: 2 },
];

/** The over-limits symptom page's body. */
export default function OverPlanLimits(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures } = handle.props;
		return (
			<>
				<p>
					Puedes quedar por encima de tu plan después de pasar a uno más pequeño, o cuando un pago
					vence y pasan sus {figures.graceDays} días de margen.{" "}
					<UiPath items={["Preferencias", "Tu plan"]} /> muestra entonces{" "}
					<UiLabel>Por encima de tu plan</UiLabel> y dice por cuánto.
				</p>

				<H2Es id="kept">Qué se queda</H2Es>
				<Callout kind="note" label="Nota">
					<p>No se ha borrado nada, ni se borrará. Todo lo que sigues y guardaste se queda.</p>
				</Callout>

				<H2Es id="paused">Qué se pausa</H2Es>
				<ul>
					<li>Seguir feeds nuevos, mientras sigas más de los que permite tu plan.</li>
					<li>
						Guardar entradas nuevas, mientras tengas guardadas más de las que conserva tu plan.
					</li>
					<li>Fijar feeds y guardar búsquedas nuevas, más allá de los números de tu plan.</li>
					<li>
						Los filtros que superan el número de tu plan dejan de ejecutarse; en Gratis, se detienen
						todos.
					</li>
					<li>
						Entradas, más allá del número que conserva tu plan: Reader primero hace sitio retirando
						entradas que leíste y no guardaste, empezando por las más antiguas. Cuando no quedan,
						las entradas nuevas esperan.
					</li>
				</ul>

				<H2Es id="back">Vuelve a estar dentro de tu plan</H2Es>
				<p>Cualquiera de las dos formas funciona, y puedes combinarlas:</p>
				<ul>
					<li>
						Deja de seguir feeds o quita entradas guardadas hasta que Preferencias ya no muestre{" "}
						<UiLabel>Por encima de tu plan</UiLabel>.
					</li>
					<li>
						Cambia a un plan mayor desde <UiLabel>Tu plan</UiLabel>. Consulta{" "}
						<a href={docHref("plans")}>Planes y límites</a>.
					</li>
				</ul>
			</>
		);
	};
}
