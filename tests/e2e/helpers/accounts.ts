/**
 * Test accounts for the specs that run against a live (local) backend.
 *
 * Credentials come only from the environment: TEST_<ROLE>_EMAIL and
 * TEST_<ROLE>_PASSWORD, exported in the shell or kept in an untracked
 * `.env.test` (see `.env.test.example`; playwright.config.ts loads it).
 * Nothing is hardcoded, so a missing value fails the test with an explanation
 * instead of falling back to a shared demo password.
 */
export type TestRole = 'nurse' | 'doctor' | 'admin' | 'government';

export const ROLE_HOME: Record<TestRole, RegExp> = {
  nurse: /\/nurse/,
  doctor: /\/doctor/,
  admin: /\/admin/,
  government: /\/government/,
};

export function testAccount(role: TestRole): { email: string; password: string } {
  const prefix = `TEST_${role.toUpperCase()}`;
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  const missing = [!email && `${prefix}_EMAIL`, !password && `${prefix}_PASSWORD`].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `${missing.join(' and ')} not set. This spec needs a running backend with test accounts; `
      + 'set the TEST_* variables in the environment or in .env.test (see .env.test.example).',
    );
  }
  return { email: email!, password: password! };
}
