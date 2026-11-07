/**
 * Encore's pages in Japanese, in the app's casual, friendly voice. Card titles and prompts,
 * hints and labels are the app's own Japanese strings, so the page shows exactly what a
 * player reads on the card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EncoreCopy, EncorePagesCopy } from "~/resources/content/encore/copy";

/** The landing, header and footer in Japanese. */
export const JA: EncoreCopy = {
	locale: "ja",
	badge: "ja-jp",
	languageName: "日本語",
	meta: {
		title: "Encore：iPhone、iPad、Apple Watch、Mac で遊べる音楽パーティーゲーム",
		description:
			"カードを引いて、お題をめくって、ぴったりの曲を歌おう。手書きのお題は108枚、日本語・英語・スペイン語に対応。お支払いは一度きりの US$4.99 です。",
	},
	header: { support: "サポート", privacy: "プライバシー", navLabel: "Encore", sound: "効果音" },
	footer: {
		tagline: "おなじみの一曲を、みんなの思い出に。",
		columns: { encore: "Encore", more: "Sergio のほかの作品", elsewhere: "SNS" },
		download: "ダウンロード",
		blog: "ブログ",
		madeBy: "制作：",
		languages: "言語",
	},
	appStore: "App Store からダウンロード",
	hero: {
		eyebrow: "カードが全部「歌のお題」のパーティーゲーム",
		title: "次の夜は、一曲から始まる。",
		description:
			"カードをめくって、お題を読んで、ぴったりの曲を思いきり歌おう。「実は好きな曲」から「初めての二人でデュエット」まで、手書きのお題が108枚。歌が苦手な人ほど大歓迎。",
		tour: "遊び方",
		note: "US$4.99 の買い切り。サブスクも広告も、採点もなし。",
	},
	play: {
		eyebrow: "あなたの番",
		title: "好きなカードを一枚どうぞ",
		description:
			"本物のカードを3枚、お試しでどうぞ。カードをタップして、声に出して読んで、歌おう。録音はしていません。",
		draw: "もう一枚引く",
		shuffle: "シャッフル",
		left: "{total} 枚中 {count} 枚目",
		end: "お試しはここまで。残りの105枚は Encore で待っています。",
	},
	tour: {
		eyebrow: "遊び方",
		title: "めくって、歌って、スワイプ。声が枯れるまで。",
		description: "ゲームはカード一枚だけ。メニューも、チーム分けも、もめる点数表もありません。",
		stageLabel: "1ラウンドの4つの動き",
		steps: [
			{
				title: "タップして表示",
				body: "裏向きのカードが、なぞめいて待っています。タップするとくるっとめくれます。",
			},
			{
				title: "お題に合わせて歌う",
				body: "声に出して読もう。最初に曲を思いついた人がマイク（なければヘアブラシ）を握ります。",
			},
			{
				title: "スワイプで次へ",
				body: "歌い終わったらカードを払いのけよう。次のお題がもう表向きで待っています。",
			},
			{
				title: "振ってシャッフル",
				body: "iPhone を振ると新しいデッキに。キーボードなら Command-R でも。",
			},
		],
	},
	deck: {
		eyebrow: "デッキ",
		title: "手書きのお題108枚、どれもちょっとやっかい",
		description:
			"自分のこと、その場にいるみんなのこと、曲のタイトルのこと。同じ雰囲気のお題が続かないように Encore が配ります。さあ、一枚めくってみて。",
		listLabel: "デッキのカード",
		generated: "組み合わせのお題",
		reveal: "タップして表示",
	},
	cards: {
		a001: { title: "実は好きな曲", prompt: "ちょっと恥ずかしいけど、実は大好きな曲を歌おう。" },
		a002: {
			title: "主人公",
			prompt: "自分の人生が映画なら、いちばん大事なシーンで流れる曲を歌おう。",
		},
		a060: {
			title: "初めての二人でデュエット",
			prompt: "今まで一緒に歌ったことのない人を選ぼう。今すぐ一緒にデュエットしよう。",
		},
		a100: {
			title: "アンコール",
			prompt: "ここまでよくやった！好きな曲を自由に歌おう。ルールはなし。",
		},
		a011: {
			title: "みんな知ってる曲",
			prompt: "ここにいる全員が知っていると思う曲を選ぼう。サビはみんなで一緒に。",
		},
		a033: { title: "ロードトリップ", prompt: "窓を開けて車の中で大音量で流す曲を歌おう。" },
		a045: { title: "大晦日", prompt: "年が変わる瞬間に流したい、みんなの心が動く曲を歌おう。" },
		a015: { title: "カラオケチャンピオン", prompt: "カラオケで完全に決めたい曲を歌おう。全力で。" },
		a080: {
			title: "季節の名曲",
			prompt: "クリスマスやお正月など、聴くだけで季節を感じる曲を歌おう。",
		},
		a104: { title: "海外のお気に入り", prompt: "自分の国ではないどこかのヒット曲を歌おう。" },
		a008: { title: "シャワーソング", prompt: "実際にシャワーで歌っている曲を歌おう。" },
		a024: { title: "ミュージカル", prompt: "ミュージカルの曲を、役になりきって歌おう。" },
		a090: { title: "徐々に盛り上がる", prompt: "静かに始まって、最後は大さわぎになる曲を歌おう。" },
		generated: { prompt: "90年代のなつかしい曲を歌おう。" },
	},
	watch: {
		eyebrow: "Apple Watch",
		title: "手首から、この騒ぎを指揮しよう",
		description:
			"iPhone はみんなが読めるようにテーブルに置いたまま。部屋の反対側からでも、Apple Watch でめくって、配って、シャッフルできます。",
		items: [
			"手首に「カードはOK！」、そしてお題そのもの",
			"「カードを見る」「次へ」「シャッフル」を、手応えのあるタップで",
			"iPhone と自動でつながるので、サインインは不要",
			"近くの iPhone で Encore を開いている間に使えます",
		],
	},
	details: {
		eyebrow: "どこでもゲームナイト",
		title: "どんな夜にも、ぴったりのカード",
		description: "カラオケ、ドライブ、大晦日。どんな場面にもカードがあります。",
		items: {
			karaoke: {
				title: "カラオケナイト",
				body: "カラオケ機がなくても大丈夫。どんなスピーカーでも、どんな部屋でも、どんな歌唱力でも。",
			},
			road: {
				title: "ドライブ",
				body: "カードはすべてアプリの中。電波がなくてもゲームは続きます。",
			},
			holiday: {
				title: "ホームパーティー",
				body: "テーブルの真ん中に iPad を立てても、ソファで Mac を囲んでも。",
			},
			abroad: {
				title: "海外の友だちと",
				body: "カードは日本語・英語・スペイン語。iPhone の言語に合わせて表示されます。",
			},
			newYear: {
				title: "大晦日",
				body: "盛り上がりが落ちてきたら、振って新しいデッキに。準備も点数もいりません。",
			},
			everyone: {
				title: "みんなで歌う",
				body: "順番もチームもなし。曲を思いついた人がマイクを握ります。VoiceOver がカードを読み上げます。",
			},
		},
	},
	privacy: {
		eyebrow: "プライバシー",
		title: "カラオケでの出来事は、\nカラオケの中だけに",
		description:
			"Encore はマイクを一切使いません。歌声はその部屋の中だけ。ゲームは何も記録しません。",
		checks: [
			"アカウントもサインインも不要",
			"マイク、録音、音声認識は使いません",
			"広告、分析、トラッキングなし",
			"すべてのカードがアプリに入っていて、オフラインで遊べます",
			"iPhone と Apple Watch のやりとりは、2台の間だけ",
		],
		policy: "プライバシーポリシーを読む",
	},
	faq: {
		eyebrow: "よくある質問",
		title: "最初の一曲の前に",
		columns: [
			[
				[
					"Encore は音楽を流しますか？",
					"いいえ。Encore はお題を配るだけで、曲はみなさんが用意します。カラオケの音源でも、スピーカーでも、ギターでも、歌声だけでも。",
				],
				[
					"何人で遊べますか？",
					"ひとつの画面を読める人数なら何人でも。プレイヤー登録も、順番も、点数もないので、誰でもカードを引けます。",
				],
				[
					"インターネット接続は必要ですか？",
					"いいえ。すべてのカードがアプリに入っているので、電車でも、山小屋でも、地下でも同じように遊べます。",
				],
				[
					"歌がうまくないとダメ？",
					"まったく問題なし。下手なほど盛り上がるカードもあります。「全力で演じよう」は、ドラマの主人公みたいに思いきり演じることを求めます。",
				],
				[
					"同じカードがまた出ますか？",
					"手書きの108枚が全部出るまでは出ません。その後は組み合わせのお題を少しはさんで次の一巡へ。iPhone を振れば、いつでも新しいデッキにできます。",
				],
			],
			[
				[
					"対応している言語は？",
					"日本語、英語、スペイン語、アルゼンチンのスペイン語です。デバイスの言語に合わせて表示されます。",
				],
				[
					"Apple Watch だけで遊べますか？",
					"Apple Watch は iPhone のゲームのリモコンです。近くの iPhone で Encore を開いている間、カードの表示、めくる・配る・シャッフルができます。",
				],
				[
					"価格はいくらですか？",
					"App Store で US$4.99（お住まいの地域の相当額）の買い切りです。サブスク、アプリ内課金、広告はありません。",
				],
				[
					"家族で共有できますか？",
					"はい。ファミリー共有に対応しているので、一度購入すればファミリーグループの全員がダウンロードできます。",
				],
				[
					"効果音や振動はありますか？",
					"あります。最初はどちらもオフなので、「設定」アプリの Encore からオンにしてください。",
				],
			],
		],
	},
	closing: {
		title: "歌は、まだまだ続く。",
		description: "仲間を集めて、部屋の一角を陣取って、最初の一枚をめくろう。",
		support: "お困りですか？サポートはこちら",
	},
	screens: {
		"card-back": "「タップして表示」のヒントがついた裏向きのカード",
		challenge: "めくった手書きのお題カード",
		swipe: "横に払われたカードと、その後ろの次のお題",
		shuffle: "振った後の新しい裏向きのカードと、広がったデッキ",
		generated: "タイトルのない組み合わせのお題",
		"watch-ready": "「カードはOK！」と「カードを見る」「シャッフル」を表示した Apple Watch",
		"watch-challenge": "お題と「次へ」「シャッフル」を表示した Apple Watch",
	},
	placeholder: "スクリーンショット準備中",
};

/** The privacy and support pages in Japanese. */
export const JA_PAGES: EncorePagesCopy = {
	privacy: {
		forLine: "iPhone、iPad、Apple Watch、Mac 版 Encore のプライバシーポリシーです。",
		viewMarkdown: "Markdown で見る",
	},
	support: {
		title: "Encore サポート",
		description:
			"iPhone、iPad、Apple Watch、Mac 向け Encore: Music Party Game のサポート。不具合の報告、ご質問、機能のご提案はこちらから。",
		intro: [
			"ご質問、不具合、Encore へのアイデアがあれば、下のフォームからお送りください。",
			"うまく動かないときは、お使いのデバイス、起きたこと、期待していた動きを教えてください。再現手順や、わかれば OS とアプリのバージョンも書いていただけると助かります。",
		],
		formTitle: "サポートフォーム",
		sent: "サポートのお問い合わせを送信しました。ご入力いただいたメールアドレスにご返信します。",
		sendAnother: "別のお問い合わせを送る",
		failed: "送信できませんでした。メッセージは残っていますので、もう一度お試しください。",
		rateLimited:
			"短い時間に何度も送信されています。メッセージは残っていますので、1分ほど待ってからもう一度お試しください。",
		resubmit:
			"送信前にフォームの有効期限が切れました。メッセージは残っていますので、もう一度送信してください。",
		invalid: "赤く表示された項目を直してから、もう一度送信してください。",
		name: "お名前（任意）",
		email: "メールアドレス",
		topic: "お問い合わせの種類",
		chooseTopic: "種類を選んでください",
		device: "デバイス",
		chooseDevice: "デバイスを選んでください",
		osVersion: "OS のバージョン（任意）",
		osPlaceholder: "例：iOS 26.1",
		appVersion: "アプリのバージョン（任意）",
		appPlaceholder: "例：1.2",
		message: "メッセージ",
		messagePlaceholder: "ご質問、不具合、ご提案の内容をお書きください…",
		notice:
			"お送りいただいた情報は、お問い合わせへの返信と不具合の調査に使います。パスワード、支払い情報などの機密情報は書かないでください。詳しくは",
		privacyLink: "プライバシーポリシー",
		noticeJoiner: "",
		noticeEnd: "をご覧ください。",
		submit: "お問い合わせを送信",
		pending: "送信中…",
		topics: {
			"Bug report": "不具合の報告",
			Question: "ご質問",
			"Feature request": "機能のご提案",
			Other: "その他",
		},
		platforms: {
			iPhone: "iPhone",
			iPad: "iPad",
			"Apple Watch": "Apple Watch",
			Mac: "Mac",
			Other: "その他",
		},
	},
};
