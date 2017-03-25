export const IS_INJECTION = Symbol('container injection placeholder');

export default function inject(lookup: string) {
  return {
    [IS_INJECTION]: true,
    lookup
  };
}