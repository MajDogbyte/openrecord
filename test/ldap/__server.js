var ldap = require('ldapjs');

var SUFFIX = 'dc=test';
var db = {
  'dc=test': {},
  'cn=phil, dc=test': {
    username: 'phil',
    type: 'user',
    age: 26
  },
  'cn=michl, dc=test': {
    username: 'michl',
    type: 'user',
    age: 29
  },
  'ou=others, dc=test': {
    name: 'Others',
    type: 'ou'
  },
  'cn=susi, ou=others, dc=test': {
    username: 'Susi',
    type: 'user',
    age: 25
  },
  'cn=max, ou=others, dc=test': {
    username: 'Max',
    type: 'user',
    age: 47
  }
  
};



before(function(done){

  ///--- Globals
  
  
  var server = ldap.createServer();
  
  server.bind('cn=root', function (req, res, next) {
    if (req.dn.toString() !== 'cn=root' || req.credentials !== 'secret')
      return next(new ldap.InvalidCredentialsError());
  
    res.end();
    return next();
  });
  
  server.add(SUFFIX, authorize, function (req, res, next) {
    var dn = req.dn.toString();
  
    if (db[dn])
      return next(new ldap.EntryAlreadyExistsError(dn));
  
    db[dn] = req.toObject().attributes;
    res.end();
    return next();
  });
  
  server.bind(SUFFIX, function (req, res, next) {
    var dn = req.dn.toString();
    if (!db[dn])
      return next(new ldap.NoSuchObjectError(dn));
  
    if (!db[dn].userpassword)
      return next(new ldap.NoSuchAttributeError('userPassword'));
  
    if (db[dn].userpassword.indexOf(req.credentials) === -1)
      return next(new ldap.InvalidCredentialsError());
  
    res.end();
    return next();
  });
  
  server.compare(SUFFIX, authorize, function (req, res, next) {
    var dn = req.dn.toString();
    if (!db[dn])
      return next(new ldap.NoSuchObjectError(dn));
  
    if (!db[dn][req.attribute])
      return next(new ldap.NoSuchAttributeError(req.attribute));
  
    var matches = false;
    var vals = db[dn][req.attribute];
    for (var i = 0; i < vals.length; i++) {
      if (vals[i] === req.value) {
        matches = true;
        break;
      }
    }
  
    res.end(matches);
    return next();
  });
  
  server.del(SUFFIX, authorize, function (req, res, next) {
    var dn = req.dn.toString();
    if (!db[dn])
      return next(new ldap.NoSuchObjectError(dn));
  
    delete db[dn];
  
    res.end();
    return next();
  });
  
  server.modify(SUFFIX, authorize, function (req, res, next) {
    var dn = req.dn.toString();
    if (!req.changes.length)
      return next(new ldap.ProtocolError('changes required'));
    if (!db[dn])
      return next(new ldap.NoSuchObjectError(dn));
  
    var entry = db[dn];
  
    for (var i = 0; i < req.changes.length; i++) {
      mod = req.changes[i].modification;
      switch (req.changes[i].operation) {
      case 'replace':
        if (!entry[mod.type])
          return next(new ldap.NoSuchAttributeError(mod.type));
  
        if (!mod.vals || !mod.vals.length) {
          delete entry[mod.type];
        } else {
          entry[mod.type] = mod.vals;
        }
  
        break;
  
      case 'add':
        if (!entry[mod.type]) {
          entry[mod.type] = mod.vals;
        } else {
          mod.vals.forEach(function (v) {
            if (entry[mod.type].indexOf(v) === -1)
              entry[mod.type].push(v);
          });
        }
  
        break;
  
      case 'delete':
        if (!entry[mod.type])
          return next(new ldap.NoSuchAttributeError(mod.type));
  
        delete entry[mod.type];
  
        break;
      }
    }
  
    res.end();
    return next();
  });
  
  server.search(SUFFIX, authorize, function (req, res, next) {
    var dn = req.dn.toString();

    if (!db[dn])
      return next(new ldap.NoSuchObjectError(dn));
  
    var scopeCheck;
  
    switch (req.scope) {
    case 'base':
      if (req.filter.matches(db[dn])) {
        res.send({
          dn: dn,
          attributes: db[dn]
        });
      }
  
      res.end();
      return next();
  
    case 'one':
      scopeCheck = function (k) {
        if (req.dn.equals(k))
          return true;
  
        var parent = ldap.parseDN(k).parent();
        return (parent ? parent.equals(req.dn) : false);
      };
      break;
  
    case 'sub':
      scopeCheck = function (k) {
        return (req.dn.equals(k) || req.dn.parentOf(k));
      };
  
      break;
    }

    Object.keys(db).forEach(function (key) {
      if (!scopeCheck(key))
        return;
        
      if (req.filter.matches(db[key])) {
        res.send({
          dn: key,
          attributes: db[key]
        });
      }
    });
  
    res.end();
    return next();
  });

  server.listen(1389, function () {
    done();
  });
});



///--- Shared handlers

function authorize(req, res, next) {
  /* Any user may search after bind, only cn=root has full power */
  var isSearch = (req instanceof ldap.SearchRequest);
  if (!req.connection.ldap.bindDN.equals('cn=root') && !isSearch)
    return next(new ldap.InsufficientAccessRightsError());

  return next();
}