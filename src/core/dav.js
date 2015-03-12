(function($) {
if(!window.RDFE)
  window.RDFE = {};

if(!RDFE.IO) {
  RDFE.IO = {};
}

/**
 * The base class for any type of resource (file or folder)
 */
RDFE.IO.Resource = (function() {
  // constructor
  var c = function(url) {
    this.url = url;
    this.name = decodeURIComponent(url);
    this.name = this.name.match(/([^\/]+)\/?$/)[1];
  };

  // class-inheritance utitity function
  c.inherit = function(cls) {
    // We use an intermediary empty constructor to create an
    // inheritance chain, because using the super class' constructor
    // might have side effects.
    var construct = function () {};
    construct.prototype = this.prototype;
    cls.prototype = new construct;
    cls.prototype.constructor = cls;
    cls.super = this;
    cls.inherit = this.inherit;
    return cls;
  };

  c.prototype.isFolder = function() {
    return this.resType === "folder";
  };

  c.prototype.isFile = function() {
    return this.resType === "file";
  };

  return c;
})();

/**
 * A simple class representing a file.
 */
RDFE.IO.File = (function() {
  var c = RDFE.IO.Resource.inherit(function(url, options) {
    var self = this;

    // call super-constructor
    self.constructor.super.call(this, url);

    self.resType = "file";
    self.dirty = true;

    var defaults = {
    }

    self.options = $.extend({}, defaults, options);
  });

  return c;
})();

/**
 * The base class for any type of folder.
 */
RDFE.IO.Folder = (function() {
  var c = RDFE.IO.Resource.inherit(function(url, options) {
    var self = this;

    // call super-constructor (directly since we have 2 inheritance levels)
    RDFE.IO.Resource.call(this, url);

    self.resType = "folder";
    self.dirty = true;

    // add trailing slash if necessary
    if (self.url.substring(self.url.length-1) != "/") {
      self.url += "/";
    }

    // set the default root url which is the url browsing started at
    self.rootUrl = self.url;

    var defaults = {
    }

    self.options = $.extend({}, defaults, options);
  });

  /**
   * Update the folder contents.
   *
   * @param force If @p true then the contents will always be updated, otherwise only if the folder is @p dirty.
   * @param success An optional callback function which gets the folder itself as a parameter.
   * @param fail An optional callback function which gets the folder itself and an error message as parameters.
   */
  c.prototype.update = function(force, success, fail) {
    if(force || this.dirty) {
      var self = this;
      this.listDir(function() {
        // update the root dir of all children
        $(self.children).each(function() {
          this.rootUrl = self.rootUrl;
        });

        self.dirty = false;

        if(success) {
          success(self);
        }
      }, function(err) {
        if(fail) {
          fail(this, err);
        }
      });
    }
    else {
      success(this);
    }
  };

  /**
   * Filters the files and folders in this folder based on their mimetype.
   * @p cb is a callback function which takes one parameter: a list of
   * resources.
   */
  c.prototype.filterByMimetype = function(mt, cb) {
  }

  return c;
})();


RDFE.IO.WebDavFolder = (function() {
  var c = RDFE.IO.Folder.inherit(function(url, options) {
    var self = this;

    // call super-constructor
    self.constructor.super.call(this, url);

    var defaults = {
    }

    self.options = $.extend({}, defaults, options);
  });

  function parseDavFolder(folder, data) {
    var urlBase = RDFE.Utils.getUrlBase(folder),
        ress = [];

    $(data).find('response').each(function() {
      var res = null,
          $this = $(this);
      var url = urlBase + $this.find('href').text();

      // ignore the details of the listed url itself
      if(url != folder) {
        // the first propstat contains http/200
        var $prop = $($(this).find('propstat').find('prop')[0]);

        if($prop.find('collection').length > 0) {
          res = new RDFE.IO.WebDavFolder(url);
        }
        else {
          res = new RDFE.IO.File(url);
          res.size = parseInt($prop.find('getcontentlength').text());
          res.dirty = false; // we already got all the properties below
        }

        var tmp = $prop.find('creationdate');
        if (tmp.length) { res.creationDate = new Date(tmp.text()); }
        tmp = $prop.find("getlastmodified");
        if (tmp.length) { res.modificationDate = new Date(tmp.text()); }

        /* perms, uid, gid */
        tmp = $prop.find("virtpermissions");
        if (tmp.length) { res.permissions = tmp.text(); }
        tmp = $prop.find("virtowneruid");
        if (tmp.length) { res.uid = tmp.text(); }
        tmp = $prop.find("virtownergid");
        if (tmp.length) { res.gid = tmp.text(); }

        /* type & length */
        tmp = $prop.find("getcontenttype");
        if (tmp.length) { res.mimeType = tmp.text(); }
        tmp = $prop.find("getcontentlength");
        if (tmp.length) { res.size = parseInt(tmp.text()); }

        ress.push(res);
      }
    });

    return ress;
  }

  c.prototype.listDir = function(success, fail) {
    var self = this,
        body = '<?xml version="1.0" encoding="utf-8" ?>' +
      '<propfind xmlns="DAV:"><prop>' +
      '<creationdate/><getlastmodified/><href/>' +
      '<resourcetype/><getcontentlength/><getcontenttype/>' +
      '<virtpermissions xmlns="http://www.openlinksw.com/virtuoso/webdav/1.0/"/>' +
      '<virtowneruid xmlns="http://www.openlinksw.com/virtuoso/webdav/1.0/"/>' +
      '<virtownergid xmlns="http://www.openlinksw.com/virtuoso/webdav/1.0/"/>' +
      '</prop></propfind>';

    var ref = function(data) {
      self.children = parseDavFolder(self.url, data);
      if (!self.children) {
        fail('Failed to parse WebDAV result for "' + self.url + '".');
      }
      else {
        success();
      }
    }

    $.ajax({
      url: this.url,
      method: "PROPFIND",
      contentType: "text/xml",
      data: body,
      dataType: "xml"
    }).done(ref).fail(function() {
      fail('Failed to list WebDAV folder for "' + self.url + '".');
    });
  }

  return c;
}());

})(jQuery);
