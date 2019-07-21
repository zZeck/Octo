import { Emulator, EmulatorOptions } from "./emulator";
import { setStatusMessage } from "./index";
import CodeMirror, { Editor } from "codemirror";

/**
 * Misc. utility functions
 **/

export const emulator = new Emulator();

export function range(x: number): number[] {
  return Array(...Array(x)).map((_, i): number => i);
}
// TODO is this correct? sort of odd for zip type sig?
export function zip<T, U, V>(a: T[], b: U[], dyad: (x: T, y: U) => V): V[] {
  return a.map((x, i): V => dyad(x, b[i]));
}
export function mod(x: number, y: number): number {
  let modValue = x;
  modValue %= y;
  if (modValue < 0) modValue += y;
  return modValue;
}

export const enum Formats {
  dec = "dec",
  hex = "hex",
  bin = "bin",
  default = "default"
}

type formatsToFunctions = {
  [key in Formats]: (n: number) => string;
};

function zeroPad(str: string, n: number): string {
  const d = str.length % n;
  return (d == 0 ? "" : "00000000".substr(0, n - d)) + str;
}
function decimalFormat(n: number): string {
  return n.toString(10);
}
export function hexFormat(n: number): string {
  return "0x" + zeroPad(n.toString(16).toUpperCase(), 2);
}
function binaryFormat(n: number): string {
  return "0b" + zeroPad(n.toString(2), 8);
}
const FORMATS: formatsToFunctions = {
  dec: decimalFormat,
  hex: hexFormat,
  bin: binaryFormat,
  default: hexFormat
};
export function numericFormat(n: number, format?: Formats): string {
  return FORMATS[format || emulator.numericFormatStr](n);
}
export function maskFormat(n: number): string {
  return emulator.maskFormatOverride ? binaryFormat(n) : numericFormat(n);
}

export interface Payload {
  key: string | null;
  program: string;
  options: EmulatorOptions;
}

export function ajax<T>(
  method: string,
  url: string,
  payload: Payload | null,
  then: (result: T, s?: number) => void
): void {
  const x = new XMLHttpRequest();
  x.open(method, url);
  x.onreadystatechange = (): void => {
    if (x.readyState != 4) return;
    if (method == "GET" && x.status != 200) {
      setStatusMessage("Unable to retrieve <tt>" + url + "</tt>", false);
      return;
    }
    then(JSON.parse(x.responseText), x.status);
  };
  x.send(payload ? JSON.stringify(payload) : null);
}

export function readBytes(source: Editor, size?: number): number[] {
  const tokens = source
    .getValue()
    .trim()
    .split(/\s+/u);
  return zip(range(size! || tokens.length), tokens, (_: number, x): number => {
    return (
      ((x || "").startsWith("0b") ? parseInt(x.slice(2), 2) : Number(x)) || 0
    );
  });
}
export function writeBytes(
  target: Editor,
  size: number | null,
  bytes: ArrayBuffer | number[]
): void {
  // TODO is ArrayBuffer | number[] correct?
  target.setValue(
    zip(
      range(size || (bytes as number[]).length),
      bytes as number[],
      (_: number, x: number): string => hexFormat(x & 0xff)
    ).join(" ")
  );
}
export function getBit(bytes: number[], n: number): number {
  return (bytes[Math.floor(n / 8)] >> (7 - Math.floor(n % 8))) & 1;
}
export function setBit(bytes: number[], n: number, v: boolean | number): void {
  const mask = 128 >> Math.floor(n % 8);
  bytes[Math.floor(n / 8)] =
    (bytes[Math.floor(n / 8)] & ~mask) | (mask * Number(v)); // TODO fix boolean option?
}
export function drawOnCanvas(
  target: HTMLCanvasElement,
  body: (x: number, y: number, draw: boolean) => void
): void {
  let mode = 0;
  function drag(event: MouseEvent): void {
    if (mode == 0) {
      return;
    }
    const r = target.getBoundingClientRect();
    body(event.clientX - r.left, event.clientY - r.top, mode == 1);
  }
  function release(event: MouseEvent): void {
    mode = 0;
    drag(event);
  }
  function press(event: MouseEvent): void {
    mode = event.button == 2 ? 2 : 1;
    drag(event);
  }
  function context(event: MouseEvent): boolean {
    drag(event);
    return false;
  }
  target.onmousemove = drag;
  target.onmouseup = release;
  target.onmouseout = release;
  target.onmousedown = press;
  target.oncontextmenu = context;
}

export function setVisible(
  element: HTMLElement,
  value: boolean,
  disp?: string
): void {
  element.style.display = value
    ? disp || (element.tagName == "SPAN" ? "inline" : "block")
    : "none";
}

// TODO makey parametric polymorphic so value and change T types are connected?
// or perhaps use overloads if mapping is not like that?
export function radioBar<T extends string | number>(
  element: HTMLElement,
  value: T,
  change: (x: T) => void
): {
  getValue: () => string | undefined;
  setValue: (v: T) => T;
  setVisible: (x: boolean) => void;
} {
  element.classList.add("radiobar");
  const get = (): string | undefined =>
    element.querySelector<HTMLElement>("span.selected")!.dataset.value;
  const set = (v: T): T => {
    element.querySelectorAll("span").forEach((x: HTMLSpanElement): void => {
      x.classList.toggle("selected", x.dataset.value == v);
    });
    return v;
  };
  const vis = (x: boolean): void => {
    element.style.display = x ? "flex" : "none";
  };
  element.querySelectorAll("span").forEach((x): void => {
    x.onclick = (): void => {
      change(set(x.dataset.value as T));
    };
  });
  set(value);
  return { getValue: get, setValue: set, setVisible: vis };
}

export function checkBox(
  element: HTMLElement,
  value: boolean,
  change: (x: boolean) => void
): {
  getValue: () => boolean;
  setValue: (x: boolean) => boolean;
} {
  element.classList.add("checkbox");
  const c = document.createElement("span");
  c.classList.add("check");
  element.prepend(c);
  const get = (): boolean => c.classList.contains("selected");
  const set = (x: boolean): boolean => {
    c.classList.toggle("selected", x);
    return x;
  };
  c.onclick = (): void => change(set(!get()));
  set(value);
  return { getValue: get, setValue: set };
}

export function toggleButton(
  element: HTMLElement,
  value: boolean,
  change: (x: boolean) => void
): {
  getValue: () => boolean;
  setVisible: (x: boolean) => boolean;
} {
  const get = (): boolean => element.classList.contains("selected");
  const set = (x: boolean): boolean => {
    element.classList.toggle("selected", x);
    return x;
  };
  element.onclick = (): void => change(set(!get()));
  set(value);
  return { getValue: get, setVisible: set };
}

export function menuChooser(
  element: HTMLElement,
  value: number,
  change: (x: number) => void
): {
  getValue: () => string | undefined;
  setValue: (v: number) => number;
} {
  const get = (): string | undefined =>
    element.querySelector<HTMLElement>("li.selected")!.dataset.value;
  const set = (v: number): number => {
    element.querySelectorAll("li").forEach((x: HTMLLIElement): void => {
      x.classList.toggle("selected", x.dataset.value == String(v)); // TODO correct cast?
    });
    return v;
  }; //TODO ), v) here originally. Mistake?
  element.querySelectorAll("li")!.forEach((x): void => {
    x.onclick = (): void => {
      change(set(Number(x.dataset.value!)));
    };
  }); // TODO correct cast?
  set(value);
  return { getValue: get, setValue: set };
}

export function textBox(
  element: HTMLElement,
  readonly: boolean,
  value: string
): CodeMirror.Editor {
  return CodeMirror(element, {
    mode: "none",
    readOnly: readonly,
    theme: "monokai",
    lineNumbers: false,
    lineWrapping: true,
    value: value
  });
}
