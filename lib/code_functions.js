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