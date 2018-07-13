<?xml version="1.0" encoding="utf-8"?>
//'use strict';

/*	This script runs with nodejs, and load a text file (formatted as a JSON file) which
	contains a list of document metadatas from RDIMS, parse it and adds more content such
	as existing GCdocs users, real file names and additional ACL for the new files to be
	either created as new documents or adding a new version of the document, and create an
	object importer XML file using proper nodes to be processed by the GCdocs object
	importer module.
*/

/*
	Author: Alexandre PIERRE (consultant@pierrekiroule.com)
	Date: July 2018
*/

// timestamp used to calculate the time spent processing.
var timestart = Date.now();

// Include xml and file system libraries
var builder = require('xmlbuilder');
var fs = require('fs'); 

// use the document number <-> file name conversion library
var edocs = require('./edocsconvert.js').edocs;

// loading the JSON list of documents to import:
var documentsJSON = require('./../source/MCU_extract_005.json');
// loading the JSON list of EKME files and extensions:
var filesListJSON = require('./../source/filesList.json');
// loading the JSON list of GCdocs users and groups:
var GCdocsUGJSON = require('./../source/ListOfAllUsersAndGroups.json');
// loading the JSON list of elevated ACL groups for the EKME documents:
var EKMEGroupsACLJSON = require('./../source/ListOfHighACLGroupsEKME.json');

// list of objects for which a file is not found
var fileNotFound = []

// declare an xml variable to build the xml file 
var xmlObjectImporter = builder.create('import', {
	version: '1.0', 
	encoding: 'UTF-8', 
	standalone: true
}, {
	headless: false, 
	stringify: {}
});

/* 
open the source files, created from SQL query exports and already formated as JSON data:
- MCU_extract_003.json contains all EKME metadata extracted from the database for all documents and their versions we need to import.
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
- must cleanup destination folder if necessary. the destination must exist (unless folder creation is turned on in the OI options) and can't contain multiple ":"
+ create lookup for users to check if they exist in GCdocs, and if not assign default user which exist.
+ assign ACL tags to groups with elevated privileges
- check if groups for ACL exist in GCdocs
*/

// main loop through all the documents lines, creating each lines of the XML object importer file
/* to do:
- location mapping: when file plan exist, need mapping to proper folder in GCdocs. When OPI exist, need mapping to their legacy bucket. When nothing exists, map to generic legacy bucket.
+ file name: need to lookup the existence of the file (need a list of all files, strip their extension and compare list with current potential value).
+ Extensions: need to store the list of files with their extension to append the proper extension.
+ ACL?
+ min version function
+ do not write into xml when file not found, but into separate log instead
- French language?
- additional information in the EKME category?
- more testing...
*/

//my functions:
// function to count the number of specified letter found in a string:
function NumberOfLetterInString(dname, dletter) {
    var nletter = 0;
    for (var i=0; i < dname.length; i++) {
    		if (dname[i] == dletter) {
    			nletter += 1;
    		}
    	}
    return nletter	
}


// function returning the positions of each specified letter in a string, and last position is length of string:
function PositionsOfLetterInString(dname, dletter) {
    var sPos = [];
    for(var i=0; i < dname.length; i++) {
        if (dname[i] == dletter) {
        	 sPos.push(i);
        }
    };  
    sPos.push(dname.length + 1);
    return sPos	
}

// Function removing the specified letter in a string
function RemoveLetterInString(dname, dletter){
    var nString = "";
    for (var i=0; i < dname.length; i++) {
        if (dname[i] != dletter) {
        	nString += dname[i]
        }   
    };
    return nString
}

// Function replacing the specified letter in a string by the second letter
function ReplaceLetterInString(dname, rletter, nletter){
    var nString = "";
    for (var i=0; i < dname.length; i++) {
        if (dname[i] == rletter) {
            nString += nletter
        }
        else {
            nString += dname[i]
        }
    }
    return nString
}

// Function cleaning a name: remove ,
function CleanName(dname) {
    var nString = "";
    for (var i=0; i < dname.length; i++) {
        if ((dname[i] == ",") || (dname[i] == "/")) {
            nString += ""
        }
        else {
            nString += dname[i]
        }
    }
    return nString
}

// Function extracting the extention of a filename:
function fileExtension(fName){
    var dotpos = PositionsOfLetterInString(fName, '.');
    var extension = fName.toString().substring(dotpos[0]+1, fName.length);
    return extension
}


// Function removing the extention of a filename:
function removeFileExtension(fName){
	var dotpos = PositionsOfLetterInString(fName, '.');
	var cleanName = fName.toString().substring(0, dotpos[0]);
	return cleanName
}

// function to find the minimum version of a document
function minimumVersions(docnumber) {
	var versMin = 100;
	for (iVers = 0 ; iVers < documentsJSON.length ; iVers++) {
		if (documentsJSON[iVers].docnumber == docnumber) {
			if (documentsJSON[iVers].version < versMin) {
				versMin = documentsJSON[iVers].version
			};
		};
	};
	return versMin;
}

// initialize the list of document numbers and their minimum version

// this object is declared to contain the xml import nodes before building the xml file:
var xmlObjectElement = {};

// this function loops through all the EKMEGroupsACLJSON items and builds the 
// ACL list for a given document:
function buildACLnode(passedDoc, acls) {
	var acl= [];
	for (var jDoc = 0 ; jDoc < acls.length ; jDoc++) {
		if (acls[jDoc].docNumber == passedDoc) {
			var aclObject = {
				'@group':  acls[jDoc].groupName,
				'@permissions': '111111100'
			};
			acl.push(aclObject);
		};
	};
	return acl;
}

// this function checks which file exists in the file store (unix or enhanced) 
// and retrieves the real extensions and directory:
// This JSON file objects have directory, fileName and fileExtension properties
//
function realFileName(unixName, enhancedName) {
	var resultName = "noFile";
	for (var iFile = 0 ; iFile < filesListJSON.length ; iFile++) {
		// console.log('current file: '  + removeFileExtension(filesListJSON[iFile].fileName) + ' | unix: ' + removeFileExtension(String(unixName)) + ' | enhanced: ' + removeFileExtension(String(enhancedName)));
		if (removeFileExtension(filesListJSON[iFile].fileName) == removeFileExtension(String(unixName))) {
			resultName = filesListJSON[iFile].directory + '/' + filesListJSON[iFile].fileName
		}
		else if (removeFileExtension(filesListJSON[iFile].fileName) == removeFileExtension(String(enhancedName))) {
			resultName = filesListJSON[iFile].directory + '/' + filesListJSON[iFile].fileName
		}
	};
	return resultName
}

// this function returns "true" if the EKME user or group exist in GCdocs:
function userLookup(userID) {
	var userExist = false;
	var result = '';
	for (var iUsers = 0 ; iUsers < GCdocsUGJSON.length ; iUsers++) {
		if ( GCdocsUGJSON[iUsers].Name.toLowerCase() == userID.toLowerCase()) {
			userExist = true;
			break;
		};
	};
	if (userExist) {
		return GCdocsUGJSON[iUsers].Name;
	} else {
		return 'EKMEmigrationUser';
	}
}

// this function builds the main nodes for all documents in the documents objects list:
function buildXML(documents) {
	// initialize the returned array:
	var nodeArray = [];
	// loops through all documents to import:
	for (var iDoc = 0; iDoc < documents.length; iDoc++) {
		// progress lines...
		console.log('\033c');
		console.log('...processing object ' + (iDoc + 1) + ' of ' + documents.length)
		
		// preparing values for the file names using the edocs converter 
		// functions and updating description if its empty:
		edocs.reset();
		edocs.addNumber(documents[iDoc].docnumber);
		edocs.addVersion(documents[iDoc].version);
		edocs.addExtension(documents[iDoc].extension);
	
		var enhFilename = edocs.num2DOCSEnh();
		var unixFilename = edocs.Num2DOCSunix();
		var realFile = realFileName(unixFilename, enhFilename);
		// progress lines...
		// console.log('Real file: ' + realFile);
		
		var description = documents[iDoc].description;
		if (description == "") {
			description = 'Imported from EKME - Importé de EKME';
		}
		// if (documents[iDoc].extension == 'MSG') : this doesn't work as 
		// there are no "email" type for OI.
		// Need to convert emails after the fact in GCdocs...
		var nodeType = 'document'
		var minVersion = minimumVersions(documents[iDoc].docnumber);
		
		var author = userLookup(documents[iDoc].author);
		
		/* if we find a corresponding file, and...
		   in case of oldest version, we create the document or email,
		   otherwise, we add a version
		   make sure the source data is sorted by docnumber and then version number.
		*/
		if (realFile != 'noFile'){
			if (documents[iDoc].version == minVersion) {
				var nodeObject = {
						node: {
							location: documents[iDoc].destinationFolder,
							file: realFile,
							title: { '#text': documents[iDoc].title + ' #' + documents[iDoc].docnumber, '@language': 'en'},
							owner: author,
							createdby: author,
							created: documents[iDoc].created,
							modified: documents[iDoc].modified,
							description: {'#text': description, '@language': 'en'},
							category: {
								attribute: [
									{ '#text': documents[iDoc].docnumber, '@name': "EKME Document Number" },
									{ '#text': documents[iDoc].author, '@name': "EKME Creator" },
									{ '#text': documents[iDoc].doctype, '@name': "EKME Document Type" },
									{ '#text': documents[iDoc].modifiedby, '@name': "EKME Modified by" },
									{ '#text': documents[iDoc].modified, '@name': "EKME Last Modified Date" }
									],
								'@name': "EKME",
							},
							acl: buildACLnode(documents[iDoc].docnumber, EKMEGroupsACLJSON),
							'@type': nodeType,
							'@action': "create",
							}
					}
			} else {
				var nodeObject = {
						node: {
							location: documents[iDoc].destinationFolder,
							file: realFile,
							title: { '#text': documents[iDoc].title + ' #' + documents[iDoc].docnumber, '@language': 'en'},
							modified: documents[iDoc].modified,
							description: {'#text': description, '@language': 'en'},
							'@type': nodeType,
							'@action': "addversion",
							}
					}
			}
			nodeArray.push(nodeObject);
		}
		// add the current object to the list of documents with no associate file:
		else {
			var noFileObject = {
				docnumber: documents[iDoc].docnumber,
				unixfile: unixFilename,
				enhancedfile: enhFilename
			};
			fileNotFound.push(noFileObject);
		}
	};
	return nodeArray;
}

xmlObjectElement = buildXML(documentsJSON);

// writing our elements in the xml file using the XML object:
var ele = xmlObjectImporter.ele(xmlObjectElement);

// write the xml variable result to a file, which will be used to perform the object importer action in GCdocs
fs.writeFile('./destination/oiGCCMS_001_005.xml', xmlObjectImporter.toString({ pretty: true }), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the XML object importer file is saved!");
});

// write the list of files not found to a log:
fs.writeFile('./destination/fileNotFound_005.txt', JSON.stringify(fileNotFound, null, 2), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the list of files not found is saved!");
});

var timeend = Date.now();
var timespent = timeend - timestart;

console.log('time spent processing ' + documentsJSON.length + ' documents is: ' + timespent / 1000 + ' seconds');