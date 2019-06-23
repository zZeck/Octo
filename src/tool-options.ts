import { radioBar, checkBox, emulator } from './util';
import { saveLocalOptions } from './sharing';

/**
* Options
**/

enum CompatibilityProfileFlags {
    chip8 = 'chip8',
    schip = 'schip',
    octo = 'octo',
    xo = 'xo'
}

// TODO fix | 'none' hack?
const compatProfile = radioBar<CompatibilityProfileFlags | 'none'>(document.getElementById('compatibility-profile')!, CompatibilityProfileFlags.octo, setCompatibilityProfile);
const screenRotation = radioBar<number>(document.getElementById('screen-rotation')!, 0, (x: number) => emulator.screenRotation = Number(x));

type CompatibilityProfiles = {
    [key in CompatibilityProfileFlags]: CompatibilityProfile;
};

type CompatibilityProfile = {
    [key in CampatibilityFlags]: number
};

const compatibilityProfiles: CompatibilityProfiles = {
    chip8: { shiftQuirks: 0, loadStoreQuirks: 0, vfOrderQuirks: 0, clipQuirks: 1, jumpQuirks: 0, vBlankQuirks: 1, maxSize: 3215 },
    schip: { shiftQuirks: 1, loadStoreQuirks: 1, vfOrderQuirks: 0, clipQuirks: 1, jumpQuirks: 1, vBlankQuirks: 0, maxSize: 3583 },
    octo: { shiftQuirks: 0, loadStoreQuirks: 0, vfOrderQuirks: 0, clipQuirks: 0, jumpQuirks: 0, vBlankQuirks: 0, maxSize: 3584 },
    xo: { shiftQuirks: 0, loadStoreQuirks: 0, vfOrderQuirks: 0, clipQuirks: 0, jumpQuirks: 0, vBlankQuirks: 0, maxSize: 65024 }
};

enum CampatibilityFlags {
    shiftQuirks = 'shiftQuirks',
    loadStoreQuirks = 'loadStoreQuirks',
    vfOrderQuirks = 'vfOrderQuirks',
    clipQuirks = 'clipQuirks',
    jumpQuirks = 'jumpQuirks',
    vBlankQuirks = 'vBlankQuirks',
    maxSize = 'maxSize',
}

type flagFunctions = {
    [key in CampatibilityFlags]: key extends CampatibilityFlags.maxSize ? {
        getValue: () => string | undefined;
        setValue: (v: number) => number;
        setVisible: (x: boolean) => 'flex' | 'none';
    } : GetSetValue
};

interface GetSetValue {
    getValue: () => boolean;
    setValue: (x: any) => any;
}
// TODO put these property strings into enum, use to create this type and the CompatibilityProfile type
const compatibilityFlags: flagFunctions = {
    shiftQuirks: checkBox(document.getElementById('compat-shift')!, false, setOptions),
    loadStoreQuirks: checkBox(document.getElementById('compat-load')!, false, setOptions),
    vfOrderQuirks: checkBox(document.getElementById('compat-vf')!, false, setOptions),
    clipQuirks: checkBox(document.getElementById('compat-clip')!, false, setOptions),
    jumpQuirks: checkBox(document.getElementById('compat-jump0')!, false, setOptions),
    vBlankQuirks: checkBox(document.getElementById('compat-vblank')!, false, setOptions),
    maxSize: radioBar<number>(document.getElementById('max-size')!, 3584, setOptions)
};

function setCompatibilityProfile (x: CompatibilityProfileFlags | 'none'): void {
    const p = compatibilityProfiles[x as CompatibilityProfileFlags];
    for (const key in compatibilityFlags) emulator[key] = p[key as CampatibilityFlags];
    saveLocalOptions();
    updateOptions();
}
// TODO edited loops to be const key. correct?
function setOptions (): void {
    for (const key in compatibilityFlags) emulator[key] = compatibilityFlags[key as CampatibilityFlags].getValue();
    saveLocalOptions();
    updateOptions();
}
// TODO edited loops to be const key. correct?
export function updateOptions (): void {
    for (const key in compatibilityFlags) compatibilityFlags[key as CampatibilityFlags].setValue(emulator[key]);
    screenRotation.setValue(emulator.screenRotation);
    compatProfile.setValue('none');// TODO fix?
    for (const key in compatibilityProfiles) {
        const p = compatibilityProfiles[key as CompatibilityProfileFlags];
        const same = Object.keys(p).every(x => emulator[x] == p[x as CampatibilityFlags]);
        if (same) compatProfile.setValue(key as CompatibilityProfileFlags);
    }
}
