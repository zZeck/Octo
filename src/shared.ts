import { emulator } from './util';
import { Emulator, EmulatorOptions } from './emulator';

/// /////////////////////////////////
//
//   Emulator Execution
//
/// /////////////////////////////////

let scaleFactor = 5;
export let renderTarget = 'target';

const optionFlags = [
    'tickrate',
    'fillColor',
    'fillColor2',
    'blendColor',
    'backgroundColor',
    'buzzColor',
    'quietColor',
    'shiftQuirks',
    'loadStoreQuirks',
    'vfOrderQuirks',
    'clipQuirks',
    'vBlankQuirks',
    'jumpQuirks',
    'screenRotation',
    'maxSize'
];
export function unpackOptions (emulator: Emulator, options: EmulatorOptions): void {
    optionFlags.forEach(x => { if (x in options) emulator[x] = options[x]; });
    if (options['enableXO']) emulator.maxSize = 65024; // legacy option
}
export function packOptions (emulator: Emulator): EmulatorOptions {
    const r: EmulatorOptions = {} as EmulatorOptions;
    optionFlags.forEach(x => r[x] = emulator[x]);
    return r;
}

export interface CanvasWithLastFrame extends HTMLCanvasElement {
    last?: Frame;
}

interface Frame {
    colors: string[];
    p: number[][];
    hires: boolean;
}

export function setRenderTarget (scale: number, canvas: string): void {
    scaleFactor = scale;
    renderTarget = canvas;
    const c = document.getElementById(canvas) as CanvasWithLastFrame;

    // Remove any existing previous delta frame so first frame is always drawn:
    c.last = undefined;

    const w = scaleFactor * 128;
    const h = scaleFactor * 64;
    // TODO unused?
    // var wm = (scaleFactor * -64) + "px";
    // var hm = (scaleFactor * -32) + "px";

    if (emulator.screenRotation == 90 || emulator.screenRotation == 270) {
        c.width = h;
        c.height = w;
    } else {
        c.width = w;
        c.height = h;
    }
}

function getTransform (emulatorToTransform: Emulator, g: CanvasRenderingContext2D): void {
    g.setTransform(1, 0, 0, 1, 0, 0);
    const x = scaleFactor * 128;
    const y = scaleFactor * 64;
    switch (emulatorToTransform.screenRotation) {
        case 90:
            g.rotate(0.5 * Math.PI);
            g.translate(0, -y);
            break;
        case 180:
            g.rotate(Number(Math.PI));
            g.translate(-x, -y);
            break;
        case 270:
            g.rotate(1.5 * Math.PI);
            g.translate(-x, 0);
            break;
        default:
			/* nothing to do */
    }
}

export function arrayEqual<T> (a: T[], b: T[]): boolean {
    const length = a.length;
    if (length !== b.length) { return false; }
    for (let i = 0; i < length; i++) {
        if (a[i] !== b[i]) { return false; }
    }
    return true;
}

export function getColor (id: number): string {
    switch (id) {
        case 0: return emulator.backgroundColor;
        case 1: return emulator.fillColor;
        case 2: return emulator.fillColor2;
        case 3: return emulator.blendColor;
        default: throw Error(`invalid color: ${id}`);
}

//used in embed.html and index.ts
export function renderDisplay (emulator: Emulator): void {
    const c = document.getElementById(renderTarget) as CanvasWithLastFrame;

    // Canvas rendering can be expensive. Exit out early if nothing has changed.
    const colors = [emulator.backgroundColor, emulator.fillColor, emulator.fillColor2, emulator.blendColor];
    if (c.last !== undefined) {
        if (arrayEqual(c.last.p[0], emulator.p[0]) && arrayEqual(c.last.p[1], emulator.p[1]) &&
				arrayEqual(c.last.colors, colors)) {
            return;
        }
        if (c.last.hires !== emulator.hires) { c.last = undefined; } // full redraw when switching resolution
    }
    const g = c.getContext('2d')!;
    getTransform(emulator, g);
    const w = emulator.hires ? 128 : 64;
    const h = emulator.hires ? 64 : 32;
    const size = emulator.hires ? scaleFactor : scaleFactor * 2;
    const lastPixels = c.last !== undefined ? c.last.p : [[], []];

    g.scale(size, size);
    let z = 0;
    for (let y = 0; y < h; ++y) {
        for (let x = 0; x < w; ++x, ++z) {
            const oldColorIdx = lastPixels[0][z] + (lastPixels[1][z] << 1);
            const colorIdx = emulator.p[0][z] + (emulator.p[1][z] << 1);
            if (oldColorIdx !== colorIdx) {
                g.fillStyle = getColor(colorIdx);
                g.fillRect(x, y, 1, 1);
            }
        }
    }
    g.scale(1, 1); // restore scale to 1,1 just in case

    c.last = {
        colors: colors,
        p: [emulator.p[0].slice(), emulator.p[1].slice()],
        hires: emulator.hires
    };
}

/// /////////////////////////////////
//
//   Audio Playback
//
/// /////////////////////////////////

let audio: AudioContext;
let audioNode: ScriptProcessorNode | null;
// var audioSource; //TODO unused?
let audioData: AudioBuffer[];

class AudioBuffer {
    pointer: number;
    buffer: number[];
    duration: number;

    // TODO this constructor may be wrong
    public constructor (buffer: number[], duration: number) {
        /* if (!(this instanceof AudioBuffer)) {
		//TODO how does this interact with void
		return new AudioBuffer(buffer, duration);
	} */

        this.pointer = 0;
        this.buffer = buffer;
        this.duration = duration;
    }

    public write (buffer: number[], index: number, size: number): number {
        size = Math.max(0, Math.min(size, this.duration));
        if (!size) { return size; }

        this.duration -= size;
        const bufferSize = this.buffer.length;
        const end = index + size;

        for (let i = index; i < end; ++i) {
            buffer[i] = this.buffer[this.pointer++];
            this.pointer %= bufferSize;
        }

        return size;
    }

    public dequeue (duration: number): void {
        this.duration -= duration;
    }
}
const FREQ = 4000;
const TIMER_FREQ = 60;
const SAMPLES = 16;
const BUFFER_SIZE = SAMPLES * 8;

export function audioSetup (): boolean {
    if (!audio) {
        if (typeof AudioContext !== 'undefined') {
            audio = new AudioContext();
        }
        // TODO not needed now?
        /* else if (typeof webkitAudioContext !== 'undefined') {
			audio = new webkitAudioContext();
		} */
    }
    if (audio && !audioNode) {
        // TODO createScriptProcessor is deprecated
        audioNode = audio.createScriptProcessor(4096, 1, 1);
        audioNode.onaudioprocess = function (audioProcessingEvent: AudioProcessingEvent): void {
            const outputBuffer = audioProcessingEvent.outputBuffer;
            const outputData = outputBuffer.getChannelData(0);
            const samples_n = outputBuffer.length;

            let index = 0;
            while (audioData.length && index < samples_n) {
                const size = samples_n - index;
                // TODO fix this cast
                const written = audioData[0].write(outputData as unknown as number[], index, size);
                index += written;
                if (written < size) {
                    audioData.shift();
                }
            }

            while (index < samples_n) {
                outputData[index++] = 0;
            }
            // the last one can be long sound with high value of buzzer, so always keep it
            if (audioData.length > 1) {
                let audioDataSize = 0;
                const audioBufferSize = audioNode!.bufferSize;
                audioData.forEach(function (buffer) { audioDataSize += buffer.duration; });
                while (audioDataSize > audioBufferSize && audioData.length > 1) {
                    audioDataSize -= audioData.shift()!.duration;
                }
            }
        };
        audioData = [];
        audioNode.connect(audio.destination);
        return true;
    }
    if (audio && audioNode) { return true; }
    return false;
}

export function stopAudio (): void {
    if (!audio) { return; }
    if (audioNode) {
        audioNode.disconnect();
        audioNode = null;
    }
    audioData = [];
}

const VOLUME = 0.25;

export function playPattern (soundLength: number, buffer: number[], remainingTicks?: number): void {
    if (!audio) { return; }

    const samples = Math.floor(BUFFER_SIZE * audio.sampleRate / FREQ);
    const audioBuffer = new Array(samples);
    if (remainingTicks && audioData.length > 0) {
        audioData[audioData.length - 1].dequeue(Math.floor(remainingTicks * audio.sampleRate / TIMER_FREQ));
    }

    for (let i = 0; i < samples; ++i) {
        const srcIndex = Math.floor(i * FREQ / audio.sampleRate);
        // var cell = srcIndex >> 3; //TODO unused?
        const bit = srcIndex & 7;
        audioBuffer[i] = buffer[srcIndex >> 3] & 0x80 >> bit ? VOLUME : 0;
    }
    audioData.push(new AudioBuffer(audioBuffer, Math.floor(soundLength * audio.sampleRate / TIMER_FREQ)));
}

export function escapeHtml (str: string): string {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
