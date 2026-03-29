# Deploy to GitHub Pages

## Why this is the recommended public option
For this project, GitHub Pages is a good fit because the simulator is a **pure static site**:
- HTML/CSS/JS only
- no backend
- no file write API
- no shell / system access
- no direct access to this Mac after publishing

That means the published site can be shared publicly without exposing your local machine as a web server.

## Security reality
This is safe **for your computer** compared with self-hosting.
It is **not private** by default:
- anyone with the link can visit
- GitHub Pages does not provide a built-in password wall for a public site

If you need access control later, move to a static host with front-door auth (for example Cloudflare Pages + Access).

## Publish options

### Option A — separate repo (recommended)
Create a new GitHub repo, for example:
- `lead-belay-sim`

Then publish only this folder there. This keeps the public site isolated from the rest of the workspace.

### Option B — current repo subdirectory
Possible, but less clean because this workspace contains unrelated files.
Public exposure should be limited to the Pages artifact, but repo structure is still less tidy.

## If using a separate repo

```bash
cd ~/.openclaw/workspace
mkdir -p /tmp/lead-belay-pages
rsync -av --delete lead-belay-sim/ /tmp/lead-belay-pages/
cd /tmp/lead-belay-pages
git init
git add .
git commit -m "Initial public simulator site"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

Then in GitHub:
1. Open the repo
2. Go to **Settings → Pages**
3. Under **Build and deployment**, choose **GitHub Actions**
4. The included workflow should deploy automatically

## If using this existing repo
Push this workspace repo to GitHub, then enable Pages using GitHub Actions. The workflow file is already added:
- `.github/workflows/deploy-lead-belay-pages.yml`

It publishes only:
- `lead-belay-sim/`

## Result URL
Usually:
- `https://<github-username>.github.io/<repo-name>/`

## Important note about base paths
Current app uses relative asset paths (`./styles.css`, `./app.js`), which is good for GitHub Pages subpath hosting.

## Recommended sharing posture
- Share the public Pages URL directly
- Treat it as a public educational demo
- Do not put secrets, private notes, or machine-specific data in the published folder
