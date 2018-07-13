//
// load a text file (formatted as a JSON file), parse it, and create an XML file using proper nodes
// 

// Include xml and file system libraries
// var $ = require('jQuery');
var builder = require('xmlbuilder');
var fs = require('fs'); 

// use the document number <-> file name conversion library
var edocs = require('./edocsconvert.js').edocs;

// loading the JSON list of documents to import:
var documentsJSON = require('./../source/MCU_extract_003.json');
// loading the JSON list of GCdocs users and groups:
var GCdocsUGJSON = require('./../source/ListOfAllUsersAndGroups.json');
// loading the JSON list of elevated ACL groups for the EKME documents:
var EKMEGroupsACLJSON = require('./../source/ListOfHighACLGroupsEKME.json');

// declare an xml variable to build the xml file 
var oixml = builder.create('import', {version: '1.0', encoding: 'UTF-8', standalone: true, headless: false});

/* 
open the source files, created from SQL query exports and already formated as JSON data:
- MCU_extract_003.json contains all EKME metadata extracted from the database for all documents and their versions we need to import.
	structure:
	{"destinationFolder":"Enterprise:::",  ==> GCdocs destination folder - must be a valid path / folder
	"extension":"DOCX", ==> for the file name (probably not used)
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
- when formating of the JSON file, be carefull with the existing double quote and escape them like this: \" (should be covered in the SQL query).
- the entire set of data should be wrapped around [] to make an array
Todo:
- must cleanup destination folder if necessary. the destination must exist (unless folder creation is turned on in the OI options) and can't contain multiple ":"
- create lookup for users to check if they exist in GCdocs, and if not assign default user which exist.
- assign ACL tags to groups with elevated privileges
*/

// main loop through all the documents lines, creating each lines of the XML object importer file
/* to do:
- location mapping: when file plan exist, need mapping to proper folder in GCdocs. When OPI exist, need mapping to their legacy bucket. When nothing exists, map to generic legacy bucket.
- file name: need to lookup the existence of the file (need a list of all files, strip their extension and compare list with current potential value).
- Extenstions: need to store the list of files with their extension to append the proper extension.
- ACL?
- French language?
- additional information in the EKME category?
- more testing...
*/

for (i =0; i < documentsJSON.length; i++) {

	edocs.reset();
	edocs.addNumber(documentsJSON[i].docnumber);
	edocs.addVersion(documentsJSON[i].version);
	edocs.addExtension(documentsJSON[i].extension);
	
	var enhFilename = edocs.num2DOCSEnh();
	var unixFilename = edocs.Num2DOCSunix();
	var description = documentsJSON[i].description;
	if (description == "") {
		description = 'Imported from EKME - Importé de EKME';
	}

    // For 'action' attribute: if version = 1, then create. If version > 1, then addversion, 
    // make sure the source data is sorted by docnumber and then version number.
	if (documentsJSON[i].version == 1) {
		oixml.ele('node', {'type': 'document' , 'action': 'create'})
			.ele('location', {}, documentsJSON[i].destinationFolder).up()
			.ele('file', {}, 'Enhanced file name: ' + enhFilename + ' | Unix file name: ' + unixFilename).up()
			.ele('title', {'language': 'en'}, documentsJSON[i].title + ' #' + documentsJSON[i].docnumber).up()
			.ele('owner', {}, documentsJSON[i].author).up()
			.ele('createdby', {}, documentsJSON[i].author).up()
			.ele('created', {}, documentsJSON[i].created).up()
			.ele('modified', {}, documentsJSON[i].modified ).up()
			.ele('description', {'language': 'en'}, description).up()
			.ele('category')
				.att('name', 'EKME')
				.ele('attribute', {'name': 'EKME Document Number'}, documentsJSON[i].docnumber).up()
				.ele('attribute', {'name': 'EKME Creator'}, documentsJSON[i].author).up()
				.ele('attribute', {'name': 'EKME Document Type'}, documentsJSON[i].doctype).up()
				.ele('attribute', {'name': 'EKME Modified by'}, documentsJSON[i].modifiedby).up()
				.ele('attribute', {'name': 'EKME Last Modified Date'}, documentsJSON[i].modified).up()
			.up()
		for (j = 0 ; j < EKMEGroupsACLJSON.length ; j++) {
			if (EKMEGroupsACLJSON[j].docNumber == documentsJSON[i].docnumber) {
			.ele('acl')
				.att('group', EKMEGroupsACLJSON[j].groupName)
				.att('permissions', '111111100')
				.up()
			}
			}
			.end();
	}
	else { 
		oixml.ele('node')
			.att('type','document')
			.att('action', 'addversion')
			.ele('location')
				.txt(documentsJSON[i].destinationFolder)
			.up()
			.ele('file')
				.txt('Enhanced file name: ' + enhFilename + ' | Unix file name: ' + unixFilename)
			.up()
			.ele('title')
				.att('language', 'en')
				.txt(documentsJSON[i].title)
			.up()
			.ele('modified')
				.txt(documentsJSON[i].modified)			
			.up()
			.ele('description')
				.att('language', 'en')
				.txt(documentsJSON[i].description)
	}
};

// write the xml variable result to a file, which will be used to perform the object importer action in GCdocs
fs.writeFile('./destination/oiGCCMS_001_003.xml', oixml.toString({ pretty: true }), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the file is saved!");
});