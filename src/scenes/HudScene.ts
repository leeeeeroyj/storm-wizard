import Phaser from 'phaser';
import { ANSWER_BOX, ARC, ARC_DIGITS, COLORS, HEIGHT, HUD_SCALE, TEXT, THUNDERCLAP, TOP, WIDTH } from '../config';
import { label } from '../text';
import { fitCamera } from '../view';
import type { HudState } from './SkyScene';

// HUD units are half a design pixel: the camera zooms by HUD_SCALE.
const U = HUD_SCALE;
const W = WIDTH * U;
const BAR = TOP * U;
const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
/** Touch's pause panel: two buttons, in HUD units. */
const PAUSE_BTN = { y: 238, w: 150, h: 44, dx: 90 };

/**
 * The top bar, the answer box, the controller's digit arc and the pause panel, drawn from the registry's `hud` state.
 * Its II and speaker icons are buttons too: they tell the game through `storm:pause` and `storm:mute` (and, from
 * touch's pause panel, `storm:quit`).
 */
export class HudScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private score!: Phaser.GameObjects.Text;
  private mult!: Phaser.GameObjects.Text;
  private wave!: Phaser.GameObjects.Text;
  private hi!: Phaser.GameObjects.Text;
  private answer!: Phaser.GameObjects.Text;
  private clapKey!: Phaser.GameObjects.Text;
  private arc: Phaser.GameObjects.Text[] = [];
  private veil!: Phaser.GameObjects.Graphics;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pauseHint!: Phaser.GameObjects.Text;
  private pauseBtns: Phaser.GameObjects.Text[] = [];
  private clock = 0;

  constructor() {
    super('hud');
  }

  create() {
    fitCamera(this, HUD_SCALE);
    this.clock = 0;
    this.g = this.add.graphics();
    const t = (x: number, y: number, size: number, color: string, align: 'left' | 'center' | 'right' = 'left') =>
      label(this, x, y, '', size, color, { zoom: HUD_SCALE, align }).setDepth(2);
    this.score = t(12, 5, 16, TEXT.ink);
    this.mult = t(112, 5, 16, TEXT.ink);
    this.wave = t(W / 2, 5, 16, TEXT.ink, 'center');
    this.hi = t(W - 80, 7, 13, TEXT.dim, 'right');
    this.answer = t(W / 2, ANSWER_BOX.y * U + 4, 20, TEXT.plateInk, 'center');
    this.clapKey = t(196, 8, 12, TEXT.bolt);
    // The controller's digit arc: 1 to 9 then 0, left to right, opening upwards over the answer box.
    this.arc = ARC_DIGITS.map((d, i) => {
      const { x, y } = arcPoint(i);
      return t(x * U, (y - 4.5) * U, 14, TEXT.ink, 'center').setText(d).setStroke(TEXT.plateInk, 4);
    });
    this.veil = this.add.graphics().setDepth(3);
    this.pauseTitle = t(W / 2, 170, 32, TEXT.bolt, 'center').setText('PAUSED').setDepth(4);
    this.pauseHint = t(W / 2, 216, 14, TEXT.ink, 'center').setDepth(4);
    this.pauseBtns = ['RESUME', 'TITLE'].map((s, i) => t(W / 2 + (i ? 1 : -1) * PAUSE_BTN.dx, PAUSE_BTN.y + 12, 16, TEXT.ink, 'center').setText(s).setDepth(4));

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const s = this.registry.get('hud') as HudState | undefined;
      if (!s || s.attract) return;
      const x = p.worldX, y = p.worldY;
      // Generous targets for a thumb: the bar's full height and a little below.
      if (y < BAR + 24 && x >= W - 84 && x < W - 38) this.game.events.emit('storm:pause');
      else if (y < BAR + 24 && x >= W - 38) this.game.events.emit('storm:mute');
      // On the pause panel, TITLE leaves; a tap anywhere else resumes.
      else if (s.paused && s.device === 'touch' && Math.abs(x - (W / 2 + PAUSE_BTN.dx)) < PAUSE_BTN.w / 2 && Math.abs(y - PAUSE_BTN.y - PAUSE_BTN.h / 2) < PAUSE_BTN.h / 2 + 8)
        this.game.events.emit('storm:quit');
      else if (s.paused) this.game.events.emit('storm:pause');
    });
  }

  update(_time: number, delta: number) {
    this.clock += delta / 1000;
    const s = this.registry.get('hud') as HudState | undefined;
    if (!s) return;
    this.score.setText(String(s.score).padStart(6, '0'));
    this.mult.setText(`×${s.mult}`).setColor(s.mult >= 4 ? TEXT.bolt : TEXT.ink);
    this.wave.setText(`WAVE ${s.wave}`);
    const ready = s.mult >= THUNDERCLAP.mult && !s.attract && !s.over;
    this.clapKey.setVisible(ready).setText(s.device === 'pad' ? 'Y' : s.device === 'touch' ? 'TAP ⚡' : 'SPACE');
    this.hi.setText(`HI ${String(s.hi).padStart(6, '0')}`);
    const misfired = s.misfireT > 0;
    this.answer.setText(misfired ? s.misfire : s.buffer).setColor(misfired ? TEXT.dim : TEXT.plateInk);
    const showArc = s.device === 'pad' && !s.attract && !s.over;
    this.arc.forEach((txt, i) => txt.setVisible(showArc).setColor(i === s.arc ? TEXT.plateInk : TEXT.ink).setStroke(TEXT.plateInk, i === s.arc ? 0 : 4));

    const g = this.g.clear();
    g.fillStyle(COLORS.bar, 0.85).fillRect(0, 0, W, BAR);
    g.fillStyle(COLORS.line, 1).fillRect(0, BAR, W, U);
    // The streak: three pips fill towards the next ×, then reset (a filled bar, or a low dash when empty: shape, not colour).
    g.fillStyle(COLORS.ink, 1);
    for (let i = 0; i < 3; i++) {
      const on = s.mult < 8 && s.streak % 3 > i;
      if (on) g.fillRect(146 + i * 10, 9, 6, 12);
      else g.fillRect(146 + i * 10, 18, 6, 3);
    }
    if (ready) {
      // Thunderclap ready: a bolt glyph and its key.
      g.fillStyle(COLORS.bolt, 1).fillRect(182, 5, 4, 7).fillRect(180, 12, 8, 2).fillRect(182, 14, 4, 9).fillRect(180, 19, 2, 2);
    }
    if (!s.attract) {
      // II (pause) and the speaker; muted will add a cross over it (shape, not colour).
      g.fillStyle(COLORS.ink, 1);
      g.fillRect(W - 56, 8, 4, 14).fillRect(W - 48, 8, 4, 14);
      g.fillRect(W - 26, 12, 4, 6).fillRect(W - 22, 10, 2, 10).fillRect(W - 20, 8, 2, 14);
      if (!s.muted) g.fillRect(W - 14, 12, 2, 6).fillRect(W - 10, 10, 2, 10);
      // Muted: a cross where the sound waves were.
      else for (let k = 0; k < 5; k++) g.fillRect(W - 15 + k * 2, 9 + k * 2, 2, 2).fillRect(W - 7 - k * 2, 9 + k * 2, 2, 2);
    }
    // The answer box, bottom centre.
    const bw = ANSWER_BOX.w * U, bh = ANSWER_BOX.h * U, bx = W / 2 - bw / 2, by = ANSWER_BOX.y * U;
    g.fillStyle(COLORS.plateInk, 1).fillRect(bx - U, by - U, bw + 2 * U, bh + 2 * U);
    // A misfire: the box goes dark and the digits that missed are struck through.
    g.fillStyle(misfired ? COLORS.panel : COLORS.plate, 1).fillRect(bx, by, bw, bh);
    if (misfired) g.fillStyle(COLORS.dim, 1).fillRect(W / 2 - this.answer.width / 2 - 2, by + bh / 2, this.answer.width + 4, 2);
    else if (!s.attract && !s.over && (REDUCED || Math.floor(this.clock * 2) % 2 === 0)) {
      const cx = W / 2 + this.answer.width / 2 + 2;
      g.fillStyle(COLORS.plateInk, 1).fillRect(cx, by + 6, 2, bh - 12);
    }
    if (showArc) {
      const { x, y } = arcPoint(s.arc);
      g.fillStyle(COLORS.plate, 1).fillRect((x - 5) * U, (y - 5) * U, 10 * U, 10 * U);
    }

    // Paused: the sky dims under a panel with the way back in and the way out, for the device in hand.
    const v = this.veil.clear();
    this.pauseTitle.setVisible(s.paused);
    this.pauseHint.setVisible(s.paused && s.device !== 'touch');
    const buttons = s.paused && s.device === 'touch';
    for (const b of this.pauseBtns) b.setVisible(buttons);
    if (s.paused) {
      v.fillStyle(COLORS.night, 0.72).fillRect(0, BAR + U, W, HEIGHT * U - BAR - U);
      this.pauseHint.setText(s.device === 'pad' ? 'START TO RESUME    B FOR THE TITLE' : 'P TO RESUME    ESC FOR THE TITLE');
    }
    if (buttons) {
      v.lineStyle(3, COLORS.ink, 1);
      for (const dx of [-PAUSE_BTN.dx, PAUSE_BTN.dx]) v.strokeRect(W / 2 + dx - PAUSE_BTN.w / 2, PAUSE_BTN.y, PAUSE_BTN.w, PAUSE_BTN.h);
    }
  }
}

/** Where digit `i` sits on the arc, in design pixels. */
function arcPoint(i: number) {
  const ang = Math.PI - (i / 9) * Math.PI;
  return { x: ARC.cx + Math.cos(ang) * ARC.r, y: ARC.cy - 6 - Math.sin(ang) * ARC.r };
}
