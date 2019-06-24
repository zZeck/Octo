import { escapeHtml } from './shared';
import { hexFormat, emulator, numericFormat, setVisible, range, Formats } from './util';

/**
* Debugger and Profiler
**/

const runContinue = document.getElementById('run-continue')!;
const debugPanel = document.getElementById('debugger')!;

const regNumFormat: {[register: string]: Formats} = {};
// TODO this is used by dumpRegisters in strange way
export function cycleNumFormat (r: string): void {
    const f: Formats[] = [Formats.hex, Formats.bin, Formats.dec, Formats.hex];
    regNumFormat[r] = f[f.indexOf(regNumFormat[r] || 'hex') + 1];
    haltBreakpoint();
}

// TODO fix reg? seems to be used in const register below
function getLabel (addr: number, _reg?: number, raw?: boolean): string {
    let n = 'hex-font'; let x = 0;
    for (const k of Object.keys(emulator.metadata.labels)) {
        const v = emulator.metadata.labels[k];
        if (v > x && v <= addr) { n = k; x = v; }
    }
    if (raw) return n;
    return '(' + n + (x == addr ? '' : ` + ${addr - x}`) + ')';
}

function dumpRegisters (showV: boolean, name: string): string {
    // TODO if click function name passed in then set to onCLick?
    const line = (text: string, click?: string): string => '<span' + (click ? ' onClick="' + click + '"' : '') + '>' + text + '</span><br>';
    const register = (n: string, v: number, f: (addr: any, reg?: any, raw?: any) => string): string => line(n + ' := ' + numericFormat(v, regNumFormat[n || 'hex']) + ' ' + f(v, n), 'cycleNumFormat(\'' + n + '\')');
    const aliases = (_addr: number, reg: number[]): string => { // TODO fix addr?
        const a = emulator.metadata.aliases;
        const r = Number(`0x${reg.slice(1)}`);
        const n = Object.keys(a).filter((k: string): boolean => a[k] == r).join(', ');
        return n.length ? '(' + n + ')' : '';
    };
    return (
        line(`tick count: ${emulator.tickCounter}`) +
		line('breakpoint: ' + name) +
		register('pc', emulator.pc, getLabel) +
		register('i', emulator.i, getLabel) +
		(showV ? range(16).map((x: number): string => register('v' + x.toString(16).toUpperCase(), emulator.v[x], aliases)).join('') : '') +
		'<br>'
    );
}
function dumpStack (): string {
    return 'inferred stack trace:<br>' + emulator.r.map((x: number): string => hexFormat(x) + getLabel(x) + '<br>').join('') + '<br>';
}

function dumpContext (): string {
    const dbg = emulator.metadata.dbginfo;
    const pcline = dbg!.getLine(emulator.pc)!;
    let memlo = emulator.pc; let memhi = emulator.pc;
    while (dbg!.getLine(memlo - 1)! > pcline - 8) memlo--;
    while (dbg!.getLine(memhi + 1)! < pcline + 8) memhi++;
    let ind = memlo;
    const lines = [];
    for (let x = dbg!.getLine(memlo)!; x <= dbg!.getLine(memhi)!; x++) lines.push(x);
    const row = (c: boolean, a: string, d: string, s: string): string => '<tr' + (c ? ' class=\'current\'' : '') + '><td>' + a + '</td><td>' + d + '</td><td><pre>' + escapeHtml(s) + '</pre></td></tr>';
    const linebytes = (x: number): string => { let r = ''; while (dbg!.getLine(ind) == x) r += hexFormat(emulator.m[ind++]).slice(2) + ' '; return r; };
    return (
        'context:<br><table class=\'debug-context\'>' +
			row(false, 'addr', 'data', 'source') +
            lines.filter((x: number): boolean => !/^\s*$/u.exec(dbg!.lines[x]))
                .map((x: number): string => {
                    const here = dbg!.getLine(ind);
                    return row(
                        here == pcline,
                        here != x ? '' : hexFormat(ind).slice(2),
                        here != x ? '' : linebytes(x),
                        dbg!.lines[x]
                    );
                }).join('') +
		'</table>'
    );
}
function dumpProfile (): string {
    const profile = [];
    for (let addr = 0; addr < 65536;) {
        while (emulator.profileData[addr] == undefined && addr < 65536) addr++;
        if (addr > 65535) break;

        const head = addr; const label = getLabel(addr, 0, true);
        let ticks = 0;
        while (emulator.profileData[addr] != undefined && getLabel(addr, 0, true) == label) {
            ticks += emulator.profileData[addr];
            addr += 2;
        }
        if (addr > 65535) break;

        profile.push({
            ticks: ticks,
            percent: 100.0 * (ticks / emulator.tickCounter),
            calls: emulator.profileData[head],
            source: `${getLabel(head)} + ${addr - 2 - head}`
        });
    }
    return (
        '<table class=\'debug-profile\'><tr> <td>ticks</td> <td>time</td> <td>calls</td> <td>source</td> </tr>' +
            profile.sort((a, b): number => b.percent - a.percent).slice(0, 20)
                .map(
                    (x: {
                        ticks: number;
                        percent: number;
                        calls: number;
                        source: string;
                    }): string => `<tr><td>${x.ticks}</td> <td>${x.percent.toFixed(2)}%</td> <td>${x.calls}</td> <td>${x.source}</td></tr>`
                ).join('') +
		'</table>' +
		'<div class=\'debug-profile-results\'>' +
			'<div>Full results:<div>' +
			'<div class=\'debug-profile-full\'>' + JSON.stringify(profile) + '</div>' +
		'</div>'
    );
}

export function clearBreakpoint (): void {
    setVisible(runContinue, false);
    setVisible(debugPanel, false);
    emulator.breakpoint = false;
}

export function haltBreakpoint (name?: string): void {
    setVisible(runContinue, true, 'inline');
    setVisible(debugPanel, true);
    emulator.breakpoint = true;
    debugPanel!.innerHTML = dumpRegisters(true, name!) + dumpStack() + dumpContext();
}

export function haltProfiler (name: string): void {
    setVisible(runContinue, true, 'inline');
    setVisible(debugPanel, true);
    emulator.breakpoint = true;
    debugPanel!.innerHTML = dumpRegisters(false, name) + dumpProfile();
}
