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
 * @class HasOneRelationship
 * @constructor
 * @module denali
 * @submodule data
 */
class HasOneRelationship {

  isRelationship = true;
  mode = 'hasOne';
  type;
  options;

  constructor(type, options = {}) {
    this.type = type;
    this.options = options;
  }

}

export default function hasOne() {
  return new HasOneRelationship(...arguments);
}
