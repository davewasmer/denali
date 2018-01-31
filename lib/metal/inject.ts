import { Dict } from '../utils/types';
import Container from './container';

export interface Injection {
  lookup: string;
}

export const IS_INJECTION = Symbol.for('denali:container:injection-placeholder');

export function isInjection(value: any): value is Injection {
  return value != null && Boolean(value[IS_INJECTION]);
}

export default function inject<T = any>(lookup: string): T {
  return <any>{
    [IS_INJECTION]: true,
    lookup
  };
}

export function injectInstance(instance: any, container: Container) {
  let classMeta = container.metaFor(instance.constructor);
  if (!classMeta.injectionsCache) {
    let injections: Dict<any> = { container };
    for (let key in instance) {
      let value = instance[key];
      if (isInjection(value)) {
        injections[key] = container.lookup(value.lookup);
      }
    }
    classMeta.injectionsCache = injections;
  }
  // console.log('applying injections to', instance, classMeta.injectionsCache);
  Object.assign(instance, classMeta.injectionsCache);
}
