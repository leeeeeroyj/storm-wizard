import type Phaser from 'phaser';
import { COTTAGES_X, GROUND, TOWERS_X, WIZARD } from './config';

/** The things on the islands: three towers and six cottages, and the wizard on his cloud beside the answer box. */
export interface Islands {
  towers: Phaser.GameObjects.Image[];
  cottages: Phaser.GameObjects.Image[];
  wizard: Phaser.GameObjects.Image;
  cloud: Phaser.GameObjects.Image;
}

export function placeIslands(scene: Phaser.Scene, depth = 1): Islands {
  return {
    towers: TOWERS_X.map((x) => scene.add.image(x, GROUND - 8, 'tower').setDepth(depth)),
    cottages: COTTAGES_X.map((x) => scene.add.image(x, GROUND - 8, 'cottage').setDepth(depth)),
    cloud: scene.add.image(WIZARD.x, WIZARD.y + 10, 'wizcloud').setDepth(depth + 0.2),
    // Flipped, so his wand is on the answer box's side.
    wizard: scene.add.image(WIZARD.x, WIZARD.y, 'wizard').setFlipX(true).setDepth(depth + 0.1),
  };
}
