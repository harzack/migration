// <?xml version="1.0" encoding="utf-8"?>
'use strict';

/*	
	This script runs with nodejs, and load a text file (formatted as a JSON file) which
	contains a list of document metadatas from RDIMS, parse it and adds more content such
	as existing GCdocs users, real file names and additional ACL for the new files to be
	either created as new documents or adding a new version of the document in GCdocs,
	and create an object importer XML file using proper nodes to be processed by 
	the GCdocs object importer module.
*/

/*
	Author: Alexandre PIERRE (consultant@pierrekiroule.com) - Pierrekiroule Consulting Inc.
	Date of creation : July 2018
	Last revision: September 6th, 2018
*/

/* 
Description of the program:
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
- must cleanup GCdocs destination folder if necessary. the GCdocsdestination must exist
  (unless folder creation is turned on in the OI options) and can't contain multiple ":"
- must find best strategy for destination folders: file plan, OPI, groups, etc...
+ create lookup for users to check if they exist in GCdocs, and if not assign default user which exist.
+ assign ACL tags to groups with elevated privileges
- check if groups for ACL exist in GCdocs.
+ check if advanced versions are used in EKME (they are) and how to apply them to GCdocs if necessary
- Run query / webreport to get the mapping between EKME document numbers and GCDocs ID to provide to GCCMS for linking
+ run query to update email subtypes after import...
*/

// pre-requisites:
// run all SQL queries to get the source files:
//   - filesListJSON: contains a list of all RDIMS files with path.
//   - GCCMS_EKME_Numbers: contains the matching between GCCMS docket numbers and RDIMS doc numbers.
//   - ListOfAllUsersAndGroups: contains the list of all GCdocs users and groups (query on GCDOCS)
//   - MCU_extract_xxx: contains the list of all documents and versions we need to import

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
*/

// start timestamp used to calculate the time spent processing.
// initialize variables to count processed files
const timestart = Date.now();
var totalfileNotFound = 0;
var totalfilesProcessed = 0;


// Constants declarations:
const langCodeEn = "en_CA";
const langCodeFr = "fr_CA";

// Include xml and file system libraries to build the xml import file:
var builder = require('xmlbuilder');
var fs = require('fs'); 

// use the document number <-> file name conversion library and document lists
var edocs = require('./edocsconvert.js').edocs;

// loading the main JSON list of documents to import (result of RDIMS SQL extraction):
var documentsJSON = require('./../source/MCU_extract_009.json');

// loading the JSON list of EKME files and extensions (created with filestoreCode.js):
var filesListJSON = require('./../source/filesList.json');
// sorting list of files on fileName, in order to improve performances with binary search:
filesListJSON.sort(function(a,b) {
	if(a.fileName < b.fileName) return -1;
    if(a.fileName > b.fileName) return 1;
    return 0;
})
const FListLen = filesListJSON.length;
// console.log('Length of files names file: ' + FListLen);

// loading the JSON list of EKME - GCCMS corresponding numbers:
var GccmsEkmeJSON = require('./../source/GCCMS_EKME_Numbers.json');
// sorting list of files on ekme, in order to improve performances with binary search:
GccmsEkmeJSON.sort(function(a,b) {
	if(a.ekme < b.ekme) return -1;
    if(a.ekme > b.ekme) return 1;
    return 0;
})
const GEListLen = GccmsEkmeJSON.length;

// loading the JSON list of GCdocs users and groups (from GCdocs sql + report):
var GCdocsUGJSON = require('./../source/ListOfAllUsersAndGroups.json');
// sorting list of users on name, in order to improve performances with binary search:
GCdocsUGJSON.sort(function(a, b) { // Case-insensitive sort
    if(a.Name.toLowerCase() < b.Name.toLowerCase()) return -1;
    if(a.Name.toLowerCase() > b.Name.toLowerCase()) return 1;
    return 0;
})
const UGlen = GCdocsUGJSON.length;
// console.log('Length of user and group file: ' + UGlen);

// loading the JSON list of elevated ACL groups for the EKME documents
// (result of RDIMS SQL extraction):
var EKMEGroupsACLJSON = require('./../source/ListOfHighACLGroupsEKME.json');

// declare the empty list of objects for which a file is not found:
var fileNotFound = []

// declare an xml variable to build the xml import file, with the main <import> tag:
var xmlObjectImporter = builder.create('import', {
	version: '1.0', 
	encoding: 'UTF-8', 
	standalone: true
}, {
	headless: false, 
	stringify: {}
});

// start writing in the 2 output files: xml io output headers and missing files log:
// First the <xml> oi file:
fs.writeFile('./destination/oiGCCMS_001_009.xml', '<?xml version="1.0" encoding="utf-8"?>\r\n', function(err) {
	if(err) {
		return console.log(err);
	}
});
// then the error file:
fs.writeFile('./destination/fileNotFound_009.txt', 'List of doc numbers with missing files: \r\n', function(err) {
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

// Function cleaning a name: remove , and / from a string
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

// Function cleaning a date format: remove "-" and ":" and " " from a string
function CleanDate(dname) {
    var nString = "";
    for (var i=0; i < dname.length; i++) {
        if ((dname[i] == "-") || (dname[i] == ":") || (dname[i] == " ")) {
            nString += ""
        }
        else {
            nString += dname[i]
        }
    }
    return nString
}

// Function returning the extention of a filename:
function fileExtension(fName){
    var dotpos = PositionsOfLetterInString(fName, '.');
    var extension = fName.toString().substring(dotpos[0]+1, fName.length);
    return extension
}

// Function returning a filename without the extension:
function removeFileExtension(fName){
	var dotpos = PositionsOfLetterInString(fName, '.');
	var cleanName = fName.toString().substring(0, dotpos[0]);
	return cleanName
}

// *******************************
// ***** End of my functions *****
// *******************************

// this function loops through all the EKMEGroupsACLJSON items and builds the 
// ACL list for a given document:
// todo: can this function be optimized (eg search replaced with binary search)?
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

// this function loops through all the GCCM docket number items and builds the 
// GCCMS attributes list for a given document:
function builGCCMSnode(gccmsDockets) {
	var gccmsAttr= [];
	for (var docketsNumber = 0 ; docketsNumber < gccmsDockets.length ; docketsNumber++) {
		var gccmsObject = {
			'#text':  gccmsDockets[docketsNumber],
			'@name': "GCCMS Docket Number" 
		};
		gccmsAttr.push(gccmsObject);
	};
	return gccmsAttr;
}

// this function is called to find if the current author of a document exists in the actual list 
// of users and groups in GCdocs, in order to assign it to an existing user, or assign it to a
// default migration user. This function searches on a sorted array, using a binary search.
const userLookup = (GCDocsUG, userID, start, end) => {			
	const middle = Math.floor((start + end)/2);

	if (userID.toLowerCase() == GCDocsUG[middle].Name.toLowerCase()) {
		return GCDocsUG[middle].Name;
	};
	if ((end - 1) === start) {
		return 'EKMEmigrationUser';
	};
	if (userID.toLowerCase() > GCDocsUG[middle].Name.toLowerCase() ) {
		return userLookup(GCDocsUG, userID, middle, end)
	};
	if (userID.toLowerCase() < GCDocsUG[middle].Name.toLowerCase() ) {
		return userLookup(GCDocsUG, userID, start, middle)
	};		
};

// this function is called to find the real file name of a document and if it exists 
// in the actual list of files from RDIMS,  in order to connect the existing file to the
// imported document. If the file doesn't exist, this document number won't be imported
// and it will be added to the list of documents with no files.
// This function searches on a sorted array, using a binary search.
const realFile = (fileList, calculatedFileName, start, end) => {
	const middle = Math.floor((start + end)/2);
	
	if (removeFileExtension(fileList[middle].fileName) == removeFileExtension(String(calculatedFileName))) {
			// uncomment the following 3 lines to copy files to an "upload" directory to move only the needed
			// files to the Content Server upload directory (when the Upload directory is set and used by OI):
			//var fSource = filesListJSON[middle].directory + '/' + fileList[middle].fileName;
			//var fDestination = './destination/upload/' + fileList[middle].fileName;
			//fs.createReadStream(fSource).pipe(fs.createWriteStream(fDestination));
			return (fileList[middle].fileName)
	};
	if ((end - 1) === start) {
		return 'noFile';
	};
	if (removeFileExtension(fileList[middle].fileName) < removeFileExtension(String(calculatedFileName))) {
			return realFile(fileList, calculatedFileName, middle, end)
	};
	if (removeFileExtension(fileList[middle].fileName) > removeFileExtension(String(calculatedFileName))) {
			return realFile(fileList, calculatedFileName, start, middle)
	};	
};

// this function is called to find the list of associated GCCMS docket numbers with a given
// RDIMS document number.
const GCCMSDocketsLookup = (GCCMSEKMEList, RDIMSDocNumber, start, end) => {			
	var GCCMSdockets = [];
	const middle = Math.floor((start + end)/2);

	if (RDIMSDocNumber == GCCMSEKMEList[middle].ekme) {
		GCCMSdockets.push(GCCMSEKMEList[middle].docket);
		var gccmsCursor = 1;
		while (RDIMSDocNumber == GCCMSEKMEList[middle + gccmsCursor]) {
			gccmsCursor += 1;
			GCCMSdockets.push(GCCMSEKMEList[middle + gccmsCursor].docket);
		};
		var gccmsCursor = 1;
		while (RDIMSDocNumber == GCCMSEKMEList[middle - gccmsCursor]) {
			gccmsCursor += 1;
			GCCMSdockets.push(GCCMSEKMEList[middle - gccmsCursor].docket);
		};
		return(GCCMSdockets)
	};
	if ((end - 1) === start) {
		return 'no GCCMS docket associated';
	};
	if (RDIMSDocNumber > GCCMSEKMEList[middle].ekme) {
		return GCCMSDocketsLookup(GCCMSEKMEList, RDIMSDocNumber, middle, end)
	};
	if (RDIMSDocNumber < GCCMSEKMEList[middle].ekme) {
		return GCCMSDocketsLookup(GCCMSEKMEList, RDIMSDocNumber, start, middle)
	};		
};

// function to find the min version of a document.
// need to improve as this filter doesn't seem to be good for performance...
function minVersion(allDocuments, aDocNum) {
		var versMin = 100;
		for (var iDocs = 0 ; iDocs < allDocuments.length ; iDocs++) {
			if (allDocuments[iDocs].docnumber == aDocNum){
				if (allDocuments[iDocs].version < versMin) {
					versMin = allDocuments[iDocs].version
				};
			};
		};
		return versMin;
	};

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
		 console.log('...processing object ' + (docs + 1) + ' of ' + documents.length)
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
			oneDocument.file = realEnhFile
		} else if (realUnixFile != "noFile") {
			oneDocument.file = realUnixFile
		} else {
			oneDocument.file = "noFile"
		};
		
		// - document number:
		oneDocument.docnumber = documents[docs].docnumber;
		// - creator: keeping the value from EKME before lookup to populate the EKME category
		// - author: check if the user exists in GCdocs or use a generic import user:
		oneDocument.creator = documents[docs].authorfullname + ' (' + documents[docs].author + ')';
		oneDocument.author = userLookup(GCdocsUGJSON , documents[docs].author, 0, UGlen-1);
		// - modifiedby: keeping the value from EKME before lookup to populate the EKME category
		// - modifiedGCdocs: check if the user exists in GCdocs or use a generic import user:
		oneDocument.modifiedby = documents[docs].modifiedbyfullname + ' (' + documents[docs].modifiedby + ')';
		oneDocument.modifiedGCdocs = userLookup(GCdocsUGJSON , documents[docs].modifiedby, 0, UGlen-1);
		// - gccms docket list
		oneDocument.GCCMS = GCCMSDocketsLookup(GccmsEkmeJSON , documents[docs].docnumber, 0, GEListLen-1);
		var numberOfGccmsDockets = oneDocument.GCCMS.length;
		
		// - version
		oneDocument.version = documents[docs].version;
		oneDocument.subversion = documents[docs].subversion;
		oneDocument.versiondesc = documents[docs].versiondesc + ' - Version by: ' + oneDocument.modifiedby;
		
		// - description (if no description, add a generic one)
		if (documents[docs].filecode == "") {
			oneDocument.filecode = 'n/a'
		} else {
			oneDocument.filecode = documents[docs].filecode
		}
		if (documents[docs].description == "") {
			oneDocument.description = 'Imported from EKME - File code: ' + oneDocument.filecode + ' '
			for(var gccmsCatlen = 0; gccmsCatlen < numberOfGccmsDockets; gccmsCatlen++) {
				oneDocument.description += '- ' + oneDocument.GCCMS[gccmsCatlen];
			}
			}
		else {
			oneDocument.description = documents[docs].description + ' - File code: ' + oneDocument.filecode + ' ';
			for(var gccmsCatlen = 0; gccmsCatlen < numberOfGccmsDockets; gccmsCatlen++) {
				oneDocument.description += '- ' + oneDocument.GCCMS[gccmsCatlen];
			}
		}; 
		// - destination folder (removes trailing ":" and all of them if multiple)
		oneDocument.location = documents[docs].destinationFolder.replace(/:+$/, "");
		// - title: append # and document number to all documents imported from RDIMS
		oneDocument.title = documents[docs].title + ' EKME ' + documents[docs].docnumber;
		oneDocument.title = oneDocument.title.replace(/:/," ")
		// - other straightforward metadata:
		oneDocument.modified = dateToOIFormat(documents[docs].modified);
		oneDocument.modifiedvers = dateToOIFormat(documents[docs].modifiedvers);
		oneDocument.created = dateToOIFormat(documents[docs].created);
		oneDocument.createdby = documents[docs].author;
		oneDocument.doctype = documents[docs].doctype;
		
		allDocuments.push(oneDocument);
	}
	return allDocuments;
}

// this function builds the main nodes for all documents in the documents array:
function buildXML(documents) {
	// initialize the returned array:
	var nodeArray = [];
	// loops through all documents to import:
	for (var iDoc = 0; iDoc < documents.length; iDoc++) {		
		var nodeType = 'document'
		// in case of oldest version, we create the document, otherwise, we add a version
		// Make sure the source data is sorted by docnumber and then version number.
		if (documents[iDoc].file != 'noFile'){ // we found a corresponding file
			totalfilesProcessed = totalfilesProcessed + 1;
			if (documents[iDoc].version == documents[iDoc].minVersion && documents[iDoc].subversion == "!") { // first version
				 var nodeObject = {
						node: {
							location: documents[iDoc].location,
							file: documents[iDoc].file,
							title: { '#text': documents[iDoc].title, '@language': langCodeEn},
							owner: documents[iDoc].author,
							createdby: documents[iDoc].author,
							created: documents[iDoc].created,
							modified: documents[iDoc].modified,
							versioncontrol: {'#text':"TRUE"},
							versiontype: {'#text':"MAJOR"},
							description: {'#text': documents[iDoc].description, '@language': langCodeEn},
							category: {
								attribute: [
									{ '#text': documents[iDoc].docnumber, '@name': "EKME Document Number" },
									{ '#text': documents[iDoc].creator, '@name': "EKME Creator" },
									{ '#text': documents[iDoc].doctype, '@name': "EKME Document Type" },
									{ '#text': documents[iDoc].filecode, '@name': "EKME File Code" },
									{ '#text': documents[iDoc].modifiedby, '@name': "EKME Modified by" },
									{ '#text': documents[iDoc].modified, '@name': "EKME Last Modified Date" },
									builGCCMSnode(documents[iDoc].GCCMS)
									],
								'@name': "Content Server Categories:DFO Business Categories:EKME",
							},
							// acl: buildACLnode(documents[iDoc].docnumber, EKMEGroupsACLJSON),
							'@type': nodeType,
							'@action': "create",
							} 
					}
			} else { // not first version, we add a new version instead of creating a document
			// need to check if "Add Title to Location” check box is unchecked in settings (then this code is fine), 
			// otherwise need to separate the title from location and add <title> as a separate attribute,
			// this happens only for adding a version or updating a document, not with 'create'.
			//
			// if subvesion = ! we add a new major version, otherwise we add a minor version
			// descriptions of versions does not support "language" attribute.
				if (documents[iDoc].subversion == "!") {
					var nodeObject = {
						node: {
							location: documents[iDoc].location + ':' + documents[iDoc].title,
							file: documents[iDoc].file,
							modified: documents[iDoc].modifiedvers,
							createdby: documents[iDoc].modifiedGCdocs,
							created: documents[iDoc].modifiedvers,
							versioncontrol: {'#text':"TRUE"},
							versiontype: {'#text':"MAJOR"},
							description: documents[iDoc].versiondesc,
							'@type': nodeType,
							'@action': "addversion",
							}
					}
				} else {
					var nodeObject = {
						node: {
							location: documents[iDoc].location + ':' + documents[iDoc].title,
							file: documents[iDoc].file,
							modified: documents[iDoc].modifiedvers,
							createdby: documents[iDoc].modifiedGCdocs,
							created: documents[iDoc].modifiedvers,
							versioncontrol: {'#text':"TRUE"},
							versiontype: {'#text':"MINOR"},
							description: documents[iDoc].versiondesc,
							'@type': nodeType,
							'@action': "addversion",
							}
					}
				}
				
			}
			nodeArray.push(nodeObject);
		}
		else { // no real file was found for this document number -> add to list of files not found
			var noFileObject = {
				docnumber: documents[iDoc].docnumber
			};
			fileNotFound.push(noFileObject);
			totalfileNotFound = totalfileNotFound + 1;
		}
	};
	return nodeArray;
}

// main calls to the 2 functions: 
// - build all documents list from the JSON source:
allDocumentsList =  buildDocList(documentsJSON);

/*for (var t = 0; t < allDocumentsList.length; t++) {
	console.log(allDocumentsList[t])
}*/
// - build the xml array from the previous document list:
xmlObjectElement = buildXML(allDocumentsList);

// writing our elements in the xml file using the XML object:
var ele = xmlObjectImporter.ele(xmlObjectElement);

// write the xml variable result to a file, which will be used to perform 
// the object importer action in GCdocs.
fs.appendFile('./destination/oiGCCMS_001_009.xml', xmlObjectImporter.toString({ pretty: true }), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the XML object importer file is saved! - number of processed files: " + totalfilesProcessed);
});

// write the list of files not found to a log:
fs.appendFile('./destination/fileNotFound_009.txt', JSON.stringify(fileNotFound, null, 2), function(err) {
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