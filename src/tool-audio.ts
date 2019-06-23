import { range, textBox, readBytes, writeBytes, setBit, getBit, mod, emulator, zip, drawOnCanvas } from './util';
import { audioSetup, playPattern } from './shared';
import { Editor } from 'codemirror';
/**
* Audio editor:
**/

const audioPatternEditor = textBox(document.getElementById('audio-pattern-editor')!, false, '');
const audioBlendEditor = textBox(document.getElementById('audio-blend-editor')!, false, '');
const audioToneEditor = textBox(document.getElementById('audio-tone-editor')!, true, '');
const audioPatternCanvas = document.getElementById('audio-pattern-view') as HTMLCanvasElement;
const audioToneCanvas = document.getElementById('audio-tone-view') as HTMLCanvasElement;// TODO correct?

const PATTERN_SIZE = 16;
const PATTERN_SCALE = 2;
const emptySound = range(PATTERN_SIZE).map((): number => 0);
function readPattern (source: Editor): number[] { return readBytes(source, PATTERN_SIZE); }
function writePattern (target: Editor, bytes: number[]): void { return writeBytes(target, PATTERN_SIZE, bytes); }
writePattern(audioPatternEditor, emptySound);
writePattern(audioBlendEditor, emptySound);

function shiftBytes (bytes: number[], n: number): number[] {
    const r = bytes.map((x: number): number => x);
    for (let x = 0; x < bytes.length * 8; x++) {
        setBit(r, x, getBit(bytes, mod(x + n, bytes.length * 8)));
    }
    return r;
}
function drawBytes (target: HTMLCanvasElement, bytes: number[]): void {
    const w = target.width;
    const h = target.height;
    const g = target.getContext('2d')!;
    g.fillStyle = emulator.backgroundColor;
    g.fillRect(0, 0, w, h);
    g.fillStyle = emulator.fillColor;
    range(8 * PATTERN_SIZE).forEach((z: number): void => {
        const a = Math.floor(z / 8);
        const b = 7 - Math.floor(z % 8);
        g.fillRect(z * PATTERN_SCALE, 0, PATTERN_SCALE * (bytes[a] >> b & 1), 32);
    });
}
function generateFrequency (frequency: number, cutoff: number): number[] {
    const w = audioToneCanvas.width;
    const h = audioToneCanvas.height;
    const g = audioToneCanvas.getContext('2d')!;
    g.fillStyle = emulator.backgroundColor;
    g.fillRect(0, 0, w, h);
    g.fillStyle = emulator.fillColor;

    // Samples are played at 4000 samples/second.
    // 128 samples is (1 seconds / 4000 * 128) = .032 seconds.
    // This also means that a full 128 bit pattern is ~ 2/60ths of a second.
    // A sine wave at N hz would be given by sin(t * N * 2Pi).
    let word = 0; const r = [];
    for (let z = 0; z < 8 * PATTERN_SIZE; z++) {
        const t = z * (1 / 4000); // time in seconds
        const v = Math.sin(t * frequency * 2 * Math.PI); // sine wave
        const s = Math.floor((v + 1) * 128); // offset and scale

        word = word << 1 | (s >= cutoff ? 1 : 0);
        if (z % 8 == 7) { r.push(word); word = 0; }

        g.fillStyle = emulator.fillColor2;
        g.fillRect(z * (w / 128), h - s * (h / 256), w / 128, s * (h / 256));
        if (s >= cutoff) {
            g.fillStyle = emulator.fillColor;
            g.fillRect(z * (w / 128), h - cutoff * (h / 256), w / 128, cutoff * (h / 256));
        }
    }
    return r;
}

function updateAudioTone (): void {
    writePattern(audioToneEditor, generateFrequency(
        Number(audioFreq.value) || 0,
        Number(audioCutoff.value) || 0
    ));
}

export function updateAudio (): void {
    audioPatternEditor.refresh();
    audioBlendEditor.refresh();
    audioToneEditor.refresh();
    drawBytes(audioPatternCanvas, readPattern(audioPatternEditor));
    updateAudioTone();
}

/**
* Pattern panel
**/

drawOnCanvas(audioPatternCanvas, (x: number, _y: number, draw: boolean): void => { // TODO unused?
    const index = Math.min(PATTERN_SIZE * 8, Math.max(0, Math.floor(x / PATTERN_SCALE)));
    const pattern = readPattern(audioPatternEditor);
    setBit(pattern, index, draw);
    writePattern(audioPatternEditor, pattern);
    updateAudio();
});

document.getElementById('audio-play')!.onclick = (): void => {
    if (audioSetup()) {
        playPattern(30, readPattern(audioPatternEditor));// TODO correct to have missing param?
    } else {
        document.getElementById('audio-error')!.innerHTML = 'Your browser does not support HTML5 Audio!';
    }
};
document.getElementById('audio-random')!.onclick = (): void => {
    writePattern(audioPatternEditor, emptySound.map((): number => Math.random() * 256 & 0xFF));
    updateAudio();
};
document.getElementById('audio-clear')!.onclick = (): void => {
    writePattern(audioPatternEditor, emptySound);
    updateAudio();
};
document.getElementById('audio-left')!.onclick = (): void => {
    writePattern(audioPatternEditor, shiftBytes(readPattern(audioPatternEditor), 1));
    updateAudio();
};
document.getElementById('audio-right')!.onclick = (): void => {
    writePattern(audioPatternEditor, shiftBytes(readPattern(audioPatternEditor), -1));
    updateAudio();
};
document.getElementById('audio-not')!.onclick = (): void => {
    writePattern(audioPatternEditor, readPattern(audioPatternEditor).map((a: number): number => ~a));
    updateAudio();
};

/**
* Blend panel
**/

document.getElementById('audio-and')!.onclick = (): void => {
    writePattern(audioPatternEditor, zip(
        readPattern(audioPatternEditor),
        readPattern(audioBlendEditor),
        (a: number, b: number): number => a & b
    ));
    updateAudio();
};
document.getElementById('audio-or')!.onclick = (): void => {
    writePattern(audioPatternEditor, zip(
        readPattern(audioPatternEditor),
        readPattern(audioBlendEditor),
        (a: number, b: number): number => a | b
    ));
    updateAudio();
};
document.getElementById('audio-xor')!.onclick = (): void => {
    writePattern(audioPatternEditor, zip(
        readPattern(audioPatternEditor),
        readPattern(audioBlendEditor),
        (a: number, b: number): number => a ^ b
    ));
    updateAudio();
};
document.getElementById('audio-swap')!.onclick = (): void => {
    const a = readPattern(audioPatternEditor);
    const b = readPattern(audioBlendEditor);
    writePattern(audioPatternEditor, b);
    writePattern(audioBlendEditor, a);
    updateAudio();
};

/**
* Tone Generator panel
**/

const audioFreq = document.getElementById('audio-freq') as HTMLInputElement;
const audioCutoff = document.getElementById('audio-cutoff') as HTMLInputElement;


updateAudioTone();

audioFreq.onchange = updateAudioTone;
audioFreq.onkeyup = updateAudioTone;
audioCutoff.onchange = updateAudioTone;
audioCutoff.onkeyup = updateAudioTone;



document.getElementById('audio-toblend')!.onclick = (): void => {
    writePattern(audioBlendEditor, readPattern(audioToneEditor));
    updateAudio();
};
document.getElementById('audio-topat')!.onclick = (): void => {
    writePattern(audioPatternEditor, readPattern(audioToneEditor));
    updateAudio();
};

/**
* Main
**/


audioPatternEditor.on('change', updateAudio);
