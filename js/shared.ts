"use strict";

import { emulator } from "./util";
import { Emulator, EmulatorOptions } from "./emulator";

////////////////////////////////////
//
//   Emulator Execution
//
////////////////////////////////////

var scaleFactor = 5;
export var renderTarget = "target";

const optionFlags = [
	"tickrate",
	"fillColor",
	"fillColor2",
	"blendColor",
	"backgroundColor",
	"buzzColor",
	"quietColor",
	"shiftQuirks",
	"loadStoreQuirks",
	"vfOrderQuirks",
	"clipQuirks",
	"vBlankQuirks",
	"jumpQuirks",
	"screenRotation",
	"maxSize",
]
export function unpackOptions(emulator: Emulator, options: EmulatorOptions) {
	optionFlags.forEach(x => { if (x in options) emulator[x] = options[x] })
	if (options["enableXO"]) emulator.maxSize = 65024 // legacy option
}
export function packOptions(emulator: Emulator) {
	const r: EmulatorOptions = {} as EmulatorOptions
	optionFlags.forEach(x => r[x] = emulator[x])
	return r
}

export interface CanvasWithLastFrame extends HTMLCanvasElement {
	last?: Frame
}

interface Frame {
	colors: string[],
	p: number[][],
	hires: boolean
}

export function setRenderTarget(scale: number, canvas: string) {
	scaleFactor = scale;
	renderTarget = canvas;
	var c = document.getElementById(canvas) as CanvasWithLastFrame;

	// Remove any existing previous delta frame so first frame is always drawn:
	c.last = undefined;

	var w  = scaleFactor * 128;
	var h  = scaleFactor *  64;
	var wm = (scaleFactor * -64) + "px";
	var hm = (scaleFactor * -32) + "px";

	if (emulator.screenRotation == 90 || emulator.screenRotation == 270) {
		c.width  = h;
		c.height = w;
	}
	else {
		c.width  = w;
		c.height = h;
	}
}

function getTransform(emulator: Emulator, g: CanvasRenderingContext2D) {
	g.setTransform(1, 0, 0, 1, 0, 0);
	var x = scaleFactor * 128;
	var y = scaleFactor *  64;
	switch(emulator.screenRotation) {
		case 90:
			g.rotate(0.5 * Math.PI);
			g.translate(0, -y);
			break;
		case 180:
			g.rotate(1.0 * Math.PI);
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


export function arrayEqual<T>(a: T[], b: T[]) {
	var length = a.length;
	if (length !== b.length) { return false; }
	for (var i = 0; i < length; i++) {
		if (a[i] !== b[i]) { return false; }
	}
	return true;
}

export function getColor(id: number) {
	switch(id) {
		case 0: return emulator.backgroundColor;
		case 1: return emulator.fillColor;
		case 2: return emulator.fillColor2;
		case 3: return emulator.blendColor;
	}
	throw "invalid color: " + id;
}

export function renderDisplay(emulator: Emulator) {
	var c= document.getElementById(renderTarget) as CanvasWithLastFrame;

	// Canvas rendering can be expensive. Exit out early if nothing has changed.
	var colors = [emulator.backgroundColor, emulator.fillColor, emulator.fillColor2, emulator.blendColor];
	if (c.last !== undefined) {
		if (arrayEqual(c.last.p[0], emulator.p[0]) && arrayEqual(c.last.p[1], emulator.p[1])
				&& arrayEqual(c.last.colors, colors)) {
			return;
		}
		if (c.last.hires !== emulator.hires)
			c.last = undefined;  // full redraw when switching resolution
	}
	var g = c.getContext("2d")!;
	getTransform(emulator, g);
	var w      = emulator.hires ? 128         : 64;
	var h      = emulator.hires ? 64          : 32;
	var size   = emulator.hires ? scaleFactor : scaleFactor*2;
	var lastPixels = c.last !== undefined? c.last.p: [[], []]

	g.scale(size, size)
	var z = 0;
	for(var y = 0; y < h; ++y) {
		for(var x = 0; x < w; ++x, ++z) {
			var oldColorIdx = lastPixels[0][z] + (lastPixels[1][z] << 1);
			var colorIdx = emulator.p[0][z] + (emulator.p[1][z] << 1);
			if (oldColorIdx !== colorIdx) {
				g.fillStyle = getColor(colorIdx);
				g.fillRect(x, y, 1, 1);
			}
		}
	}
	g.scale(1, 1) //restore scale to 1,1 just in case

	c.last = {
		colors: colors,
		p: [emulator.p[0].slice(), emulator.p[1].slice()],
		hires: emulator.hires,
	};
}

////////////////////////////////////
//
//   Audio Playback
//
////////////////////////////////////

var audio: AudioContext;
var audioNode: ScriptProcessorNode | null;
var audioSource; //TODO unused?
var audioData:  AudioBuffer[];

class AudioBuffer {
	pointer: number;
	buffer: number[];
	duration: number;

	//TODO this constructor may be wrong
	constructor(buffer: number[], duration: number){
	/*if (!(this instanceof AudioBuffer)) {
		//TODO how does this interact with void
		return new AudioBuffer(buffer, duration);
	}*/

	this.pointer = 0;
	this.buffer = buffer;
	this.duration = duration;
}

 write (buffer: number[], index: number, size: number) {
	size = Math.max(0, Math.min(size, this.duration))
	if (!size) { return size; }

	this.duration -= size;
	var bufferSize = this.buffer.length;
	var end = index + size;

	for(var i = index; i < end; ++i) {
		buffer[i] = this.buffer[this.pointer++];
		this.pointer %= bufferSize;
	}

	return size;
}

 dequeue (duration: number) {
	this.duration -= duration;
}
}
var FREQ = 4000;
var TIMER_FREQ = 60;
var SAMPLES = 16;
var BUFFER_SIZE = SAMPLES * 8

export function audioSetup() {
	if (!audio) {
		if (typeof AudioContext !== 'undefined') {
			audio = new AudioContext();
		}
		//TODO not needed now?
		/*else if (typeof webkitAudioContext !== 'undefined') {
			audio = new webkitAudioContext();
		}*/
	}
	if (audio && !audioNode) {
		//TODO createScriptProcessor is deprecated
		audioNode = audio.createScriptProcessor(4096, 1, 1);
		audioNode.onaudioprocess = function(audioProcessingEvent) {
			var outputBuffer = audioProcessingEvent.outputBuffer;
			var outputData = outputBuffer.getChannelData(0);
			var samples_n = outputBuffer.length;

			var index = 0;
			while(audioData.length && index < samples_n) {
				var size = samples_n - index;
				//TODO fix this cast
				var written = audioData[0].write(outputData as unknown as number[], index, size);
				index += written;
				if (written < size) {
					audioData.shift();
				}
			}

			while(index < samples_n) {
				outputData[index++] = 0;
			}
			//the last one can be long sound with high value of buzzer, so always keep it
			if (audioData.length > 1) {
				var audioDataSize = 0;
				var audioBufferSize = audioNode!.bufferSize;
				audioData.forEach(function(buffer) { audioDataSize += buffer.duration; })
				while(audioDataSize > audioBufferSize && audioData.length > 1) {
					audioDataSize -= audioData.shift()!.duration;
				}
			}
		}
		audioData = [];
		audioNode.connect(audio.destination);
		return true;
	}
	if (audio && audioNode) { return true; }
	return false;
}


export function stopAudio() {
	if (!audio) { return; }
	if (audioNode) {
		audioNode.disconnect();
		audioNode = null;
	}
	audioData = [];
}

var VOLUME = 0.25;

export function playPattern(soundLength: number, buffer: number[], remainingTicks?: number) {
	if (!audio) { return; }

	var samples = Math.floor(BUFFER_SIZE * audio.sampleRate / FREQ);
	var audioBuffer = new Array(samples);
	if (remainingTicks && audioData.length > 0) {
		audioData[audioData.length - 1].dequeue(Math.floor(remainingTicks * audio.sampleRate / TIMER_FREQ));
	}

	for(var i = 0; i < samples; ++i) {
		var srcIndex = Math.floor(i * FREQ / audio.sampleRate);
		var cell = srcIndex >> 3;
		var bit = srcIndex & 7;
		audioBuffer[i] = (buffer[srcIndex >> 3] & (0x80 >> bit)) ? VOLUME: 0;
	}
	audioData.push(new AudioBuffer(audioBuffer, Math.floor(soundLength * audio.sampleRate / TIMER_FREQ)));
}

export function escapeHtml(str: string) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
