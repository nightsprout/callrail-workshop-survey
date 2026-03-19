# TODO

## Set up Sanity Studio

The Sanity Studio deploy step in `.github/workflows/deploy.yml` is currently disabled because the `studio/` directory isn't fully configured yet.

### Steps to complete

1. **Commit the `studio/` directory** — it's currently untracked (see `git status`)
2. **Configure Sanity CLI** — ensure `studio/sanity.config.js` has the correct project ID and dataset
3. **Set GitHub secrets:**
   - `SANITY_AUTH_TOKEN` — deploy token from Sanity (manage.sanity.io → API → Tokens)
   - `VITE_SANITY_PROJECT_ID` and `VITE_SANITY_DATASET` should already be set
4. **Test locally** — run `cd studio && npx sanity deploy -y` to verify it works
5. **Uncomment the deploy steps** in `.github/workflows/deploy.yml` (lines 52-60)
6. **Verify** — push and confirm the GitHub Actions run passes with a green check
