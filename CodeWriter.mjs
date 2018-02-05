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

export default class CodeWriter {
  constructor(filename) {
    console.log('Output to', `${process.cwd()}/${filename}`);
    this.class = path.basename(filename, '.asm');
    try {
      this.fd = fs.openSync(filename, 'w+');
    } catch(err) {
      console.log(err);
    }
  }

  /*
    VM: add
    ASM pseudocode: SP--, D = *SP, SP--, D = D + *SP, *SP = D

    VM: sub
    ASM pseudocode: SP--, D = *SP, SP--, D = *SP - D, *SP = D
  */
  writeArithmetic(command) {
    try {
      fs.appendFileSync(this.fd, `// ${command}\n`);

      var {pop, push} = {
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
      }

      fs.appendFileSync(this.fd, asm.join('\n') + '\n');
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
      fs.appendFileSync(this.fd, `// ${command} ${segment} ${index}\n`);

      if (command === Parser.commands.C_PUSH) {
        let {setD, push} = {
          setD: (baseAddr, offset) => [ // baseAddr: mem segment variable / integer
              `@${baseAddr}`,
              parseInt(baseAddr) ? 'D=A' : 'D=M',
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

        let asm;
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

        fs.appendFileSync(this.fd, asm.join('\n') + '\n');
      } else if (command === Parser.commands.C_POP) {
        if (segment === 'constant') {
          throw new Error('Cannot pop constant. Exiting...');
        }

        let {addr, pop, addrPtr} = {
          addr: (baseAddr, offset) => [ // baseAddr: mem segment variable / integer
            `@${baseAddr}`,
            parseInt(baseAddr) ? 'D=A' : 'D=M',
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

        let asm;
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

        fs.appendFileSync(this.fd, asm.join('\n') + '\n');
      }
    } catch (err) {
      console.log(err);
    }
  }

  close() {
    try {
      fs.closeSync(this.fd);
    } catch (err) {
      console.log(err);
    }
  }
}
