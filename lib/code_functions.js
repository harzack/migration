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
		
*/
		
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