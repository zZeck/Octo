import { Compiler } from "../src/compiler";
import * as forge from "node-forge";

describe('compiler', (): void => {

    beforeAll(async (): Promise<void> => {
        //const template = document.createElement('template');
        //const response = await fetch('/base/src/index.html');
        //const text = await response.text();

        //template.innerHTML = text.trim();
        //const clone = document.importNode(template.content, true);
        //document.body.appendChild(clone);

        //works
        
    });

    it('cave explorer compiles correctly', async (): Promise<void> => {
        const caveExplorer = await (await fetch('/base/examples/caveexplorer.8o')).text();
        const compiler = new Compiler(caveExplorer);
        const md = forge.md.sha1.create();

        compiler.go();

        const romHexStr = compiler.rom.reduce((acc, cur): string => acc + cur.toString(16).padStart(2, "0"), "");
        const romBytes = forge.util.hexToBytes(romHexStr);

        md.update(romBytes, 'raw');
        const hash = md.digest().toHex();

        expect(hash.toUpperCase()).toBe("400DBD1AA2B79B9B8546BC615BFB735C1BD1D268");
    });

    it('eaty compiles correctly', async (): Promise<void> => {
        const caveExplorer = await (await fetch('/base/examples/eaty.8o')).text();
        const compiler = new Compiler(caveExplorer);
        const md = forge.md.sha1.create();

        compiler.go();

        const romHexStr = compiler.rom.reduce((acc, cur): string => acc + cur.toString(16).padStart(2, "0"), "");
        const romBytes = forge.util.hexToBytes(romHexStr);

        md.update(romBytes, 'raw');
        const hash = md.digest().toHex();

        expect(hash.toUpperCase()).toBe("FCAA793332A83C93F4ED79F5FFBC8403C8B8AEA0");
    });

    it('fuse compiles correctly', async (): Promise<void> => {
        const caveExplorer = await (await fetch('/base/examples/fuse.8o')).text();
        const compiler = new Compiler(caveExplorer);
        const md = forge.md.sha1.create();

        compiler.go();

        const romHexStr = compiler.rom.reduce((acc, cur): string => acc + cur.toString(16).padStart(2, "0"), "");
        const romBytes = forge.util.hexToBytes(romHexStr);

        md.update(romBytes, 'raw');
        const hash = md.digest().toHex();

        expect(hash.toUpperCase()).toBe("0CD895DC3D489D0E40656218900A04310E95F560");
    });

    it('gradsim compiles correctly', async (): Promise<void> => {
        const caveExplorer = await (await fetch('/base/examples/gradsim.8o')).text();
        const compiler = new Compiler(caveExplorer);
        const md = forge.md.sha1.create();

        compiler.go();

        const romHexStr = compiler.rom.reduce((acc, cur): string => acc + cur.toString(16).padStart(2, "0"), "");
        const romBytes = forge.util.hexToBytes(romHexStr);

        md.update(romBytes, 'raw');
        const hash = md.digest().toHex();

        expect(hash.toUpperCase()).toBe("9797A7EAF1E80EC19C085C60BB37991420F54678");
    });

    it('mondrian compiles correctly', async (): Promise<void> => {
        const caveExplorer = await (await fetch('/base/examples/mondrian.8o')).text();
        const compiler = new Compiler(caveExplorer);
        const md = forge.md.sha1.create();

        compiler.go();

        const romHexStr = compiler.rom.reduce((acc, cur): string => acc + cur.toString(16).padStart(2, "0"), "");
        const romBytes = forge.util.hexToBytes(romHexStr);

        md.update(romBytes, 'raw');
        const hash = md.digest().toHex();

        expect(hash.toUpperCase()).toBe("63E787FC3E78E5FB3A394CF1BC654AD9633D8907");
    });

    it('outlaw compiles correctly', async (): Promise<void> => {
        const caveExplorer = await (await fetch('/base/examples/outlaw.8o')).text();
        const compiler = new Compiler(caveExplorer);
        const md = forge.md.sha1.create();

        compiler.go();

        const romHexStr = compiler.rom.reduce((acc, cur): string => acc + cur.toString(16).padStart(2, "0"), "");
        const romBytes = forge.util.hexToBytes(romHexStr);

        md.update(romBytes, 'raw');
        const hash = md.digest().toHex();

        expect(hash.toUpperCase()).toBe("A9D3C975A5E733646A04F6E61DEEBCD0AD50F700");
    });

    it('slippery compiles correctly', async (): Promise<void> => {
        const caveExplorer = await (await fetch('/base/examples/slippery.8o')).text();
        const compiler = new Compiler(caveExplorer);
        const md = forge.md.sha1.create();

        compiler.go();

        const romHexStr = compiler.rom.reduce((acc, cur): string => acc + cur.toString(16).padStart(2, "0"), "");
        const romBytes = forge.util.hexToBytes(romHexStr);

        md.update(romBytes, 'raw');
        const hash = md.digest().toHex();

        expect(hash.toUpperCase()).toBe("D73D48484A8FC60E8650F4228D6963A19A4DE6C3");
    });
});