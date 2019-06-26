http://laurencescotford.co.uk/?p=12
http://laurencescotford.co.uk/?p=75
http://laurencescotford.co.uk/?p=266
http://laurencescotford.co.uk/wp-content/uploads/2013/08/CHIP-8-Interpreter-Disassembly.pdf

COSMAC VIP manual
http://www.progettosnaps.net/manuals/pdf/vip.pdf

hp48 super chip information
https://github.com/Chromatophore/HP48-Superchip

https://github.com/AfBu/haxe-CHIP-8-emulator/wiki/(Super)CHIP-8-Secrets
https://massung.github.io/CHIP-8/ notes on quirks
https://github.com/mattmikolay/chip-8/wiki/CHIP%E2%80%908-Instruction-Set notes on quirks
https://github.com/wernsey/chip8 notes on quirks

VIPER magazing pdfs and more
https://github.com/trapexit/chip-8_documentation

TODO double check
Documentation Errors:
http://mattmik.com/files/chip8/mastering/chip8.html wrong about draw routine Vx Vy limits
http://devernay.free.fr/hacks/chip8/C8TECH10.HTM#1.0 wrong about sprite wrapping, doesn't describe what happens is initial origin of sprite is off screen
http://chip8.sourceforge.net/chip8-1.1.pdf wrong about Vx Vy limits
https://github.com/mattmikolay/chip-8/wiki/CHIP%E2%80%908-Technical-Reference
"If the program attempts to draw a sprite at an x coordinate greater than 0x3F, the x value will be reduced modulo 64.
Similarly, if the program attempts to draw at a y coordinate greater than 0x1F, the y value will be reduced modulo 32.
Sprites that are drawn partially off-screen will be clipped."


Sources noting errors:
http://stevelosh.com/blog/2016/12/chip8-graphics/
Unfortunately we hit a snag at this point.
All the references I’ve found say that if any X or Y values go outside of the range of valid screen coordinates the sprite should wrap around the screen.
And indeed, some ROMs (e.g. ufo.rom) require this behavior to work properly.
But unfortunately some other ROMs (e.g. blitz.rom) expect the screen to clip, not wrap!

https://taharmeijs.com/emulating-chip8-in-c/
"Another thing that made it more difficult to render sprites correctly was that some Chip8 specifications use a looping display, while others do not. This means that some games would only functions with a looping display. I decided to only support a non-looping screen."

http://blog.shiftybit.net/2015/06/theres-the-correct-way-then-theres-the-right-way/
" However, on current implementations I is left unchanged. I had written my Chip8 emulator to the original spec, but these ROMs are expecting to be run on the more current implementations that don’t modify I."

https://www.reddit.com/r/EmuDev/comments/72dunw/chip8_8xy6_help/dnhu8ke?utm_source=share&utm_medium=web2x
"Both are correct due to CHIP8 being implemented differently. Most games that I play around with work fine with the original Vx=Vy=Vy>>1 . You'll probably want to implement a way to toggle between the two methods of executing the instruction."

ROM quirk information:
https://github.com/tomdaley92/kiwi-8/issues/9
