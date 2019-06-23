import { writeBytes, readBytes, range, radioBar, textBox, toggleButton, mod, drawOnCanvas } from './util';
import { getColor } from './shared';

/**
* Sprite editor:
**/

const SPRITE_SCALE = 20;
const spriteDraw = document.getElementById('sprite-draw') as HTMLCanvasElement; // correct cast?
const sprite16 = toggleButton(document.getElementById('sprite-16')!, false, changeSpriteSize); // TODO was 0 just being used for false?
const spriteColor = toggleButton(document.getElementById('sprite-color')!, false, updateSpriteEditor); // TODO was 0 just being used for false?
const spriteClear = document.getElementById('sprite-clear')!;
const spritePalette = radioBar(document.getElementById('sprite-palette')!, 1, () => {});
const spriteEditor = textBox(document.getElementById('sprite-editor')!, false, '');

spriteClear.onclick = (): void => { spritePixels = []; updateSpriteEditor(); };
function spriteLength () { return (sprite16.getValue() ? 32 : 15) * (spriteColor.getValue() ? 2 : 1); }
function spriteDim (big: boolean) { return big ? { rows: 16, cols: 16 } : { rows: 15, cols: 8 }; }

/**
* Model:
**/

let spritePixels: number[] = [];

function clampSpriteData (): void {
    for (let z = spriteLength() + 1; z < 64; z++) { spritePixels[z] = 0; }
}
function spritePixel (x: number, y: number, wide: boolean): {
    mask: number;
    layer1: number;
    layer2: number;
} {
    const index = wide ? y * 2 + (x > 7 ? 1 : 0) : y;
    return {
        mask: 128 >> x % 8,
        layer1: index,
        layer2: index + (wide ? 32 : 15)
    };
}
function getSpritePixel (x: number, y: number, wide: boolean, color: number): number {
    const t = spritePixel(x, y, wide);
    const c1 = Boolean(t.mask & spritePixels[t.layer1]);
    const c2 = Boolean(t.mask & spritePixels[t.layer2]);
    return Number(c1) + 2 * (Number(c2) & color);// TODO casts?
}
function setSpritePixel (x: number, y: number, wide: boolean, _color: number, p: number): void { // TODO unused _color?
    if (x >= (wide ? 16 : 8)) return;
    if (y >= (wide ? 16 : 15)) return;
    const t = spritePixel(x, y, wide);
    spritePixels[t.layer1] = spritePixels[t.layer1] & ~t.mask | -Boolean(p & 1) & t.mask;
    spritePixels[t.layer2] = spritePixels[t.layer2] & ~t.mask | -Boolean(p & 2) & t.mask;
}

/**
* Shifting and Clipping:
**/

function getSpritePixels (dim: {cols: number; rows: number}, dx: number, dy: number): number[][] {
    const c = spriteColor.getValue();
    return range(dim.rows).map((row): number[] => {
        return range(dim.cols).map((col): number => {
            return getSpritePixel(mod(col - dx, dim.cols), mod(row - dy, dim.rows), dim.cols == 16, Number(c));// TODO construct correct?
        });
    });
}
function setSpritePixels (dim: {rows: number; cols: number }, pix: number[][]): void {
    const c = spriteColor.getValue();
    range(dim.rows).forEach((row): void => {
        range(dim.cols).forEach((col): void => {
            setSpritePixel(col, row, dim.cols == 16, c as any, (pix[row] || [])[col] || 0);// TODO value of c is ignored in function
        });
    });
}
function changeSpriteSize (toBig: boolean): void {
    setSpritePixels(spriteDim(toBig), getSpritePixels(spriteDim(!toBig), 0, 0));
    updateSpriteEditor();
}
function scrollSprite (dx: number, dy: number): void {
    const dim = spriteDim(sprite16.getValue());
    setSpritePixels(dim, getSpritePixels(dim, dx, dy));
    updateSpriteEditor();
}

/**
* Data binding:
**/

// important: loop-breaker!
// CodeMirror itself does not detect when a modification triggers a revalidation,
// and does not ignore writes that are identical to the current data.
let spriteHandlingRefresh = false;

function showHex (): void {
    if (spriteHandlingRefresh) return;
    writeBytes(spriteEditor, spriteLength(), spritePixels);
}

spriteEditor.on('change', (): void => {
    if (spriteHandlingRefresh) return;
    spriteHandlingRefresh = true;
    spritePixels = readBytes(spriteEditor, spriteLength());
    updateSpriteEditor();
    spriteHandlingRefresh = false;
});

/**
* Rendering:
**/

function showSprite (): void {
    const c = spriteColor.getValue();
    const d = spriteDim(sprite16.getValue());
    const g = spriteDraw.getContext('2d')!;
    g.fillStyle = getColor(0);
    g.fillRect(0, 0, spriteDraw.width, spriteDraw.height);
    range(d.rows).forEach((row): void => {
        range(d.cols).forEach((col): void => {
            g.fillStyle = getColor(getSpritePixel(col, row, d.cols == 16, Number(c)));// TODO cast correct?
            g.fillRect(col * SPRITE_SCALE, row * SPRITE_SCALE, SPRITE_SCALE, SPRITE_SCALE);
        });
    });
}

/**
* Main:
**/

document.getElementById('sprite-left')!.onclick = (): void => scrollSprite(-1, 0);
document.getElementById('sprite-right')!.onclick = (): void => scrollSprite(1, 0);
document.getElementById('sprite-up')!.onclick = (): void => scrollSprite(0, -1);
document.getElementById('sprite-down')!.onclick = (): void => scrollSprite(0, 1);

drawOnCanvas(spriteDraw, (x: number, y: number, draw: boolean): void => {
    setSpritePixel(
        Math.floor(x / SPRITE_SCALE),
        Math.floor(y / SPRITE_SCALE),
        sprite16.getValue(),
        Number(spriteColor.getValue()),
        draw ? Number(spritePalette.getValue()) : 0 // TODO string to number correct?
    );
    updateSpriteEditor();
});

export function updateSpriteEditor (): void {
    document.querySelectorAll<HTMLElement>('#sprite-palette>span').forEach((x, i): void => {
        x.style.backgroundColor = getColor(i);
    });
    if (sprite16.getValue()) {
        spriteDraw.width = SPRITE_SCALE * 16;
        spriteDraw.height = SPRITE_SCALE * 16;
    } else {
        spriteDraw.width = SPRITE_SCALE * 8;
        spriteDraw.height = SPRITE_SCALE * 15;
    }
    if (!spriteColor.getValue()) {
        spritePalette.setValue(1);
    }
    spritePalette.setVisible(spriteColor.getValue());
    spriteEditor.refresh();

    clampSpriteData();
    showHex();
    showSprite();
}
