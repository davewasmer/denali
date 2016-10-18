import expect from 'must';
import { setupApp } from 'denali';

describe('GET /', function() {

  setupApp();

  it('should return a welcome message', function() {
    return this.app.get('/').then(({ body }) => {
      expect(body.message).to.equal('Welcome to Denali!');
    });
  });

});
