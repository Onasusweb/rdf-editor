(function($) {

  VAL = function(config) {
    this.config = jQuery.extend({
      "host": window.location.protocol + '//' + window.location.host,
      "valApi": "/val/api",
      "loginLink": "/val/authenticate.vsp",
      "logoutLink": "/val/logout.vsp"
    },
    config);
  };

  /**
   * Get the user profile. The only parameter is a callback function which
   * takes two parameters: a boolean indicating success and a second which
   * in the case of success contains the profile as an object (see below)
   * and in the case of an error contains the error message.
   *
   * The profile object contains at least the personal "uri" and optionally
   * the "nick" nickname, the "name" and an "image" url.
   */
  VAL.prototype.installed = function(cb) {
    var self = this;

    $.get(this.config.host + this.config.logoutLink).done(function() {
      cb(true);
    }).fail(function() {
      cb(false);
    });
  }

  /**
   * Get the user profile. The only parameter is a callback function which
   * takes two parameters: a boolean indicating success and a second which
   * in the case of success contains the profile as an object (see below)
   * and in the case of an error contains the error message.
   *
   * The profile object contains at least the personal "uri" and optionally
   * the "nick" nickname, the "name" and an "image" url.
   */
  VAL.prototype.profile = function(cb) {
    var self = this;

    $.get(this.config.host + this.config.valApi + "/profile").done(function(data) {
      self.config.valInstalled = false;
      new rdfstore.create(function(error, store) {
        store.registerDefaultProfileNamespaces();
        store.load('text/turtle', data, function(error, result) {
          self.config.valInstalled = true;
          if (!error) {
            store.execute(
              'select ?uri ?name ?img ?nick where { ?x foaf:topic ?uri . ?uri a foaf:Agent . optional { ?uri foaf:name ?name . } . optional { ?uri foaf:nick ?nick . } . optional { ?uri foaf:img ?img . } . }',
              function(error, result) {
                // console.log(result);
                if (!error && result.length > 0) {
                  var p = {
                    "uri": result[0].uri.value
                  };
                  if(result[0].name) {
                    p.name = result[0].name.value;
                  }
                  if(result[0].img) {
                    p.image = result[0].img.value;
                  }
                  if(result[0].nick) {
                    p.nick = result[0].nick.value;
                  }

                  store.execute(
                    'select ?storage where { <' + p.uri + '> <http://www.w3.org/ns/pim/space#storage> ?storage . }',
                    function(error, result) {
                      if (!error) {
                        for (var i = 0; i < result.length; i++) {
                          if (result[i].storage) {
                            (p.storage = p.storage || []).push({
                              uri: result[i].storage.value
                            });
                          }
                        }
                      }

                      store.execute(
                        'select ?namedGraph ?sparqlEndpoint where { <' + p.uri + '> <http://www.openlinksw.com/schemas/cert#hasDBStorage> ?namedGraph . ?namedGraph <http://rdfs.org/ns/void#sparqlEndpoint> ?sparqlEndpoint . }',
                        function(error, result) {
                          if (!error) {
                            for (var i = 0; i < result.length; i++) {
                              if (result[i].namedGraph && result[i].sparqlEndpoint) {
                                (p.storage = p.storage || []).push({
                                  uri: result[i].namedGraph.value,
                                  sparqlEndpoint: result[i].sparqlEndpoint.value
                                });
                              }
                            }
                          }

                          self.profileData = p;
                          cb(true, p);
                        }
                      );
                    }
                  );
                }
                else {
                  cb(false, "Failed to query the user profile.");
                }
              }
            );
          }
          else {
            cb(false, "Failed to load the profile contents.");
          }
        });
      });
    }).fail(function(data, status, xhr) {
      self.config.valInstalled = (data.status !== 404);
      cb(false);
    });
  }
  /**
   * Sign content with user's public key. The only parameter is a callback function which
   * takes two parameters: a boolean indicating success and a second which
   * in the case of success contains the profile as an object (see below)
   * and in the case of an error contains the error message.
   *
   * The profile object contains at least the personal "uri" and optionally
   * the "nick" nickname, the "name" and an "image" url.
   */
  VAL.prototype.signature = function(content, callback) {
    var self = this;

    $.get(this.config.host + this.config.valApi + '/signature?content=' + content).done(function(data, status, xhr) {
      callback(data, status, xhr);
    }).fail(function(data, status, xhr) {
      callback(data, status, xhr);
    });
  }

})(jQuery);
