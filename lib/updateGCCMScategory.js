// <?xml version="1.0" encoding="utf-8"?>
'use strict';

/*	
	This script runs with nodejs, and load a text file (formatted as a JSON file) which
	contains a list of document metadatas from RDIMS, parse it to create update nodes for GCCMS numbers
	and create an object importer XML file using proper nodes to be processed by 
	the GCdocs object importer module.
*/

/*
	Author: Alexandre PIERRE (consultant@pierrekiroule.com) - Pierrekiroule Consulting Inc.
	Date of creation : July 2018
	Last revision: September 26th, 2018
*/

// start timestamp used to calculate the time spent processing.
// initialize variables to count processed files
const timestart = Date.now();
var totalfileNotFound = 0;
var totalfilesProcessed = 0;

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
fs.writeFile('./destination/oiGCCMS_001_009_GCCMS.xml', '<?xml version="1.0" encoding="utf-8"?>\r\n', function(err) {
	if(err) {
		return console.log(err);
	}
});
// then the error file:
fs.writeFile('./destination/fileNotFound_009_GCCMS.txt', 'List of doc numbers with missing files: \r\n', function(err) {
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
		// - gccms docket list
		oneDocument.GCCMS = GCCMSDocketsLookup(GccmsEkmeJSON , documents[docs].docnumber, 0, GEListLen-1);

		// - destination folder (removes trailing ":" and all of them if multiple)
		oneDocument.location = documents[docs].destinationFolder.replace(/:+$/, "");
		// - title: append # and document number to all documents imported from RDIMS
		oneDocument.title = documents[docs].title + ' EKME ' + documents[docs].docnumber;
		oneDocument.title = oneDocument.title.replace(/:/," ")
		
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
			 var nodeObject = {
					node: {
						location: documents[iDoc].location + ':' + documents[iDoc].title,
						category: {
							attribute: [
								builGCCMSnode(documents[iDoc].GCCMS)
								],
							'@name': "Content Server Categories:DFO Business Categories:GCCMS",
						},
						'@type': nodeType,
						'@action': "update",
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
fs.appendFile('./destination/oiGCCMS_001_009_GCCMS.xml', xmlObjectImporter.toString({ pretty: true }), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the XML object importer file is saved! - number of processed files: " + totalfilesProcessed);
});

// write the list of files not found to a log:
fs.appendFile('./destination/fileNotFound_009_GCCMS.txt', JSON.stringify(fileNotFound, null, 2), function(err) {
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