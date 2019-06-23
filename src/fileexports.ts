import { compile } from './index';

/// /////////////////////////////////
//
//   .ch8 file export:
//
/// /////////////////////////////////

// TODO is this used?
export function saveBinaryFile (): void {
    // Compile given Octo source and check for error
    const prog = compile();
    if (prog === null) {
        return;
    }

    // ROM data must be saved as an array of unsigned 8-bit integers. Calling
    // saveAs on a Blob of a non-TypedArray object will only write text data to
    // the file.
    const rawData = new Uint8Array(prog.rom);
    const blob = new Blob([rawData], { type: 'application/octet-stream' });
    saveAs(blob, 'output.ch8');
}

/// /////////////////////////////////
//
//   .8o source code export:
//
/// /////////////////////////////////
// TODO is this used?
export function saveSourceFile (): void {
    const input = document.getElementById('input') as HTMLInputElement;
    const blob = new Blob([input.value], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, 'source.8o');
}
