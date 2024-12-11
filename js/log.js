// only DOM interaction is here and only for debug purpose

const debug = true

export function	log(out) {
	if (debug) console.log('IFF:', out)
	const dbg_DOM = document.getElementById('info')
	if (dbg_DOM) dbg_DOM.innerHTML += out +'<br/>'
}
