import {log} from './log.js'

export function getString(dat, size) {
	let dec = new TextDecoder()
	let ret = dec.decode( dat.dv.buffer.slice(dat.idx, dat.idx+size) )
	ret = ret.replace(/\u0000/g,'') // NULL byte terminated or filled to be even
	dat.idx += size
	return ret
}
export function getUint8(dat) {
	const ret = dat.dv.getUint8(dat.idx)
	dat.idx++
	return ret
}
export function getUint16(dat) {
	const ret = dat.dv.getUint16(dat.idx, false)
	dat.idx += 2
	return ret
}
export function getUint24(dat) {
	// not native. This is also upscaled to 32bit for later signed bit shift to work
	return (getUint8(dat)<<24) + (getUint8(dat)<<16) + (getUint8(dat)<<8)
}
export function getUint32(dat) {
	const ret = dat.dv.getUint32(dat.idx, false)
	dat.idx += 4
	return ret
}
export function getInt8(dat) {
	const ret = dat.dv.getInt8(dat.idx)
	dat.idx++
	return ret
}
export function getInt16(dat) {
	const ret = dat.dv.getInt16(dat.idx, false)
	dat.idx += 2
	return ret
}
export function getInt24(dat) {
	// not native
	return getUint24(dat)<<0	// javascript uses bit operations on 32 bit
}
export function getInt32(dat) {
	const ret = dat.dv.getInt32(dat.idx, false)
	dat.idx += 4
	return ret
}

export function readChunk(dat) {
	return {
		name: getString(dat, 4),
		size: getInt32(dat)	// signed int32
	}
}

export function processCommonChunks(dat, chunk) {
	// https://wiki.multimedia.cx/index.php/IFF
	switch (chunk.name) {
		case '(c) ':
			dat.copyright = getString(dat, chunk.size)
			log('Copyright: '+dat.copyright)
			break
		case 'ANNO':
			dat.annotation = getString(dat, chunk.size)
			log('Annotation: '+dat.annotation)
			break
		case 'AUTH':
			dat.author = getString(dat, chunk.size)
			log('Author: '+dat.author)
			break
		case 'CHRS':
			dat.characterString = getString(dat, chunk.size)
			log('CharString: '+dat.characterString)
			break
		case 'CSET':
			dat.characterSet = getString(dat, chunk.size)
			log('CharSet: '+dat.characterSet)
			break
		case 'FTXT':
			dat.formattedText = getString(dat, chunk.size)
			log('FTXT: '+dat.formattedText)
			break
		case 'FVER':	// also defined different in AIFF-C
			dat.amigaOS = getString(dat, chunk.size)
			log('AmigaOS: '+dat.amigaOS)
			break
		case 'HLID':
			dat.hotLink = getString(dat, chunk.size)
			log('HotlinkID: '+dat.hotLink)
			break
		case 'NAME':
			dat.name = getString(dat, chunk.size)
			log('Name: '+dat.name)
			break
		case 'OCMP':
			dat.computer = getString(dat, chunk.size)
			log('Computer: '+dat.computer)
			break
		case 'OCPU':
			dat.cpu = getString(dat, chunk.size)
			log('CPU: '+dat.cpu)
			break
		case 'OPGM':
			dat.pgm = getString(dat, chunk.size)
			log('Program: '+dat.pgm)
			break
		case 'OSN ':
			dat.sn = getString(dat, chunk.size)
			log('Serial#: '+dat.sn)
			break
		case 'PTXT':
			dat.privText = getString(dat, chunk.size)
			log('PrivateText: '+dat.privText)
			break
		case 'TEXT':
			dat.text = getString(dat, chunk.size)
			log('Text: '+dat.text)
			break
		case 'UNAM':
			dat.userName = getString(dat, chunk.size)
			log('Username: '+dat.userName)
			break
		case 'VERS':
			dat.version = getString(dat, chunk.size)
			log('Version: '+dat.version)
			break
		default:
			log('Skipping chunk: '+ chunk.name)
			dat.idx += (chunk.size > 0) ? chunk.size : -7	// will be made even 6 in loop
	}
}
