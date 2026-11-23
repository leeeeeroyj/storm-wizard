import type Phaser from 'phaser';
import { COTTAGES_X, GROUND, TOWERS_X, WIZARD } from './config';

/** The things on the islands: three towers, six cottages and the wizard on the centre tower. */
export interface Islands {
  towers: Phaser.GameObjects.Image[];
  cottages: Phaser.GameObjects.Image[];
  wizard: Phaser.GameObjects.Image;
}

export function placeIslands(scene: Phaser.Scene, depth = 1): Islands {
  return {
    towers: TOWERS_X.map((x) => scene.add.image(x, GROUND - 8, 'tower').setDepth(depth)),
    cottages: COTTAGES_X.map((x) => scene.add.image(x, GROUND - 8, 'cottage').setDepth(depth)),
    wizard: scene.add.image(WIZARD.x, WIZARD.y, 'wizard').setDepth(depth + 0.1),
  };
}
