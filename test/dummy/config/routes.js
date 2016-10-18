export default function drawRoutes(router) {

  router.get('/', 'index');

  /*
   * # Single routes
   *
   * If you have some custom endpoint you want to create, you can always add it
   * via the basic routing DSL:
   *
   *   router.post('/foo', 'foo')
   *          └┬─┘ └┬───┘  └┬──┘
   *           │    │       │
   *           │    │       └ action
   *           │    └ URL pattern
   *           └ HTTP method
   *
   * That will create an endpoint that responds to a POST /foo, and triggers the
   * `foo` action.
   *
   * Nested actions can be references via their path:
   *
   *   router.post('/comments/:id/replies', 'comments/replies/create')
   *
   *
   * # Resources
   *
   * Single routes are useful, but Denali's real power comes from resources.
   * Using just:
   *
   *   router.resource('book')
   *
   * sets up the following routes mapped to actions in the `books/` folder:
   *
   * Method  | URL                                               | Action
   * --------|---------------------------------------------------|-------
   * GET     | /books                                            | list
   * POST    | /books                                            | create
   * GET     | /books/:book_id                                   | show
   * PATCH   | /books/:book_id                                   | update
   * DELETE  | /books/:book_id                                   | destroy
   * GET     | /books/:book_id/:relationship_name                | fetch[relationshipName]
   * GET     | /books/:book_id/relationships/:relationship_name  | fetch[relationshipName]Relationship
   * POST    | /books/:book_id/relationships/:relationship_name  | add[relationshipName]Relationship
   * PATCH   | /books/:book_id/relationships/:relationship_name  | replace[relationshipName]Relationship
   * DELETE  | /books/:book_id/relationships/:relationship_name  | remove[relationshipName]Relationship
   *
   */

}
