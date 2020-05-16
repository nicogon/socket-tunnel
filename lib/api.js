// client api
const client = require('../client');

let api = {
  connect: (server, port, hostname = '127.0.0.1') => {
    if (!server  || !port || !hostname) {
      return Promise.reject(new Error('One or more options were not provided'));
    }

    let options = {
      server: server,
      port: port.toString(),
      hostname: hostname
    };

    // client returns a promise
    return client(options);
  }
};

module.exports = api;
