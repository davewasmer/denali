import Service from '../runtime/service';
import Model from './model';

export default class DatabaseService extends Service {

  find(modelType: string, id: any, options?: any): Promise<Model|null> {
    let ModelClass = <typeof Model>this.container.factoryFor(`model:${ modelType }`).class;
    return ModelClass.find(this.container, id, options);
  }

  queryOne(modelType: string, query: any, options?: any): Promise<Model|null> {
    let ModelClass = <typeof Model>this.container.factoryFor(`model:${ modelType }`).class;
    return ModelClass.queryOne(this.container, query, options);
  }

  query(modelType: string, query: any, options?: any): Promise<Model[]> {
    let ModelClass = <typeof Model>this.container.factoryFor(`model:${ modelType }`).class;
    return ModelClass.query(this.container, query, options);
  }

  all(modelType: string, options?: any): Promise<Model[]> {
    let ModelClass = <typeof Model>this.container.factoryFor(`model:${ modelType }`).class;
    return ModelClass.all(this.container, options);
  }

  create(modelType: string, data: any, options?: any): Model {
    return this.container.factoryFor(`model:${ modelType }`).create(this.container, data, options);
  }

}
