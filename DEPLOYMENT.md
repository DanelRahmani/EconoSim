# Deploying EconoSim to Vercel

EconoSim is a standard Next.js app with **no backend, no database and no environment
variables**, so deployment needs no extra configuration.

## 1. Push to GitHub

Already done for `DanelRahmani/EconoSim`:

```bash
git push origin master
```

## 2. Import into Vercel

1. Go to <https://vercel.com/new>.
2. Select **Import Git Repository** and choose `EconoSim`.
3. Framework preset: **Next.js** (auto-detected).
4. Build command, output directory and install command: leave the defaults.
5. Environment variables: **none required**.
6. Click **Deploy**.

Vercel will build and give you a `*.vercel.app` URL. Every push to `master` then
redeploys automatically.

## 3. Custom domain (optional)

In the Vercel project → **Settings → Domains**, add your domain and follow the DNS
instructions.

## Notes

- The app is client-heavy; all simulation runs in the browser, so there is nothing to
  provision server-side.
- No secrets are used or committed. `.gitignore` already excludes `.next`, `node_modules`
  and environment files.
- Local verification before deploying:

  ```bash
  npm run typecheck; npm run lint; npm test; npm run build
  ```
