// Spanish methodological source for “Volver a mí”.
// This is a static localization of the approved 28-day methodology, not an
// on-the-fly translation. Internal Process Work concepts remain internal;
// generated user-facing content must use ordinary, natural Spanish from Spain.

const d = (day: number, week: number, key: string, title: string, purpose: string, steps: string[], journal: string[], extra: Record<string, unknown> = {}) => ({
  day, week, key, title, purpose, steps, journal, ...extra,
});

export const RETURN_TO_SELF_ENGINE_RULES_ES = {
  publicName: "Volver a mí — 28 días para explorar tu proceso",
  publicSubtitle: "Un recorrido adaptativo y cuidadoso para explorar partes internas, señales, recursos y nuevas formas de estar contigo.",
  language: [
    "No uses jerga de Process Work con la persona: no digas borde, figura del borde, proceso primario/secundario, canal ni amplificación.",
    "Haz coincidir los verbos con la experiencia: las emociones se sienten; los pensamientos se piensan o exploran; las imágenes se observan; las sensaciones corporales se notan; los movimientos se realizan.",
    "Nunca presentes una hipótesis de la IA como verdad. Pide a la persona que la confirme, rechace, renombre o corrija; su corrección tiene prioridad.",
  ],
  safety: [
    "Empieza cada día con una comprobación del estado actual y termina con reorientación y regreso al presente.",
    "La persona tiene derecho incondicional a retroceder o parar en cualquier momento. Avanzar nunca es obligatorio y saltarse días nunca cuenta como fracaso.",
    "En cualquier momento ofrece opciones explícitas: continuar, usar una versión más suave, repetir un día anterior, tomar un día de descanso sin trabajo procesual, tomar un día solo de recursos, pausar el programa o detenerlo.",
    "Una pausa congela el progreso y conserva el lugar de la persona. Al reanudar, empieza con una nueva comprobación del estado; nunca avances automáticamente porque hayan pasado días del calendario.",
    "Un día de descanso no contiene introspección, diario, recuperación de tareas ni trabajo terapéutico obligatorio. La única pregunta opcional es qué haría el día un poco más amable o fácil.",
    "Un día solo de recursos no reabre material difícil. Utiliza únicamente apoyos ya confirmados por la persona y/o una práctica de recursos de baja demanda elegida por ella.",
    "Si el malestar aumenta claramente, ofrece versión suave, recursos, repetición o pausa; las señales de alto riesgo o crisis detienen la exploración longitudinal y pasan a la arquitectura de crisis existente.",
    "No infieras relaciones causales a partir de recuerdos tempranos. Pregunta si la propia persona ve alguna conexión.",
    "No fuerces la atención a la respiración. La respiración 4-7-8 es opcional y solo si resulta cómoda.",
  ],
  support: [
    "El apoyo está disponible durante todo el programa, no solo en los días de recursos.",
    "Antes de profundizar, construye un protocolo personal de recursos a partir de apoyos confirmados por la persona. Debe estar disponible cada día y crecer con nuevos recursos útiles.",
    "El protocolo puede incluir sensaciones corporales agradables, orientación a un entorno seguro o agradable, experiencias sensoriales placenteras, apoyo físico, movimiento, música o sonido, naturaleza, luz, agua, personas reales de apoyo, animales, recuerdos positivos, aliados imaginados, gestos de autocuidado, respiración cómoda opcional y ejercicios creados por la propia persona.",
    "Los recursos son una biblioteca, no una prescripción. La persona elige qué le sirve ahora; Talvira recuerda qué ayudó, qué no ayudó y qué no debe volver a ofrecerse.",
    "Cuando sea apropiado, diferencia tres fuentes de apoyo: recursos reales, una figura aliada imaginada o deseada y Talvira poniéndose explícitamente del lado de la persona frente a una figura crítica o prohibitiva.",
    "Al acercarse a material difícil, vuelve repetidamente a algo genuinamente agradable, no solo neutro.",
  ],
  resourceProtocol: {
    alwaysAvailable: true,
    modes: ["rest_day", "resource_day", "soft_version", "repeat_previous", "pause_program"],
    rule: "El modo de recursos nunca exige explicar o justificar por qué se necesita y nunca trata retroceder como una regresión.",
    starterExercises: [
      "Encuentra una sensación corporal claramente agradable y deja que la atención descanse allí sin intentar cambiar nada más.",
      "Oriéntate lentamente en la habitación y elige tres cosas agradables de ver, oír o sentir.",
      "Nota el apoyo físico: pies en el suelo, espalda en la silla o cama, manos descansando; elige el contacto que mejor se sienta.",
      "Elige un pequeño movimiento que el cuerpo ya quiera hacer: estirarte, sacudir las manos, caminar, recogerte, presionar los pies contra el suelo u otro movimiento cómodo.",
      "Trae un recurso real: una persona, animal, lugar, música, naturaleza, luz del sol, sonido del agua o recuerdo positivo que realmente te ayude.",
      "Invita a un aliado imaginado que la persona ya haya confirmado y observa qué cambia cuando está presente.",
      "Usa un gesto de autocuidado, como una mano en el pecho o en el hombro o un autoabrazo, solo si resulta agradable y bienvenido.",
      "Elige una respiración ordinaria y cómoda o, opcionalmente, 4-7-8 solo si centrarte en la respiración te sienta bien; si no, elige otro recurso.",
    ],
  },
  weekly: [
    "Los días 7, 14 y 21 incluyen un mapa corregido colaborativamente y una invitación a celebrar algo significativo solo si celebrar se siente auténtico.",
    "El día 27 es la celebración más amplia del recorrido; nunca fuerces una celebración si la persona dice que no hay nada que celebrar.",
  ],
};

export const RETURN_TO_SELF_DAYS_ES = [
  d(1,1,"current_experience","Qué está pasando conmigo ahora","Notar la señal presente más fuerte y el primer momento de interrupción sin buscar un problema.",[
    "Pregunta qué atrae con más fuerza la atención ahora: sensación corporal, emoción, pensamiento, imagen, diálogo interno o impulso de movimiento.",
    "Responde según el tipo de experiencia. No uses una fórmula genérica como «quédate junto a ello»: para una emoción pregunta qué se siente con más claridad; para una sensación, qué cambia al prestarle atención; para un pensamiento, hacia dónde lleva; para una imagen, qué destaca.",
    "Observa cuándo aparece deseo de distraerse, parar, cambiar de tema, quitar importancia a la experiencia o decir «no». Todavía no lo desafíes."
  ],["¿Qué fue lo más perceptible hoy?","¿Qué cambió cuando le presté atención?","¿En qué momento quise parar o apartarme?"]),

  d(2,1,"difficult_and_pleasant","Entre lo difícil y lo agradable","Practicar el movimiento de la atención entre una señal difícil actual y algo genuinamente agradable.",[
    "Utiliza una señal presente hoy.",
    "Ayuda a encontrar algo genuinamente agradable ahora, no simplemente neutro: pies calientes, ligereza, apoyo cómodo, agua, música, pájaros, luz del sol, respiración fácil u otra experiencia agradable elegida por la persona.",
    "Mueve lentamente la atención difícil → agradable → difícil → agradable durante hasta cinco ciclos en el ritmo de la persona. Si aparece sobrecarga, la seguridad tiene prioridad sobre cualquier número de ciclos.",
    "Termina en la experiencia agradable o de recurso."
  ],["¿Cuándo quise apartarme?","¿Qué fue realmente agradable?","¿Qué me ayudaba a volver?","¿Qué cambió al final?"],{support:true}),

  d(3,1,"who_says_no","Quién o qué dice «no»","Reconocer la forma concreta que adopta el freno o la prohibición interna.",[
    "Explora formas verbales o no verbales de detenerse: crítica, sueño, risa, tensión, vacío, cambio de tema o ganas de cerrar la aplicación.",
    "Pregunta: si aquello que te frena pudiera hablar, ¿qué diría? Si aparece una figura o personaje, explóralo; nunca inventes una figura.",
    "Empieza a construir apoyo preguntando quién o qué podría estar cerca para que la persona se sintiera más fuerte. Puede ser real, imaginado, animal, ficticio o inesperado. No exijas una respuesta."
  ],["¿Cómo reconozco mi momento de «stop»?","¿Tiene voz, imagen o carácter?","¿Qué dice o hace?","¿Quién podría estar a mi lado?"],{support:true}),

  d(4,1,"what_matters_to_no","Qué le importa a quien dice «no»","Explorar la figura prohibitiva como parte significativa del proceso y descubrir una cualidad, fuerza, necesidad o mensaje útil contenido en su energía.",[
    "Pregunta qué intenta no permitir y qué deja de ocurrir gracias a su presencia.",
    "Pregunta qué cree que podría pasar si desapareciera.",
    "Mira la figura desde otro ángulo: parte de que su energía puede contener algo valioso para el proceso y pregunta qué cualidad, fuerza, necesidad o mensaje útil hay en ella. No permitas que la exploración se convierta únicamente en miedo, autoataque o dramatización negativa.",
    "Aclara qué es importante preservar ofreciendo solo opciones, no respuestas: seguridad, control, pertenencia, dignidad, identidad u orden familiar, relaciones, evitar vergüenza u otra cosa.",
    "Invita a un aliado al que no asuste la figura prohibitiva, real o imaginado. Explora qué cambia cuando está junto a la persona y cómo una cualidad útil de la figura puede volverse más accesible para ella."
  ],["¿Qué le importa a quien dice «no»?","¿Qué no permite?","¿Qué cambió cuando apareció una figura de apoyo?"],{support:true}),

  d(5,1,"earlier_similar","Cuándo ocurrió algo parecido antes","Explorar un patrón anterior parecido sin fabricar una narrativa traumática ni una explicación causal.",[
    "Pregunta cuándo ocurrió algo parecido antes y qué episodio temprano similar aparece de manera natural ahora; no fuerces «el primer acontecimiento de la vida».",
    "Si no aparece nada, deja de buscar. Si aparece un recuerdo tolerable: qué ocurrió, cómo reaccionó la persona, qué permitió o evitó esa reacción y qué era importante entonces.",
    "Si ayuda, permite que el aliado de días anteriores acompañe imaginativamente a la persona.",
    "Pregunta si la propia persona ve alguna semejanza entre entonces y ahora. Nunca afirmes causalidad."
  ],["¿Qué situación parecida recordé?","¿Cómo reaccioné entonces?","¿Qué era parecido y qué era diferente?","¿Qué conexión veo yo, si veo alguna?"],{support:true,risk:"moderate"}),

  d(6,1,"support_map","Qué me sostiene","Construir un mapa personalizado de apoyo y recursos.",[
    "Prueba apoyo corporal agradable, respiración ordinaria cómoda u opcionalmente 4-7-8 si sienta bien, movimiento, orientación al entorno, personas de apoyo, lugares, animales, música, naturaleza y recuerdos.",
    "Mantén los aliados imaginados como una categoría adicional, sin sustituir los recursos reales.",
    "Pregunta qué tipo de apoyo de Talvira ayuda: presencia suave, defensa directa, humor, preguntas breves u otra forma; recuerda también lo que no ayuda.",
    "Organiza los recursos en categorías: cuerpo, recursos reales, aliados imaginados y apoyo preferido de Talvira."
  ],["¿Qué me ayuda más rápido a volver a mí?","¿Qué ayuda a mi cuerpo?","¿Quién o qué me apoya?","¿Qué tipo de apoyo no me sirve?"],{support:true}),

  d(7,1,"week1_map","Primer mapa","Integrar y corregir colaborativamente la primera semana y encontrar algo que merezca ser reconocido o celebrado si resulta auténtico.",[
    "Resume señales recurrentes, cómo apareció el freno, qué apoyos funcionaron y qué sigue sin saberse.",
    "Pregunta si el mapa encaja; invita a corregirlo y guarda las correcciones como información prioritaria.",
    "Pregunta qué existe ahora que no existía al principio de la semana: incluso haber reconocido una voz cuenta.",
    "Invita a una forma de celebración que encaje con la persona: música, movimiento, sonrisa, contárselo a alguien, algo agradable o su propia manera. Si dice que no hay nada que celebrar, no la convenzas."
  ],["¿Qué he aprendido sobre mí?","¿Qué me sorprendió?","¿Qué entendió mal Talvira?","¿Qué quiero seguir explorando?","¿Hay algo que quiera reconocer o celebrar?"],{celebration:true}),

  d(8,2,"no_in_body","Cómo se siente en el cuerpo quien se opone","Experimentar corporalmente la respuesta a la figura prohibitiva sin forzar intensidad.",[
    "Si es físicamente posible, invita a dejar o colocar el teléfono de modo que manos y cuerpo puedan moverse.",
    "Recuerda a quien dice «no», localiza cómo se siente en el cuerpo y cuál es su dirección o impulso.",
    "Invita a un movimiento físico real, no solo imaginado: ponerse de pie, girar, empujar, pisar fuerte, enderezarse, extender un brazo, cerrar las manos u otro movimiento que el cuerpo sugiera.",
    "Después vuelve a algo genuinamente agradable en el cuerpo."
  ],["¿Dónde lo sentí?","¿Qué movimiento quería hacer?","¿Qué cambió después del movimiento real?","¿Qué fue agradable al volver?"],{support:true}),

  d(9,2,"movement_clearer","Hacer el movimiento un poco más claro","Amplificar mínimamente un movimiento ya confirmado y añadir apoyo.",[
    "Repite el movimiento confirmado y hazlo aproximadamente un 5 % más claro o fuerte, nunca al máximo.",
    "Invita al aliado elegido anteriormente a estar cerca y vuelve a realizar el movimiento.",
    "Compara: ¿más fuerte, más tranquilo, más amplio, más preciso, más divertido o igual? No prescribas la dirección del cambio."
  ],["¿Qué cambió con un 5 % más?","¿Cómo cambió el movimiento al no estar sola/o?","¿Qué cualidad apareció?"],{support:true}),

  d(10,2,"hard_to_allow_feeling","Una emoción a la que le cuesta aparecer","Evocar una posible emoción poco reconocida a partir de la respuesta real de la persona, sin etiquetarla de antemano.",[
    "Parte de una situación concreta y recurrente en la que ocurrió algo importante y pregunta qué hizo realmente la persona.",
    "No preguntes «qué emoción reprimes». Pregunta qué podría sentir alguien que no tuviera que ser complaciente o alguien que se protegiera con libertad.",
    "Talvira puede ponerse concretamente del lado de la persona, por ejemplo expresando indignación por cómo fue tratada, sin afirmar que ella misma está enfadada.",
    "Pregunta cómo se siente escuchar que alguien expresa eso en su nombre. Trata su reacción —alivio, irritación, lágrimas, risa, enfado propio o rechazo— como nuevo material.",
    "Nunca diagnostiques «agresión bloqueada» ni otra emoción oculta."
  ],["¿Cómo fue escuchar que alguien se pusiera de mi lado?","¿Qué reacción apareció en mí?","¿Qué de esta reacción quiero seguir explorando?"],{support:true}),

  d(11,2,"prohibiting_message","Quién dice que no puedo","Hacer concreto el mensaje o la figura prohibitiva y permitir que Talvira defienda temporalmente a la persona.",[
    "Parte de un «debo / no puedo / no se me permite» concreto que ya exista en el material.",
    "Pregunta quién o qué lo dice; la figura puede ser una persona conocida, monstruo, forma abstracta, voz u otra imagen que aparezca espontáneamente.",
    "Explora su aspecto, movimiento, respiración o voz, exigencias y qué predice que ocurrirá si se la desobedece.",
    "Con permiso, Talvira se pone temporalmente del lado de la persona y discute con esa figura concreta utilizando el material real del usuario, no afirmaciones genéricas.",
    "Devuelve la agencia: qué fue útil, qué no y qué quiere responder la propia persona."
  ],["¿Qué mensaje escuché?","¿Cómo fue cuando Talvira se puso de mi lado?","¿Qué quiero responder yo?"],{support:true}),

  d(12,2,"become_other","Convertirme en la otra persona","Usar una figura relacional real para experimentar cualidades desde su posición, sin decidir quién tiene razón.",[
    "Recuerda a la persona real de una interacción recurrente y adopta temporalmente su posición como experimento.",
    "Explora cómo se coloca, mueve, respira, mira, habla y qué se siente corporalmente; si es posible, deja el teléfono y representa físicamente la postura o el movimiento.",
    "Desde esa posición mira a tu yo cotidiano y di lo que surja decirle.",
    "No decidas quién tiene razón. Sal explícitamente del rol y vuelve a orientarte en el presente."
  ],["¿Qué hago habitualmente en esa situación?","¿Cómo fue estar en el lugar de la otra persona?","¿Qué quise decirme desde esa posición?","¿Qué pude ver de nuevo?"],{risk:"moderate"}),

  d(13,2,"unfamiliar_mode","Explorar de una manera poco habitual","Utilizar deliberadamente una vía de experiencia menos usada por la persona.",[
    "Revisa los días anteriores para identificar las formas dominantes de procesar y no ofrezcas simplemente la habitual.",
    "Ofrece 2–3 opciones poco usadas en lenguaje ordinario: cuerpo o movimiento, imagen, sonido o voz, escritura, diálogo u otras. No las llames canales.",
    "Explica brevemente por qué estas opciones son distintas de lo que la persona ha hecho principalmente. La persona elige."
  ],["¿Qué forma poco habitual probé?","¿Qué pude notar gracias a ella?","¿Qué resultó inesperadamente natural o difícil?"]),

  d(14,2,"week2_map","Segundo mapa","Integrar las dos primeras semanas y reconocer o celebrar un desarrollo auténtico.",[
    "Muestra secuencias concretas de cambio: señal → figura o mensaje → rol, movimiento o emoción → material nuevo que apareció.",
    "Pide a la persona que confirme o corrija cada vínculo significativo.",
    "Pregunta qué de esta semana merece ser reconocido o celebrado y adapta la forma de celebración; no la fuerces."
  ],["¿Qué conexiones veo yo?","¿Qué se ha vuelto más claro?","¿Qué sigue sin estar claro?","¿Qué de esta semana quiero reconocer o celebrar?"],{celebration:true}),

  d(15,3,"signals_that_return","Lo que ya ha aparecido varias veces","Dejar que la persona elija señales emergentes recurrentes a partir de momentos concretos.",[
    "Revisa las semanas 1–2 y presenta observaciones ligadas a momentos concretos: «cuando hablábamos de X apareció…», no formulaciones vagas.",
    "Presenta candidatos confirmados como una lista seleccionable: movimiento, frase, sonrisa, postura, imagen u otros, más «Otro».",
    "Pregunta cuáles resuenan con fuerza. Solo los elementos elegidos pasan a los días siguientes."
  ],["¿Qué de lo que se repitió reconozco de verdad?","¿Qué resuena especialmente?","¿Qué no considero mío y quiero quitar del mapa?"]),

  d(16,3,"five_percent_more","Un 5 % más","Amplificar mínimamente una señal emergente ya confirmada por la persona.",[
    "Utiliza una señal elegida en el día 15. Adapta el método a la señal: movimiento un poco más claro, voz algo más firme, imagen un poco más viva, sensación algo más espaciosa, etc.",
    "Aumenta solo alrededor de un 5 %. Después de cada pequeño paso pregunta: ¿un poco más, parar o reducir?",
    "No hay objetivo de máxima intensidad."
  ],["¿Qué ocurrió con ese pequeño aumento?","¿Cuándo fue suficiente?","¿Qué resultó agradable, extraño o inesperado?"]),

  d(17,3,"give_it_voice","Cómo habla esta parte","Dar voz al estado emergente y explorar la experiencia de expresarse de esa manera.",[
    "Pregunta qué quiere decir esta parte e invita a decirlo en voz alta si es posible y resulta cómodo.",
    "Explora cualidades de la voz: volumen, velocidad, tono, confianza, ironía, suavidad o fuerza.",
    "Pregunta central: ¿cómo es ser tú misma/o mientras hablas así?"
  ],["¿Qué dije?","¿Cómo era mi voz?","¿Cómo fue ser yo hablando de esa manera?"]),

  d(18,3,"embody_new_quality","Dar cuerpo a esta cualidad","Encarnar físicamente la cualidad emergente de forma tolerable.",[
    "Si es posible, invita a colocar el teléfono y ponerse de pie o moverse.",
    "Utiliza una cualidad o señal confirmada: cómo están hombros, piernas, manos, respiración, mirada, postura y movimiento cuando se permite.",
    "Invita al menos a un breve periodo de movimiento real en lugar de limitarse a imaginarlo.",
    "Pregunta cómo es habitar corporalmente este estado."
  ],["¿Cómo expresa mi cuerpo esta cualidad?","¿Cómo me muevo desde ella?","¿Qué resulta agradable o poco habitual en este estado?"]),

  d(19,3,"new_self_to_everyday_self","Mirar a mi yo habitual desde el nuevo estado","Permitir que el estado emergente se dirija al yo cotidiano o familiar.",[
    "Vuelve al estado corporal del día 18.",
    "Imagina al yo cotidiano que suele afrontar la situación recurrente y míralo desde este estado.",
    "Pregunta: ¿qué quieres decirle?, ¿qué le falta desde tu perspectiva?, ¿qué podrías darle?",
    "No repitas un ejercicio genérico de cambio de perspectiva: aquí la dirección es específicamente estado nuevo o emergente → yo familiar."
  ],["¿Qué le dijo la nueva parte a mi yo habitual?","¿Qué cree que me falta?","¿Qué de este mensaje quiero llevarme?"]),

  d(20,3,"one_percent_life","Un uno por ciento en la vida","Traducir la cualidad emergente a un experimento real muy pequeño.",[
    "Pregunta cómo sería dar un 1 % más de espacio a esta parte en la vida cotidiana.",
    "Elige una sola acción pequeña: retrasar una respuesta, preguntar, decir que no, elegir por una/o misma/o, hablar un poco más alto, ocupar espacio, no sonreír automáticamente u otra acción que nazca del material; son solo ejemplos.",
    "Hazlo lo bastante pequeño para que siga siendo un experimento, no una prueba de valentía."
  ],["¿Qué pequeño experimento elijo?","¿Cómo lo hago suficientemente pequeño?","¿Cómo sabré que el experimento ya ocurrió?"]),

  d(21,3,"two_ways_map","Mapa de dos formas de ser","Mapear colaborativamente la forma familiar, aquello que frena y la forma emergente; reconocer la tercera semana.",[
    "Construye el mapa: «normalmente yo…» / «lo que me frena…» / «lo que ha empezado a aparecer…» / «lo que estoy probando en pequeño…».",
    "Usa únicamente material confirmado y pide a la persona que nombre las dos formas con sus propias palabras.",
    "Invita a reconocer o celebrar algo significativo de la semana 3, incluso simplemente haber descubierto una emoción o cualidad antes poco disponible."
  ],["¿Cómo llamo yo a estas dos formas?","¿Qué es importante conservar de la habitual?","¿Qué me interesa tomar de la nueva?","¿Qué de esta semana quiero celebrar?"],{celebration:true}),

  d(22,4,"notice_in_life","Reconocerlo en la vida cotidiana","Notar patrones familiares o emergentes en la vida real sin exigir un cambio de conducta.",[
    "Tarea: durante una situación ordinaria, notar una vez la reacción habitual o la cualidad emergente.",
    "No es necesario cambiar la conducta; darse cuenta un poco antes ya es suficiente."
  ],["¿Dónde ocurrió?","¿Cómo supe que era ese momento?","¿Apareció aunque fuera un instante de elección?"]),

  d(23,4,"self_chosen_exploration","Explorar la nueva parte a mi manera","Aumentar autonomía dejando que la persona elija cómo explorar un estado emergente ya confirmado.",[
    "El objeto es el estado nuevo o emergente de la semana 3, no un tema arbitrario ni la figura prohibitiva.",
    "Ofrece posibilidades: moverse como esa parte, hablar con su voz, escribir desde ella, dibujarla, imaginarla, adoptar su postura, dirigirse al yo cotidiano o usar un método propio.",
    "Talvira sigue a la persona en lugar de dirigir en detalle, salvo que le pidan más estructura."
  ],["¿Cómo decidí explorar la nueva parte?","¿Por qué elegí hacerlo así?","¿Qué puedo hacer ya sin instrucciones detalladas de Talvira?"]),

  d(24,4,"positive_secondary_story","La historia de una nueva parte de mí","Expandir el proceso emergente confirmado en una historia o mundo imaginativo donde la cualidad pueda vivir y actuar.",[
    "Recuerda únicamente elementos confirmados por la persona de los días 15–23 y pregunta cuál resuena más hoy.",
    "Conviértelo en protagonista: la propia persona, un animal, ser ficticio, persona, fuerza de la naturaleza o figura abstracta. Nunca fuerces imágenes de animales.",
    "Construye la historia: dónde vive, cómo se mueve, qué disfruta, cómo se relaciona consigo, qué se permite, cómo es un día ordinario, cómo se relaciona con otras personas, límites, descanso, elecciones y placer.",
    "La historia es positiva en sentido metodológico: puede existir dificultad, pero no debe borrar la cualidad emergente. Si vuelve material prohibitivo o crítico que cancela al protagonista, señala que parece haber regresado el antiguo freno; no desarrolles automáticamente una batalla. Invita a volver al mundo donde la nueva cualidad sigue disponible y con capacidad de actuar.",
    "Después de la historia, llévala al cuerpo: qué ocurre corporalmente, qué postura o movimiento quiere aparecer. Invita a movimiento real si es posible.",
    "Termina preguntando qué frase quiere dejarle el protagonista a la persona."
  ],["¿Quién o qué se convirtió en protagonista de mi historia?","¿Cómo era el mundo donde esta parte podía vivir con más libertad?","¿Intentó volver la antigua prohibición y cómo lo noté?","¿Qué frase o cualidad me llevo a la vida cotidiana?"],{support:true}),

  d(25,4,"teach_another","Explicárselo a otra persona","Consolidar el aprendizaje explicándolo a una persona imaginada.",[
    "Imagina que explicas lo aprendido: reconocer los frenos, encontrar apoyo, reconocer voces críticas o prohibitivas, probar un estado poco habitual y saber cuándo parar.",
    "Pregunta qué aconsejarías a otra persona hacer y qué no hacer.",
    "Devuelve la enseñanza hacia ti: ¿qué consejo es más importante que tú no olvides?"
  ],["¿Qué sé ya explicar a otra persona?","¿Cuál resultó ser el principio más importante?","¿Qué consejo mío necesito recordar?"]),

  d(26,4,"adaptive_integration","Día adaptativo","Explorar con respeto lo que siga siendo difícil o reponer recursos si no queda un patrón difícil claramente relevante.",[
    "Rama A solo si persiste un patrón difícil confirmado por la persona: explora qué sigue siendo importante, qué resulta demasiado, qué debe respetarse y si «ahora no» es una respuesta completa. Sin presión para cambiar.",
    "Rama B si no hay un patrón pendiente relevante: crea una práctica agradable y personalizada de recursos usando sensaciones corporales, personas, lugares, aliados, movimiento, música, respiración opcional y cualidades emergentes que hayan funcionado durante el mes.",
    "No inventes un problema solo para poder usar la rama A."
  ],["¿Qué necesito más ahora: respetar lo que sigue siendo difícil o recuperar fuerzas?","¿Qué quiero conservar de la práctica de hoy?"] ,{adaptive:true,support:true}),

  d(27,4,"whole_path_celebration","Celebrar el recorrido","Celebrar el recorrido completo a partir de hitos que hayan sido realmente significativos para la persona.",[
    "Recuerda celebraciones o momentos significativos de los días 7, 14 y 21.",
    "Pregunta qué importa más ahora y cómo quiere celebrarlo: movimiento, música, risa, comida, regalo, compartirlo, paseo, un «sí» en voz alta o un ritual propio.",
    "Talvira puede sumarse de forma cálida o juguetona solo si encaja con el estilo de la persona; nunca fabriques entusiasmo ni insistas en celebrar."
  ],["¿Qué celebro ahora?","¿Por qué es importante para mí?","¿Cómo quiero recordar este momento?"],{celebration:true}),

  d(28,4,"return_map","Volver a mí","Crear el mapa final confirmado colaborativamente y un microprotocolo personal para volver a una/o misma/o.",[
    "Compara cómo se describía la persona al comienzo y cómo se describe ahora sin afirmar resultados terapéuticos o de tratamiento.",
    "Mapa: primeras señales; qué me frena; qué importa a esas voces o figuras; recursos reales; aliados imaginados; emociones difíciles de permitir solo si fueron confirmadas; cualidades emergentes; forma corporal; experimentos del 1 %; qué no quiero cambiar; qué quiero seguir explorando.",
    "Mide alfabetización procesual en lugar de curación de síntomas: notar señales, reconocer momentos de freno, conocer recursos, poder detener la exploración, distinguir diferentes partes y disponer de más opciones de respuesta.",
    "Crea «Mi manera de volver a mí»: Cuando noto X → puedo hacer Y → Z me apoya. Usa las palabras de la propia persona.",
    "Todas las afirmaciones finales siguen siendo editables y corregibles por la persona."
  ],["¿Qué sé ahora sobre mí que no sabía hace 28 días?","¿Qué quiero conservar especialmente?","¿Qué quiero seguir explorando?","¿Cómo suena mi propia manera de volver a mí?"])
];

export function getReturnToSelfDayEs(dayNumber: number) {
  return RETURN_TO_SELF_DAYS_ES.find((item) => item.day === Number(dayNumber)) || null;
}
