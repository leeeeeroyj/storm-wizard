import type Phaser from 'phaser';
import { FONT, FONT_BODY, FONT_TITLE, FONT_WEIGHT, RENDER_SCALE } from './config';

export type Face = 'mono' | 'body' | 'title';

/**
 * Text in Atkinson Hyperlegible (Pirata One for the name). It's rasterised at the canvas's own resolution for the
 * camera that shows it (`zoom`), never scaled up from a small bitmap.
 */
export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size: number,
  color: string,
  { zoom = RENDER_SCALE, face = 'mono' as Face, align = 'left' as 'left' | 'center' | 'right' } = {},
) {
  const t = scene.add.text(x, y, str, {
    fontFamily: face === 'title' ? FONT_TITLE : face === 'body' ? FONT_BODY : FONT,
    fontStyle: face === 'mono' ? FONT_WEIGHT : face === 'body' ? '700' : 'normal',
    fontSize: `${size}px`,
    color,
    align,
    resolution: zoom,
  });
  return t.setOrigin(align === 'center' ? 0.5 : align === 'right' ? 1 : 0, 0);
}
