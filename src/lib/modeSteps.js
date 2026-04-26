// UI metadata only — hardcoded steps have been removed.
// The database tables ModeStep, Mode, Term are the source of truth.

export const MODE_LABELS = {
  body: { ru: "Сигнал тела", en: "Body Signal" },
  dream: { ru: "Работа со сном", en: "Dream Exploration" },
  conflict: { ru: "Внутренний конфликт", en: "Inner Conflict" },
  journaling: { ru: "Дневник", en: "Guided Journaling" },
};

export const MODE_ICONS = {
  body: "Heart",
  dream: "Moon",
  conflict: "GitBranch",
  journaling: "PenLine",
};

export const MODE_DESCRIPTIONS = {
  body: "Исследуйте телесные ощущения, напряжение, боль и энергетические сигналы",
  dream: "Работайте с образами сна, символами, атмосферой и персонажами",
  conflict: "Исследуйте внутренние полярности, противоречия и решения",
  journaling: "Свободная саморефлексия, следуя за самым сильным сигналом",
};