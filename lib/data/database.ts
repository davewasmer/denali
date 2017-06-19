import * as assert from 'assert';
import * as createDebug from 'debug';
import Service from '../runtime/service';
import Model from './model';
import ORMAdapter from './orm-adapter';

const debug = createDebug('denali:database-service');

export default class DatabaseService extends Service {

  async find(modelType: string, id: any, options?: any): Promise<Model|null> {
    debug(`${ modelType } find: ${ id }`);
    assert(id != null, `You must pass an id to Model.find(id)`);
    let adapter = this.lookupAdapter(modelType);
    let result = await adapter.find(modelType, id, options);
    if (!result) {
      return null;
    }
    let ModelFactory = this.container.factoryFor<Model>(`model:${ modelType }`);
    return ModelFactory.create(result);
  }

  async queryOne(modelType: string, query: any, options?: any): Promise<Model|null> {
    debug(`${ modelType } queryOne: ${ query }`);
    assert(query != null, `You must pass a query to Model.queryOne(conditions)`);
    let adapter = this.lookupAdapter(modelType);
    let record = await adapter.queryOne(modelType, query, options);
    if (record) {
      let ModelFactory = this.container.factoryFor<Model>(`model:${ modelType }`);
      return ModelFactory.create(record);
    }
    return null;
  }

  async query(modelType: string, query: any, options?: any): Promise<Model[]> {
    debug(`${ modelType } query: ${ query }`);
    assert(query != null, `You must pass a query to Model.query(conditions)`);
    let adapter = this.lookupAdapter(modelType);
    let result = await adapter.query(modelType, query, options);
    let ModelFactory = this.container.factoryFor<Model>(`model:${ modelType }`);
    return result.map((record) => {
      return ModelFactory.create(record);
    });
  }

  async all(modelType: string, options?: any): Promise<Model[]> {
    debug(`${ modelType } all`);
    let adapter = this.lookupAdapter(modelType);
    let result = await adapter.all(modelType, options);
    let ModelFactory = this.container.factoryFor<Model>(`model:${ modelType }`);
    return result.map((record) => {
      return ModelFactory.create(record);
    });
  }

  create(modelType: string, data: any, options?: any): Model {
    return this.container.factoryFor<Model>(`model:${ modelType }`).create(data, options);
  }

  protected lookupAdapter(modelType: string) {
    return this.container.lookup<ORMAdapter>(`orm-adapter:${ modelType }`, { loose: true }) || this.container.lookup<ORMAdapter>('orm-adapter:application');
  }

}
