/*	IFF FROM PREF subType by DrSnuggles
	License : WTFPL 2.0, Beerware Revision 42
	https://wiki.amigaos.net/wiki/Preferences#Preference_File_Format
*/
import {log} from './log.js'
import {getUint16, getInt16, getUint8, readChunk, processCommonChunks} from './readChunk.js'

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
	// DrS: Even in OS4 PREFS file it's all 0
	dat.idx += chunk.size	// skip it for now

	// read chunks
	while (dat.idx < dat.dv.byteLength -8) {	// -8 = ChunkName + ChunkSize
		chunk = readChunk(dat)
		switch (chunk.name) {
			case 'PALT':
				log('PALT chunk size: '+ chunk.size)
				const chunkStart = dat.idx *1
				/*
				In the PALT Chunk there are lists 3 or 4 in case of OS4
				1st unidentified
				2nd color to object association
				3rd color values
				4th OS4 colors
				The first two lists maybe have different sizes but list3 starts always at +144
				*/
				dat.PALT = {
					asso: [],	// list 2
					cols: {},	// list 3
				}
				let nextWord = getInt16(dat)
				while (nextWord != -1) {	// list 1 unidentified
					nextWord = getInt16(dat)
				}
				nextWord = 0
				dat.idx = chunkStart + 84
				while (nextWord != -1) {	// list 2 color associations
					if (nextWord < 0) nextWord = nextWord + 264
					dat.PALT.asso.push( nextWord )
					nextWord = getInt16(dat)
				}
				log( 'ColAsso: '+ JSON.stringify(dat.PALT.asso) )
				nextWord = 0
				dat.idx = chunkStart + 146
				while (nextWord != -1) {	// list 3 colors OS 1/2 compatible 8 colors
					const r = getUint8(dat)
					dat.idx++	// ship 2nd byte which is just a double of the first byte
					const g = getUint8(dat)
					dat.idx++
					const b = getUint8(dat)
					dat.idx++
					//dat.PALT.cols.push( '#'+ r.toString(16).padStart(2,0) + g.toString(16).padStart(2,0) + b.toString(16).padStart(2,0) )
					dat.PALT.cols[nextWord] = '#'+ r.toString(16).padStart(2,0) + g.toString(16).padStart(2,0) + b.toString(16).padStart(2,0)
					nextWord = getInt16(dat)
				}
				log( 'Colors: '+ JSON.stringify(dat.PALT.cols) )
				if (chunk.size > 400) {	// Thats OS4
					dat.PALT.os4cols = {}		// list 4
					dat.PALT.os4colsEna = {}	// list 5
					dat.idx = chunkStart + 400	
					let i = 0
					while (i < 256) {	// list 4 OS4 colors
						//console.log('list4')
						dat.PALT.os4cols[i] = '#'+ getUint8(dat).toString(16).padStart(2,0) + getUint8(dat).toString(16).padStart(2,0) + getUint8(dat).toString(16).padStart(2,0)
						i++
					}
					log( 'OS4 Colors: '+ JSON.stringify(dat.PALT.os4cols) )
					i = 0
					while (i < 256) {	// list 5 OS4 colors enabled or not
						//console.log('list4')
						dat.PALT.os4colsEna[i] = (getUint8(dat) == 1)
						i++
					}
					log( 'OS4 Color enabled: '+ JSON.stringify(dat.PALT.os4colsEna) )
				}

				return // don't look further
			default:
				processCommonChunks(dat, chunk)
		}

	}

}
