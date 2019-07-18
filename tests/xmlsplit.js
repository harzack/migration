/*jslint node: true */

'use strict';

var XmlSplit = require('xmlsplit');
var fs = require('graceful-fs'); 

const iterationRun = '001';
const cuttOffDate = '2002-11-30';
var DestinationFileName = "./destination/oiEKME_" + cuttOffDate + "_" + iterationRun + ".xml";

console.log("source file: " + DestinationFileName);

// Split the main XML file into smaller files of 1000 nodes each:
var xmlsplit = new XmlSplit(1000);
var inputStream = fs.createReadStream(DestinationFileName);

var splitIteration = 1;

inputStream.pipe(xmlsplit).on('data', function(data) {
    var xmlDocument = data.toString();
    // do something with xmlDocument ..
    var SplitFileName = "./destination/splitresult/oiEKME_" + cuttOffDate + "_" + iterationRun + "_" + splitIteration + ".xml";
	fs.writeFile(SplitFileName, '<?xml version="1.0" encoding="utf-8"?>\r\n', function(err) {
		if(err) {
			return console.log(err);
		}
	});
	// then write the file
	fs.appendFile(SplitFileName, xmlDocument.toString({ pretty: true }), function(err) {
		if(err) {
			return console.log(err);
		}
	});
	splitIteration +=1;
});