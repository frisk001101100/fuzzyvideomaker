# What If Studio · FuzzyVideoMaker

A browser-first video studio for branching short-form stories, Reels, Shorts, explainers and commercials.

**The model writes the production code. The browser renders the video.** This is not an AI video-generation wrapper: the creator supplies the media, fonts and references; a text model writes JavaScript animation code; the isolated renderer executes that code and exports a video.

## Product principles

- **Code-generated motion:** prompts become editable JavaScript that draws frames on a 9:16 canvas.
- **Creator-owned assets:** import images, video, audio and fonts. Assets stay in the browser.
- **Branching stories:** plan hooks, beats, cliffhangers and poll choices that can drive the next episode.
- **No After Effects dependency:** the render path is browser APIs and Mediabunny.
- **Bring your own model key:** OpenAI, Anthropic or Gemini. The key is held in memory for the current tab and forwarded for a single request; it is not stored in the app.
- **Local-first:** projects and imported files are stored in the current browser using local storage and IndexedDB.
- **Human approval:** nothing is automatically posted to social platforms.

## Run

Requirements: Node.js 20+.

\`\`\`bash
npm install
npx vercel dev
\`\`\`

Open the local URL printed by Vercel. The front end is static; the only serverless route is \`/api/generate\`, which securely proxies a single user-authorized text-generation request to the chosen provider.

## Deploy

1. Connect \`frisk001101100/fuzzyvideomaker\` to a Vercel project.
2. Use the **Other** framework preset (static files + one Node.js function).
3. No database, service-role key, or Vercel environment variable is required for the local-first MVP.
4. Deploy the \`main\` branch.

Vercel is used for the web app and AI request proxy. **Long video rendering does not run inside a Vercel Function.** Frames are rendered and encoded on the creator's device, avoiding serverless execution timeouts and large media uploads.

## AI providers

Open the model settings in the studio, choose a provider, enter a model ID available to your account, and paste your own API key. The key is kept only in page memory and is cleared when the tab is closed or refreshed. Provider usage is billed by that provider; a ChatGPT, Claude or Gemini chat subscription is not automatically an API credit balance.

Supported request formats:
- OpenAI Responses API
- Anthropic Messages API
- Gemini generateContent API

Never commit API keys or put them in source files. The proxy does not save or log the supplied key.

## Video rendering

The renderer uses a sandboxed iframe with a restrictive Content Security Policy. Generated JavaScript receives a small frame API:

\`\`\`js
function renderFrame({ ctx, time, duration, width, height, assets }) {
  // Draw the current frame on ctx (CanvasRenderingContext2D).
  // assets["asset-id"].element is an imported image/video/audio element.
}
\`\`\`

The browser encodes frames with Mediabunny/WebCodecs to MP4 or WebM. Encoding support depends on the browser and available codecs. Rendering is local and can be CPU- and memory-intensive for long or high-resolution projects; start with 720 × 1280 and 30 FPS.

## Inspiration and boundaries

- [Instagram agent skill](https://github.com/Jakeschincariol/instagram-agent-skill): hook structure, timed beats, caption craft and human approval. This app does not scrape Instagram or automate posting.
- [Awesome Opus 5.5 Videos](https://github.com/yihui-dev/awesome-opus5-5-videos): examples of models writing HTML/Canvas/SVG/Three.js code to create animations. Used as a reference catalogue, not as a bundled video-generation service.
- The previous [What If Studio MVP](https://github.com/frisk001101100/what-if-studio) is a feature reference for project continuity, story branches and local-first creation. This repository is the new product base.

These are references, not copied account branding or an After Effects workflow.

## Current MVP limits

- No automatic Instagram/TikTok/YouTube publishing or poll ingestion.
- No server-side AI video/image generation.
- No team cloud sync or account system in this initial local-first version.
- AI generation requires the creator's own provider API key and may incur provider charges.
- MP4/WebM export depends on browser WebCodecs codec support and device resources.
