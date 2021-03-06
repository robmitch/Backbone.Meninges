describe("meninges models", function () {

  var data = function () {
    // nested model (configuration) with collection (roles) 
    // of models with collections (authorizations) of models
    return {
      id: 1,
      configuration: {
        feature_toggles: [
          {
            key: 'awesomeness1',
            enabled: 'on'
          }, 
          {
            key: 'awesomeness2',
            enabled: 'off'
          }
        ],
        roles: [
          {
            name: "this and that",
            authorizations: [
              {
                name: "do this",
                value: "yes"
              },
              {
                name: "do that", 
                value: "no"
              }
            ]
          }, 
          {
            name: "here and there", 
            authorizations: [
              {
                name: "come here", 
                value: "yes"
              }, 
              {
                name: "go there", 
                value: "no"
              }
            ]
          }
        ]
      } 
    };
  };
  
  window.SomeApp = {};

  SomeApp.FeatureToggle = Backbone.Model.extend({
  });

  SomeApp.FeatureToggles = Backbone.Collection.extend({
    model: SomeApp.FeatureToggle
  });

  SomeApp.Authorization = Backbone.Model.extend({
    equals: function (json) {
      // try {
        return this.get("name") == json.name;
      // } catch (e) {
      //   return false;
      // }
    }
  });
  
  SomeApp.Authorizations = Backbone.Collection.extend({
    model: SomeApp.Authorization
  });
  
  SomeApp.Role = Backbone.MeningesModel.extend({
    associations: {
      "authorizations": {model: "SomeApp.Authorizations"}
    },

    equals: function (json) {
      try {
        return this.get("name") == json.name;
      } catch(e) {
        return false;
      }
    }
  });

  SomeApp.Roles = Backbone.Collection.extend({
    model: SomeApp.Role
  });

  SomeApp.Configuration = Backbone.MeningesModel.extend({
    associations: {
      "roles": {model: "SomeApp.Roles"},
      "feature_toggles": {model: "SomeApp.FeatureToggles"}
    }
  });

  SomeApp.TopLevel = Backbone.MeningesModel.extend({
    associations: {
      "configuration": {model: "SomeApp.Configuration"}
    }
  });

  SomeApp.Permission = Backbone.MeningesModel.extend({
    associations: {
      "authorization": {model: "SomeApp.Authorization"} 
    },
    
    equals: function (json) {
      return this.get('authorization').equals(json.authorization);
    }
    
  });

  SomeApp.Permissions = Backbone.Collection.extend({
    model: SomeApp.Permission
  });

  SomeApp.Security = Backbone.MeningesModel.extend({
    associations: {
      "permissions": {model: "SomeApp.Permissions"}
    }
  });

  var testDeepNesting = function (topLevel) {
    it("should load nested models", function () {
      expect(topLevel.get("configuration").get).toBeDefined();
    });
    
    it("should load nested collections", function () {
      expect(topLevel.get("configuration").get("roles").at).toBeDefined();
    });
    
    it("should load model in the nested collections", function () {
      expect(topLevel.get("configuration").get("roles").at(0).get).toBeDefined();
    });

    it("should load collections under models in nested collections", function () {
      expect(topLevel.get("configuration").get("roles").at(0).get("authorizations").at).toBeDefined();
    });

    it("should load models in collections under models in nested collections", function () {
      expect(topLevel.get("configuration").get("roles").at(0).get("authorizations").at(0).get).toBeDefined();
    });
  };
  
  describe("constructor", function () {
    testDeepNesting(new SomeApp.TopLevel(data()));
  });

  describe("fetch and save, via set and parse", function () {

    var topLevel = new SomeApp.TopLevel();
    topLevel.set(topLevel.parse(data()));
    testDeepNesting(topLevel);

    it("should update nested models when set is called with partial update", function() {
      topLevel.set(topLevel.parse({ configuration: { feature_toggles: [ { key: 'new_key', enabled: 'on' } ] } }));

      var featureToggles = topLevel.get("configuration").get("feature_toggles");
      expect(featureToggles.length).toBe(1);
      expect(featureToggles.at(0).get('key')).toBe("new_key");
    });

  });

  describe("re-using existing nested objects when parsing is called", function () {

    var topLevel;
    var configuration;
    var roles;
    var firstRole;
    var authorizations;
    var firstAuthorization;

    beforeEach(function () {
      topLevel = new SomeApp.TopLevel(data());
      configuration = topLevel.get("configuration");
      roles = configuration.get("roles");
      firstRole = roles.at(0);
      authorizations = firstRole.get("authorizations");
      firstAuthorization = authorizations.at(0);
    });

    it("should re-use the existing nested models when set is called", function () {
      topLevel.set(topLevel.parse(data()));
      expect(configuration).toEqual(topLevel.get("configuration"));
      expect(roles).toEqual(topLevel.get("configuration").get("roles"));
      expect(firstRole).toEqual(topLevel.get("configuration").get("roles").at(0));
      expect(firstAuthorization).toEqual(topLevel.get("configuration").get("roles").at(0).get("authorizations").at(0));
    });

    it("should re-use the same objects but update their attributes", function () {
      var newData = data();
      newData.configuration.roles[0].authorizations[0].value = "no";
      topLevel.set(topLevel.parse(newData));
      expect(firstAuthorization).toEqual(topLevel.get("configuration").get("roles").at(0).get("authorizations").at(0));
      expect(topLevel.get("configuration").get("roles").at(0).get("authorizations").at(0).get("value")).toEqual("no");
    });

    it("should remove the nested collection elements that match no incoming data", function () {
      var d = data();
      var authorizations = d.configuration.roles[0].authorizations;
      authorizations.splice(0, 1);
      topLevel.set(topLevel.parse(d));
      expect(topLevel.get("configuration").get("roles").at(0).get("authorizations").length).toEqual(1);
    });

    it("should remove the nested models that match no incoming data", function () {
      var lessData = {
        id: 1,
        configuration: {
          name: "empty"
        }
      };
      topLevel.set(topLevel.parse(lessData));
      expect(topLevel.get("configuration").get("name")).toEqual("empty");
      expect(topLevel.get("configuration").get("roles")).not.toBeDefined();
    });

    it("should add new nested models as they come through", function () {
      var da = data();
      var auths = da.configuration.roles[0].authorizations;
      auths.push({name: "something new", value: "peut etre"});
      topLevel.set(topLevel.parse(da));
      expect(topLevel.get("configuration").get("roles").at(0).get("authorizations").length).toEqual(3);
      expect(topLevel.get("configuration").get("roles").at(0).get("authorizations").at(2).get("value")).toEqual("peut etre");

    });
  });

  describe("update a collection of simple backbone objects", function() {
    var security;
    
    beforeEach(function() {
      var data = {
        permissions : [{
          authorization : {
            name : 'can change'
          }
        },
        {
          authorization : {
            name : 'cannot change'
          }
        }]
      };
      var permissions = new SomeApp.Permissions(data.permissions);
      security = new SomeApp.Security();
      security.set({permissions : permissions}, {silent : true});
      security.set(security.parse(data));
    });
    
    it("works", function() {
      expect(security.get('permissions').length).toEqual(2);
    });
    
  });
  
  describe('clone', function () {
    it('should do a deep clone', function () {
      var original = new SomeApp.TopLevel(data());
      var clone = original.clone();
      original.get('configuration').get('roles').first().set({'name': 'i am a function'});
      expect(clone.get('configuration').get('roles').first().get('name')).toEqual("this and that");
    });
  });
});
