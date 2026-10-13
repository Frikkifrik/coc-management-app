/**
 * Test seam: re-exports the Supabase auth entry points and the disclaimer
 * constant so the headless smoke harness can exercise them without reaching
 * through the sign-in component's DOM.
 */
export { signInWithDiscord, signInWithEmail, signInWithMagicLink } from './supabase-auth';
export { FAN_CONTENT_NOTICE } from './components';
export { normaliseSearchTag } from './search';
