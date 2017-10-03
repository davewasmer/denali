import DenaliObject from '../metal/object';
import Model from './model';
import { RelationshipDescriptor } from './descriptors';

/**
 * The ORMAdapter class is responsible for enabling Denali to communicate with the ORM of your
 * choice. It does this by boiling down the possible actions that a user might before against a
 * Model that would involve persistence into a set of basic operations. Your adapter then implements
 * these operations, and Denali can build on top of that.
 *
 * @package data
 */
abstract class ORMAdapter extends DenaliObject {

  /**
   * The current test transaction, if applicable
   */
  testTransaction: any;

  /**
   * Find a record by id.
   */
  abstract async find(type: string, id: any, options: any): Promise<any>;

  /**
   * Find a single record that matches the given query.
   */
  abstract async queryOne(type: string, query: any, options: any): Promise<any>;

  /**
   * Find all records of this type.
   */
  abstract async all(type: string, options: any): Promise<any[]>;

  /**
   * Find all records that match the given query.
   */
  abstract async query(type: string, query: any, options: any): Promise<any[]>;

  /**
   * Return the id for the given model.
   */
  abstract idFor(model: Model): any;

  /**
   * Set the id for the given model.
   */
  abstract setId(model: Model, value: any): void;

  /**
   * Build an internal record instance of the given type with the given data. Note that this method
   * should return the internal, ORM representation of the record, not a Denali Model.
   */
  abstract buildRecord(type: string, data: any, options: any): any;

  /**
   * Return the value for the given attribute on the given record.
   */
  abstract getAttribute(model: Model, attribute: string): any;

  /**
   * Set the value for the given attribute on the given record.
   *
   * @returns returns true if set operation was successful
   */
  abstract setAttribute(model: Model, attribute: string, value: any): boolean;

  /**
   * Delete the value for the given attribute on the given record. The semantics of this may behave
   * slightly differently depending on backend - SQL databases may NULL out the value, while
   * document stores like Mongo may actually delete the key from the document (rather than just
   * nulling it out)
   *
   * @returns returns true if delete operation was successful
   */
  abstract deleteAttribute(model: Model, attribute: string): boolean;

  /**
   * Return the related record(s) for the given relationship.
   *
   * @param model The model whose related records are being fetched
   * @param relationship The name of the relationship on the model that should be fetched
   * @param descriptor The RelationshipDescriptor of the relationship being fetch
   * @param query An optional query to filter the related records by
   */
  abstract async getRelated(model: Model, relationship: string, descriptor: RelationshipDescriptor, options: any): Promise<any|any[]>;

  /**
   * Set the related record(s) for the given relationship. Note: for has-many relationships, the
   * entire set of existing related records should be replaced by the supplied records. The old
   * related records should be "unlinked" in their relationship. Whether that results in the
   * deletion of those old records is up to the ORM adapter, although it is recommended that they
   * not be deleted unless the user has explicitly expressed that intent.
   *
   * @param model The model whose related records are being altered
   * @param relationship The name of the relationship on the model that should be altered
   * @param descriptor The RelationshipDescriptor of the relationship being altered
   * @param related The related record(s) that should be linked to the given relationship
   */
  abstract async setRelated(model: Model, relationship: string, descriptor: RelationshipDescriptor, related: any, options: any): Promise<void>;

  /**
   * Add related record(s) to a hasMany relationship. Existing related records should remain
   * unaltered.
   *
   * @param model The model whose related records are being altered
   * @param relationship The name of the relationship on the model that should be altered
   * @param descriptor The RelationshipDescriptor of the relationship being altered
   * @param related The related record(s) that should be linked to the given relationship
   */
  abstract async addRelated(model: Model, relationship: string, descriptor: RelationshipDescriptor, related: Model|Model[], options: any): Promise<void>;

  /**
   * Remove related record(s) from a hasMany relationship. Note: The removed related records should
   * be "unlinked" in their relationship. Whether that results in the deletion of those old records
   * is up to the ORM adapter, although it is recommended that they not be deleted unless the user
   * has explicitly expressed that intent.
   *
   * @param model The model whose related records are being altered
   * @param relationship The name of the relationship on the model that should be altered
   * @param descriptor The RelationshipDescriptor of the relationship being altered
   * @param related The related record(s) that should be removed from the relationship; if not
   *                provided, then all related records should be removed
   */
  abstract async removeRelated(model: Model, relationship: string, descriptor: RelationshipDescriptor, related: Model|Model[]|null, options: any): Promise<void>;

  /**
   * Persist the supplied model.
   */
  abstract async saveRecord(model: Model, options: any): Promise<void>;

  /**
   * Delete the supplied model from the persistent data store.
   */
  abstract async deleteRecord(model: Model, options: any): Promise<void>;

  /**
   * foreignKeyForRelationship can be used to define a custom key when retrieving a relationship from the database.
   * By default OrmAdapter uses camelCase.
   * e.x. postId
   * @param model to be used to get the model type name from.
   */
  foreignKeyForRelationship?(model: Model): string;

  /**
   * Takes an array of Denali Models and defines an ORM specific model class, and/or any other ORM
   * specific setup that might be required for that Model.
   */
  async defineModels?<T extends typeof Model>(models: T[]): Promise<void>;

  /**
   * Start a transaction that will wrap a test, and be rolled back afterwards. If the data store
   * doesn't support transactions, just omit this method. Only one test transaction will be opened
   * per process, and the ORM adapter is responsible for keeping track of that transaction so it
   * can later be rolled back.
   */
  async startTestTransaction?(): Promise<void>;

  /**
   * Roll back the test transaction.
   */
  async rollbackTestTransaction?(): Promise<void>;

}

export default ORMAdapter;
