/**
 * True in the portfolio demo build (`VITE_DEMO=1 npm run build`, M11). Vite replaces this at
 * build time, so the normal full-stack build contains none of the demo's branches, and the demo
 * build none of the server-talking defaults.
 */
export const IS_DEMO: boolean = import.meta.env.VITE_DEMO === '1'
