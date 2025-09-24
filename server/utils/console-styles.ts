/**
 * Console styling utilities for better terminal output
 */

// ANSI color codes
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Bright foreground colors
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

export const style = {
  success: (text: string) => `${colors.green}${text}${colors.reset}`,
  error: (text: string) => `${colors.red}${text}${colors.reset}`,
  warning: (text: string) => `${colors.yellow}${text}${colors.reset}`,
  info: (text: string) => `${colors.cyan}${text}${colors.reset}`,
  url: (text: string) => `${colors.bright}${colors.cyan}${text}${colors.reset}`,
  bold: (text: string) => `${colors.bright}${text}${colors.reset}`,
  dim: (text: string) => `${colors.dim}${text}${colors.reset}`,
};

export const icons = {
  rocket: '🚀',
  check: '✅',
  cross: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  pin: '📍',
  folder: '📁',
  gear: '⚙️',
  sparkles: '✨',
  fire: '🔥',
  lightning: '⚡',
  star: '⭐',
  package: '📦',
  link: '🔗',
  globe: '🌍',
  server: '🖥️',
};

export function printStartupBanner(port: number, workspace: string, env: string) {
  const bannerWidth = 60;
  const separator = '═'.repeat(bannerWidth);
  const thinSeparator = '─'.repeat(bannerWidth);
  
  console.log('\n' + style.success(separator));
  console.log(style.bold(`${icons.rocket}  GAZEL SERVER STARTED ${icons.rocket}`).padStart((bannerWidth + 25) / 2));
  console.log(style.success(separator));
  
  console.log(`\n${icons.pin} ${style.bold('Server URL:')}`);
  console.log(`   ${style.url(`http://localhost:${port}`)}`);
  
  console.log(`\n${icons.folder} ${style.bold('Bazel Workspace:')}`);
  console.log(`   ${style.warning(workspace)}`);
  
  console.log(`\n${icons.gear} ${style.bold('Environment:')}`);
  console.log(`   ${env === 'production' ? style.success(env) : style.info(env)}`);
  
  console.log('\n' + style.dim(thinSeparator));
  console.log(`${icons.sparkles} ${style.success('Ready to explore your Bazel workspace!')} ${icons.sparkles}`);
  console.log(style.dim(thinSeparator) + '\n');
}

export function printShutdownMessage() {
  console.log(`\n${icons.warning} ${style.warning('Server shutting down...')}`);
  console.log(`${icons.check} ${style.success('Goodbye!')}\n`);
}
