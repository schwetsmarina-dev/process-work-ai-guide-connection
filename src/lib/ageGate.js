// Age gate.
//
// Spain's LOPDGDD (art. 7) sets 14 as the age at which a person can consent to
// the processing of their own personal data. That is the legal floor, not the
// product floor: this app processes special-category data about mental state
// and is not built to carry the additional duties owed to minors (parental
// consent flows, safeguarding, age-appropriate design). The product minimum is
// therefore higher, and stated plainly rather than buried in the terms.
//
// Only the birth YEAR is collected. A full date of birth would be more precise
// and less proportionate — GDPR art. 5(1)(c) asks for the minimum data that
// achieves the purpose, and the purpose here is a single yes/no decision.
//
// Because only the year is known, age is computed conservatively: a person is
// admitted when they will certainly have reached MIN_AGE within the current
// calendar year. This can turn away someone for a few months, which is the
// right direction to err.

export const MIN_AGE = 16;

/** How old the person turns during the current calendar year. */
export function ageThisYear(birthYear) {
  const year = Number(birthYear);
  if (!Number.isFinite(year)) return null;
  return new Date().getFullYear() - year;
}

export function isOldEnough(birthYear) {
  const age = ageThisYear(birthYear);
  return age !== null && age >= MIN_AGE;
}

/**
 * Selectable years, newest first.
 *
 * The list deliberately includes years BELOW the minimum age. Offering only
 * eligible years would hide the rule and quietly teach people to pick a false
 * year; showing every plausible year lets someone answer honestly and receive
 * a real explanation and real support numbers instead of a silent dead end.
 */
export function birthYearOptions() {
  const currentYear = new Date().getFullYear();
  const newest = currentYear - 5;
  const oldest = currentYear - 100;
  const years = [];
  for (let y = newest; y >= oldest; y--) years.push(y);
  return years;
}
