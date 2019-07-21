import { zip, radioBar, emulator } from "./util";
import { saveLocalOptions } from "./sharing";

/**
 * Color settings:
 **/

const paletteKeys = [
  "backgroundColor",
  "fillColor",
  "fillColor2",
  "blendColor",
  "buzzColor",
  "quietColor",
  "none" // TODO this correct? used by updateColor
];
// TODO type better
const palettes: PalleteDefinitions & { [key: string]: string[] } = {
  octo: ["#996600", "#FFCC00", "#FF6600", "#662200", "#FFAA00", "#000000"],
  lcd: ["#0F380F", "#306230", "#8BAC0F", "#9BBC0F", "#333333", "#000000"],
  hotdog: ["#000000", "#FF0000", "#FFFF00", "#FFFFFF", "#990000", "#330000"],
  gray: ["#AAAAAA", "#000000", "#FFFFFF", "#666666", "#666666", "#000000"],
  cga0: ["#000000", "#00FF00", "#FF0000", "#FFFF00", "#999900", "#333300"],
  cga1: ["#000000", "#FF00FF", "#00FFFF", "#FFFFFF", "#990099", "#330033"]
};

type PalleteDefinitions = {
  [key in PaletteFlags]: string[];
};

enum PaletteFlags {
  octo = "octo",
  lcd = "lcd",
  hotdog = "hotdog",
  gray = "gray",
  cga0 = "cga0",
  cga1 = "cga1"
}

// must use specify type parameter as PaletteFlags so more narrow string literal type of PaletteFlags.octo is not infered
// TODO fix none hack for updateColor use of setValue
const palettePresets = radioBar<PaletteFlags | "none">(
  document.getElementById("palette-presets")!,
  PaletteFlags.octo,
  (x: PaletteFlags | "none"): void => {
    zip(paletteKeys, palettes[x], (a: string, b: string): void => {
      emulator[a] = b;
    }); //TODO zip that is not assigned?
    saveLocalOptions();
    updateColor();
  }
);

document
  .querySelectorAll<HTMLInputElement>("#color-table tr input")
  .forEach((input, i): void => {
    function update(): void {
      emulator[paletteKeys[i]] = input.value;
      saveLocalOptions();
      updateColor();
    }
    input.onkeyup = update;
    input.onchange = update;
  });

export function updateColor(): void {
  document.querySelectorAll("#color-table tr").forEach((row, i): void => {
    const v = emulator[paletteKeys[i]];
    row.querySelector<HTMLElement>(".swatch")!.style.background = v;
    row.querySelector("input")!.value = v;
  });
  palettePresets.setValue("none");
  for (const key in palettes) {
    if (paletteKeys.every((x, i): boolean => emulator[x] == palettes[key][i]))
      palettePresets.setValue(key as PaletteFlags); // TODO infer better type for key?
  }
}
