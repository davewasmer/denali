import * as dedent from 'dedent-js';

/**
 * Take the tagged string and remove indentation and word-wrapping.
 *
 * @package util
 */
export default function unwrap(strings: TemplateStringsArray, ...expressions: any[]): string {
  let text = dedent(strings, ...expressions);
  text = text.replace(/(\S.*?)\n(.*?\S)/g, '$1 $2');
  return text;
}
