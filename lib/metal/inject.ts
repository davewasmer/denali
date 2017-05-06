export interface Injection {
  lookup: string;
}

export const IS_INJECTION = Symbol('container injection placeholder');

export function isInjection(value: any): value is Injection {
  return value != null && Boolean(value[IS_INJECTION]);
}

export default function inject<T = any>(lookup: string): T {
  return <any>{
    [IS_INJECTION]: true,
    lookup
  };
}
