export function unpack_ByteRun1(uint8) {
	const int8 = new Int8Array(uint8),
	ret = [] //decompressedChunkData
	let idx = 0

	// RLE decomp
	while (idx < int8.length) {
		var byte = int8[idx++]
		if (byte >= 0 && byte <= 127) {
			// Take the next byte bytes + 1 literally
			for (let i = 0; i < byte + 1; i++) {
				ret.push( int8[idx++] )
			}
		} else if (byte >= -127 && byte <= -1) {
			// Replicate the next byte, -byte + 1 times
			var ubyte = uint8[idx++]
			for (let i = 0; i < -byte + 1; i++) {
				ret.push( ubyte )
			}
		} else {
			//my.log("Error while decompressing")
		}
	}

	//my.log("Unpack "+ uint8.length +"->"+ ret.length)
	//my.log("Pack rate: "+ ((1-uint8.length/ret.length)*100).toFixed(1) +"%")

	return ret
}