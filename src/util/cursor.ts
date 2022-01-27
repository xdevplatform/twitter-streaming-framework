export function hideCursor() {
  process.stdout.write('\x1b[?25l')
}

export function showCursor() {
  process.stdout.write('\x1b[?25h')
}
