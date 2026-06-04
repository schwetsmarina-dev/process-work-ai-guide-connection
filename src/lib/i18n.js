// Minimal i18n helper for RU / ES (beta testing phase).
// Default language is Russian.

export const SUPPORTED_LANGUAGES = ["ru", "es"];
export const DEFAULT_LANGUAGE = "ru";

export function normalizeLang(lang) {
  return SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
}

const translations = {
  ru: {
    // Settings
    settings_title: "Настройки",
    settings_subtitle: "Управление профилем",
    profile: "Профиль",
    name: "Имя",
    email: "Email",
    privacy: "Конфиденциальность",
    privacy_text:
      "Ваши данные хранятся в защищённой базе данных. Сессии и сообщения доступны только вам. Этот инструмент не заменяет профессиональную психологическую помощь.",
    logout: "Выход",
    logout_text: "Вы будете перенаправлены на страницу входа",
    logout_button: "Выйти из аккаунта",
    language: "Язык / Idioma",
    language_russian: "Русский",
    language_spanish: "Español",
    language_saved: "Язык сохранён",
    // Dashboard
    welcome: "Добро пожаловать",
    choose_direction: "Выберите направление для самоисследования",
    unfinished_session: "Незавершённая сессия",
    continue: "Продолжить",
    modes_not_configured: "Режимы не настроены",
    modes_not_configured_text:
      "Загрузите данные в таблицу MODES через страницу «Импорт данных».",
    recent_sessions: "Недавние сессии",
    all_sessions: "Все сессии",
    // Session
    greeting_start: "Давай начнём.",
    dream_opening:
      "Расскажи мне свой сон так, как ты его помнишь. Какие моменты или чувства в нём самые заметные?",
    ai_error_fallback: "Сейчас произошла ошибка генерации ответа. Попробуй ещё раз.",
    // Landing
    start_session: "Начать сессию",
    landing_body_title: "Сигнал тела",
    landing_body_desc: "Исследуйте телесные ощущения и скрытые послания",
    landing_dream_title: "Работа со сном",
    landing_dream_desc: "Раскройте символы и образы ваших снов",
    landing_conflict_title: "Внутренний конфликт",
    landing_conflict_desc: "Услышьте обе стороны внутреннего противоречия",
    landing_journaling_title: "Дневник",
    landing_journaling_desc: "Свободная рефлексия, следуя за сильнейшим сигналом",
    important: "Важно",
    landing_disclaimer_text:
      "Этот инструмент предназначен для самоисследования и саморефлексии. Он не заменяет профессиональную психологическую помощь, терапию, диагностику или лечение. Если вам нужна помощь — обратитесь к специалисту.",
    // Session feedback
    feedback_title: "Поделись отзывом",
    feedback_rating: "Насколько полезной была эта сессия?",
    feedback_useful: "Что было самым полезным?",
    feedback_confusing: "Что было непонятным или неудобным?",
    feedback_would_use_again: "Ты бы попробовала ещё одну сессию?",
    feedback_yes: "Да",
    feedback_no: "Нет",
    feedback_comment: "Комментарий",
    feedback_submit: "Отправить отзыв",
    feedback_success: "Спасибо, отзыв сохранён",
    feedback_already: "Спасибо, отзыв уже сохранён.",
  },
  es: {
    // Settings
    settings_title: "Ajustes",
    settings_subtitle: "Gestión del perfil",
    profile: "Perfil",
    name: "Nombre",
    email: "Correo electrónico",
    privacy: "Privacidad",
    privacy_text:
      "Tus datos se almacenan en una base de datos segura. Las sesiones y los mensajes solo están disponibles para ti. Esta herramienta no sustituye la ayuda psicológica profesional.",
    logout: "Salir",
    logout_text: "Serás redirigido a la página de inicio de sesión",
    logout_button: "Cerrar sesión",
    language: "Idioma / Язык",
    language_russian: "Русский",
    language_spanish: "Español",
    language_saved: "Idioma guardado",
    // Dashboard
    welcome: "Bienvenida",
    choose_direction: "Elige una dirección para la autoexploración",
    unfinished_session: "Sesión sin terminar",
    continue: "Continuar",
    modes_not_configured: "Modos no configurados",
    modes_not_configured_text:
      "Carga los datos en la tabla MODES desde la página «Importar datos».",
    recent_sessions: "Sesiones recientes",
    all_sessions: "Todas las sesiones",
    // Session
    greeting_start: "Empecemos.",
    dream_opening:
      "Cuéntame tu sueño tal como lo recuerdas. ¿Qué momentos o sensaciones son los más importantes?",
    ai_error_fallback: "Ahora ha ocurrido un error al generar la respuesta. Inténtalo de nuevo.",
    // Landing
    start_session: "Iniciar sesión",
    landing_body_title: "Señal corporal",
    landing_body_desc: "Explora sensaciones corporales y mensajes internos",
    landing_dream_title: "Trabajo con sueños",
    landing_dream_desc: "Explora símbolos e imágenes de tus sueños",
    landing_conflict_title: "Conflicto interno",
    landing_conflict_desc: "Escucha las dos partes de una contradicción interna",
    landing_journaling_title: "Diario reflexivo",
    landing_journaling_desc: "Reflexión libre siguiendo la señal más viva",
    important: "Importante",
    landing_disclaimer_text:
      "Esta herramienta está diseñada para la autoexploración y la autorreflexión. No sustituye la ayuda psicológica profesional, la terapia, el diagnóstico ni el tratamiento. Si necesitas ayuda, consulta con un profesional.",
    // Session feedback
    feedback_title: "Comparte tu feedback",
    feedback_rating: "¿Qué tan útil fue esta sesión?",
    feedback_useful: "¿Qué fue lo más útil?",
    feedback_confusing: "¿Qué fue confuso o incómodo?",
    feedback_would_use_again: "¿Probarías otra sesión?",
    feedback_yes: "Sí",
    feedback_no: "No",
    feedback_comment: "Comentario",
    feedback_submit: "Enviar feedback",
    feedback_success: "Gracias, feedback guardado",
    feedback_already: "Gracias, tu feedback ya fue guardado.",
  },
};

export function t(key, lang) {
  const l = normalizeLang(lang);
  return translations[l][key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;
}