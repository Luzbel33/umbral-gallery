# Umbral

An open virtual museum for art, music and creative code. Visit an exhibition as a web page, walk through its architecture in 3D, or open a free room of your own. Umbral runs in the browser on desktop and mobile. [Visit the museum](https://luzbel33.github.io/umbral-gallery/) · [Enter the atrium](https://luzbel33.github.io/umbral-gallery/?sala=patio) · [Leer en español](README.es.md)

![The photography gallery showing three satellite landscapes from South America](public/art/cover-estratos.webp)

## Visit

Browse the catalogue by discipline or follow a direct room link as a guest. The website follows the browser's primary language, Spanish for Spanish variants and English otherwise. The language switch remembers your choice. Each room has a web exhibition, an artist profile and a walkable counterpart.

Move the mouse to look and use WASD to walk. **Enable free look** captures the pointer for unlimited turns. Escape releases it. On a touchscreen, walk with the analog stick and look with your other thumb. Use **Rooms** to change exhibitions from anywhere. Open **Artist profile** to find works and links. The cinema projects its film on request. The listening studio and atrium have separate recordings and playback controls.

## Exhibit

Choose **Exhibit my work** or **Sign up**. Create a passkey and enter a public name. An account can participate and save favorites before creating a room. Each account may create one room. Guests' local bookmarks stay in that browser. Signed-in favorites follow the account.

In **My space**, create your room and set its title, discipline, wall color, floor, soundtrack and public visibility. Add your biography, website, social link and repository or demo. Use **Works and files** to upload, remove or exchange works between eight positions. Publishing makes the room discoverable in the catalogue. Uploaded files can be opened by direct URL from the moment of upload. Remove a work to remove its stored files.

The pilot uses one WebAuthn passkey per account. Choose a synchronized passkey or keep a physical key. Account recovery requires access to that credential. Credentials are tied to the registered domain.

| Media | Browser experience |
| --- | --- |
| Images | JPG, PNG, WebP, AVIF, BMP and the first frame of a GIF. Images become WebP up to 1,920 pixels on the long side, with lightweight previews for larger images. |
| Sound and moving image | MP3, WAV, Ogg, Opus, M4A, FLAC, MP4, WebM, MOV and OGV. Playback depends on the device's codecs. Audio works can become the room soundtrack. |
| 3D | Self-contained GLB/glTF, OBJ, STL and ASCII PLY. Static geometry and supported base colors are converted to a bounded internal mesh. Rotate and zoom in the viewer. Up to 60,000 triangles. |
| Documents and data | PDF pages rendered on canvas, CSV/TSV tables, formatted JSON and notebook cells. |
| Code and writing | UTF-8 text, Markdown, shaders and source code. HTML and SVG open as source. Authors can link to runnable demos on their own sites. [Supported extensions](src/formats.js) |

Limits are eight works per room, 12 MiB per upload and 512 KiB for text and code. The PDF viewer disables scripting. Uploaded code is displayed as text. External links require HTTPS. To report content, include the room URL in a [repository issue](https://github.com/Luzbel33/umbral-gallery/issues).

## Shared visits

The atrium and exhibitions offer groups of six, with 120 social seats across the pilot. Individual visits remain available when all seats are occupied. Guests can read chat. Signed-in visitors can write and enable optional push-to-talk voice. Listening starts with the microphone off. Releasing the control stops capture. Voice packets use private recipient channels. Text chat displays recent messages for 15 minutes.

The [capacity report](CAPACITY.md) distinguishes browser rendering, simultaneous arrivals, social seats and monthly transfer. The public catalogue uses a bounded short-lived anonymous cache, keyset pagination and small cover images. Authenticated editing reads directly from the database. Inaugural rooms and their media are static files on GitHub Pages. The walk loads on entry, reuses baked lighting and adjusts its drawing resolution under frame pressure.

## Run locally

Use Node 22.12 or newer. Walk mode requires WebGL 2. The web version also works on devices without it.

```sh
npm ci
npm run dev
npm run build
```

Vite prints the local URL. The default configuration connects to the public pilot. To use your own backend, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. `BASE_PATH` changes the default `/umbral-gallery/` prefix. GitHub Actions builds and deploys `dist/` to Pages when `main` is updated. The inaugural exhibitions have static pages, preview metadata and a sitemap.

To run an independent deployment, update the site's stable HTTPS origin, public URLs and sitemap, then configure the backend.

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --linked
supabase secrets set GALLERY_ORIGIN=https://your-domain.example
supabase functions deploy gallery-passkeys --use-api
supabase functions deploy gallery-voice --use-api
supabase functions deploy gallery-public --use-api
```

The identity function verifies WebAuthn challenges. The voice function verifies membership and the voice budget before delivery. PostgreSQL enforces row ownership, unique placement and group access. Storage uses reserved paths for original files and thumbnails. The public read function uses anonymous permissions and accepts a fixed set of catalogue queries. The editor can remove an interrupted upload. Configure Realtime private-channel access for a separate hosted project. [Realtime settings](https://supabase.com/docs/guides/realtime/settings)

## Verification

Run `npx playwright test` against a running instance using `GALLERY_TEST_URL` and optionally `CHROME_PATH`. The suite covers language detection, touch navigation, mouse look, discovery, bookmarks and playback. Install Playwright Chromium with `npx playwright install chromium` when using its bundled browser.

For isolated integration tests, start local Supabase via Docker, set `GALLERY_ORIGIN=http://localhost:5184` in a local environment file, then start `supabase functions serve --env-file PATH_TO_FILE`. Run `node scripts/test-community.mjs` for account, publishing, upload, viewer, chat and microphone coverage. Run `node scripts/load-gallery.mjs` separately for the loopback load test. Both use temporary fixtures.

## Art and licenses

The [MIT license](LICENSE) covers the application and original Umbral Studio work. Artists retain rights to their uploads. Instrument Serif and Space Grotesk use the SIL Open Font License.

- **Cylinder Five** and **Cylinder Six** were written, produced and performed by Chris Zabriskie in 2014. Umbral transcodes the tracks to MP3. [Cylinders](https://chriszabriskie.com/cylinders/) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- The **Earth As Art** exhibition presents three USGS EROS satellite images of Argentina and Chile. The source pages designate them as public domain. Umbral crops the poster borders and resizes the images. [Sources and credits](public/licenses/Earth-As-Art.txt)
- `art/interiors.py` builds the four walkable interiors and bakes their light atlases with Blender Cycles. `art/render.py` and `art/patio.py` generate original exhibition imagery. `art/media.py` generates the cinema loop with FFmpeg. Third-party notices are in [public/licenses](public/licenses/).
