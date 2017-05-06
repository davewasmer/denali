export interface Dict<T> {
  [key: string]: T;
}

export interface Constructor<T> {
  new (...args: any[]): T;
}

export type POJO = Dict<any>;
