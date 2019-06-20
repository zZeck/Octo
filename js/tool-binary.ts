import { compile, runRom, editor } from "./htmlcode";
import { readBytes, writeBytes, setVisible, hexFormat, emulator, textBox, radioBar, Formats } from "./util";
import { formatInstruction, analyzeInit, analyzeWork, analyzeFinish, formatProgram } from "./decompiler";
import { buildCartridge, preparePayload } from "./sharing";

/**
* Binary tools:
**/

const binaryInput    = document.getElementById('fileinput') as HTMLInputElement
const binaryEditor   = textBox(document.getElementById('binary-editor')!, false, '')!
const decompilerMode = radioBar(document.getElementById('decompiler-mode')!, 'static', (x: never) => {})!
radioBar(document.getElementById('decompiler-numbers')!, 'hex', (x: Formats) => emulator.numericFormatStr = x)!

function decompileRaw(rom: number[]) {
	var r = '\n: main\n'
	for(var x = 0; x < rom.length; x += 2) {
		var a = rom[x  ] | 0
		var b = rom[x+1] | 0
		r += '\t' + hexFormat(a) + ' ' + hexFormat(b) + ' # ' + hexFormat(0x200 + x)
		r += '\t' + formatInstruction(a, b)
		r += '\n'
	}
	editor.setValue('# decompiled program:\n' + r)
}
function decompileStatic(rom: number[]) {
	const decompileCover = document.getElementById('decompile-cover')
	setVisible(decompileCover, true, 'flex')
	analyzeInit(rom, {
		shiftQuirks:     emulator.shiftQuirks,
		loadStoreQuirks: emulator.loadStoreQuirks,
		vfOrderQuirks:   emulator.vfOrderQuirks,
		jumpQuirks:      emulator.jumpQuirks,
	})
	const process = () => {
		var finished = false;
		for(var z = 0; z < 100 && !finished; z++) { finished || analyzeWork() } //TODO |= replaced with ||
		if (!finished) {
			window.setTimeout(process, 0)
			return
		}
		analyzeFinish()
		setVisible(decompileCover, false)
		editor.setValue('# decompiled program:\n' + formatProgram(rom.length))
	}
	process()
}

/**
* UI Glue
**/

binaryInput.onchange = () => {
	const reader = new FileReader()
	reader.onload = () => writeBytes(binaryEditor, null, new Uint8Array(reader.result as ArrayBuffer))
	reader.readAsArrayBuffer(binaryInput.files![0])
}
document.getElementById('binary-decompile')!.onclick = () => {
	(decompilerMode.getValue() == 'static' ? decompileStatic : decompileRaw)(readBytes(binaryEditor))
}
document.getElementById('binary-run')!.onclick = () => {
	runRom({ rom:readBytes(binaryEditor), breakpoints:{}, aliases:{}, labels:{} })
}
document.getElementById('binary-open')!.onclick = () => {
	binaryInput.click()
}
document.getElementById('binary-save-ch8')!.onclick = () => {
	var prog = compile()
	if (prog == null) { return }
	const name = (document.getElementById('binary-filename') as HTMLInputElement).value
	saveAs(new Blob([new Uint8Array(prog.rom)], {type: 'application/octet-stream'}), name+'.ch8')
}
document.getElementById('binary-save-8o')!.onclick = () => {
	const name = (document.getElementById('binary-filename') as HTMLInputElement).value
	saveAs(new Blob([editor.getValue()], {type: 'text/plain;charset=utf-8'}), name+'.8o')
}
document.getElementById('binary-save-cart')!.onclick = () => {
	const name  = (document.getElementById('binary-filename') as HTMLInputElement).value
	const label = name + '\n' + (new Date().toISOString().replace('T','\n'))
	const cart  = buildCartridge(label, preparePayload())
	saveAs(new Blob([new Uint8Array(cart)], {type: 'image/gif'}), name+'.gif')
}

writeBytes(binaryEditor, null, [0xD0, 0x15, 0x70, 0x04, 0x40, 0x40, 0x71, 0x05, 0x40, 0x40, 0x60, 0x00, 0x12, 0x00])

export function updateBinary() {
	binaryEditor.refresh()
}
