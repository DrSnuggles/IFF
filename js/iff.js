/*  IFF tools by DrSnuggles
	License : Public Domain

	Actually recognized types: ILBM, 8SVX, 16SV, AIFC, AIFF
	https://wiki.amigaos.net/wiki/IFF_FORM_and_Chunk_Registry
*/

import {log} from './log.js'
import {getString, getUint32} from './readChunk.js'
import {parse as parseILBM} from './ilbm.js'
import {parse as parseSVX} from './svx.js'
import {parse as parseAIFF} from './aiff.js'
import {parse as parsePREF} from './pref.js'

export class IFF {
	constructor(co,cbOnLoad,cbOnError,cbOnEnd) {
		this.idx = 0
		this.cbOnLoad = cbOnLoad
		this.cbOnError = cbOnError
		this.cbOnEnd = cbOnEnd // invoked from audio.js
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
		.catch(e => {
			this.handleError(e)
		})
	}
	async parse(ab) {
		this.dv = new DataView(ab)

		// detect EA IFF 85 group identifier
		// If it doesn’t start with “FORM”, “LIST”, or “CAT ”, it’s not an IFF-85 file.
		const group = getString(this, 4)
		if (['FORM', 'LIST', 'CAT '].indexOf(group) === -1) {
			this.handleError('This is not an IFF-85 file.')
			return
		}
		if (group !== 'FORM') {
			this.handleError('Only FORM group is supported.')
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
			case 'PBM ':	// Image
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
			case 'PREF':
				await parsePREF(this)
				break
			default:
				console.log('Not yet supported type: '+ this.subType)
		}

		this.cbOnLoad(this)	// we are done.. callback
	}
	handleError(msg) {
		log(msg)
		if (this.cbOnError) {
			const err = typeof(msg) === 'object' ? msg : new Error(msg)
			err.sender = this
			this.cbOnError(err)
		}
		else console.error(msg)
	}
}

// Polyfill for window.requestAnimationFrame
window.requestAnimFrame = (function (callback) {
  return window.requestAnimationFrame || window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame || window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function (callback) {
      window.setTimeout(callback, 1000 / 60)
    }
})()

window.IFF = IFF	// for easier access
