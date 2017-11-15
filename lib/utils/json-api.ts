export interface Document {
  data?: ResourceObject | ResourceObject[] | ResourceIdentifier | ResourceIdentifier[];
  errors?: ErrorObject[];
  meta?: Meta;
  jsonapi?: { version: string };
  links?: Links;
  included?: ResourceObject[];
}

export interface ErrorObject {
  /**
   * A unique identifier for this particular occurrence of the problem
   */
  id?: string;
  links?: {
    /**
     * A link that leads to further details about this particular occurrence of the problemA
     */
    about?: Link;
  };
  /**
   * The HTTP status code applicable to this problem, expressed as a string value
   */
  status?: string;
  /**
   * An application-specific error code, expressed as a string value
   */
  code?: string;
  /**
   * A short, human-readable summary of the problem that SHOULD NOT change from occurrence to
   * occurrence of the problem, except for purposes of localization
   */
  title?: string;
  /**
   * A human-readable explanation specific to this occurrence of the problem. Like title, this
   * field’s value can be localized
   */
  detail?: string;
  /**
   * An object containing references to the source of the error
   */
  source?: {
    /**
     * A JSON Pointer [RFC6901] to the associated entity in the request document [e.g. "/data" for a
     * primary data object, or "/data/attributes/title" for a specific attribute]
     */
    pointer?: string;
    /**
     * A string indicating which URI query parameter caused the error
     */
    parameter?: string;
  };
  meta?: Meta;
}

export interface ResourceObject {
  id: string;
  type: string;
  attributes?: Attributes;
  relationships?: Relationships;
  links?: Links;
  meta?: Meta;
}

export interface Attributes {
  [key: string]: any;
}

export interface Relationships {
  [relationshipName: string]: Relationship;
}

export interface Relationship {
  /**
   * Links for this relationship. Should contain at least a "self" or "related" link.
   */
  links?: Links;
  data?: RelationshipData;
  meta?: Meta;
}

export type RelationshipData = ResourceIdentifier | ResourceIdentifier[];

export interface ResourceIdentifier {
  id: string;
  type: string;
  meta?: Meta;
}

export interface Meta {
  [key: string]: any;
}

export interface Links {
  /**
   * A link for the resource or relationship itself. This link allows the client to directly
   * manipulate the resource or relationship. For example, removing an author through an article’s
   * relationship URL would disconnect the person from the article without deleting the people
   * resource itself. When fetched successfully, this link returns the linkage for the related
   * resources as its primary data
   */
  self?: Link;
  /**
   * A “related resource link” provides access to resource objects linked in a relationship. When
   * fetched, the related resource object(s) are returned as the response’s primary data.
   */
  related?: Link;
  [key: string]: Link;
}

export type Link = string | {
  href: string,
  meta: Meta
};
