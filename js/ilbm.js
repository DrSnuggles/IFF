/*  IFF ILBM by DrSnuggles with adapted
		canvas drawing by Matthias Wiesmann

		Copyright © 2012, Matthias Wiesmann
		All rights reserved.
		Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

		1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
		2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

		THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
import {log} from './log.js'
import {getUint16, getInt16, getUint8, readChunk, processCommonChunks} from './readChunk.js'
import {unpack_ByteRun1} from './unpackers/byteRun1.js'

export async function parse(dat) {
	dat.ctbl = false
	dat.sham = false

	// read chunks
	while (dat.idx < dat.dv.byteLength -8) {	// -8 = ChunkName + ChunkSize
		//if (dat.idx % 2 != 0) dat.idx++	// Don't forget to skip the implied pad byte after every odd-length chunk, this is not included in the chunk count!
		const chunk = readChunk(dat)
		switch (chunk.name) {
			case 'BODY':
				log('BODY chunk size: '+ chunk.size)
				// BODY is unsigned 8bit 0...255
				dat.data = new Uint8Array( chunk.size )
				dat.data.set( new Uint8Array(dat.dv.buffer).slice(dat.idx, dat.idx+chunk.size))
				dat.idx += chunk.size
				
				// should be moved to later when we have BODY data
				if (dat.bmhd.compression) {
					dat.data = unpack_ByteRun1(dat.data)
				}
				break
			case 'BMHD':
				log('BMHD chunk size: '+ chunk.size)
				// https://wiki.amigaos.net/wiki/ILBM_IFF_Interleaved_Bitmap
				dat.bmhd = {
					w: getUint16(dat),
					h: getUint16(dat),
					x: getInt16(dat),	// signed
					y: getInt16(dat),	// signed
					nPlanes: getUint8(dat),
					masking: getUint8(dat), // 0=none, 1=HasMask, 2=HasTransparentColor, 3=Lasso
					compression: getUint8(dat), // 0=none, 1=ByteRun1
					pad1: getUint8(dat),
					transparentColor: getUint16(dat),
					xAspect: getUint8(dat),
					yAspect: getUint8(dat),
					pageWidth: getInt16(dat),	// signed
					pageHeight: getInt16(dat),	// signed
				}
		
				log('w: '+ dat.bmhd.w)
				log('h: '+ dat.bmhd.h)
				log('x: '+ dat.bmhd.x)
				log('y: '+ dat.bmhd.y)
				log('nPlanes: '+ dat.bmhd.nPlanes)
				log('masking: '+ dat.bmhd.masking)
				log('compression: '+ dat.bmhd.compression)
				log('transparentColor: '+ dat.bmhd.transparentColor)
				log('xAspect: '+ dat.bmhd.xAspect)
				log('yAspect: '+ dat.bmhd.yAspect)
				log('pageWidth: '+ dat.bmhd.pageWidth)
				log('pageHeight: '+ dat.bmhd.pageHeight)
		
				break
			case 'CMAP':
				log('CMAP chunk size: '+ chunk.size)
				dat.cmap = []
				dat.pal = []
				for (let i = 0; i < chunk.size; i+=3) {
					//cmap.push( (f.u8[idx+i]<<16) + (f.u8[idx+i+1]<<8) + (f.u8[idx+i+2]) )
					const r = getUint8(dat)
					const g = getUint8(dat)
					const b = getUint8(dat)
					dat.cmap.push( [r, g, b, 255] )
					dat.pal.push(r,g,b)
				}
				dat.cmap_bits = 0
				while(dat.cmap.length > (1 << dat.cmap_bits)) {
					dat.cmap_bits++
				}
				var scaled = isCMAPScaled(dat)
				if (!scaled) scaleCMAP(dat)
				dat.cmap_overlay = new Array(dat.cmap.length)
		
				//log(cmap)
				// check if we have the right amount of cols for #bitplanes
				log('2^'+dat.bmhd.nPlanes+'='+Math.pow(2, dat.bmhd.nPlanes) +' ?= '+ dat.cmap.length)
				if (Math.pow(2, dat.bmhd.nPlanes) !== dat.cmap.length) {
					log('num colors in cmap do not match bitplanes')
				}
				break
			case 'CAMG':
				log('CAMG chunk size: '+ chunk.size)
				dat.mode = {
					//dat.mode.value = my.readLongU(f)					// goes direct to BPLCON0 ($dff100)
					BPLCON1: getUint16(dat),
					BPLCON0: getUint16(dat),
				}
				dat.mode = { ...dat.mode, ...{
					HIRES: (dat.mode.BPLCON0 & 0x8000),					// Bit 15
					BPU: (dat.mode.BPLCON0 & 0b0111000000000000) >> 12,	// Bit 14-12 (BitPlanesUse)
					HAM: (dat.mode.BPLCON0 & 2048),						// Bit 11
					DPF: (dat.mode.BPLCON0 & 1024),						// Bit 10
					COLOR: (dat.mode.BPLCON0 & 512),					// Bit 9
					GAUD: (dat.mode.BPLCON0 & 256),						// Bit 8
					UHRES: (dat.mode.BPLCON0 & 128),					// Bit 7
					SHRES: (dat.mode.BPLCON0 & 64),						// Bit 6
					BYPASS: (dat.mode.BPLCON0 & 32),					// Bit 5
					BPU3: (dat.mode.BPLCON0 & 16),						// Bit 4
					LPEN: (dat.mode.BPLCON0 & 8),						// Bit 3
					LACE: (dat.mode.BPLCON0 & 4),						// Bit 2
					ERSY: (dat.mode.BPLCON0 & 2),						// Bit 1
					ECSENA: (dat.mode.BPLCON0 & 1),						// Bit 0
					//dat.mode.ehb = (!dat.mode.DPF & !dat.mode.ham & !dat.mode.BPU == 6) ? true : false
					EHB: (dat.mode.BPLCON0 & 0x80),	// thats UHRES ?? found here: http://amigadev.elowar.com/read/ADCD_2.1/Devices_Manual_guide/node02D9.html
				}}
		
				if (dat.mode.ehb && dat.cmap_bits == dat.bmhd.nPlanes) {
					log('EHB detected')
					f.cmap_bits--
					f.cmap.length = f.cmap.length >> 1
					f.cmap_overlay.length = f.cmap.length
				}
				if (dat.mode.HAM && dat.cmap_bits > dat.bmhd.nPlanes - 2) {
					const delta = (dat.cmap_bits - dat.bmhd.nPlanes + 2)
					log('HAM delta: '+ delta)
					dat.cmap_bits -= delta
					dat.cmap.length = dat.cmap.length >> delta
					dat.cmap_overlay.length = dat.cmap.length
				}
				break
			case 'CRNG':	// notstd. but common use and multiple
				log('CRNG chunk size: '+ chunk.size)
				if (!dat.crng) dat.crng = []
				let tmp = []
				for (let i = 0; i < chunk.size; i++) {
					tmp.push( getUint8(dat) )
				}
				dat.crng.push( tmp )
				break
			case 'CTBL':	// Color TaBLe
				log('CTBL chunk size: '+ chunk.size)
				const colTblSize = Math.pow(2, dat.bmhd.nPlanes)
				dat.ctbl = []//new Array(f.bmhd.h).fill(new Array(colTblSize))		// 16 color palette for each single line
				log('CTBL palettes: '+ chunk.size/2/colTblSize)
				if (dat.bmhd.h != chunk.size/2/colTblSize) {
					log('CTBL palettes do not match height')
				}
				for (let i = 0; i < chunk.size/2; i++) {
					const c = getUint16(dat),	// uuuuRRRRGGGGBBBB
					y = Math.floor(i / colTblSize),
					x = (i % colTblSize)
					//if (x == 2) console.log(y,x, padTo8bits((c>>8) & 0xF, 4), padTo8bits((c>>4) & 0xF, 4), padTo8bits(c & 0xF, 4))
					// convert to CMAP style color map
					if (x == 0) dat.ctbl.push([])
					dat.ctbl[y].push([])
					dat.ctbl[y][x].push( padTo8bits((c>>8) & 0xF, 4) )
					dat.ctbl[y][x].push( padTo8bits((c>>4) & 0xF, 4) )
					dat.ctbl[y][x].push( padTo8bits((c) & 0xF, 4) )
					dat.ctbl[y][x].push( 255 )
					/* and why does it not work like this ???
					dat.ctbl[y][x] = [
						y+'_'+x,				// only the last line ???
						c,
						// scaled
						//padTo8bits((c>>8) & 0xF, 4),// R
						//padTo8bits((c>>4) & 0xF, 4),// G
						//padTo8bits( c     & 0xF, 4),// B
						// shifted
						//((c>>8) & 0xF) << 4,
						//((c>>4) & 0xF) << 4,
						//( c & 0xF) << 4,
						255									// A
					];
					*/
				}
				break
			case 'SHAM':	// SHAM (Sliced HAM) ??? Why, thats the same like CTBL ToDo: shares very similar code
				//dat.sham = new Array(f.bmhd.h).fill(new Array(colTblSize))		// 16 color palette for each single line
				dat.sham = []
				const shamcolTblSize = 16, // Math.pow(2, dat.bmhd.nPlanes)
				version = getUint16(dat)
				log('SHAM chunk size: '+ chunk.size +' version: '+ version)
				log('SHAM palettes: '+ (chunk.size-2)/2/shamcolTblSize)
				if (dat.bmhd.h != (chunk.size-2)/2/shamcolTblSize) {
					log('SHAM palettes do not match height')
				}
				for (let i = 0; i < (chunk.size-2)/2; i++) {
					const c = getUint16(dat),	// uuuuRRRRGGGGBBBB
					// convert to CMAP style color map
					y = Math.floor(i / shamcolTblSize),
					x = (i % shamcolTblSize)
					if (x == 0) dat.sham.push([])
					dat.sham[y].push([])
					dat.sham[y][x].push( padTo8bits((c>>8) & 0xF, 4) )
					dat.sham[y][x].push( padTo8bits((c>>4) & 0xF, 4) )
					dat.sham[y][x].push( padTo8bits((c) & 0xF, 4) )
					dat.sham[y][x].push( 255 )
					/* why, baby why, see above....
					dat.sham[Math.floor(i / shamcolTblSize)][(i % shamcolTblSize)] = [
						padTo8bits((c>>8) & 0xF, 4),// R
						padTo8bits((c>>4) & 0xF, 4),// G
						padTo8bits( c     & 0xF, 4),// B
						255									// A
					]
					*/
				}
				break
			case 'DPI ':	// ToDo
			case 'PCHG':	// ToDo
			case 'PDDP':	// ToDo
				dat.idx += chunk.size
				break
			default:
				processCommonChunks(dat, chunk)
		}
	}

	// finally draw
	dat.bmhd.pixBuf = bitPlaneToPixBuffer(dat)
	//showILBM(pixBuf, w*xAspect, h*yAspect, document.getElementById('ILBMcanvas'))
	//showILBM(dat, canv)

	dat.show = (canv) => { showILBM(dat, canv) }
}

function padTo8bits(value, bits) {
	/**
	* Convert an intensity value on x bits into 8 bits.
	* For instance this will convert a 4 bit 0xf value into 0xff
	*/
	var result = 0
	for (var s = 8 - bits; s >= 0; s -= bits) {
		result |= value << s
	}
	return result
}
function isCMAPScaled(f) {
	/**
	* Check if the color map is already scaled (and not simply shifted).
	* If the all the low bits for all color entries are zeroes then the palette
	* was shifted and not scaled.
	*/
	var scale_mask = (1 << f.cmap_bits) - 1
	for (let i = 0; i < f.cmap.length; i++) {
		for (let c = 0; c < 3; c++) {
			var value = f.cmap[i][c]
			if (value & scale_mask) {
				return true
			}
		}
	}
	return false
}
function scaleCMAP(f) {
	/**
	* Scale a bitmap, i.e. make sure all three color channels use the full 8 bit
	* range.
	*/
	for (let i = 0; i < f.cmap.length; i++) {
		for (let c = 0; c < 3; c++) {
			var value = (f.cmap[i][c] >> (8 - f.cmap_bits))
			f.cmap[i][c] = padTo8bits(value, f.cmap_bits)
		}
	}
	log('CMAP scaled')
}
function showILBM(f, canv) {
	if (f.bmhd.yAspect != 0) {
		/* some Atari files do not set the aspect fields */
		f.bmhd.ratio = f.bmhd.xAspect / f.bmhd.yAspect
	} else {
		f.bmhd.ratio = 1
	}
	f.bmhd.eff_w = f.bmhd.w * Math.max(f.bmhd.ratio, 1)
	f.bmhd.eff_h = f.bmhd.h / Math.min(f.bmhd.ratio, 1)

	canv.width = f.bmhd.eff_w
	canv.height = f.bmhd.eff_h

	/* offline canvas */
	var render_canvas = document.createElement('canvas')
	render_canvas.width = f.bmhd.w
	render_canvas.height = f.bmhd.h
	var render_ctx = render_canvas.getContext('2d')
	var target = render_ctx.createImageData(f.bmhd.w, f.bmhd.h)
	var idx = 0
	var color = [0, 0, 0, 255]//iff.black_color
	while (idx < f.bmhd.pixBuf.length) {
		var value = f.bmhd.pixBuf[idx]
		//if (idx % f.bmhd.w == 0) lineStart(f, Math.floor(idx / f.bmhd.w))	// call copper ;)
		color = resolvePixels(f, value, color, Math.floor(idx / f.bmhd.w), (idx % f.bmhd.w))
		for (let c = 0; c < 4; c++) {
			target.data[idx * 4 + c] = color[c]
		}
		idx++
	}
	render_ctx.putImageData(target, 0, 0)

	/* Now render the image into the effective display target, with effective sizes */
	var ctx = canv.getContext('2d')
	ctx.drawImage(render_canvas, 0, 0, f.bmhd.w, f.bmhd.h, 0, 0, f.bmhd.eff_w, f.bmhd.eff_h)
}
function resolveHAMPixel(iff, value, previous_color) {
	//console.log('resolveHAMPixel')
	/**
	* Resolves a HAM encoded value into the correct color.
	* This assumes the color-table has been properly culled.
	*/
	var selector = (value >> iff.cmap_bits) & 3
	var data = padTo8bits((value % iff.cmap.length), iff.cmap_bits)
	var color_copy = [previous_color[0], previous_color[1], previous_color[2], 255]
	if (selector == 1) {
		color_copy[2] = data
	} else if (selector == 2) {
		color_copy[0] = data
	} else {
		color_copy[1] = data
	}
	return color_copy
}
function resolveEHBPixel(f, value) {
	/**
	* Resolves a EHB encoded value into the correct color.
	* This assumes the color-table has been properly culled.
	*/
	var base_color = f.cmap[(value % f.cmap.length)]
	return [base_color[0] >> 1, base_color[1] >> 1, base_color[2] >> 1, 255]
}
function resolveRGB24Pixel(value) {
	/**
	* Resolves a RGB24 encoded value into a correct color.
	*/
  // fixed by mrupp for his TAWS project
  var red = value & 0xff;
  var green = (value & 0xff00) >> 8;
  var blue = (value & 0xff0000) >> 16;
	return [red, green, blue, 255]
}
function resolvePixels(f, value, previous_color, lineNum, xPos) {
	/**
	* Convert the value for a given pixel into the appropriate rgba value.
	* The resolution logic depends on a lot of factors.
	*/
	if (value == undefined) {
		value = f.bmhd.transparentColor
	}
	if (f.bmhd.masking == 2 && value == f.bmhd.transparentColor) {
		// This breaks some images.
		//return [0, 0, 0, 255]
	}
	if (typeof f.cmap === 'undefined') {
		/* No color map, must be absolute 24 bits RGB */
		if (f.bmhd.nPlanes == 24) {
			return resolveRGB24Pixel(value)
		}
	}
	if (value < f.cmap.length) {
		if (f.sham) return f.sham[lineNum][value]
		if (f.ctbl) return f.ctbl[lineNum][value]
		return f.cmap[value]
	}
	/* ham mode */
	if (f.mode.HAM) {
		if (xPos == 0) previous_color = [0, 0, 0, 255]	// black
		return resolveHAMPixel(f, value, previous_color)
	}
	/* ehb mode */
	if (f.mode.ehb) {
		return resolveEHBPixel(f, value)
	}
	console.log('oops no color resolve found')
	return [0, 0, 0, 0]
}
function resolveOverlayPixels(f, value) {
	/**
	* Resolve pixels during animation time.
	*/
	var index;
	if (value >= f.cmap_overlay_length) {
		if (!f.mode.ehb) {
			return undefined
		}
		var entry = f.cmap_overlay[value % f.cmap_length]
		if (entry == undefined) {
			return undefined
		}
		index = entry + f.cmap_overlay_length
	} else {
		index = f.cmap_overlay[value]
	}
	if (index == undefined) {
		return undefined
	}
	return resolvePixels(f, index, [0, 0, 0, 255])
}
function lineStart(f, line) {
	/**
	* Function called before each line start.
	* Copper like color-table rewrites are handled here.
	*/
	/*
	var change_list = f.color_change_lists[line]
	if (change_list == undefined) {
		return
	}
	for (var i = 0; i < change_list.length; i++) {
		var change = change_list[i];
		f.cmap[change.register] = change.color
	}
	*/
	/*
	if (f.sham) {
		f.cmap = f.sham[line]
		console.log('Copper says: Colormap changed')
	}
	*/
}
function bitPlaneToPixBuffer(f) {
	/**
	 * De-interlace the bitplanes into per pixel values.
	 * The code currently does not handle the transparency plane properly.
	 */
	var row_bytes = ((f.bmhd.w + 15) >> 4) << 1
	var ret = new Array(f.bmhd.w * f.bmhd.h).fill(0)
	var planes = f.bmhd.nPlanes
	if (f.bmhd.masking == 1) {
		planes += 1
	}
	for (let y = 0; y < f.bmhd.h; y++) {
		for (let p = 0; p < planes; p++) {
			var plane_mask = 1 << p
			for (let i = 0; i < row_bytes; i++) {
				var bit_offset = (y * planes * row_bytes) + (p * row_bytes) + i
				var bit_value = f.data[bit_offset]
				for (let b = 0; b < 8; b++) {
					var pixel_mask = 1 << (7 - b)
					if (bit_value & pixel_mask) {
						var x = (i * 8) + b
						ret[(y * f.bmhd.w) + x] |= plane_mask
					}
				}
			}
		}
	}
	return ret
}