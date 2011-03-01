// Require HTTP module (to start server) and Socket.IO
var http = require('http'),
    io = require('socket.io'),
    sys = require("sys"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    spawn = require("child_process").spawn,
    events = require("events");

var foo = '';
// Start the server at port 9090
var server = http.createServer(function(req, res){
  req.content = '';
  var uri = url.parse(req.url).pathname;

  if( paths[uri] == undefined ) {
    load_static_file(uri,res);
  } else {
    paths[uri].apply(this, [req,res]);
  }
});

server.listen(9090);

paths = {
  '/' : function(req,res){
    // Send HTML headers and message
    res.writeHead(200,{ 'Content-Type': 'text/html' });
    res.end('<h1>Hello Socket Lover!</h1>');
  },
  '/report' : function(req,res){
    req.on('data', function(chunk){
      req.content += chunk;
    });

    req.on('end', function(){
      var dbody = unescape( req.content ).replace("url=","");

      generate_report( dbody );
      res.writeHead(302, 'OK', {'Location' : '/socket-client.html', 'Content-Type' : 'text/html' } );
      res.end();
    });
  },
};

function generate_report( url ){
  var name = new Date().getTime().toString() + '.pdf';
  console.log(url);
  webkit = spawn( 'wkhtmltopdf', [ url, name ] );

  webkit.on('exit', function(data) {
    foo = "Here's your report <a href='/" + name + "'>here</a> from " + url ;
  });
}

function load_static_file(uri, response) {
  var filename = path.join(process.cwd(), uri);
  path.exists(filename, function(exists) {
      if(!exists) {
        response.writeHead(404, {"Content-Type": "text/plain"});
        response.end("404 Not Found\n");
        return;
      }

      fs.readFile(filename, "binary", function(err, file) {
        if(err) {
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.end(err + "\n");
        return;
        }

        response.writeHead(200);
        response.end(file, "binary");
        });
      });
}

// Create a Socket.IO instance, passing it our server
var socket = io.listen(server);
var buffer = [];
// Add a connect listener
socket.on('connection', function(client){
  client.send( { buffer : buffer } );
  client.broadcast( { announcement : client.sessionId + ' connected' } );

  var interval = setInterval(function() {
    if( foo != '' ){
      client.broadcast({ announcement : foo }); // to everyone else
      client.send({ announcement : foo }); // to the client that sent the request
      buffer.push( {announcement : foo } );
      foo = '';
    }
  },1000);

	// Success!  Now listen to messages to be received
	client.on('message',function(message){
    var msg = { message: [client.sessionId, message] };
    buffer.push(msg);
    if (buffer.length > 15) buffer.shift();
    client.broadcast(msg);
	});

	client.on('disconnect',function(){
    client.broadcast({ announcement: client.sessionId + ' disconnected' });
	});

});
