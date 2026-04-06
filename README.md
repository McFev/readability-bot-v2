# Readability Bot v2

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FMcFev%2Freadability-bot-v2)

![GitHub last commit](https://img.shields.io/github/last-commit/McFev/readability-bot-v2) ![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/McFev/readability-bot-v2) ![GitHub repo size](https://img.shields.io/github/repo-size/McFev/readability-bot-v2) ![No Ads](https://img.shields.io/badge/No%20Ads-orange)

A simple web service that extracts readable content from web articles using Mozilla's [Readability.js](https://github.com/mozilla/readability). It cleans up cluttered web pages, removes ads, navigation, and other distractions, making articles easier to read. The service includes custom fixes for specific websites and can handle iframes by converting them to clickable links.

Hosted on [Vercel](https://vercel.com/), the app provides a clean interface for users to input a URL and view a readable version of the article. It also exposes an API endpoint for programmatic access.

## Features

- **Article Extraction**: Uses Readability.js to parse and clean web pages.
- **Custom Site Fixes**: Special handling for sites like:
  - [rap.ru](https://rap.ru/)
  - [the-flow.ru](https://the-flow.ru/)
  - [hiphop4real.com](https://hiphop4real.com/)
  - [thecode.media](https://thecode.media/)
  - [volzsky.ru](https://www.volzsky.ru/)
  and other
- **Iframe Conversion**: Optionally converts embedded iframes (e.g., YouTube, VK, Rutube) to plain links for better readability.
- **API Endpoint**: `/api/readability?url=<URL>&format=<html|json>&changeiframe=<true|false>`
- **Frontend Interface**: Built with Svelte, allowing users to submit URLs via a simple form.
- **Formats Supported**: HTML (default), JSON (metadata + content).

## Demo

Try it out at: [readability-bot-v2.vercel.app](https://readability-bot-v2.vercel.app)

Example API call:  
`https://readability-bot-v2.vercel.app/api/readability?url=https://example.com/article`

## Installation

To run locally:

1. Clone the repository:
   ```
   git clone https://github.com/McFev/readability-bot-v2.git
   cd readability-bot-v2
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run in development mode:
   ```
   npm run dev
   ```

   This starts a local server with live reloading. Open `http://localhost:5000` in your browser.

4. Build for production:
   ```
   npm run build
   ```

5. Start the production server:
   ```
   npm start
   ```

## Usage

### Frontend
- Visit the homepage.
- Enter a URL in the input field.
- Click "Read" to view the cleaned article.

### API
- **Endpoint**: `/api/readability`
- **Query Parameters**:
  - `url` (required): The URL of the article to process.
  - `format` (optional, default: html): Output format (`html`, `json`).
  - `changeiframe` (optional, default: false): Set to `true` to convert iframes to links.
- **Example Response (JSON)**:
  ```json
  {
    "title": "Article Title",
    "byline": "Author Name",
    "content": "<div>Readable content...</div>",
    "textContent": "Plain text version...",
    "length": 1234,
    "excerpt": "Short summary...",
    "siteName": "Site Name",
    "lang": "en",
    "publishedTime": "2023-01-01T00:00:00.000Z"
  }
  ```

## Deployment

### Vercel
1. Fork this repository.
2. Go to [Vercel](https://vercel.com/) and create a new project.
3. Import your forked repo.
4. Deploy! Vercel will handle the build and hosting automatically.

Environment Variables (optional):
- `APP_URL`: Custom app URL (defaults to Vercel URL).
- `READABILITY_API_URL`: Custom API base URL.

### Other Platforms
The app is a standard Node.js/Svelte project bundled with Rollup, so it can be deployed to any Node.js-compatible host like Heroku, AWS, or DigitalOcean.

## Dependencies

- Core: [@mozilla/readability](https://www.npmjs.com/package/@mozilla/readability), [jsdom](https://www.npmjs.com/package/jsdom), [node-fetch](https://www.npmjs.com/package/node-fetch)
- Build: [Svelte](https://svelte.dev/), [Rollup](https://rollupjs.org/)
- Others: dompurify, html-entities, normalize-url

See `package.json` for the full list.

---

Powered by [Mozilla Readability](https://github.com/mozilla/readability). If you find this useful, star the repo! ⭐