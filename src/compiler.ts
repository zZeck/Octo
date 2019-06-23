import { hexFormat } from './util';
import { breakPoints as BreakPoints } from './emulator';

/// /////////////////////////////////
//
//   Tokenization:
//
/// /////////////////////////////////

const BinaryPrefix = '0b';

function parseNumber (token: string): number {
    // Check if this token is a valid binary number
    if (/^[+-]?0b[01]+$/u.test(token)) {
        let bitstring;
        const isNegative = token.startsWith('-');

        // Check for any leading +/- sign character
        if (isNegative || token.startsWith('+')) {
            // Remove sign character and 0b- prefix
            
            bitstring = token.slice(1 + BinaryPrefix.length);
        } else {
            // Remove 0b- prefix
            bitstring = token.slice(BinaryPrefix.length);
        }

        const value = parseInt(bitstring, 2);
        return isNegative ? -value : value;
    }

    // Check if this token is a valid hexadecimal number
    if (/^[+-]?0x[0-9a-f]+$/iu.test(token)) {
        return parseInt(token, 16);
    }

    // Check if this token is a valid decimal number
    if (/^[+-]?[0-9]+$/u.test(token)) {
        return parseInt(token, 10);
    }

    return NaN;
}

function parse (token: string): string | number {
    const num = parseNumber(token);
    return isNaN(num) ? token : num;
}

function tokenize (text: string): [stringOrNumber, number, number][] {
    const ret: [stringOrNumber, number, number][] = [];
    let index = 0;
    let token = '';
    let tokenStart = -1;

    while (index < text.length) {
        let c = text.charAt(index++);
        if (c == '#') {
            if (token.length > 0) {
                ret.push([ parse(token), tokenStart, index ]);
                tokenStart = -1;
            }
            token = '';
            while (c != '\n' && index < text.length) {
                c = text.charAt(index++);
            }
        } else if (' \t\n\r\v'.includes(c)) {
            if (token.length > 0) {
                ret.push([ parse(token), tokenStart, index ]);
                tokenStart = -1;
            }
            token = '';
        } else {
            if (tokenStart == -1) { tokenStart = index; }
            token += c;
        }
    }
    if (token.length > 0) {
        ret.push([parse(token), tokenStart, index + 1]);
    }
    return ret;
}

/// /////////////////////////////////
//
//   The Octo Compiler:
//
/// /////////////////////////////////

export class DebugInfo {
    public lines: string[];
    private _locs: { [address: number]: number};

    public constructor (source: string) {
        this.lines = source.split('\n');
        this._locs = {}; // map<addr, line>
    }

    public mapAddr (addr: number, pos: number): void {
        this._locs[addr] = pos;
    }

    public getLine (addr: number): number | undefined {
        const i = this._locs[addr];
        return i != undefined ? this.posToLine(i) : undefined;
    }

    public getAddr (line: number): number | undefined {
        for (const addr in this._locs) {
            if (this.posToLine(this._locs[addr]) == line) return addr as unknown as number; // TODO fix
        }
        return undefined;
    }

    private posToLine (pos: number): number {
        let i;
        let decreasingPosition = pos;
        for (i = 0; i < this.lines.length; i++) {
            decreasingPosition -= this.lines[i].length + 1;
            if (decreasingPosition <= 0) { break; }
        }
        return i;
    }
}

const programEntryAddress = 0x200;

const unaryFunc: {[func: string]: (x: number, m: number[]) => number} = {
    '-': function (x: number): number { return -x; },
    '~': function (x: number): number { return ~x; },
    '!': function (x: number): number { return Number(!x); },
    'sin': function (x: number): number { return Math.sin(x); },
    'cos': function (x: number): number { return Math.cos(x); },
    'tan': function (x: number): number { return Math.tan(x); },
    'exp': function (x: number): number { return Math.exp(x); },
    'log': function (x: number): number { return Math.log(x); },
    'abs': function (x: number): number { return Math.abs(x); },
    'sqrt': function (x: number): number { return Math.sqrt(x); },
    'sign': function (x: number): number { return Math.sign(x); },
    'ceil': function (x: number): number { return Math.ceil(x); },
    'floor': function (x: number): number { return Math.floor(x); },
    '@': function (x: number, m: number[]): number { return m[(0 | x) - programEntryAddress] || 0; }
};
const binaryFunc: {[func: string]: (x: number, y: number) => number} = {
    '-': function (x: number, y: number): number { return x - y; },
    '+': function (x: number, y: number): number { return x + y; },
    '*': function (x: number, y: number): number { return x * y; },
    '/': function (x: number, y: number): number { return x / y; },
    '%': function (x: number, y: number): number { return x % y; },
    '&': function (x: number, y: number): number { return x & y; },
    '|': function (x: number, y: number): number { return x | y; },
    '^': function (x: number, y: number): number { return x ^ y; },
    '<<': function (x: number, y: number): number { return x << y; },
    '>>': function (x: number, y: number): number { return x >> y; },
    'pow': function (x: number, y: number): number { return Math.pow(x, y); },
    'min': function (x: number, y: number): number { return Math.min(x, y); },
    'max': function (x: number, y: number): number { return Math.max(x, y); },
    '<': function (x: number, y: number): number { return Number(x < y); },
    '>': function (x: number, y: number): number { return Number(x > y); },
    '<=': function (x: number, y: number): number { return Number(x <= y); },
    '>=': function (x: number, y: number): number { return Number(x >= y); },
    '==': function (x: number, y: number): number { return Number(x == y); },
    '!=': function (x: number, y: number): number { return Number(x != y); }
};

type stringOrNumber = string | number;
type marker = [stringOrNumber, number, number];

const Int8Min = -128;
const Int8Max = 255;

export class Compiler {

    public dict: {[name: string]: number};// map<name, addr>
    public rom: number[];
    public dbginfo: DebugInfo;
    public aliases: {[name: string]: number};// map<name, registernum>
    public schip: boolean;
    public xo: boolean;
    public breakpoints: BreakPoints;// map<address, name>
    public pos: stringOrNumber[] | null;

    private loops: [number, marker][];// stack<[addr, marker]>
    private branches: [number, marker, string][];// stack<[addr, marker, type]>
    private whiles: (number | null)[];// stack<int>
    private protos: {[name: string]: number[]};// map<name, list<addr>>
    private longproto: {[name: string]: boolean};// set<name, true>
    private constants: {[keyString: string]: number };// map<name, token>
    private macros: {[name: string]: {args: string[]; body: [stringOrNumber, number, number][]}};// map<name, {args, body}>
    private hasmain: boolean;
    private hereaddr: number;
    private currentToken: number;
    private tokens: [stringOrNumber, number, number][];
    private reservedNames = {
        ':=': true,
        '|=': true,
        '&=': true,
        '^=': true,
        '-=': true,
        '=-': true,
        '+=': true,
        '>>=': true,
        '<<=': true,
        '==': true,
        '!=': true,
        '<': true,
        '>': true,
        '<=': true,
        '>=': true,
        'key': true,
        '-key': true,
        'hex': true,
        'bighex': true,
        'random': true,
        'delay': true,
        ':': true,
        ':next': true,
        ':unpack': true,
        ':breakpoint': true,
        ':proto': true,
        ':alias': true,
        ':const': true,
        ':org': true,
        ';': true,
        'return': true,
        'clear': true,
        'bcd': true,
        'save': true,
        'load': true,
        'buzzer': true,
        'if': true,
        'then': true,
        'begin': true,
        'else': true,
        'end': true,
        'jump': true,
        'jump0': true,
        'native': true,
        'sprite': true,
        'loop': true,
        'while': true,
        'again': true,
        'scroll-down': true,
        'scroll-right': true,
        'scroll-left': true,
        'lores': true,
        'hires': true,
        'loadflags': true,
        'saveflags': true,
        'i': true,
        'audio': true,
        'plane': true,
        'scroll-up': true,
        ':macro': true,
        ':calc': true,
        ':byte': true,
        ':call': true
    };

    public constructor (source: string) {
        this.rom = []; // list<int>
        this.dbginfo = new DebugInfo(source);
        this.loops = []; // stack<[addr, marker]>
        this.branches = []; // stack<[addr, marker, type]>
        this.whiles = []; // stack<int>
        this.dict = {}; // map<name, addr>
        this.protos = {}; // map<name, list<addr>>
        this.longproto = {}; // set<name, true>
        this.aliases = {}; // map<name, registernum>
        this.constants = { // map<name, token>
            'OCTO_KEY_1': 0x1,
            'OCTO_KEY_2': 0x2,
            'OCTO_KEY_3': 0x3,
            'OCTO_KEY_4': 0xC,
            'OCTO_KEY_Q': 0x4,
            'OCTO_KEY_W': 0x5,
            'OCTO_KEY_E': 0x6,
            'OCTO_KEY_R': 0xD,
            'OCTO_KEY_A': 0x7,
            'OCTO_KEY_S': 0x8,
            'OCTO_KEY_D': 0x9,
            'OCTO_KEY_F': 0xE,
            'OCTO_KEY_Z': 0xA,
            'OCTO_KEY_X': 0x0,
            'OCTO_KEY_C': 0xB,
            'OCTO_KEY_V': 0xF
        };
        this.macros = {}; // map<name, {args, body}>
        this.hasmain = true;
        this.schip = false;
        this.xo = false;
        this.breakpoints = {}; // map<address, name>
        this.hereaddr = 0x200;

        this.pos = null;
        this.currentToken = 0;
        this.tokens = tokenize(source);
    }

    public go (): void {
        this.aliases['compare-temp'] = 0xE;
        this.aliases['unpack-hi'] = 0x0;
        this.aliases['unpack-lo'] = 0x1;

        this.inst(0, 0); // reserve a jump slot
        while (!this.end()) {
            if (typeof this.peek() === 'number') {
                const nn = this.next();
                if (nn < Int8Min || nn > Int8Max) {
                    throw Error(`Literal value '${nn}' does not fit in a byte- must be in range [-128, 255].`);
                }
                this.data(nn as number);
            } else {
                this.instruction(this.next());
            }
        }
        if (this.hasmain == true) {
            // resolve the main branch
            this.jump(programEntryAddress, this.wideValue('main'));
        }
        const keys = Object.keys(this.protos);

        if (keys.length > 0) {
            throw Error(`Undefined names: ${keys}`);
        }
        if (this.loops.length > 0) {
            this.pos = this.loops[0][1];
            throw Error("This 'loop' does not have a matching 'again'.");
        }
        if (this.branches.length > 0) {
            this.pos = this.branches[0][1];
            throw Error(`This '${this.branches[0][2]}' does not have a matching 'end'.`);
        }
        for (let index = 0; index < this.rom.length; index++) {
            if (typeof this.rom[index] === 'undefined') { this.rom[index] = 0x00; }
        }
    }

    private data (a: number): void {
        if (typeof this.rom[this.hereaddr - programEntryAddress] !== 'undefined') {
            throw Error('Data overlap. Address ' + hexFormat(this.hereaddr) + ' has already been defined.');
        }
        this.rom[this.hereaddr - programEntryAddress] = a & 0xFF;
        if (this.pos) this.dbginfo.mapAddr(this.hereaddr, Number(this.pos[1]));
        this.hereaddr++;
    }

    private end (): boolean { return this.currentToken >= this.tokens.length; }
    private next (): stringOrNumber { this.pos = this.tokens[this.currentToken++]; return this.pos[0]; }
    private raw (): stringOrNumber[] { this.pos = this.tokens[this.currentToken++]; return this.pos; }
    private peek (): stringOrNumber { return this.tokens[this.currentToken][0]; }
    private here (): number { return this.hereaddr; }
    private inst (a: number, b: number): void { this.data(a); this.data(b); }

    private immediate (op: number, nnn: number): void {
        this.inst(op | nnn >> 8 & 0xF, nnn & 0xFF);
    }

    private fourop (op: number, x: number, y: number, n: number): void {
        this.inst(op << 4 | x, y << 4 | n & 0xF);
    }
    private jump (addr: number, dest: number): void {
        this.rom[addr - programEntryAddress] = 0x10 | dest >> 8 & 0xF;
        this.rom[addr - programEntryAddress - 1] = dest & 0xFF;
    }

    private isRegister (name?: string | number): boolean {
        if (!name && name != 0) { name = this.peek(); }
        if (typeof name !== 'string') { return false; }
        if (name in this.aliases) { return true; }
        name = name.toUpperCase();
        if (name.length != 2) { return false; }
        if (!name.startsWith('V')) { return false; }
        return '0123456789ABCDEF'.includes(name[1]);
    }

    private register (name?: stringOrNumber): number {
        if (!name) { name = this.next(); }
        if (!this.isRegister(name)) {
            throw Error(`Expected register, got '${name}'`);
        }
        if (name in this.aliases) {
            return this.aliases[name];
        }
        name = (name as string).toUpperCase();
        return '0123456789ABCDEF'.indexOf(name[1]);
    }

    private expect (token: string): void {
        const thing = this.next();
        if (thing != token) { throw Error(`Expected '${token}', got '${thing}'!`); }
    }

    private constantValue (): number {
        let number = this.next();
        if (typeof number !== 'number') {
            if (number in this.protos) {
                throw Error('Constants cannot refer to the address of a forward declaration.');
            } else if (number in this.dict) {
                number = this.dict[number];
            } else if (number in this.constants) {
                number = this.constants[number];
            } else { throw Error("Undefined name '" + number + "'."); }
        }
        return number;
    }

    

    private checkName (name: string, kind: string): string {
        if (name in this.reservedNames || name.startsWith('OCTO_')) {
            throw Error("The name '" + name + "' is reserved and cannot be used for a " + kind + '.');
        }
        return name;
    }

    private veryWideValue (): number {
        // i := long NNNN
        let nnnn = this.next();
        if (typeof nnnn !== 'number') {
            if (nnnn in this.constants) {
                nnnn = this.constants[nnnn];
            } else if (nnnn in this.protos) {
                this.protos[nnnn].push(this.here() + 2);
                this.longproto[this.here() + 2] = true;
                nnnn = 0;
            } else if (nnnn in this.dict) {
                nnnn = this.dict[nnnn];
            } else {
                this.protos[this.checkName(nnnn, 'label')] = [this.here() + 2];
                this.longproto[this.here() + 2] = true;
                nnnn = 0;
            }
        }
        if (typeof nnnn !== 'number' || nnnn < 0 || nnnn > 0xFFFF) {
            throw Error(`Value '${nnnn}' cannot fit in 16 bits!`);
        }
        return nnnn & 0xFFFF;
    }

    private wideValue (nnn?: number | string): number {
        // can be forward references.
        // call, jump, jump0, i:=
        // TODO is & to && correct here?
        if (!nnn && nnn != 0) { nnn = this.next(); }
        if (typeof nnn !== 'number') {
            if (nnn in this.constants) {
                nnn = this.constants[nnn];
            } else if (nnn in this.protos) {
                this.protos[nnn].push(this.here());
                nnn = 0;
            } else if (nnn in this.dict) {
                nnn = this.dict[nnn];
            } else {
                this.protos[this.checkName(nnn, 'label')] = [this.here()];
                nnn = 0;
            }
        }
        if (typeof nnn !== 'number' || nnn < 0 || nnn > 0xFFF) {
            throw Error(`Value '${nnn}' cannot fit in 12 bits!`);
        }
        return nnn & 0xFFF;
    }

    private shortValue (nn?: number | string): number {
        // vx:=, vx+=, vx==, v!=, random
        if (!nn && nn != 0) { nn = this.next(); }
        if (typeof nn !== 'number') {
            if (nn in this.constants) { nn = this.constants[nn]; } else { throw Error("Undefined name '" + nn + "'."); }
        }
        // silently trim negative numbers, but warn
        // about positive numbers which are too large:
        if (typeof nn !== 'number' || nn < -128 || nn > 255) {
            throw Error(`Argument '${nn}' does not fit in a byte- must be in range [-128, 255].`);
        }
        return nn & 0xFF;
    }

    private tinyValue (): number {
        // sprite length, unpack high nybble
        let n = this.next();
        if (typeof n !== 'number') {
            if (n in this.constants) { n = this.constants[n]; } else { throw Error("Undefined name '" + n + "'."); }
        }
        if (typeof n !== 'number' || n < 0 || n > 15) {
            throw Error(`Invalid argument '${n}'; must be in range [0,15].`);
        }
        return n & 0xF;
    }

    private conditional (negated: boolean): void {
        const reg = this.register();
        let token = this.next();
        const compTemp = this.aliases['compare-temp'];
        if (negated) {
            if (token == '==') { token = '!='; } else if (token == '!=') { token = '=='; } else if (token == 'key') { token = '-key'; } else if (token == '-key') { token = 'key'; } else if (token == '<') { token = '>='; } else if (token == '>') { token = '<='; } else if (token == '>=') { token = '<'; } else if (token == '<=') { token = '>'; }
        }
        if (token == '==') {
            if (this.isRegister()) { this.inst(0x90 | reg, this.register() << 4); } else { this.inst(0x40 | reg, this.shortValue()); }
        } else if (token == '!=') {
            if (this.isRegister()) { this.inst(0x50 | reg, this.register() << 4); } else { this.inst(0x30 | reg, this.shortValue()); }
        } else if (token == 'key') {
            this.inst(0xE0 | reg, 0xA1);
        } else if (token == '-key') {
            this.inst(0xE0 | reg, 0x9E);
        } else if (token == '>') {
            if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); } else { this.inst(0x60 | compTemp, this.shortValue()); }
            this.fourop(0x8, compTemp, reg, 0x5); // ve -= v1
            this.inst(0x3F, 1); // if vf == 1 then ...
        } else if (token == '<') {
            if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); } else { this.inst(0x60 | compTemp, this.shortValue()); }
            this.fourop(0x8, compTemp, reg, 0x7); // ve =- v1
            this.inst(0x3F, 1); // if vf == 1 then ...
        } else if (token == '>=') {
            if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); } else { this.inst(0x60 | compTemp, this.shortValue()); }
            this.fourop(0x8, compTemp, reg, 0x7); // ve =- v1
            this.inst(0x4F, 1); // if vf != 1 then ...
        } else if (token == '<=') {
            if (this.isRegister()) { this.fourop(0x8, compTemp, this.register(), 0x0); } else { this.inst(0x60 | compTemp, this.shortValue()); }
            this.fourop(0x8, compTemp, reg, 0x5); // ve -= v1
            this.inst(0x4F, 1); // if vf != 1 then ...
        } else {
            throw Error(`Conditional flag expected, got '${token}!`);
        }
    }

    private controlToken (): [stringOrNumber, number, number] {
        // ignore a condition
        const op = this.tokens[this.currentToken + 1][0];
        let index = 3;
        if (op == 'key' || op == '-key') { index = 2; }
        if (index + this.currentToken >= this.tokens.length) { index = this.tokens.length - this.currentToken - 1; }
        return this.tokens[index + this.currentToken];
    }

    private iassign (token: string): void {
        if (token == ':=') {
            const o = this.next();
            if (o == 'hex') { this.inst(0xF0 | this.register(), 0x29); } else if (o == 'bighex') {
                this.schip = true;
                this.inst(0xF0 | this.register(), 0x30);
            } else if (o == 'long') {
                this.xo = true;
                const addr = this.veryWideValue();
                this.inst(0xF0, 0x00);
                this.inst(addr >> 8 & 0xFF, addr & 0xFF);
            } else { this.immediate(0xA0, this.wideValue(o)); }
        } else if (token == '+=') {
            this.inst(0xF0 | this.register(), 0x1E);
        } else {
            throw Error("The operator '" + token + "' cannot target the i register.");
        }
    }

    private vassign (reg: number, token: string): void {
        if (token == ':=') {
            const o = this.next();
            if (this.isRegister(o)) { this.fourop(0x8, reg, this.register(o), 0x0); } else if (o == 'random') { this.inst(0xC0 | reg, this.shortValue()); } else if (o == 'key') { this.inst(0xF0 | reg, 0x0A); } else if (o == 'delay') { this.inst(0xF0 | reg, 0x07); } else { this.inst(0x60 | reg, this.shortValue(o)); }
        } else if (token == '+=') {
            if (this.isRegister()) { this.fourop(0x8, reg, this.register(), 0x4); } else { this.inst(0x70 | reg, this.shortValue()); }
        } else if (token == '|=') { this.fourop(0x8, reg, this.register(), 0x1); } else if (token == '&=') { this.fourop(0x8, reg, this.register(), 0x2); } else if (token == '^=') { this.fourop(0x8, reg, this.register(), 0x3); } else if (token == '-=') { this.fourop(0x8, reg, this.register(), 0x5); } else if (token == '=-') { this.fourop(0x8, reg, this.register(), 0x7); } else if (token == '>>=') { this.fourop(0x8, reg, this.register(), 0x6); } else if (token == '<<=') { this.fourop(0x8, reg, this.register(), 0xE); } else {
            throw Error("Unrecognized operator '" + token + "'.");
        }
    }

    private resolveLabel (offset: number): void {
        let target = this.here() + offset;
        const label = this.checkName(this.next() as string, 'label');
        if (target == 0x202 && label == 'main') {
            this.hasmain = false;
            this.rom = [];
            this.hereaddr = 0x200;
            target = this.here();
        }
        if (label in this.dict) { throw Error("The name '" + label + "' has already been defined."); }
        this.dict[label] = target;

        if (label in this.protos) {
            for (const addr of this.protos[label]) {
                if (this.longproto[addr]) {
                    // i := long target
                    this.rom[addr - 0x200] = target >> 8 & 0xFF;
                    this.rom[addr - 0x1FF] = target & 0xFF;
                } else if ((this.rom[addr - 0x200] & 0xF0) == 0x60) {
                    // :unpack target
                    if ((target & 0xFFF) != target) { throw Error("Value '" + target + "' for label '" + label + "' cannot not fit in 12 bits!"); }
                    this.rom[addr - 0x1FF] = this.rom[addr - 0x1FF] & 0xF0 | target >> 8 & 0xF;
                    this.rom[addr - 0x1FD] = target & 0xFF;
                } else {
                    if ((target & 0xFFF) != target) { throw Error("Value '" + target + "' for label '" + label + "' cannot not fit in 12 bits!"); }
                    this.rom[addr - 0x200] = this.rom[addr - 0x200] & 0xF0 | target >> 8 & 0xF;
                    this.rom[addr - 0x1FF] = target & 0xFF;
                }
            }
            delete this.protos[label];
        }
    }

    private parseTerminal (name: string): number {
        // NUMBER | CONSTANT | LABEL | '(' expression ')'
        const x = this.peek();
        if (x == 'PI') { this.next(); return Math.PI; }
        if (x == 'E') { this.next(); return Math.E; }
        if (x == 'HERE') { this.next(); return this.hereaddr; }
        if (Number(x) == Number(x)) { return Number(this.next()); }
        if (x in this.constants) { return this.constants[this.next()]; }
        if (x in this.dict) { return this.dict[this.next()]; }
        if (x in this.protos) {
            throw Error(`Cannot use forward declaration '${x}' in calculated constant '${name}".`);
        }
        if (this.next() != '(') { throw Error(`Undefined constant '${x}'.`); }
        const value = this.parseCalc(name);
        if (this.next() != ')') { throw Error(`Expected ')' for calculated constant '${name}'.`); }
        return value;
    }

    private parseCalc (name: string): number {
        // UNARY expression | terminal BINARY expression | terminal
        if (this.peek() in unaryFunc) {
            return unaryFunc[this.next()](this.parseCalc(name), this.rom);
        }
        const t = this.parseTerminal(name);
        if (this.peek() in binaryFunc) {
            return binaryFunc[this.next()](t, this.parseCalc(name));
        } 
        return t;
        
    }

    private parseCalculated (name: string): number {
        if (this.next() != '{') { throw Error("Expected '{' for calculated constant '" + name + "'."); }
        const value = this.parseCalc(name);
        if (this.next() != '}') { throw Error("Expected '}' for calculated constant '" + name + "'."); }
        return value;
    }

    private instruction (token: stringOrNumber): void {
        if (token == ':') { this.resolveLabel(0); } else if (token == ':next') { this.resolveLabel(1); } else if (token == ':unpack') {
            const v = this.tinyValue();
            const a = this.wideValue();
            this.inst(0x60 | this.aliases['unpack-hi'], v << 4 | a >> 8);
            this.inst(0x60 | this.aliases['unpack-lo'], a);
        } else if (token == ':breakpoint') { this.breakpoints[this.here()] = this.next() as string; } else if (token == ':proto') { this.next(); } // deprecated.
        else if (token == ':alias') { this.aliases[this.checkName(this.next() as string, 'alias')] = this.register(); } else if (token == ':const') {
            const name = this.checkName(this.next() as string, 'constant');
            if (name in this.constants) { throw Error("The name '" + name + "' has already been defined."); }
            this.constants[name] = this.constantValue();
        } else if (token == ':macro') {
            const name = this.checkName(this.next() as string, 'macro');
            const args = [];
            while (this.peek() != '{' && !this.end()) {
                args.push(this.checkName(this.next() as string, 'macro argument'));
            }
            if (this.next() != '{') { throw Error("Expected '{' for definition of macro '" + name + "'."); }
            const body = [];
            let depth = 1;
            while (!this.end()) {
                if (this.peek() == '{') { depth += 1; }
                if (this.peek() == '}') { depth -= 1; }
                if (depth == 0) { break; }
                body.push(this.raw());
            }
            if (this.next() != '}') { throw Error("Expected '}' for definition of macro '" + name + "'."); }
            this.macros[name] = { args: args, body: body as any };
        } else if (token in this.macros) {
            const macro = this.macros[token];
            const bindings: {[binding: string]: stringOrNumber[]} = {};
            for (const arg of macro.args) {
                if (this.end()) {
                    throw Error(`Not enough arguments for expansion of macro '${token}'`);
                }
                bindings[arg] = this.raw();
            }
            for (var x = 0; x < macro.body.length; x++) {
                const chunk = macro.body[x];
                const value = chunk[0] in bindings ? bindings[chunk[0]] : chunk;
                this.tokens.splice(x + this.currentToken, 0, value as [string | number, number, number]);
            }
        } else if (token == ':calc') {
            var name = this.checkName(this.next() as string, 'calculated constant');
            this.constants[name] = this.parseCalculated(name);
        } else if (token == ':byte') {
            this.data(this.peek() == '{' ? this.parseCalculated('ANONYMOUS') : this.shortValue());
        } else if (token == ':org') { this.hereaddr = this.constantValue(); } else if (token == ';') { this.inst(0x00, 0xEE); } else if (token == 'return') { this.inst(0x00, 0xEE); } else if (token == 'clear') { this.inst(0x00, 0xE0); } else if (token == 'bcd') { this.inst(0xF0 | this.register(), 0x33); } else if (token == 'save') {
            var reg = this.register();
            if (!this.end() && this.peek() == '-') {
                this.expect('-');
                this.xo = true;
                this.inst(0x50 | reg, this.register() << 4 | 0x02);
            } else {
                this.inst(0xF0 | reg, 0x55);
            }
        } else if (token == 'load') {
            var reg = this.register();
            if (!this.end() && this.peek() == '-') {
                this.expect('-');
                this.xo = true;
                this.inst(0x50 | reg, this.register() << 4 | 0x03);
            } else {
                this.inst(0xF0 | reg, 0x65);
            }
        } else if (token == 'delay') { this.expect(':='); this.inst(0xF0 | this.register(), 0x15); } else if (token == 'buzzer') { this.expect(':='); this.inst(0xF0 | this.register(), 0x18); } else if (token == 'if') {
            const control = this.controlToken();
            if (control[0] == 'then') {
                this.conditional(false);
                this.expect('then');
            } else if (control[0] == 'begin') {
                this.conditional(true);
                this.expect('begin');
                this.branches.push([this.here(), this.pos as any, 'begin']);
                this.inst(0x00, 0x00);
            } else {
                this.pos = control;
                throw Error("Expected 'then' or 'begin'.");
            }
        } else if (token == 'else') {
            if (this.branches.length < 1) {
                throw Error("This 'else' does not have a matching 'begin'.");
            }
            this.jump(this.branches.pop()![0], this.here() + 2);
            this.branches.push([this.here(), this.pos as any, 'else']);
            this.inst(0x00, 0x00);
        } else if (token == 'end') {
            if (this.branches.length < 1) {
                throw Error("This 'end' does not have a matching 'begin'.");
            }
            this.jump(this.branches.pop()![0], this.here());
        } else if (token == 'jump0') { this.immediate(0xB0, this.wideValue()); } else if (token == 'jump') { this.immediate(0x10, this.wideValue()); } else if (token == 'native') { this.immediate(0x00, this.wideValue()); } else if (token == 'sprite') {
            const r1 = this.register();
            const r2 = this.register();
            const size = this.tinyValue();
            if (size == 0) { this.schip = true; }
            this.inst(0xD0 | r1, r2 << 4 | size);
        } else if (token == 'loop') {
            this.loops.push([this.here(), this.pos as [string | number, number, number]]);
            this.whiles.push(null);
        } else if (token == 'while') {
            if (this.loops.length < 1) {
                throw Error("This 'while' is not within a loop.");
            }
            this.conditional(true);
            this.whiles.push(this.here());
            this.immediate(0x10, 0);
        } else if (token == 'again') {
            if (this.loops.length < 1) {
                throw Error("This 'again' does not have a matching 'loop'.");
            }
            this.immediate(0x10, this.loops.pop()![0]);
            while (this.whiles[this.whiles.length - 1] != null) {
                this.jump(this.whiles.pop()!, this.here());
            }
            this.whiles.pop();
        } else if (token == 'plane') {
            const plane = this.tinyValue();
            if (plane > 3) { throw Error('the plane bitmask must be [0, 3].'); }
            this.xo = true;
            this.inst(0xF0 | plane, 0x01);
        } else if (token == 'audio') {
            this.xo = true;
            this.inst(0xF0, 0x02);
        } else if (token == 'scroll-down') { this.schip = true; this.inst(0x00, 0xC0 | this.tinyValue()); } else if (token == 'scroll-up') { this.xo = true; this.inst(0x00, 0xD0 | this.tinyValue()); } else if (token == 'scroll-right') { this.schip = true; this.inst(0x00, 0xFB); } else if (token == 'scroll-left') { this.schip = true; this.inst(0x00, 0xFC); } else if (token == 'exit') { this.schip = true; this.inst(0x00, 0xFD); } else if (token == 'lores') { this.schip = true; this.inst(0x00, 0xFE); } else if (token == 'hires') { this.schip = true; this.inst(0x00, 0xFF); } else if (token == 'saveflags') {
            var flags = this.register();
            if (flags > 7) { throw Error('saveflags argument must be v[0,7].'); }
            this.schip = true;
            this.inst(0xF0 | flags, 0x75);
        } else if (token == 'loadflags') {
            var flags = this.register();
            if (flags > 7) { throw Error('loadflags argument must be v[0,7].'); }
            this.schip = true;
            this.inst(0xF0 | flags, 0x85);
        } else if (token == 'i') {
            this.iassign(this.next() as string);
        } else if (this.isRegister(token)) {
            this.vassign(this.register(token), this.next() as string);
        } else if (token == ':call') {
            this.immediate(0x20, this.wideValue(this.next()));
        } else {
            this.immediate(0x20, this.wideValue(token));
        }
    }


}
