'use strict';

module.exports = (options) => {
  // libs
  const http = require('http');
  const tldjs = require('tldjs');
  const ss = require('socket.io-stream');
  const uuid = require('uuid/v4');
  const isValidDomain = require('is-valid-domain');

  let proxySocket;

  // bounce incoming http requests to socket.io
  let server = http.createServer(async (req, res) => {
    getTunnelClientStreamForReq(req).then((tunnelClientStream) => {
      const start = new Date();
      console.log("NEW TUNNEL")
      const reqBodyChunks = [];

      req.on('error', (err) => {
        console.error(err.stack);
      });

      // collect body chunks
      req.on('data', (bodyChunk) => {
        reqBodyChunks.push(bodyChunk);
      });

      // proxy finalized request to tunnel stream
      req.on('end', () => {
        // make sure the client didn't die on us
        if (req.complete) {
          const reqLine = getReqLineFromReq(req);
          const headers = getHeadersFromReq(req);

          let reqBody = null;
          if (reqBodyChunks.length > 0) {
            reqBody = Buffer.concat(reqBodyChunks);
          }

          streamResponse(reqLine, headers, reqBody, tunnelClientStream);
          const end = new Date() - start;
          console.info('Execution time: %dms', end)
        }
      });
    }).catch((subdomainErr) => {
      res.statusCode = 502;
      return res.end(subdomainErr.message);
    });
  });

  function getTunnelClientStreamForReq (req) {
    return new Promise((resolve, reject) => {
      const start = new Date();
      console.log("NEW CLIENT")
  
      if (req.connection.tunnelClientStream !== undefined && !req.connection.tunnelClientStream.destroyed) {
        return resolve(req.connection.tunnelClientStream);
      }

      let requestGUID = uuid();

      if(!proxySocket){
        return reject(new Error(`Server is currently unregistered or offline.`));
      }
  
      ss(proxySocket).once(requestGUID, (tunnelClientStream) => {
        req.connection.tunnelClientStream = tunnelClientStream;

        // Pipe all data from tunnel stream to requesting connection
        tunnelClientStream.pipe(req.connection);
        const end = new Date() - start;
        console.info('Execution time CLIENT: %dms', end)
        resolve(tunnelClientStream);
      });

      proxySocket.emit('incomingClient', requestGUID);
    });
  }

  function getReqLineFromReq (req) {
    return `${req.method} ${req.url} HTTP/${req.httpVersion}`;
  }

  function getHeadersFromReq (req) {
    const headers = [];

    for (let i = 0; i < (req.rawHeaders.length - 1); i += 2) {
      headers.push(req.rawHeaders[i] + ': ' + req.rawHeaders[i + 1]);
    }

    return headers;
  }

  function streamResponse (reqLine, headers, reqBody, tunnelClientStream) {
    tunnelClientStream.write(reqLine);
    console.log(reqLine)
    tunnelClientStream.write('\r\n');
    tunnelClientStream.write(headers.join('\r\n'));
    console.log(headers.join('\r\n'))
    tunnelClientStream.write('\r\n\r\n');
    if (reqBody) {
      tunnelClientStream.write(reqBody);
    }
  }

  // socket.io instance
  let io = require('socket.io')(server);
  io.on('connection', (socket) => {
    socket.on('createTunnel', (requestedName, responseCb) => {
      // store a reference to this socket by the subdomain claimed
      proxySocket = socket;
      console.log(new Date() + ' registered successfully');

      if (responseCb) {
        responseCb(null);
      }
    });

    // when a client disconnects, we need to remove their association
    socket.on('disconnect', () => {
        proxySocket = null;
        console.log(new Date() + ': ' + socket.requestedName + ' unregistered');
    });
  });

  // http server
  server.listen(options.port, options.hostname);

  console.log(`${new Date()}: socket-tunnel server started on ${options.hostname}:${options.port}`);
};
