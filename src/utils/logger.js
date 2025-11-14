import fs from 'fs';
import path from 'path';

class Logger {
  constructor() {
    this.logsDir = path.join(process.cwd(), 'results', 'logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, data = null) {
    const timestamp = this.getTimestamp();
    let logMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      logMessage += `\n${JSON.stringify(data, null, 2)}`;
    }
    
    return logMessage;
  }

  log(level, message, data = null) {
    const formattedMessage = this.formatMessage(level, message, data);
    console.log(formattedMessage);
    
    const logFile = path.join(this.logsDir, `${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, formattedMessage + '\n');
  }

  info(message, data = null) {
    this.log('INFO', message, data);
  }

  success(message, data = null) {
    this.log('✓ SUCCESS', message, data);
  }

  error(message, error = null) {
    const errorData = error ? {
      message: error.message,
      stack: error.stack
    } : null;
    this.log('✗ ERROR', message, errorData);
  }

  warn(message, data = null) {
    this.log('⚠ WARN', message, data);
  }

  test(testName, network) {
    console.log('\n' + '='.repeat(60));
    console.log(`🧪 TEST: ${testName} | Network: ${network}`);
    console.log('='.repeat(60) + '\n');
  }

  result(metric, value, unit = '') {
    console.log(`📊 ${metric}: ${value} ${unit}`);
  }

  separator() {
    console.log('-'.repeat(60));
  }
}

export default new Logger();