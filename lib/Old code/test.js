var builder = require('xmlbuilder');
var fs = require('fs'); 

// use the document number <-> file name conversion library
var edocs = require('./edocsconvert.js').edocs;

// loading the JSON list of documents to import:
var documentsJSON = require('./../source/MCU_extract_003.json');

// loading the JSON list of elevated ACL groups for the EKME documents:
var EKMEGroupsACLJSON = require('./../source/ListOfHighACLGroupsEKME.json');

var xmlObjectImporter = builder.create('import',
                     {version: '1.0', encoding: 'UTF-8', standalone: true},
                     {headless: false, stringify: {}});

var nodeArray = [];

var xmlObjectElement = {
	node: function () {
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
				var nodeObject = {
					location: documentsJSON[i].destinationFolder,
					file: 'Enhanced file name: ' + enhFilename + ' | Unix file name: ' + unixFilename,
					title: {
						'#text': documentsJSON[i].title + ' #' + documentsJSON[i].docnumber,
						'@language': "en"
					},
					owner: documentsJSON[i].author,
					createdby: documentsJSON[i].author,
					created: documentsJSON[i].created,
					modified: documentsJSON[i].modified,
					description: {
						'#text': description,
						'@language': "en"
					},
					category: {
						attribute: [
							{ '#text': documentsJSON[i].docnumber, '@name': "EKME Document Number" },
							{ '#text': documentsJSON[i].author, '@name': "EKME Creator" },
							{ '#text': documentsJSON[i].doctype, '@name': "EKME Document Type" },
							{ '#text': documentsJSON[i].modifiedby, '@name': "EKME Modified by" },
							{ '#text': documentsJSON[i].modified, '@name': "EKME Last Modified Date" }
							],
						'@name': "EKME",
					},
					acl: function () {
						var acl= [];
						//console.log ('GroupACL Length: ' + EKMEGroupsACLJSON.length + ' | This doc#: ' + documentsJSON[i].docnumber);
						for (j = 0 ; j < EKMEGroupsACLJSON.length ; j++) {
							if (EKMEGroupsACLJSON[j].docNumber == ????????????????) {
								aclObject = {
									'@group':  EKMEGroupsACLJSON[j].groupName,
									'@permissions': '111111100'
								};
								acl.push(aclObject);
							};
						};
						return acl;
					},
					'@type': "document",
					'@action': "create",
				};
				nodeArray.push(nodeObject);
			}
		};
		return nodeArray;
	}
 };

var ele = xmlObjectImporter.ele(xmlObjectElement);

fs.writeFile('./destination/test.xml', xmlObjectImporter.toString({ pretty: true }), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the file is saved!");
});