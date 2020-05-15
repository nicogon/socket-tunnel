'use strict';

const IDLE_SOCKET_TIMEOUT_MILLISECONDS = 1000 * 30;

module.exports = (options) => {
  return new Promise((resolve, reject) => {
    // require the things we need
    const net = require('net');
    const ss = require('socket.io-stream');
    let socket = require('socket.io-client')(options['server'],{
      transports: ['websocket']
    });

    socket.on('connect', () => {
      console.log(new Date() + ': connected');

      socket.emit('createTunnel', (err) => {
        if (err) {
          console.log(new Date() + ': [error] ' + err);

          reject(err);
        } else {
          console.log(new Date() + ': registered with server successfully');

          // clean and concat requested url
          let url;
     
          let server = options['server'].toString();

          if (server.includes('https://')) {
            url = `https://${server.slice(8)}`;
          } else if (server.includes('http://')) {
            url = `http://${server.slice(7)}`;
          } else {
            url = `https://${server}`;
          }

          // resolve promise with requested URL
          resolve(url);
        }
      });
    });

    socket.on('incomingClient', (clientId) => {
      let client = net.connect(options['port'], options['hostname'], () => {
        let s = ss.createStream();
        s.pipe(client).pipe(s);

        s.on('end', () => {
          client.destroy();
        });

        ss(socket).emit(clientId, s);
      });

      client.setTimeout(IDLE_SOCKET_TIMEOUT_MILLISECONDS);
      client.on('timeout', () => {
        client.end();
      });

      client.on('error', () => {
        // handle connection refusal (create a stream and immediately close it)
        let s = ss.createStream();
        ss(socket).emit(clientId, s);
        s.end();
      });
    });
  });
};
