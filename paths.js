var paths = {
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
