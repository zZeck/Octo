import { Emulator, EmulatorOptions } from "./emulator";
import { setStatusMessage } from "./index";
import { Editor } from "codemirror";
import CodeMirror from "codemirror";


/**
* Misc. utility functions
**/

export const emulator = new Emulator()

export function range(x: number) { return Array.apply(undefined, Array(x)).map((_, i) => i) }
//TODO is this correct? sort of odd for zip type sig?
export function zip<T, U, V>(a: T[], b: U[], dyad: (x: T, y: U) => V): Array<V> { return a.map((x,i) => dyad(x, b[i])) }
export function mod(x: number, y: number) { x %= y; if (x < 0) x += y; return x }

export enum Formats {
  dec = 'dec',
  hex = 'hex',
  bin = 'bin',
  default = 'default'
}

type formatsToFunctions = {
  [key in Formats]: (n: number) => string
}

const FORMATS: formatsToFunctions = { dec:decimalFormat, hex:hexFormat, bin:binaryFormat, default:hexFormat }
function zeroPad(str: string, n: number) { const d = str.length % n; return (d == 0 ? '' : '00000000'.substr(0, n - d)) + str }
function decimalFormat(n: number)         { return n.toString(10) }
export function hexFormat    (n: number)         { return '0x' + zeroPad(n.toString(16).toUpperCase(), 2) }
function binaryFormat (n: number)         { return '0b' + zeroPad(n.toString(2), 8) }
export function maskFormat   (n: number)         { return emulator.maskFormatOverride ? binaryFormat(n) : numericFormat(n) }
export function numericFormat(n: number, format?: Formats) { return (FORMATS[format||emulator.numericFormatStr])(n) }

export interface Payload {
  key: string | null;
  program: string;
  options: EmulatorOptions;
}

export function ajax(method: string, url: string, payload: Payload | null, then: (result: any, s?: any) => void) {
  const x = new XMLHttpRequest()
  x.open(method, url)
  x.onreadystatechange = () => {
    if (x.readyState != 4) return
    if (method == 'GET' && x.status != 200) {
      setStatusMessage('Unable to retrieve <tt>' + url +'</tt>', false)
      return
    }
    then(JSON.parse(x.responseText), x.status)
  }
  x.send(payload ? JSON.stringify(payload) : null)
}

export function readBytes(source: Editor, size?: number) {
  const tokens = source.getValue().trim().split(/\s+/)
  return zip(range(size! || tokens.length), tokens, (_: number, x) => {
    return ((x||'').slice(0,2)=='0b' ? parseInt(x.slice(2),2) : +x)||0
  })
}
export function writeBytes(target: Editor, size: number | null, bytes: ArrayBuffer | number[]) {//TODO is ArrayBuffer | number[] correct?
  target.setValue(zip(range(size || (bytes as number[]).length), (bytes as number[]), (_: number, x: number) => hexFormat(x & 0xFF)).join(' '))
}
export function getBit(bytes: Array<number>, n: number) {
  return (bytes[Math.floor(n / 8)] >> (7-Math.floor(n % 8))) & 1
}
export function setBit(bytes: number[], n: number, v: boolean | number) {
  const mask = 128 >> Math.floor(n % 8)
  bytes[Math.floor(n / 8)] = (bytes[Math.floor(n / 8)] & ~mask) | (mask * Number(v))//TODO fix boolean option?
}
export function drawOnCanvas(target: HTMLCanvasElement, body: (x: number, y: number, draw: boolean) => void) {
  var mode = 0
  function drag(event: MouseEvent) {
    if (mode == 0) { return }
    const r = target.getBoundingClientRect()
    body(
      event.clientX - r.left,
      event.clientY - r.top,
      mode == 1
    )
  }
  function release(event: MouseEvent) { mode = 0; drag(event) }
  function press  (event: MouseEvent) { mode = event.button == 2 ? 2 : 1; drag(event) }
  function context(event: MouseEvent) { drag(event); return false }
  target.onmousemove   = drag
  target.onmouseup     = release
  target.onmouseout    = release
  target.onmousedown   = press
  target.oncontextmenu = context
}

export function setVisible(element: HTMLElement, value: boolean, disp?: string) {
  element.style.display = value ? disp || (element.tagName == 'SPAN' ? 'inline' : 'block') : 'none'
}

//TODO makey parametric polymorphic so value and change T types are connected?
// or perhaps use overloads if mapping is not like that?
export function radioBar<T extends string | number>(element: HTMLElement, value: T, change: (x: T) => void) {
  element.classList.add('radiobar')
  const get = () => element.querySelector<HTMLElement>('span.selected')!.dataset.value
  const set = (v: T) => (element.querySelectorAll('span').forEach(x => {
    x.classList.toggle('selected', x.dataset.value == v)
  }), v)
  const vis = (x: boolean) => element.style.display = x ? 'flex' : 'none'
  element.querySelectorAll('span').forEach(x => x.onclick = () => change(set(x.dataset.value as T)))
  set(value)
  return { getValue: get, setValue: set, setVisible: vis }
}

export function checkBox(element: HTMLElement, value: boolean, change: (x: boolean) => void) {
  element.classList.add('checkbox')
  const c = document.createElement('span')
  c.classList.add('check')
  element.prepend(c)
  const get = () => c.classList.contains('selected')
  const set = (x: boolean) => (c.classList.toggle('selected', x), x)
  c.onclick = () => change(set(!get()))
  set(value)
  return { getValue: get, setValue: set }
}

export function toggleButton(element: HTMLElement, value: boolean, change: (x: boolean) => void) {
  const get = () => element.classList.contains('selected')
  const set = (x: boolean) => (element.classList.toggle('selected', x), x)
  element.onclick = () => change(set(!get()))
  set(value)
  return { getValue: get, setVisible: set }
}

export function menuChooser(element: HTMLElement, value: number, change: (x: number) => void) {
  const get = () => element.querySelector<HTMLElement>('li.selected')!.dataset.value
  const set = (v: number) => (element.querySelectorAll('li').forEach(x => {
    x.classList.toggle('selected', x.dataset.value == String(v)) //TODO correct cast?
  }), v)
  element.querySelectorAll('li')!.forEach(x => x.onclick = () => change(set(Number(x.dataset.value!)))) //TODO correct cast?
  set(value)
  return { getValue: get, setValue: set }
}

export function textBox(element: HTMLElement, readonly: boolean, value: string) {
  return CodeMirror(element, {
    mode:         'none',
    readOnly:     readonly,
    theme:        'monokai',
    lineNumbers:  false,
    lineWrapping: true,
    value:        value,
  })
}
