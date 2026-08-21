// Methodological engine for “Возвращение к себе / Volver a mí”.
// Internal Process Work concepts stay internal. User-facing generation must use ordinary language.

export const RETURN_TO_SELF_PROGRAM_KEY = "safe_return_to_self";

export const RETURN_TO_SELF_ENGINE_RULES = {
  publicNameRu: "Возвращение к себе — 28 дней исследования своего процесса",
  publicSubtitleRu: "Бережная адаптивная программа исследования внутренних частей, сигналов и новых способов быть с собой.",
  language: [
    "Do not use Process Work jargon with the user: no edge, edge figure, primary/secondary process, channel, amplification.",
    "Match verbs to experience: feelings are felt; thoughts are thought/explored; images are observed; body sensations are sensed; movements are performed.",
    "Never state an AI hypothesis as truth. Ask the user to confirm, reject, rename or correct it; user correction has priority.",
  ],
  safety: [
    "Begin each day with check-in and end with reorientation/return.",
    "The user has an unconditional right to step back at any moment. Progression is never mandatory and missed days never count as failure.",
    "At any point offer explicit choices: continue today, use a softer version, repeat a previous day, take a rest day with no process work, take a resource-only day, pause the whole program, or stop the program.",
    "A pause freezes progression and preserves the user's place. Resuming must begin with a fresh check-in; never auto-advance because calendar days passed.",
    "A rest day contains no required introspection, journaling, catching up, or therapeutic task. The only optional prompt is what would make today gentler/easier.",
    "A resource-only day must not reopen difficult material. It uses only previously user-confirmed supports and/or a low-demand resource exercise selected by the user.",
    "If distress rises markedly, offer soft version, resource day, repeat, pause; high-risk/crisis signals stop longitudinal exploration and hand off to existing crisis architecture.",
    "Do not infer causal links from early memories. Ask whether the user sees a connection.",
    "Do not force breath focus. 4-7-8 is optional and only if comfortable.",
  ],
  support: [
    "Support is continuous across the program, not confined to a resource day.",
    "Before deeper progression, build a reusable personal Resource Protocol from user-confirmed supports. It remains available from every program day and grows as new supports are discovered.",
    "The Resource Protocol may contain: pleasant body sensations, orienting to a safe/pleasant environment, sensory pleasures, grounding through contact/support, movement, music/sound, nature/light/water, real supportive people, animals, positive memories, imagined allies, self-soothing gestures, optional comfortable breathing, and user-created exercises.",
    "Resource exercises are a library, not a prescription. The user chooses what fits now; Talvira remembers what helped, what did not help, and what should not be offered again.",
    "Use three distinct support sources when appropriate: real resources, an imagined/desired ally figure, and Talvira explicitly taking the user's side against a prohibiting/critical figure.",
    "When moving toward difficult material, return repeatedly to something genuinely pleasant, not merely neutral.",
  ],
  resourceProtocol: {
    alwaysAvailable: true,
    modes: ["rest_day", "resource_day", "soft_version", "repeat_previous", "pause_program"],
    rule: "Resource mode never requires the user to explain or justify why they need it and never treats stepping back as regression.",
    starterExercises: [
      "Find one clearly pleasant sensation in the body and let attention rest there without trying to change anything else.",
      "Orient slowly to the room and choose three things that are pleasant to see, hear or feel.",
      "Notice physical support: feet on floor, back on chair/bed, hands resting; choose the contact that feels best.",
      "Choose a small movement the body already wants: stretch, shake hands, walk, curl up, press feet into floor, or another comfortable movement.",
      "Bring in a real resource: a person, animal, place, music, nature, sunlight, water sound or positive memory that genuinely helps.",
      "Invite a previously user-confirmed imagined ally and notice what changes when it is present.",
      "Use a self-soothing gesture such as a hand on chest/shoulder or self-hug only if it feels pleasant and welcome.",
      "Choose ordinary comfortable breathing or optional 4-7-8 only if breath-focused practice feels good; otherwise choose another exercise.",
    ],
  },
  weekly: [
    "Days 7, 14 and 21 include a collaboratively corrected map and an invitation to celebrate something meaningful if celebration feels authentic.",
    "Day 27 is the larger celebration of the whole path; never force celebration if the user says there is nothing to celebrate.",
  ],
};

const d = (day, week, key, title, purpose, steps, journal, extra = {}) => ({ day, week, key, title, purpose, steps, journal, ...extra });

export const RETURN_TO_SELF_DAYS = [
  d(1,1,"current_experience","Что происходит со мной сейчас","Notice the strongest present signal and the first moment of interruption without searching for a problem.",[
    "Ask what most strongly attracts attention now: body sensation, feeling, thought, image, inner dialogue or movement impulse.",
    "Respond according to the type of experience; never use the generic phrase ‘stay beside it’. For a feeling ask what is felt more clearly; for a sensation ask what changes with attention; for a thought ask where it leads; for an image ask what stands out.",
    "Notice when the user wants to distract, stop, change subject, devalue the experience or say ‘don't’. Do not challenge it yet."
  ],["Что сегодня было самым заметным?","Что изменилось, когда я уделила этому внимание?","В какой момент мне захотелось остановиться или отвернуться?"]),

  d(2,1,"difficult_and_pleasant","Между сложным и приятным","Practice moving attention between a current difficult signal and something genuinely pleasant.",[
    "Use a signal present today.",
    "Help find something genuinely pleasant now, not neutral: warm feet, lightness in the head, comfortable support, flowing water, music, birds, sunlight, easy breathing, or another user-chosen pleasant experience.",
    "Move slowly difficult → pleasant → difficult → pleasant for at least 5 cycles in the user's own rhythm. More is allowed; safety overrides the minimum if overload appears.",
    "End in the pleasant/resourceful experience."
  ],["Когда мне хотелось отойти?","Что было действительно приятным?","Что помогало возвращаться?","Что изменилось к последнему циклу?"],{support:true}),

  d(3,1,"who_says_no","Кто или что говорит «нет»","Recognize the form of the internal stop/prohibition.",[
    "Explore words or nonverbal forms of stopping: criticism, sleepiness, laughter, tension, emptiness, topic change, urge to close the app.",
    "Ask: if what stops you could speak, what would it say? If a figure/character appears, explore it; never invent one.",
    "Seed support: ask who or what could stand nearby so the user would feel stronger. It may be real, imaginary, animal, fictional or unexpected. Do not require an answer."
  ],["Как я узнаю момент «стоп»?","Есть ли у него голос, образ или характер?","Что он говорит или делает?","Кто мог бы быть рядом со мной?"],{support:true}),

  d(4,1,"what_matters_to_no","Что важно тому, кто говорит «нет»?","Explore the prohibiting figure as a meaningful part of the whole process and discover the useful quality, force, need or message carried in its energy.",[
    "Ask what it tries not to allow and what does not happen because it exists.",
    "Ask what it believes could happen if it disappeared.",
    "Look at the figure from another side: assume its energy has value for the whole process and ask what useful quality, force, need or message is contained in it. Do not let the exploration collapse into fear, self-attack or negative dramatization.",
    "Clarify ‘what is important to preserve’ with examples only as options: safety, control, belonging, dignity, familiar identity/order, relationships, avoidance of shame, or something else.",
    "Invite an ally who is not frightened by the prohibiting figure (real or imagined; fairy, Hulk, animal, etc.). Explore what changes when the ally stands beside the user and how the figure's useful energy can become more available to the user."
  ],["Что важно тому, кто говорит «нет»?","Что он не допускает?","Что изменилось, когда рядом появилась поддерживающая фигура?"],{support:true}),

  d(5,1,"earlier_similar","Когда такое уже было","Explore an earlier similar pattern without manufacturing a trauma narrative or causal explanation.",[
    "Ask when something similar happened before and what earliest similar episode comes naturally now; do not force ‘the first event of life’.",
    "If nothing comes, stop searching. If a memory comes: what happened, how did the user react, what did that reaction allow or prevent, what mattered then?",
    "If useful, allow the ally from prior days to accompany the user imaginatively.",
    "Ask whether the user herself sees a similarity between then and now. Never assert causality."
  ],["Какую похожую ситуацию я вспомнила?","Как я тогда реагировала?","Что было похожим, а что другим?","Какую связь вижу я сама — если вижу?"],{support:true,risk:"moderate"}),

  d(6,1,"support_map","Что меня поддерживает","Build a personalized support map.",[
    "Try body-based pleasant support, ordinary calm breathing or optional 4-7-8 if comfortable, movement, orienting, supportive people, places, animals, music, nature and memories.",
    "Keep imagined allies as an additional category rather than replacing real resources.",
    "Ask what kind of Talvira support helps: gentle presence, direct advocacy, humor, concise questions, etc.; remember what does not help.",
    "Create categories: body, real resources, imagined allies, preferred Talvira support."
  ],["Что быстрее всего помогает мне вернуться к себе?","Что помогает телу?","Кто или что поддерживает меня?","Какая поддержка мне не подходит?"],{support:true}),

  d(7,1,"week1_map","Первая карта","Integrate and collaboratively correct week 1, then find something worth celebrating if authentic.",[
    "Summarize recurring signals, how stopping appeared, supports that worked, and what remains unknown.",
    "Ask whether the map fits; invite corrections and store them as authoritative.",
    "Ask what exists now that did not exist at the beginning of the week: even noticing a voice counts.",
    "Invite a personally fitting celebration (music, movement, smile, tell someone, pleasant act, own way). If user says nothing to celebrate, do not persuade."
  ],["Что я узнала о себе?","Что оказалось неожиданным?","Что Talvira поняла неправильно?","Что хочется продолжить исследовать?","Есть ли что-то, что мне хочется отметить или отпраздновать?"],{celebration:true}),

  d(8,2,"no_in_body","Как тот, кто против, ощущается в теле","Let the user physically experience the response to the prohibiting figure.",[
    "Invite the user, if physically possible, to put the phone down or position it so hands/body can move.",
    "Recall the one who says ‘no’; locate how this is felt in the body and its direction/impulse.",
    "Invite a real physical movement, not merely imagining it: stand, turn, push, stamp, straighten, extend an arm, clench hands, etc., only as the body suggests.",
    "Afterward return attention to something genuinely pleasant in the body."
  ],["Где это ощущалось?","Какое движение хотелось сделать?","Что изменилось после реального движения?","Что было приятно после возвращения?"],{support:true}),

  d(9,2,"movement_clearer","Сделать движение чуть яснее","Amplify the user's own movement minimally and add support.",[
    "Repeat the confirmed movement and make it about 5% clearer/stronger, never maximal.",
    "Invite the previously chosen ally to stand nearby and perform the movement again.",
    "Compare: stronger, calmer, larger, more precise, funnier, unchanged? Do not prescribe the direction of change."
  ],["Что изменилось при 5% усилении?","Как изменилось движение, когда я была не одна?","Какое качество появилось?"],{support:true}),

  d(10,2,"hard_to_allow_feeling","Чувство, которому трудно появиться","Elicit a possibly unrecognized disallowed feeling through the user's response rather than labeling it.",[
    "Use a concrete recurring situation where something important happened and ask what the user actually did.",
    "Do not ask ‘what emotion do you suppress?’ Instead ask what a person who did not have to be convenient might feel, or what someone freely protecting themselves might feel.",
    "Talvira may take the user's side concretely: e.g. express indignation at how the user was treated, without claiming the user herself is angry.",
    "Ask how it feels to hear someone feel/express that on the user's behalf. Treat the user's reaction (relief, irritation, tears, laughter, own anger, rejection) as new material.",
    "Never diagnose ‘blocked aggression’ or another hidden emotion."
  ],["Как мне было слышать, что кто-то встал на мою сторону?","Какая реакция появилась во мне?","Что из этой реакции хочется исследовать дальше?"],{support:true}),

  d(11,2,"prohibiting_message","Кто говорит, что мне нельзя","Make the prohibiting message/figure concrete and let Talvira advocate for the user.",[
    "Start from a concrete ‘I must / I cannot / I am not allowed’ already present in material.",
    "Ask who/what says it; figure may be a known person, monster, abstract/star-like form, voice, etc.",
    "Explore appearance, movement, breathing/voice, demands and what it predicts if disobeyed.",
    "With permission, Talvira temporarily takes the user's side and disputes this specific figure using the user's actual material, not generic affirmations.",
    "Return agency: what was useful, what was not, and what does the user herself want to answer?"
  ],["Какое послание я услышала?","Как мне было, когда Talvira встала на мою сторону?","Что я хочу ответить сама?"],{support:true}),

  d(12,2,"become_other","Стать другим","Use a real relational figure to experience qualities from their position.",[
    "Recall the actual person from a recurring interaction and directly take their position.",
    "Explore how they stand, move, breathe, look, speak and feel in the body; if possible put the phone down and physically enact the posture/movement.",
    "From that position look at the everyday self and say what wants to be said to her.",
    "Do not decide who is right. Explicitly exit the role and reorient afterward."
  ],["Что я обычно делаю в такой ситуации?","Как ощущалось быть на месте другого?","Что мне захотелось сказать себе из этой позиции?","Что стало видно нового?"],{risk:"moderate"}),

  d(13,2,"unfamiliar_mode","Исследовать непривычным способом","Deliberately use a less-used way of experiencing.",[
    "AI reviews prior days to identify dominant ways of processing and must not simply offer the habitual one.",
    "Offer 2–3 underused options in ordinary language: body/movement, image, sound/voice, writing, dialogue, etc.; never call them channels.",
    "Explain briefly why these options differ from what the user has mostly done. User chooses."
  ],["Какой непривычный способ я попробовала?","Что стало заметно благодаря ему?","Что оказалось неожиданно естественным или трудным?"]),

  d(14,2,"week2_map","Вторая карта","Integrate weeks 1–2 and celebrate an authentic development.",[
    "Show concrete sequence changes: signal → figure/message → role/movement/emotion → newly appearing material.",
    "Ask user to confirm/correct every meaningful link.",
    "Ask what from this week deserves marking or celebration; tailor celebration to user and do not force."
  ],["Какие связи вижу я сама?","Что стало яснее?","Что всё ещё непонятно?","Что на этой неделе хочется отметить или отпраздновать?"],{celebration:true}),

  d(15,3,"signals_that_return","Что несколько раз уже появлялось","Let the user select recurring emerging signals from concrete moments.",[
    "Review weeks 1–2 and present concrete statements tied to moments: ‘when discussing X, these appeared…’ not ‘near this theme’.",
    "Present confirmed candidates as multi-select/checklist: movement, phrase, smile, posture, image, etc., plus Other.",
    "Ask which one(s) strongly resonate. Only selected items become candidates for subsequent days."
  ],["Что из повторявшегося я действительно узнаю?","Что откликается особенно сильно?","Что я не считаю своим и хочу убрать из карты?"]),

  d(16,3,"five_percent_more","На 5% больше","Minimally amplify a user-confirmed emerging signal.",[
    "Use a Day-15 selected signal. Match method to signal: movement clearer, voice more confident, image more vivid, sensation more spacious, etc.",
    "Increase only about 5%. After each step ask: a little more, stop, or reduce?",
    "No goal of maximum intensity."
  ],["Что произошло при маленьком усилении?","Когда стало достаточно?","Что было приятным, странным или неожиданным?"]),

  d(17,3,"give_it_voice","Как это говорит","Give the emerging state a voice and explore the experience of speaking that way.",[
    "Ask what this side wants to say; invite saying it aloud if possible.",
    "Explore voice qualities: volume, speed, tone, confidence, irony, softness, force.",
    "Central question: what is it like to be yourself while speaking this way?"
  ],["Что я сказала?","Каким был мой голос?","Как ощущалось быть собой, говоря именно так?"]),

  d(18,3,"embody_new_quality","Дать этому состояние тела","Embody the emerging quality physically.",[
    "If possible invite putting the phone down and standing/moving.",
    "Use confirmed quality/signal: how are shoulders, legs, hands, breath, gaze, posture and movement when this is allowed?",
    "Invite at least a short period of real movement rather than imagination only.",
    "Ask what it is like to inhabit this state bodily."
  ],["Как тело выражает это качество?","Как я двигаюсь из него?","Что в этом состоянии приятно или непривычно?"]),

  d(19,3,"new_self_to_everyday_self","Посмотреть на привычную себя из нового состояния","Let the emerging state address the everyday/familiar self.",[
    "Re-enter the embodied state from Day 18.",
    "Imagine the everyday self who usually faces the recurring situation and look at her from this state.",
    "Ask: what do you want to tell her? What does she lack from your perspective? What could you give her?",
    "Do not repeat a generic perspective-taking exercise; this is specifically new/emerging state → familiar self."
  ],["Что новая сторона сказала привычной мне?","Чего, по её мнению, мне не хватает?","Что из этого послания я хочу взять с собой?"]),

  d(20,3,"one_percent_life","Один процент в жизни","Translate the emerging quality into one very small real-life experiment.",[
    "Ask what 1% more room for this side could look like in ordinary life.",
    "Choose one small action only: delay reply, ask, say no, choose independently, speak louder, occupy space, not smile automatically, etc., only as examples.",
    "Make it small enough to remain an experiment, not a test of courage."
  ],["Какой маленький эксперимент я выбираю?","Как сделать его достаточно маленьким?","Как я пойму, что эксперимент уже состоялся?"]),

  d(21,3,"two_ways_map","Карта двух способов быть","Collaboratively map familiar way, stopping process and emerging way; celebrate week 3.",[
    "Map: ‘I usually…’ / ‘what stops me…’ / ‘what has begun appearing…’ / ‘what I am trying in small ways…’.",
    "Use only user-confirmed material and ask the user to name the two sides in her own words.",
    "Invite celebration of something meaningful from week 3, including simply discovering a previously unavailable feeling/quality."
  ],["Как я сама называю эти две стороны?","Что важно сохранить от привычной?","Что интересно взять из новой?","Что на этой неделе хочется отпраздновать?"],{celebration:true}),

  d(22,4,"notice_in_life","Узнать это в обычной жизни","Notice familiar or emerging patterns in real life without requiring behavior change.",[
    "Task: once during an ordinary situation notice the familiar reaction or emerging quality.",
    "No requirement to change behavior; noticing earlier is enough."
  ],["Где это произошло?","Как я поняла, что это тот самый момент?","Появилось ли хотя бы мгновение выбора?"]),

  d(23,4,"self_chosen_exploration","Исследовать новую сторону своим способом","Increase autonomy by letting the user choose how to explore the already-confirmed emerging state.",[
    "The object is the emerging/new state from week 3, not an arbitrary topic and not the prohibiting figure.",
    "Offer possibilities: move as it, speak in its voice, write from it, draw it, imagine it, take its posture, address everyday self, or own method.",
    "Talvira follows rather than directing in detail unless asked."
  ],["Как я решила исследовать новую сторону?","Почему выбрала именно так?","Что я могу делать уже без подробных инструкций Talvira?"]),

  d(24,4,"positive_secondary_story","История новой стороны себя","Expand the user-confirmed emerging process into an imaginative positive story/world where the quality can live and act.",[
    "Recall only user-confirmed elements from days 15–23 and ask which resonates most today.",
    "Turn it into a protagonist: the user herself, animal, fictional being, person, force of nature or abstract figure. Never force animal imagery.",
    "Build the story: where does the protagonist live, how move, what enjoy, how relate to self, what allow herself to do, what does an ordinary day look like, how relate to others, boundaries, rest, choices and pleasure?",
    "The story is positive in the methodological sense: difficulty may occur, but it must not erase the emerging quality. If prohibiting/critical material returns and cancels the protagonist, name that the old stop seems to have re-entered; do not automatically elaborate the conflict. Invite returning to the world where the new quality remains available and agentic.",
    "After the story, embody it: what happens in the body, what posture/movement wants to happen? Invite real movement if possible.",
    "End by asking what one sentence the protagonist wants to leave for the user."
  ],["Кто или что стало героем моей истории?","Каким был мир, где эта сторона может жить свободнее?","Пытался ли вернуться старый запрет и как я это заметила?","Какую фразу или качество я забираю в обычную жизнь?"],{support:true}),

  d(25,4,"teach_another","Объясни это другому","Consolidate learning by explaining it to an imagined other person.",[
    "Imagine explaining what has been learned: noticing stops, finding support, recognizing critical/prohibiting voices, trying an unfamiliar state, and knowing when to stop.",
    "Ask what she would advise another person to do and not do.",
    "Return the teaching to self: which advice is most important for you not to forget?"
  ],["Что я уже умею объяснить другому?","Что оказалось главным принципом?","Какой собственный совет мне важно помнить?"]),

  d(26,4,"adaptive_integration","Адаптивный день","Either respectfully explore what remains difficult or replenish resources if no unresolved difficult pattern is salient.",[
    "Branch A only if a user-confirmed persistent difficult pattern remains: explore what is still important, what is too much, what must be respected, and whether ‘not now’ is a complete answer. No pressure to change.",
    "Branch B if no salient unresolved pattern: create a pleasant personalized resource practice using the month's effective body sensations, people, places, allies, movement, music, optional breathing and emerging qualities.",
    "Do not invent a problem merely to use Branch A."
  ],["Что мне сейчас важнее — уважить то, что пока сложно, или набрать сил?","Что я хочу сохранить из сегодняшней практики?"] ,{adaptive:true,support:true}),

  d(27,4,"whole_path_celebration","Празднование пути","Celebrate the whole path using the user's own meaningful milestones.",[
    "Recall celebrations/meaningful moments from days 7, 14 and 21.",
    "Ask what matters most now and how the user wants to celebrate: movement, music, laughter, food, gift, sharing, walk, a loud yes, or own ritual.",
    "Talvira may join warmly/playfully (‘Юху!’) only if it matches the user's style; never manufacture enthusiasm or insist on celebration."
  ],["Что я праздную сейчас?","Почему это важно лично для меня?","Как я хочу запомнить этот момент?"],{celebration:true}),

  d(28,4,"return_map","Возвращение к себе","Create the collaboratively confirmed final map and a personal return-to-self micro-protocol.",[
    "Compare beginning and current self-description without claiming treatment outcomes.",
    "Map: first signals; what stops me; what matters to those stopping voices/figures; real resources; imagined allies; difficult-to-allow feelings only if confirmed; emerging qualities; embodied form; 1% real-life experiments; what I do not want to change; what I want to explore next.",
    "Measure process literacy rather than symptom cure: noticing signals, recognizing stopping moments, knowing resources, ability to stop exploration, distinguishing sides of self, having more response options.",
    "Create ‘My way of returning to myself’: When I notice X → I can Y → Z supports me. Use the user's own language.",
    "Every final statement remains editable/correctable by the user."
  ],["Что я теперь знаю о себе, чего не знала 28 дней назад?","Что особенно хочу сохранить?","Что хочу исследовать дальше?","Как звучит мой собственный способ возвращаться к себе?"])
];

export function getReturnToSelfDay(dayNumber) {
  return RETURN_TO_SELF_DAYS.find((item) => item.day === Number(dayNumber)) || null;
}

export function validateReturnToSelfProgram() {
  const days = RETURN_TO_SELF_DAYS.map((x) => x.day);
  const unique = new Set(days);
  return {
    valid: RETURN_TO_SELF_DAYS.length === 28 && unique.size === 28 && Math.min(...days) === 1 && Math.max(...days) === 28,
    count: RETURN_TO_SELF_DAYS.length,
  };
}
