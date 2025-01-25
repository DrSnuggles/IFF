// only DOM interaction is here and only for debug purpose

window.iffdebug = false

export function	log(out) {
	if (window.iffdebug) console.log('IFF:', out)
	const dbg_DOM = document.getElementById('info')
	if (dbg_DOM) dbg_DOM.innerHTML += out +'<br/>'
}
