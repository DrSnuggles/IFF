/*  IFF tools by DrSnuggles
	License : Public Domain

	Actually recognized types: 8SVX, ILBM, 16SV, AIFF
	https://wiki.amigaos.net/wiki/IFF_FORM_and_Chunk_Registry
*/

import {log} from './log.js'
import {getString, getUint32} from './readChunk.js'
import {parse as parseILBM} from './ilbm.js'
import {parse as parseSVX} from './svx.js'
import {parse as parseAIFF} from './aiff.js'

export class IFF {
	constructor(co,cb) {
		this.idx = 0
		this.cb = cb
		if (typeof co == 'string') this.load(co)
		if (typeof co == 'object') this.parse(co)
	}
	
	load(url) {
		fetch(url)
		.then(r => r.arrayBuffer())
		.then(ab => {
			log('File loaded')
			this.parse(ab)
		})
		.catch(e => console.error(e))
	}
	async parse(ab) {
		this.dv = new DataView(ab)

		// detect EA IFF 85 group identifier
		// If it doesn’t start with “FORM”, “LIST”, or “CAT ”, it’s not an IFF-85 file.
		const group = getString(this, 4)
		if (['FORM', 'LIST', 'CAT '].indexOf(group) === -1) {
			log('This is not an IFF-85 file')
			return
		}
		if (group !== 'FORM') {
			log('Only FORM group is supported')
			return
		}
		this.group = group
		this.formSize = getUint32(this)
		log(this.group + " chunk size = "+ this.formSize)
		if (this.formSize + 8 !== this.dv.byteLength) {
			log('FORM size does not match file size: '+this.formSize+8+' !== '+this.dv.byteLength)
		}

		// next is the subtype
		this.subType = getString(this, 4)

		switch (this.subType) {
			case 'ILBM':	// Image
				//if (typeof parseILBM == 'undefined') window.parseILBM = await import('./ilbm.js')
				//await parseILBM.parse(this)
				await parseILBM(this)
				break
			case 'SMUS':	// Music composition
				break
			// Audio
			case '8SVX':
			case '16SV':
				this.bits = (this.subType == '8SVX') ? 8 : 16
				//if (typeof parseSVX == 'undefined') window.parseSVX = await import('./svx.js')
				//await parseSVX.parse(this)
				await parseSVX(this)
				break
			case 'AIFF':
			case 'AIFC':
				//if (typeof parseAIF == 'undefined') window.parseAIFF = await import('./aiff.js')
				//await parseAIFF.parse(this)
				await parseAIFF(this)
				break
			default:
		}

		this.cb()	// we are done.. callback
	}
}

window.IFF = IFF	// for easier access
