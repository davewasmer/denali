import * as dedent from 'dedent-js';
import { inspect } from 'util';

export default {

  ////////////
  // Errors //
  ////////////

  ContainerEntryNotFound(specifier: string, registryEntries: string[], resolverNames: string[]) {
    let registrationsOverview;
    if (registryEntries.length > 0) {
      registrationsOverview = dedent`
        Available manual registrations (via container.register(...)):
          - ${ registryEntries.join('\n  - ') }
      `;
    } else {
      registrationsOverview = dedent`
        There were no manually registered entries in the container.
      `;
    }

    let resolversOverview;
    if (resolverNames.length > 0) {
      resolversOverview = dedent`
        Available resolvers:
          - ${ resolverNames.join('\n  - ') }
      `;
    } else {
      resolversOverview = dedent`
        There were no resolvers available in the container.
      `;
    }
    return dedent`
      You tried to lookup a container entry under ${ specifier }, but the
      container has no such entry.

      ${ registrationsOverview }

      ${ resolversOverview }

      Run with DEBUG=verbose-denali:resolver:<resolver name> to trace a specific
      resolver's resolution
    `;
  },

  ContainerEntryNotAConstructor(specifier: string, value: any) {
    let str = dedent`
      You flagged ${ specifier } as a singleton, so the container expected to
      a constructor function under that entry.
    `;
    if (value === undefined) {
      str += dedent`
        Instead it found 'undefined'. Did you forget to add 'export default'
        to a file?
      `;
    } else {
      str += dedent`
        Instead it found:

        ${ inspect(value) }
      `;
    }
    return str;
  }

};
