const _ = require('lodash');
const drivers = require('../drivers');
const makeCipher = require('../lib/makeCipher');

class Connections {
  /**
   * @param {*} nedb
   * @param {import('../lib/config')} config
   */
  constructor(nedb, config) {
    this.nedb = nedb;
    this.config = config;
    const { cipher, decipher } = makeCipher(config.get('passphrase'));
    this.cipher = cipher;
    this.decipher = decipher;
  }

  decipherConnection(connection) {
    if (connection.username) {
      connection.username = this.decipher(connection.username);
    }
    if (connection.password) {
      connection.password = this.decipher(connection.password);
    }
    return connection;
  }

  async findAll() {
    let connectionsFromDb = await this.nedb.connections.find({});
    connectionsFromDb = connectionsFromDb.map(conn => {
      conn.editable = true;
      return this.decipherConnection(conn);
    });

    const allConnections = connectionsFromDb.concat(
      this.config.getConnections()
    );
    return _.sortBy(allConnections, c => c.name.toLowerCase());
  }

  async findOneById(id) {
    const connection = await this.nedb.connections.findOne({ _id: id });
    if (connection) {
      connection.editable = true;
      return this.decipherConnection(connection);
    }

    // If connection was not found in db try env
    const connectionFromEnv = this.config
      .getConnections()
      .find(connection => connection._id === id);

    return connectionFromEnv;
  }

  async removeOneById(id) {
    return this.nedb.connections.remove({ _id: id });
  }

  async save(connection) {
    if (!connection) {
      throw new Error('connections.save() requires a connection');
    }

    connection.username = this.cipher(connection.username || '');
    connection.password = this.cipher(connection.password || '');

    if (!connection.createdDate) {
      connection.createdDate = new Date();
    }
    connection.modifiedDate = new Date();

    connection = drivers.validateConnection(connection);
    const { _id } = connection;

    if (_id) {
      await this.nedb.connections.update({ _id }, connection, {});
      return this.findOneById(_id);
    }
    const newDoc = await this.nedb.connections.insert(connection);
    return this.findOneById(newDoc._id);
  }
}

module.exports = Connections;
