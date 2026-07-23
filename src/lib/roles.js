// Role checks — single source of truth.
//
// Admin and therapist access is decided ONLY by the role field on the user
// record. A personal email address used to be hardcoded in five places as a
// second way in; that shipped a real person's identity in the client bundle,
// broke silently if the address ever changed, and made it impossible to add a
// second admin without editing code.
//
// To grant admin or therapist access, set the user's `role` in Base44.
// Do not add email-based exceptions here.

export const ROLES = {
  ADMIN: "admin",
  THERAPIST: "therapist",
  USER: "user",
};

/** True when the given user record has the admin role. */
export function isAdmin(user) {
  return user?.role === ROLES.ADMIN;
}

/** True when the user is a therapist. Admins also see therapist views. */
export function isTherapist(user) {
  return user?.role === ROLES.THERAPIST;
}

/** Access to the therapist dashboard: therapists and admins. */
export function canViewTherapistDashboard(user) {
  return isTherapist(user) || isAdmin(user);
}
