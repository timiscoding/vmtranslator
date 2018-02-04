import path from 'path';
import Parser from './Parser';
import CodeWriter from './CodeWriter';

const vmfile = process.argv[2];
if (typeof vmfile === 'undefined') {
  console.log('Usage: node --experimental-modules trans.mjs <vm file>');
  process.exit(1);
}

const cw = new CodeWriter(`${path.join(path.dirname(vmfile), path.basename(vmfile, '.vm'))}.asm`);
console.log('Reading', vmfile);

const parser = new Parser(vmfile);

console.log('Parsing commands...');
console.log('command'.padStart(12, ' '), 'arg1'.padStart(8, ' '), 'arg2'.padStart(4, ' '));

for (var count=0; parser.hasMoreCommands(); count++) {
  parser.advance();
  let command = parser.commandType();
  let arg1 = parser.arg1();
  let arg2 = parser.arg2() || '';

  console.log(command.padStart(12, ' '), arg1.padStart(8, ' '), arg2.padStart(4, ' '));

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

console.log('\nProcessed', count, 'commands');
cw.close();
