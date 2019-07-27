/*jslint node: true */

'use strict';

/*	
	This script runs with nodejs, and load a text file (formatted as a JSON file) which
	contains a list of document metadatas from RDIMS, parse it and adds more content such
	as existing GCdocs users, real file names for the new files to be
	either created as new documents or adding a new version of the document in GCdocs,
	and create an object importer XML file using proper nodes to be processed by 
	the GCdocs object importer module.
*/

/*
	Author: Alexandre PIERRE (consultant@pierrekiroule.com) - Pierrekiroule Consulting Inc.
	Date of creation : July 2018
	Last revision: November 30th, 2018
*/

/* 
Description of the program:
open the source files, created from SQL query exports and already formated as JSON data:
- EKME_XXXX-XX-XX_extract_XXXX.json contains all EKME metadata extracted from the database for all documents and their versions we need to import.
The file name contains the cut off date (last edit version) of the batch, and the batch number (in case multiple batch needs to run for this date)
	structure:
	{"destinationFolder":"Enterprise:::",  ==> GCdocs destination folder - must be a valid path / folder
	"extension":"DOCX", ==> for the file name (probably not used except for the node type if applicable (URL, Alias, Folder?))
	"title":"Recommendation for Minister: West Coast Reduction Ltd", ==> Document title. Concatenate with Document Number.
	"doctype":"DOCS", ==> add case if we have a folder? in any cases, add this to a "EKME Document Type" attribute
	"description":"",  ==> descrition. If empty, add "imported from EKME".
	"modifiedby":"MADOREM", ==> "EKME Modified by" attribute
	"docnumber":"3900312", ==> "EKME Document Number" attribute
	"author":"MADOREM", ==> Created by
	"created":"20180411", ==> Created date
	"modified":"20180411", ==> modified date
	"version":"1"}, ==> used to create or add versions.
- ListOfAllUsersAndGroups.json contains the list of all existing users and groups in GCdocs, in order to check if EKME users exists in GCdocs.
- ListOfHighACLGroupsEKME.json contains all groups with full access to the document for each documents in EKME.
Notes:
- when formating of the JSON file, be carefull with the existing double quote and escape them like this: \" (should be managed in the SQL query).
- the entire set of data should be wrapped around [] to make an array
Todo:
+ must cleanup GCdocs destination folder if necessary. the GCdocsdestination must exist
  (unless folder creation is turned on in the OI options) and can't contain multiple ":"
- must find best strategy for destination folders: file plan, OPI, groups, etc...
+ create lookup for users to check if they exist in GCdocs, and if not assign default user which exist.
+ assign ACL tags to groups with elevated privileges
- check if groups for ACL exist in GCdocs.
+ check if advanced versions are used in EKME (they are) and how to apply them to GCdocs if necessary
- create report of all migrated documents (with doc numbers and new open link?)
+ run query to update email subtypes after import...
*/

// pre-requisites:
// run all SQL queries to get the source files:
//   - filesListJSON: contains a list of all RDIMS files with path.
//   - ListOfAllUsersAndGroups: contains the list of all GCdocs users and groups (query on GCDOCS)
//   - EKME_XXX-XX-XX_extract_XXX.json: contains the list of all documents and versions we need to import

// main loop through all the documents lines, creating each lines of the XML object importer file
/* to do:
- location mapping: when file plan exist, need mapping to proper folder in GCdocs. When OPI exist, need mapping to their legacy bucket. When nothing exists, map to generic legacy bucket.
+ file name: need to lookup the existence of the file (need a list of all files, strip their extension and compare list with current potential value).
+ Extensions: need to store the list of files with their extension to append the proper extension.
+ ACL
+ min version function
+ do not write into xml when file not found, but into separate log instead
- French language?
- additional information in the EKME category?
- more testing and performance improvements:
---> July 26, 2018: changed searches in user & group list, as well as in file list,
	 and for the 2100 documents samples went from 197 second to 1 second process.

+ wrap titles with ![CDATA[]]
+ object type="email" supported
+ check new users
+ add title to versions?
*/

// start timestamp used to calculate the time spent processing.
// initialize variables to count processed files
const timestart = Date.now();
var totalfileNotFound = 0;
var totalfilesProcessed = 0;

// iteration number:
// Used to load and write files with new names: change this when the source name change
const iterationRun = '001';
const cuttOffDate = '2002-11-30';

// Constants declarations:
const langCodeEn = "en_CA";
const langCodeFr = "fr_CA";

// Include xml and file system libraries to build the xml import files:
var builder = require('xmlbuilder');
var fs = require('graceful-fs'); 

// use the document number <-> file name conversion library and document lists
var edocs = require('./edocsconvert.js').edocs;

// loading the main JSON list of documents to import (result of RDIMS SQL extraction):
var JSONSourceFileName = "./../source/EKME_" + cuttOffDate + "_extract_" + iterationRun + ".json";
var documentsJSON = require(JSONSourceFileName);

// loading the JSON list of EKME files and extensions (created with filestoreCode.js):
var filesListJSON = require('./../source/filesListAll.json');
// sorting list of files on name, in order to improve performances with binary search:
// using lower cases to compare as some file names have either upper or lower cases but
// calculated file names are always lower case.
filesListJSON.sort(function(a,b) {
	if(a.name.toLowerCase() < b.name.toLowerCase()) return -1;
    if(a.name.toLowerCase() > b.name.toLowerCase()) return 1;
    return 0;
});
const FListLen = filesListJSON.length;

// loading the JSON list of GCdocs users and groups (from GCdocs sql + report):
var GCdocsUGJSON = require('./../source/allGcdocsUsers.json');
// sorting list of users on name, in order to improve performances with binary search:
// using lower case to compare as some names can use upper or lower cases
GCdocsUGJSON.sort(function(a, b) { // Case-insensitive sort
    if(a.login.toLowerCase() < b.login.toLowerCase()) return -1;
    if(a.login.toLowerCase() > b.login.toLowerCase()) return 1;
    return 0;
});
const UGlen = GCdocsUGJSON.length;

// console.log('Length of user and group file: ' + UGlen);

// Special list of document numbers that do not need to be imported 
// (i.e. they have already been imported)
var doNotimportList = []; //[]
var notImported = 0;
// declare the empty list of objects for which a file is not found:
var fileNotFound = [];

// declare an xml variable to build the xml import file, with the main <import> tag:
var xmlObjectImporter = builder.create('import', {
	version: '1.0', 
	encoding: 'UTF-8', 
	standalone: true
}, {
	headless: false, 
	stringify: {}
});

// start writing in the error files log:
var ErrorFileName = "./destination/fileNotFound_" + cuttOffDate + "_" + iterationRun + "-rerun.txt";
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

// this function is called to find if the current author of a document exists in the actual list 
// of users and groups in GCdocs, in order to assign it to an existing user, or assign it to a
// default migration user. This function searches on a sorted array, using a binary search.
const userLookup = (GCDocsUG, userID, fullname, start, end) => {			
	
	// console.log('Lookingup : ' + fullname + ' (' + userID + ') in a list of ' + GCDocsUG.length + ' users');
	
	const middle = Math.floor((start + end)/2);
	// console.log('userID to check: ' + userID.toLowerCase() + ' - fullname: ' + fullname + ' - Gcdocs user: ' + GCDocsUG[middle].username + ' - Gcdocs login: ' + GCDocsUG[middle].login.toLowerCase());

	if (userID.toLowerCase() == GCDocsUG[middle].login.toLowerCase()) {
		// add check on 'last, first' name too to eliminate different users with same userID
		if (fullname.toLowerCase() == (GCDocsUG[middle].lastname.toLowerCase() + ', ' + GCDocsUG[middle].firstname.toLowerCase())) {
			return GCDocsUG[middle].username;
		}
		else {
			return 'ekmemigrationuser@DFO-MPO_NS';
		}
		
	}
	if ((end - 1) === start) {
		return 'ekmemigrationuser@DFO-MPO_NS';
	}
	if (userID.toLowerCase() > GCDocsUG[middle].login.toLowerCase() ) {
		return userLookup(GCDocsUG, userID, fullname, middle, end);
	}
	if (userID.toLowerCase() < GCDocsUG[middle].login.toLowerCase() ) {
		return userLookup(GCDocsUG, userID, fullname, start, middle);
	}		
};

// this function is called to find the real file name of a document and if it exists 
// in the actual list of files from RDIMS,  in order to connect the existing file to the
// imported document. If the file doesn't exist, this document number won't be imported
// and it will be added to the list of documents with no files.
// This function searches on a sorted array, using a binary search.
const realFile = (fileList, calculatedFileName, start, end) => {
	const middle = Math.floor((start + end)/2);
	
	if (removeFileExtension(fileList[middle].name).toLowerCase() == removeFileExtension(String(calculatedFileName)).toLowerCase()) {
			// uncomment the following 3 lines to copy files to an "upload" directory to move only the needed
			// files to the Content Server upload directory (when the Upload directory is set and used by OI):
			//var fSource = filesListJSON[middle].directory + '/' + fileList[middle].name;
			//var fDestination = './destination/upload/' + fileList[middle].name;
			//fs.createReadStream(fSource).pipe(fs.createWriteStream(fDestination));
			return (fileList[middle].name);
	}
	if ((end - 1) === start) {
		return 'noFile';
	}
	if (removeFileExtension(fileList[middle].name.toLowerCase()) < removeFileExtension(String(calculatedFileName)).toLowerCase()) {
			return realFile(fileList, calculatedFileName, middle, end);
	}
	if (removeFileExtension(fileList[middle].name.toLowerCase()) > removeFileExtension(String(calculatedFileName)).toLowerCase()) {
			return realFile(fileList, calculatedFileName, start, middle);
	}	
};

// function to find the min version of a document.
// need to improve as this filter doesn't seem to be good for performance...
function minVersion(allDocuments, aDocNum) {
		var versMin = 100;
		for (var iDocs = 0 ; iDocs < allDocuments.length ; iDocs++) {
			if (allDocuments[iDocs].docnumber == aDocNum){
				if (allDocuments[iDocs].version < versMin) {
					versMin = allDocuments[iDocs].version;
				}
			}
		}
		return versMin;
	}

// function to clean up the date from SQL/JSON to a proper format for the object importer:
// SQL / JSON format: 2018-06-08 18:31:56.000
// required by Object Importer: YYYYMMDDHHMMSS ==> 20180608183156
function dateToOIFormat(date) {
	var formatedDate = "";
	formatedDate = removeFileExtension(CleanDate(date));
	return formatedDate;
}


// this function builds the list of all documents with proper data to build the import xml
function buildDocList(documents){
	var allDocuments = [];
	// loop through the list of all documents:
	for (var docs = 0 ; docs < documents.length ; docs++) {
		// progress lines...
		 process.stdout.write('\x1Bc');
		 console.log('...processing object ' + (docs + 1) + ' of ' + documents.length);
		// initializes each parts of edocsconvert.js objects:
		var oneDocument = {};
		edocs.reset();
		edocs.addNumber(documents[docs].docnumber);
		edocs.addVersion(documents[docs].version);
		edocs.addSubVersion(documents[docs].subversion);
		edocs.addExtension(documents[docs].extension);
		
		// only proceed if current doc number is not in the "do not import" list:
		if (doNotimportList.indexOf(Number(documents[docs].docnumber)) == -1) {
			// calculate the potential file names from document numbers:
			var enhFilename = edocs.num2DOCSEnh();
			var unixFilename = edocs.Num2DOCSunix();
			// check if the file exists and return its full name and path if so or "noFile" if not,
			// start with enhanced (most common) and only if not found test UNIX file name.
			var realEnhFile = "noFile";
			var realUnixFile = "noFile";
			realEnhFile = realFile(filesListJSON, enhFilename, 0, FListLen-1);
			if (realEnhFile == "noFile") {
				realUnixFile = realFile(filesListJSON, unixFilename, 0, FListLen-1);
			}
		
			// populate the properties of one document used to build the xml node:
		
			// - find the minimum version of the document to later know if this document should
			//   be created or a version added:
			oneDocument.minVersion = minVersion(documentsJSON, documents[docs].docnumber);
		
			// - file name: check if a unix or enhanced file was found and use its path and name, 
			//  otherwise use "noFile" if no file exists for this document number:
			if (realEnhFile != "noFile") {
				oneDocument.file = realEnhFile;
			} else if (realUnixFile != "noFile") {
				oneDocument.file = realUnixFile;
			} else {
				oneDocument.file = "noFile";
			}
		
			// - document number:
			oneDocument.docnumber = documents[docs].docnumber;
			// - creator: keeping the value from EKME before lookup to populate the EKME category
			// - author: check if the user exists in GCdocs or use a generic import user:
			oneDocument.creator = documents[docs].authorfullname + ' (' + documents[docs].author + ')';
			oneDocument.author = userLookup(GCdocsUGJSON , documents[docs].author, documents[docs].authorfullname, 0, UGlen-1);
			oneDocument.externalAuthor = documents[docs].authorexternal;
			// - modifiedby: keeping the value from EKME before lookup to populate the EKME category
			// - modifiedGCdocs: check if the user exists in GCdocs or use a generic import user:
			oneDocument.modifiedby = documents[docs].modifiedbyfullname + ' (' + documents[docs].modifiedby + ')';
			oneDocument.modifiedGCdocs = userLookup(GCdocsUGJSON , documents[docs].modifiedby, documents[docs].modifiedbyfullname, 0, UGlen-1);
		
			// - version
			oneDocument.version = documents[docs].version;
			oneDocument.subversion = documents[docs].subversion;
			var subVersion = "";
			if (documents[docs].subversion != "!") {
				subVersion = documents[docs].subversion;
			}
			oneDocument.versiondesc = documents[docs].versiondesc + ' - Version: ' + documents[docs].version + subVersion + '' +' - by: ' + oneDocument.modifiedby;
		
			// - description (if no description, add a generic one)
			if (documents[docs].filecode == "") {
				oneDocument.filecode = 'n/a';
			} else {
				oneDocument.filecode = documents[docs].filecode;
			}
			if (documents[docs].description == "") {
				oneDocument.description = 'Imported from EKME - File code: ' + oneDocument.filecode + ' ';
				}
			else {
				oneDocument.description = documents[docs].description + ' - File code: ' + oneDocument.filecode + ' ';
			} 
			// - destination folder (removes trailing ":" and all of them if multiple)
			oneDocument.location = documents[docs].destinationFolder.replace(/:+$/, "");
			// - title: append # and document number to all documents imported from RDIMS
			oneDocument.title = documents[docs].title + ' EKME ' + documents[docs].docnumber;
			oneDocument.title = oneDocument.title.replace(/:/," ");
			// wrap title with ![CDATA[]]
			oneDocument.title = '![CDATA[' + oneDocument.title + ']]';
			// - other straightforward metadata:
			// The modified date cannot be earlier than the create date:
			if (dateToOIFormat(documents[docs].modified) >= dateToOIFormat(documents[docs].created)) {
				oneDocument.modified = dateToOIFormat(documents[docs].modified);
			} else {
				oneDocument.modified = dateToOIFormat(documents[docs].created);
			}
			oneDocument.modifiedReal = dateToOIFormat(documents[docs].modified);
			oneDocument.modifiedvers = dateToOIFormat(documents[docs].modifiedvers);
			oneDocument.created = dateToOIFormat(documents[docs].created);
			oneDocument.createdby = documents[docs].author;
			oneDocument.doctype = documents[docs].doctype;
			oneDocument.classif = documents[docs].classif;
			oneDocument.extension = documents[docs].extension;
		
			allDocuments.push(oneDocument);
		} else {
			notImported += 1;
		}	
	}
	return allDocuments;
}

// this function builds the main nodes for all documents in the documents array:
function buildXML(documents) {
	// initialize the returned array:
	var nodeArray = [];
	// loops through all documents to import:
	for (var iDoc = 0; iDoc < documents.length; iDoc++) {		
		var nodeType = 'document';
		if (documents[iDoc].extension == 'MSG') { // cheking if we have an email
			nodeType = 'email';
		}
		// in case of oldest version, we create the document, otherwise, we add a version
		// Make sure the source data is sorted by docnumber and then version number.
		if (documents[iDoc].file != 'noFile'){ // we found a corresponding file
			if (documents[iDoc].version == documents[iDoc].minVersion && documents[iDoc].subversion == "!") { // first version
				// do nothing (rerun for add versions only) 
			} else { // not first version, we add a new version instead of creating a document
			// need to check if "Add Title to Location” check box is unchecked in settings (then this code is fine), 
			// otherwise need to separate the title from location and add <title> as a separate attribute,
			// this happens only for adding a version or updating a document, not with 'create'.
			// descriptions of versions does not support "language" attribute.
					var nodeObject = {
						node: {
							location: documents[iDoc].location,
							// title: documents[iDoc].title,
							title: { '#text': documents[iDoc].title, '@language': langCodeEn},
							file: documents[iDoc].file,
							modified: documents[iDoc].modifiedvers,
							createdby: documents[iDoc].modifiedGCdocs,
							created: documents[iDoc].modifiedvers,
							description: documents[iDoc].versiondesc,
							'@type': nodeType,
							'@action': "addversion",
							}
					};
					nodeArray.push(nodeObject);
					totalfilesProcessed = totalfilesProcessed + 1;
			}
		}
		else { // no real file was found for this document number -> add to list of files not found
			var noFileObject = {
				docnumber: documents[iDoc].docnumber
			};
			fileNotFound.push(noFileObject);
			totalfileNotFound = totalfileNotFound + 1;
		}
	}
	return nodeArray;
}

// main calls to the 2 functions: 
// - build all documents list from the JSON source:
allDocumentsList =  buildDocList(documentsJSON);


// - build the xml array from the previous document list:
xmlObjectElement = buildXML(allDocumentsList);

// writing our elements in the xml file using the XML object:
var ele = xmlObjectImporter.ele(xmlObjectElement);


// write the xml variable result to multiple files of 1000 nodes each, 
// which will be used to perform the object importer action in GCdocs.

console.log("Number of documents not imported: " + notImported);

// First open the <xml> oi file:
var DestinationFileName = "./destination/oiEKME_" + cuttOffDate + "_" + iterationRun + "-rerun.xml";
fs.writeFile(DestinationFileName, '<?xml version="1.0" encoding="utf-8"?>\r\n', function(err) {
	if(err) {
		return console.log(err);
	}
});


// then write the file
fs.appendFile(DestinationFileName, xmlObjectImporter.toString({ pretty: true }), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the XML object importer file is saved! - number of processed files: " + totalfilesProcessed);
});

// write the list of files not found to a log:
fs.appendFile(ErrorFileName, JSON.stringify(fileNotFound, null, 2), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the list of files not found is saved! - number of files not found: " + totalfileNotFound);
});

// end timestamp used to calculate the time spent processing.
const timeend = Date.now();
// Calculate the time spent processing and display it
const timespent = timeend - timestart;
console.log('Time spent processing ' + documentsJSON.length + 
' documents: ' + timespent / 1000 + ' seconds');