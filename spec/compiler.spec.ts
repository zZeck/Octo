import { Compiler } from "../src/compiler";
import * as forge from "node-forge";

let caveExplorer: string;
describe('compiler', (): void => {

    beforeAll(async (): Promise<void> => {
        //const template = document.createElement('template');
        //const response = await fetch('/base/src/index.html');
        //const text = await response.text();

        //template.innerHTML = text.trim();
        //const clone = document.importNode(template.content, true);
        //document.body.appendChild(clone);

        //works
        caveExplorer = await (await fetch('/base/examples/caveexplorer.8o')).text();
    });

    it('cave explorer compiles correctly', (): void => {
        const compiler = new Compiler(caveExplorer);
        const md = forge.md.sha1.create();

        compiler.go();

        const romHexStr = compiler.rom.reduce((acc, cur): string => acc + cur.toString(16).padStart(2, "0"), "");
        const romBytes = forge.util.hexToBytes(romHexStr);

        md.update(romBytes, 'raw');
        const hash = md.digest().toHex();

        expect(hash.toUpperCase()).toBe("400DBD1AA2B79B9B8546BC615BFB735C1BD1D268");
    });
});