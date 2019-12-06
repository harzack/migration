/*jslint node: true */

'use strict';

/*
		var xmlObjectElement = {};

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

		function buildXML(documents) {
			var nodeArray = [];
			for (var iDoc = 0; iDoc < documents.length; iDoc++) {
				var nodeObject = {
						node: {
							location: documentsJSON[iDoc].folder,
							category: {
								attribute: [
									{ '#text': documentsJSON[iDoc].docnumber, '@name': "Document Number" }
									],
								'@name': "ACME",
							},
							acl: buildACLnode(documentsJSON[iDoc].docnumber, GroupsACLJSON),
							'@type': "document",
							'@action': "create",
							}
					};
				nodeArray.push(nodeObject);
			};
			return nodeArray;
		}

		xmlObjectElement = buildXML(documentsJSON);

		// writing our elements in the xml file using the XML object:
		var ele = xmlObjectImporter.ele(xmlObjectElement);
 
		console.log(xmlObjectImporter.toString({ 
		 	pretty: true 
		}));
		
var test1 = '1ls_501!'
var test2 = '1LS_501!'

console.log('test1 = ' + test1);
console.log('test2 = ' + test2);
console.log('test1 lowcase = ' + test1.toLowerCase());
console.log('test2 lowcase = ' + test2.toLowerCase());

if (test1.toLowerCase() == test2.toLowerCase()) {
	console.log('same');
}
else {
	console.log('different')
}
*/

/* const fs = require('fs-extra');

var fSource = './filestore/NEGOSUP/2c5m_01!.PPTX';
var fDestination = './destination/upload/newfile.PPTX';

console.log("File source: " + fSource);
console.log("File destination: " + fDestination);

fs.pathExists(fDestination, (err, exists) => {
	if(!exists) {
		fs.copy(fSource, fDestination, err => {
			if (err) return console.error(err);
			console.log('File copied!');
		  });
	} else {
		console.log('File already exists!');
	}
  });
 */

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

// Function cleaning a name: remove ,
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

// Function extracting the extention of a filename:
function fileExtension(fName){
    var dotpos = PositionsOfLetterInString(fName, '.');
    var lengthofname = fName.length;
    var extension = fName.substring(dotpos[0]+1, lengthofname);
    return extension;
}

// Function extracting the extention of a filename using ES6 arrow function notation (to test):
const fileExtensionES6 = fName => fName.substring(PositionsOfLetterInString(fName, '.')[0]+1, fName.length);

// Function removing the extention of a filename:
function removeFileExtension(fName){
    var dotpos = PositionsOfLetterInString(fName, '.');
    var lengthofname = fName.length;
    var cleanName = fName.substring(0, lengthofname - dotpos[0]);
    return cleanName;
}

var totalfile = 0;
const fs = require('graceful-fs');
const readline = require('readline');
var fileList = [];

// loading the txt list of EKME files and extensions (created with filestoreCode.js):
//var filesListTXT = require('./../source/filesListAllAAFC.txt');

var lineReader = readline.createInterface({
	input: fs.createReadStream('./../source/filesListAllAAFC.txt')
  });
  
  lineReader.on('line', function (line) {
	console.log('Line from file:', line);
	totalfile++;
  });


// start writing in the JSON file:
var JSONFileName = "./../source/filesListAllAAFC.JSON";
fs.writeFile(JSONFileName, '', function (err) {
	if (err) {
		return console.log(err);
	}
});


// write the list of files not found to a log:
fs.appendFile(JSONFileName, JSON.stringify(fileList, null, 2), function (err) {
	if (err) {
		return console.log(err);
	}
	console.log("the list of files is saved! - number of files found: " + totalfile);
});
