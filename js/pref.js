/*	IFF FROM PREF subType by DrSnuggles
	License : WTFPL 2.0, Beerware Revision 42
	https://wiki.amigaos.net/wiki/Preferences#Preference_File_Format
*/
import {log} from './log.js'
import {getUint16, getUint8, readChunk, processCommonChunks} from './readChunk.js'

export async function parse(dat) {
	// read next chunk, needs to be PRHD
	let chunk = readChunk(dat)
	if (chunk.name !== 'PRHD') {
		const msg = 'Missing PRHD chunk. This is not a valid PREF file.'
		log(msg)
		if (dat.cbOnError) dat.cbOnError(new Error(msg))
		return
	}
	log('PRHD chunk size: '+ chunk.size)
	// Currently all the fields are set to NULL. In future revisions these fields may be used to indicate a particular version and contents of a PREF chunk.
	dat.idx += chunk.size	// skip it for now

	// read chunks
	while (dat.idx < dat.dv.byteLength -8) {	// -8 = ChunkName + ChunkSize
		chunk = readChunk(dat)
		switch (chunk.name) {
			case 'PALT':
				log('PALT chunk size: '+ chunk.size)
				dat.idx += 144 // here the color values start
				dat.PALT = {}
				for (let i = 0; i < 8; i++) {	// read 8 colors
					const n = getUint16(dat)
					const r = getUint8(dat)
					dat.idx++	// ship 2nd byte which is just a double of the first byte
					const g = getUint8(dat)
					dat.idx++
					const b = getUint8(dat)
					dat.idx++
					dat.PALT[n] = '#'+ r.toString(16).padStart(2,0) + g.toString(16).padStart(2,0) + b.toString(16).padStart(2,0)
				}
				log( JSON.stringify(dat.PALT) )
				return // don't look further
			default:
				processCommonChunks(dat, chunk)
		}

	}

}
