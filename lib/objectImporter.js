'use strict';

// object used to create object importer lines
var documentsToImport = {
	_actions: [],
	_languages:[],
	_locations: [],
	_files: [],
	_titles: [],
	_descriptions: [],
	_owners: [],
	_createdbys: [],
	_createds: [],
	_modifieds: [],
	addAction: function(action){
		this._actions.push(action);
	},
	addLanguage: function(language){
		this._languages.push(language);
	},
	addLocation: function(location){
		this._locations.push(location);
	},
	addFile: function(file){
		this._files.push(file);
	},
	addTitle: function(title){
		this._titles.push(title);
	},
	addDescription: function(description){
		this._descriptions.push(description);
	},
	addOwner: function(owner){
		this._owners.push(owner);
	},
	addCreatedBy: function(createdBy){
		this._createdbys.push(createdBy);
	},
	addCreated: function(created){
		this._createds.push(created);
	},
	addModified: function(modified){
		this._modifieds.push(modified);
	},
	createDocument: function(){
		var OIlines = [];
		// create a node line per document...
		// - action is "create" for version 1 (or min number of version), and "addversion" for version > 1 when it exists
		// - mandatory nodes when creating or adding a version are <location>, <file>, <title>, <category> & <attribute>, <createdby>, <created>, <modified>, <description>
		// - optional nodes: <acl> and <permissions> <owner> <ownergroup> if necessary for permissions purposes and when mapping is available
		// - when action is create, additional nodes and attributes needs to be filled:
	    //    - version control, type, major and minor when importing documents with multiple versions
	    // - for any given document, one node is created per version.
	    // - when more than one language is present, need to loop each sub node that contain the language attribute
	    
		for (var i = 0; i < this._files.length; i++){
			OIlines[i] = "<node type=\"document\" action=\"" + this._actions[i] + "\">\r\n";
			OIlines[i] += "<location>" + this._locations[i] + "</location>\r\n"
			OIlines[i] += "<file>" + this._files[i] + "</file>\r\n"
			OIlines[i] += "<title language=\"" + this._languages[i] + "\">" + this._titles[i] + "</title>\r\n"
			OIlines[i] += "<createdby>" + this._createdbys[i] + "</createdby>\r\n"
			OIlines[i] += "<created>" + this._createds[i] + "</created>\r\n"
			OIlines[i] += "<modified>" + this._modifieds[i] + "</modified>\r\n"
			OIlines[i] += "<description language=\"" + this._languages[i] + "\">" + this._descriptions[i] + "</description>\r\n"
			OIlines[i] += "<owner>" + this._owners[i] + "</owner>\r\n"
			OIlines[i] += "</node>"
		}
		return OIlines;
	},
	reset: function(){
		this._actions = [];
		this._languages = [];
		this._locations = [];
		this._files = [];
		this._titles = [];
		this._descriptions = [];
		this._owners = [];
		this._createdbys = [];
		this._createds = [];
		this._modifieds = [];
	}
}

exports.OIarray = documentsToImport;

// <title language="en"><![CDATA[Anything in here will not be
//      processed such as &lt;, &gt;, &amp;.]]></title>
// use language="<language_code>" for <title> and <description>
/*
Use UTF8 *always*
structure:
 <?xml version="1.0" encoding="UTF-8"?>
<import>
	<node>...</node>
</import>

Object types used:

- Folder type="folder"
'{"node type="folder"":{"location":"","title":"","createdby":"","created":"","modified":"","description":"","owner":""}}'
<node type="folder" action="create">
    <location>Admin Home</location>
    <title language="en">Documents</title>
    <createdby>Admin</createdby>
    <created>20100731</created>
    <modified>20100715</modified>
    <description language="en">first draft</description>
    <owner>Admin</owner>
</node>
Actions:
create
addversion

*/