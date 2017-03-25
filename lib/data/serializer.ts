import DenaliObject from '../metal/object';
import { exec } from 'child_process';
import Response from '../runtime/response';
import Container from '../metal/container';

/**
 * Configuration for how a serializer should serialize a relationship
 *
 * @package data
 */
export interface RelationshipConfig {
  strategy?: 'embed' | 'id';
  key?: string;
  serializer?: string;
}

/**
 * Serializers allow you to customize what data is returned in the response and apply simple
 * transformations to it. They allow you to decouple what data is sent from how that data is
 * structured / rendered.
 *
 * @package data
 */
abstract class Serializer extends DenaliObject {

  /**
   * Serializers should be singletons
   */
  static singleton = true;

  /**
   * Take the supplied Response instance and the supplied options and return a rendered a JSON
   * response object.
   */
  public abstract serialize(response: Response, options?: any): Promise<void> | void;

  /**
   * Take a serialized JSON document (i.e. an incoming request body), and perform any normalization
   * required.
   *
   * The return value of this method is entirely up to the specific serializer, i.e. some may return
   * the payload unchanged, others may tweak the structure, or some could even return actual ORM
   * model instances.
   *
   * This method is optional - the default implementation returns the payload unchanged.
   *
   * @param payload The incoming request body
   */
  public parse(payload: any): any {
    return payload;
  }

  /**
   * The list of attribute names that should be serialized. Attributes not included in this list
   * will be omitted from the final rendered payload.
   */
  protected attributes: string[] = [];

  /**
   * An object with configuration on how to serialize relationships. Relationships that have no
   * configuration present are omitted from the final rendered payload.
   *
   * Out of the box, one option is supported:
   *
   * **strategy**
   *
   * It has one of two possible values:
   *
   *   * `embed`: embed all related records in the response payload
   *   * `id`: include only the id of the related record(s)
   *
   * What the embedded records or ids look like is up to each serializer to determine.
   */
  protected relationships: { [ relationshipName: string ]: RelationshipConfig } = {};

}

export default Serializer;
