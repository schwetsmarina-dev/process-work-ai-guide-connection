// Legal documents shown inside the app.
//
// These live in the codebase rather than on the marketing site on purpose:
// the app is what processes the data, so the documents must survive any
// redesign or replacement of the landing page. The landing page links here.
//
// ⚠️ PENDING BEFORE COMMERCIAL LAUNCH
// The identity fields below are placeholders because the controller is not yet
// registered as autónoma. Spanish law (LSSI-CE art. 10) requires full legal
// name, tax number and address of the provider on a commercial site, and GDPR
// art. 13 requires identifying the controller. Fill CONTROLLER before charging
// money. The placeholders are deliberately visible in the UI rather than
// silently empty, so an unfinished document cannot be mistaken for a finished
// one.

export const CONTROLLER = {
  legalName: "", // e.g. "Marina Schwets"
  taxId: "", // NIE / NIF
  address: "", // full postal address
  email: "processworkmarina@gmail.com",
  site: "https://pwguide.uwu.ai",
  lastUpdated: "2026-07-23",
};

const PENDING = {
  es: "[pendiente de completar antes del lanzamiento comercial]",
  ru: "[будет заполнено до коммерческого запуска]",
};

function identity(lang) {
  const p = PENDING[lang];
  return {
    name: CONTROLLER.legalName || p,
    tax: CONTROLLER.taxId || p,
    addr: CONTROLLER.address || p,
  };
}

// ─────────────────────────────────────────────────────────────── ESPAÑOL ────

const privacyEs = () => {
  const id = identity("es");
  return `# Política de privacidad

**Última actualización:** ${CONTROLLER.lastUpdated}

## 1. Responsable del tratamiento

- **Titular:** ${id.name}
- **NIF/NIE:** ${id.tax}
- **Domicilio:** ${id.addr}
- **Correo de contacto:** ${CONTROLLER.email}
- **Sitio web:** ${CONTROLLER.site}

## 2. Qué datos tratamos

**Datos de la cuenta:** correo electrónico, idioma preferido y año de nacimiento. No pedimos la fecha completa de nacimiento: el año basta para comprobar la edad mínima.

**Contenido de tus sesiones:** los mensajes que escribes, los resúmenes generados automáticamente, los insights que guardas y las notas de tu diario.

**Datos derivados:** temas recurrentes y señales que el sistema identifica, y una memoria breve que da continuidad entre sesiones.

**Datos fisiológicos (opcional):** solo si decides introducirlos manualmente.

**Eventos de seguridad:** si el sistema detecta indicios de riesgo grave, se registra el hecho y el fragmento de texto que lo activó.

**Datos técnicos:** estadísticas de uso anónimas y sin cookies, y registros de errores sin contenido de sesiones.

## 3. Categoría especial de datos

El contenido de tus sesiones revela información sobre tu estado psicológico. El RGPD lo considera **categoría especial (art. 9)**, por lo que solo lo tratamos con tu **consentimiento explícito**, que puedes retirar en cualquier momento.

## 4. Base jurídica

| Finalidad | Base jurídica |
| --- | --- |
| Prestar el servicio y mantener tu cuenta | Ejecución del contrato (art. 6.1.b) |
| Tratar el contenido de tus sesiones | Consentimiento explícito (art. 9.2.a) |
| Registrar y comunicar eventos de riesgo grave | Interés vital (art. 9.2.c) |
| Estadísticas de uso anónimas | Interés legítimo (art. 6.1.f) |
| Investigación con datos anonimizados | Consentimiento separado y voluntario |

## 5. Inteligencia artificial

La conversación la conduce un sistema de inteligencia artificial, **no una persona**. Se te indica antes de empezar y de forma permanente durante la sesión, conforme al art. 50 del Reglamento (UE) 2024/1689.

El contenido de la sesión se envía al proveedor del modelo de lenguaje, que actúa como encargado del tratamiento y no lo utiliza para entrenar sus modelos.

El sistema **no toma decisiones automatizadas con efectos jurídicos** y **no realiza diagnósticos**.

## 6. Encargados y transferencias

Alojamiento y base de datos, generación de respuestas, analítica anónima y monitorización de errores se prestan por proveedores externos. Algunos están fuera del Espacio Económico Europeo; en esos casos la transferencia se ampara en las **Cláusulas Contractuales Tipo** de la Comisión Europea.

## 7. Conservación

Mientras la cuenta esté activa. Tras solicitar la supresión, eliminación en un plazo máximo de 30 días. Registros técnicos: 90 días.

## 8. Tus derechos

Acceso, rectificación, supresión, limitación, portabilidad y oposición, además de **retirar el consentimiento** en cualquier momento.

Desde **Ajustes → Privacidad** puedes descargar todos tus datos en JSON y eliminar tu cuenta con todo su contenido de forma inmediata.

Para cualquier otra solicitud: ${CONTROLLER.email}

Puedes reclamar ante la **Agencia Española de Protección de Datos** (www.aepd.es).

## 9. Menores

El servicio está dirigido a personas mayores de **16 años**. Comprobamos la edad en el registro y eliminamos las cuentas que no cumplan este requisito.

## 10. Seguridad

Comunicaciones cifradas y acceso restringido por reglas a nivel de registro. Si se produjera una violación de seguridad de alto riesgo, te lo comunicaríamos y lo notificaríamos a la AEPD en 72 horas.`;
};

const termsEs = () => `# Términos de uso

**Última actualización:** ${CONTROLLER.lastUpdated}

## 1. Qué es este servicio

Una herramienta de **autoexploración guiada** basada en inteligencia artificial e inspirada en la Psicología Orientada a Procesos.

## 2. Qué NO es

Esto es lo más importante de este documento:

- **No es psicoterapia** ni sustituye un tratamiento psicológico o psiquiátrico
- **No es un servicio sanitario** ni un producto sanitario
- **No emite diagnósticos** ni recomendaciones médicas
- **No es un servicio de emergencia** y no está atendido en tiempo real
- Quien responde **no es una persona** ni un profesional colegiado

**Si estás en crisis, llama al 024 (España, gratuito, 24 h) o al 112.**

## 3. Quién puede usarlo

Personas mayores de 16 años. Al registrarte confirmas que cumples este requisito.

No es adecuado durante una crisis psicológica aguda, un episodio psicótico o con ideación suicida activa. En esos casos busca atención profesional presencial.

## 4. Tu responsabilidad

Las sesiones pueden remover material emocional significativo. Decides tú qué explorar y hasta dónde, y puedes detenerlas en cualquier momento. Si algo se vuelve demasiado intenso, interrumpe y busca apoyo humano.

## 5. Limitación de responsabilidad

El servicio se presta «tal cual». En la máxima medida permitida por la ley, el titular no responde de las decisiones que tomes a partir del contenido de las sesiones. Nada aquí limita la responsabilidad en los casos en que la ley no lo permite, ni afecta a tus derechos como consumidor.

## 6. Propiedad intelectual

El contenido de tus sesiones te pertenece. La aplicación, su código y su metodología pertenecen al titular.

## 7. Pagos y suscripción

Las condiciones de precio, renovación e impuestos se muestran antes de completar el pago. Puedes cancelar en cualquier momento desde el portal de suscripción; conservarás el acceso hasta el final del periodo ya pagado.

Como consumidor dispones de **14 días de desistimiento**. Si pides acceso inmediato al contenido digital y lo utilizas dentro de ese plazo, ese derecho decae conforme a la normativa aplicable.

## 8. Modificaciones y cancelación

Podemos modificar estos términos avisando con antelación razonable. Puedes eliminar tu cuenta en cualquier momento desde Ajustes.

## 9. Ley aplicable

Legislación española. Si eres consumidor, podrás acudir a los tribunales de tu domicilio.`;

const noticeEs = () => {
  const id = identity("es");
  return `# Aviso legal

En cumplimiento del artículo 10 de la Ley 34/2002 (LSSI-CE):

- **Titular:** ${id.name}
- **NIF/NIE:** ${id.tax}
- **Domicilio:** ${id.addr}
- **Correo electrónico:** ${CONTROLLER.email}
- **Sitio web:** ${CONTROLLER.site}

El acceso al sitio implica la aceptación de las condiciones publicadas. El titular se reserva el derecho a modificar los contenidos sin previo aviso.`;
};

// ─────────────────────────────────────────────────────────────── РУССКИЙ ────

const privacyRu = () => {
  const id = identity("ru");
  return `# Политика конфиденциальности

**Обновлено:** ${CONTROLLER.lastUpdated}

## 1. Кто обрабатывает данные

- **Владелец:** ${id.name}
- **NIF/NIE:** ${id.tax}
- **Адрес:** ${id.addr}
- **Контакт:** ${CONTROLLER.email}
- **Сайт:** ${CONTROLLER.site}

## 2. Какие данные мы обрабатываем

**Данные аккаунта:** email, язык, год рождения. Полную дату рождения мы не спрашиваем — года достаточно для проверки возраста.

**Содержание сессий:** сообщения, автоматические резюме, сохранённые инсайты и записи дневника.

**Производные данные:** повторяющиеся темы и сигналы, а также краткая память для преемственности между сессиями.

**Физиологические данные (по желанию):** только если ты вводишь их вручную.

**События безопасности:** при признаках серьёзного риска фиксируется сам факт и фрагмент текста, который его вызвал.

**Технические данные:** обезличенная статистика использования без cookies и журналы ошибок без содержания сессий.

## 3. Особая категория данных

Содержание сессий раскрывает информацию о психическом состоянии. GDPR относит это к **особой категории (ст. 9)**, поэтому обработка возможна только с **явного согласия**, которое можно отозвать в любой момент.

## 4. Правовые основания

| Цель | Основание |
| --- | --- |
| Работа сервиса и аккаунта | Исполнение договора (ст. 6.1.b) |
| Обработка содержания сессий | Явное согласие (ст. 9.2.a) |
| Фиксация и передача событий риска | Жизненно важные интересы (ст. 9.2.c) |
| Обезличенная статистика | Законный интерес (ст. 6.1.f) |
| Исследования на обезличенных данных | Отдельное добровольное согласие |

## 5. Искусственный интеллект

Беседу ведёт **система искусственного интеллекта, а не человек**. Об этом сообщается до начала и постоянно во время сессии — согласно ст. 50 Регламента (ЕС) 2024/1689.

Содержание сессии передаётся провайдеру языковой модели, который выступает обработчиком и не использует данные для обучения своих моделей.

Система **не принимает автоматизированных решений с юридическими последствиями** и **не ставит диагнозов**.

## 6. Обработчики и передача данных

Хостинг и база данных, генерация ответов, обезличенная аналитика и мониторинг ошибок обеспечиваются внешними провайдерами. Часть из них находится за пределами ЕЭП; такие передачи защищены **Стандартными договорными условиями** Еврокомиссии.

## 7. Сроки хранения

Пока аккаунт активен. После запроса на удаление — не более 30 дней. Технические журналы — 90 дней.

## 8. Твои права

Доступ, исправление, удаление, ограничение, переносимость и возражение, а также **отзыв согласия** в любой момент.

В разделе **Настройки → Приватность** можно скачать все свои данные в JSON и немедленно удалить аккаунт со всем содержимым.

По другим вопросам: ${CONTROLLER.email}

Жалобу можно подать в **Испанское агентство по защите данных** (www.aepd.es).

## 9. Несовершеннолетние

Сервис предназначен для лиц **старше 16 лет**. Возраст проверяется при регистрации; аккаунты, не отвечающие этому требованию, удаляются.

## 10. Безопасность

Шифрование соединений и ограничение доступа правилами на уровне записей. При утечке с высоким риском мы сообщим тебе и уведомим AEPD в течение 72 часов.`;
};

const termsRu = () => `# Условия использования

**Обновлено:** ${CONTROLLER.lastUpdated}

## 1. Что это за сервис

Инструмент **направляемого самоисследования** на основе искусственного интеллекта, вдохновлённый процессуально-ориентированной психологией.

## 2. Чем это НЕ является

Самое важное в этом документе:

- **Это не психотерапия** и не замена психологическому или психиатрическому лечению
- **Это не медицинская услуга** и не медицинское изделие
- **Здесь не ставят диагнозов** и не дают медицинских рекомендаций
- **Это не служба экстренной помощи**, обращения не отслеживаются в реальном времени
- Отвечает **не человек** и не дипломированный специалист

**Если ты в кризисе: 024 (Испания, бесплатно, круглосуточно) или 112.**

## 3. Кто может пользоваться

Люди старше 16 лет. Регистрируясь, ты подтверждаешь это.

Сервис не подходит при острой психологической кризисной ситуации, психотическом эпизоде или активных суицидальных мыслях. В этих случаях нужна очная профессиональная помощь.

## 4. Твоя ответственность

Сессии могут поднимать значимый эмоциональный материал. Ты сама решаешь, что исследовать и насколько глубоко, и можешь остановиться в любой момент. Если становится слишком, прервись и обратись за человеческой поддержкой.

## 5. Ограничение ответственности

Сервис предоставляется «как есть». В максимальной степени, допускаемой законом, владелец не отвечает за решения, принятые на основе содержания сессий. Ничто здесь не ограничивает ответственность там, где закон этого не позволяет, и не затрагивает твои права как потребителя.

## 6. Интеллектуальная собственность

Содержание твоих сессий принадлежит тебе. Приложение, его код и методология принадлежат владельцу.

## 7. Оплата и подписка

Цена, порядок продления и налоги показываются до完成 оплаты. Отменить подписку можно в любой момент в портале управления; доступ сохраняется до конца оплаченного периода.

Как у потребителя, у тебя есть **14 дней на отказ**. Если ты запрашиваешь немедленный доступ к цифровому контенту и пользуешься им в этот срок, право на отказ прекращается согласно применимым нормам.

## 8. Изменения и прекращение

Условия могут меняться с разумным предварительным уведомлением. Удалить аккаунт можно в любой момент в Настройках.

## 9. Применимое право

Законодательство Испании. Как потребитель, ты вправе обратиться в суд по месту своего жительства.`;

const noticeRu = () => {
  const id = identity("ru");
  return `# Правовая информация

Во исполнение статьи 10 Закона 34/2002 (LSSI-CE):

- **Владелец:** ${id.name}
- **NIF/NIE:** ${id.tax}
- **Адрес:** ${id.addr}
- **Email:** ${CONTROLLER.email}
- **Сайт:** ${CONTROLLER.site}

Использование сайта означает принятие опубликованных условий. Владелец оставляет за собой право изменять содержание без предварительного уведомления.`;
};

// ─────────────────────────────────────────────────────────────────────────────

export const LEGAL_DOCS = {
  privacy: { es: privacyEs, ru: privacyRu, slug: "privacidad" },
  terms: { es: termsEs, ru: termsRu, slug: "terminos" },
  notice: { es: noticeEs, ru: noticeRu, slug: "aviso-legal" },
};

export function getLegalDoc(docKey, lang) {
  const doc = LEGAL_DOCS[docKey];
  if (!doc) return "";
  const build = doc[lang] || doc.ru;
  return build();
}

/** True while the controller identity is still unfilled. */
export function isLegalIdentityIncomplete() {
  return !CONTROLLER.legalName || !CONTROLLER.taxId || !CONTROLLER.address;
}
