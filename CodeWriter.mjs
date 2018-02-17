import fs from 'fs';
import path from 'path';
import Parser from './Parser';

const {TEMP_BASE_ADDR, SYMBOL} = Object.freeze({
  TEMP_BASE_ADDR: 5, // fixed base addr for TEMP memory segment
  SYMBOL: { // vm memory segment to asm symbol mapping
    local: 'LCL',
    argument: 'ARG',
    this: 'THIS',
    that: 'THAT',
  },
});

const genId = ((id = 0) => () => id++)();

export default class CodeWriter {
  constructor(filename) {
    console.log('Output file:', path.relative(process.cwd(), filename));
    this.class = path.basename(filename, '.asm');
    this.lineCount = 0;
    try {
      this.fd = fs.openSync(filename, 'w+');
    } catch(err) {
      console.log(err);
    }
  }

  writeCode(asm, {countLine = true} = {}) {
    if (countLine) {
      this.lineCount += Array.isArray(asm) ? asm.length : 1;
    }
    fs.appendFileSync(this.fd, (Array.isArray(asm) ? asm.join('\n') : asm) + '\n');
  }

  /*
    VM: add
    ASM pseudocode: SP--, D = *SP, SP--, D = D + *SP, *SP = D

    VM: sub
    ASM pseudocode: SP--, D = *SP, SP--, D = *SP - D, *SP = D
  */
  writeArithmetic(command) {
    try {
      fs.appendFileSync(this.fd, `// ${this.lineCount} ${command}\n`);

      var {pop, push, compare} = {
        pop: ({setD = true} = {}) => [
          '@SP',
          'M=M-1',
          'A=M',
          ...(setD ? ['D=M'] : []),
        ],
        push: [
          '@SP',
          'A=M',
          'M=D',
          '@SP',
          'M=M+1',
        ],
        compare: (command, _labelId) => (_labelId = genId(), [ // compares M with D
          'D=M-D',
          `@TRUE_${_labelId}`,
          `D;J${command.toUpperCase()}`,
          'D=0',
          `@THEN_${_labelId}`,
          `0;JMP`,
          `(TRUE_${_labelId})`,
          'D=-1',
          `(THEN_${_labelId})`,
        ]),
      };

      let asm;
      if (command === 'add') {
        asm = [].concat(
          pop(),
          pop({ setD: false }),
          'D=D+M',
          push,
        );
      } else if (command === 'sub') {
        asm = [].concat(
          pop(),
          pop({ setD: false }),
          'D=M-D',
          push,
        );
      } else if (command === 'eq' || command === 'lt' || command === 'gt') {
        asm = [].concat(
          pop(),
          pop({ setD: false }),
          compare(command),
          push,
        );
      } else if (command === 'neg' || command === 'not') {
        asm = [].concat(
          pop(),
          `D=${command === 'neg' ? '-' : '!'}D`,
          push,
        );
      } else if (command === 'and' || command === 'or') {
        asm = [].concat(
          pop(),
          pop({setD: false}),
          `D=D${command === 'and' ? '&' : '|'}M`,
          push,
        );
      }

      this.writeCode(asm);
    } catch(err) {
      console.log(err);
    }
  }

  /*
    VM: push segment i
    ASM pseudocode: addr = segment + i, *SP = *addr, SP++

    VM: push pointer 0/1
    ASM pseudocode: *SP = THIS/THAT, SP++

    VM: pop segment i
    ASM pseudocode: addr = segment + i, SP--, *addr = *SP

    VM: pop pointer 0/1
    ASM pseudocode: SP--, THIS/THAT=*SP
  */
  writePushPop(command, segment, index) {
    try {
      fs.appendFileSync(this.fd, `// ${this.lineCount} ${command} ${segment} ${index}\n`);

      let asm;
      if (command === Parser.commands.C_PUSH) {
        let {setD, push} = {
          setD: (baseAddr, offset) => [ // baseAddr: mem segment variable / integer
              `@${baseAddr}`,
              Number.isInteger(parseInt(baseAddr)) ? 'D=A' : 'D=M',
              ...(offset
                ? [
                  `@${offset}`,
                  'A=D+A',
                  'D=M',
                ]
                : '')
            ],
          push: [
            '@SP',
            'A=M',
            'M=D', // *SP = D
            '@SP',
            'M=M+1',
          ],
        }

        if (segment === 'constant') {
          asm = [].concat(
            setD(index),
            push,
          );
        } else if (segment === 'temp') {
          asm = [].concat(
            setD(TEMP_BASE_ADDR, index),
            push,
          );
        } else if (segment === 'pointer') {
          asm = [].concat(
            setD(index == 0 ? 'THIS' : 'THAT'),
            push,
          );
        } else if (segment === 'static') {
          asm = [].concat(
            setD(`${this.class}.${index}`),
            push,
          );
        } else {
          asm = [].concat(
            setD(SYMBOL[segment], index),
            push,
          );
        }
      } else if (command === Parser.commands.C_POP) {
        if (segment === 'constant') {
          throw new Error('Cannot pop constant. Exiting...');
        }

        let {addr, pop, addrPtr} = {
          addr: (baseAddr, offset) => [ // baseAddr: mem segment variable / integer
            `@${baseAddr}`,
            Number.isInteger(parseInt(baseAddr)) ? 'D=A' : 'D=M',
            `@${offset}`,
            'D=D+A', // baseAddr + offset
            '@addr',
            'M=D',
          ],
          pop: [
            '@SP',
            'M=M-1', // point to top of stack
            'A=M',
            'D=M', // pop in D
          ],
          addrPtr: [
            '@addr',
            'A=M',
            'M=D', // *addr = D
          ],
        };

        if (segment === 'temp') {
          asm = [].concat(
            addr(TEMP_BASE_ADDR, index),
            pop,
            addrPtr,
          );
        } else if (segment === 'pointer') {
          asm = [].concat(
            pop,
            `@${index == 0 ? 'THIS' : 'THAT'}`,
            'M=D',
          );
        } else if (segment === 'static') {
          asm = [].concat(
            pop,
            `@${this.class}.${index}`,
            'M=D',
          );
        } else {
          asm = [].concat(
            addr(SYMBOL[segment], index),
            pop,
            addrPtr,
          );
        }
      }
      this.writeCode(asm);
    } catch (err) {
      console.log(err);
    }
  }

  writeLabel(label) {
    this.writeCode(`(${label})`, { countLine: false });
  }

  writeIf(label) {
    fs.appendFileSync(this.fd, `// ${this.lineCount} C_IF ${label}\n`);

    this.writeCode([
      '@SP',
      'M=M-1',
      'A=M',
      'D=M',
      `@${label}`,
      'D;JNE',
    ]);
  }

  close() {
    try {
      fs.closeSync(this.fd);
    } catch (err) {
      console.log(err);
    }
  }
}
