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
 * @class HasManyRelationship
 * @constructor
 * @module denali
 * @submodule data
 */
class HasManyRelationship {

  isRelationship = true;
  mode = 'hasMany';
  type;
  options;

  constructor(type, options = {}) {
    this.type = type;
    this.options = options;
  }

}

export default function hasMany() {
  return new HasManyRelationship(...arguments);
}
