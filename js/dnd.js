/*  Drop handler by DrSnuggles
    License : WTFPL 2.0, Beerware Revision 42
*/
var dropArea = window;

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults (e) {
  e.preventDefault();
  e.stopPropagation();
}

dropArea.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
  let dt = e.dataTransfer;
  let files = dt.files;
  var file = files[0]; // just use first dropped file
  var reader = new FileReader();
  var filename = file.name;
  reader.onload = function(ev) {
    IFF.parseIFF(ev.target.result);
  };
  /*
  reader.onprogress = function(e) {
    if (e.lengthComputable) {
      var perc = e.loaded / e.total * 100;
      console.log("DND Progress: "+ perc.toFixed(1) + "%");
    } else {
      console.log("DND Progress: "+ e.loaded +" bytes");
    }
  }
  */
  reader.readAsArrayBuffer(file);
}
