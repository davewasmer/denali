import { Dict } from '../utils/types';

/**
 * Base Descriptor class
 *
 * @package data
 */
export class Descriptor {

  /**
   * Creates an instance of Descriptor.
   */
  constructor(public options: Dict<any> = {}) {}

}

export type BaseAttributeTypes = 'number' | 'string' | 'boolean' | 'date';

/**
 * The Attribute class is used to tell Denali what the available attributes are
 * on your Model. You shouldn't use the Attribute class directly; instead,
 * import the `attr()` method from Denali, and use it to define an attribute:
 *
 *     import { attr } from 'denali';
 *     class Post extends ApplicationModel {
 *       static title = attr('text');
 *     }
 *
 * Note that attributes must be defined as `static` properties on your Model
 * class.
 *
 * The `attr()` method takes two arguments:
 *
 *   * `type` - a string indicating the type of this attribute. Denali doesn't
 *   care what this string is. Your ORM adapter should specify what types it
 *   expects.
 *   * `options` - any additional options for this attribute. At the moment,
 *   these are used solely by your ORM adapter, there are no additional options
 *   that Denali expects itself.
 *
 * @package data
 * @since 0.1.0
 */
export class AttributeDescriptor extends Descriptor {

  /**
   * Convenience flag for checking if this is an attribute
   *
   * @since 0.1.0
   */
  isAttribute = true;

  constructor(public datatype: BaseAttributeTypes | string, options: any) {
    super(options);
  }

}

/**
 * Syntax sugar factory method for creating Attributes
 *
 * @package data
 * @since 0.1.0
 */
export function attr(datatype: BaseAttributeTypes, options?: any): AttributeDescriptor {
  return new AttributeDescriptor(datatype, options);
}


/**
 * The HasManyRelationship class is used to describe a 1 to many or many to
 * many relationship on your Model. You shouldn't use the HasManyRelationship
 * class directly; instead, import the `hasMany()` method from Denali, and use
 * it to define a relationship:
 *
 *     import { hasMany } from 'denali';
 *     class Post extends ApplicationModel {
 *       static comments = hasMany('comment');
 *     }
 *
 * Note that relationships must be defined as `static` properties on your Model
 * class.
 *
 * The `hasMany()` method takes two arguments:
 *
 *   * `type` - a string indicating the type of model for this relationship.
 *   * `options` - any additional options for this attribute. At the moment,
 *   these are used solely by your ORM adapter, there are no additional options
 *   that Denali expects itself.
 *
 * @package data
 * @since 0.1.0
 */
export class HasManyRelationshipDescriptor extends Descriptor {

  /**
   * Convenience flag for checking if this is a relationship
   *
   * @since 0.1.0
   */
  isRelationship = true;

  /**
   * Relationship mode, i.e. 1 -> 1 or 1 -> N
   *
   * @since 0.1.0
   */
  mode = 'hasMany';

  constructor(public relatedModelName: string, options: any) {
    super(options);
  }

}

/**
 * Syntax sugar factory function for creating HasManyRelationships
 *
 * @package data
 * @since 0.1.0
 */
export function hasMany(relatedModelName: string, options?: any): HasManyRelationshipDescriptor {
  return new HasManyRelationshipDescriptor(relatedModelName, options);
}

/**
 * The HasOneRelationship class is used to describe a 1 to many or 1 to 1
 * relationship on your Model. You shouldn't use the HasOneRelationship class
 * directly; instead, import the `hasOne()` method from Denali, and use it to
 * define a relationship:
 *
 *     import { hasOne } from 'denali';
 *     class Post extends ApplicationModel {
 *       static author = hasOne('user');
 *     }
 *
 * Note that relationships must be defined as `static` properties on your Model
 * class.
 *
 * The `hasOne()` method takes two arguments:
 *
 *   * `type` - a string indicating the type of model for this relationship.
 *   * `options` - any additional options for this attribute. At the moment,
 *   these are used solely by your ORM adapter, there are no additional options
 *   that Denali expects itself.
 *
 * @package data
 * @since 0.1.0
 */
export class HasOneRelationshipDescriptor extends Descriptor {

  /**
   * Convenience flag for checking if this is a relationship
   *
   * @since 0.1.0
   */
  isRelationship = true;

  /**
   * Relationship mode, i.e. 1 -> 1 or 1 -> N
   *
   * @since 0.1.0
   */
  mode = 'hasOne';

  constructor(public relatedModelName: string, options: any) {
    super(options);
  }

}

/**
 * Syntax sugar factory function for creating HasOneRelationships
 *
 * @package data
 * @since 0.1.0
 */
export function hasOne(relatedModelName: string, options?: any): HasOneRelationshipDescriptor {
  return new HasOneRelationshipDescriptor(relatedModelName, options);
}

export type RelationshipDescriptor = HasManyRelationshipDescriptor | HasOneRelationshipDescriptor;

export type SchemaDescriptor = AttributeDescriptor | RelationshipDescriptor;