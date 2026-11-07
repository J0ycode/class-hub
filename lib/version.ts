/**
 * Identifies the running deployment. On Vercel this is the git commit the
 * deployment was built from, so every push gets a new version.
 */
export function appVersion(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_DEPLOYMENT_ID;
  return sha ? sha.slice(0, 7) : "local";
}
