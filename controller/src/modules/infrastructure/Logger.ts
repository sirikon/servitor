export type LoggerLevel = "info" | "error";

export class Logger {
  constructor() {}

  public info(message: string) {
    this.line("info", message);
  }

  public error(message: string) {
    this.line("error", message);
  }

  private line(level: LoggerLevel, message: string) {
    console.log(`${level}: ${message}`);
  }
}

export const logger = new Logger();
