/**
 * Visual skin, fixed at build time:
 *   clay — Toss mini-app (default)
 *   aura — web site build (`vite build --mode web`, see .env.web)
 */
export type Skin = 'clay' | 'aura';
export const SKIN: Skin = import.meta.env.VITE_SKIN === 'aura' ? 'aura' : 'clay';
export const IS_WEB_SKIN = SKIN === 'aura';
/** TDS (Toss Design System) parts: Toss build only. `VITE_TDS=off` drops them (light browser preview). */
export const USE_TDS = !IS_WEB_SKIN && import.meta.env.VITE_TDS !== 'off';
