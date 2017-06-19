import { unwrap } from 'denali-cli';
import * as wrap from 'wordwrap';
import * as tty from 'tty';

/**
 * Take the tagged string and change the word wrapping to 100 columns (or the width of the terminal
 * window, if smaller). Useful for writing paragraphs of text that should wrap in the source code,
 * but may need to wrap to a different width when printed out to the terminal.
 *
 * @package util
 */
export default function rewrap(strings: TemplateStringsArray, ...expressions: any[]): string {
  let text = unwrap(strings, ...expressions);
  text = wrap(text, Math.min(100, (<tty.WriteStream>process.stdout).columns));
  return text;
}
