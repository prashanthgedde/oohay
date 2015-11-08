/**
 * Created by raghavachinnappa on 5/25/15.
 */
var http = require('http'),
  https = require('https'),
  cheerio = require('cheerio');

exports.getHTML = function(url, cb){
  var purl = require('url').parse(url);

  if (!purl.protocol)
    purl = require('url').parse("http://"+url);

  var httpModule = purl.protocol === 'https:'
    ? https
    : http;


  url = require('url').format(purl);

  var client = httpModule.get(url, function(res){
    res.setEncoding('utf-8');

    var html = "";

    res.on('data', function(data){
      html += data;
    });

    res.on('end', function(){
      if (res.statusCode >= 300 && res.statusCode < 400)
      {
        exports.getHTML(res.headers.location, cb);
      }
      else
      {
        cb(html);
      }

    });
  });

  client.on('error', function(err){
    cb(err);
  })
}


exports.parse = function(html, options){
  options = options || {};

  var $ = cheerio.load(html);


  // Check for xml namespace
  var namespace,
    $html = $('html');

  if ($html.length)
  {
    var attribKeys = Object.keys($html[0].attribs);

    attribKeys.some(function(attrName){
      var attrValue = $html.attr(attrName);

      if (attrValue.toLowerCase() === 'http://opengraphprotocol.org/schema/'
        && attrName.substring(0, 6) == 'xmlns:')
      {
        namespace = attrName.substring(6);
        return false;
      }
    })
  }
  else if (options.strict)
    return null;

  var airports = [];
  var indexes = ['type', 'name', 'muncipality', 'gps_code', 'iata_code', 'distance'];
  $('table.airports tr').each(function(i, tr){
    var tmp = {};
    $(this).find('td').each(function(tdIndex, td){
      var img = $(this).find('img');
      if((tdIndex === 0) && img.length){
        tmp[indexes[tdIndex]] = img.attr('title');
      } else {
        tmp[indexes[tdIndex]] = $(this).text();
      }
    });
    if(tmp.type === 'large_airport') {
      airports.push(tmp);
    }
  });
  console.info(airports);
}