import Phaser from 'phaser';
import { RENDER_SCALE } from '../config';
import { loadHi } from '../hi';
import { placeIslands, type Islands } from '../islands';
import { Backdrop } from '../sky';
import { fitCamera } from '../view';

/** What the HUD draws, shared through the registry under `hud`. */
export interface HudState {
  score: number;
  hi: number;
  mult: number;
  wave: number;
  buffer: string;
  attract: boolean;
}

/** The game: one fixed screen of sky over the islands. */
export class SkyScene extends Phaser.Scene {
  backdrop!: Backdrop;
  islands!: Islands;
  attract = false;
  /** Seconds of play, on the scene's own clock. */
  playTime = 0;

  constructor() {
    super('sky');
  }

  create(data: { attract?: number } = {}) {
    this.attract = data.attract !== undefined;
    this.playTime = 0;
    fitCamera(this, RENDER_SCALE);
    this.backdrop = new Backdrop(this);
    this.islands = placeIslands(this);
    const hud: HudState = { score: 0, hi: loadHi(), mult: 1, wave: 1, buffer: '', attract: this.attract };
    this.registry.set('hud', hud);
    this.scene.launch('hud');
    this.cameras.main.fadeIn(this.attract ? 0 : 250);
  }

  update(_time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    this.playTime += dt;
    this.backdrop.update(dt);
  }
}
