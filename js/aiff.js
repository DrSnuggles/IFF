/*	IFF AIFF / AIFF-C by DrSnuggles
	License : WTFPL 2.0, Beerware Revision 42
*/
import {log} from './log.js'
import {getString, getUint8, getUint32, getInt16, getInt24, getInt32, readChunk, processCommonChunks, getInt8} from './readChunk.js'
import {Float80} from './float80.js'
import {decode as decode_alaw} from './unpackers/alaw.js'
import {decode as decode_ulaw} from './unpackers/mulaw.js'
import {initContext, play, stop} from './audio.js'

export async function parse(dat) {
	// read chunks
	while (dat.idx < dat.dv.byteLength -8) {	// -8 = ChunkName + ChunkSize
		//if (dat.idx % 2 != 0) dat.idx++	// Don't forget to skip the implied pad byte after every odd-length chunk, this is not included in the chunk count!
		const chunk = readChunk(dat)
		switch (chunk.name) {
			case 'FVER':
				// Do not confuse the format version with the creation date of the file.
				dat.versionTimestamp = getUint32(dat)		// seconds since January 1, 1904
				log('Apple Version Timestamp: '+ new Date(-2082848400000+dat.versionTimestamp*1000).toLocaleString('de-DE', {dateStyle:"medium", timeStyle:"medium"}) )
				break
			case 'COMM':
				log('COMM chunk size: '+ chunk.size)
				const chunkEnd = dat.idx + chunk.size
				dat.comm = {
					numChannels: getInt16(dat),		// 16 bit signed
					numSampleFrames: getUint32(dat),// 32 bit unsigned
					sampleSize: getInt16(dat),		// 16 bit signed
					sampleRate: getIEEE754(dat)		// 80 bit IEEE Standard 754 floating point number (Standard Apple Numeric Environment [SANE] data type Extended)
				}
				// AIFC
				if (dat.idx < chunkEnd)	dat.comm.compressionType = getString(dat, 4)	// 32 bit ID
				if (dat.idx < chunkEnd)	dat.comm.compressionName = getString(dat, 4)	// pstring
				
				log('numChannels: '+ dat.comm.numChannels)
				log('numSampleFrames: '+ dat.comm.numSampleFrames)
				log('sampleSize = Bits: '+ dat.comm.sampleSize)
				log('sampleRate: '+ dat.comm.sampleRate)
				if (dat.comm.compressionType) log('compressionType: '+ dat.comm.compressionType)
			
				dat.channels = dat.comm.numChannels
				dat.sampleRate = dat.comm.sampleRate
				dat.bits = dat.comm.sampleSize
			
				break
			case 'SSND':
				log('SSND chunk size: '+ chunk.size)
				dat.ssnd = {
					offset: getUint32(dat),				// actually zero is expected
					blockSize: getUint32(dat),			// 
				}
				if (!dat.comm.compressionType || dat.comm.compressionType == 'NONE') {
					// todo: actual only 8,16,24,32 bits
					if (dat.bits === 8) {
						// the final uncompressed BODY is signed 8bit -128...+127
						dat.data = new Int8Array( chunk.size )
						dat.data.set( new Int8Array(dat.dv.buffer).slice(dat.idx, dat.idx+chunk.size))
						dat.idx += chunk.size
					} else if (dat.bits === 16) {
						// the final uncompressed BODY is signed 16bit -32768...+32767
						dat.data = []
						for (let i = 0; i < chunk.size/2; i++) {
							dat.data.push( getInt16(dat) )
						}
						dat.data = new Int16Array( dat.data )	// want typed array
					} else if (dat.bits === 24) {
						// the final uncompressed BODY is signed 24bit −8388608...+8388607
						// dataview doesn't know 24 bit
						dat.data = []
						for (let i = 0; i < chunk.size/3; i++) {
							dat.data.push( getInt24(dat) )
						}
						dat.data = new Int32Array( dat.data )	// want typed array is also not available in JS
					} else if (dat.bits === 32) {
						// the final uncompressed BODY is signed 32bit -2147483648...+-2147483647
						dat.data = []
						for (let i = 0; i < chunk.size/4; i++) {
							dat.data.push( getInt32(dat) )
						}
						dat.data = new Int32Array( dat.data )	// want typed array
					}
				} else {
					// unpackers wants 8 bit unsigned and are just 8 to 16 bit
					// Here we do not need to split by channels... uff ;)
					const packedData = new Uint8Array(chunk.size)
					packedData.set( new Uint8Array(dat.dv.buffer).slice(dat.idx, dat.idx+chunk.size) )
					//dat.data = eval('decode_'+dat.comm.compressionType)(packedData)
					if (dat.comm.compressionType == 'alaw') dat.data = decode_alaw(packedData)
					if (dat.comm.compressionType == 'ulaw') dat.data = decode_ulaw(packedData)
					dat.idx += chunk.size
				}
				break
			default:
				processCommonChunks(dat, chunk)
		}

	}
	if (!dat.comm) {
		log('Missing COMM chunk. This is not a valid AIFF file')
		return
	}

	prepareChannels(dat)
	await initContext(dat)

	dat.play = () => { play(dat) }
	dat.stop = () => { stop(dat) }
}

function prepareChannels(dat) {
	// LRLRLRLR
	// prepare for playback. We need seperate channels with Floats range -1..+1
	//dat.ch = new Array(dat.channels).fill(new Array())	// array of channels << ATTENTION if we fill the first array the 2nd gets also filled
	dat.ch = []
	for (let i = 0; i < dat.channels; i++) {
		dat.ch.push([])
	}
	// LRLRLR...
	for (let i = 0; i < dat.data.length; i++) {
		let val = dat.data[i]
		if (dat.bits == 8) val = val / 128
		if (dat.bits == 16) val = val / 32768
		if (dat.bits == 24) val = val / 2147483648 // 8388608 i scaled the 24 bit to 32 bit
		if (dat.bits == 32) val = val / 2147483648
		dat.ch[(i % dat.channels)].push( val )
	}
}

function getIEEE754(dat) {
	let b = []
	// read 10 bytes = 80 bits
	for (let i = 0; i < 10; i++) {
		b.push( getUint8(dat) )
	}
	let bigNum = Float80.fromBytes(b)
	return bigNum.asNumber().toNumber()
}
