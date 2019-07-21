import { haltBreakpoint } from "./debugger";
import { DebugInfo } from "./compiler";
import { Formats } from "./util";

export const keymap = [
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
  /* F */ 86 // v
];

export const keymapInverse: number[] = [];
for (let i = 0, len = keymap.length; i < len; i++) {
  keymapInverse[keymap[i]] = i;
}

const font = [
  0b11110000,
  0b10010000,
  0b10010000,
  0b10010000,
  0b11110000,

  0b01100000,
  0b00100000,
  0b00100000,
  0b00100000,
  0b01110000,

  0b11110000,
  0b00010000,
  0b11110000,
  0b10000000,
  0b11110000,

  0b11110000,
  0b00010000,
  0b11110000,
  0b00010000,
  0b11110000,

  0b10100000,
  0b10100000,
  0b11110000,
  0b00100000,
  0b00100000,

  0b11110000,
  0b10000000,
  0b11110000,
  0b00010000,
  0b11110000,

  0b11110000,
  0b10000000,
  0b11110000,
  0b10010000,
  0b11110000,

  0b11110000,
  0b00010000,
  0b00010000,
  0b00010000,
  0b00010000,

  0b11110000,
  0b10010000,
  0b11110000,
  0b10010000,
  0b11110000,

  0b11110000,
  0b10010000,
  0b11110000,
  0b00010000,
  0b11110000,

  0b11110000,
  0b10010000,
  0b11110000,
  0b10010000,
  0b10010000,

  0b11110000,
  0b01010000,
  0b01110000,
  0b01010000,
  0b11110000,

  0b11110000,
  0b10000000,
  0b10000000,
  0b10000000,
  0b11110000,

  0b11110000,
  0b01010000,
  0b01010000,
  0b01010000,
  0b11110000,

  0b11110000,
  0b10000000,
  0b11110000,
  0b10000000,
  0b11110000,

  0b11110000,
  0b10000000,
  0b11110000,
  0b10000000,
  0b10000000
];

const bigfont = [
  0xff,
  0xff,
  0xc3,
  0xc3,
  0xc3,
  0xc3,
  0xc3,
  0xc3,
  0xff,
  0xff, // 0
  0x18,
  0x78,
  0x78,
  0x18,
  0x18,
  0x18,
  0x18,
  0x18,
  0xff,
  0xff, // 1
  0xff,
  0xff,
  0x03,
  0x03,
  0xff,
  0xff,
  0xc0,
  0xc0,
  0xff,
  0xff, // 2
  0xff,
  0xff,
  0x03,
  0x03,
  0xff,
  0xff,
  0x03,
  0x03,
  0xff,
  0xff, // 3
  0xc3,
  0xc3,
  0xc3,
  0xc3,
  0xff,
  0xff,
  0x03,
  0x03,
  0x03,
  0x03, // 4
  0xff,
  0xff,
  0xc0,
  0xc0,
  0xff,
  0xff,
  0x03,
  0x03,
  0xff,
  0xff, // 5
  0xff,
  0xff,
  0xc0,
  0xc0,
  0xff,
  0xff,
  0xc3,
  0xc3,
  0xff,
  0xff, // 6
  0xff,
  0xff,
  0x03,
  0x03,
  0x06,
  0x0c,
  0x18,
  0x18,
  0x18,
  0x18, // 7
  0xff,
  0xff,
  0xc3,
  0xc3,
  0xff,
  0xff,
  0xc3,
  0xc3,
  0xff,
  0xff, // 8
  0xff,
  0xff,
  0xc3,
  0xc3,
  0xff,
  0xff,
  0x03,
  0x03,
  0xff,
  0xff, // 9
  0x7e,
  0xff,
  0xc3,
  0xc3,
  0xc3,
  0xff,
  0xff,
  0xc3,
  0xc3,
  0xc3, // A
  0xfc,
  0xfc,
  0xc3,
  0xc3,
  0xfc,
  0xfc,
  0xc3,
  0xc3,
  0xfc,
  0xfc, // B
  0x3c,
  0xff,
  0xc3,
  0xc0,
  0xc0,
  0xc0,
  0xc0,
  0xc3,
  0xff,
  0x3c, // C
  0xfc,
  0xfe,
  0xc3,
  0xc3,
  0xc3,
  0xc3,
  0xc3,
  0xc3,
  0xfe,
  0xfc, // D
  0xff,
  0xff,
  0xc0,
  0xc0,
  0xff,
  0xff,
  0xc0,
  0xc0,
  0xff,
  0xff, // E
  0xff,
  0xff,
  0xc0,
  0xc0,
  0xff,
  0xff,
  0xc0,
  0xc0,
  0xc0,
  0xc0 // F
];

/// /////////////////////////////////
//
//   The Chip8 Interpreter:
//
/// /////////////////////////////////

export interface RomData {
  labels: { [key: string]: number };
  aliases: { [key: string]: number };
  breakpoints: { [key: number]: string };
  rom: number[];
  dbginfo?: DebugInfo;
}

export interface EmulatorOptions {
  tickrate: number;
  fillColor: string;
  fillColor2: string;
  blendColor: string;
  backgroundColor: string;
  buzzColor: string;
  quietColor: string;
  shiftQuirks: boolean;
  loadStoreQuirks: boolean;
  vfOrderQuirks: boolean;
  clipQuirks: boolean;
  jumpQuirks: boolean;
  vBlankQuirks: boolean;
  enableXO: boolean;
  screenRotation: number;
  maxSize: number;
  maskFormatOverride: boolean;
  numericFormatStr: string;
  [key: string]: any; // TODO hacky
}

export class Emulator implements EmulatorOptions {
  // TODO remove this and try to switch clients to property string enum types
  //

  // persistent configuration settings
  public tickrate = 20;
  public fillColor = "#FFCC00";
  public fillColor2 = "#FF6600";
  public blendColor = "#662200";
  public backgroundColor = "#996600";
  public buzzColor = "#FFAA00";
  public quietColor = "#000000";
  public shiftQuirks = false;
  public loadStoreQuirks = false;
  public vfOrderQuirks = false;
  public clipQuirks = false;
  public jumpQuirks = false;
  public vBlankQuirks = false;
  public enableXO = true;
  public screenRotation = 0;
  public maxSize = 3584;
  public maskFormatOverride = true;
  public numericFormatStr: Formats = Formats.default;

  // interpreter state
  public p: number[][] = [[], []]; // pixels
  public m: Uint8Array = new Uint8Array(0); // memory (bytes)
  public r: number[] = []; // return stack
  public v: number[] = []; // registers
  public pc = 0; // program counter
  public i = 0; // index register
  public dt = 0; // delay timer
  public st = 0; // sound timer
  public hires = false; // are we in SuperChip high res mode?
  public flags: number[] = []; // semi-persistent hp48 flag vars //TODO can be null? is null checked elsewhere
  public pattern: number[] = []; // audio pattern buffer
  public plane = 1; // graphics plane
  public profileData: { [data: number]: number } = {};

  // control/debug state
  public keys: { [key: number]: boolean } = {}; // track keys which are pressed
  public waiting = false; // are we waiting for a keypress?
  public waitReg = -1; // destination register of an awaited key
  public halted = true;
  public breakpoint = false;
  public metadata: RomData = {
    labels: {},
    breakpoints: {},
    aliases: {},
    rom: []
  };
  public tickCounter = 0;
  public stackBreakpoint!: number;

  // external interface stubs
  // TODO note: these are assigned in htmlcode
  public exitVector: () => void = (): void => {}; // fired by 'exit'
  public importFlags: () => number[] = (): number[] => {
    return [0, 0, 0, 0, 0, 0, 0, 0];
  }; // load persistent flags
  public exportFlags: (flags: number[]) => void = (): void => {}; // save persistent flags
  public buzzTrigger: (
    _ticks: number,
    _remainingTicks: number
  ) => void = (): void => {}; // fired when buzzer played //TODO unused?

  public init(rom: RomData): void {
    // initialise memory with a new array to ensure that it is of the right size and is initiliased to 0
    this.m = this.enableXO ? new Uint8Array(0x10000) : new Uint8Array(0x1000);

    this.p = [[], []];
    if (this.enableXO) {
      for (let z = 0; z < 64 * 128; z++) {
        this.p[0][z] = 0;
        this.p[1][z] = 0;
      }
    } else {
      for (let z = 0; z < 32 * 64; z++) {
        this.p[0][z] = 0;
        this.p[1][z] = 0;
      }
    }

    // initialize memory
    for (let z = 0; z < 32 * 64; z++) {
      this.p[0][z] = 0;
      this.p[1][z] = 0;
    }
    for (let z = 0; z < font.length; z++) {
      this.m[z] = font[z];
    }
    for (let z = 0; z < bigfont.length; z++) {
      this.m[z + font.length] = bigfont[z];
    }
    for (let z = 0; z < rom.rom.length; z++) {
      this.m[0x200 + z] = rom.rom[z];
    }
    for (let z = 0; z < 16; z++) {
      this.v[z] = 0;
    }
    for (let z = 0; z < 16; z++) {
      this.pattern[z] = 0;
    }

    // initialize interpreter state
    this.r = [];
    this.pc = 0x200;
    this.i = 0;
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
    this.stackBreakpoint = -1;
    this.metadata = rom;
    this.tickCounter = 0;
    this.profileData = {};
  }

  public tick(): void {
    if (this.halted) {
      return;
    }
    this.tickCounter++;
    try {
      this.opcode();
    } catch (err) {
      console.log(`halted: ${err}`);
      this.halted = true;
    }
  }

  private writeCarry(dest: number, value: number, flag: number): void {
    this.v[dest] = value & 0xff;
    this.v[0xf] = flag ? 1 : 0;
    if (this.vfOrderQuirks) {
      this.v[dest] = value & 0xff;
    }
  }

  private math(x: number, originalY: number, op: number): void {
    // basic arithmetic opcodes
    let t: number;
    let y = originalY;
    switch (op) {
      case 0x0:
        this.v[x] = this.v[y];
        break;
      case 0x1:
        this.v[x] |= this.v[y];
        break;
      case 0x2:
        this.v[x] &= this.v[y];
        break;
      case 0x3:
        this.v[x] ^= this.v[y];
        break;
      case 0x4:
        t = this.v[x] + this.v[y];
        this.writeCarry(x, t, Number(t > 0xff));
        break;
      case 0x5:
        t = this.v[x] - this.v[y];
        this.writeCarry(x, t, Number(this.v[x] >= this.v[y]));
        break;
      case 0x7:
        t = this.v[y] - this.v[x];
        this.writeCarry(x, t, Number(this.v[y] >= this.v[x]));
        break;
      case 0x6:
        if (this.shiftQuirks) {
          y = x;
        }
        t = this.v[y] >> 1;
        this.writeCarry(x, t, this.v[y] & 0x1);
        break;
      case 0xe:
        if (this.shiftQuirks) {
          y = x;
        }
        t = this.v[y] << 1;
        this.writeCarry(x, t, (this.v[y] >> 7) & 0x1);
        break;
      default:
        haltBreakpoint(`unknown math opcode ${op}`);
    }
  }

  private misc(x: number, rest: number): void {
    // miscellaneous opcodes
    switch (rest) {
      case 0x01:
        this.plane = x & 0x3;
        break;
      case 0x02:
        for (let z = 0; z < 16; z++) {
          this.pattern[z] = this.m[this.i + z];
        }
        break;
      case 0x07:
        this.v[x] = this.dt;
        break;
      case 0x0a:
        this.waiting = true;
        this.waitReg = x;
        break;
      case 0x15:
        this.dt = this.v[x];
        break;
      case 0x18:
        this.buzzTrigger(this.v[x], this.st);
        this.st = this.v[x];
        break;
      case 0x1e:
        this.i = (this.i + this.v[x]) & 0xffff;
        break;
      case 0x29:
        this.i = (this.v[x] & 0xf) * 5;
        break;
      case 0x30:
        this.i = (this.v[x] & 0xf) * 10 + font.length;
        break;
      case 0x33:
        this.m[this.i] = Math.floor(this.v[x] / 100) % 10;
        this.m[this.i + 1] = Math.floor(this.v[x] / 10) % 10;
        this.m[this.i + 2] = this.v[x] % 10;
        break;
      case 0x55:
        for (let z = 0; z <= x; z++) {
          this.m[this.i + z] = this.v[z];
        }
        if (!this.loadStoreQuirks) {
          this.i = (this.i + x + 1) & 0xffff;
        }
        break;
      case 0x65:
        for (let z = 0; z <= x; z++) {
          this.v[z] = this.m[this.i + z];
        }
        if (!this.loadStoreQuirks) {
          this.i = (this.i + x + 1) & 0xffff;
        }
        break;
      case 0x75:
        for (let z = 0; z <= x; z++) {
          this.flags[z] = this.v[z];
        }
        this.exportFlags(this.flags);
        break;
      case 0x85:
        this.flags = this.importFlags();
        if (typeof this.flags === "undefined" || this.flags === null) {
          this.flags = [0, 0, 0, 0, 0, 0, 0, 0];
        }
        for (let z = 0; z <= x; z++) {
          this.v[z] = this.flags[z];
        }
        break;
      default:
        haltBreakpoint(`unknown misc opcode ${rest}`);
    }
  }

  private sprite(x: number, y: number, len: number): void {
    this.v[0xf] = 0x0;
    const rowSize = this.hires ? 128 : 64;
    const colSize = this.hires ? 64 : 32;
    let i = this.i;
    for (let layer = 0; layer < 2; layer++) {
      if ((this.plane & (layer + 1)) == 0) {
        continue;
      }
      if (len == 0) {
        // draw a SuperChip 16x16 sprite
        for (let a = 0; a < 16; a++) {
          for (let b = 0; b < 16; b++) {
            const target = ((x + b) % rowSize) + ((y + a) % colSize) * rowSize;
            let source =
              ((this.m[i + a * 2 + (b > 7 ? 1 : 0)] >> (7 - (b % 8))) & 0x1) !=
              0;
            if (this.clipQuirks) {
              if (
                (x % rowSize) + b >= rowSize ||
                (y % colSize) + a >= colSize
              ) {
                source = false;
              }
            }
            if (!source) {
              continue;
            }
            if (this.p[layer][target]) {
              this.p[layer][target] = 0;
              this.v[0xf] = 0x1;
            } else {
              this.p[layer][target] = 1;
            }
          }
        }
        i += 32;
      } else {
        // draw a Chip8 8xN sprite
        for (let a = 0; a < len; a++) {
          for (let b = 0; b < 8; b++) {
            const target = ((x + b) % rowSize) + ((y + a) % colSize) * rowSize;
            let source = ((this.m[i + a] >> (7 - b)) & 0x1) != 0;
            if (this.clipQuirks) {
              if (
                (x % rowSize) + b >= rowSize ||
                (y % colSize) + a >= colSize
              ) {
                source = false;
              }
            }
            if (!source) {
              continue;
            }
            if (this.p[layer][target]) {
              this.p[layer][target] = 0;
              this.v[0xf] = 0x1;
            } else {
              this.p[layer][target] = 1;
            }
          }
        }
        i += len;
      }
    }
  }

  private call(nnn: number): void {
    if (this.r.length >= 12) {
      haltBreakpoint("call stack overflow.");
    }
    this.r.push(this.pc);
    this.pc = nnn;
  }

  private jump0(nnn: number): void {
    if (this.jumpQuirks) {
      this.pc = nnn + this.v[(nnn >> 8) & 0xf];
    } else {
      this.pc = nnn + this.v[0];
    }
  }

  private machine(nnn: number): void {
    if (nnn == 0x000) {
      this.halted = true;
      return;
    }
    haltBreakpoint("machine code is not supported.");
  }

  private skip(): void {
    const op = (this.m[this.pc] << 8) | this.m[this.pc + 1];
    this.pc += op == 0xf000 ? 4 : 2;
  }

  private opcode(): void {
    // Increment profilining data
    this.profileData[this.pc] = (this.profileData[this.pc] || 0) + 1;

    // decode the current opcode
    const op = (this.m[this.pc] << 8) | this.m[this.pc + 1];
    const o = (this.m[this.pc] >> 4) & 0x00f;
    const x = this.m[this.pc] & 0x00f;
    const y = (this.m[this.pc + 1] >> 4) & 0x00f;
    const n = this.m[this.pc + 1] & 0x00f;
    const nn = this.m[this.pc + 1] & 0x0ff;
    const nnn = op & 0xfff;
    this.pc += 2;

    // execute a simple opcode
    if (op == 0x00e0) {
      // clear
      for (let layer = 0; layer < 2; layer++) {
        if ((this.plane & (layer + 1)) == 0) {
          continue;
        }
        for (let z = 0; z < this.p[layer].length; z++) {
          this.p[layer][z] = 0;
        }
      }
      return;
    }
    if (op == 0x00ee) {
      // return
      this.pc = this.r.pop() as number;
      return;
    }
    if ((op & 0xf0ff) == 0xe09e) {
      // if -key
      if (keymap[this.v[x]] in this.keys) {
        this.skip();
      }
      return;
    }
    if ((op & 0xf0ff) == 0xe0a1) {
      // if key
      if (!(keymap[this.v[x]] in this.keys)) {
        this.skip();
      }
      return;
    }
    if ((op & 0xfff0) == 0x00c0) {
      // scroll down n pixels
      const rowSize = this.hires ? 128 : 64;
      for (let layer = 0; layer < 2; layer++) {
        if ((this.plane & (layer + 1)) == 0) {
          continue;
        }
        for (let z = this.p[layer].length - 1; z >= 0; z--) {
          this.p[layer][z] =
            z >= rowSize * n ? this.p[layer][z - rowSize * n] : 0;
        }
      }
      return;
    }
    if ((op & 0xfff0) == 0x00d0) {
      // scroll up n pixels
      const rowSize = this.hires ? 128 : 64;
      for (let layer = 0; layer < 2; layer++) {
        if ((this.plane & (layer + 1)) == 0) {
          continue;
        }
        for (let z = 0; z < this.p[layer].length; z++) {
          this.p[layer][z] =
            z < this.p[layer].length - rowSize * n
              ? this.p[layer][z + rowSize * n]
              : 0;
        }
      }
      return;
    }
    if (op == 0x00fb) {
      // scroll right 4 pixels
      const rowSize = this.hires ? 128 : 64;
      for (let layer = 0; layer < 2; layer++) {
        if ((this.plane & (layer + 1)) == 0) {
          continue;
        }
        for (let a = 0; a < this.p[layer].length; a += rowSize) {
          for (let b = rowSize - 1; b >= 0; b--) {
            this.p[layer][a + b] = b > 3 ? this.p[layer][a + b - 4] : 0;
          }
        }
      }
      return;
    }
    if (op == 0x00fc) {
      // scroll left 4 pixels
      const rowSize = this.hires ? 128 : 64;
      for (let layer = 0; layer < 2; layer++) {
        if ((this.plane & (layer + 1)) == 0) {
          continue;
        }
        for (let a = 0; a < this.p[layer].length; a += rowSize) {
          for (let b = 0; b < rowSize; b++) {
            this.p[layer][a + b] =
              b < rowSize - 4 ? this.p[layer][a + b + 4] : 0;
          }
        }
      }
      return;
    }
    if (op == 0x00fd) {
      // exit
      this.halted = true;
      this.exitVector();
      return;
    }
    if (op == 0x00fe) {
      // lores
      this.hires = false;
      this.p = [[], []];
      for (let z = 0; z < 32 * 64; z++) {
        this.p[0][z] = 0;
        this.p[1][z] = 0;
      }
      return;
    }
    if (op == 0x00ff) {
      // hires
      this.hires = true;
      this.p = [[], []];
      for (let z = 0; z < 64 * 128; z++) {
        this.p[0][z] = 0;
        this.p[1][z] = 0;
      }
      return;
    }
    if (op == 0xf000) {
      // long memory reference
      this.i = ((this.m[this.pc] << 8) | this.m[this.pc + 1]) & 0xffff;
      this.pc += 2;
      return;
    }

    if (o == 0x5 && n != 0) {
      if (n == 2) {
        // save range
        const dist = Math.abs(x - y);
        if (x < y) {
          for (let z = 0; z <= dist; z++) {
            this.m[this.i + z] = this.v[x + z];
          }
        } else {
          for (let z = 0; z <= dist; z++) {
            this.m[this.i + z] = this.v[x - z];
          }
        }
        return;
      } else if (n == 3) {
        // load range
        const dist = Math.abs(x - y);
        if (x < y) {
          for (let z = 0; z <= dist; z++) {
            this.v[x + z] = this.m[this.i + z];
          }
        } else {
          for (let z = 0; z <= dist; z++) {
            this.v[x - z] = this.m[this.i + z];
          }
        }
        return;
      }
      haltBreakpoint(`unknown opcode ${op}`);
    }
    if (o == 0x9 && n != 0) {
      haltBreakpoint(`unknown opcode ${op}`);
    }

    // dispatch complex opcodes
    switch (o) {
      case 0x0:
        this.machine(nnn);
        break;
      case 0x1:
        this.pc = nnn;
        break;
      case 0x2:
        this.call(nnn);
        break;
      case 0x3:
        if (this.v[x] == nn) {
          this.skip();
        }
        break;
      case 0x4:
        if (this.v[x] != nn) {
          this.skip();
        }
        break;
      case 0x5:
        if (this.v[x] == this.v[y]) {
          this.skip();
        }
        break;
      case 0x6:
        this.v[x] = nn;
        break;
      case 0x7:
        this.v[x] = (this.v[x] + nn) & 0xff;
        break;
      case 0x8:
        this.math(x, y, n);
        break;
      case 0x9:
        if (this.v[x] != this.v[y]) {
          this.skip();
        }
        break;
      case 0xa:
        this.i = nnn;
        break;
      case 0xb:
        this.jump0(nnn);
        break;
      case 0xc:
        this.v[x] = (Math.random() * 256) & nn;
        break;
      case 0xd:
        this.sprite(this.v[x], this.v[y], n);
        break;
      case 0xf:
        this.misc(x, nn);
        break;
      default:
        haltBreakpoint(`unknown opcode ${o}`);
    }
  }
  [key: string]: any;
}
