var should = require('should')
var Store = require('../../../store/postgres')

describe('Postgres: UUID Key', function(){
  var store
  var database = 'uuid_key_test'



  before(function(next){
    this.timeout(5000)
    beforePG(database, [
      'CREATE EXTENSION IF NOT EXISTS \\"uuid-ossp\\"',
      'CREATE TABLE uuid_tests (id uuid not null primary key default uuid_generate_v1(), another_column varchar(255))'
    ], next)
  })

  before(function(){
    store = new Store({
      host: 'localhost',
      type: 'postgres',
      database: database,
      user: 'postgres',
      password: ''
    })

    store.Model('UuidTest', function(){})

    store.setMaxListeners(0)
    store.on('exception', function(){})
  })

  after(function(next){
    afterPG(database, next)
  })

  it('attribute id is type uuid', function(next){
    store.ready(function(){
      var UuidTest = store.Model('UuidTest')
      UuidTest.definition.attributes.id.type.name.should.be.equal('uuid')
      next()
    })
  })

  it('new() returns a null id (uuid)', function(next){
    store.ready(function(){
      var UuidTest = store.Model('UuidTest')
      var test = new UuidTest({ another_column: 'i am setting uuid' })
      should.not.exist(test.id)
      next()
    })
  })

  it('create() returns a new id (uuid)', function(next){
    store.ready(function(){
      var UuidTest = store.Model('UuidTest')
      var test = new UuidTest({ another_column: 'i am setting uuid' })

      test.save(function(success) {
        should.exist(test.id)
        success.should.be.equal(true)
        next()
      })
    })
  })
})
