export function shouldPreferBrowserRuntime(env = {}) {
  return Boolean(env.VITE_USE_BROWSER_SIM === 'true' || (env.PROD && !env.VITE_WS_URL));
}
