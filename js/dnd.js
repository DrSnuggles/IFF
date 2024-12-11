/*  Drop handler by DrSnuggles
    License : WTFPL 2.0, Beerware Revision 42
*/
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
	window.addEventListener(eventName, preventDefaults, false)
})

function preventDefaults (e) {
	e.preventDefault()
	e.stopPropagation()
}

window.addEventListener('drop', handleDrop, false)

function handleDrop(e) {// just the first file
	const reader = new FileReader()
	reader.onload = (ev) => { newIFF( new Uint8Array(ev.target.result).buffer ) }
	reader.readAsArrayBuffer(e.dataTransfer.files[0])
}
