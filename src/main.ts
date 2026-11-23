import Phaser from 'phaser';
import { ATTRACT } from './attract';
import { COLORS, HEIGHT, RENDER_SCALE, WIDTH } from './config';
import { HudScene } from './scenes/HudScene';
import { SkyScene } from './scenes/SkyScene';
import { TitleScene } from './scenes/TitleScene';

/** Loads the self-hosted fonts (relative URLs, so they work under any base path). */
function loadFonts() {
  const faces = [
    new FontFace('Atkinson Hyperlegible Mono', 'url(fonts/atkinson-hyperlegible-mono-800.woff2)', { weight: '800' }),
    new FontFace('Atkinson Hyperlegible Next', 'url(fonts/atkinson-hyperlegible-next.woff2)', { weight: '400 700' }),
    new FontFace('Pirata One', 'url(fonts/pirata-one.ttf)'),
  ];
  return Promise.all(faces.map((f) => f.load().then((loaded) => document.fonts.add(loaded))));
}

async function start() {
  // Phaser bakes text into textures when it's created, so the fonts must be ready first.
  await Promise.race([loadFonts(), new Promise((resolve) => setTimeout(resolve, ATTRACT ? 400 : 2000))]).catch(() => {});

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: WIDTH * RENDER_SCALE,
    height: HEIGHT * RENDER_SCALE,
    backgroundColor: COLORS.night,
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    // Attract mode: no input plugins (so no listeners, no preventDefault, no gamepad polling) and no audio context.
    input: ATTRACT ? { keyboard: false, mouse: false, touch: false, gamepad: false } : { gamepad: true, activePointers: 2 },
    audio: ATTRACT ? { noAudio: true } : {},
    scene: [TitleScene, SkyScene, HudScene],
  });
  // Dev-only handle for poking at the running game from the console or a test script.
  if (import.meta.env.DEV) Object.assign(window, { __storm: game });
}

void start();
