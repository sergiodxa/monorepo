/**
 * Every hand-written card in Encore's deck, in each language the pages are written in, copied
 * from the app's string catalog: the playable card on the landing deals from it, so a reader
 * draws exactly the challenges the app deals. Regenerate it when the app's cards change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EncoreLocale } from "~/config/encore";

/** One hand-written card: its uppercase title and its challenge. */
export interface DeckEntry {
	title: string;
	prompt: string;
}

/** The deck in each language, in the app's card order. */
export const ENCORE_DECK: Record<EncoreLocale, ReadonlyArray<DeckEntry>> = {
	en: [
		{
			title: "GUILTY PLEASURE",
			prompt: "Sing a song you're slightly embarrassed to admit you love.",
		},
		{
			title: "MAIN CHARACTER",
			prompt: "Sing the song that would play during your big scene if your life were a movie.",
		},
		{
			title: "TIME MACHINE",
			prompt: "Sing a song that instantly takes you back to a specific moment in your life.",
		},
		{ title: "BREAKUP ANTHEM", prompt: "Sing the song you played on repeat after a breakup." },
		{ title: "FIRST CONCERT", prompt: "Sing something by the first artist you ever saw live." },
		{
			title: "CHILDHOOD CLASSIC",
			prompt: "Sing a song you loved as a child—the one that still lives rent-free in your head.",
		},
		{
			title: "QUARTER-LIFE CRISIS",
			prompt:
				"Sing a song that perfectly describes the feeling of not knowing what you're doing with your life.",
		},
		{ title: "SHOWER SONG", prompt: "Sing the song you actually sing in the shower." },
		{
			title: "HIDDEN TALENT",
			prompt: "Sing something from a genre people wouldn't expect from you.",
		},
		{
			title: "THE ONE THAT GOT AWAY",
			prompt: "Sing a song about someone who left—or about leaving.",
		},
		{
			title: "EVERYBODY KNOWS THIS ONE",
			prompt:
				"Choose a song you believe every single person here knows. Everyone joins in on the chorus.",
		},
		{
			title: "FLOOR FILLER",
			prompt: "Sing the song that would empty the bar if the DJ played it right now.",
		},
		{ title: "THE FINALE", prompt: "Sing the song that closes out every legendary night." },
		{
			title: "CROWD PLEASER",
			prompt:
				"Sing something that guarantees everyone in this room will sing along, whether they want to or not.",
		},
		{
			title: "KARAOKE CHAMPION",
			prompt:
				"Sing whatever you'd choose to absolutely destroy at karaoke. Pull out all the stops.",
		},
		{
			title: "POWER BALLAD",
			prompt: "Sing a power ballad. The dramatic variety. Both hands on the mic stand optional.",
		},
		{
			title: "DIVA MOMENT",
			prompt: "Sing a song that demands full vocal power and total conviction. No holding back.",
		},
		{ title: "GUITAR HERO", prompt: "Sing a song you air-guitar to. Bonus points for the solo." },
		{ title: "BOY BAND ANTHEM", prompt: "Sing a song from a boy band—golden era preferred." },
		{ title: "ONE-HIT WONDER", prompt: "Sing the only song you know by a particular artist." },
		{ title: "TEARJERKER", prompt: "Sing a song that has genuinely made you cry." },
		{ title: "ROCK ANTHEM", prompt: "Sing a rock song intended to be played at maximum volume." },
		{ title: "SLOW DANCE", prompt: "Sing a song suited for a slow dance—the romantic kind." },
		{
			title: "MUSICAL THEATRE",
			prompt: "Sing a song from a musical. Full theatrical commitment expected.",
		},
		{
			title: "MOVIE MOMENT",
			prompt: "Sing a song from a film soundtrack—the one that made the scene unforgettable.",
		},
		{ title: "TV THEME SONG", prompt: "Sing the opening theme from a TV show." },
		{ title: "CLUB BANGER", prompt: "Sing a song built for a packed dance floor at 1am." },
		{ title: "LOST IN TRANSLATION", prompt: "Sing a song in a language you don't actually speak." },
		{ title: "BEFORE YOUR TIME", prompt: "Sing a song that was a hit before you were born." },
		{ title: "Y2K PANIC", prompt: "Sing something quintessentially from the early 2000s." },
		{ title: "NINETIES FLASHBACK", prompt: "Sing the most 1990s song you can think of." },
		{
			title: "TOTALLY EIGHTIES",
			prompt: "Sing something so 1980s you can hear the synthesisers from a mile away.",
		},
		{ title: "ROAD TRIP", prompt: "Sing a song you play loudly in a car with the windows down." },
		{
			title: "SUMMER ANTHEM",
			prompt: "Sing the definitive song of a summer that mattered to you.",
		},
		{
			title: "RAINY AFTERNOON",
			prompt: "Sing a song for staying in on a grey day—cosy, reflective, unhurried.",
		},
		{
			title: "LATE NIGHT REGRETS",
			prompt: "Sing a song that only makes complete sense after midnight.",
		},
		{
			title: "MORNING SONG",
			prompt: "Sing something you'd hum while making coffee—bright, easy, optimistic.",
		},
		{ title: "COMING HOME", prompt: "Sing a song about home—or about missing it." },
		{
			title: "VICTORY SONG",
			prompt: "Sing the song that plays in your head when everything has gone exactly right.",
		},
		{
			title: "SECRETLY SAD BANGER",
			prompt:
				"Sing an upbeat, danceable song with lyrics that are actually devastating if you listen carefully.",
		},
		{
			title: "ANGRY PLAYLIST",
			prompt: "Sing a song from the playlist you put on when you're furious.",
		},
		{ title: "HAPPY CRY", prompt: "Sing a song that makes you cry but in the best possible way." },
		{
			title: "GYM MOTIVATION",
			prompt: "Sing the song you'd play on the last set of a brutal workout.",
		},
		{
			title: "FALLING IN LOVE",
			prompt: "Sing a song about that specific feeling of falling for someone.",
		},
		{
			title: "NEW YEAR'S EVE",
			prompt:
				"Sing a song that belongs at midnight on New Year's Eve—the kind that makes people feel something.",
		},
		{ title: "EARWORM", prompt: "Sing the song currently stuck in your head. You know the one." },
		{
			title: "UNEXPECTED FAVOURITE",
			prompt:
				"Sing a song from a genre you normally claim not to like—but somehow it's a favourite.",
		},
		{
			title: "DEDICATION",
			prompt: "Sing a song for someone in this room. Make it clear who it's for.",
		},
		{
			title: "NEVER SANG THIS BEFORE",
			prompt: "Sing a song you have never attempted at karaoke before tonight.",
		},
		{
			title: "THE COMEBACK",
			prompt: "Sing a song that sounds like returning in triumph after a long absence.",
		},
		{ title: "FRIENDSHIP FOREVER", prompt: "Sing a song that means friendship to you." },
		{ title: "LOVE LETTER", prompt: "Sing a song that functions as a genuine love letter." },
		{
			title: "SOMEONE ELSE'S HEARTBREAK",
			prompt: "Sing a heartbreak song that wasn't written for you—but you felt it anyway.",
		},
		{ title: "EMPOWERMENT", prompt: "Sing a song that makes you feel unstoppable." },
		{ title: "FAMILY REUNION", prompt: "Sing a song your family sings together." },
		{
			title: "TEENAGE REBELLION",
			prompt:
				"Sing the song you blasted as a teenager to signal that you were done being told what to do.",
		},
		{
			title: "GROWING APART",
			prompt: "Sing a song about a friendship or relationship that slowly ended.",
		},
		{
			title: "THE CRUSH SONG",
			prompt: "Sing a song that perfectly captured how it felt to have a crush you never told.",
		},
		{
			title: "LATE STARTER",
			prompt:
				"Sing a song you only discovered long after everyone else—and you're still catching up.",
		},
		{
			title: "DUET WITH A STRANGER",
			prompt: "Pick someone you've never sung with before. Sing a duet together—right now.",
		},
		{
			title: "NO LYRICS",
			prompt: "Sing a song without looking at the screen. Words only from memory.",
		},
		{
			title: "EYES CLOSED",
			prompt: "Sing your chosen song with your eyes completely closed the whole time.",
		},
		{
			title: "OVERACT IT",
			prompt:
				"Choose any song and perform it with dramatic, theatrical commitment—every word, every pause.",
		},
		{
			title: "PERFECT IMPERSONATION",
			prompt: "Sing a song while doing your best impression of the original artist.",
		},
		{
			title: "EVERYONE JOINS THE CHORUS",
			prompt:
				"Sing the verses solo—but hold the mic out for the chorus. Everyone sings it together.",
		},
		{
			title: "TRADE LINES",
			prompt: "Pick a partner. Alternate lines—one person gets the even lines, one gets the odd.",
		},
		{
			title: "WRONG VOICE",
			prompt: "Sing a song built for a completely different vocal range from yours.",
		},
		{
			title: "HALF AND HALF",
			prompt: "One singer takes the first half of the song, another takes the second half.",
		},
		{ title: "COLOR IN THE TITLE", prompt: "Sing a song that has a color somewhere in its title." },
		{ title: "NUMBER IN THE TITLE", prompt: "Sing a song whose title contains a number." },
		{ title: "ONE-WORD TITLE", prompt: "Sing a song with a title that is exactly one word long." },
		{ title: "QUESTION IN THE TITLE", prompt: "Sing a song whose title is phrased as a question." },
		{
			title: "SOMEONE'S NAME IN THE TITLE",
			prompt: "Sing a song that has a person's name in the title.",
		},
		{
			title: "DAY IN THE TITLE",
			prompt: "Sing a song that mentions a day of the week or a month in its title.",
		},
		{ title: "WEDDING SONG", prompt: "Sing a song you'd choose for a first dance at a wedding." },
		{ title: "GRADUATION", prompt: "Sing the song that defined the end of a chapter for you." },
		{
			title: "SPORTS ANTHEM",
			prompt: "Sing a song that belongs at a stadium—triumphant, enormous, built for crowds.",
		},
		{ title: "REBELLIOUS TEEN", prompt: "Sing a song your parents asked you to turn down." },
		{
			title: "HOLIDAY CLASSIC",
			prompt: "Sing a seasonal song—the one that immediately makes the room feel festive.",
		},
		{ title: "DREAMS", prompt: "Sing a song about dreams—the sleeping kind or the waking kind." },
		{
			title: "NOSTALGIA OVERLOAD",
			prompt:
				"Sing the song that, every time it plays, makes you feel like you're seventeen again.",
		},
		{ title: "HOMETOWN", prompt: "Sing a song that makes you think of where you grew up." },
		{ title: "FIRST DANCE", prompt: "Sing the first song you ever danced to with someone." },
		{
			title: "GOING OUT",
			prompt: "Sing the song you'd play while getting ready for a big night out.",
		},
		{
			title: "THE LAST SONG",
			prompt: "Sing the song you'd want playing as the very last song of a perfect night.",
		},
		{
			title: "FAMOUS IN YOUR HEAD",
			prompt:
				"Sing a deep cut from your favourite artist—the one you think more people should know.",
		},
		{
			title: "THE WRONG DECADE",
			prompt: "Sing a song from a decade before you were old enough to have heard it at the time.",
		},
		{
			title: "THE SLOW BUILD",
			prompt: "Sing a song that starts quietly and ends in something close to chaos.",
		},
		{
			title: "THE EARWORM DEALER",
			prompt: "Sing the catchiest, most relentlessly hummable song you know. Infect the room.",
		},
		{
			title: "SOMEONE ELSE'S FAVOURITE",
			prompt:
				"Sing a song that you know someone in this room loves but you'd never normally choose.",
		},
		{
			title: "COVER ONLY",
			prompt:
				"Sing a cover version—not the original. Specifically the version performed by someone else.",
		},
		{
			title: "TOO LONG SINCE YOU SANG THIS",
			prompt: "Sing a song you loved years ago and haven't sung in a very long time.",
		},
		{
			title: "THE PROPOSAL",
			prompt: "Sing a song romantic enough that someone could plausibly propose during the bridge.",
		},
		{
			title: "PARTY STARTER",
			prompt: "Sing the song that immediately raises the energy in any room the moment it begins.",
		},
		{ title: "THE APOLOGY", prompt: "Sing a song that functions as a sincere apology to someone." },
		{ title: "METAL MOMENT", prompt: "Sing something heavy. Louder than you normally go." },
		{
			title: "SING IT STRAIGHT",
			prompt:
				"Sing a song you've always parodied or joked about—but this time completely sincerely.",
		},
		{
			title: "ENCORE",
			prompt: "You earned it. Sing whatever you want. No rules, no restrictions.",
		},
		{
			title: "BEST OF DECADE",
			prompt: "Sing the song you consider the best of whichever decade you choose.",
		},
		{
			title: "MORNING AFTER",
			prompt: "Sing a mellow song for the quiet end of a long, good night.",
		},
		{
			title: "THE VILLAIN SONG",
			prompt:
				"Sing a song that could plausibly belong to a movie villain—menacing, confident, a little theatrical.",
		},
		{ title: "FOREIGN FAVOURITE", prompt: "Sing a hit from a country that isn't your own." },
		{
			title: "LOVE LANGUAGE",
			prompt: "Sing a song that, to you, communicates love better than words alone could.",
		},
		{
			title: "FIRST HEARTBREAK",
			prompt: "Sing a song that captured exactly how your first heartbreak felt.",
		},
		{
			title: "THREE CHORDS",
			prompt: "Sing a simple, classic song—the kind built on three chords and pure feeling.",
		},
		{
			title: "WALK-OUT MUSIC",
			prompt:
				"Sing the song you'd want playing as you walked into the biggest moment of your life.",
		},
		{
			title: "CAMP CLASSIC",
			prompt:
				"Sing a song so unironic, so earnest, so gloriously over the top—and mean every word.",
		},
		{
			title: "SOMEONE FAMOUS SHARES YOUR NAME",
			prompt: "Sing a song named after someone who shares your first name—or someone in this room.",
		},
	],
	"es-AR": [
		{
			title: "PLACER CULPOSO",
			prompt: "Cantá una canción que te da un poco de vergüenza admitir que te encanta.",
		},
		{
			title: "PERSONAJE PRINCIPAL",
			prompt: "Cantá la canción que sonaría en tu gran escena si tu vida fuera una película.",
		},
		{
			title: "MÁQUINA DEL TIEMPO",
			prompt: "Cantá una canción que te lleva instantáneamente a un momento específico de tu vida.",
		},
		{
			title: "HIMNO DE RUPTURA",
			prompt: "Cantá la canción que escuchabas en repetición después de una ruptura.",
		},
		{ title: "PRIMER CONCIERTO", prompt: "Cantá algo del primer artista que viste en concierto." },
		{
			title: "CLÁSICO DE INFANCIA",
			prompt: "Cantá una canción que amabas de chico o chica—la que sigue viviendo en tu cabeza.",
		},
		{
			title: "CRISIS DE LOS VEINTICINCO",
			prompt:
				"Cantá una canción que describe perfectamente la sensación de no saber qué hacer con tu vida.",
		},
		{ title: "CANCIÓN DE DUCHA", prompt: "Cantá la canción que realmente cantás en la ducha." },
		{ title: "TALENTO OCULTO", prompt: "Cantá algo de un género que nadie esperaría de ti." },
		{
			title: "EL QUE SE FUE",
			prompt: "Cantá una canción sobre alguien que se fue—o sobre el que se va.",
		},
		{
			title: "ESTA LA SABE TODOS",
			prompt:
				"Elegí una canción que creas que absolutamente todos aquí conocen. Todos se unen en el estribillo.",
		},
		{
			title: "LLENA LA PISTA",
			prompt: "Cantá la canción que vaciaría el bar si el DJ la pusiera ahora mismo.",
		},
		{ title: "EL FINAL", prompt: "Cantá la canción que cierra todas las noches legendarias." },
		{
			title: "PARA EL PÚBLICO",
			prompt:
				"Cantá algo que garantice que todos en esta sala cantarán junto contigo, quieran o no.",
		},
		{
			title: "CAMPEÓN DEL KARAOKE",
			prompt: "Cantá lo que elegirías para destrozarlo totalmente en el karaoke. Sin reservas.",
		},
		{
			title: "POWER BALLAD",
			prompt:
				"Cantá un power ballad. La variedad dramática. Las dos manos en el pie del micrófono, opcional.",
		},
		{
			title: "MOMENTO DIVA",
			prompt:
				"Cantá una canción que exige plena potencia vocal y total convicción. Sin medias tintas.",
		},
		{
			title: "HÉROE DE LA GUITARRA",
			prompt: "Cantá una canción que te hace tocar guitarra imaginaria. Puntos extra por el solo.",
		},
		{
			title: "HIMNO DE BOY BAND",
			prompt: "Cantá una canción de un boy band—preferiblemente de la era dorada.",
		},
		{
			title: "ARTISTA DE UN ÉXITO",
			prompt: "Cantá la única canción que conocés de un artista en particular.",
		},
		{ title: "DESGARRA LÁGRIMAS", prompt: "Cantá una canción que te haya hecho llorar de verdad." },
		{
			title: "HIMNO ROCKERO",
			prompt: "Cantá una canción de rock hecha para sonar a máximo volumen.",
		},
		{ title: "BAILE LENTO", prompt: "Cantá una canción para un baile lento—del tipo romántico." },
		{
			title: "TEATRO MUSICAL",
			prompt: "Cantá una canción de un musical. Se espera pleno compromiso teatral.",
		},
		{
			title: "MOMENTO DE PELÍCULA",
			prompt: "Cantá una canción de una película—la que hizo la escena inolvidable.",
		},
		{ title: "TEMA DE SERIE", prompt: "Cantá el tema de apertura de una serie de televisión." },
		{
			title: "HIT DE BOLICHE",
			prompt: "Cantá una canción hecha para una pista de baile abarrotada a la 1 de la madrugada.",
		},
		{
			title: "PERDIDO EN LA TRADUCCIÓN",
			prompt: "Cantá una canción en un idioma que en realidad no hablas.",
		},
		{
			title: "ANTES DE TU ÉPOCA",
			prompt: "Cantá una canción que fue un éxito antes de que nacieras.",
		},
		{ title: "FIEBRE DE LOS 2000", prompt: "Cantá algo típicamente de los primeros años 2000." },
		{
			title: "RECUERDO DE LOS NOVENTA",
			prompt: "Cantá la canción más noventera que se te ocurra.",
		},
		{
			title: "TOTALMENTE OCHENTERO",
			prompt:
				"Cantá algo tan años 80 que puedes escuchar los sintetizadores a kilómetros de distancia.",
		},
		{
			title: "VIAJE EN CARRETERA",
			prompt: "Cantá una canción que ponés a todo volumen en el auto con las ventanas bajadas.",
		},
		{ title: "HIMNO DE VERANO", prompt: "Cantá la canción definitiva de un verano que importó." },
		{
			title: "TARDE LLUVIOSA",
			prompt:
				"Cantá una canción para quedarse en casa un día gris—acogedora, reflexiva, sin prisa.",
		},
		{
			title: "REMORDIMIENTOS DE MADRUGADA",
			prompt: "Cantá una canción que solo tiene sentido completo después de medianoche.",
		},
		{
			title: "CANCIÓN MATUTINA",
			prompt: "Cantá algo que tararearías mientras haces el café—alegre, fácil, optimista.",
		},
		{ title: "DE REGRESO A CASA", prompt: "Cantá una canción sobre el hogar—o sobre extrañarlo." },
		{
			title: "CANCIÓN DE VICTORIA",
			prompt: "Cantá la canción que suena en tu cabeza cuando todo ha salido exactamente bien.",
		},
		{
			title: "BOMBAZO TRISTEMENTE OCULTO",
			prompt:
				"Cantá una canción animada y bailable cuya letra es en realidad devastadora si escuchas con atención.",
		},
		{
			title: "LISTA DE CANCIONES FURIOSAS",
			prompt: "Cantá una canción de la lista que ponés cuando estás furioso o furiosa.",
		},
		{
			title: "LLANTO DE ALEGRÍA",
			prompt: "Cantá una canción que te hace llorar, pero de la mejor manera posible.",
		},
		{
			title: "MOTIVACIÓN DE GIMNASIO",
			prompt: "Cantá la canción que pondrías en la última serie de un entrenamiento brutal.",
		},
		{
			title: "ENAMORÁNDOSE",
			prompt: "Cantá una canción sobre esa sensación específica de enamorarse.",
		},
		{
			title: "NOCHEVIEJA",
			prompt:
				"Cantá una canción que pertenece a la medianoche de Año Nuevo—del tipo que hace sentir algo a la gente.",
		},
		{
			title: "PEGADIZO",
			prompt: "Cantá la canción que tenés pegada en la cabeza en este momento. Ya sabés cuál es.",
		},
		{
			title: "FAVORITA INESPERADA",
			prompt:
				"Cantá una canción de un género que normalmente dices que no te gusta—pero que de alguna manera es tu favorita.",
		},
		{
			title: "DEDICATORIA",
			prompt: "Cantá una canción para alguien de esta sala. Dejá claro a quién va dedicada.",
		},
		{
			title: "NUNCA CANTÉ ESTO ANTES",
			prompt: "Cantá una canción que nunca has intentado en el karaoke hasta esta noche.",
		},
		{
			title: "EL REGRESO TRIUNFAL",
			prompt: "Cantá una canción que suene como un regreso triunfal después de una larga ausencia.",
		},
		{ title: "AMISTAD ETERNA", prompt: "Cantá una canción que para ti significa amistad." },
		{
			title: "CARTA DE AMOR",
			prompt: "Cantá una canción que funcione como una auténtica carta de amor.",
		},
		{
			title: "EL DESAMOR DE OTRO",
			prompt:
				"Cantá una canción de desamor que no fue escrita para ti—pero que sentiste de todas formas.",
		},
		{ title: "EMPODERAMIENTO", prompt: "Cantá una canción que te haga sentir imparable." },
		{ title: "REUNIÓN FAMILIAR", prompt: "Cantá una canción que tu familia canta junta." },
		{
			title: "REBELDÍA ADOLESCENTE",
			prompt:
				"Cantá la canción que ponías a todo volumen de adolescente para decir que ya no te iban a mandar más.",
		},
		{
			title: "ALEJÁNDONOS",
			prompt: "Cantá una canción sobre una amistad o relación que terminó poco a poco.",
		},
		{
			title: "LA CANCIÓN DEL AMOR SECRETO",
			prompt:
				"Cantá una canción que capturara perfectamente cómo se sentía tener un amor secreto que nunca confesaste.",
		},
		{
			title: "TARDÍO DESCUBRIMIENTO",
			prompt: "Cantá una canción que descubriste mucho después que los demás—y aún estás al día.",
		},
		{
			title: "DÚO CON UN DESCONOCIDO",
			prompt: "Elegí a alguien con quien nunca hayas cantado antes. Canten un dúo—ahora mismo.",
		},
		{
			title: "SIN LETRA",
			prompt: "Cantá una canción sin mirar la pantalla. Solo las palabras que recordás.",
		},
		{
			title: "CON LOS OJOS CERRADOS",
			prompt: "Cantá la canción que elijas con los ojos completamente cerrados todo el tiempo.",
		},
		{
			title: "SOBREACTÚALO",
			prompt:
				"Elegí cualquier canción e interprétala con un compromiso dramático y teatral—cada palabra, cada pausa.",
		},
		{
			title: "IMITACIÓN PERFECTA",
			prompt: "Cantá una canción mientras haces tu mejor imitación del artista original.",
		},
		{
			title: "TODOS AL ESTRIBILLO",
			prompt:
				"Cantá las estrofas en solitario—pero acercá el micrófono para el estribillo. Todos lo cantan juntos.",
		},
		{
			title: "INTERCAMBIO DE VERSOS",
			prompt:
				"Elegí un compañero o compañera. Altérnense los versos—uno canta los pares, otro los impares.",
		},
		{
			title: "VOZ EQUIVOCADA",
			prompt: "Cantá una canción hecha para un registro vocal completamente diferente al tuyo.",
		},
		{
			title: "MITAD Y MITAD",
			prompt: "Un cantante se queda con la primera mitad de la canción, otro con la segunda.",
		},
		{
			title: "COLOR EN EL TÍTULO",
			prompt: "Cantá una canción que tenga un color en algún lugar de su título.",
		},
		{ title: "NÚMERO EN EL TÍTULO", prompt: "Cantá una canción cuyo título contenga un número." },
		{
			title: "TÍTULO DE UNA PALABRA",
			prompt: "Cantá una canción cuyo título sea exactamente una sola palabra.",
		},
		{
			title: "PREGUNTA EN EL TÍTULO",
			prompt: "Cantá una canción cuyo título esté formulado como una pregunta.",
		},
		{
			title: "NOMBRE EN EL TÍTULO",
			prompt: "Cantá una canción que tenga el nombre de una persona en el título.",
		},
		{
			title: "DÍA EN EL TÍTULO",
			prompt: "Cantá una canción que mencione un día de la semana o un mes en su título.",
		},
		{
			title: "CANCIÓN DE BODA",
			prompt: "Cantá una canción que elegirías para el primer baile en una boda.",
		},
		{
			title: "GRADUACIÓN",
			prompt: "Cantá la canción que definió el final de un capítulo para ti.",
		},
		{
			title: "HIMNO DEPORTIVO",
			prompt:
				"Cantá una canción que pertenezca a un estadio—triunfal, enorme, hecha para multitudes.",
		},
		{
			title: "ADOLESCENTE REBELDE",
			prompt: "Cantá una canción que tus padres te pedían que bajaras el volumen.",
		},
		{
			title: "CLÁSICO FESTIVO",
			prompt:
				"Cantá una canción de temporada—la que hace que la sala se sienta festiva al instante.",
		},
		{
			title: "SUEÑOS",
			prompt: "Cantá una canción sobre sueños—los que tenés dormido o los que tenés despierto.",
		},
		{
			title: "NOSTALGIA EXTREMA",
			prompt:
				"Cantá la canción que, cada vez que suena, te hace sentir como si tuvieras diecisiete años otra vez.",
		},
		{
			title: "LUGAR DE ORIGEN",
			prompt: "Cantá una canción que te haga pensar en el lugar donde creciste.",
		},
		{ title: "PRIMER BAILE", prompt: "Cantá la primera canción con la que bailaste con alguien." },
		{
			title: "DE SALIDA",
			prompt: "Cantá la canción que pondrías mientras te preparas para una gran noche de salida.",
		},
		{
			title: "LA ÚLTIMA CANCIÓN",
			prompt:
				"Cantá la canción que querrías que sonara como la última canción de una noche perfecta.",
		},
		{
			title: "FAMOSO EN TU CABEZA",
			prompt:
				"Cantá un tema poco conocido de tu artista favorito—esa que crees que más gente debería conocer.",
		},
		{
			title: "LA DÉCADA EQUIVOCADA",
			prompt:
				"Cantá una canción de una década antes de que tuvieras edad para haberla escuchado en su momento.",
		},
		{
			title: "LA CONSTRUCCIÓN LENTA",
			prompt: "Cantá una canción que empieza suave y acaba en algo parecido al caos.",
		},
		{
			title: "EL DEALER DEL PEGADIZO",
			prompt:
				"Cantá la canción más pegadiza, más irresistiblemente tarareada que conozcas. Infecta la sala.",
		},
		{
			title: "EL FAVORITO DE OTRO",
			prompt:
				"Cantá una canción que sabés que alguien en esta sala adora, pero que tú nunca elegirías normalmente.",
		},
		{
			title: "SOLO VERSIONES",
			prompt:
				"Cantá una versión—no el original. Específicamente la versión interpretada por otra persona.",
		},
		{
			title: "MUCHO TIEMPO SIN CANTARLA",
			prompt: "Cantá una canción que amabas hace años y que hace mucho no cantás.",
		},
		{
			title: "LA PROPUESTA",
			prompt:
				"Cantá una canción lo suficientemente romántica como para que alguien pudiera pedir matrimonio durante el puente.",
		},
		{
			title: "EL ARRANQUE DE LA FIESTA",
			prompt:
				"Cantá la canción que eleva inmediatamente la energía de cualquier sala en el momento en que empieza.",
		},
		{
			title: "LA DISCULPA",
			prompt: "Cantá una canción que funcione como una disculpa sincera a alguien.",
		},
		{ title: "MOMENTO METAL", prompt: "Cantá algo pesado. Más fuerte de lo que sueles ir." },
		{
			title: "CÁNTALA EN SERIO",
			prompt:
				"Cantá una canción que siempre has parodiado o bromado—pero esta vez completamente en serio.",
		},
		{
			title: "ENCORE",
			prompt: "Te lo ganaste. Cantá lo que quieras. Sin reglas, sin restricciones.",
		},
		{
			title: "LO MEJOR DE LA DÉCADA",
			prompt: "Cantá la canción que consideras la mejor de la década que elijas.",
		},
		{
			title: "LA MAÑANA SIGUIENTE",
			prompt: "Cantá una canción tranquila para el final silencioso de una noche larga y buena.",
		},
		{
			title: "LA CANCIÓN DEL VILLANO",
			prompt:
				"Cantá una canción que podría pertenecer plausiblemente a un villano de película—amenazante, seguro de sí mismo, un poco teatral.",
		},
		{ title: "FAVORITA EXTRANJERA", prompt: "Cantá un éxito de un país que no es el tuyo." },
		{
			title: "LENGUAJE DEL AMOR",
			prompt: "Cantá una canción que, para ti, comunica el amor mejor que las palabras solas.",
		},
		{
			title: "PRIMER DESAMOR",
			prompt: "Cantá una canción que capturara exactamente cómo se sintió tu primer desamor.",
		},
		{
			title: "TRES ACORDES",
			prompt:
				"Cantá una canción sencilla y clásica—del tipo construida sobre tres acordes y puro sentimiento.",
		},
		{
			title: "MÚSICA DE ENTRADA TRIUNFAL",
			prompt:
				"Cantá la canción que querrías que sonara mientras entras en el momento más importante de tu vida.",
		},
		{
			title: "CLÁSICO CAMP",
			prompt:
				"Cantá una canción tan sin ironía, tan sincera, tan gloriosamente exagerada—y hazlo con total convicción.",
		},
		{
			title: "UN FAMOSO TIENE TU NOMBRE",
			prompt:
				"Cantá una canción con el nombre de alguien que comparte tu nombre de pila—o alguien en esta sala.",
		},
	],
	ja: [
		{ title: "実は好きな曲", prompt: "ちょっと恥ずかしいけど、実は大好きな曲を歌おう。" },
		{ title: "主人公", prompt: "自分の人生が映画なら、いちばん大事なシーンで流れる曲を歌おう。" },
		{ title: "タイムマシン", prompt: "聴くと、ある思い出がすぐによみがえる曲を歌おう。" },
		{ title: "別れのアンセム", prompt: "別れた後にリピートしていた曲を歌おう。" },
		{ title: "初めてのコンサート", prompt: "初めて生で見たアーティストの曲を歌おう。" },
		{
			title: "子供の頃の名曲",
			prompt: "子供の頃大好きだった曲—今でも頭から離れないあの曲を歌おう。",
		},
		{ title: "将来どうしよう", prompt: "将来どうしよう…って気持ちにぴったりな曲を歌おう。" },
		{ title: "シャワーソング", prompt: "実際にシャワーで歌っている曲を歌おう。" },
		{ title: "意外な選曲", prompt: "みんなが予想しないジャンルの曲を歌おう。" },
		{ title: "別れの曲", prompt: "離れていった人、または別れについての曲を歌おう。" },
		{
			title: "みんな知ってる曲",
			prompt: "ここにいる全員が知っていると思う曲を選ぼう。サビはみんなで一緒に。",
		},
		{ title: "みんなで踊ろう", prompt: "今流れたら、みんなが踊り出しそうな曲を歌おう。" },
		{ title: "フィナーレ", prompt: "最高の夜をしめくくる曲を歌おう。" },
		{ title: "みんなで歌える曲", prompt: "ここにいる全員が、つい一緒に歌っちゃう曲を歌おう。" },
		{ title: "カラオケチャンピオン", prompt: "カラオケで完全に決めたい曲を歌おう。全力で。" },
		{
			title: "パワーバラード",
			prompt: "ドラマチックなパワーバラードを歌おう。マイクを両手で持つのもアリ。",
		},
		{ title: "歌姫タイム", prompt: "大きな声で、自信たっぷりに歌える曲を選ぼう。手加減なし！" },
		{
			title: "ギターヒーロー",
			prompt: "エアギターをしながら歌いたい曲を歌おう。ソロはボーナスポイント。",
		},
		{
			title: "ボーイバンドアンセム",
			prompt: "ボーイバンドの曲を歌おう。全盛期の曲ならもっと最高。",
		},
		{ title: "一発屋", prompt: "あるアーティストで唯一知っている曲を歌おう。" },
		{ title: "泣ける曲", prompt: "本当に泣いたことのある曲を歌おう。" },
		{ title: "ロックアンセム", prompt: "爆音で聴きたくなるロックを歌おう。" },
		{ title: "スローダンス", prompt: "スローダンスに合う曲を歌おう—ロマンチックなやつ。" },
		{ title: "ミュージカル", prompt: "ミュージカルの曲を、役になりきって歌おう。" },
		{ title: "映画の名シーン", prompt: "映画の名シーンで流れた、忘れられない曲を歌おう。" },
		{ title: "TVテーマソング", prompt: "テレビ番組のオープニングテーマを歌おう。" },
		{ title: "クラブのヒット曲", prompt: "夜中のダンスフロアで盛り上がりそうな曲を歌おう。" },
		{ title: "言葉の壁を越えて", prompt: "自分が話せない言葉で歌われている曲に挑戦しよう。" },
		{ title: "生まれる前の名曲", prompt: "生まれる前にヒットした曲を歌おう。" },
		{ title: "Y2Kパニック", prompt: "2000年代の初めっぽさ全開の曲を歌おう。" },
		{ title: "90年代フラッシュバック", prompt: "思いつく中で最も90年代らしい曲を歌おう。" },
		{
			title: "80年代全開",
			prompt: "シンセサイザーが遠くから聞こえるくらい80年代らしい曲を歌おう。",
		},
		{ title: "ロードトリップ", prompt: "窓を開けて車の中で大音量で流す曲を歌おう。" },
		{ title: "夏のアンセム", prompt: "忘れられない夏を思い出す曲を歌おう。" },
		{ title: "雨の午後", prompt: "雨の日に家でのんびり聴きたい、落ち着く曲を歌おう。" },
		{ title: "夜中の後悔", prompt: "夜中に聴くと、なぜかしっくりくる曲を歌おう。" },
		{ title: "朝の歌", prompt: "朝の準備をしながら口ずさみたい、明るい曲を歌おう。" },
		{ title: "帰る場所", prompt: "家や地元を思い出す曲を歌おう。" },
		{ title: "勝利の歌", prompt: "何もかもうまくいった日に、頭の中で流れそうな曲を歌おう。" },
		{
			title: "ノリノリなのに悲しい",
			prompt: "ノリノリなのに、歌詞をよく聴くと実は悲しい曲を歌おう。",
		},
		{ title: "怒りのプレイリスト", prompt: "ムカついたときに聴くプレイリストから一曲歌おう。" },
		{ title: "嬉し泣き", prompt: "泣けるけど最高の気持ちになれる曲を歌おう。" },
		{ title: "トレーニング曲", prompt: "きつい筋トレの最後のセットで流す曲を歌おう。" },
		{ title: "恋に落ちる", prompt: "恋に落ちる気持ちを歌った曲を歌おう。" },
		{ title: "大晦日", prompt: "年が変わる瞬間に流したい、みんなの心が動く曲を歌おう。" },
		{ title: "耳から離れない", prompt: "今、頭から離れない曲を歌おう。ほら、あの曲！" },
		{
			title: "意外なお気に入り",
			prompt: "普段は好きじゃないと言っているジャンルの曲を歌おう—でもなぜかお気に入り。",
		},
		{
			title: "誰かへの贈り物",
			prompt: "ここにいる誰かに一曲プレゼント。誰に向けて歌うか伝えてね。",
		},
		{ title: "初めての挑戦", prompt: "今夜初めてカラオケに挑戦する曲を歌おう。" },
		{ title: "完全復活", prompt: "久しぶりの登場にぴったりな、カッコいい曲を歌おう。" },
		{ title: "友情よ永遠に", prompt: "友達っていいな、と思える曲を歌おう。" },
		{ title: "ラブレター", prompt: "ラブレターみたいに気持ちが伝わる曲を歌おう。" },
		{ title: "誰かの失恋", prompt: "自分の話じゃないのに、なぜか心にひびいた失恋ソングを歌おう。" },
		{ title: "最強になれる曲", prompt: "自分なら何でもできそう！と思える曲を歌おう。" },
		{ title: "家族の再会", prompt: "家族が一緒に歌う曲を歌おう。" },
		{ title: "10代の反抗", prompt: "親に反抗したいとき、大音量で聴いていた曲を歌おう。" },
		{ title: "少しずつ離れていく", prompt: "友達や大切な人と、少しずつ離れていく曲を歌おう。" },
		{
			title: "告白できなかった恋の歌",
			prompt: "言えなかった片思いの気持ちに、ぴったりな曲を歌おう。",
		},
		{ title: "今さらハマった曲", prompt: "みんなより遅れて知ったけど、今ハマっている曲を歌おう。" },
		{
			title: "初めての二人でデュエット",
			prompt: "今まで一緒に歌ったことのない人を選ぼう。今すぐ一緒にデュエットしよう。",
		},
		{ title: "歌詞なし", prompt: "画面を見ないで歌おう。覚えている歌詞だけで勝負！" },
		{ title: "目を閉じて", prompt: "選んだ曲を最初から最後まで目を完全に閉じたまま歌おう。" },
		{
			title: "全力で演じよう",
			prompt: "好きな曲を選んで、ドラマの主人公みたいに思いきり演じよう。",
		},
		{ title: "本気のモノマネ", prompt: "オリジナルアーティストのモノマネをしながら曲を歌おう。" },
		{
			title: "みんなでサビを歌おう",
			prompt: "AメロとBメロは一人で。サビになったらマイクをみんなに向けて、一緒に歌おう。",
		},
		{ title: "一行ずつ交代", prompt: "ペアを決めて、一行ずつ交代で歌おう。" },
		{ title: "高すぎ？低すぎ？", prompt: "自分の声には高すぎる、または低すぎる曲に挑戦しよう。" },
		{ title: "前半・後半", prompt: "一人が曲の前半を担当し、もう一人が後半を担当する。" },
		{ title: "タイトルに色がある", prompt: "タイトルのどこかに色が入っている曲を歌おう。" },
		{ title: "タイトルに数字がある", prompt: "タイトルに数字が含まれている曲を歌おう。" },
		{ title: "一言タイトル", prompt: "タイトルがちょうど一単語の曲を歌おう。" },
		{ title: "質問がタイトル", prompt: "タイトルが質問になっている曲を歌おう。" },
		{ title: "タイトルに名前がある", prompt: "タイトルに人の名前が入っている曲を歌おう。" },
		{
			title: "タイトルに曜日・月がある",
			prompt: "タイトルに曜日または月が含まれている曲を歌おう。",
		},
		{ title: "ウェディングソング", prompt: "結婚式のファーストダンスに選ぶ曲を歌おう。" },
		{ title: "卒業", prompt: "卒業や引っ越しなど、何かが終わったときの曲を歌おう。" },
		{
			title: "スポーツアンセム",
			prompt: "スタジアムでみんなと大合唱したくなる、元気な曲を歌おう。",
		},
		{ title: "反抗期", prompt: "親から音量を下げるよう頼まれた曲を歌おう。" },
		{ title: "季節の名曲", prompt: "クリスマスやお正月など、聴くだけで季節を感じる曲を歌おう。" },
		{
			title: "夢",
			prompt: "夢についての曲を歌おう—眠っているときの夢でも、目が覚めているときの夢でも。",
		},
		{ title: "あの頃に戻れる曲", prompt: "流れるたびに17歳に戻ったような気持ちになる曲を歌おう。" },
		{ title: "育った場所", prompt: "育った場所を思い出させてくれる曲を歌おう。" },
		{ title: "初めてのダンス", prompt: "誰かと初めて踊った曲を歌おう。" },
		{ title: "出かける前に", prompt: "楽しい夜のお出かけ前、準備しながら聴きたい曲を歌おう。" },
		{ title: "最後の一曲", prompt: "最高の夜、その最後に流したい曲を歌おう。" },
		{ title: "頭の中のスター", prompt: "好きなアーティストの、あまり知られていない名曲を歌おう。" },
		{ title: "昔の名曲", prompt: "自分が生まれる前、または小さかった頃の曲を歌おう。" },
		{ title: "徐々に盛り上がる", prompt: "静かに始まって、最後は大さわぎになる曲を歌おう。" },
		{
			title: "頭から離れない曲",
			prompt: "いちばん頭に残る曲を歌おう。みんなにも覚えさせちゃおう！",
		},
		{
			title: "誰かのお気に入り",
			prompt: "この部屋の誰かが大好きだとわかっているけど自分は普段選ばない曲を歌おう。",
		},
		{ title: "カバーのみ", prompt: "オリジナルではなく、別の人が歌ったカバー版を歌おう。" },
		{ title: "久しぶりの一曲", prompt: "何年も前に大好きだった、しばらく歌っていない曲を歌おう。" },
		{ title: "プロポーズ", prompt: "サビの途中でプロポーズできるくらいロマンチックな曲を歌おう。" },
		{
			title: "パーティースターター",
			prompt: "始まった瞬間、みんなのテンションが上がる曲を歌おう。",
		},
		{ title: "ごめんの歌", prompt: "誰かに本気で「ごめん」を伝えられる曲を歌おう。" },
		{ title: "メタルタイム", prompt: "激しい曲を歌おう。いつもより大きな声で！" },
		{
			title: "まじめに歌う",
			prompt: "いつもパロディにしたり冗談にしていた曲—今回は完全に本気で歌おう。",
		},
		{ title: "アンコール", prompt: "ここまでよくやった！好きな曲を自由に歌おう。ルールはなし。" },
		{ title: "年代ベストソング", prompt: "選んだ年代の中で最高だと思う曲を歌おう。" },
		{ title: "翌朝", prompt: "楽しかった長い夜の最後に、ゆっくり聴きたい曲を歌おう。" },
		{ title: "悪役の歌", prompt: "映画の悪役が歌いそうな、ちょっと怖くてカッコいい曲を歌おう。" },
		{ title: "海外のお気に入り", prompt: "自分の国ではないどこかのヒット曲を歌おう。" },
		{ title: "愛の言語", prompt: "言葉だけより、好きな気持ちが伝わる曲を歌おう。" },
		{ title: "初めての失恋", prompt: "初めての失恋、その気持ちにぴったりだった曲を歌おう。" },
		{ title: "三コード", prompt: "コードは少なくても気持ちはたっぷり。シンプルな名曲を歌おう。" },
		{ title: "登場ソング", prompt: "人生でいちばん大事な場面に登場するとき、流したい曲を歌おう。" },
		{ title: "全力の定番曲", prompt: "ちょっと大げさなくらい熱い曲を、照れずに本気で歌おう。" },
		{
			title: "同じ名前の曲",
			prompt: "自分や、ここにいる誰かと同じ名前がタイトルに入った曲を歌おう。",
		},
	],
};
