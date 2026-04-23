/**
 * Shared constants for the sandboxed-pi demo provider.
 *
 * Both index.mjs (sandbox setup) and provider.mjs (pi extension runtime)
 * need these values. Keeping them here avoids silent drift between the two.
 */

/** pi provider name registered for demo sessions. */
export const PROVIDER_NAME = "scenar-ai";

/** Model ID used to drive scenarii replies. */
export const MODEL_ID = "scenarii-0";

/**
 * Internal API tag that identifies the scenarii stream handler.
 * Must match the `api` field passed to pi.registerProvider().
 * pi uses this tag to route stream calls to the right handler.
 */
export const PROVIDER_API = "demo-scenarii";

/**
 * Placeholder values required by pi's model registry validation.
 *
 * pi requires baseUrl and apiKey when registering custom models, even when
 * the provider never makes real HTTP requests. The base URL uses a reserved
 * TLD (.invalid) so any accidental connection attempt fails immediately.
 */
export const PROVIDER_API_KEY = "sandboxed-demo";
export const PROVIDER_BASE_URL = "http://demo.invalid";
