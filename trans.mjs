import path from 'path';
import Parser from './Parser';
import CodeWriter from './CodeWriter';

var vmfile = process.argv[2];
if (typeof vmfile === 'undefined') {
  console.log('Usage: node --experimental-modules trans.mjs <vm file>');
  process.exit(1);
}

var cw = new CodeWriter(`${path.basename(vmfile, '.vm')}.asm`);
console.log('Reading', vmfile);

var parser = new Parser(vmfile);
while (parser.hasMoreCommands()) {
  parser.advance();
  var command = parser.commandType();
  var arg1 = parser.arg1();
  var arg2 = parser.arg2();
  console.log('command', command, 'arg1', arg1, 'arg2', arg2);
  switch (parser.commandType()) {
    case Parser.commands.C_ARITHMETIC:
      cw.writeArithmetic(arg1);
      break;
    case Parser.commands.C_PUSH:
    case Parser.commands.C_POP:
      cw.writePushPop(command, arg1, arg2);
      break;
  }
}
cw.close();




