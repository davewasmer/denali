export default function environmentConfig(environment, appConfig) {
<% if (name.match(/[^A-Za-z_0-9\$]/)) { %>
  appConfig['<%= name %>'] = {
<% } else { %>
  appConfig.<%= name %> = {
<% } %>
  };
}
