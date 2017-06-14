/**
 * Base Descriptor class
 *
 * @package data
 */
export class Descriptor {

  /**
   * What kind of descriptor is this? Used by subclasses to differentiate easily between types.
   */
  type: string;

  /**
   * Generic options object that can be used to supply Denali or ORM specific config options.
   */
  options: any;

  /**
   * Creates an instance of Descriptor.
   */
  constructor(type: string, options: any = {}) {
    this.type = type;
    this.options = options;
  }

}

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
   */
  isAttribute = true;

}

/**
 * Syntax sugar factory method for creating Attributes
 *
 * @package data
 * @since 0.1.0
 */
export function attr(type: string, options?: any): AttributeDescriptor {
  return new AttributeDescriptor(type, options);
}


/**
 * The HasManyRelationship class is used to describe a 1 to many or many to many
 * relationship on your Model. You shouldn't use the HasManyRelationship class
 * directly; instead, import the `hasMany()` method from Denali, and use it to
 * define a relationship:
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
   */
  isRelationship = true;

  /**
   * Relationship mode, i.e. 1 -> 1 or 1 -> N
   */
  mode: 'hasMany' | 'hasOne' = 'hasMany';

}

/**
 * Syntax sugar factory function for creating HasManyRelationships
 *
 * @package data
 * @since 0.1.0
 */
export function hasMany(type: string, options?: any): HasManyRelationshipDescriptor {
  return new HasManyRelationshipDescriptor(type, options);
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
   */
  isRelationship = true;

  /**
   * Relationship mode, i.e. 1 -> 1 or 1 -> N
   */
  mode: 'hasMany' | 'hasOne' = 'hasOne';

}

/**
 * Syntax sugar factory function for creating HasOneRelationships
 *
 * @package data
 * @since 0.1.0
 */
export function hasOne(type: string, options?: any): HasOneRelationshipDescriptor {
  return new HasOneRelationshipDescriptor(type, options);
}

export type RelationshipDescriptor = HasManyRelationshipDescriptor | HasOneRelationshipDescriptor;
