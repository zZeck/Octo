import { setVisible, textBox, emulator, menuChooser, writeBytes, range } from "./util";
import { share, parseCartridge, runPayload, openPayload, saveLocalProgram, saveLocalOptions } from "./sharing";
import { clearBreakpoint, haltBreakpoint, haltProfiler } from "./debugger";
import { keymapInverse, keymap, RomData } from "./emulator";
import { renderDisplay, playPattern, audioSetup, setRenderTarget, stopAudio } from "./shared";
import { Compiler, DebugInfo } from "./compiler";
import { recordFrame } from "./recording";
import { updateSpriteEditor } from "./tool-sprite";
import { updateAudio } from "./tool-audio";
import { updateBinary } from "./tool-binary";
import { updateColor } from "./tool-color";
import { updateOptions } from "./tool-options";
import { Editor, Doc } from "codemirror";
import CodeMirror from "codemirror";

var html = require("../docs/Manual.md");
var container = document.getElementById("manual")!;

container.innerHTML = html;

export const editor: Editor & Doc = CodeMirror(document.getElementById('editor')!, {
  mode:           'octo',
  theme:          'monokai',
  lineNumbers:    true,
  smartIndent:    false,
  tabSize:        2,
  indentWithTabs: false,
  dragDrop:       false,
  value:          'loading...',
  gutters:        ['breakpoints', 'CodeMirror-linenumbers'],
  extraKeys: {
    'Shift-Enter': () => document.getElementById('main-run')!.click(),
  },
}) as Editor & Doc; //TODO is this correct?

editor.on('change', () => saveLocalProgram())
editor.on('gutterClick', function(cm, n) {
  function makeMarker() {
    const marker = document.createElement('div')
    marker.classList.add('breakpoint')
    marker.dataset.line = String(n)
    marker.innerHTML = '●'
    return marker
  }
  const info = cm.lineInfo(n)
  cm.setGutterMarker(n, 'breakpoints', info.gutterMarkers ? null : makeMarker())
})

function getVisualBreakpoints(debuginfo: DebugInfo) {
  const r: {[address: number]: string} = {}
  document.querySelectorAll<HTMLElement>('#editor .breakpoint').forEach((x) => {
    const line = +(x.dataset.line!)
    const addr = debuginfo.getAddr(line)
    if (addr) { r[addr] = 'source line ' + (line+1) }
  })
  return r
}

const expandOut   = document.getElementById('expand-out')!
const outputPanel = document.getElementById('output')!
const output      = textBox(document.getElementById('output')!, true, 'no output')
const statusBar   = document.getElementById('status')!
const statusText  = document.getElementById('status-text')!

function toggleOutput() {
  const v = outputPanel.style.display == 'block'
  setVisible(outputPanel, !v)
  setVisible(expandOut, v)
  output.refresh()
}
document.getElementById('output-header')!.onclick = toggleOutput
document.getElementById('status'       )!.onclick = toggleOutput

export function setStatusMessage(message: string, ok?: boolean) {
  statusBar.style.backgroundColor = ok ? 'black' : 'darkred'
  statusText.innerHTML = message
}

enum panelTypes {
  sprite = 'sprite',
  audio = 'audio',
  binary = 'binary',
  color = 'color',
  options = 'options'
}
function accordion(initial: string) {
  var current: string | null = null
  function open(panel: string) {
    current = panel as panelTypes
    document.querySelectorAll<HTMLElement>('.tool-body').forEach(x => {
      x.classList.toggle('selected', x.dataset.panel == panel)
    })
    const tools: {[key: string]: () => void} = {
      sprite:  updateSpriteEditor,
      audio:   updateAudio,
      binary:  updateBinary,
      color:   updateColor,
      options: updateOptions,
    }
    tools[panel]()
  }
  document.querySelectorAll<HTMLElement>('.tool-header').forEach(x => x.onclick = () => open(x.dataset.panel!))
  open(initial)
  return { setValue: open, update: () => open(current!) }
}
const toolboxAccordion = accordion('sprite')

const mainInput   = document.getElementById('maininput') as HTMLInputElement
const manual      = document.getElementById('manual')!
const toolbox     = document.getElementById('toolbox')!
const showToolbox = document.getElementById('show-toolbox')!
const showManual  = document.getElementById('show-manual')!
export const speedMenu   = menuChooser(document.getElementById('main-speed')!, emulator.tickrate, (x: number) => {
  emulator.tickrate = +x
  saveLocalOptions()
})

document.getElementById('main-run')!.onclick = () => runRom(compile()!)
document.getElementById('main-open')!.onclick = () => mainInput.click()
document.getElementById('main-save')!.onclick = () => share()

const dragon = document.getElementById('dragon')!
document.body.ondragover = () => setVisible(dragon, true, 'flex')
dragon.ondragleave       = () => setVisible(dragon, false)
dragon.ondragover        = () => event!.preventDefault()
dragon.ondrop = event => {
  setVisible(dragon, false)
  event.preventDefault()
  if (event.dataTransfer!.items && event.dataTransfer!.items[0].kind === 'file') {
    openFile(event.dataTransfer!.items[0].getAsFile()!, true)
  }
}

function openFile(file: File, runCart: boolean) {
  const reader = new FileReader()
  if (file.type == 'image/gif') {
    reader.onload = () => {
      try {
        const payload = parseCartridge(new Uint8Array(reader.result as ArrayBuffer))
        if (runCart) runPayload (payload.options, payload.program)
        else         openPayload(payload.options, payload.program)
      }
      catch(error) {
        setStatusMessage('Unable to read cartridge.')
        console.log(error)
      }
    }
    reader.readAsArrayBuffer(file)
  }
  else {
    reader.onload = () => editor.setValue(reader.result as string)
    reader.readAsText(file)
  }
}

mainInput.onchange = () => openFile(mainInput.files![0], false)
showToolbox.onclick = () => {
  showToolbox.classList.toggle('selected')
  setVisible(toolbox, showToolbox.classList.contains('selected'), 'flex')
  toolboxAccordion.update()
}
showManual.onclick = () => {
  showManual.classList.toggle('selected')
  setVisible(manual, showManual.classList.contains('selected'), 'flex')
}

/**
* Run mode:
**/

document.getElementById('run-close'   )!.onclick = () => stopRom()
document.getElementById('run-continue')!.onclick = () => clearBreakpoint()
document.getElementById('run-keypad'  )!.onclick = () => {
  document.getElementById('run-keys')!.classList.toggle('invisible')
}

if (window.innerWidth < window.innerHeight) {
  // make a guess that portrait-mode windows are mobile devices.
  // in this situation, the virtual keypad should be visible by default:
  document.getElementById('run-keys')!.classList.remove('invisible')
}

function getVirtualKey(k: number) { return document.getElementById('0x' + k.toString(16).toUpperCase())! }
function setVirtualKey(k: number, v: boolean) { if (k) getVirtualKey(k).classList.toggle('active', v) }

window.onkeydown = event => {
  if (emulator.halted) return
  if (!(event.keyCode in emulator.keys)) {
    emulator.keys[event.keyCode] = true
    setVirtualKey(keymapInverse[event.keyCode], true)
  }
  event.preventDefault()
}

window.onkeyup = event => {
  if (emulator.halted) return
  if (event.keyCode in emulator.keys) {
    delete emulator.keys[event.keyCode]
    setVirtualKey(keymapInverse[event.keyCode], false)
  }
  const kindex = keymap.indexOf(event.keyCode)
  if (emulator.waiting && kindex >= 0) {
    emulator.waiting = false
    emulator.v[emulator.waitReg] = kindex
  }
  if (event.key == '`') { stopRom() }
  if (event.key == 'i') { emulator.breakpoint ? clearBreakpoint() : haltBreakpoint('user interrupt') }
  if (event.key == 'p') { haltProfiler('profiler') }
  if (emulator.breakpoint) {
    if (event.key == 'o') { emulator.tick(); renderDisplay(emulator); haltBreakpoint('single step') }
    if (event.key == 'u') { const l = emulator.r.length; if (l>0) { emulator.stack_breakpoint = l-1; clearBreakpoint() } } // step out
    if (event.key == 'l') {
      if ((emulator.m[emulator.pc] & 0xF0) == 0x20) { const l = emulator.r.length; if (l >= 0) { emulator.stack_breakpoint = l; clearBreakpoint(); } }
      else { emulator.tick(); renderDisplay(emulator); haltBreakpoint('stepping over') }
    }
  }
  event.preventDefault()
}

range(16).forEach(k => {
  const m    = keymap[k]
  const fake = { keyCode: m, preventDefault: () =>{} }
  const dn   = () => window.onkeydown!(fake as KeyboardEvent)
  const up   = () => { if (m in emulator.keys) window.onkeyup!(fake as KeyboardEvent) }
  const b    = getVirtualKey(k)
  b.onmousedown  = dn
  b.onmouseup    = up
  b.onmouseout   = up
  b.ontouchstart = dn
  //b.ontouchenter = up //TODO these were removed by W3C https://stackoverflow.com/questions/23111671/touchenter-and-touchleave-events-support
  //b.ontouchleave = up
})

/**
* Central Dogma:
**/

export function compile(): RomData | null {
  const c = new Compiler(editor.getValue())
  try {
    output.setValue('no output')
    c.go()
    writeBytes(output, null, c.rom)
    const maxRom = emulator.maxSize
    if (c.rom.length > maxRom) {
      throw 'Rom is too large- ' + (c.rom.length-maxRom) + ' bytes over!'
    }
    setStatusMessage(
      (c.rom.length + ' bytes, ' + (maxRom-c.rom.length) + ' free.') +
      (c.schip ? ' (SuperChip instructions used)' : '') +
      (c.xo    ? ' (XO-Chip instructions used)'   : ''),
      true
    )
  }
  catch (error) {
    if (c.pos != null) {
      var line = 1, ch = 0, text = editor.getValue()
      for(var x = 0; x < (c.pos[1] as number) -1; x++) {
        if (text[x] == '\n') { line++; ch = 0 }
        else { ch++ }
      }
      error = 'line '+line+': '+error
      editor.setSelection(
        {line:line-1, ch:ch},
        {line:line-1, ch:ch + ((c.pos[2] as number)-1-x)},
      )
    }
    setStatusMessage(error, false)
    return null
  }
  const visualBreakpoints = getVisualBreakpoints(c.dbginfo)
  for (var k in visualBreakpoints) { c.breakpoints[k] = visualBreakpoints[k] }
  return {
    rom:         c.rom,
    breakpoints: c.breakpoints,
    dbginfo:     c.dbginfo,
    aliases:     c.aliases,
    labels:      c.dict,
  }
}

const runCover = document.getElementById('run-cover')!
var intervalHandle: number | null = null


export function runRom(rom: RomData) {
  if (rom === null) return
  if (intervalHandle != null) stopRom()
  emulator.exitVector = stopRom
  emulator.importFlags = () => JSON.parse(localStorage.getItem('octoFlagRegisters')!)
  emulator.exportFlags = f => localStorage.setItem('octoFlagRegisters', JSON.stringify(f))
  emulator.buzzTrigger = (ticks, remainingTicks) => playPattern(ticks, emulator.pattern, remainingTicks)
  emulator.init(rom)
  clearBreakpoint()
  audioSetup()
  setVisible(runCover, true, 'flex')
  runCover.style.backgroundColor = emulator.quietColor
  setRenderTarget(5, 'target')
  intervalHandle = setInterval(() => {
    for(var z = 0; (z < emulator.tickrate) && (!emulator.waiting); z++) {
      if (!emulator.breakpoint) {
        if (emulator.vBlankQuirks && ((emulator.m[emulator.pc] & 0xF0) == 0xD0)) { z = emulator.tickrate }
        emulator.tick()
        if (emulator.pc in emulator.metadata.breakpoints) { haltBreakpoint(emulator.metadata.breakpoints[emulator.pc]) }
        if (emulator.r.length == emulator.stack_breakpoint) { emulator.stack_breakpoint = -1; haltBreakpoint('step out') }
      }
    }
    if (!emulator.breakpoint) {
      emulator.dt -= emulator.dt > 0 ? 1 : 0
      emulator.st -= emulator.st > 0 ? 1 : 0
    }
    recordFrame()
    renderDisplay(emulator)
    if (emulator.halted) return
    runCover.style.backgroundColor = (emulator.st > 0) ? emulator.buzzColor : emulator.quietColor
  }, 1000/60) as unknown as number //TODO fix to be Timeout type?
}

function stopRom() {
  emulator.halted = true
  setVisible(runCover, false)
  window.clearInterval(intervalHandle!)
  intervalHandle = null
  clearBreakpoint()
  stopAudio()
}