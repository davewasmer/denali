export interface Injection {
  lookup: string;
}

export const IS_INJECTION = Symbol('container injection placeholder');

export function isInjection(value: any): value is Injection {
  return Boolean(value[IS_INJECTION]);
}

export default function inject(lookup: string): Injection {
  return {
    [IS_INJECTION]: true,
    lookup
  };
}