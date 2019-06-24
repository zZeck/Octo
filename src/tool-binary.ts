import { compile, runRom, editor } from './index';
import { readBytes, writeBytes, setVisible, hexFormat, emulator, textBox, radioBar, Formats } from './util';
import { formatInstruction, analyzeInit, analyzeWork, analyzeFinish, formatProgram } from './decompiler';
import { buildCartridge, preparePayload } from './sharing';
import { saveAs } from 'file-saver';

/**
* Binary tools:
**/

const binaryInput = document.getElementById('fileinput') as HTMLInputElement;
const binaryEditor = textBox(document.getElementById('binary-editor')!, false, '')!;
const decompilerMode = radioBar(document.getElementById('decompiler-mode')!, 'static', (): void => {})!;// TODO unused x?
radioBar(document.getElementById('decompiler-numbers')!, Formats.hex, (x: Formats): void => {emulator.numericFormatStr = x;});

function decompileRaw (rom: number[]): void {
    let r = '\n: main\n';
    for (let x = 0; x < rom.length; x += 2) {
        const a = rom[x] | 0;
        const b = rom[x + 1] | 0;
        r += '\t' + hexFormat(a) + ' ' + hexFormat(b) + ' # ' + hexFormat(0x200 + x);
        r += '\t' + formatInstruction(a, b);
        r += '\n';
    }
    editor.setValue('# decompiled program:\n' + r);
}
function decompileStatic (rom: number[]): void {
    const decompileCover = document.getElementById('decompile-cover')!;
    setVisible(decompileCover, true, 'flex');
    analyzeInit(rom, {
        shiftQuirks: emulator.shiftQuirks,
        loadStoreQuirks: emulator.loadStoreQuirks,
        vfOrderQuirks: emulator.vfOrderQuirks,
        jumpQuirks: emulator.jumpQuirks
    });
    const process = (): void => {
        let finished = false;
        for (let z = 0; z < 100 && !finished; z++) { finished = analyzeWork(); }
        if (!finished) {
            window.setTimeout(process, 0);
            return;
        }
        analyzeFinish();
        setVisible(decompileCover, false);
        editor.setValue('# decompiled program:\n' + formatProgram(rom.length));
    };
    process();
}

/**
* UI Glue
**/

binaryInput.onchange = (): void => {
    const reader = new FileReader();
    reader.onload = (): void => writeBytes(binaryEditor, null, new Uint8Array(reader.result as ArrayBuffer));
    reader.readAsArrayBuffer(binaryInput.files![0]);
};
document.getElementById('binary-decompile')!.onclick = (): void => {
    (decompilerMode.getValue() == 'static' ? decompileStatic : decompileRaw)(readBytes(binaryEditor));
};
document.getElementById('binary-run')!.onclick = (): void => {
    runRom({ rom: readBytes(binaryEditor), breakpoints: {}, aliases: {}, labels: {} });
};
document.getElementById('binary-open')!.onclick = (): void => {
    binaryInput.click();
};
document.getElementById('binary-save-ch8')!.onclick = (): void => {
    const prog = compile();
    if (prog === null) { return; }//TODO strict null
    const name = (document.getElementById('binary-filename') as HTMLInputElement).value;
    saveAs(new Blob([new Uint8Array(prog.rom)], { type: 'application/octet-stream' }), name + '.ch8');
};
document.getElementById('binary-save-8o')!.onclick = (): void => {
    const name = (document.getElementById('binary-filename') as HTMLInputElement).value;
    saveAs(new Blob([editor.getValue()], { type: 'text/plain;charset=utf-8' }), name + '.8o');
};
document.getElementById('binary-save-cart')!.onclick = (): void => {
    const name = (document.getElementById('binary-filename') as HTMLInputElement).value;
    const label = name + '\n' + new Date().toISOString().replace('T', '\n');
    const cart = buildCartridge(label, preparePayload());
    saveAs(new Blob([new Uint8Array(cart)], { type: 'image/gif' }), name + '.gif');
};

writeBytes(binaryEditor, null, [0xD0, 0x15, 0x70, 0x04, 0x40, 0x40, 0x71, 0x05, 0x40, 0x40, 0x60, 0x00, 0x12, 0x00]);

export function updateBinary (): void {
    binaryEditor.refresh();
}
