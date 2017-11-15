import {
  forEach
} from 'lodash';
import Application from '../../lib/runtime/application';
import Model from '../../lib/data/model';
import ORMAdapter from '../../lib/data/orm-adapter';
import container, { lookup } from '../../lib/metal/container';

export default {
  name: 'define-orm-models',

  /**
   * Find all models, group them by their orm adapter, then give each adapter the chance to define
   * any internal model representation necessary.
   */
  async initialize(application: Application): Promise<void> {
    let models: { [modelName: string]: typeof Model } = container.lookupAll('model');
    let modelsGroupedByAdapter = new Map<ORMAdapter, typeof Model[]>();
    forEach(models, (ModelClass, modelName) => {
      if (ModelClass.hasOwnProperty('abstract') && ModelClass.abstract) {
        return;
      }
      let Adapter = lookup<ORMAdapter>(`orm-adapter:${ modelName }`, { loose: true }) || container.lookup<ORMAdapter>('orm-adapter:application');
      if (!modelsGroupedByAdapter.has(Adapter)) {
        modelsGroupedByAdapter.set(Adapter, []);
      }
      modelsGroupedByAdapter.get(Adapter).push(ModelClass);
    });
    for (let [Adapter, models] of modelsGroupedByAdapter) {
      if (Adapter.defineModels) {
        await Adapter.defineModels(models);
      }
    }
  }
};
