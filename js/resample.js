export function resample(buf, srcRate, destRate) {
	// i only take care of upsampling and i do not even interpolate
	const ret = [],
	fac = destRate/srcRate,
	fac_int = Math.floor(destRate/srcRate)
	const fac_dec = fac - fac_int

	for (let i = 0, dec = 0; i < buf.length; i++) { // loop this before end
		for (let j = 0; j < fac_int; j++) {
			// this takes care of int part of factor
			ret.push(buf[i])
		}
		dec += fac_dec
		if (dec >= 1) {
			// decimal part
			ret.push(buf[i])
			dec -= 1
		}
	}

	return ret
}
