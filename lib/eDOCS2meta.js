/*jslint node: true */

'use strict';

/*	
	This script runs with nodejs, and load a text file (formatted as a JSON file) which
	contains a list of document metadatas from RDIMS, parse it and adds more content such
	as real file names for the new files to be used for analysis
	The script can also copy the files from the filestore to a staging area.
*/

/*
	Author: Alexandre PIERRE (consultant@pierrekiroule.com) - Pierrekiroule Consulting Inc.
	Date of creation : April 2019
	Last revision: October 2019
*/

/* 
Description of the program:
- Open the source files, created from SQL query exports and already formated as JSON data:
- RDIMS_XXXX-XX-XX_extract_XXXX.json contains all RDIMS metadata extracted from the database for all documents and their versions we need to import.
The file name contains creation date for the batch, and the batch number (in case multiple batch needs to run for this date)
	structure (with example):
	{"extension":"DOCX" , 
	"title":"ALAG CTN contributions 2008-present" , ==> Document title.
	"doctype":"PUB" , 
	"description":"CTN contributions concerning library news at the Lethbridge Research Centre" ,  ==> descrition. If empty, add "imported from RDIMS".
	"modifiedby":"MAHK" , ==> "RDIMS Modified by" attribute
	"modifiedbyfullname":"Karen Mah" , 
	"docnumber":"1946209" ,  ==> "RDIMS Document Number" attribute
	"application":"MICROSOFT WORD" , 
	"author":"MAHK" , ==> Created by
	"authorfullname":"Karen Mah" , 
	"created":"2009-05-06 20:22:18" , ==> Created date
	"modified":"2013-05-31 20:18:19" , ==> modified date
	"modifiedvers":"2012-11-26 19:30:26" , 
	"function":"IMS - Information Management and Systems / Gestion de l`information et des systèmes" , 
	"version":"1" , ==> used to create or add versions.
	"subversion":"!" , 
	"versiondesc":"" , 
	"docpath":"\AAFCAAC\MAHK\" , 
	"docserver":"\\MBWINNIMPDOC01\DOCSDATA" , 
	"activitykeyword":"Canadian Agriculture Library"},

- filesListAll.json contains the full list of all documents extracted from the file share, with their extension. Each entry has the following structure:
	- "dir": the full path where the file is located, e.g.: "V:\\\\ABBASSL",
  	- "name": the file name, e.g.: "##4f01!.MSG",
  	- "extension": the file extension, e.g.: ".MSG"

- The programs then combines this information and link each metadata entry with an actual file (or log a missing file) and outputs this list in a csv file.

Notes:
- when formating of the JSON file, be carefull with the existing double quote and escape them like this: "\" (should be managed in the SQL query).
- the entire set of data should be wrapped around [] to make an array
*/

// pre-requisites:
// run all SQL queries and scripts to get the source files:
//   - filesListAll.json: contains a list of all RDIMS files with path.
//   - RDIMS_XXX-XX-XX_extract_XXX.json: contains the list of all documents and versions we need to import

// main loop through all the documents lines, creating each lines of the metadata file (csv)
/* to do:

*/

// start timestamp used to calculate the time spent processing.
// initialize variables to count processed files
const timestart = Date.now();
var totalfileNotFound = 0;
var totalfilesProcessed = 0;

// iteration number:
// Used to load and write files with new names: change this when the source name change
const iterationRun = '001';
const cuttOffDate = '2019-11-07';

// Constants declarations:
const langCodeEn = "en_CA";
const langCodeFr = "fr_CA";

// Include file system libraries to build the file:
var fs = require('graceful-fs'); 

// Include JSON to csv parser:
const { Parser } = require('json2csv');

// use the document number <-> file name conversion library and document lists
var edocs = require('./edocsconvert.js').edocs;

// loading the main JSON list of documents to import (result of RDIMS SQL extraction):
var JSONSourceFileName = "./../source/RDIMS_" + cuttOffDate + "_extract_" + iterationRun + ".json";
var documentsJSON = require(JSONSourceFileName);

 const fileList = 'testFiles2';
// const fileList = 'mbwinnimpdoc01-docsdata';
// const fileList = 'mbwinnimpdoc01-docsdata4';
// const fileList = 'mbwinnimpdoc01-docsdata2';
// const fileList = 'mbwinnimpdoc01-docsdata3';
// const fileList = 'onottaimpdoc01-docsdata';
// const fileList = 'onottaimpdoc01-docsdata2';
// const fileList = 'onottaimpdoc01-docsfdms';

// loading the JSON list of RDIMS files and extensions (created with filestoreCode.js):
var filesListJSON = require('./../source/'+ fileList +'.json');
// sorting list of files on name, in order to improve performances with binary search:
// using lower cases to compare as some file names have either upper or lower cases but
// calculated file names are always lower case.

filesListJSON.sort(function(a,b) {
	if(a.name.toLowerCase() < b.name.toLowerCase()) return -1;
    if(a.name.toLowerCase() > b.name.toLowerCase()) return 1;
    return 0;
});
const FListLen = filesListJSON.length;
console.log('length of file list: '+ FListLen);
// declare the empty list of objects for which a file is not found:
var fileNotFound = [];

// start writing in the 2 output files: metadata output headers and missing files log:
// First the metadata file:
var DestinationFileName = "./destination/RDIMSmetadata_" + cuttOffDate + "_" + iterationRun + ".csv";
fs.writeFile(DestinationFileName, 'RDIMS Metadata: \r\n', function(err) {
	if(err) {
		return console.log(err);
	}
});
// then the error file:
var ErrorFileName = "./destination/fileNotFoundmeta_" + cuttOffDate + "_" + iterationRun + ".txt";
fs.writeFile(ErrorFileName, 'List of doc numbers with missing files: \r\n', function(err) {
	if(err) {
		return console.log(err);
	}
});

// this object is declared to contain each xml import nodes before building the xml file:
var xmlObjectElement = {};

// this array is declared to contain all prepared documents/nodes
// for the creation of the xml file:
var allDocumentsList = [];

// *******************************
// ******** My functions *********
// *******************************
// (list of useful functions used in other functions):

// function to count the number of specified letter found in a string:
function NumberOfLetterInString(dname, dletter) {
    var nletter = 0;
    for (var i=0; i < dname.length; i++) {
    		if (dname[i] == dletter) {
    			nletter += 1;
    		}
    	}
    return nletter;
}

// function returning the positions of each specified letter in a string, and last position is length of string:
function PositionsOfLetterInString(dname, dletter) {
    var sPos = [];
    // console.log('Debug dname, dletter :' + dname +  ' - ' + dletter);
    for(var i=0; i < dname.length; i++) {
        if (dname[i] == dletter) {
        	 sPos.push(i);
        }
    } 
    sPos.push(dname.length + 1);
    return sPos;
}

// Function removing the specified letter in a string
function RemoveLetterInString(dname, dletter){
    var nString = "";
    for (var i=0; i < dname.length; i++) {
        if (dname[i] != dletter) {
        	nString += dname[i];
        }   
    }
    return nString;
}

// Function replacing the specified letter in a string by the second letter
function ReplaceLetterInString(dname, rletter, nletter){
    var nString = "";
    for (var i=0; i < dname.length; i++) {
        if (dname[i] == rletter) {
            nString += nletter;
        }
        else {
            nString += dname[i];
        }
    }
    return nString;
}

// Function cleaning a name: remove , and / from a string
function CleanName(dname) {
    var nString = "";
    for (var i=0; i < dname.length; i++) {
        if ((dname[i] == ",") || (dname[i] == "/")) {
            nString += "";
        }
        else {
            nString += dname[i];
        }
    }
    return nString;
}

// Function cleaning a date format: remove "-" and ":" and " " from a string
function CleanDate(dname) {
    var nString = "";
    for (var i=0; i < dname.length; i++) {
        if ((dname[i] == "-") || (dname[i] == ":") || (dname[i] == " ")) {
            nString += "";
        }
        else {
            nString += dname[i];
        }
    }
    return nString;
}

// Function returning the extention of a filename:
function fileExtension(fName){
    var dotpos = PositionsOfLetterInString(fName, '.');
    var extension = fName.toString().substring(dotpos[0]+1, fName.length);
    return extension;
}

// Function returning a filename without the extension:
function removeFileExtension(fName){
	var dotpos = PositionsOfLetterInString(fName, '.');
	var cleanName = fName.toString().substring(0, dotpos[0]);
	return cleanName;
}

// *******************************
// ***** End of my functions *****
// *******************************

// this function is called to find the real file name of a document and if it exists 
// in the actual list of files from RDIMS,  in order to connect the existing file to the
// imported document. If the file doesn't exist, this document number won't be imported
// and it will be added to the list of documents with no files.
// This function searches on a sorted array, using a binary search.
const realFile = (fileList, calculatedFileName, start, end, fTitle) => {
	const middle = Math.floor((start + end)/2);
	
	if (removeFileExtension(fileList[middle].name).toLowerCase() == removeFileExtension(String(calculatedFileName)).toLowerCase()) {
			// uncomment the following 3 lines to copy files to an "upload" directory to move only the needed
			// files to the Content Server upload directory (when the Upload directory is set and used by OI):
			var fSource = filesListJSON[middle].dir + fileList[middle].name;
			var fDestination = './destination/upload/' + fTitle + '.' + fileExtension(fileList[middle].name);
			console.log('Source: ' + fSource + ' | Target: ' + fDestination);
			//fs.createReadStream(fSource).pipe(fs.createWriteStream(fDestination));
			return (fDestination);
	}
	if ((end - 1) === start) {
		return 'noFile';
	}
	if (removeFileExtension(fileList[middle].name.toLowerCase()) < removeFileExtension(String(calculatedFileName)).toLowerCase()) {
			return realFile(fileList, calculatedFileName, middle, end, fTitle);
	}
	if (removeFileExtension(fileList[middle].name.toLowerCase()) > removeFileExtension(String(calculatedFileName)).toLowerCase()) {
			return realFile(fileList, calculatedFileName, start, middle, fTitle);
	}	
};

// function to clean up the date from SQL/JSON to a proper format for the object importer:
// SQL / JSON format: 2018-06-08 18:31:56.000
// required by Object Importer: YYYYMMDDHHMMSS ==> 20180608183156
function dateToOIFormat(date) {
	var formatedDate = "";
	formatedDate = removeFileExtension(CleanDate(date));
	return formatedDate;
}


// this function builds the list of all documents with proper data to build the metadata file
function buildDocList(documents){
	var allDocuments = [];
	// loop through the list of all documents:
	for (var docs = 0 ; docs < documents.length ; docs++) {
		// progress lines...
		// process.stdout.write('\x1Bc');
		// console.log('...processing object ' + (docs + 1) + ' of ' + documents.length);
		// initializes each parts of edocsconvert.js objects:
		var oneDocument = {};
		edocs.reset();
		edocs.addNumber(documents[docs].docnumber);
		edocs.addVersion(documents[docs].version);
		edocs.addSubVersion(documents[docs].subversion);
		edocs.addExtension(documents[docs].extension);
		
		// calculate the potential file names from document numbers:
		var enhFilename = edocs.num2DOCSEnh();
		var unixFilename = edocs.Num2DOCSunix();
		
		// - version
		oneDocument.version = documents[docs].version;
		oneDocument.subversion = documents[docs].subversion;
		var subVersion = "";
		if (documents[docs].subversion != "!") {
			subVersion = documents[docs].subversion;
		}
		
		// title: append version, # and document number to all documents imported from RDIMS
		// used to rename the file to copy
		oneDocument.title = documents[docs].title;
		if ( oneDocument.title.length > 200) {
			oneDocument.title = oneDocument.title.slice(0,200);
		}
		if (documents[docs].subversion != "!") {
			oneDocument.title += ' -#' + documents[docs].docnumber + ' v' + oneDocument.version + oneDocument.subversion ;
		} else {
			oneDocument.title += ' -#' + documents[docs].docnumber + ' v' + oneDocument.version ;
		}

		// console.log('...processing: \"' + oneDocument.title + '\" #' + (docs + 1) + ' of ' + documents.length);
		// check if the file exists and return its full name and path if so or "noFile" if not,
		// start with enhanced (most common) and only if not found test UNIX file name.
		var realEnhFile = "noFile";
		var realUnixFile = "noFile";
		realEnhFile = realFile(filesListJSON, enhFilename, 0, FListLen-1, oneDocument.title);
		if (realEnhFile == "noFile") {
			realUnixFile = realFile(filesListJSON, unixFilename, 0, FListLen-1, oneDocument.title);
		}
		
		// populate the properties of one document used to build a metadata row:
		
		/* Structure of "oneDocument" list:
		- file
		- docnumber
		- author
		- modifiedby
		- version
		- subversion
		- versiondesc
		- function
		- description
		- title
		- modified
		- modifiedvers
		- created
		- createdby
		- doctype
		- activitykeyword
		
		*/
		
		// - file name: check if a unix or enhanced file was found and use its path and name, 
		//  otherwise use "noFile" if no file exists for this document number:
		if (realEnhFile != "noFile") {
			oneDocument.file = realEnhFile;
			
		} else if (realUnixFile != "noFile") {
			oneDocument.file = realUnixFile;
		} else {
			oneDocument.file = "noFile";
		}
		//console.log('file: ' + oneDocument.file);
		// - document number:
		oneDocument.docnumber = documents[docs].docnumber;
		// - author: "First, Last (Login)":
		oneDocument.author = documents[docs].authorfullname + ' (' + documents[docs].author + ')';
		// - modifiedby: keeping the value from RDIMS before lookup to populate the RDIMS category
		oneDocument.modifiedby = documents[docs].modifiedbyfullname + ' (' + documents[docs].modifiedby + ')';
		
		oneDocument.versiondesc = documents[docs].versiondesc + ' - Version: ' + documents[docs].version + subVersion + '' +' - by: ' + oneDocument.modifiedby;
		// - description (if no description, add a generic one)
		if (documents[docs].function == "") {
			oneDocument.function = 'n/a';
		} else {
			oneDocument.function = documents[docs].function;
		}
		if (documents[docs].description == "") {
			oneDocument.description = 'Imported from RDIMS ';
			}
		else {
			oneDocument.description = documents[docs].description + ' ';
		}

		// - other straightforward metadata:
		oneDocument.modified = documents[docs].modified;
		oneDocument.modifiedvers = documents[docs].modifiedvers;
		oneDocument.created = documents[docs].created;
		oneDocument.createdby = documents[docs].author;
		oneDocument.doctype = documents[docs].doctype;
		oneDocument.activitykeyword = documents[docs].activitykeyword;
		
		if (oneDocument.file != 'nofile'){
			allDocuments.push(oneDocument);
			totalfilesProcessed = totalfilesProcessed + 1;
		} else {
			var noFileObject = {
				docnumber: oneDocument.docnumber
			};
			fileNotFound.push(noFileObject);
			totalfileNotFound = totalfileNotFound + 1;
		}
	}
	return allDocuments;
}

// main calls to the function: 
// - build all documents list from the JSON source:
allDocumentsList =  buildDocList(documentsJSON);

const fieldsDocs = ['file','docnumber','author','externalAuthor','modifiedby','version','subversion','versiondesc','function','description','title','modified','modifiedvers','created','createdby','doctype','activitykeyword'];
const json2csvDocuments = new Parser({ fieldsDocs });
const DocsCSV = json2csvDocuments.parse(allDocumentsList);

// write the result to a csv file, which will be used to perform 
// the metadata analysis.
fs.appendFile(DestinationFileName, DocsCSV.toString({ pretty: true }), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the metadata file is saved! - number of processed files: " + totalfilesProcessed);
});

/*
const fieldsFileNotFound = ['docnumber'];
const json2csvFileNotFound = new Parser({ fieldsFileNotFound });
const FileNotFoundCSV = json2csvFileNotFound.parse(fileNotFound);

// write the list of files not found to a log:
fs.appendFile(ErrorFileName, FileNotFoundCSV.toString({ pretty: true }), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the list of files not found is saved! - number of files not found: " + totalfileNotFound);
});
*/

// end timestamp used to calculate the time spent processing.
const timeend = Date.now();
// Calculate the time spent processing and display it
const timespent = timeend - timestart;
console.log('Time spent processing ' + documentsJSON.length + 
' documents: ' + timespent / 1000 + ' seconds');