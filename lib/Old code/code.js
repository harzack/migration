'use strict';

var documentsJSON = [
{"folder":"Enterprise1" , "extension":"DOCX" , "docnumber":"3912271" , "version":"1"},
{"folder":"Enterprise2" , "extension":"MSG" , "docnumber":"3912298" , "version":"1"},
{"folder":"Enterprise3" , "extension":"DOCX" , "docnumber":"3912692" , "version":"1"}
]

var GroupsACLJSON = [
{"docNumber":"3912271" , "groupName":"group1"},
{"docNumber":"3912271" , "groupName":"group2"},
{"docNumber":"3912298" , "groupName":"group3"},
{"docNumber":"3912298" , "groupName":"group4"},
{"docNumber":"3912692" , "groupName":"group5"}
]


// importing and declaring xmlbuilder variable: 
var builder = require('xmlbuilder');
var xmlObjectImporter = builder.create('import',
                     {version: '1.0', encoding: 'UTF-8', standalone: true},
                     {headless: false, stringify: {}});

var nodeArray = [];

var xmlObjectElement = {
	node: function () {
		for (var iDoc = 0; iDoc < documentsJSON.length; iDoc++) {			
			// populate the nodeObject for each row in documentsJSON and add it to the nodeArray:
			var currentDocNumber = documentsJSON[iDoc].docnumber;
			console.log('current doc number ' + currentDocNumber);
			var nodeObject = {
				location: documentsJSON[iDoc].folder,
				category: {
					attribute: [
						{ '#text': documentsJSON[iDoc].docnumber, '@name': "Document Number" }
						],
					'@name': "ACME",
				},
				
				// loop through GroupsACLJSON to find if we have specific ACL groups for this document:
				acl: function () {
					var acl= [];
					var aclObject = {};
					for (var j = 0 ; j < GroupsACLJSON.length ; j++) {
						console.log('--- ACL doc number: ' + GroupsACLJSON[j].docNumber);
						if (GroupsACLJSON[j].docNumber == currentDocNumber) {
							aclObject = {
								'@group':  GroupsACLJSON[j].groupName,
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
		};
		return nodeArray;
	}
 };

// writing our elements in the xml file using the XML object:
var ele = xmlObjectImporter.ele(xmlObjectElement);
 
 console.log(xmlObjectImporter.toString({ pretty: true }));