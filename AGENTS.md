# AGENTS.md — What If Studio / FuzzyVideoMaker

## Product goal
Build a polished Portuguese-first creator studio for Reels, Shorts and TikTok-style videos, especially branching "what if?" stories. The model writes a program; the browser executes it and renders the video from creator-supplied assets.

## Core architecture
- Static browser app: \`index.html\`, \`styles.css\`, \`app.js\`.
- Vercel Node function: \`api/generate.js\`, a narrow text-generation proxy for OpenAI, Anthropic and Gemini.
- Browser rendering: generated JavaScript executes in a sandboxed iframe with a Canvas 2D frame API.
- Export: Mediabunny + WebCodecs in the browser, currently MP4. Prefer File System Access streaming when supported; use BufferTarget fallback for browsers without it.
- Local data: project metadata/scripts in localStorage; imported files in IndexedDB.
- No database or account system is required for this local-first MVP.

## Non-negotiable product constraints
1. Do not integrate AI video-generation services. The LLM generates code, not video frames or clips.
2. Do not use or require Adobe After Effects.
3. Do not claim the app publishes to Instagram, TikTok or YouTube, reads their poll results, or scrapes their content.
4. Imported creator files (images, videos, audio and fonts) are the visual source material.
5. Keep BYOK provider keys in page memory only. Never write them to localStorage, IndexedDB, project JSON, logs, or Git.
6. Keep provider API requests server-side in api/generate.js. The browser must call only the same-origin /api/generate endpoint.
7. Preserve same-origin checks, input size checks, provider allowlisting, request timeouts and cache-control no-store.
8. Generated JavaScript must stay inside the sandboxed iframe. Never execute model-generated code in the parent app context.
9. Never add unrestricted network access to the rendering iframe.
10. Keep the visual identity: frosted dark/black glass panels, subtle borders and blur, polished cinematic spacing, Space Grotesk/DM Sans/DM Mono, and a restrained Weezer-blue accent.

## Reference projects
- \`Jakeschincariol/instagram-agent-skill\`: hook-writing, time-coded beats, captions and human approval. Do not copy its branding or automate platform interactions.
- \`yihui-dev/awesome-opus5-5-videos\`: examples of LLM-authored HTML/Canvas/SVG/Three.js animation code. Do not copy individual creators' output, and do not adopt its AI video-generation suggestions.
- \`frisk001101100/what-if-studio\`: older feature reference for story projects, scenes, branching consequences and local-first workflows. The canonical destination is this repository.

## Engineering and testing
- Node.js 20+.
- Run \`npm run check\` to syntax-check client and API JavaScript.
- Run locally with \`npm install\` then \`npx vercel dev\`.
- Keep the app usable without an AI key; demo code and local editing must work without provider accounts.
- Validate responsive UI on mobile and desktop.
- Treat user files and model output as untrusted input. Escape text before putting it in HTML.
- Update README when behavior, configuration or limitations change.
- Do not add paid services or change the core architecture without asking the owner.
