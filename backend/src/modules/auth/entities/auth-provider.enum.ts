/**
 * LOCAL isn't stored as an AuthIdentity row — a user authenticates locally
 * simply by having a passwordHash. This enum exists so provider-specific
 * logic (and future providers) has one place to branch on, without a
 * redundant AuthIdentity row for the common password case.
 */
export enum AuthProvider {
  LOCAL = 'LOCAL',
  GOOGLE = 'GOOGLE',
}
