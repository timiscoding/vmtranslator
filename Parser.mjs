import lineByLine from 'n-readlines';


export default class Parser {
  constructor(filename) {
    this.rl = new lineByLine(filename);
    this.lineNum = 0;
  }

  static get commands() {
    return Object.freeze({
      C_ARITHMETIC: 'C_ARITHMETIC',
      C_PUSH: 'C_PUSH',
      C_POP: 'C_POP',
    });
  }

  hasMoreCommands() {
    this.line = this.rl.next();
    this.lineNum++;

    while (/^\s*$|^\/\//.test(this.line.toString().trim()) && this.hasMoreCommands()) {}

    return !!this.line;
  }

  advance() {
    this.line = this.line.toString().trim();
    return this.line;
  }

  commandType() {
    const pop = /^pop/;
    const push = /^push/;
    const arithLogic = /^add|sub|neg|eq|gt|lt|and|or|not/;

    if (pop.test(this.line)) {
      this.command = Parser.commands.C_POP;
    } else if (push.test(this.line)) {
      this.command = Parser.commands.C_PUSH;
    } else if (arithLogic.test(this.line)) {
      this.command = Parser.commands.C_ARITHMETIC;
    }

    return this.command;
  }

  arg1() {
    if (this.command === Parser.commands.C_ARITHMETIC) {
      return this.line;
    } else if (this.command === Parser.commands.C_PUSH || this.command === Parser.commands.C_POP) {
      const re = /^(?:push|pop)\s+(\w+)/;
      const [, arg1] = this.line.match(re);
      return arg1;
    }
  }

  arg2() {
    switch(this.command) {
      case Parser.commands.C_POP:
      case Parser.commands.C_PUSH:
        const re = /^(?:push|pop)\s+\w+\s+(\w+)/;
        var [, arg2] = this.line.match(re);
        break;
    }

    return arg2;
  }
}
