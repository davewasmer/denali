import { isArray, isEmpty, set } from 'lodash';

export default function setIfNotEmpty(obj: any, key: string, value: any): void {
  if (isArray(value) || !isEmpty(value)) {
    set<any, string, any>(obj, key, value);
  }
}