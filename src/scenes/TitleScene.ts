import Phaser from 'phaser';
import { ATTRACT, attractSeed } from '../attract';
import { COLORS, HEIGHT, RENDER_SCALE, SPRITES, TEXT, WIDTH } from '../config';
import { loadHi } from '../hi';
import { placeIslands } from '../islands';
import { Backdrop } from '../sky';
import { label } from '../text';
import { fitCamera } from '../view';

export class TitleScene extends Phaser.Scene {
  private backdrop!: Backdrop;
  private start!: Phaser.GameObjects.Text;
  private padStatus!: Phaser.GameObjects.Text;
  private leaving = false;
  private clock = 0;

  constructor() {
    super('title');
  }

  preload() {
    for (const key of SPRITES) this.load.image(key, `sprites/${key}.png`);
  }

  create() {
    // Attract mode goes straight to the game once the sprites are loaded.
    if (ATTRACT) return void this.scene.start('sky', { attract: attractSeed() });
    this.leaving = false;
    this.clock = 0;
    fitCamera(this, RENDER_SCALE);
    this.backdrop = new Backdrop(this);
    placeIslands(this);
    this.add.graphics().setDepth(4).fillStyle(COLORS.night, 0.45).fillRect(0, 0, WIDTH, HEIGHT);
    this.cameras.main.fadeIn(250);

    const cx = WIDTH / 2;
    const text = (y: number, s: string, size: number, color: string) => label(this, cx, y, s, size, color, { align: 'center' }).setDepth(5);
    label(this, cx, 22, 'Storm Wizard', 46, TEXT.bolt, { face: 'title', align: 'center' }).setDepth(5);
    text(80, 'TYPE THE ANSWER. STRIKE THE HAIL.', 8, TEXT.ink);
    const hi = loadHi();
    if (hi) label(this, WIDTH - 6, 4, `HI ${hi.toLocaleString('en-US')}`, 7, TEXT.bolt, { align: 'right' }).setDepth(5);

    this.start = text(106, '> START <', 14, TEXT.bolt).setInteractive({ useHandCursor: true });
    this.start.on('pointerdown', () => this.begin());
    const touchScreen = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    text(128, touchScreen ? 'TAP START' : 'PRESS ENTER OR A, OR CLICK START', 7, TEXT.dim);
    this.padStatus = text(142, '', 6, TEXT.dim);

    this.input.keyboard?.on('keydown-ENTER', () => this.begin());
    this.input.keyboard?.on('keydown-SPACE', () => this.begin());
    this.input.gamepad?.on('down', (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
      if (button.index === 0 || button.index === 9) this.begin();
    });
  }

  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    this.clock += dt;
    this.backdrop.update(dt);
    this.start.setAlpha(this.clock % 1 < 0.6 ? 1 : 0.55);
    const pad = this.input.gamepad?.total ? this.input.gamepad.getPad(0) : null;
    this.padStatus.setText(pad ? 'CONTROLLER CONNECTED' : 'USING A CONTROLLER? PRESS ANY BUTTON ON IT').setColor(pad ? TEXT.ice : TEXT.dim);
  }

  private begin() {
    if (this.leaving) return;
    this.leaving = true;
    landscapeLock();
    this.cameras.main.fadeOut(250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('sky'));
  }
}

/**
 * On a phone, starting a run goes full screen and holds the screen sideways where the browser allows it (Android;
 * an iPhone ignores both, and the page asks you to turn it if it's upright).
 */
function landscapeLock() {
  if (!window.matchMedia?.('(pointer: coarse)').matches || document.fullscreenElement) return;
  const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  document.documentElement
    .requestFullscreen?.({ navigationUI: 'hide' })
    .then(() => orientation.lock?.('landscape'))
    .catch(() => {
      // Not allowed here: the rotate notice covers it.
    });
}
