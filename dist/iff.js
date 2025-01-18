// only DOM interaction is here and only for debug purpose

function	log(out) {
	console.log('IFF:', out);
	const dbg_DOM = document.getElementById('info');
	if (dbg_DOM) dbg_DOM.innerHTML += out +'<br/>';
}

function getString(dat, size) {
	let dec = new TextDecoder();
	let ret = dec.decode( dat.dv.buffer.slice(dat.idx, dat.idx+size) );
	ret = ret.replace(/\u0000/g,''); // NULL byte terminated or filled to be even
	dat.idx += size;
	return ret
}
function getUint8(dat) {
	const ret = dat.dv.getUint8(dat.idx);
	dat.idx++;
	return ret
}
function getUint16(dat) {
	const ret = dat.dv.getUint16(dat.idx, false);
	dat.idx += 2;
	return ret
}
function getUint24(dat) {
	// not native. This is also upscaled to 32bit for later signed bit shift to work
	return (getUint8(dat)<<24) + (getUint8(dat)<<16) + (getUint8(dat)<<8)
}
function getUint32(dat) {
	const ret = dat.dv.getUint32(dat.idx, false);
	dat.idx += 4;
	return ret
}
function getInt16(dat) {
	const ret = dat.dv.getInt16(dat.idx, false);
	dat.idx += 2;
	return ret
}
function getInt24(dat) {
	// not native
	return getUint24(dat)<<0	// javascript uses bit operations on 32 bit
}
function getInt32(dat) {
	const ret = dat.dv.getInt32(dat.idx, false);
	dat.idx += 4;
	return ret
}

function readChunk(dat) {
	return {
		name: getString(dat, 4),
		size: getInt32(dat)	// signed int32
	}
}

function processCommonChunks(dat, chunk) {
	// https://wiki.multimedia.cx/index.php/IFF
	switch (chunk.name) {
		case '(c) ':
			dat.copyright = getString(dat, chunk.size);
			log('Copyright: '+dat.copyright);
			break
		case 'ANNO':
			dat.annotation = getString(dat, chunk.size);
			log('Annotation: '+dat.annotation);
			break
		case 'AUTH':
			dat.author = getString(dat, chunk.size);
			log('Author: '+dat.author);
			break
		case 'CHRS':
			dat.characterString = getString(dat, chunk.size);
			log('CharString: '+dat.characterString);
			break
		case 'CSET':
			dat.characterSet = getString(dat, chunk.size);
			log('CharSet: '+dat.characterSet);
			break
		case 'FTXT':
			dat.formattedText = getString(dat, chunk.size);
			log('FTXT: '+dat.formattedText);
			break
		case 'FVER':	// also defined different in AIFF-C
			dat.amigaOS = getString(dat, chunk.size);
			log('AmigaOS: '+dat.amigaOS);
			break
		case 'HLID':
			dat.hotLink = getString(dat, chunk.size);
			log('HotlinkID: '+dat.hotLink);
			break
		case 'NAME':
			dat.name = getString(dat, chunk.size);
			log('Name: '+dat.name);
			break
		case 'OCMP':
			dat.computer = getString(dat, chunk.size);
			log('Computer: '+dat.computer);
			break
		case 'OCPU':
			dat.cpu = getString(dat, chunk.size);
			log('CPU: '+dat.cpu);
			break
		case 'OPGM':
			dat.pgm = getString(dat, chunk.size);
			log('Program: '+dat.pgm);
			break
		case 'OSN ':
			dat.sn = getString(dat, chunk.size);
			log('Serial#: '+dat.sn);
			break
		case 'PTXT':
			dat.privText = getString(dat, chunk.size);
			log('PrivateText: '+dat.privText);
			break
		case 'TEXT':
			dat.text = getString(dat, chunk.size);
			log('Text: '+dat.text);
			break
		case 'UNAM':
			dat.userName = getString(dat, chunk.size);
			log('Username: '+dat.userName);
			break
		case 'VERS':
			dat.version = getString(dat, chunk.size);
			log('Version: '+dat.version);
			break
		default:
			log('Skipping chunk: '+ chunk.name);
			dat.idx += (chunk.size > 0) ? chunk.size : -7;	// will be made even 6 in loop
	}
}

function unpack_ByteRun1(uint8) {
	const int8 = new Int8Array(uint8),
	ret = []; //decompressedChunkData
	let idx = 0;

	// RLE decomp
	while (idx < int8.length) {
		var byte = int8[idx++];
		if (byte >= 0 && byte <= 127) {
			// Take the next byte bytes + 1 literally
			for (let i = 0; i < byte + 1; i++) {
				ret.push( int8[idx++] );
			}
		} else if (byte >= -127 && byte <= -1) {
			// Replicate the next byte, -byte + 1 times
			var ubyte = uint8[idx++];
			for (let i = 0; i < -byte + 1; i++) {
				ret.push( ubyte );
			}
		}
	}

	//my.log("Unpack "+ uint8.length +"->"+ ret.length)
	//my.log("Pack rate: "+ ((1-uint8.length/ret.length)*100).toFixed(1) +"%")

	return ret
}

/*  IFF ILBM by DrSnuggles with adapted
		canvas drawing by Matthias Wiesmann

		Copyright © 2012, Matthias Wiesmann
		All rights reserved.
		Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

		1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
		2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

		THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS 'AS IS' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

async function parse(dat) {
	dat.ctbl = false;
	dat.sham = false;

	// read chunks
	while (dat.idx < dat.dv.byteLength -8) {	// -8 = ChunkName + ChunkSize
		//if (dat.idx % 2 != 0) dat.idx++	// Don't forget to skip the implied pad byte after every odd-length chunk, this is not included in the chunk count!
		const chunk = readChunk(dat);
		switch (chunk.name) {
			case 'BODY':
				log('BODY chunk size: '+ chunk.size);
				// BODY is unsigned 8bit 0...255
				dat.data = new Uint8Array( chunk.size );
				dat.data.set( new Uint8Array(dat.dv.buffer).slice(dat.idx, dat.idx+chunk.size));
				dat.idx += chunk.size;
				
				// should be moved to later when we have BODY data
				if (dat.bmhd.compression) {
					dat.data = unpack_ByteRun1(dat.data);
				}
				break
			case 'BMHD':
				log('BMHD chunk size: '+ chunk.size);
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
				};
		
				log('w: '+ dat.bmhd.w);
				log('h: '+ dat.bmhd.h);
				log('x: '+ dat.bmhd.x);
				log('y: '+ dat.bmhd.y);
				log('nPlanes: '+ dat.bmhd.nPlanes);
				log('masking: '+ dat.bmhd.masking);
				log('compression: '+ dat.bmhd.compression);
				log('transparentColor: '+ dat.bmhd.transparentColor);
				log('xAspect: '+ dat.bmhd.xAspect);
				log('yAspect: '+ dat.bmhd.yAspect);
				log('pageWidth: '+ dat.bmhd.pageWidth);
				log('pageHeight: '+ dat.bmhd.pageHeight);
		
				break
			case 'CMAP':
				log('CMAP chunk size: '+ chunk.size);
				dat.cmap = [];
				dat.pal = [];
				for (let i = 0; i < chunk.size; i+=3) {
					//cmap.push( (f.u8[idx+i]<<16) + (f.u8[idx+i+1]<<8) + (f.u8[idx+i+2]) )
					const r = getUint8(dat);
					const g = getUint8(dat);
					const b = getUint8(dat);
					dat.cmap.push( [r, g, b, 255] );
					dat.pal.push(r,g,b);
				}
				dat.cmap_bits = 0;
				while(dat.cmap.length > (1 << dat.cmap_bits)) {
					dat.cmap_bits++;
				}
				var scaled = isCMAPScaled(dat);
				if (!scaled) scaleCMAP(dat);
				dat.cmap_overlay = new Array(dat.cmap.length);
		
				//log(cmap)
				// check if we have the right amount of cols for #bitplanes
				log('2^'+dat.bmhd.nPlanes+'='+Math.pow(2, dat.bmhd.nPlanes) +' ?= '+ dat.cmap.length);
				if (Math.pow(2, dat.bmhd.nPlanes) !== dat.cmap.length) {
					log('num colors in cmap do not match bitplanes');
				}
				break
			case 'CAMG':
				log('CAMG chunk size: '+ chunk.size);
				dat.mode = {
					//dat.mode.value = my.readLongU(f)					// goes direct to BPLCON0 ($dff100)
					BPLCON1: getUint16(dat),
					BPLCON0: getUint16(dat),
				};
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
				}};
		
				if (dat.mode.ehb && dat.cmap_bits == dat.bmhd.nPlanes) {
					log('EHB detected');
					f.cmap_bits--;
					f.cmap.length = f.cmap.length >> 1;
					f.cmap_overlay.length = f.cmap.length;
				}
				if (dat.mode.HAM && dat.cmap_bits > dat.bmhd.nPlanes - 2) {
					const delta = (dat.cmap_bits - dat.bmhd.nPlanes + 2);
					log('HAM delta: '+ delta);
					dat.cmap_bits -= delta;
					dat.cmap.length = dat.cmap.length >> delta;
					dat.cmap_overlay.length = dat.cmap.length;
				}
				break
			case 'CRNG':	// notstd. but common use and multiple
				log('CRNG chunk size: '+ chunk.size);
				if (!dat.crng) dat.crng = [];
				let tmp = [];
				for (let i = 0; i < chunk.size; i++) {
					tmp.push( getUint8(dat) );
				}
				dat.crng.push( tmp );
				break
			case 'CTBL':	// Color TaBLe
				log('CTBL chunk size: '+ chunk.size);
				const colTblSize = Math.pow(2, dat.bmhd.nPlanes);
				dat.ctbl = [];//new Array(f.bmhd.h).fill(new Array(colTblSize))		// 16 color palette for each single line
				log('CTBL palettes: '+ chunk.size/2/colTblSize);
				if (dat.bmhd.h != chunk.size/2/colTblSize) {
					log('CTBL palettes do not match height');
				}
				for (let i = 0; i < chunk.size/2; i++) {
					const c = getUint16(dat),	// uuuuRRRRGGGGBBBB
					y = Math.floor(i / colTblSize),
					x = (i % colTblSize);
					//if (x == 2) console.log(y,x, padTo8bits((c>>8) & 0xF, 4), padTo8bits((c>>4) & 0xF, 4), padTo8bits(c & 0xF, 4))
					// convert to CMAP style color map
					if (x == 0) dat.ctbl.push([]);
					dat.ctbl[y].push([]);
					dat.ctbl[y][x].push( padTo8bits((c>>8) & 0xF, 4) );
					dat.ctbl[y][x].push( padTo8bits((c>>4) & 0xF, 4) );
					dat.ctbl[y][x].push( padTo8bits((c) & 0xF, 4) );
					dat.ctbl[y][x].push( 255 );
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
				dat.sham = [];
				const shamcolTblSize = 16, // Math.pow(2, dat.bmhd.nPlanes)
				version = getUint16(dat);
				log('SHAM chunk size: '+ chunk.size +' version: '+ version);
				log('SHAM palettes: '+ (chunk.size-2)/2/shamcolTblSize);
				if (dat.bmhd.h != (chunk.size-2)/2/shamcolTblSize) {
					log('SHAM palettes do not match height');
				}
				for (let i = 0; i < (chunk.size-2)/2; i++) {
					const c = getUint16(dat),	// uuuuRRRRGGGGBBBB
					// convert to CMAP style color map
					y = Math.floor(i / shamcolTblSize),
					x = (i % shamcolTblSize);
					if (x == 0) dat.sham.push([]);
					dat.sham[y].push([]);
					dat.sham[y][x].push( padTo8bits((c>>8) & 0xF, 4) );
					dat.sham[y][x].push( padTo8bits((c>>4) & 0xF, 4) );
					dat.sham[y][x].push( padTo8bits((c) & 0xF, 4) );
					dat.sham[y][x].push( 255 );
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
				dat.idx += chunk.size;
				break
			default:
				processCommonChunks(dat, chunk);
		}
	}

	// finally draw
	dat.bmhd.pixBuf = bitPlaneToPixBuffer(dat);
	//showILBM(pixBuf, w*xAspect, h*yAspect, document.getElementById('ILBMcanvas'))
	//showILBM(dat, canv)

	dat.show = (canv) => { showILBM(dat, canv); };
}

function padTo8bits(value, bits) {
	/**
	* Convert an intensity value on x bits into 8 bits.
	* For instance this will convert a 4 bit 0xf value into 0xff
	*/
	var result = 0;
	for (var s = 8 - bits; s >= 0; s -= bits) {
		result |= value << s;
	}
	return result
}
function isCMAPScaled(f) {
	/**
	* Check if the color map is already scaled (and not simply shifted).
	* If the all the low bits for all color entries are zeroes then the palette
	* was shifted and not scaled.
	*/
	var scale_mask = (1 << f.cmap_bits) - 1;
	for (let i = 0; i < f.cmap.length; i++) {
		for (let c = 0; c < 3; c++) {
			var value = f.cmap[i][c];
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
			var value = (f.cmap[i][c] >> (8 - f.cmap_bits));
			f.cmap[i][c] = padTo8bits(value, f.cmap_bits);
		}
	}
	log('CMAP scaled');
}
function showILBM(f, canv) {
	if (f.bmhd.yAspect != 0) {
		/* some Atari files do not set the aspect fields */
		f.bmhd.ratio = f.bmhd.xAspect / f.bmhd.yAspect;
	} else {
		f.bmhd.ratio = 1;
	}
	f.bmhd.eff_w = f.bmhd.w * Math.max(f.bmhd.ratio, 1);
	f.bmhd.eff_h = f.bmhd.h / Math.min(f.bmhd.ratio, 1);

	canv.width = f.bmhd.eff_w;
	canv.height = f.bmhd.eff_h;

	/* offline canvas */
	var render_canvas = document.createElement('canvas');
	render_canvas.width = f.bmhd.w;
	render_canvas.height = f.bmhd.h;
	var render_ctx = render_canvas.getContext('2d');
	var target = render_ctx.createImageData(f.bmhd.w, f.bmhd.h);
	var idx = 0;
	var color = [0, 0, 0, 255];//iff.black_color
	while (idx < f.bmhd.pixBuf.length) {
		var value = f.bmhd.pixBuf[idx];
		//if (idx % f.bmhd.w == 0) lineStart(f, Math.floor(idx / f.bmhd.w))	// call copper ;)
		color = resolvePixels(f, value, color, Math.floor(idx / f.bmhd.w), (idx % f.bmhd.w));
		for (let c = 0; c < 4; c++) {
			target.data[idx * 4 + c] = color[c];
		}
		idx++;
	}
	render_ctx.putImageData(target, 0, 0);

	/* Now render the image into the effective display target, with effective sizes */
	var ctx = canv.getContext('2d');
	ctx.drawImage(render_canvas, 0, 0, f.bmhd.w, f.bmhd.h, 0, 0, f.bmhd.eff_w, f.bmhd.eff_h);
}
function resolveHAMPixel(iff, value, previous_color) {
	//console.log('resolveHAMPixel')
	/**
	* Resolves a HAM encoded value into the correct color.
	* This assumes the color-table has been properly culled.
	*/
	var selector = (value >> iff.cmap_bits) & 3;
	var data = padTo8bits((value % iff.cmap.length), iff.cmap_bits);
	var color_copy = [previous_color[0], previous_color[1], previous_color[2], 255];
	if (selector == 1) {
		color_copy[2] = data;
	} else if (selector == 2) {
		color_copy[0] = data;
	} else {
		color_copy[1] = data;
	}
	return color_copy
}
function resolveEHBPixel(f, value) {
	/**
	* Resolves a EHB encoded value into the correct color.
	* This assumes the color-table has been properly culled.
	*/
	var base_color = f.cmap[(value % f.cmap.length)];
	return [base_color[0] >> 1, base_color[1] >> 1, base_color[2] >> 1, 255]
}
function resolveRGB24Pixel(value) {
	/**
	* Resolves a RGB24 encoded value into a correct color.
	*/
	var red = (value & 0xff0000) >> 16;
	var green = (value & 0xff00) >> 8;
	var blue = value & 0xff;
	return [red, green, blue, 255]
}
function resolvePixels(f, value, previous_color, lineNum, xPos) {
	/**
	* Convert the value for a given pixel into the appropriate rgba value.
	* The resolution logic depends on a lot of factors.
	*/
	if (value == undefined) {
		value = f.bmhd.transparentColor;
	}
	if (f.bmhd.masking == 2 && value == f.bmhd.transparentColor) ;
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
		if (xPos == 0) previous_color = [0, 0, 0, 255];	// black
		return resolveHAMPixel(f, value, previous_color)
	}
	/* ehb mode */
	if (f.mode.ehb) {
		return resolveEHBPixel(f, value)
	}
	console.log('oops no color resolve found');
	return [0, 0, 0, 0]
}
function bitPlaneToPixBuffer(f) {
	/**
	 * De-interlace the bitplanes into per pixel values.
	 * The code currently does not handle the transparency plane properly.
	 */
	var row_bytes = ((f.bmhd.w + 15) >> 4) << 1;
	var ret = new Array(f.bmhd.w * f.bmhd.h).fill(0);
	var planes = f.bmhd.nPlanes;
	if (f.bmhd.masking == 1) {
		planes += 1;
	}
	for (let y = 0; y < f.bmhd.h; y++) {
		for (let p = 0; p < planes; p++) {
			var plane_mask = 1 << p;
			for (let i = 0; i < row_bytes; i++) {
				var bit_offset = (y * planes * row_bytes) + (p * row_bytes) + i;
				var bit_value = f.data[bit_offset];
				for (let b = 0; b < 8; b++) {
					var pixel_mask = 1 << (7 - b);
					if (bit_value & pixel_mask) {
						var x = (i * 8) + b;
						ret[(y * f.bmhd.w) + x] |= plane_mask;
					}
				}
			}
		}
	}
	return ret
}

// based on https://github.com/svanderburg/lib8svx/blob/master/src/lib8svx/fibdelta.c
function unpack_Delta(buf, typ) { // typ = FDC | EDC
	const codeToDelta = (typ === 'FDC') ? [-34, -21, -13, -8, -5, -3, -2, -1, 0, 1, 2, 3, 5, 8, 13, 21] : [-128, -64, -32, -16, -8, -4, -2, -1, 0, 1, 2, 4, 8, 16, 32, 64];
	const ret = [];

	/* First byte of compressed data is padding, second is not compressed */
	ret.push(buf[1]);

	/* Decompress all the other bytes */
	for(let i = 0; i < (buf.length-2)*2; ++i) {
		const compressedByte = buf[Math.floor(i / 2) + 2];
		//	high word for even offsets, low word for odd offsets					
		const code = (i % 2 == 0) ? compressedByte >> 4 : compressedByte & 0xf;
		ret.push( (ret[i] + codeToDelta[code]) & 0xff );
	}

	return ret
}

// based on Tobias (MastaTabs) Seiler (tobi@themaster.de) C version (MT_ADPCM)
// which is of course based on Christian (FlowerPower) Buchner ASM original
function unpack_ADPCM(buf, bits, joinCode) {

	let length = Math.ceil(buf.length / 3),
	estMax = (joinCode & 0xffff),
	delta = ((joinCode & 0xffff0000) >> 16),
	lDelta = 0;

	if(!delta) delta = 5;
	let idx = 0;
	const ret = [],
	matrix = [
		[0x3800, 0x5600, 0, 0, 0, 0, 0, 0],
		[0x399a, 0x3a9f, 0x4d14, 0x6607, 0, 0, 0, 0],
		[0x3556, 0x3556, 0x399A, 0x3A9F, 0x4200, 0x4D14, 0x6607, 0x6607],
	],
	bitmask = [0, 0x01, 0x03, 0x07, 0x0f, 0x1f, 0x3f, 0x7f, 0xff];

	while(length--) {
		let sampleCount = 24/bits;
		let temp = (buf[idx++] << 16) | (buf[idx++] << 8) | buf[idx++];

		while(sampleCount--) {
			let newEstMax = (delta >> 1);
			let shifter = (temp >> sampleCount*bits);
			let b = (shifter & bitmask[bits-1]);

			if ((bits == 4) && ((shifter & 0xf) == 0))
				delta = 4;

			while(b--) {
				newEstMax += delta;
			}

			lDelta = delta * matrix[bits-2][shifter & bitmask[bits-1]];

			if(shifter & (1<<(bits-1))) {	// SignBit
				newEstMax = -newEstMax;
			}
			estMax = (estMax + newEstMax) & 0xffff;

			delta = (lDelta + 8192) >> 14;

			if(delta < 5) delta = 5;

			newEstMax = estMax >> 6;
			if(127 < newEstMax)
				ret.push(127);
			else if(-128 > newEstMax)
				ret.push(-128);
			else
				ret.push(newEstMax);
		}
	}
	return ret // joinCode (delta<<16|(estMax&0xffff))
}

function resample(buf, srcRate, destRate) {
	// i only take care of upsampling and i do not even interpolate
	const ret = [],
	fac = destRate/srcRate,
	fac_int = Math.floor(destRate/srcRate);
	const fac_dec = fac - fac_int;

	for (let i = 0, dec = 0; i < buf.length; i++) { // loop this before end
		for (let j = 0; j < fac_int; j++) {
			// this takes care of int part of factor
			ret.push(buf[i]);
		}
		dec += fac_dec;
		if (dec >= 1) {
			// decimal part
			ret.push(buf[i]);
			dec -= 1;
		}
	}

	return ret
}

/*
	Audio context with AudioWorklet by DrSnuggles
	License : WTFPL 2.0, Beerware Revision 42
*/

async function initContext(dat) {
	stop(dat);

	try {
		dat.ctx = new AudioContext({sampleRate: dat.sampleRate});
	}
	catch (ex) {
		log('Error on init new AudioContext() with samplerate ' + dat.sampleRate + ': ' + ex);
		log('Retrying without specifying samplerate and using resample() instead.');
		dat.ctx = new AudioContext();
	}
	log('srcRate: '+ dat.sampleRate);
	log('destRate: '+ dat.ctx.sampleRate);
	if (dat.sampleRate !== dat.ctx.sampleRate) {
		// Edge for example cannot handle unusual sample rates
		for (let i = 0; i < dat.channels; i++) {
			dat.ch[i] = resample(dat.ch[i], dat.sampleRate, dat.ctx.sampleRate);
		}
	}

	dat.duration = dat.ch.length > 0 ? (dat.ch[0].length / dat.sampleRate) : 0;
	log('duration in seconds: '+ dat.duration);

	// Worker
	//await dat.ctx.audioWorklet.addModule( new URL('audioWorklet.js', import.meta.url) )
	await dat.ctx.audioWorklet.addModule(URL.createObjectURL( new Blob(['class BufferPlayer extends AudioWorkletProcessor{constructor(){super(),this.port.onmessage=this.handleMessage_.bind(this),this.ch=[],this.frame=0}process(e,r,s){if(0==this.ch.length)return!0;if(-1==this.frame)return!0;for(let e=0;e<r[0][0].length;e++){for(let s=0;s<r[0].length;s++)r[0][s][e]=this.ch[s][this.frame];this.frame++,this.frame>=this.ch[0].length&&(this.frame=-1),this.port.postMessage({frame:this.frame})}return!0}handleMessage_(e){e.data.ch&&(this.ch=e.data.ch),e.data.frame>=0&&(this.frame=e.data.frame)}}registerProcessor("bufferplayer-processor",BufferPlayer)'], {type: "application/javascript"}) ));

	dat.aw = new AudioWorkletNode(dat.ctx, 'bufferplayer-processor', {
		numberOfInputs: 0,
		numberOfOutputs: 1,
		outputChannelCount: [dat.channels]
	});
	dat.aw.connect(dat.ctx.destination);	// connect to output
	dat.aw.port.onmessage = (msg) => {
		//console.log('Message from audioWorklet worker', msg)
		if (msg.data.frame >= 0) {
			dat.currentTime = msg.data.frame / dat.sampleRate;
		}
		else if (msg.data.frame == -1) {
			if (dat.loops) {
				dat.looped++;
				log('looped: ' + dat.looped + ' of ' + (dat.loops < 0 ? 'infinite (until stop() is called)' : dat.loops));
				if (dat.loops >= 0 && dat.looped >= dat.loops) {
					stop(dat);
					if (dat.cbOnEnd) dat.cbOnEnd();
				}
			}
			else {
				stop(dat);
				if (dat.cbOnEnd) dat.cbOnEnd();
			}
		}
	};
}

async function play(dat, loops) { // use loops < 0 for infinite looping or until stop() is called
	dat.loops = loops;
	dat.looped = 0;
	dat.paused = false;
	dat.currentTime = 0;
	dat.aw.port.postMessage({ch:dat.ch});
}

function stop(dat) {
	dat.paused = false;
	if (dat.ctx && dat.ctx.state !== 'closed') dat.ctx.close();
}

function pause(dat) {
	if (dat.ctx && dat.ctx.state === 'running') {
		dat.paused = true;
		dat.ctx.suspend();
	}
}

function resume(dat) {
	dat.paused = false;
	if (dat.ctx && dat.ctx.state === 'suspended') dat.ctx.resume();
}

function getPosition(dat) {
	return dat.currentTime
}

function setPosition(dat, pos) {
	if (dat.aw) {
		dat.aw.port.postMessage({frame: Math.round(pos * dat.sampleRate)});
	}
}

/*	IFF 8SVX / 16SV by DrSnuggles
	License : WTFPL 2.0, Beerware Revision 42
	https://wiki.amigaos.net/wiki/8SVX_IFF_8-Bit_Sampled_Voice
*/

async function parse$1(dat) {
	// read next chunk, needs to be VHDR
	let chunk = readChunk(dat);
	if (chunk.name !== 'VHDR') {
		const msg = 'Missing VHDR chunk. This is not a valid SVX file.';
		log(msg);
		if (dat.cbOnError) dat.cbOnError(new Error(msg));
		return
	}
	log('VHDR chunk size: '+ chunk.size);
	dat.vhdr = {
		oneShotHiSamples: getUint32(dat),
		repeatHiSamples: getUint32(dat),
		samplesPerHiCycle: getUint32(dat),
		samplesPerSec: getUint16(dat),
		ctOctave: getUint8(dat),
		sCompression: getUint8(dat),
		volume: getUint32(dat),
	};

	log('oneShotHiSamples: '+ dat.vhdr.oneShotHiSamples); // unpacked dest size
	log('repeatHiSamples: '+ dat.vhdr.repeatHiSamples);
	log('samplesPerHiCycle: '+ dat.vhdr.samplesPerHiCycle);
	log('samplesPerSec: '+ dat.vhdr.samplesPerSec);
	log('ctOctave: '+ dat.vhdr.ctOctave);
	log('sCompression: '+ dat.vhdr.sCompression);
	log('volume: '+ dat.vhdr.volume); // 0..65536 (not used)

	// defaults
	dat.channels = 1;
	dat.sampleRate = dat.vhdr.samplesPerSec;
	log('Bits: '+ dat.bits);

	// read chunks
	while (dat.idx < dat.dv.byteLength -8) {	// -8 = ChunkName + ChunkSize
		// if (dat.idx % 2 != 0) dat.idx++	// Don't forget to skip the implied pad byte after every odd-length chunk, this is not included in the chunk count!
		// uhh satie mono 8svx NAME chunk is not word aligned :(
		chunk = readChunk(dat);
		switch (chunk.name) {
			case 'BODY':
				log('BODY chunk size: '+ chunk.size);
				if (dat.vhdr.sCompression === 0) {
					if (dat.bits === 8) {
						// the final uncompressed BODY is signed 8bit -128...+127
						dat.data = new Int8Array( chunk.size );
						dat.data.set( new Int8Array(dat.dv.buffer).slice(dat.idx, dat.idx+chunk.size));
					} else {
						// the final uncompressed BODY is signed 16bit -32768...+32767
						dat.data = [];
						for (let i = 0; i < chunk.size/2; i++) {
							dat.data.push( dat.dv.getInt16(dat.idx + 2*i, false) );
						}
						dat.data = new Int16Array( dat.data );	// want typed array
					}
				} else {
					// packers want Uint8 data
					// 0 = uncompressed
					// 1 = Fibonacci delta (wavepak)
					// 2 = unoff Exponential delta (wavepak)
					// 3 = unoff ADPCM2 (8svx_comp)
					// 4 = unoff ADPCM3 (8svx_comp)
					// here it is not ONE full packed set, each channel is depacked alone and then concatenated with spread operator
					dat.data = [];
					for (let i = 0; i < dat.channels; i++) {
						const channelLength = chunk.size/dat.channels;
						const packedData = new Uint8Array(channelLength);
						packedData.set( new Uint8Array(dat.dv.buffer).slice(dat.idx+i*channelLength, dat.idx+(i+1)*channelLength) );
						//if (dat.vhdr.sCompression > 0 && dat.vhdr.sCompression < 3 && typeof unpack_Delta == 'undefined') window.unpack_Delta = await import('./unpackers/delta.js')
						if (dat.vhdr.sCompression == 1) dat.data = [ ...dat.data, ...unpack_Delta(packedData, 'FDC') ];
						if (dat.vhdr.sCompression == 2) dat.data = [ ...dat.data, ...unpack_Delta(packedData, 'EDC') ];
						//if (dat.vhdr.sCompression > 2 && typeof unpack_ADPCM == 'undefined') window.unpack_ADPCM = await import('./unpackers/adpcm.js')
						if (dat.vhdr.sCompression == 3) dat.data = [ ...dat.data, ...unpack_ADPCM(packedData, 2, 0) ];
						if (dat.vhdr.sCompression == 4) dat.data = [ ...dat.data, ...unpack_ADPCM(packedData, 3, 0) ];
					}
					// store typed
					dat.data = new Int8Array( dat.data );
				}
				dat.idx += chunk.size;
				/*
				if (dat.data.length % 2 == 1) {
					console.log('make it even')
					dat.data = [...dat.data,0]
				}
				console.log(dat.data.length)
				*/
				break
			case 'CHAN':
				log('CHAN chunk size: '+ chunk.size);
				/*
				2=LEFT, 4=RIGHT, 6=STEREO, 30=QUADRO
				The BODY chunk for stereo
				pairs contains both left and right information. To adhere to existing
				conventions, sampling software should write first the LEFT information,
				followed by the RIGHT. The LEFT and RIGHT information should be equal in
				length.
				*/
				dat.chan = getUint32(dat);
				log('CHAN: ' + dat.chan);

				switch (dat.chan) {
					case 6:
						dat.channels = 2;
						break
					case 30:
						dat.channels = 4;
						break
				}
				log('channels: ' + dat.channels);
				break
			case 'PAN ': // not used yet
				log('PAN chunk size: '+ chunk.size);
				/*
				not further used here but read
				sample has to be played on both channels
				max volume is set in vhdr
				leftChannelVolume = maxVolume - pan
				rightChannelVolume = maxVolume - leftChannelVolume
				*/
				dat.pan = getUint32(dat);
				break
			case 'SEQN': // not used yet
				log('SEQN chunk size: '+ chunk.size);
				dat.seqn = [];
				for (let i = 0; i < chunk.size/8; i++) {
					dat.seqn.push({start: getUint32(dat), end: getUint32(dat)});
				}
				break
			case 'FADE':  // not used yet
				log('FADE chunk size: '+ chunk.size);
				f.fade = getUint32(dat);
				break
			case 'ATAK':  // not used yet https://wiki.amigaos.net/wiki/8SVX_IFF_8-Bit_Sampled_Voice#Optional_Data_Chunks_ATAK_and_RLSE
				log('ATAK chunk size: '+ chunk.size);
				dat.atak = [];
				for (let i = 0; i < chunk.size/6; i++) {
					dat.atak.push({duration: getUint32(dat), dest: getUint32(dat)});
				}
				break
			case 'RLSE':  // not used yet https://wiki.amigaos.net/wiki/8SVX_IFF_8-Bit_Sampled_Voice#Optional_Data_Chunks_ATAK_and_RLSE
				log('RLSE chunk size: '+ chunk.size);
				dat.rlse = [];
				for (let i = 0; i < chunk.size/6; i++) {
					dat.rlse.push({duration: getUint32(dat), dest: getUint32(dat)});
				}
				break
			default:
				processCommonChunks(dat, chunk);
		}

	}

	prepareChannels(dat);
	await initContext(dat);

	dat.play = (loops) => { play(dat, loops); };
	dat.stop = () => { stop(dat); };
	dat.pause = () => { pause(dat); };
	dat.resume = () => { resume(dat); };
	dat.getPosition = () => { return getPosition(dat) };
	dat.setPosition = (pos) => { setPosition(dat, pos); };
}

function prepareChannels(dat) {
	// LLLLRRRR
	// prepare for playback. We need seperate channels with Floats range -1..+1
	dat.ch = [];	// array of channels
	for (let ch = 0, j = 0; ch < dat.channels; ch++) {
		const channel = [];
		if (dat.bits == 8) {
			// 8 bits
			for (let i = 0; i < dat.data.length/dat.channels; i++) {
				channel.push( dat.data[j++] / 128 );
			}
		} else {
			// 16 bits
			for (let i = 0; i < dat.data.length/dat.channels; i++) {
				channel.push( dat.data[j++] / 32768 );
			}
		}
		dat.ch.push( new Float32Array(channel) );
	}
}

/*
 *      bignumber.js v9.1.2
 *      A JavaScript library for arbitrary-precision arithmetic.
 *      https://github.com/MikeMcl/bignumber.js
 *      Copyright (c) 2022 Michael Mclaughlin <M8ch88l@gmail.com>
 *      MIT Licensed.
 *
 *      BigNumber.prototype methods     |  BigNumber methods
 *                                      |
 *      absoluteValue            abs    |  clone
 *      comparedTo                      |  config               set
 *      decimalPlaces            dp     |      DECIMAL_PLACES
 *      dividedBy                div    |      ROUNDING_MODE
 *      dividedToIntegerBy       idiv   |      EXPONENTIAL_AT
 *      exponentiatedBy          pow    |      RANGE
 *      integerValue                    |      CRYPTO
 *      isEqualTo                eq     |      MODULO_MODE
 *      isFinite                        |      POW_PRECISION
 *      isGreaterThan            gt     |      FORMAT
 *      isGreaterThanOrEqualTo   gte    |      ALPHABET
 *      isInteger                       |  isBigNumber
 *      isLessThan               lt     |  maximum              max
 *      isLessThanOrEqualTo      lte    |  minimum              min
 *      isNaN                           |  random
 *      isNegative                      |  sum
 *      isPositive                      |
 *      isZero                          |
 *      minus                           |
 *      modulo                   mod    |
 *      multipliedBy             times  |
 *      negated                         |
 *      plus                            |
 *      precision                sd     |
 *      shiftedBy                       |
 *      squareRoot               sqrt   |
 *      toExponential                   |
 *      toFixed                         |
 *      toFormat                        |
 *      toFraction                      |
 *      toJSON                          |
 *      toNumber                        |
 *      toPrecision                     |
 *      toString                        |
 *      valueOf                         |
 *
 */


var
  isNumeric = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i,
  mathceil = Math.ceil,
  mathfloor = Math.floor,

  bignumberError = '[BigNumber Error] ',
  tooManyDigits = bignumberError + 'Number primitive has more than 15 significant digits: ',

  BASE = 1e14,
  LOG_BASE = 14,
  MAX_SAFE_INTEGER = 0x1fffffffffffff,         // 2^53 - 1
  // MAX_INT32 = 0x7fffffff,                   // 2^31 - 1
  POWS_TEN = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13],
  SQRT_BASE = 1e7,

  // EDITABLE
  // The limit on the value of DECIMAL_PLACES, TO_EXP_NEG, TO_EXP_POS, MIN_EXP, MAX_EXP, and
  // the arguments to toExponential, toFixed, toFormat, and toPrecision.
  MAX = 1E9;                                   // 0 to MAX_INT32


/*
 * Create and return a BigNumber constructor.
 */
function clone(configObject) {
  var div, convertBase, parseNumeric,
    P = BigNumber.prototype = { constructor: BigNumber, toString: null, valueOf: null },
    ONE = new BigNumber(1),


    //----------------------------- EDITABLE CONFIG DEFAULTS -------------------------------


    // The default values below must be integers within the inclusive ranges stated.
    // The values can also be changed at run-time using BigNumber.set.

    // The maximum number of decimal places for operations involving division.
    DECIMAL_PLACES = 20,                     // 0 to MAX

    // The rounding mode used when rounding to the above decimal places, and when using
    // toExponential, toFixed, toFormat and toPrecision, and round (default value).
    // UP         0 Away from zero.
    // DOWN       1 Towards zero.
    // CEIL       2 Towards +Infinity.
    // FLOOR      3 Towards -Infinity.
    // HALF_UP    4 Towards nearest neighbour. If equidistant, up.
    // HALF_DOWN  5 Towards nearest neighbour. If equidistant, down.
    // HALF_EVEN  6 Towards nearest neighbour. If equidistant, towards even neighbour.
    // HALF_CEIL  7 Towards nearest neighbour. If equidistant, towards +Infinity.
    // HALF_FLOOR 8 Towards nearest neighbour. If equidistant, towards -Infinity.
    ROUNDING_MODE = 4,                       // 0 to 8

    // EXPONENTIAL_AT : [TO_EXP_NEG , TO_EXP_POS]

    // The exponent value at and beneath which toString returns exponential notation.
    // Number type: -7
    TO_EXP_NEG = -7,                         // 0 to -MAX

    // The exponent value at and above which toString returns exponential notation.
    // Number type: 21
    TO_EXP_POS = 21,                         // 0 to MAX

    // RANGE : [MIN_EXP, MAX_EXP]

    // The minimum exponent value, beneath which underflow to zero occurs.
    // Number type: -324  (5e-324)
    MIN_EXP = -1e7,                          // -1 to -MAX

    // The maximum exponent value, above which overflow to Infinity occurs.
    // Number type:  308  (1.7976931348623157e+308)
    // For MAX_EXP > 1e7, e.g. new BigNumber('1e100000000').plus(1) may be slow.
    MAX_EXP = 1e7,                           // 1 to MAX

    // Whether to use cryptographically-secure random number generation, if available.
    CRYPTO = false,                          // true or false

    // The modulo mode used when calculating the modulus: a mod n.
    // The quotient (q = a / n) is calculated according to the corresponding rounding mode.
    // The remainder (r) is calculated as: r = a - n * q.
    //
    // UP        0 The remainder is positive if the dividend is negative, else is negative.
    // DOWN      1 The remainder has the same sign as the dividend.
    //             This modulo mode is commonly known as 'truncated division' and is
    //             equivalent to (a % n) in JavaScript.
    // FLOOR     3 The remainder has the same sign as the divisor (Python %).
    // HALF_EVEN 6 This modulo mode implements the IEEE 754 remainder function.
    // EUCLID    9 Euclidian division. q = sign(n) * floor(a / abs(n)).
    //             The remainder is always positive.
    //
    // The truncated division, floored division, Euclidian division and IEEE 754 remainder
    // modes are commonly used for the modulus operation.
    // Although the other rounding modes can also be used, they may not give useful results.
    MODULO_MODE = 1,                         // 0 to 9

    // The maximum number of significant digits of the result of the exponentiatedBy operation.
    // If POW_PRECISION is 0, there will be unlimited significant digits.
    POW_PRECISION = 0,                       // 0 to MAX

    // The format specification used by the BigNumber.prototype.toFormat method.
    FORMAT = {
      prefix: '',
      groupSize: 3,
      secondaryGroupSize: 0,
      groupSeparator: ',',
      decimalSeparator: '.',
      fractionGroupSize: 0,
      fractionGroupSeparator: '\xA0',        // non-breaking space
      suffix: ''
    },

    // The alphabet used for base conversion. It must be at least 2 characters long, with no '+',
    // '-', '.', whitespace, or repeated character.
    // '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_'
    ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz',
    alphabetHasNormalDecimalDigits = true;


  //------------------------------------------------------------------------------------------


  // CONSTRUCTOR


  /*
   * The BigNumber constructor and exported function.
   * Create and return a new instance of a BigNumber object.
   *
   * v {number|string|BigNumber} A numeric value.
   * [b] {number} The base of v. Integer, 2 to ALPHABET.length inclusive.
   */
  function BigNumber(v, b) {
    var alphabet, c, caseChanged, e, i, isNum, len, str,
      x = this;

    // Enable constructor call without `new`.
    if (!(x instanceof BigNumber)) return new BigNumber(v, b);

    if (b == null) {

      if (v && v._isBigNumber === true) {
        x.s = v.s;

        if (!v.c || v.e > MAX_EXP) {
          x.c = x.e = null;
        } else if (v.e < MIN_EXP) {
          x.c = [x.e = 0];
        } else {
          x.e = v.e;
          x.c = v.c.slice();
        }

        return;
      }

      if ((isNum = typeof v == 'number') && v * 0 == 0) {

        // Use `1 / n` to handle minus zero also.
        x.s = 1 / v < 0 ? (v = -v, -1) : 1;

        // Fast path for integers, where n < 2147483648 (2**31).
        if (v === ~~v) {
          for (e = 0, i = v; i >= 10; i /= 10, e++);

          if (e > MAX_EXP) {
            x.c = x.e = null;
          } else {
            x.e = e;
            x.c = [v];
          }

          return;
        }

        str = String(v);
      } else {

        if (!isNumeric.test(str = String(v))) return parseNumeric(x, str, isNum);

        x.s = str.charCodeAt(0) == 45 ? (str = str.slice(1), -1) : 1;
      }

      // Decimal point?
      if ((e = str.indexOf('.')) > -1) str = str.replace('.', '');

      // Exponential form?
      if ((i = str.search(/e/i)) > 0) {

        // Determine exponent.
        if (e < 0) e = i;
        e += +str.slice(i + 1);
        str = str.substring(0, i);
      } else if (e < 0) {

        // Integer.
        e = str.length;
      }

    } else {

      // '[BigNumber Error] Base {not a primitive number|not an integer|out of range}: {b}'
      intCheck(b, 2, ALPHABET.length, 'Base');

      // Allow exponential notation to be used with base 10 argument, while
      // also rounding to DECIMAL_PLACES as with other bases.
      if (b == 10 && alphabetHasNormalDecimalDigits) {
        x = new BigNumber(v);
        return round(x, DECIMAL_PLACES + x.e + 1, ROUNDING_MODE);
      }

      str = String(v);

      if (isNum = typeof v == 'number') {

        // Avoid potential interpretation of Infinity and NaN as base 44+ values.
        if (v * 0 != 0) return parseNumeric(x, str, isNum, b);

        x.s = 1 / v < 0 ? (str = str.slice(1), -1) : 1;

        // '[BigNumber Error] Number primitive has more than 15 significant digits: {n}'
        if (BigNumber.DEBUG && str.replace(/^0\.0*|\./, '').length > 15) {
          throw Error
           (tooManyDigits + v);
        }
      } else {
        x.s = str.charCodeAt(0) === 45 ? (str = str.slice(1), -1) : 1;
      }

      alphabet = ALPHABET.slice(0, b);
      e = i = 0;

      // Check that str is a valid base b number.
      // Don't use RegExp, so alphabet can contain special characters.
      for (len = str.length; i < len; i++) {
        if (alphabet.indexOf(c = str.charAt(i)) < 0) {
          if (c == '.') {

            // If '.' is not the first character and it has not be found before.
            if (i > e) {
              e = len;
              continue;
            }
          } else if (!caseChanged) {

            // Allow e.g. hexadecimal 'FF' as well as 'ff'.
            if (str == str.toUpperCase() && (str = str.toLowerCase()) ||
                str == str.toLowerCase() && (str = str.toUpperCase())) {
              caseChanged = true;
              i = -1;
              e = 0;
              continue;
            }
          }

          return parseNumeric(x, String(v), isNum, b);
        }
      }

      // Prevent later check for length on converted number.
      isNum = false;
      str = convertBase(str, b, 10, x.s);

      // Decimal point?
      if ((e = str.indexOf('.')) > -1) str = str.replace('.', '');
      else e = str.length;
    }

    // Determine leading zeros.
    for (i = 0; str.charCodeAt(i) === 48; i++);

    // Determine trailing zeros.
    for (len = str.length; str.charCodeAt(--len) === 48;);

    if (str = str.slice(i, ++len)) {
      len -= i;

      // '[BigNumber Error] Number primitive has more than 15 significant digits: {n}'
      if (isNum && BigNumber.DEBUG &&
        len > 15 && (v > MAX_SAFE_INTEGER || v !== mathfloor(v))) {
          throw Error
           (tooManyDigits + (x.s * v));
      }

       // Overflow?
      if ((e = e - i - 1) > MAX_EXP) {

        // Infinity.
        x.c = x.e = null;

      // Underflow?
      } else if (e < MIN_EXP) {

        // Zero.
        x.c = [x.e = 0];
      } else {
        x.e = e;
        x.c = [];

        // Transform base

        // e is the base 10 exponent.
        // i is where to slice str to get the first element of the coefficient array.
        i = (e + 1) % LOG_BASE;
        if (e < 0) i += LOG_BASE;  // i < 1

        if (i < len) {
          if (i) x.c.push(+str.slice(0, i));

          for (len -= LOG_BASE; i < len;) {
            x.c.push(+str.slice(i, i += LOG_BASE));
          }

          i = LOG_BASE - (str = str.slice(i)).length;
        } else {
          i -= len;
        }

        for (; i--; str += '0');
        x.c.push(+str);
      }
    } else {

      // Zero.
      x.c = [x.e = 0];
    }
  }


  // CONSTRUCTOR PROPERTIES


  BigNumber.clone = clone;

  BigNumber.ROUND_UP = 0;
  BigNumber.ROUND_DOWN = 1;
  BigNumber.ROUND_CEIL = 2;
  BigNumber.ROUND_FLOOR = 3;
  BigNumber.ROUND_HALF_UP = 4;
  BigNumber.ROUND_HALF_DOWN = 5;
  BigNumber.ROUND_HALF_EVEN = 6;
  BigNumber.ROUND_HALF_CEIL = 7;
  BigNumber.ROUND_HALF_FLOOR = 8;
  BigNumber.EUCLID = 9;


  /*
   * Configure infrequently-changing library-wide settings.
   *
   * Accept an object with the following optional properties (if the value of a property is
   * a number, it must be an integer within the inclusive range stated):
   *
   *   DECIMAL_PLACES   {number}           0 to MAX
   *   ROUNDING_MODE    {number}           0 to 8
   *   EXPONENTIAL_AT   {number|number[]}  -MAX to MAX  or  [-MAX to 0, 0 to MAX]
   *   RANGE            {number|number[]}  -MAX to MAX (not zero)  or  [-MAX to -1, 1 to MAX]
   *   CRYPTO           {boolean}          true or false
   *   MODULO_MODE      {number}           0 to 9
   *   POW_PRECISION       {number}           0 to MAX
   *   ALPHABET         {string}           A string of two or more unique characters which does
   *                                       not contain '.'.
   *   FORMAT           {object}           An object with some of the following properties:
   *     prefix                 {string}
   *     groupSize              {number}
   *     secondaryGroupSize     {number}
   *     groupSeparator         {string}
   *     decimalSeparator       {string}
   *     fractionGroupSize      {number}
   *     fractionGroupSeparator {string}
   *     suffix                 {string}
   *
   * (The values assigned to the above FORMAT object properties are not checked for validity.)
   *
   * E.g.
   * BigNumber.config({ DECIMAL_PLACES : 20, ROUNDING_MODE : 4 })
   *
   * Ignore properties/parameters set to null or undefined, except for ALPHABET.
   *
   * Return an object with the properties current values.
   */
  BigNumber.config = BigNumber.set = function (obj) {
    var p, v;

    if (obj != null) {

      if (typeof obj == 'object') {

        // DECIMAL_PLACES {number} Integer, 0 to MAX inclusive.
        // '[BigNumber Error] DECIMAL_PLACES {not a primitive number|not an integer|out of range}: {v}'
        if (obj.hasOwnProperty(p = 'DECIMAL_PLACES')) {
          v = obj[p];
          intCheck(v, 0, MAX, p);
          DECIMAL_PLACES = v;
        }

        // ROUNDING_MODE {number} Integer, 0 to 8 inclusive.
        // '[BigNumber Error] ROUNDING_MODE {not a primitive number|not an integer|out of range}: {v}'
        if (obj.hasOwnProperty(p = 'ROUNDING_MODE')) {
          v = obj[p];
          intCheck(v, 0, 8, p);
          ROUNDING_MODE = v;
        }

        // EXPONENTIAL_AT {number|number[]}
        // Integer, -MAX to MAX inclusive or
        // [integer -MAX to 0 inclusive, 0 to MAX inclusive].
        // '[BigNumber Error] EXPONENTIAL_AT {not a primitive number|not an integer|out of range}: {v}'
        if (obj.hasOwnProperty(p = 'EXPONENTIAL_AT')) {
          v = obj[p];
          if (v && v.pop) {
            intCheck(v[0], -MAX, 0, p);
            intCheck(v[1], 0, MAX, p);
            TO_EXP_NEG = v[0];
            TO_EXP_POS = v[1];
          } else {
            intCheck(v, -MAX, MAX, p);
            TO_EXP_NEG = -(TO_EXP_POS = v < 0 ? -v : v);
          }
        }

        // RANGE {number|number[]} Non-zero integer, -MAX to MAX inclusive or
        // [integer -MAX to -1 inclusive, integer 1 to MAX inclusive].
        // '[BigNumber Error] RANGE {not a primitive number|not an integer|out of range|cannot be zero}: {v}'
        if (obj.hasOwnProperty(p = 'RANGE')) {
          v = obj[p];
          if (v && v.pop) {
            intCheck(v[0], -MAX, -1, p);
            intCheck(v[1], 1, MAX, p);
            MIN_EXP = v[0];
            MAX_EXP = v[1];
          } else {
            intCheck(v, -MAX, MAX, p);
            if (v) {
              MIN_EXP = -(MAX_EXP = v < 0 ? -v : v);
            } else {
              throw Error
               (bignumberError + p + ' cannot be zero: ' + v);
            }
          }
        }

        // CRYPTO {boolean} true or false.
        // '[BigNumber Error] CRYPTO not true or false: {v}'
        // '[BigNumber Error] crypto unavailable'
        if (obj.hasOwnProperty(p = 'CRYPTO')) {
          v = obj[p];
          if (v === !!v) {
            if (v) {
              if (typeof crypto != 'undefined' && crypto &&
               (crypto.getRandomValues || crypto.randomBytes)) {
                CRYPTO = v;
              } else {
                CRYPTO = !v;
                throw Error
                 (bignumberError + 'crypto unavailable');
              }
            } else {
              CRYPTO = v;
            }
          } else {
            throw Error
             (bignumberError + p + ' not true or false: ' + v);
          }
        }

        // MODULO_MODE {number} Integer, 0 to 9 inclusive.
        // '[BigNumber Error] MODULO_MODE {not a primitive number|not an integer|out of range}: {v}'
        if (obj.hasOwnProperty(p = 'MODULO_MODE')) {
          v = obj[p];
          intCheck(v, 0, 9, p);
          MODULO_MODE = v;
        }

        // POW_PRECISION {number} Integer, 0 to MAX inclusive.
        // '[BigNumber Error] POW_PRECISION {not a primitive number|not an integer|out of range}: {v}'
        if (obj.hasOwnProperty(p = 'POW_PRECISION')) {
          v = obj[p];
          intCheck(v, 0, MAX, p);
          POW_PRECISION = v;
        }

        // FORMAT {object}
        // '[BigNumber Error] FORMAT not an object: {v}'
        if (obj.hasOwnProperty(p = 'FORMAT')) {
          v = obj[p];
          if (typeof v == 'object') FORMAT = v;
          else throw Error
           (bignumberError + p + ' not an object: ' + v);
        }

        // ALPHABET {string}
        // '[BigNumber Error] ALPHABET invalid: {v}'
        if (obj.hasOwnProperty(p = 'ALPHABET')) {
          v = obj[p];

          // Disallow if less than two characters,
          // or if it contains '+', '-', '.', whitespace, or a repeated character.
          if (typeof v == 'string' && !/^.?$|[+\-.\s]|(.).*\1/.test(v)) {
            alphabetHasNormalDecimalDigits = v.slice(0, 10) == '0123456789';
            ALPHABET = v;
          } else {
            throw Error
             (bignumberError + p + ' invalid: ' + v);
          }
        }

      } else {

        // '[BigNumber Error] Object expected: {v}'
        throw Error
         (bignumberError + 'Object expected: ' + obj);
      }
    }

    return {
      DECIMAL_PLACES: DECIMAL_PLACES,
      ROUNDING_MODE: ROUNDING_MODE,
      EXPONENTIAL_AT: [TO_EXP_NEG, TO_EXP_POS],
      RANGE: [MIN_EXP, MAX_EXP],
      CRYPTO: CRYPTO,
      MODULO_MODE: MODULO_MODE,
      POW_PRECISION: POW_PRECISION,
      FORMAT: FORMAT,
      ALPHABET: ALPHABET
    };
  };


  /*
   * Return true if v is a BigNumber instance, otherwise return false.
   *
   * If BigNumber.DEBUG is true, throw if a BigNumber instance is not well-formed.
   *
   * v {any}
   *
   * '[BigNumber Error] Invalid BigNumber: {v}'
   */
  BigNumber.isBigNumber = function (v) {
    if (!v || v._isBigNumber !== true) return false;
    if (!BigNumber.DEBUG) return true;

    var i, n,
      c = v.c,
      e = v.e,
      s = v.s;

    out: if ({}.toString.call(c) == '[object Array]') {

      if ((s === 1 || s === -1) && e >= -MAX && e <= MAX && e === mathfloor(e)) {

        // If the first element is zero, the BigNumber value must be zero.
        if (c[0] === 0) {
          if (e === 0 && c.length === 1) return true;
          break out;
        }

        // Calculate number of digits that c[0] should have, based on the exponent.
        i = (e + 1) % LOG_BASE;
        if (i < 1) i += LOG_BASE;

        // Calculate number of digits of c[0].
        //if (Math.ceil(Math.log(c[0] + 1) / Math.LN10) == i) {
        if (String(c[0]).length == i) {

          for (i = 0; i < c.length; i++) {
            n = c[i];
            if (n < 0 || n >= BASE || n !== mathfloor(n)) break out;
          }

          // Last element cannot be zero, unless it is the only element.
          if (n !== 0) return true;
        }
      }

    // Infinity/NaN
    } else if (c === null && e === null && (s === null || s === 1 || s === -1)) {
      return true;
    }

    throw Error
      (bignumberError + 'Invalid BigNumber: ' + v);
  };


  /*
   * Return a new BigNumber whose value is the maximum of the arguments.
   *
   * arguments {number|string|BigNumber}
   */
  BigNumber.maximum = BigNumber.max = function () {
    return maxOrMin(arguments, -1);
  };


  /*
   * Return a new BigNumber whose value is the minimum of the arguments.
   *
   * arguments {number|string|BigNumber}
   */
  BigNumber.minimum = BigNumber.min = function () {
    return maxOrMin(arguments, 1);
  };


  /*
   * Return a new BigNumber with a random value equal to or greater than 0 and less than 1,
   * and with dp, or DECIMAL_PLACES if dp is omitted, decimal places (or less if trailing
   * zeros are produced).
   *
   * [dp] {number} Decimal places. Integer, 0 to MAX inclusive.
   *
   * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {dp}'
   * '[BigNumber Error] crypto unavailable'
   */
  BigNumber.random = (function () {
    var pow2_53 = 0x20000000000000;

    // Return a 53 bit integer n, where 0 <= n < 9007199254740992.
    // Check if Math.random() produces more than 32 bits of randomness.
    // If it does, assume at least 53 bits are produced, otherwise assume at least 30 bits.
    // 0x40000000 is 2^30, 0x800000 is 2^23, 0x1fffff is 2^21 - 1.
    var random53bitInt = (Math.random() * pow2_53) & 0x1fffff
     ? function () { return mathfloor(Math.random() * pow2_53); }
     : function () { return ((Math.random() * 0x40000000 | 0) * 0x800000) +
       (Math.random() * 0x800000 | 0); };

    return function (dp) {
      var a, b, e, k, v,
        i = 0,
        c = [],
        rand = new BigNumber(ONE);

      if (dp == null) dp = DECIMAL_PLACES;
      else intCheck(dp, 0, MAX);

      k = mathceil(dp / LOG_BASE);

      if (CRYPTO) {

        // Browsers supporting crypto.getRandomValues.
        if (crypto.getRandomValues) {

          a = crypto.getRandomValues(new Uint32Array(k *= 2));

          for (; i < k;) {

            // 53 bits:
            // ((Math.pow(2, 32) - 1) * Math.pow(2, 21)).toString(2)
            // 11111 11111111 11111111 11111111 11100000 00000000 00000000
            // ((Math.pow(2, 32) - 1) >>> 11).toString(2)
            //                                     11111 11111111 11111111
            // 0x20000 is 2^21.
            v = a[i] * 0x20000 + (a[i + 1] >>> 11);

            // Rejection sampling:
            // 0 <= v < 9007199254740992
            // Probability that v >= 9e15, is
            // 7199254740992 / 9007199254740992 ~= 0.0008, i.e. 1 in 1251
            if (v >= 9e15) {
              b = crypto.getRandomValues(new Uint32Array(2));
              a[i] = b[0];
              a[i + 1] = b[1];
            } else {

              // 0 <= v <= 8999999999999999
              // 0 <= (v % 1e14) <= 99999999999999
              c.push(v % 1e14);
              i += 2;
            }
          }
          i = k / 2;

        // Node.js supporting crypto.randomBytes.
        } else if (crypto.randomBytes) {

          // buffer
          a = crypto.randomBytes(k *= 7);

          for (; i < k;) {

            // 0x1000000000000 is 2^48, 0x10000000000 is 2^40
            // 0x100000000 is 2^32, 0x1000000 is 2^24
            // 11111 11111111 11111111 11111111 11111111 11111111 11111111
            // 0 <= v < 9007199254740992
            v = ((a[i] & 31) * 0x1000000000000) + (a[i + 1] * 0x10000000000) +
               (a[i + 2] * 0x100000000) + (a[i + 3] * 0x1000000) +
               (a[i + 4] << 16) + (a[i + 5] << 8) + a[i + 6];

            if (v >= 9e15) {
              crypto.randomBytes(7).copy(a, i);
            } else {

              // 0 <= (v % 1e14) <= 99999999999999
              c.push(v % 1e14);
              i += 7;
            }
          }
          i = k / 7;
        } else {
          CRYPTO = false;
          throw Error
           (bignumberError + 'crypto unavailable');
        }
      }

      // Use Math.random.
      if (!CRYPTO) {

        for (; i < k;) {
          v = random53bitInt();
          if (v < 9e15) c[i++] = v % 1e14;
        }
      }

      k = c[--i];
      dp %= LOG_BASE;

      // Convert trailing digits to zeros according to dp.
      if (k && dp) {
        v = POWS_TEN[LOG_BASE - dp];
        c[i] = mathfloor(k / v) * v;
      }

      // Remove trailing elements which are zero.
      for (; c[i] === 0; c.pop(), i--);

      // Zero?
      if (i < 0) {
        c = [e = 0];
      } else {

        // Remove leading elements which are zero and adjust exponent accordingly.
        for (e = -1 ; c[0] === 0; c.splice(0, 1), e -= LOG_BASE);

        // Count the digits of the first element of c to determine leading zeros, and...
        for (i = 1, v = c[0]; v >= 10; v /= 10, i++);

        // adjust the exponent accordingly.
        if (i < LOG_BASE) e -= LOG_BASE - i;
      }

      rand.e = e;
      rand.c = c;
      return rand;
    };
  })();


   /*
   * Return a BigNumber whose value is the sum of the arguments.
   *
   * arguments {number|string|BigNumber}
   */
  BigNumber.sum = function () {
    var i = 1,
      args = arguments,
      sum = new BigNumber(args[0]);
    for (; i < args.length;) sum = sum.plus(args[i++]);
    return sum;
  };


  // PRIVATE FUNCTIONS


  // Called by BigNumber and BigNumber.prototype.toString.
  convertBase = (function () {
    var decimal = '0123456789';

    /*
     * Convert string of baseIn to an array of numbers of baseOut.
     * Eg. toBaseOut('255', 10, 16) returns [15, 15].
     * Eg. toBaseOut('ff', 16, 10) returns [2, 5, 5].
     */
    function toBaseOut(str, baseIn, baseOut, alphabet) {
      var j,
        arr = [0],
        arrL,
        i = 0,
        len = str.length;

      for (; i < len;) {
        for (arrL = arr.length; arrL--; arr[arrL] *= baseIn);

        arr[0] += alphabet.indexOf(str.charAt(i++));

        for (j = 0; j < arr.length; j++) {

          if (arr[j] > baseOut - 1) {
            if (arr[j + 1] == null) arr[j + 1] = 0;
            arr[j + 1] += arr[j] / baseOut | 0;
            arr[j] %= baseOut;
          }
        }
      }

      return arr.reverse();
    }

    // Convert a numeric string of baseIn to a numeric string of baseOut.
    // If the caller is toString, we are converting from base 10 to baseOut.
    // If the caller is BigNumber, we are converting from baseIn to base 10.
    return function (str, baseIn, baseOut, sign, callerIsToString) {
      var alphabet, d, e, k, r, x, xc, y,
        i = str.indexOf('.'),
        dp = DECIMAL_PLACES,
        rm = ROUNDING_MODE;

      // Non-integer.
      if (i >= 0) {
        k = POW_PRECISION;

        // Unlimited precision.
        POW_PRECISION = 0;
        str = str.replace('.', '');
        y = new BigNumber(baseIn);
        x = y.pow(str.length - i);
        POW_PRECISION = k;

        // Convert str as if an integer, then restore the fraction part by dividing the
        // result by its base raised to a power.

        y.c = toBaseOut(toFixedPoint(coeffToString(x.c), x.e, '0'),
         10, baseOut, decimal);
        y.e = y.c.length;
      }

      // Convert the number as integer.

      xc = toBaseOut(str, baseIn, baseOut, callerIsToString
       ? (alphabet = ALPHABET, decimal)
       : (alphabet = decimal, ALPHABET));

      // xc now represents str as an integer and converted to baseOut. e is the exponent.
      e = k = xc.length;

      // Remove trailing zeros.
      for (; xc[--k] == 0; xc.pop());

      // Zero?
      if (!xc[0]) return alphabet.charAt(0);

      // Does str represent an integer? If so, no need for the division.
      if (i < 0) {
        --e;
      } else {
        x.c = xc;
        x.e = e;

        // The sign is needed for correct rounding.
        x.s = sign;
        x = div(x, y, dp, rm, baseOut);
        xc = x.c;
        r = x.r;
        e = x.e;
      }

      // xc now represents str converted to baseOut.

      // THe index of the rounding digit.
      d = e + dp + 1;

      // The rounding digit: the digit to the right of the digit that may be rounded up.
      i = xc[d];

      // Look at the rounding digits and mode to determine whether to round up.

      k = baseOut / 2;
      r = r || d < 0 || xc[d + 1] != null;

      r = rm < 4 ? (i != null || r) && (rm == 0 || rm == (x.s < 0 ? 3 : 2))
            : i > k || i == k &&(rm == 4 || r || rm == 6 && xc[d - 1] & 1 ||
             rm == (x.s < 0 ? 8 : 7));

      // If the index of the rounding digit is not greater than zero, or xc represents
      // zero, then the result of the base conversion is zero or, if rounding up, a value
      // such as 0.00001.
      if (d < 1 || !xc[0]) {

        // 1^-dp or 0
        str = r ? toFixedPoint(alphabet.charAt(1), -dp, alphabet.charAt(0)) : alphabet.charAt(0);
      } else {

        // Truncate xc to the required number of decimal places.
        xc.length = d;

        // Round up?
        if (r) {

          // Rounding up may mean the previous digit has to be rounded up and so on.
          for (--baseOut; ++xc[--d] > baseOut;) {
            xc[d] = 0;

            if (!d) {
              ++e;
              xc = [1].concat(xc);
            }
          }
        }

        // Determine trailing zeros.
        for (k = xc.length; !xc[--k];);

        // E.g. [4, 11, 15] becomes 4bf.
        for (i = 0, str = ''; i <= k; str += alphabet.charAt(xc[i++]));

        // Add leading zeros, decimal point and trailing zeros as required.
        str = toFixedPoint(str, e, alphabet.charAt(0));
      }

      // The caller will add the sign.
      return str;
    };
  })();


  // Perform division in the specified base. Called by div and convertBase.
  div = (function () {

    // Assume non-zero x and k.
    function multiply(x, k, base) {
      var m, temp, xlo, xhi,
        carry = 0,
        i = x.length,
        klo = k % SQRT_BASE,
        khi = k / SQRT_BASE | 0;

      for (x = x.slice(); i--;) {
        xlo = x[i] % SQRT_BASE;
        xhi = x[i] / SQRT_BASE | 0;
        m = khi * xlo + xhi * klo;
        temp = klo * xlo + ((m % SQRT_BASE) * SQRT_BASE) + carry;
        carry = (temp / base | 0) + (m / SQRT_BASE | 0) + khi * xhi;
        x[i] = temp % base;
      }

      if (carry) x = [carry].concat(x);

      return x;
    }

    function compare(a, b, aL, bL) {
      var i, cmp;

      if (aL != bL) {
        cmp = aL > bL ? 1 : -1;
      } else {

        for (i = cmp = 0; i < aL; i++) {

          if (a[i] != b[i]) {
            cmp = a[i] > b[i] ? 1 : -1;
            break;
          }
        }
      }

      return cmp;
    }

    function subtract(a, b, aL, base) {
      var i = 0;

      // Subtract b from a.
      for (; aL--;) {
        a[aL] -= i;
        i = a[aL] < b[aL] ? 1 : 0;
        a[aL] = i * base + a[aL] - b[aL];
      }

      // Remove leading zeros.
      for (; !a[0] && a.length > 1; a.splice(0, 1));
    }

    // x: dividend, y: divisor.
    return function (x, y, dp, rm, base) {
      var cmp, e, i, more, n, prod, prodL, q, qc, rem, remL, rem0, xi, xL, yc0,
        yL, yz,
        s = x.s == y.s ? 1 : -1,
        xc = x.c,
        yc = y.c;

      // Either NaN, Infinity or 0?
      if (!xc || !xc[0] || !yc || !yc[0]) {

        return new BigNumber(

         // Return NaN if either NaN, or both Infinity or 0.
         !x.s || !y.s || (xc ? yc && xc[0] == yc[0] : !yc) ? NaN :

          // Return ±0 if x is ±0 or y is ±Infinity, or return ±Infinity as y is ±0.
          xc && xc[0] == 0 || !yc ? s * 0 : s / 0
       );
      }

      q = new BigNumber(s);
      qc = q.c = [];
      e = x.e - y.e;
      s = dp + e + 1;

      if (!base) {
        base = BASE;
        e = bitFloor(x.e / LOG_BASE) - bitFloor(y.e / LOG_BASE);
        s = s / LOG_BASE | 0;
      }

      // Result exponent may be one less then the current value of e.
      // The coefficients of the BigNumbers from convertBase may have trailing zeros.
      for (i = 0; yc[i] == (xc[i] || 0); i++);

      if (yc[i] > (xc[i] || 0)) e--;

      if (s < 0) {
        qc.push(1);
        more = true;
      } else {
        xL = xc.length;
        yL = yc.length;
        i = 0;
        s += 2;

        // Normalise xc and yc so highest order digit of yc is >= base / 2.

        n = mathfloor(base / (yc[0] + 1));

        // Not necessary, but to handle odd bases where yc[0] == (base / 2) - 1.
        // if (n > 1 || n++ == 1 && yc[0] < base / 2) {
        if (n > 1) {
          yc = multiply(yc, n, base);
          xc = multiply(xc, n, base);
          yL = yc.length;
          xL = xc.length;
        }

        xi = yL;
        rem = xc.slice(0, yL);
        remL = rem.length;

        // Add zeros to make remainder as long as divisor.
        for (; remL < yL; rem[remL++] = 0);
        yz = yc.slice();
        yz = [0].concat(yz);
        yc0 = yc[0];
        if (yc[1] >= base / 2) yc0++;
        // Not necessary, but to prevent trial digit n > base, when using base 3.
        // else if (base == 3 && yc0 == 1) yc0 = 1 + 1e-15;

        do {
          n = 0;

          // Compare divisor and remainder.
          cmp = compare(yc, rem, yL, remL);

          // If divisor < remainder.
          if (cmp < 0) {

            // Calculate trial digit, n.

            rem0 = rem[0];
            if (yL != remL) rem0 = rem0 * base + (rem[1] || 0);

            // n is how many times the divisor goes into the current remainder.
            n = mathfloor(rem0 / yc0);

            //  Algorithm:
            //  product = divisor multiplied by trial digit (n).
            //  Compare product and remainder.
            //  If product is greater than remainder:
            //    Subtract divisor from product, decrement trial digit.
            //  Subtract product from remainder.
            //  If product was less than remainder at the last compare:
            //    Compare new remainder and divisor.
            //    If remainder is greater than divisor:
            //      Subtract divisor from remainder, increment trial digit.

            if (n > 1) {

              // n may be > base only when base is 3.
              if (n >= base) n = base - 1;

              // product = divisor * trial digit.
              prod = multiply(yc, n, base);
              prodL = prod.length;
              remL = rem.length;

              // Compare product and remainder.
              // If product > remainder then trial digit n too high.
              // n is 1 too high about 5% of the time, and is not known to have
              // ever been more than 1 too high.
              while (compare(prod, rem, prodL, remL) == 1) {
                n--;

                // Subtract divisor from product.
                subtract(prod, yL < prodL ? yz : yc, prodL, base);
                prodL = prod.length;
                cmp = 1;
              }
            } else {

              // n is 0 or 1, cmp is -1.
              // If n is 0, there is no need to compare yc and rem again below,
              // so change cmp to 1 to avoid it.
              // If n is 1, leave cmp as -1, so yc and rem are compared again.
              if (n == 0) {

                // divisor < remainder, so n must be at least 1.
                cmp = n = 1;
              }

              // product = divisor
              prod = yc.slice();
              prodL = prod.length;
            }

            if (prodL < remL) prod = [0].concat(prod);

            // Subtract product from remainder.
            subtract(rem, prod, remL, base);
            remL = rem.length;

             // If product was < remainder.
            if (cmp == -1) {

              // Compare divisor and new remainder.
              // If divisor < new remainder, subtract divisor from remainder.
              // Trial digit n too low.
              // n is 1 too low about 5% of the time, and very rarely 2 too low.
              while (compare(yc, rem, yL, remL) < 1) {
                n++;

                // Subtract divisor from remainder.
                subtract(rem, yL < remL ? yz : yc, remL, base);
                remL = rem.length;
              }
            }
          } else if (cmp === 0) {
            n++;
            rem = [0];
          } // else cmp === 1 and n will be 0

          // Add the next digit, n, to the result array.
          qc[i++] = n;

          // Update the remainder.
          if (rem[0]) {
            rem[remL++] = xc[xi] || 0;
          } else {
            rem = [xc[xi]];
            remL = 1;
          }
        } while ((xi++ < xL || rem[0] != null) && s--);

        more = rem[0] != null;

        // Leading zero?
        if (!qc[0]) qc.splice(0, 1);
      }

      if (base == BASE) {

        // To calculate q.e, first get the number of digits of qc[0].
        for (i = 1, s = qc[0]; s >= 10; s /= 10, i++);

        round(q, dp + (q.e = i + e * LOG_BASE - 1) + 1, rm, more);

      // Caller is convertBase.
      } else {
        q.e = e;
        q.r = +more;
      }

      return q;
    };
  })();


  /*
   * Return a string representing the value of BigNumber n in fixed-point or exponential
   * notation rounded to the specified decimal places or significant digits.
   *
   * n: a BigNumber.
   * i: the index of the last digit required (i.e. the digit that may be rounded up).
   * rm: the rounding mode.
   * id: 1 (toExponential) or 2 (toPrecision).
   */
  function format(n, i, rm, id) {
    var c0, e, ne, len, str;

    if (rm == null) rm = ROUNDING_MODE;
    else intCheck(rm, 0, 8);

    if (!n.c) return n.toString();

    c0 = n.c[0];
    ne = n.e;

    if (i == null) {
      str = coeffToString(n.c);
      str = id == 1 || id == 2 && (ne <= TO_EXP_NEG || ne >= TO_EXP_POS)
       ? toExponential(str, ne)
       : toFixedPoint(str, ne, '0');
    } else {
      n = round(new BigNumber(n), i, rm);

      // n.e may have changed if the value was rounded up.
      e = n.e;

      str = coeffToString(n.c);
      len = str.length;

      // toPrecision returns exponential notation if the number of significant digits
      // specified is less than the number of digits necessary to represent the integer
      // part of the value in fixed-point notation.

      // Exponential notation.
      if (id == 1 || id == 2 && (i <= e || e <= TO_EXP_NEG)) {

        // Append zeros?
        for (; len < i; str += '0', len++);
        str = toExponential(str, e);

      // Fixed-point notation.
      } else {
        i -= ne;
        str = toFixedPoint(str, e, '0');

        // Append zeros?
        if (e + 1 > len) {
          if (--i > 0) for (str += '.'; i--; str += '0');
        } else {
          i += e - len;
          if (i > 0) {
            if (e + 1 == len) str += '.';
            for (; i--; str += '0');
          }
        }
      }
    }

    return n.s < 0 && c0 ? '-' + str : str;
  }


  // Handle BigNumber.max and BigNumber.min.
  // If any number is NaN, return NaN.
  function maxOrMin(args, n) {
    var k, y,
      i = 1,
      x = new BigNumber(args[0]);

    for (; i < args.length; i++) {
      y = new BigNumber(args[i]);
      if (!y.s || (k = compare(x, y)) === n || k === 0 && x.s === n) {
        x = y;
      }
    }

    return x;
  }


  /*
   * Strip trailing zeros, calculate base 10 exponent and check against MIN_EXP and MAX_EXP.
   * Called by minus, plus and times.
   */
  function normalise(n, c, e) {
    var i = 1,
      j = c.length;

     // Remove trailing zeros.
    for (; !c[--j]; c.pop());

    // Calculate the base 10 exponent. First get the number of digits of c[0].
    for (j = c[0]; j >= 10; j /= 10, i++);

    // Overflow?
    if ((e = i + e * LOG_BASE - 1) > MAX_EXP) {

      // Infinity.
      n.c = n.e = null;

    // Underflow?
    } else if (e < MIN_EXP) {

      // Zero.
      n.c = [n.e = 0];
    } else {
      n.e = e;
      n.c = c;
    }

    return n;
  }


  // Handle values that fail the validity test in BigNumber.
  parseNumeric = (function () {
    var basePrefix = /^(-?)0([xbo])(?=\w[\w.]*$)/i,
      dotAfter = /^([^.]+)\.$/,
      dotBefore = /^\.([^.]+)$/,
      isInfinityOrNaN = /^-?(Infinity|NaN)$/,
      whitespaceOrPlus = /^\s*\+(?=[\w.])|^\s+|\s+$/g;

    return function (x, str, isNum, b) {
      var base,
        s = isNum ? str : str.replace(whitespaceOrPlus, '');

      // No exception on ±Infinity or NaN.
      if (isInfinityOrNaN.test(s)) {
        x.s = isNaN(s) ? null : s < 0 ? -1 : 1;
      } else {
        if (!isNum) {

          // basePrefix = /^(-?)0([xbo])(?=\w[\w.]*$)/i
          s = s.replace(basePrefix, function (m, p1, p2) {
            base = (p2 = p2.toLowerCase()) == 'x' ? 16 : p2 == 'b' ? 2 : 8;
            return !b || b == base ? p1 : m;
          });

          if (b) {
            base = b;

            // E.g. '1.' to '1', '.1' to '0.1'
            s = s.replace(dotAfter, '$1').replace(dotBefore, '0.$1');
          }

          if (str != s) return new BigNumber(s, base);
        }

        // '[BigNumber Error] Not a number: {n}'
        // '[BigNumber Error] Not a base {b} number: {n}'
        if (BigNumber.DEBUG) {
          throw Error
            (bignumberError + 'Not a' + (b ? ' base ' + b : '') + ' number: ' + str);
        }

        // NaN
        x.s = null;
      }

      x.c = x.e = null;
    }
  })();


  /*
   * Round x to sd significant digits using rounding mode rm. Check for over/under-flow.
   * If r is truthy, it is known that there are more digits after the rounding digit.
   */
  function round(x, sd, rm, r) {
    var d, i, j, k, n, ni, rd,
      xc = x.c,
      pows10 = POWS_TEN;

    // if x is not Infinity or NaN...
    if (xc) {

      // rd is the rounding digit, i.e. the digit after the digit that may be rounded up.
      // n is a base 1e14 number, the value of the element of array x.c containing rd.
      // ni is the index of n within x.c.
      // d is the number of digits of n.
      // i is the index of rd within n including leading zeros.
      // j is the actual index of rd within n (if < 0, rd is a leading zero).
      out: {

        // Get the number of digits of the first element of xc.
        for (d = 1, k = xc[0]; k >= 10; k /= 10, d++);
        i = sd - d;

        // If the rounding digit is in the first element of xc...
        if (i < 0) {
          i += LOG_BASE;
          j = sd;
          n = xc[ni = 0];

          // Get the rounding digit at index j of n.
          rd = mathfloor(n / pows10[d - j - 1] % 10);
        } else {
          ni = mathceil((i + 1) / LOG_BASE);

          if (ni >= xc.length) {

            if (r) {

              // Needed by sqrt.
              for (; xc.length <= ni; xc.push(0));
              n = rd = 0;
              d = 1;
              i %= LOG_BASE;
              j = i - LOG_BASE + 1;
            } else {
              break out;
            }
          } else {
            n = k = xc[ni];

            // Get the number of digits of n.
            for (d = 1; k >= 10; k /= 10, d++);

            // Get the index of rd within n.
            i %= LOG_BASE;

            // Get the index of rd within n, adjusted for leading zeros.
            // The number of leading zeros of n is given by LOG_BASE - d.
            j = i - LOG_BASE + d;

            // Get the rounding digit at index j of n.
            rd = j < 0 ? 0 : mathfloor(n / pows10[d - j - 1] % 10);
          }
        }

        r = r || sd < 0 ||

        // Are there any non-zero digits after the rounding digit?
        // The expression  n % pows10[d - j - 1]  returns all digits of n to the right
        // of the digit at j, e.g. if n is 908714 and j is 2, the expression gives 714.
         xc[ni + 1] != null || (j < 0 ? n : n % pows10[d - j - 1]);

        r = rm < 4
         ? (rd || r) && (rm == 0 || rm == (x.s < 0 ? 3 : 2))
         : rd > 5 || rd == 5 && (rm == 4 || r || rm == 6 &&

          // Check whether the digit to the left of the rounding digit is odd.
          ((i > 0 ? j > 0 ? n / pows10[d - j] : 0 : xc[ni - 1]) % 10) & 1 ||
           rm == (x.s < 0 ? 8 : 7));

        if (sd < 1 || !xc[0]) {
          xc.length = 0;

          if (r) {

            // Convert sd to decimal places.
            sd -= x.e + 1;

            // 1, 0.1, 0.01, 0.001, 0.0001 etc.
            xc[0] = pows10[(LOG_BASE - sd % LOG_BASE) % LOG_BASE];
            x.e = -sd || 0;
          } else {

            // Zero.
            xc[0] = x.e = 0;
          }

          return x;
        }

        // Remove excess digits.
        if (i == 0) {
          xc.length = ni;
          k = 1;
          ni--;
        } else {
          xc.length = ni + 1;
          k = pows10[LOG_BASE - i];

          // E.g. 56700 becomes 56000 if 7 is the rounding digit.
          // j > 0 means i > number of leading zeros of n.
          xc[ni] = j > 0 ? mathfloor(n / pows10[d - j] % pows10[j]) * k : 0;
        }

        // Round up?
        if (r) {

          for (; ;) {

            // If the digit to be rounded up is in the first element of xc...
            if (ni == 0) {

              // i will be the length of xc[0] before k is added.
              for (i = 1, j = xc[0]; j >= 10; j /= 10, i++);
              j = xc[0] += k;
              for (k = 1; j >= 10; j /= 10, k++);

              // if i != k the length has increased.
              if (i != k) {
                x.e++;
                if (xc[0] == BASE) xc[0] = 1;
              }

              break;
            } else {
              xc[ni] += k;
              if (xc[ni] != BASE) break;
              xc[ni--] = 0;
              k = 1;
            }
          }
        }

        // Remove trailing zeros.
        for (i = xc.length; xc[--i] === 0; xc.pop());
      }

      // Overflow? Infinity.
      if (x.e > MAX_EXP) {
        x.c = x.e = null;

      // Underflow? Zero.
      } else if (x.e < MIN_EXP) {
        x.c = [x.e = 0];
      }
    }

    return x;
  }


  function valueOf(n) {
    var str,
      e = n.e;

    if (e === null) return n.toString();

    str = coeffToString(n.c);

    str = e <= TO_EXP_NEG || e >= TO_EXP_POS
      ? toExponential(str, e)
      : toFixedPoint(str, e, '0');

    return n.s < 0 ? '-' + str : str;
  }


  // PROTOTYPE/INSTANCE METHODS


  /*
   * Return a new BigNumber whose value is the absolute value of this BigNumber.
   */
  P.absoluteValue = P.abs = function () {
    var x = new BigNumber(this);
    if (x.s < 0) x.s = 1;
    return x;
  };


  /*
   * Return
   *   1 if the value of this BigNumber is greater than the value of BigNumber(y, b),
   *   -1 if the value of this BigNumber is less than the value of BigNumber(y, b),
   *   0 if they have the same value,
   *   or null if the value of either is NaN.
   */
  P.comparedTo = function (y, b) {
    return compare(this, new BigNumber(y, b));
  };


  /*
   * If dp is undefined or null or true or false, return the number of decimal places of the
   * value of this BigNumber, or null if the value of this BigNumber is ±Infinity or NaN.
   *
   * Otherwise, if dp is a number, return a new BigNumber whose value is the value of this
   * BigNumber rounded to a maximum of dp decimal places using rounding mode rm, or
   * ROUNDING_MODE if rm is omitted.
   *
   * [dp] {number} Decimal places: integer, 0 to MAX inclusive.
   * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
   *
   * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {dp|rm}'
   */
  P.decimalPlaces = P.dp = function (dp, rm) {
    var c, n, v,
      x = this;

    if (dp != null) {
      intCheck(dp, 0, MAX);
      if (rm == null) rm = ROUNDING_MODE;
      else intCheck(rm, 0, 8);

      return round(new BigNumber(x), dp + x.e + 1, rm);
    }

    if (!(c = x.c)) return null;
    n = ((v = c.length - 1) - bitFloor(this.e / LOG_BASE)) * LOG_BASE;

    // Subtract the number of trailing zeros of the last number.
    if (v = c[v]) for (; v % 10 == 0; v /= 10, n--);
    if (n < 0) n = 0;

    return n;
  };


  /*
   *  n / 0 = I
   *  n / N = N
   *  n / I = 0
   *  0 / n = 0
   *  0 / 0 = N
   *  0 / N = N
   *  0 / I = 0
   *  N / n = N
   *  N / 0 = N
   *  N / N = N
   *  N / I = N
   *  I / n = I
   *  I / 0 = I
   *  I / N = N
   *  I / I = N
   *
   * Return a new BigNumber whose value is the value of this BigNumber divided by the value of
   * BigNumber(y, b), rounded according to DECIMAL_PLACES and ROUNDING_MODE.
   */
  P.dividedBy = P.div = function (y, b) {
    return div(this, new BigNumber(y, b), DECIMAL_PLACES, ROUNDING_MODE);
  };


  /*
   * Return a new BigNumber whose value is the integer part of dividing the value of this
   * BigNumber by the value of BigNumber(y, b).
   */
  P.dividedToIntegerBy = P.idiv = function (y, b) {
    return div(this, new BigNumber(y, b), 0, 1);
  };


  /*
   * Return a BigNumber whose value is the value of this BigNumber exponentiated by n.
   *
   * If m is present, return the result modulo m.
   * If n is negative round according to DECIMAL_PLACES and ROUNDING_MODE.
   * If POW_PRECISION is non-zero and m is not present, round to POW_PRECISION using ROUNDING_MODE.
   *
   * The modular power operation works efficiently when x, n, and m are integers, otherwise it
   * is equivalent to calculating x.exponentiatedBy(n).modulo(m) with a POW_PRECISION of 0.
   *
   * n {number|string|BigNumber} The exponent. An integer.
   * [m] {number|string|BigNumber} The modulus.
   *
   * '[BigNumber Error] Exponent not an integer: {n}'
   */
  P.exponentiatedBy = P.pow = function (n, m) {
    var half, isModExp, i, k, more, nIsBig, nIsNeg, nIsOdd, y,
      x = this;

    n = new BigNumber(n);

    // Allow NaN and ±Infinity, but not other non-integers.
    if (n.c && !n.isInteger()) {
      throw Error
        (bignumberError + 'Exponent not an integer: ' + valueOf(n));
    }

    if (m != null) m = new BigNumber(m);

    // Exponent of MAX_SAFE_INTEGER is 15.
    nIsBig = n.e > 14;

    // If x is NaN, ±Infinity, ±0 or ±1, or n is ±Infinity, NaN or ±0.
    if (!x.c || !x.c[0] || x.c[0] == 1 && !x.e && x.c.length == 1 || !n.c || !n.c[0]) {

      // The sign of the result of pow when x is negative depends on the evenness of n.
      // If +n overflows to ±Infinity, the evenness of n would be not be known.
      y = new BigNumber(Math.pow(+valueOf(x), nIsBig ? n.s * (2 - isOdd(n)) : +valueOf(n)));
      return m ? y.mod(m) : y;
    }

    nIsNeg = n.s < 0;

    if (m) {

      // x % m returns NaN if abs(m) is zero, or m is NaN.
      if (m.c ? !m.c[0] : !m.s) return new BigNumber(NaN);

      isModExp = !nIsNeg && x.isInteger() && m.isInteger();

      if (isModExp) x = x.mod(m);

    // Overflow to ±Infinity: >=2**1e10 or >=1.0000024**1e15.
    // Underflow to ±0: <=0.79**1e10 or <=0.9999975**1e15.
    } else if (n.e > 9 && (x.e > 0 || x.e < -1 || (x.e == 0
      // [1, 240000000]
      ? x.c[0] > 1 || nIsBig && x.c[1] >= 24e7
      // [80000000000000]  [99999750000000]
      : x.c[0] < 8e13 || nIsBig && x.c[0] <= 9999975e7))) {

      // If x is negative and n is odd, k = -0, else k = 0.
      k = x.s < 0 && isOdd(n) ? -0 : 0;

      // If x >= 1, k = ±Infinity.
      if (x.e > -1) k = 1 / k;

      // If n is negative return ±0, else return ±Infinity.
      return new BigNumber(nIsNeg ? 1 / k : k);

    } else if (POW_PRECISION) {

      // Truncating each coefficient array to a length of k after each multiplication
      // equates to truncating significant digits to POW_PRECISION + [28, 41],
      // i.e. there will be a minimum of 28 guard digits retained.
      k = mathceil(POW_PRECISION / LOG_BASE + 2);
    }

    if (nIsBig) {
      half = new BigNumber(0.5);
      if (nIsNeg) n.s = 1;
      nIsOdd = isOdd(n);
    } else {
      i = Math.abs(+valueOf(n));
      nIsOdd = i % 2;
    }

    y = new BigNumber(ONE);

    // Performs 54 loop iterations for n of 9007199254740991.
    for (; ;) {

      if (nIsOdd) {
        y = y.times(x);
        if (!y.c) break;

        if (k) {
          if (y.c.length > k) y.c.length = k;
        } else if (isModExp) {
          y = y.mod(m);    //y = y.minus(div(y, m, 0, MODULO_MODE).times(m));
        }
      }

      if (i) {
        i = mathfloor(i / 2);
        if (i === 0) break;
        nIsOdd = i % 2;
      } else {
        n = n.times(half);
        round(n, n.e + 1, 1);

        if (n.e > 14) {
          nIsOdd = isOdd(n);
        } else {
          i = +valueOf(n);
          if (i === 0) break;
          nIsOdd = i % 2;
        }
      }

      x = x.times(x);

      if (k) {
        if (x.c && x.c.length > k) x.c.length = k;
      } else if (isModExp) {
        x = x.mod(m);    //x = x.minus(div(x, m, 0, MODULO_MODE).times(m));
      }
    }

    if (isModExp) return y;
    if (nIsNeg) y = ONE.div(y);

    return m ? y.mod(m) : k ? round(y, POW_PRECISION, ROUNDING_MODE, more) : y;
  };


  /*
   * Return a new BigNumber whose value is the value of this BigNumber rounded to an integer
   * using rounding mode rm, or ROUNDING_MODE if rm is omitted.
   *
   * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
   *
   * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {rm}'
   */
  P.integerValue = function (rm) {
    var n = new BigNumber(this);
    if (rm == null) rm = ROUNDING_MODE;
    else intCheck(rm, 0, 8);
    return round(n, n.e + 1, rm);
  };


  /*
   * Return true if the value of this BigNumber is equal to the value of BigNumber(y, b),
   * otherwise return false.
   */
  P.isEqualTo = P.eq = function (y, b) {
    return compare(this, new BigNumber(y, b)) === 0;
  };


  /*
   * Return true if the value of this BigNumber is a finite number, otherwise return false.
   */
  P.isFinite = function () {
    return !!this.c;
  };


  /*
   * Return true if the value of this BigNumber is greater than the value of BigNumber(y, b),
   * otherwise return false.
   */
  P.isGreaterThan = P.gt = function (y, b) {
    return compare(this, new BigNumber(y, b)) > 0;
  };


  /*
   * Return true if the value of this BigNumber is greater than or equal to the value of
   * BigNumber(y, b), otherwise return false.
   */
  P.isGreaterThanOrEqualTo = P.gte = function (y, b) {
    return (b = compare(this, new BigNumber(y, b))) === 1 || b === 0;

  };


  /*
   * Return true if the value of this BigNumber is an integer, otherwise return false.
   */
  P.isInteger = function () {
    return !!this.c && bitFloor(this.e / LOG_BASE) > this.c.length - 2;
  };


  /*
   * Return true if the value of this BigNumber is less than the value of BigNumber(y, b),
   * otherwise return false.
   */
  P.isLessThan = P.lt = function (y, b) {
    return compare(this, new BigNumber(y, b)) < 0;
  };


  /*
   * Return true if the value of this BigNumber is less than or equal to the value of
   * BigNumber(y, b), otherwise return false.
   */
  P.isLessThanOrEqualTo = P.lte = function (y, b) {
    return (b = compare(this, new BigNumber(y, b))) === -1 || b === 0;
  };


  /*
   * Return true if the value of this BigNumber is NaN, otherwise return false.
   */
  P.isNaN = function () {
    return !this.s;
  };


  /*
   * Return true if the value of this BigNumber is negative, otherwise return false.
   */
  P.isNegative = function () {
    return this.s < 0;
  };


  /*
   * Return true if the value of this BigNumber is positive, otherwise return false.
   */
  P.isPositive = function () {
    return this.s > 0;
  };


  /*
   * Return true if the value of this BigNumber is 0 or -0, otherwise return false.
   */
  P.isZero = function () {
    return !!this.c && this.c[0] == 0;
  };


  /*
   *  n - 0 = n
   *  n - N = N
   *  n - I = -I
   *  0 - n = -n
   *  0 - 0 = 0
   *  0 - N = N
   *  0 - I = -I
   *  N - n = N
   *  N - 0 = N
   *  N - N = N
   *  N - I = N
   *  I - n = I
   *  I - 0 = I
   *  I - N = N
   *  I - I = N
   *
   * Return a new BigNumber whose value is the value of this BigNumber minus the value of
   * BigNumber(y, b).
   */
  P.minus = function (y, b) {
    var i, j, t, xLTy,
      x = this,
      a = x.s;

    y = new BigNumber(y, b);
    b = y.s;

    // Either NaN?
    if (!a || !b) return new BigNumber(NaN);

    // Signs differ?
    if (a != b) {
      y.s = -b;
      return x.plus(y);
    }

    var xe = x.e / LOG_BASE,
      ye = y.e / LOG_BASE,
      xc = x.c,
      yc = y.c;

    if (!xe || !ye) {

      // Either Infinity?
      if (!xc || !yc) return xc ? (y.s = -b, y) : new BigNumber(yc ? x : NaN);

      // Either zero?
      if (!xc[0] || !yc[0]) {

        // Return y if y is non-zero, x if x is non-zero, or zero if both are zero.
        return yc[0] ? (y.s = -b, y) : new BigNumber(xc[0] ? x :

         // IEEE 754 (2008) 6.3: n - n = -0 when rounding to -Infinity
         ROUNDING_MODE == 3 ? -0 : 0);
      }
    }

    xe = bitFloor(xe);
    ye = bitFloor(ye);
    xc = xc.slice();

    // Determine which is the bigger number.
    if (a = xe - ye) {

      if (xLTy = a < 0) {
        a = -a;
        t = xc;
      } else {
        ye = xe;
        t = yc;
      }

      t.reverse();

      // Prepend zeros to equalise exponents.
      for (b = a; b--; t.push(0));
      t.reverse();
    } else {

      // Exponents equal. Check digit by digit.
      j = (xLTy = (a = xc.length) < (b = yc.length)) ? a : b;

      for (a = b = 0; b < j; b++) {

        if (xc[b] != yc[b]) {
          xLTy = xc[b] < yc[b];
          break;
        }
      }
    }

    // x < y? Point xc to the array of the bigger number.
    if (xLTy) {
      t = xc;
      xc = yc;
      yc = t;
      y.s = -y.s;
    }

    b = (j = yc.length) - (i = xc.length);

    // Append zeros to xc if shorter.
    // No need to add zeros to yc if shorter as subtract only needs to start at yc.length.
    if (b > 0) for (; b--; xc[i++] = 0);
    b = BASE - 1;

    // Subtract yc from xc.
    for (; j > a;) {

      if (xc[--j] < yc[j]) {
        for (i = j; i && !xc[--i]; xc[i] = b);
        --xc[i];
        xc[j] += BASE;
      }

      xc[j] -= yc[j];
    }

    // Remove leading zeros and adjust exponent accordingly.
    for (; xc[0] == 0; xc.splice(0, 1), --ye);

    // Zero?
    if (!xc[0]) {

      // Following IEEE 754 (2008) 6.3,
      // n - n = +0  but  n - n = -0  when rounding towards -Infinity.
      y.s = ROUNDING_MODE == 3 ? -1 : 1;
      y.c = [y.e = 0];
      return y;
    }

    // No need to check for Infinity as +x - +y != Infinity && -x - -y != Infinity
    // for finite x and y.
    return normalise(y, xc, ye);
  };


  /*
   *   n % 0 =  N
   *   n % N =  N
   *   n % I =  n
   *   0 % n =  0
   *  -0 % n = -0
   *   0 % 0 =  N
   *   0 % N =  N
   *   0 % I =  0
   *   N % n =  N
   *   N % 0 =  N
   *   N % N =  N
   *   N % I =  N
   *   I % n =  N
   *   I % 0 =  N
   *   I % N =  N
   *   I % I =  N
   *
   * Return a new BigNumber whose value is the value of this BigNumber modulo the value of
   * BigNumber(y, b). The result depends on the value of MODULO_MODE.
   */
  P.modulo = P.mod = function (y, b) {
    var q, s,
      x = this;

    y = new BigNumber(y, b);

    // Return NaN if x is Infinity or NaN, or y is NaN or zero.
    if (!x.c || !y.s || y.c && !y.c[0]) {
      return new BigNumber(NaN);

    // Return x if y is Infinity or x is zero.
    } else if (!y.c || x.c && !x.c[0]) {
      return new BigNumber(x);
    }

    if (MODULO_MODE == 9) {

      // Euclidian division: q = sign(y) * floor(x / abs(y))
      // r = x - qy    where  0 <= r < abs(y)
      s = y.s;
      y.s = 1;
      q = div(x, y, 0, 3);
      y.s = s;
      q.s *= s;
    } else {
      q = div(x, y, 0, MODULO_MODE);
    }

    y = x.minus(q.times(y));

    // To match JavaScript %, ensure sign of zero is sign of dividend.
    if (!y.c[0] && MODULO_MODE == 1) y.s = x.s;

    return y;
  };


  /*
   *  n * 0 = 0
   *  n * N = N
   *  n * I = I
   *  0 * n = 0
   *  0 * 0 = 0
   *  0 * N = N
   *  0 * I = N
   *  N * n = N
   *  N * 0 = N
   *  N * N = N
   *  N * I = N
   *  I * n = I
   *  I * 0 = N
   *  I * N = N
   *  I * I = I
   *
   * Return a new BigNumber whose value is the value of this BigNumber multiplied by the value
   * of BigNumber(y, b).
   */
  P.multipliedBy = P.times = function (y, b) {
    var c, e, i, j, k, m, xcL, xlo, xhi, ycL, ylo, yhi, zc,
      base, sqrtBase,
      x = this,
      xc = x.c,
      yc = (y = new BigNumber(y, b)).c;

    // Either NaN, ±Infinity or ±0?
    if (!xc || !yc || !xc[0] || !yc[0]) {

      // Return NaN if either is NaN, or one is 0 and the other is Infinity.
      if (!x.s || !y.s || xc && !xc[0] && !yc || yc && !yc[0] && !xc) {
        y.c = y.e = y.s = null;
      } else {
        y.s *= x.s;

        // Return ±Infinity if either is ±Infinity.
        if (!xc || !yc) {
          y.c = y.e = null;

        // Return ±0 if either is ±0.
        } else {
          y.c = [0];
          y.e = 0;
        }
      }

      return y;
    }

    e = bitFloor(x.e / LOG_BASE) + bitFloor(y.e / LOG_BASE);
    y.s *= x.s;
    xcL = xc.length;
    ycL = yc.length;

    // Ensure xc points to longer array and xcL to its length.
    if (xcL < ycL) {
      zc = xc;
      xc = yc;
      yc = zc;
      i = xcL;
      xcL = ycL;
      ycL = i;
    }

    // Initialise the result array with zeros.
    for (i = xcL + ycL, zc = []; i--; zc.push(0));

    base = BASE;
    sqrtBase = SQRT_BASE;

    for (i = ycL; --i >= 0;) {
      c = 0;
      ylo = yc[i] % sqrtBase;
      yhi = yc[i] / sqrtBase | 0;

      for (k = xcL, j = i + k; j > i;) {
        xlo = xc[--k] % sqrtBase;
        xhi = xc[k] / sqrtBase | 0;
        m = yhi * xlo + xhi * ylo;
        xlo = ylo * xlo + ((m % sqrtBase) * sqrtBase) + zc[j] + c;
        c = (xlo / base | 0) + (m / sqrtBase | 0) + yhi * xhi;
        zc[j--] = xlo % base;
      }

      zc[j] = c;
    }

    if (c) {
      ++e;
    } else {
      zc.splice(0, 1);
    }

    return normalise(y, zc, e);
  };


  /*
   * Return a new BigNumber whose value is the value of this BigNumber negated,
   * i.e. multiplied by -1.
   */
  P.negated = function () {
    var x = new BigNumber(this);
    x.s = -x.s || null;
    return x;
  };


  /*
   *  n + 0 = n
   *  n + N = N
   *  n + I = I
   *  0 + n = n
   *  0 + 0 = 0
   *  0 + N = N
   *  0 + I = I
   *  N + n = N
   *  N + 0 = N
   *  N + N = N
   *  N + I = N
   *  I + n = I
   *  I + 0 = I
   *  I + N = N
   *  I + I = I
   *
   * Return a new BigNumber whose value is the value of this BigNumber plus the value of
   * BigNumber(y, b).
   */
  P.plus = function (y, b) {
    var t,
      x = this,
      a = x.s;

    y = new BigNumber(y, b);
    b = y.s;

    // Either NaN?
    if (!a || !b) return new BigNumber(NaN);

    // Signs differ?
     if (a != b) {
      y.s = -b;
      return x.minus(y);
    }

    var xe = x.e / LOG_BASE,
      ye = y.e / LOG_BASE,
      xc = x.c,
      yc = y.c;

    if (!xe || !ye) {

      // Return ±Infinity if either ±Infinity.
      if (!xc || !yc) return new BigNumber(a / 0);

      // Either zero?
      // Return y if y is non-zero, x if x is non-zero, or zero if both are zero.
      if (!xc[0] || !yc[0]) return yc[0] ? y : new BigNumber(xc[0] ? x : a * 0);
    }

    xe = bitFloor(xe);
    ye = bitFloor(ye);
    xc = xc.slice();

    // Prepend zeros to equalise exponents. Faster to use reverse then do unshifts.
    if (a = xe - ye) {
      if (a > 0) {
        ye = xe;
        t = yc;
      } else {
        a = -a;
        t = xc;
      }

      t.reverse();
      for (; a--; t.push(0));
      t.reverse();
    }

    a = xc.length;
    b = yc.length;

    // Point xc to the longer array, and b to the shorter length.
    if (a - b < 0) {
      t = yc;
      yc = xc;
      xc = t;
      b = a;
    }

    // Only start adding at yc.length - 1 as the further digits of xc can be ignored.
    for (a = 0; b;) {
      a = (xc[--b] = xc[b] + yc[b] + a) / BASE | 0;
      xc[b] = BASE === xc[b] ? 0 : xc[b] % BASE;
    }

    if (a) {
      xc = [a].concat(xc);
      ++ye;
    }

    // No need to check for zero, as +x + +y != 0 && -x + -y != 0
    // ye = MAX_EXP + 1 possible
    return normalise(y, xc, ye);
  };


  /*
   * If sd is undefined or null or true or false, return the number of significant digits of
   * the value of this BigNumber, or null if the value of this BigNumber is ±Infinity or NaN.
   * If sd is true include integer-part trailing zeros in the count.
   *
   * Otherwise, if sd is a number, return a new BigNumber whose value is the value of this
   * BigNumber rounded to a maximum of sd significant digits using rounding mode rm, or
   * ROUNDING_MODE if rm is omitted.
   *
   * sd {number|boolean} number: significant digits: integer, 1 to MAX inclusive.
   *                     boolean: whether to count integer-part trailing zeros: true or false.
   * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
   *
   * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {sd|rm}'
   */
  P.precision = P.sd = function (sd, rm) {
    var c, n, v,
      x = this;

    if (sd != null && sd !== !!sd) {
      intCheck(sd, 1, MAX);
      if (rm == null) rm = ROUNDING_MODE;
      else intCheck(rm, 0, 8);

      return round(new BigNumber(x), sd, rm);
    }

    if (!(c = x.c)) return null;
    v = c.length - 1;
    n = v * LOG_BASE + 1;

    if (v = c[v]) {

      // Subtract the number of trailing zeros of the last element.
      for (; v % 10 == 0; v /= 10, n--);

      // Add the number of digits of the first element.
      for (v = c[0]; v >= 10; v /= 10, n++);
    }

    if (sd && x.e + 1 > n) n = x.e + 1;

    return n;
  };


  /*
   * Return a new BigNumber whose value is the value of this BigNumber shifted by k places
   * (powers of 10). Shift to the right if n > 0, and to the left if n < 0.
   *
   * k {number} Integer, -MAX_SAFE_INTEGER to MAX_SAFE_INTEGER inclusive.
   *
   * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {k}'
   */
  P.shiftedBy = function (k) {
    intCheck(k, -MAX_SAFE_INTEGER, MAX_SAFE_INTEGER);
    return this.times('1e' + k);
  };


  /*
   *  sqrt(-n) =  N
   *  sqrt(N) =  N
   *  sqrt(-I) =  N
   *  sqrt(I) =  I
   *  sqrt(0) =  0
   *  sqrt(-0) = -0
   *
   * Return a new BigNumber whose value is the square root of the value of this BigNumber,
   * rounded according to DECIMAL_PLACES and ROUNDING_MODE.
   */
  P.squareRoot = P.sqrt = function () {
    var m, n, r, rep, t,
      x = this,
      c = x.c,
      s = x.s,
      e = x.e,
      dp = DECIMAL_PLACES + 4,
      half = new BigNumber('0.5');

    // Negative/NaN/Infinity/zero?
    if (s !== 1 || !c || !c[0]) {
      return new BigNumber(!s || s < 0 && (!c || c[0]) ? NaN : c ? x : 1 / 0);
    }

    // Initial estimate.
    s = Math.sqrt(+valueOf(x));

    // Math.sqrt underflow/overflow?
    // Pass x to Math.sqrt as integer, then adjust the exponent of the result.
    if (s == 0 || s == 1 / 0) {
      n = coeffToString(c);
      if ((n.length + e) % 2 == 0) n += '0';
      s = Math.sqrt(+n);
      e = bitFloor((e + 1) / 2) - (e < 0 || e % 2);

      if (s == 1 / 0) {
        n = '5e' + e;
      } else {
        n = s.toExponential();
        n = n.slice(0, n.indexOf('e') + 1) + e;
      }

      r = new BigNumber(n);
    } else {
      r = new BigNumber(s + '');
    }

    // Check for zero.
    // r could be zero if MIN_EXP is changed after the this value was created.
    // This would cause a division by zero (x/t) and hence Infinity below, which would cause
    // coeffToString to throw.
    if (r.c[0]) {
      e = r.e;
      s = e + dp;
      if (s < 3) s = 0;

      // Newton-Raphson iteration.
      for (; ;) {
        t = r;
        r = half.times(t.plus(div(x, t, dp, 1)));

        if (coeffToString(t.c).slice(0, s) === (n = coeffToString(r.c)).slice(0, s)) {

          // The exponent of r may here be one less than the final result exponent,
          // e.g 0.0009999 (e-4) --> 0.001 (e-3), so adjust s so the rounding digits
          // are indexed correctly.
          if (r.e < e) --s;
          n = n.slice(s - 3, s + 1);

          // The 4th rounding digit may be in error by -1 so if the 4 rounding digits
          // are 9999 or 4999 (i.e. approaching a rounding boundary) continue the
          // iteration.
          if (n == '9999' || !rep && n == '4999') {

            // On the first iteration only, check to see if rounding up gives the
            // exact result as the nines may infinitely repeat.
            if (!rep) {
              round(t, t.e + DECIMAL_PLACES + 2, 0);

              if (t.times(t).eq(x)) {
                r = t;
                break;
              }
            }

            dp += 4;
            s += 4;
            rep = 1;
          } else {

            // If rounding digits are null, 0{0,4} or 50{0,3}, check for exact
            // result. If not, then there are further digits and m will be truthy.
            if (!+n || !+n.slice(1) && n.charAt(0) == '5') {

              // Truncate to the first rounding digit.
              round(r, r.e + DECIMAL_PLACES + 2, 1);
              m = !r.times(r).eq(x);
            }

            break;
          }
        }
      }
    }

    return round(r, r.e + DECIMAL_PLACES + 1, ROUNDING_MODE, m);
  };


  /*
   * Return a string representing the value of this BigNumber in exponential notation and
   * rounded using ROUNDING_MODE to dp fixed decimal places.
   *
   * [dp] {number} Decimal places. Integer, 0 to MAX inclusive.
   * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
   *
   * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {dp|rm}'
   */
  P.toExponential = function (dp, rm) {
    if (dp != null) {
      intCheck(dp, 0, MAX);
      dp++;
    }
    return format(this, dp, rm, 1);
  };


  /*
   * Return a string representing the value of this BigNumber in fixed-point notation rounding
   * to dp fixed decimal places using rounding mode rm, or ROUNDING_MODE if rm is omitted.
   *
   * Note: as with JavaScript's number type, (-0).toFixed(0) is '0',
   * but e.g. (-0.00001).toFixed(0) is '-0'.
   *
   * [dp] {number} Decimal places. Integer, 0 to MAX inclusive.
   * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
   *
   * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {dp|rm}'
   */
  P.toFixed = function (dp, rm) {
    if (dp != null) {
      intCheck(dp, 0, MAX);
      dp = dp + this.e + 1;
    }
    return format(this, dp, rm);
  };


  /*
   * Return a string representing the value of this BigNumber in fixed-point notation rounded
   * using rm or ROUNDING_MODE to dp decimal places, and formatted according to the properties
   * of the format or FORMAT object (see BigNumber.set).
   *
   * The formatting object may contain some or all of the properties shown below.
   *
   * FORMAT = {
   *   prefix: '',
   *   groupSize: 3,
   *   secondaryGroupSize: 0,
   *   groupSeparator: ',',
   *   decimalSeparator: '.',
   *   fractionGroupSize: 0,
   *   fractionGroupSeparator: '\xA0',      // non-breaking space
   *   suffix: ''
   * };
   *
   * [dp] {number} Decimal places. Integer, 0 to MAX inclusive.
   * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
   * [format] {object} Formatting options. See FORMAT pbject above.
   *
   * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {dp|rm}'
   * '[BigNumber Error] Argument not an object: {format}'
   */
  P.toFormat = function (dp, rm, format) {
    var str,
      x = this;

    if (format == null) {
      if (dp != null && rm && typeof rm == 'object') {
        format = rm;
        rm = null;
      } else if (dp && typeof dp == 'object') {
        format = dp;
        dp = rm = null;
      } else {
        format = FORMAT;
      }
    } else if (typeof format != 'object') {
      throw Error
        (bignumberError + 'Argument not an object: ' + format);
    }

    str = x.toFixed(dp, rm);

    if (x.c) {
      var i,
        arr = str.split('.'),
        g1 = +format.groupSize,
        g2 = +format.secondaryGroupSize,
        groupSeparator = format.groupSeparator || '',
        intPart = arr[0],
        fractionPart = arr[1],
        isNeg = x.s < 0,
        intDigits = isNeg ? intPart.slice(1) : intPart,
        len = intDigits.length;

      if (g2) {
        i = g1;
        g1 = g2;
        g2 = i;
        len -= i;
      }

      if (g1 > 0 && len > 0) {
        i = len % g1 || g1;
        intPart = intDigits.substr(0, i);
        for (; i < len; i += g1) intPart += groupSeparator + intDigits.substr(i, g1);
        if (g2 > 0) intPart += groupSeparator + intDigits.slice(i);
        if (isNeg) intPart = '-' + intPart;
      }

      str = fractionPart
       ? intPart + (format.decimalSeparator || '') + ((g2 = +format.fractionGroupSize)
        ? fractionPart.replace(new RegExp('\\d{' + g2 + '}\\B', 'g'),
         '$&' + (format.fractionGroupSeparator || ''))
        : fractionPart)
       : intPart;
    }

    return (format.prefix || '') + str + (format.suffix || '');
  };


  /*
   * Return an array of two BigNumbers representing the value of this BigNumber as a simple
   * fraction with an integer numerator and an integer denominator.
   * The denominator will be a positive non-zero value less than or equal to the specified
   * maximum denominator. If a maximum denominator is not specified, the denominator will be
   * the lowest value necessary to represent the number exactly.
   *
   * [md] {number|string|BigNumber} Integer >= 1, or Infinity. The maximum denominator.
   *
   * '[BigNumber Error] Argument {not an integer|out of range} : {md}'
   */
  P.toFraction = function (md) {
    var d, d0, d1, d2, e, exp, n, n0, n1, q, r, s,
      x = this,
      xc = x.c;

    if (md != null) {
      n = new BigNumber(md);

      // Throw if md is less than one or is not an integer, unless it is Infinity.
      if (!n.isInteger() && (n.c || n.s !== 1) || n.lt(ONE)) {
        throw Error
          (bignumberError + 'Argument ' +
            (n.isInteger() ? 'out of range: ' : 'not an integer: ') + valueOf(n));
      }
    }

    if (!xc) return new BigNumber(x);

    d = new BigNumber(ONE);
    n1 = d0 = new BigNumber(ONE);
    d1 = n0 = new BigNumber(ONE);
    s = coeffToString(xc);

    // Determine initial denominator.
    // d is a power of 10 and the minimum max denominator that specifies the value exactly.
    e = d.e = s.length - x.e - 1;
    d.c[0] = POWS_TEN[(exp = e % LOG_BASE) < 0 ? LOG_BASE + exp : exp];
    md = !md || n.comparedTo(d) > 0 ? (e > 0 ? d : n1) : n;

    exp = MAX_EXP;
    MAX_EXP = 1 / 0;
    n = new BigNumber(s);

    // n0 = d1 = 0
    n0.c[0] = 0;

    for (; ;)  {
      q = div(n, d, 0, 1);
      d2 = d0.plus(q.times(d1));
      if (d2.comparedTo(md) == 1) break;
      d0 = d1;
      d1 = d2;
      n1 = n0.plus(q.times(d2 = n1));
      n0 = d2;
      d = n.minus(q.times(d2 = d));
      n = d2;
    }

    d2 = div(md.minus(d0), d1, 0, 1);
    n0 = n0.plus(d2.times(n1));
    d0 = d0.plus(d2.times(d1));
    n0.s = n1.s = x.s;
    e = e * 2;

    // Determine which fraction is closer to x, n0/d0 or n1/d1
    r = div(n1, d1, e, ROUNDING_MODE).minus(x).abs().comparedTo(
        div(n0, d0, e, ROUNDING_MODE).minus(x).abs()) < 1 ? [n1, d1] : [n0, d0];

    MAX_EXP = exp;

    return r;
  };


  /*
   * Return the value of this BigNumber converted to a number primitive.
   */
  P.toNumber = function () {
    return +valueOf(this);
  };


  /*
   * Return a string representing the value of this BigNumber rounded to sd significant digits
   * using rounding mode rm or ROUNDING_MODE. If sd is less than the number of digits
   * necessary to represent the integer part of the value in fixed-point notation, then use
   * exponential notation.
   *
   * [sd] {number} Significant digits. Integer, 1 to MAX inclusive.
   * [rm] {number} Rounding mode. Integer, 0 to 8 inclusive.
   *
   * '[BigNumber Error] Argument {not a primitive number|not an integer|out of range}: {sd|rm}'
   */
  P.toPrecision = function (sd, rm) {
    if (sd != null) intCheck(sd, 1, MAX);
    return format(this, sd, rm, 2);
  };


  /*
   * Return a string representing the value of this BigNumber in base b, or base 10 if b is
   * omitted. If a base is specified, including base 10, round according to DECIMAL_PLACES and
   * ROUNDING_MODE. If a base is not specified, and this BigNumber has a positive exponent
   * that is equal to or greater than TO_EXP_POS, or a negative exponent equal to or less than
   * TO_EXP_NEG, return exponential notation.
   *
   * [b] {number} Integer, 2 to ALPHABET.length inclusive.
   *
   * '[BigNumber Error] Base {not a primitive number|not an integer|out of range}: {b}'
   */
  P.toString = function (b) {
    var str,
      n = this,
      s = n.s,
      e = n.e;

    // Infinity or NaN?
    if (e === null) {
      if (s) {
        str = 'Infinity';
        if (s < 0) str = '-' + str;
      } else {
        str = 'NaN';
      }
    } else {
      if (b == null) {
        str = e <= TO_EXP_NEG || e >= TO_EXP_POS
         ? toExponential(coeffToString(n.c), e)
         : toFixedPoint(coeffToString(n.c), e, '0');
      } else if (b === 10 && alphabetHasNormalDecimalDigits) {
        n = round(new BigNumber(n), DECIMAL_PLACES + e + 1, ROUNDING_MODE);
        str = toFixedPoint(coeffToString(n.c), n.e, '0');
      } else {
        intCheck(b, 2, ALPHABET.length, 'Base');
        str = convertBase(toFixedPoint(coeffToString(n.c), e, '0'), 10, b, s, true);
      }

      if (s < 0 && n.c[0]) str = '-' + str;
    }

    return str;
  };


  /*
   * Return as toString, but do not accept a base argument, and include the minus sign for
   * negative zero.
   */
  P.valueOf = P.toJSON = function () {
    return valueOf(this);
  };


  P._isBigNumber = true;

  P[Symbol.toStringTag] = 'BigNumber';

  // Node.js v10.12.0+
  P[Symbol.for('nodejs.util.inspect.custom')] = P.valueOf;

  if (configObject != null) BigNumber.set(configObject);

  return BigNumber;
}


// PRIVATE HELPER FUNCTIONS

// These functions don't need access to variables,
// e.g. DECIMAL_PLACES, in the scope of the `clone` function above.


function bitFloor(n) {
  var i = n | 0;
  return n > 0 || n === i ? i : i - 1;
}


// Return a coefficient array as a string of base 10 digits.
function coeffToString(a) {
  var s, z,
    i = 1,
    j = a.length,
    r = a[0] + '';

  for (; i < j;) {
    s = a[i++] + '';
    z = LOG_BASE - s.length;
    for (; z--; s = '0' + s);
    r += s;
  }

  // Determine trailing zeros.
  for (j = r.length; r.charCodeAt(--j) === 48;);

  return r.slice(0, j + 1 || 1);
}


// Compare the value of BigNumbers x and y.
function compare(x, y) {
  var a, b,
    xc = x.c,
    yc = y.c,
    i = x.s,
    j = y.s,
    k = x.e,
    l = y.e;

  // Either NaN?
  if (!i || !j) return null;

  a = xc && !xc[0];
  b = yc && !yc[0];

  // Either zero?
  if (a || b) return a ? b ? 0 : -j : i;

  // Signs differ?
  if (i != j) return i;

  a = i < 0;
  b = k == l;

  // Either Infinity?
  if (!xc || !yc) return b ? 0 : !xc ^ a ? 1 : -1;

  // Compare exponents.
  if (!b) return k > l ^ a ? 1 : -1;

  j = (k = xc.length) < (l = yc.length) ? k : l;

  // Compare digit by digit.
  for (i = 0; i < j; i++) if (xc[i] != yc[i]) return xc[i] > yc[i] ^ a ? 1 : -1;

  // Compare lengths.
  return k == l ? 0 : k > l ^ a ? 1 : -1;
}


/*
 * Check that n is a primitive number, an integer, and in range, otherwise throw.
 */
function intCheck(n, min, max, name) {
  if (n < min || n > max || n !== mathfloor(n)) {
    throw Error
     (bignumberError + (name || 'Argument') + (typeof n == 'number'
       ? n < min || n > max ? ' out of range: ' : ' not an integer: '
       : ' not a primitive number: ') + String(n));
  }
}


// Assumes finite n.
function isOdd(n) {
  var k = n.c.length - 1;
  return bitFloor(n.e / LOG_BASE) == k && n.c[k] % 2 != 0;
}


function toExponential(str, e) {
  return (str.length > 1 ? str.charAt(0) + '.' + str.slice(1) : str) +
   (e < 0 ? 'e' : 'e+') + e;
}


function toFixedPoint(str, e, z) {
  var len, zs;

  // Negative exponent?
  if (e < 0) {

    // Prepend zeros.
    for (zs = z + '.'; ++e; zs += z);
    str = zs + str;

  // Positive exponent
  } else {
    len = str.length;

    // Append zeros.
    if (++e > len) {
      for (zs = z, e -= len; --e; zs += z);
      str += zs;
    } else if (e < len) {
      str = str.slice(0, e) + '.' + str.slice(e);
    }
  }

  return str;
}


// EXPORT


var BigNumber = clone();

class Float {
  constructor(is_negative, mantissa, exponent, is_normalized) {
    Object.assign(this, { is_negative, exponent, is_normalized, mantissa });
    this.ROUNDING = 6;
  }

  asNumber() {
    if (this.exponent === this.RESERVED) {
      // NaN or infinity
      return new BigNumber(this.reservedNumber())
    }

    return new BigNumber(this.is_normalized ? 1 : 0)
      .plus(this.mantissa)
      .times(this.is_negative ? -1 : 1)
      .times(new BigNumber(2).pow(this.exponent - this.BIAS))
  }

  toString() {
    return this.asNumber()
      .round(this.ROUNDING)
      .toString()
  }
}

/**
 * DataView & jDataView don't provide a way to import 80-bit floats.
 *
 * See: https://en.wikipedia.org/wiki/Extended_precision
 *
 */

class Float80 extends Float {
  get BIAS() { return 0x3fff }
  get RESERVED() { return 0x7fff }

  // Bytes (in big endian):
  // 
  // 9:Seeeeeee 8:eeeeeeee 7:Immmmmmm 6:mmmmmmmm 5:mmmmmmmm
  // 4:mmmmmmmm 3:mmmmmmmm 2:mmmmmmmm 1:mmmmmmmm 0:mmmmmmmm
  //
  // S: sign, e: exponent I: integer, m: mantissa
  //
  // The value of the float is:
  //
  //    (-1) ^ s * 2^(e - 0x3fff) * i.ffffffffff
  //    
  static fromBytes(b, littleEndian=false) {
    if (!littleEndian) { b = Array.from(b).reverse(); }

    // 1 bit sign
    const is_negative = Boolean(b[9] & 0x80);

    // 15 bit exponent
    // exponent = ((((b[7] << 1) & 0xff) << 3) | (b[6] >> 4)) - ((1 << 10) - 1),
    const exponent = (((b[9] << 1) & 0xff) << 7) | b[8];

    // 1 bit integer/significand part
    const is_normalized = Boolean(b[7] & 0x80);

    // Remove the normalization bit.
    b[7] = b[7] & 0x7f;

    // Read and convert the mantissa
    const mantissa_bits = b.slice(0, 8)
        .reverse()
        .map((num) => num.toString(2).padStart(8, '0'))
        .join('')
        .substr(1);

    // 63 bit fraction
    const mantissa = new BigNumber("0." + mantissa_bits, 2);

    return new Float80(is_negative, mantissa, exponent, is_normalized)
  }
  
  reservedNumber() {
    return (this.is_negative ? "-":"") +
           (this.mantissa.isZero() ? "Infinity" : "NaN")
  }
}

/*
 * alawmulaw: A-Law and mu-Law codecs in JavaScript.
 * https://github.com/rochars/alawmulaw
 *
 * Copyright (c) 2018 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */
  
  /**
   * Decode a 8-bit A-Law sample as 16-bit PCM.
   * @param {number} aLawSample The 8-bit A-Law sample
   * @return {number}
   */
  function decodeSample(aLawSample) {
	/** @type {number} */
	let sign = 0;
	aLawSample ^= 0x55;
	if (aLawSample & 0x80) {
	  aLawSample &= ~(1 << 7);
	  sign = -1;
	}
	/** @type {number} */
	let position = ((aLawSample & 0xF0) >> 4) + 4;
	/** @type {number} */
	let decoded = 0;
	if (position != 4) {
	  decoded = ((1 << position) |
		((aLawSample & 0x0F) << (position - 4)) |
		(1 << (position - 5)));
	} else {
	  decoded = (aLawSample << 1)|1;
	}
	decoded = (sign === 0) ? (decoded) : (-decoded);
	return (decoded * 8) * -1;
  }
  
  /**
   * Decode 8-bit A-Law samples into 16-bit linear PCM samples.
   * @param {!Uint8Array} samples A array of 8-bit A-Law samples.
   * @return {!Int16Array}
   */
  function decode(samples) {
	/** @type {!Int16Array} */
	let pcmSamples = new Int16Array(samples.length);
	for (let i=0; i<samples.length; i++) {
	  pcmSamples[i] = decodeSample(samples[i]);
	}
	return pcmSamples;
  }

/*
 * alawmulaw: A-Law and mu-Law codecs in JavaScript.
 * https://github.com/rochars/alawmulaw
 *
 * Copyright (c) 2018-2019 Rafael da Silva Rocha.
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */
/**
 * @type {Array<number>}
 * @private
 */
const decodeTable = [0,132,396,924,1980,4092,8316,16764];

/**
 * Decode a 8-bit mu-Law sample as 16-bit PCM.
 * @param {number} muLawSample The 8-bit mu-Law sample
 * @return {number}
 */
function decodeSample$1(muLawSample) {
  /** @type {number} */
  let sign;
  /** @type {number} */
  let exponent;
  /** @type {number} */
  let mantissa;
  /** @type {number} */
  let sample;
  muLawSample = ~muLawSample;
  sign = (muLawSample & 0x80);
  exponent = (muLawSample >> 4) & 0x07;
  mantissa = muLawSample & 0x0F;
  sample = decodeTable[exponent] + (mantissa << (exponent+3));
  if (sign != 0) sample = -sample;
  return sample;
}

/**
 * Decode 8-bit mu-Law samples into 16-bit PCM samples.
 * @param {!Uint8Array} samples A array of 8-bit mu-Law samples.
 * @return {!Int16Array}
 */
function decode$1(samples) {
  /** @type {!Int16Array} */
  let pcmSamples = new Int16Array(samples.length);
  for (let i=0; i<samples.length; i++) {
    pcmSamples[i] = decodeSample$1(samples[i]);
  }
  return pcmSamples;
}

/*	IFF AIFF / AIFF-C by DrSnuggles
	License : WTFPL 2.0, Beerware Revision 42
*/

async function parse$2(dat) {
	// read chunks
	while (dat.idx < dat.dv.byteLength -8) {	// -8 = ChunkName + ChunkSize
		//if (dat.idx % 2 != 0) dat.idx++	// Don't forget to skip the implied pad byte after every odd-length chunk, this is not included in the chunk count!
		const chunk = readChunk(dat);
		switch (chunk.name) {
			case 'FVER':
				// Do not confuse the format version with the creation date of the file.
				dat.versionTimestamp = getUint32(dat);		// seconds since January 1, 1904
				log('Apple Version Timestamp: '+ new Date(-2082848400000+dat.versionTimestamp*1000).toLocaleString('de-DE', {dateStyle:"medium", timeStyle:"medium"}) );
				break
			case 'COMM':
				log('COMM chunk size: '+ chunk.size);
				const chunkEnd = dat.idx + chunk.size;
				dat.comm = {
					numChannels: getInt16(dat),		// 16 bit signed
					numSampleFrames: getUint32(dat),// 32 bit unsigned
					sampleSize: getInt16(dat),		// 16 bit signed
					sampleRate: getIEEE754(dat)		// 80 bit IEEE Standard 754 floating point number (Standard Apple Numeric Environment [SANE] data type Extended)
				};
				// AIFC
				if (dat.idx < chunkEnd)	dat.comm.compressionType = getString(dat, 4);	// 32 bit ID
				if (dat.idx < chunkEnd)	dat.comm.compressionName = getString(dat, 4);	// pstring
				
				log('numChannels: '+ dat.comm.numChannels);
				log('numSampleFrames: '+ dat.comm.numSampleFrames);
				log('sampleSize = Bits: '+ dat.comm.sampleSize);
				log('sampleRate: '+ dat.comm.sampleRate);
				if (dat.comm.compressionType) log('compressionType: '+ dat.comm.compressionType);
			
				dat.channels = dat.comm.numChannels;
				dat.sampleRate = dat.comm.sampleRate;
				dat.bits = dat.comm.sampleSize;
			
				break
			case 'SSND':
				log('SSND chunk size: '+ chunk.size);
				dat.ssnd = {
					offset: getUint32(dat),				// actually zero is expected
					blockSize: getUint32(dat),			// 
				};
				if (!dat.comm.compressionType || dat.comm.compressionType == 'NONE') {
					// todo: actual only 8,16,24,32 bits
					if (dat.bits === 8) {
						// the final uncompressed BODY is signed 8bit -128...+127
						dat.data = new Int8Array( chunk.size );
						dat.data.set( new Int8Array(dat.dv.buffer).slice(dat.idx, dat.idx+chunk.size));
						dat.idx += chunk.size;
					} else if (dat.bits === 16) {
						// the final uncompressed BODY is signed 16bit -32768...+32767
						dat.data = [];
						for (let i = 0; i < chunk.size/2; i++) {
							dat.data.push( getInt16(dat) );
						}
						dat.data = new Int16Array( dat.data );	// want typed array
					} else if (dat.bits === 24) {
						// the final uncompressed BODY is signed 24bit −8388608...+8388607
						// dataview doesn't know 24 bit
						dat.data = [];
						for (let i = 0; i < chunk.size/3; i++) {
							dat.data.push( getInt24(dat) );
						}
						dat.data = new Int32Array( dat.data );	// want typed array is also not available in JS
					} else if (dat.bits === 32) {
						// the final uncompressed BODY is signed 32bit -2147483648...+-2147483647
						dat.data = [];
						for (let i = 0; i < chunk.size/4; i++) {
							dat.data.push( getInt32(dat) );
						}
						dat.data = new Int32Array( dat.data );	// want typed array
					}
				} else {
					// unpackers wants 8 bit unsigned and are just 8 to 16 bit
					// Here we do not need to split by channels... uff ;)
					const packedData = new Uint8Array(chunk.size);
					packedData.set( new Uint8Array(dat.dv.buffer).slice(dat.idx, dat.idx+chunk.size) );
					//dat.data = eval('decode_'+dat.comm.compressionType)(packedData)
					if (dat.comm.compressionType == 'alaw') dat.data = decode(packedData);
					if (dat.comm.compressionType == 'ulaw') dat.data = decode$1(packedData);
					dat.idx += chunk.size;
				}
				break
			default:
				processCommonChunks(dat, chunk);
		}

	}
	if (!dat.comm) {
		const msg = 'Missing COMM chunk. This is not a valid AIFF file.';
		log(msg);
		if (dat.cbOnError) dat.cbOnError(new Error(msg));
		return
	}

	prepareChannels$1(dat);
	await initContext(dat);

	dat.play = (loops) => { play(dat, loops); };
	dat.stop = () => { stop(dat); };
	dat.pause = () => { pause(dat); };
	dat.resume = () => { resume(dat); };
	dat.getPosition = () => { return getPosition(dat) };
	dat.setPosition = (pos) => { setPosition(dat, pos); };
}

function prepareChannels$1(dat) {
	// LRLRLRLR
	// prepare for playback. We need seperate channels with Floats range -1..+1
	//dat.ch = new Array(dat.channels).fill(new Array())	// array of channels << ATTENTION if we fill the first array the 2nd gets also filled
	dat.ch = [];
	for (let i = 0; i < dat.channels; i++) {
		dat.ch.push([]);
	}
	// LRLRLR...
	for (let i = 0; i < dat.data.length; i++) {
		let val = dat.data[i];
		if (dat.bits == 8) val = val / 128;
		if (dat.bits == 16) val = val / 32768;
		if (dat.bits == 24) val = val / 2147483648; // 8388608 i scaled the 24 bit to 32 bit
		if (dat.bits == 32) val = val / 2147483648;
		dat.ch[(i % dat.channels)].push( val );
	}
}

function getIEEE754(dat) {
	let b = [];
	// read 10 bytes = 80 bits
	for (let i = 0; i < 10; i++) {
		b.push( getUint8(dat) );
	}
	let bigNum = Float80.fromBytes(b);
	return bigNum.asNumber().toNumber()
}

/*	IFF FROM PREF subType by DrSnuggles
	License : WTFPL 2.0, Beerware Revision 42
	https://wiki.amigaos.net/wiki/Preferences#Preference_File_Format
*/

async function parse$3(dat) {
	// read next chunk, needs to be PRHD
	let chunk = readChunk(dat);
	if (chunk.name !== 'PRHD') {
		const msg = 'Missing PRHD chunk. This is not a valid PREF file.';
		log(msg);
		if (dat.cbOnError) dat.cbOnError(new Error(msg));
		return
	}
	log('PRHD chunk size: '+ chunk.size);
	// Currently all the fields are set to NULL. In future revisions these fields may be used to indicate a particular version and contents of a PREF chunk.
	// DrS: Even in OS4 PREFS file it's all 0
	dat.idx += chunk.size;	// skip it for now

	// read chunks
	while (dat.idx < dat.dv.byteLength -8) {	// -8 = ChunkName + ChunkSize
		chunk = readChunk(dat);
		switch (chunk.name) {
			case 'PALT':
				log('PALT chunk size: '+ chunk.size);
				const chunkStart = dat.idx *1;
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
				};
				let nextWord = getInt16(dat);
				while (nextWord != -1) {	// list 1 unidentified
					nextWord = getInt16(dat);
				}
				nextWord = 0;
				dat.idx = chunkStart + 84;
				while (nextWord != -1) {	// list 2 color associations
					if (nextWord < 0) nextWord = nextWord + 264;
					dat.PALT.asso.push( nextWord );
					nextWord = getInt16(dat);
				}
				log( 'ColAsso: '+ JSON.stringify(dat.PALT.asso) );
				nextWord = 0;
				dat.idx = chunkStart + 146;
				while (nextWord != -1) {	// list 3 colors OS 1/2 compatible 8 colors
					const r = getUint8(dat);
					dat.idx++;	// ship 2nd byte which is just a double of the first byte
					const g = getUint8(dat);
					dat.idx++;
					const b = getUint8(dat);
					dat.idx++;
					//dat.PALT.cols.push( '#'+ r.toString(16).padStart(2,0) + g.toString(16).padStart(2,0) + b.toString(16).padStart(2,0) )
					dat.PALT.cols[nextWord] = '#'+ r.toString(16).padStart(2,0) + g.toString(16).padStart(2,0) + b.toString(16).padStart(2,0);
					nextWord = getInt16(dat);
				}
				log( 'Colors: '+ JSON.stringify(dat.PALT.cols) );
				if (chunk.size > 400) {	// Thats OS4
					dat.PALT.os4cols = {};		// list 4
					dat.PALT.os4colsEna = {};	// list 5
					dat.idx = chunkStart + 400;	
					let i = 0;
					while (i < 256) {	// list 4 OS4 colors
						//console.log('list4')
						dat.PALT.os4cols[i] = '#'+ getUint8(dat).toString(16).padStart(2,0) + getUint8(dat).toString(16).padStart(2,0) + getUint8(dat).toString(16).padStart(2,0);
						i++;
					}
					log( 'OS4 Colors: '+ JSON.stringify(dat.PALT.os4cols) );
					i = 0;
					while (i < 256) {	// list 5 OS4 colors enabled or not
						//console.log('list4')
						dat.PALT.os4colsEna[i] = (getUint8(dat) == 1);
						i++;
					}
					log( 'OS4 Color enabled: '+ JSON.stringify(dat.PALT.os4colsEna) );
				}

				return // don't look further
			default:
				processCommonChunks(dat, chunk);
		}

	}

}

/*  IFF tools by DrSnuggles
	License : Public Domain

	Actually recognized types: ILBM, 8SVX, 16SV, AIFC, AIFF
	https://wiki.amigaos.net/wiki/IFF_FORM_and_Chunk_Registry
*/

class IFF {
	constructor(co,cbOnLoad,cbOnError,cbOnEnd) {
		this.idx = 0;
		this.cbOnLoad = cbOnLoad;
		this.cbOnError = cbOnError;
		this.cbOnEnd = cbOnEnd; // invoked from audio.js
		if (typeof co == 'string') this.load(co);
		if (typeof co == 'object') this.parse(co);
	}
	
	load(url) {
		fetch(url)
		.then(r => r.arrayBuffer())
		.then(ab => {
			log('File loaded');
			this.parse(ab);
		})
		.catch(e => {
			if (this.cbOnError) this.cbOnError(e);
			else console.error(e);
		});
	}
	async parse(ab) {
		this.dv = new DataView(ab);

		// detect EA IFF 85 group identifier
		// If it doesn’t start with “FORM”, “LIST”, or “CAT ”, it’s not an IFF-85 file.
		const group = getString(this, 4);
		if (['FORM', 'LIST', 'CAT '].indexOf(group) === -1) {
			const msg = 'This is not an IFF-85 file.';
			log(msg);
			if (this.cbOnError) this.cbOnError(new Error(msg));
			return
		}
		if (group !== 'FORM') {
			const msg = 'Only FORM group is supported.';
			log(msg);
			if (this.cbOnError) this.cbOnError(new Error(msg));
			return
		}
		this.group = group;
		this.formSize = getUint32(this);
		log(this.group + " chunk size = "+ this.formSize);
		if (this.formSize + 8 !== this.dv.byteLength) {
			log('FORM size does not match file size: '+this.formSize+8+' !== '+this.dv.byteLength);
		}

		// next is the subtype
		this.subType = getString(this, 4);

		switch (this.subType) {
			case 'ILBM':	// Image
				//if (typeof parseILBM == 'undefined') window.parseILBM = await import('./ilbm.js')
				//await parseILBM.parse(this)
				await parse(this);
				break
			case 'SMUS':	// Music composition
				break
			// Audio
			case '8SVX':
			case '16SV':
				this.bits = (this.subType == '8SVX') ? 8 : 16;
				//if (typeof parseSVX == 'undefined') window.parseSVX = await import('./svx.js')
				//await parseSVX.parse(this)
				await parse$1(this);
				break
			case 'AIFF':
			case 'AIFC':
				//if (typeof parseAIF == 'undefined') window.parseAIFF = await import('./aiff.js')
				//await parseAIFF.parse(this)
				await parse$2(this);
				break
			case 'PREF':
				await parse$3(this);
				break
			default:
				console.log('Not yet supported type: '+ this.subType);
		}

		this.cbOnLoad();	// we are done.. callback
	}
}

window.IFF = IFF;	// for easier access

export { IFF };
