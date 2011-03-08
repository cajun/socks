// Require HTTP module (to start server) and Socket.IO
var http        = require('http'),
    io          = require('socket.io'),
    sys         = require("sys"),
    url         = require("url"),
    path        = require("path"),
    querystring = require("querystring"),
    fs          = require("fs"),
    spawn       = require("child_process").spawn,
    events      = require("events"),
    messages    = [];

// Start the server at port 9090
var server = http.createServer(function(req, res){
  req.content = [];
  var uri     = url.parse(req.url).pathname;

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
      req.content.push( chunk );
    });

    req.on('end', function(){
      params = parse_params( req.content );
      generate_report( params, res );
    });
  },
  '/report.json' : function(req,res){
    req.on('data', function(chunk){
      req.content.push( chunk );
    });

    req.on('end', function(){
      generate_json_report( req.content.join(''), res );
    });
  },
};

function generate_json_report( params, res ){
  obj = querystring.parse( params );

  now = new Date().getTime().toString();

  fs.writeFile('/tmp/' + now + '.head.html', obj.header, function(err){
    if(err) sys.puts(err);
  });
  fs.writeFile('/tmp/' + now + '.content.html', obj.content, function(err){
    if(err) sys.puts(err);
  });
  fs.writeFile('/tmp/' + now + '.footer.html', obj.footer, function(err){
    if(err) sys.puts(err);
  });

  name = now + '.pdf';

  args = [
    '--header-html',
    '/tmp/' + now + '.head.html',
    '--footer-html',
    '/tmp/' + now + '.footer.html',
    '--header-spacing',
    '5'
  ];

  if( 'cookie' in obj ) {
    args.push( '--cookie');
    args.push( obj.cookie.split(' ')[0] );
    args.push( obj.cookie.split(' ')[1] );
  }

  args.push( '/tmp/' + now + '.content.html' );
  args.push( name );

  console.log( args );

  webkit = spawn( 'wkhtmltopdf', args );

  webkit.on('exit', function(data) {
    messages.push( "Here's your report <a href='/" + now + ".pdf'>here</a> " );

    fs.readFile(name, "binary", function(err, file) {
      if(err) {
        res.writeHead(500, {"Content-Type": "text/plain"});
        res.end(err + "\n");
        return;
      }

      res.writeHead(200, {"Content-disposition" : 'attachment; filename=report.pdf'});
      res.end(file, "binary");
    });
  });

}

function generate_report( params, res ){
  name = new Date().getTime().toString() + '.pdf';
  args = parse_args( params );

  args.push( '--enable-forms' );
  args.push( unescape( params.url ) );
  args.push( name );
  console.log( args );

  webkit = spawn( 'wkhtmltopdf', args );

  webkit.on('exit', function(data) {
    messages.push( "Here's your report <a href='/" + name + "'>here</a> from " + unescape(params['url']) );

    fs.readFile(name, "binary", function(err, file) {
      if(err) {
        res.writeHead(500, {"Content-Type": "text/plain"});
        res.end(err + "\n");
        return;
      }

      res.writeHead(200, {"Content-disposition" : 'attachment; filename=report.pdf'});
      res.end(file, "binary");
    });
  });
}

function parse_args( params ){
  args = [];

  for( prop in params ){
    if( prop != 'url' ){
      if( params.hasOwnProperty(prop) && params[prop] != ''){
        args.push( '--' + prop );
        split = unescape( params[prop] ).split(' ');
        for( index in unescape( params[prop] ).split( ' ' ) ){
          args.push( split[index] );
        }
      }
    }
  }

  return args;
}


function parse_params( chunks ) {
  init_params = chunks.join('').split('&');
  params = {};

  for( var i in init_params ) {
    key_value = init_params[i].split('=');
    params[key_value[0]] = key_value[1];
  }

  return params;
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

      if(filename.match(/.pdf$/)){
        response.writeHead(200, {"Content-disposition" : 'attachment; filename=report.pdf'});
      } else {
        response.writeHead(200);
      }
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
    msg = messages.shift();
    if( msg ){
      console.log( msg )
      client.send( { announcement : msg } ); // to the client that sent the request
      buffer.push( { announcement : msg } );
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
