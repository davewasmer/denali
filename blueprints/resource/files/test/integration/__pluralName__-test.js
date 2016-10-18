import expect from 'must';
import { setupApp } from 'denali';

describe('<%= pluralHumanizedName %> resource', () => {

  setupApp();

  describe('POST /<%= pluralHumanizedName %>', () => {
    it('should create a <%= name %>', function() {
      return this.app.post('/<%= pluralName %>', {
          // Add the <%= name %> payload here
      }).then(({ status /* , body */ }) => {
        expect(status).to.equal(201);
      });
    });
  });

  describe('GET /<%= pluralHumanizedName %>', () => {
    it('should list <%= pluralHumanizedName %>', function() {
      return this.app.get('/<%= pluralName %>')
        .then(({ status /* , body */ }) => {
          expect(status).to.equal(200);
        });
    });
  });

  describe('GET /<%= pluralHumanizedName %>/:id', () => {
    before(function() {
      return this.app.post('/<%= pluralName %>', {
          // Add the <%= name %> payload here
      }).then(({ body }) => {
        this.id = body.data.id;
      });
    });
    it('should show a <%= name %>', function() {
      return this.app.get(`/<%= pluralName %>/${ this.id }`)
        .then(({ status /* , body */ }) => {
          expect(status).to.equal(200);
        });
    });
  });

  describe('PATCH /<%= pluralHumanizedName %>/:id', () => {
    before(function() {
      return this.app.post('/<%= pluralName %>', {
          // Add the <%= name %> payload here
      }).then(({ body }) => {
        this.id = body.data.id;
      });
    });
    it('should update a <%= name %>', function() {
      return this.app.patch(`/<%= pluralName %>/${ this.id }`, {
          // Add the <%= name %> payload here
      }).then(({ status /* , body */ }) => {
        expect(status).to.equal(200);
      });
    });
  });

  describe('DELETE /<%= pluralHumanizedName %>/:id', () => {
    before(function() {
      return this.app.post('/<%= pluralName %>', {
          // Add the <%= name %> payload here
      }).then(({ body }) => {
        this.id = body.data.id;
      });
    });
    it('should delete a <%= name %>', function() {
      return this.app.delete(`/<%= pluralName %>/${ this.id }`)
        .then(({ status /* , body */ }) => {
          expect(status).to.equal(204);
        });
    });
  });

});
