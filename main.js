// import list of files and convert them to array of doc numbers, versions and extensions
// map these files with metadata with path
// generate for each line an object importer line with: create new if latest version and add version otherwise
// need to know destination folder (can be from fileplan?)
// todo: object importer line
// cleanup of metadata


// Function to download data to a file
function download(data, filename, type) {
    var file = new Blob([data], {type: type});
    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    }
}


download("alex", "test", "txt");

