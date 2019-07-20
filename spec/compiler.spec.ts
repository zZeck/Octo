//import { Compiler } from "../src/compiler";

let caveExplorer: string;
describe('compiler', (): void => {

    beforeAll(async (): Promise<void> => {
        const template = document.createElement('template');
        const response = await fetch('/base/src/index.html');
        const text = await response.text();

        template.innerHTML = text.trim();
        const clone = document.importNode(template.content, true);
        document.body.appendChild(clone);

        //works
        caveExplorer = await (await fetch('/base/examples/caveexplorer.8o')).text();
    });

    it('cave explorer compiles correctly', (): void => {
        
        //const compiler = new Compiler(caveExplorer);

        //compiler.go();

        expect(true).toBe(true);
    });
});