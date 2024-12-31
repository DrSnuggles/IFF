/*	IFF 8SVX / 16SV by DrSnuggles
	License : WTFPL 2.0, Beerware Revision 42
	https://wiki.amigaos.net/wiki/8SVX_IFF_8-Bit_Sampled_Voice
*/
import {log} from './log.js'
import {getUint32, getUint16, getUint8, readChunk, processCommonChunks} from './readChunk.js'
import {unpack_Delta} from './unpackers/delta.js'
import {unpack_ADPCM} from './unpackers/adpcm.js'
import {initContext, play, stop, pause, resume, getPosition, setPosition} from './audio.js'

export async function parse(dat) {
	// read next chunk, needs to be VHDR
	let chunk = readChunk(dat)
	if (chunk.name !== 'VHDR') {
		const msg = 'Missing VHDR chunk. This is not a valid SVX file.'
		log(msg)
		if (dat.cbOnError) dat.cbOnError(new Error(msg))
		return
	}
	log('VHDR chunk size: '+ chunk.size)
	dat.vhdr = {
		oneShotHiSamples: getUint32(dat),
		repeatHiSamples: getUint32(dat),
		samplesPerHiCycle: getUint32(dat),
		samplesPerSec: getUint16(dat),
		ctOctave: getUint8(dat),
		sCompression: getUint8(dat),
		volume: getUint32(dat),
	}

	log('oneShotHiSamples: '+ dat.vhdr.oneShotHiSamples) // unpacked dest size
	log('repeatHiSamples: '+ dat.vhdr.repeatHiSamples)
	log('samplesPerHiCycle: '+ dat.vhdr.samplesPerHiCycle)
	log('samplesPerSec: '+ dat.vhdr.samplesPerSec)
	log('ctOctave: '+ dat.vhdr.ctOctave)
	log('sCompression: '+ dat.vhdr.sCompression)
	log('volume: '+ dat.vhdr.volume) // 0..65536 (not used)

	// defaults
	dat.channels = 1
	dat.sampleRate = dat.vhdr.samplesPerSec
	log('Bits: '+ dat.bits)

	// read chunks
	while (dat.idx < dat.dv.byteLength -8) {	// -8 = ChunkName + ChunkSize
		// if (dat.idx % 2 != 0) dat.idx++	// Don't forget to skip the implied pad byte after every odd-length chunk, this is not included in the chunk count!
		// uhh satie mono 8svx NAME chunk is not word aligned :(
		chunk = readChunk(dat)
		switch (chunk.name) {
			case 'BODY':
				log('BODY chunk size: '+ chunk.size)
				if (dat.vhdr.sCompression === 0) {
					if (dat.bits === 8) {
						// the final uncompressed BODY is signed 8bit -128...+127
						dat.data = new Int8Array( chunk.size )
						dat.data.set( new Int8Array(dat.dv.buffer).slice(dat.idx, dat.idx+chunk.size))
					} else {
						// the final uncompressed BODY is signed 16bit -32768...+32767
						dat.data = []
						for (let i = 0; i < chunk.size/2; i++) {
							dat.data.push( dat.dv.getInt16(dat.idx + 2*i, false) )
						}
						dat.data = new Int16Array( dat.data )	// want typed array
					}
				} else {
					// packers want Uint8 data
					// 0 = uncompressed
					// 1 = Fibonacci delta (wavepak)
					// 2 = unoff Exponential delta (wavepak)
					// 3 = unoff ADPCM2 (8svx_comp)
					// 4 = unoff ADPCM3 (8svx_comp)
					// here it is not ONE full packed set, each channel is depacked alone and then concatenated with spread operator
					dat.data = []
					for (let i = 0; i < dat.channels; i++) {
						const channelLength = chunk.size/dat.channels
						const packedData = new Uint8Array(channelLength)
						packedData.set( new Uint8Array(dat.dv.buffer).slice(dat.idx+i*channelLength, dat.idx+(i+1)*channelLength) )
						//if (dat.vhdr.sCompression > 0 && dat.vhdr.sCompression < 3 && typeof unpack_Delta == 'undefined') window.unpack_Delta = await import('./unpackers/delta.js')
						if (dat.vhdr.sCompression == 1) dat.data = [ ...dat.data, ...unpack_Delta(packedData, 'FDC') ]
						if (dat.vhdr.sCompression == 2) dat.data = [ ...dat.data, ...unpack_Delta(packedData, 'EDC') ]
						//if (dat.vhdr.sCompression > 2 && typeof unpack_ADPCM == 'undefined') window.unpack_ADPCM = await import('./unpackers/adpcm.js')
						if (dat.vhdr.sCompression == 3) dat.data = [ ...dat.data, ...unpack_ADPCM(packedData, 2, 0) ]
						if (dat.vhdr.sCompression == 4) dat.data = [ ...dat.data, ...unpack_ADPCM(packedData, 3, 0) ]
					}
					// store typed
					dat.data = new Int8Array( dat.data )
				}
				dat.idx += chunk.size
				/*
				if (dat.data.length % 2 == 1) {
					console.log('make it even')
					dat.data = [...dat.data,0]
				}
				console.log(dat.data.length)
				*/
				break
			case 'CHAN':
				log('CHAN chunk size: '+ chunk.size)
				/*
				2=LEFT, 4=RIGHT, 6=STEREO, 30=QUADRO
				The BODY chunk for stereo
				pairs contains both left and right information. To adhere to existing
				conventions, sampling software should write first the LEFT information,
				followed by the RIGHT. The LEFT and RIGHT information should be equal in
				length.
				*/
				dat.chan = getUint32(dat)
				log('CHAN: ' + dat.chan)

				switch (dat.chan) {
					case 6:
						dat.channels = 2
						break
					case 30:
						dat.channels = 4
						break
				}
				log('channels: ' + dat.channels)
				break
			case 'PAN ': // not used yet
				log('PAN chunk size: '+ chunk.size)
				/*
				not further used here but read
				sample has to be played on both channels
				max volume is set in vhdr
				leftChannelVolume = maxVolume - pan
				rightChannelVolume = maxVolume - leftChannelVolume
				*/
				dat.pan = getUint32(dat)
				break
			case 'SEQN': // not used yet
				log('SEQN chunk size: '+ chunk.size)
				dat.seqn = []
				for (let i = 0; i < chunk.size/8; i++) {
					dat.seqn.push({start: getUint32(dat), end: getUint32(dat)})
				}
				break
			case 'FADE':  // not used yet
				log('FADE chunk size: '+ chunk.size)
				f.fade = getUint32(dat)
				break
			case 'ATAK':  // not used yet https://wiki.amigaos.net/wiki/8SVX_IFF_8-Bit_Sampled_Voice#Optional_Data_Chunks_ATAK_and_RLSE
				log('ATAK chunk size: '+ chunk.size)
				dat.atak = []
				for (let i = 0; i < chunk.size/6; i++) {
					dat.atak.push({duration: getUint32(dat), dest: getUint32(dat)})
				}
				break
			case 'RLSE':  // not used yet https://wiki.amigaos.net/wiki/8SVX_IFF_8-Bit_Sampled_Voice#Optional_Data_Chunks_ATAK_and_RLSE
				log('RLSE chunk size: '+ chunk.size)
				dat.rlse = []
				for (let i = 0; i < chunk.size/6; i++) {
					dat.rlse.push({duration: getUint32(dat), dest: getUint32(dat)})
				}
				break
			default:
				processCommonChunks(dat, chunk)
		}

	}

	prepareChannels(dat)
	await initContext(dat)

	dat.play = (loops) => { play(dat, loops) }
	dat.stop = () => { stop(dat) }
	dat.pause = () => { pause(dat) }
	dat.resume = () => { resume(dat) }
	dat.getPosition = () => { return getPosition(dat) }
	dat.setPosition = (pos) => { setPosition(dat, pos) }
}

function prepareChannels(dat) {
	// LLLLRRRR
	// prepare for playback. We need seperate channels with Floats range -1..+1
	dat.ch = []	// array of channels
	for (let ch = 0, j = 0; ch < dat.channels; ch++) {
		const channel = []
		if (dat.bits == 8) {
			// 8 bits
			for (let i = 0; i < dat.data.length/dat.channels; i++) {
				channel.push( dat.data[j++] / 128 )
			}
		} else {
			// 16 bits
			for (let i = 0; i < dat.data.length/dat.channels; i++) {
				channel.push( dat.data[j++] / 32768 )
			}
		}
		dat.ch.push( new Float32Array(channel) )
	}
}
