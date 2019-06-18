"use strict";

import { haltBreakpoint } from "./debugger";

export var keymap = [
	// chip8    // keyboard
	/* 0 */ 88, // x
	/* 1 */ 49, // 1
	/* 2 */ 50, // 2
	/* 3 */ 51, // 3
	/* 4 */ 81, // q
	/* 5 */ 87, // w
	/* 6 */ 69, // e
	/* 7 */ 65, // a
	/* 8 */ 83, // s
	/* 9 */ 68, // d
	/* A */ 90, // z
	/* B */ 67, // c
	/* C */ 52, // 4
	/* D */ 82, // r
	/* E */ 70, // f
	/* F */ 86  // v
];

export var keymapInverse = [];
for (var i = 0, len = keymap.length; i < len; i++) {
	keymapInverse[keymap[i]] = i;
}

var font = [
	0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
	0x20, 0x60, 0x20, 0x20, 0x70, // 1
	0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
	0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
	0x90, 0x90, 0xF0, 0x10, 0x10, // 4
	0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
	0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
	0xF0, 0x10, 0x20, 0x40, 0x40, // 7
	0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
	0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
	0xF0, 0x90, 0xF0, 0x90, 0x90, // A
	0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
	0xF0, 0x80, 0x80, 0x80, 0xF0, // C
	0xE0, 0x90, 0x90, 0x90, 0xE0, // D
	0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
	0xF0, 0x80, 0xF0, 0x80, 0x80  // F
];

var bigfont = [
	0xFF, 0xFF, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xFF, 0xFF, // 0
	0x18, 0x78, 0x78, 0x18, 0x18, 0x18, 0x18, 0x18, 0xFF, 0xFF, // 1
	0xFF, 0xFF, 0x03, 0x03, 0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, // 2
	0xFF, 0xFF, 0x03, 0x03, 0xFF, 0xFF, 0x03, 0x03, 0xFF, 0xFF, // 3
	0xC3, 0xC3, 0xC3, 0xC3, 0xFF, 0xFF, 0x03, 0x03, 0x03, 0x03, // 4
	0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, 0x03, 0x03, 0xFF, 0xFF, // 5
	0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, 0xC3, 0xC3, 0xFF, 0xFF, // 6
	0xFF, 0xFF, 0x03, 0x03, 0x06, 0x0C, 0x18, 0x18, 0x18, 0x18, // 7
	0xFF, 0xFF, 0xC3, 0xC3, 0xFF, 0xFF, 0xC3, 0xC3, 0xFF, 0xFF, // 8
	0xFF, 0xFF, 0xC3, 0xC3, 0xFF, 0xFF, 0x03, 0x03, 0xFF, 0xFF, // 9
	0x7E, 0xFF, 0xC3, 0xC3, 0xC3, 0xFF, 0xFF, 0xC3, 0xC3, 0xC3, // A
	0xFC, 0xFC, 0xC3, 0xC3, 0xFC, 0xFC, 0xC3, 0xC3, 0xFC, 0xFC, // B
	0x3C, 0xFF, 0xC3, 0xC0, 0xC0, 0xC0, 0xC0, 0xC3, 0xFF, 0x3C, // C
	0xFC, 0xFE, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xC3, 0xFE, 0xFC, // D
	0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, // E
	0xFF, 0xFF, 0xC0, 0xC0, 0xFF, 0xFF, 0xC0, 0xC0, 0xC0, 0xC0  // F
];

////////////////////////////////////
//
//   The Chip8 Interpreter:
//
////////////////////////////////////

export class Emulator {

	

	// persistent configuration settings
	public tickrate           = 20;
	public fillColor          = "#FFCC00";
	public fillColor2         = "#FF6600";
	public blendColor         = "#662200";
	public backgroundColor    = "#996600";
	public buzzColor          = "#FFAA00";
	public quietColor         = "#000000";
	public shiftQuirks        = false;
	public loadStoreQuirks    = false;
	public vfOrderQuirks      = false;
	public clipQuirks         = false;
	public jumpQuirks         = false;
	public vBlankQuirks       = false;
	public enableXO           = true;
	public screenRotation     = 0;
	public maxSize            = 3584;
	public maskFormatOverride = true;
	public numericFormatStr   = "default";

	// interpreter state
	public p  = [[],[]];  // pixels
	public m: Uint8Array  = new Uint8Array(0);       // memory (bytes)
	public r  = [];       // return stack
	public v  = [];       // registers
	public pc = 0;        // program counter
	public i  = 0;        // index register
	public dt = 0;        // delay timer
	public st = 0;        // sound timer
	public hires = false; // are we in SuperChip high res mode?
	public flags = [];    // semi-persistent hp48 flag vars
	public pattern = [];  // audio pattern buffer
	public plane = 1;     // graphics plane
	public profile_data = {};

	// control/debug state
	public keys = {};       // track keys which are pressed
	public waiting = false; // are we waiting for a keypress?
	public waitReg = -1;    // destination register of an awaited key
	public halted = true;
	public breakpoint = false;
	public metadata = {};
	public tickCounter = 0;
	stack_breakpoint: number;

	// external interface stubs
	public exitVector  () {}                                   // fired by 'exit'
	public importFlags () { return [0, 0, 0, 0, 0, 0, 0, 0]; } // load persistent flags
	public exportFlags (flags) {}                              // save persistent flags
	public buzzTrigger (ticks, remainingTicks) {}                              // fired when buzzer played

	public init (rom) {
		// initialise memory with a new array to ensure that it is of the right size and is initiliased to 0
		this.m = this.enableXO ? new Uint8Array(0x10000) : new Uint8Array(0x1000);

		this.p = [[], []];
		if (this.enableXO)
			for(var z = 0; z < 64*128; z++) { this.p[0][z] = 0; this.p[1][z] = 0; }
		else
			for(var z = 0; z < 32*64; z++) { this.p[0][z] = 0; this.p[1][z] = 0; }

		// initialize memory
		for(var z = 0; z < 32*64;          z++) { this.p[0][z] = 0; this.p[1][z] = 0; }
		for(var z = 0; z < font.length;    z++) { this.m[z] = font[z]; }
		for(var z = 0; z < bigfont.length; z++) { this.m[z + font.length] = bigfont[z]; }
		for(var z = 0; z < rom.rom.length; z++) { this.m[0x200+z] = rom.rom[z]; }
		for(var z = 0; z < 16;             z++) { this.v[z] = 0; }
		for(var z = 0; z < 16;             z++) { this.pattern[z] = 0; }

		// initialize interpreter state
		this.r = [];
		this.pc = 0x200;
		this.i  = 0;
		this.dt = 0;
		this.st = 0;
		this.hires = false;
		this.plane = 1;

		// initialize control/debug state
		this.keys = {};
		this.waiting = false;
		this.waitReg = -1;
		this.halted = false;
		this.breakpoint = false;
		this.stack_breakpoint = -1;
		this.metadata = rom;
		this.tickCounter = 0;
		this.profile_data = {};
	}

	public writeCarry (dest, value, flag) {
		this.v[dest] = (value & 0xFF);
		this.v[0xF] = flag ? 1 : 0;
		if (this.vfOrderQuirks) {
			this.v[dest] = (value & 0xFF);
		}
	}

	public math (x, y, op) {
		// basic arithmetic opcodes
		switch(op) {
			case 0x0: this.v[x]  = this.v[y]; break;
			case 0x1: this.v[x] |= this.v[y]; break;
			case 0x2: this.v[x] &= this.v[y]; break;
			case 0x3: this.v[x] ^= this.v[y]; break;
			case 0x4:
				let t = this.v[x]+this.v[y];
				this.writeCarry(x, t, (t > 0xFF));
				break;
			case 0x5:
				t = this.v[x]-this.v[y];
				this.writeCarry(x, t, (this.v[x] >= this.v[y]));
				break;
			case 0x7:
				t = this.v[y]-this.v[x];
				this.writeCarry(x, t, (this.v[y] >= this.v[x]));
				break;
			case 0x6:
				if (this.shiftQuirks) { y = x; }
				t = this.v[y] >> 1;
				this.writeCarry(x, t, (this.v[y] & 0x1));
				break;
			case 0xE:
				if (this.shiftQuirks) { y = x; }
				t = this.v[y] << 1;
				this.writeCarry(x, t, ((this.v[y] >> 7) & 0x1));
				break;
			default:
				haltBreakpoint("unknown math opcode "+op);
		}
	}

	public misc (x, rest) {
		// miscellaneous opcodes
		switch(rest) {
			case 0x01:
				this.plane = (x & 0x3);
				break;
			case 0x02:
				for(var z = 0; z < 16; z++) {
					this.pattern[z] = this.m[this.i+z];
				}
				break;
			case 0x07: this.v[x] = this.dt; break;
			case 0x0A: this.waiting = true; this.waitReg = x; break;
			case 0x15: this.dt = this.v[x]; break;
			case 0x18: this.buzzTrigger(this.v[x], this.st); this.st = this.v[x]; break;
			case 0x1E: this.i = (this.i + this.v[x])&0xFFFF; break;
			case 0x29: this.i = ((this.v[x] & 0xF) * 5); break;
			case 0x30: this.i = ((this.v[x] & 0xF) * 10 + font.length); break;
			case 0x33:
				this.m[this.i]   = Math.floor(this.v[x]/100)%10;
				this.m[this.i+1] = Math.floor(this.v[x]/10)%10;
				this.m[this.i+2] = this.v[x]%10;
				break;
			case 0x55:
				for(var z = 0; z <= x; z++) { this.m[this.i+z] = this.v[z]; }
				if (!this.loadStoreQuirks) { this.i = (this.i+x+1)&0xFFFF; }
				break;
			case 0x65:
				for(var z = 0; z <= x; z++) { this.v[z] = this.m[this.i+z]; }
				if (!this.loadStoreQuirks) { this.i = (this.i+x+1)&0xFFFF; }
				break;
			case 0x75:
				for(var z = 0; z <= x; z++) { this.flags[z] = this.v[z]; }
				this.exportFlags(this.flags);
				break;
			case 0x85:
				this.flags = this.importFlags();
				if (typeof this.flags == "undefined" || this.flags == null) {
					this.flags = [0, 0, 0, 0, 0, 0, 0, 0];
				}
				for(var z = 0; z <= x; z++) { this.v[z] = this.flags[z]; }
				break;
			default:
				haltBreakpoint("unknown misc opcode "+rest);
		}
	}

	public sprite(x, y, len) {
		this.v[0xF] = 0x0;
		var rowSize = this.hires ? 128 : 64;
		var colSize = this.hires ?  64 : 32;
		var i = this.i;
		for(var layer = 0; layer < 2; layer++) {
			if ((this.plane & (layer+1)) == 0) { continue; }
			if (len == 0) {
				// draw a SuperChip 16x16 sprite
				for(var a = 0; a < 16; a++) {
					for(var b = 0; b < 16; b++) {
						var target = ((x+b) % rowSize) + ((y+a) % colSize)*rowSize;
						var source = ((this.m[i+(a*2)+(b > 7 ? 1:0)] >> (7-(b%8))) & 0x1) != 0;
						if (this.clipQuirks) {
							if ((x%rowSize)+b>=rowSize || (y%colSize)+a>=colSize) { source = false; }
						}
						if (!source) { continue; }
						if (this.p[layer][target]) { this.p[layer][target] = 0; this.v[0xF] = 0x1; }
						else { this.p[layer][target] = 1; }
					}
				}
				i += 32;
			}
			else {
				// draw a Chip8 8xN sprite
				for(var a = 0; a < len; a++) {
					for(var b = 0; b < 8; b++) {
						var target = ((x+b) % rowSize) + ((y+a) % colSize)*rowSize;
						var source = ((this.m[i+a] >> (7-b)) & 0x1) != 0;
						if (this.clipQuirks) {
							if ((x%rowSize)+b>=rowSize || (y%colSize)+a>=colSize) { source = false; }
						}
						if (!source) { continue; }
						if (this.p[layer][target]) { this.p[layer][target] = 0; this.v[0xF] = 0x1; }
						else { this.p[layer][target] = 1; }
					}
				}
				i += len;
			}
		}
	}

	public call(nnn) {
		if (this.r.length >= 12) {
			haltBreakpoint("call stack overflow.");
		}
		this.r.push(this.pc);
		this.pc = nnn
	}

	public jump0 (nnn) {
		if (this.jumpQuirks) { this.pc = nnn + this.v[(nnn >> 8)&0xF];  }
		else                 { this.pc = nnn + this.v[0]; }
	}

	public machine (nnn) {
		if (nnn == 0x000) { this.halted = true; return; }
		haltBreakpoint("machine code is not supported.");
	}

	public skip () {
		var op = (this.m[this.pc  ] << 8) | this.m[this.pc+1];
		this.pc += (op == 0xF000) ? 4 : 2;
	}

	public opcode () {
		// Increment profilining data
		this.profile_data[this.pc] = (this.profile_data[this.pc] || 0) + 1;

		// decode the current opcode
		var op  = (this.m[this.pc  ] << 8) | this.m[this.pc+1];
		var o   = (this.m[this.pc  ] >> 4) & 0x00F;
		var x   = (this.m[this.pc  ]     ) & 0x00F;
		var y   = (this.m[this.pc+1] >> 4) & 0x00F;
		var n   = (this.m[this.pc+1]     ) & 0x00F;
		var nn  = (this.m[this.pc+1]     ) & 0x0FF;
		var nnn = op & 0xFFF;
		this.pc += 2;

		// execute a simple opcode
		if (op == 0x00E0) {
			// clear
			for(var layer = 0; layer < 2; layer++) {
				if ((this.plane & (layer+1)) == 0) { continue; }
				for(var z = 0; z < this.p[layer].length; z++) {
					this.p[layer][z] = 0;
				}
			}
			return;
		}
		if (op == 0x00EE) {
			// return
			this.pc = this.r.pop();
			return;
		}
		if ((op & 0xF0FF) == 0xE09E) {
			// if -key
			if (keymap[this.v[x]] in this.keys) { this.skip(); }
			return;
		}
		if ((op & 0xF0FF) == 0xE0A1) {
			// if key
			if (!(keymap[this.v[x]] in this.keys)) { this.skip(); }
			return;
		}
		if ((op & 0xFFF0) == 0x00C0) {
			// scroll down n pixels
			var rowSize = this.hires ? 128 : 64;
			for(var layer = 0; layer < 2; layer++) {
				if ((this.plane & (layer+1)) == 0) { continue; }
				for(var z = this.p[layer].length - 1; z >= 0; z--) {
					this.p[layer][z] = (z >= rowSize * n) ? this.p[layer][z - (rowSize * n)] : 0;
				}
			}
			return;
		}
		if ((op & 0xFFF0) == 0x00D0) {
			// scroll up n pixels
			var rowSize = this.hires ? 128 : 64;
			for(var layer = 0; layer < 2; layer++) {
				if ((this.plane & (layer+1)) == 0) { continue; }
				for(var z = 0; z < this.p[layer].length; z++) {
					this.p[layer][z] = (z < (this.p[layer].length - rowSize * n)) ? this.p[layer][z + (rowSize * n)] : 0;
				}
			}
			return;
		}
		if (op == 0x00FB) {
			// scroll right 4 pixels
			var rowSize = this.hires ? 128 : 64;
			for(var layer = 0; layer < 2; layer++) {
				if ((this.plane & (layer+1)) == 0) { continue; }
				for(var a = 0; a < this.p[layer].length; a += rowSize) {
					for(var b = rowSize-1; b >= 0; b--) {
						this.p[layer][a + b] = (b > 3) ? this.p[layer][a + b - 4] : 0;
					}
				}
			}
			return;
		}
		if (op == 0x00FC) {
			// scroll left 4 pixels
			var rowSize = this.hires ? 128 : 64;
			for(var layer = 0; layer < 2; layer++) {
				if ((this.plane & (layer+1)) == 0) { continue; }
				for(var a = 0; a < this.p[layer].length; a += rowSize) {
					for(var b = 0; b < rowSize; b++) {
						this.p[layer][a + b] = (b < rowSize - 4) ? this.p[layer][a + b + 4] : 0;
					}
				}
			}
			return;
		}
		if (op == 0x00FD) {
			// exit
			this.halted = true;
			this.exitVector();
			return;
		}
		if (op == 0x00FE) {
			// lores
			this.hires = false;
			this.p = [[], []];
			for(var z = 0; z < 32*64; z++) { this.p[0][z] = 0; this.p[1][z] = 0; }
			return;
		}
		if (op == 0x00FF) {
			// hires
			this.hires = true;
			this.p = [[], []];
			for(var z = 0; z < 64*128; z++) { this.p[0][z] = 0; this.p[1][z] = 0; }
			return;
		}
		if (op == 0xF000) {
			// long memory reference
			this.i = ((this.m[this.pc] << 8) | (this.m[this.pc+1])) & 0xFFFF;
			this.pc += 2;
			return;
		}

		if (o == 0x5 && n != 0) {
			if (n == 2) {
				// save range
				var dist = Math.abs(x - y);
				if (x < y) { for(var z = 0; z <= dist; z++) { this.m[this.i+z] = this.v[x+z]; }}
				else       { for(var z = 0; z <= dist; z++) { this.m[this.i+z] = this.v[x-z]; }}
				return;
			}
			else if (n == 3) {
				// load range
				var dist = Math.abs(x - y);
				if (x < y) { for(var z = 0; z <= dist; z++) { this.v[x+z] = this.m[this.i+z]; }}
				else       { for(var z = 0; z <= dist; z++) { this.v[x-z] = this.m[this.i+z]; }}
				return;
			}
			else {
				haltBreakpoint("unknown opcode "+op);
			}
		}
		if (o == 0x9 && n != 0) {
			haltBreakpoint("unknown opcode "+op);
		}

		// dispatch complex opcodes
		switch(o) {
			case 0x0: this.machine(nnn);                            break;
			case 0x1: this.pc = nnn;                                break;
			case 0x2: this.call(nnn);                               break;
			case 0x3: if (this.v[x] == nn)        { this.skip(); }  break;
			case 0x4: if (this.v[x] != nn)        { this.skip(); }  break;
			case 0x5: if (this.v[x] == this.v[y]) { this.skip(); }  break;
			case 0x6: this.v[x] = nn;                               break;
			case 0x7: this.v[x] = (this.v[x] + nn) & 0xFF;          break;
			case 0x8: this.math(x, y, n);                           break;
			case 0x9: if (this.v[x] != this.v[y]) { this.skip(); }  break;
			case 0xA: this.i = nnn;                                 break;
			case 0xB: this.jump0(nnn);                              break;
			case 0xC: this.v[x] = (Math.random()*256)&nn;           break;
			case 0xD: this.sprite(this.v[x], this.v[y], n);         break;
			case 0xF: this.misc(x, nn);                             break;
			default: haltBreakpoint("unknown opcode "+o);
		}
	}

	public tick() {
		if (this.halted) { return; }
		this.tickCounter++;
		try {
			this.opcode();
		}
		catch(err) {
			console.log("halted: " + err);
			this.halted = true;
		}
	}
}
