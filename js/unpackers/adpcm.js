// based on Tobias (MastaTabs) Seiler (tobi@themaster.de) C version (MT_ADPCM)
// which is of course based on Christian (FlowerPower) Buchner ASM original
export function unpack_ADPCM(buf, bits, joinCode) {

	let length = Math.ceil(buf.length / 3),
	estMax = (joinCode & 0xffff),
	delta = ((joinCode & 0xffff0000) >> 16),
	lDelta = 0

	if(!delta) delta = 5
	let idx = 0
	const ret = [],
	matrix = [
		[0x3800, 0x5600, 0, 0, 0, 0, 0, 0],
		[0x399a, 0x3a9f, 0x4d14, 0x6607, 0, 0, 0, 0],
		[0x3556, 0x3556, 0x399A, 0x3A9F, 0x4200, 0x4D14, 0x6607, 0x6607],
	],
	bitmask = [0, 0x01, 0x03, 0x07, 0x0f, 0x1f, 0x3f, 0x7f, 0xff]

	while(length--) {
		let sampleCount = 24/bits
		let temp = (buf[idx++] << 16) | (buf[idx++] << 8) | buf[idx++]

		while(sampleCount--) {
			let newEstMax = (delta >> 1)
			let shifter = (temp >> sampleCount*bits)
			let b = (shifter & bitmask[bits-1])

			if ((bits == 4) && ((shifter & 0xf) == 0))
				delta = 4

			while(b--) {
				newEstMax += delta
			}

			lDelta = delta * matrix[bits-2][shifter & bitmask[bits-1]]

			if(shifter & (1<<(bits-1))) {	// SignBit
				newEstMax = -newEstMax
			}
			estMax = (estMax + newEstMax) & 0xffff

			delta = (lDelta + 8192) >> 14

			if(delta < 5) delta = 5

			newEstMax = estMax >> 6
			if(127 < newEstMax)
				ret.push(127)
			else if(-128 > newEstMax)
				ret.push(-128)
			else
				ret.push(newEstMax)
		}
	}
	return ret // joinCode (delta<<16|(estMax&0xffff))
}