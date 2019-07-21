#!/usr/bin/env node
// simple piped commandline octo compiler

let compiler = require("./js/compiler");
let decompiler = require("./js/decompiler");
let fs = require("fs");

let zeroes = "00000000";

global.maskFormat = function(mask) {
  if (!options["numericMask"]) {
    return binaryFormat(mask);
  }
  return numericFormat(mask);
};

global.numericFormat = function(num) {
  if (options["numericFormat"] == "dec") {
    return decimalFormat(num);
  } else if (options["numericFormat"] == "bin") {
    return binaryFormat(num);
  } else if (options["numericFormat"] == "hex") {
    return hexFormat(num);
  }

  return hexFormat(num);
};

global.decimalFormat = function(num) {
  let dec = num.toString(10);
  return dec;
};

global.hexFormat = function(num) {
  let hex = num.toString(16).toUpperCase();
  let pad0 = zeroPad(hex.length, 2);
  return "0x" + pad0 + hex;
};

global.binaryFormat = function(num) {
  let bin = num.toString(2);
  let pad0 = zeroPad(bin.length, 8);
  return "0b" + pad0 + bin;
};

function zeroPad(strLen, byteLength) {
  let dif = strLen % byteLength;
  if (dif == 0) {
    return "";
  }

  let len = byteLength - dif;
  let pad0 = zeroes.substr(0, len);
  return pad0;
}

function extractFlag(name) {
  let index = process.argv.indexOf(name);
  if (index == -1) {
    return false;
  }
  process.argv.splice(index, 1);
  return true;
}

function compile(sourceCode) {
  var comp = new compiler.Compiler(sourceCode);
  try {
    var comp = new compiler.Compiler(sourceCode);
    comp.go();
    return comp.rom;
  } catch (err) {
    let line = 1;
    for (let x = 0; x < comp.pos[1] - 1; x++) {
      if (sourceCode.charAt(x) == "\n") {
        line++;
      }
    }
    console.error("line %d: %s", line, err);
    process.exit(1);
  }
}

function compileFile(src, dst) {
  let programText = fs.readFileSync(src, { encoding: "utf8" });
  let programBinary = new Buffer(compile(programText));
  if (typeof dst == "undefined") {
    process.stdout.write(programBinary);
  } else {
    fs.writeFileSync(dst, programBinary, { encoding: "binary" });
  }
  return programBinary;
}

function decompileFile(src, dst) {
  let buff = fs.readFileSync(src);
  decompiler.analyze(buff, options);
  let programText = decompiler.formatProgram(buff.length);
  if (typeof dst == "undefined") {
    console.log(programText);
  } else {
    fs.writeFileSync(dst, programText);
  }
  return programText;
}

function printUsage() {
  console.log(
    "usage: octo [--decompile | --roundtrip] [--hex | --dec | --bin] [--numMask] [--qshift] [--qloadstore] [--qvforder] <source> [<destination>]"
  );
  process.exit(1);
}

var options = {};
options["shiftQuirks"] = extractFlag("--qshift");
options["loadStoreQuirks"] = extractFlag("--qloadstore");
options["vfOrderQuirks"] = extractFlag("--qvforder");
options["numericMask"] = extractFlag("--numMask");
let decompileFlag = extractFlag("--decompile");
let roundTripFlag = extractFlag("--roundtrip");

if (extractFlag("--hex")) {
  options["numericFormat"] = "hex";
} else if (extractFlag("--dec")) {
  options["numericFormat"] = "dec";
} else if (extractFlag("--bin")) {
  options["numericFormat"] = "bin";
}

if (
  process.argv.length != 3 &&
  process.argv.length != 4 &&
  process.argv.length != 5 &&
  process.argv.length != 6
) {
  printUsage();
}
let sourceFile = process.argv[2];
let destFile = process.argv[3];

let decompiledText = "";

if (decompileFlag) {
  decompiledText = decompileFile(sourceFile, destFile);
} else if (!roundTripFlag) {
  compileFile(sourceFile, destFile);
}

if (roundTripFlag) {
  let startBinary = fs.readFileSync(sourceFile);
  if (decompiledText == "") {
    decompiler.analyze(startBinary, options);
    decompiledText = decompiler.formatProgram(startBinary.length);
  }
  let endBinary = compile(decompiledText);

  let mismatch = false;
  for (let x = 0; x < Math.max(startBinary.length, endBinary.length); x++) {
    let mishere = startBinary[x] != endBinary[x];
    if (!mishere) {
      continue;
    }
    if (!mismatch) {
      console.error("round trip mismatch!");
    }
    mismatch |= mishere;
    console.error(
      "%s: original: %s output: %s",
      hexFormat(x + 0x200),
      hexFormat(startBinary[x]),
      hexFormat(endBinary[x])
    );
  }
  if (startBinary.length != endBinary.length) {
    console.error("binary sizes do not match!");
    mismatch = true;
  }
  if (mismatch) {
    process.exit(1);
  }
}
