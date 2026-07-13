# Video Story Builder

A local Nuxt app for curating footage from a folder of videos into one finished video story.

## Demo

Watch the demo video: ![](docs/assets/demo-video.mp4)

It lets you:

- scan a directory of video files
- trim clips and arrange them into a sequence
- add transitions and optional audio
- save project state in `edited-output/video-story-project.json`
- render the final video with `ffmpeg`

## Tech stack

- Nuxt 4
- Vue 3 with TypeScript
- Nuxt UI
- Tailwind CSS 4
- Nitro server routes for local media, project state, and rendering
- `ffmpeg` and `ffprobe` for final video rendering

## Requirements

- Node `24.18.0`
- `pnpm`
- `ffmpeg` and `ffprobe` available in your `PATH`
- macOS for the native folder picker

## Development

```bash
pnpm install
pnpm dev
```

The app runs at `http://localhost:3000`.

## Scripts

```bash
pnpm dev
pnpm build
pnpm preview
pnpm lint
pnpm typecheck
```
