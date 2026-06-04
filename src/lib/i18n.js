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
  },
};

export function t(key, lang) {
  const l = normalizeLang(lang);
  return translations[l][key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;
}