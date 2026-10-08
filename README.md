# QuoteFlow — Quote Generator with History

A minimal full-stack internship project that fetches a daily quote from a public API, saves favorites to MongoDB, renders favorites history, supports filtering/search, and copies quotes to the clipboard.

## Features

- Daily quote fetched server-side from a public API.
- Random quote button for a fresh quote.
- Favorites stored in MongoDB with duplicate protection.
- Search and topic filtering for favorites history.
- Copy-to-clipboard for the current quote and saved quotes.
- Local synthetic fallback records for API failure testing.
- Render-ready Node/Express deployment.
- Responsive modern UI.

The included `quote_history_seed.json` contains 80 synthetic fallback records grouped by topics such as Learning, Work, and Creativity.

## Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js + Express
- Database: MongoDB Atlas + Mongoose
- Public API: RealInspire quote endpoint

## Run locally

1. Install Node.js 20+.
2. Create a MongoDB Atlas database and copy the connection string.
3. Create a `.env` file from `.env.example`.
4. Add your `MONGODB_URI`.
5. Install packages and start the server:

```bash
npm install
npm start
```

Open `http://localhost:10000`.

## GitHub + Render deployment

### GitHub web upload

1. Open https://github.com/new and create a new repository.
2. Keep the repository public if this is required by the internship submission.
3. In the repository, click **Add file → Upload files**.
4. Upload the project files/folders from this project. Do **not** upload `.env` or `node_modules`.
5. Commit the files to the `main` branch.

### Render

1. Open https://render.com/ and select **New → Web Service**.
2. Connect the GitHub repository.
3. Render should detect the Node app. Use:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add the environment variable:
   - `MONGODB_URI` = your MongoDB Atlas connection string
5. Create the service and wait for the deploy to finish.
6. Open the generated `https://....onrender.com` URL and test:
   - quote loads
   - New quote works
   - Save favorite works
   - refresh preserves favorites
   - search/filter works
   - copy works

## MongoDB Atlas network access

For a quick Render deployment, Atlas Network Access can allow `0.0.0.0/0`. This is convenient but broad. Protect the database with a strong dedicated database password, least-privilege database user permissions, and never commit the connection string to GitHub. For a production-grade setup, replace the broad rule with Render's current outbound IP strategy when your hosting plan and networking setup support it.

## Submission checklist

- [ ] GitHub repository link
- [ ] Render live URL
- [ ] MongoDB Atlas configured through an environment variable
- [ ] README contains the live demo URL
- [ ] Test favorites after refreshing the page
- [ ] Test API fallback by temporarily changing `QUOTE_API_URL` to an invalid endpoint

## Live Demo

Add your Render URL here after deployment:

**Live App:** `https://YOUR-APP-NAME.onrender.com`

**GitHub:** `https://github.com/YOUR-USERNAME/YOUR-REPOSITORY`
