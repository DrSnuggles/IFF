// based on https://github.com/svanderburg/lib8svx/blob/master/src/lib8svx/fibdelta.c
export function unpack_Delta(buf, typ) { // typ = FDC | EDC
	const codeToDelta = (typ === 'FDC') ? [-34, -21, -13, -8, -5, -3, -2, -1, 0, 1, 2, 3, 5, 8, 13, 21] : [-128, -64, -32, -16, -8, -4, -2, -1, 0, 1, 2, 4, 8, 16, 32, 64]
	const ret = []

	/* First byte of compressed data is padding, second is not compressed */
	ret.push(buf[1])

	/* Decompress all the other bytes */
	for(let i = 0; i < (buf.length-2)*2; ++i) {
		const compressedByte = buf[Math.floor(i / 2) + 2]
		//	high word for even offsets, low word for odd offsets					
		const code = (i % 2 == 0) ? compressedByte >> 4 : compressedByte & 0xf
		ret.push( (ret[i] + codeToDelta[code]) & 0xff )
	}

	return ret
}