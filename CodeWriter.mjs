import fs from 'fs';
import Parser from './Parser';

const c = Object.freeze({
  temp_base_addr: 5, // fixed base addr for TEMP memory segment
  seg2symbol: { // vm memory segment to asm symbol mapping
    local: 'LCL',
    argument: 'ARG',
    this: 'THIS',
    that: 'THAT',
    pointer: 'POINTER',
  },
});

export default class CodeWriter {
  constructor(filename) {
    console.log('write to', filename);
    try {
      this.fd = fs.openSync(filename, 'w+');
    } catch(err) {
      console.log(err);
    }
  }

  writeArithmetic(command) {
    try {
      fs.appendFileSync(this.fd, `// ${command}\n`);

      if (command === 'add' || command === 'sub') {
        // add SP--, D = *SP, SP--, D = D + *SP, *SP = D
        // sub SP--, D = *SP, SP--, D = *SP - D, *SP = D
        var op = command === 'add' ? 'D=D+M' : 'D=M-D';

        fs.appendFileSync(this.fd, [
          '@SP',
          'M=M-1', // SP--
          'A=M',
          'D=M', // D = *SP
          '@SP',
          'M=M-1', // SP--
          'A=M',
          op,
          '@SP',
          'A=M',
          'M=D', // *SP = D
          '@SP',
          'M=M+1', // SP++
        ].join('\n') + '\n');
      }
    } catch(err) {
      console.log(err);
    }
  }

  writePushPop(command, segment, index) {
    try {
      fs.appendFileSync(this.fd, `// ${command} ${segment} ${index}\n`);

      // push segment i
      // addr = segment + i, *SP = *addr, SP++
      // push pointer 0/1
      // *SP = THIS/THAT, SP++

      if (command === Parser.commands.C_PUSH) {
        // compute *addr
        var stackVal;
        if (segment === 'constant') {
          stackVal = [`@${index}`, 'D=A'];
        } else if (segment === 'temp') {
          // addr = 5 + i
          stackVal = [
            '@5',
            'D=A',
            `@${index}`,
            'A=D+A',
            'D=M',
          ];
        } else if (segment === 'pointer') {
          stackVal = [
            `@${index == 0 ? 'THIS' : 'THAT'}`,
            'D=M',
          ];
        } else {
          stackVal = [
            `@${c.seg2symbol[segment]}`,
            'D=M',
            `@${index}`,
            'A=D+A',
            'D=M',
          ];
        }

        fs.appendFileSync(this.fd,
          [
            ...stackVal,
            '@SP',
            'A=M',
            'M=D', // *SP = *addr
            '@SP',
            'M=M+1', // SP++
          ].join('\n') + '\n');
      } else if (command === Parser.commands.C_POP) {
        if (segment === 'constant') {
          throw new Error('Cannot pop constant. Exiting...');
        }
        // pop segment i
        // addr = segment + i, SP--, *addr = *SP
        // pop pointer 0/1
        // SP--, THIS/THAT=*SP

        var {addr, decSP, pop, addrPtr} = {
          addr: (baseAddr, index='0') => [
            `@${baseAddr}`,
            ...(parseInt(baseAddr)
              ? ['D=A']
              : ['D=M',
                `@${index}`,
                'D=D+A']), // segment + i
            '@addr',
            'M=D',
          ],
          decSP: [
            '@SP',
            'M=M-1', // SP--
          ],
          pop: [
            '@SP',
            'A=M',
            'D=M', // store val in D
          ],
          addrPtr: [
            '@addr',
            'A=M',
            'M=D', // *addr = D
          ],
        };

        var asm;
        if (segment === 'temp') {
          asm = [].concat(
            addr(c.temp_base_addr),
            decSP,
            pop,
            addrPtr,
          );
        } else if (segment === 'pointer') {
          asm = [].concat(
            decSP,
            pop,
            `@${index == 0 ? 'THIS' : 'THAT'}`,
            'M=D',
          );
        } else {
          asm = [].concat(
            addr(c.seg2symbol[segment], index),
            decSP,
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
