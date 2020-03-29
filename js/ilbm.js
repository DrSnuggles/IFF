/*  IFF ILBM by DrSnuggles with adapted
    canvas drawing by Matthias Wiesmann

    Copyright © 2012, Matthias Wiesmann
 All rights reserved.
    Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

    1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
    2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

"use strict";

IFF = (function (my) {
  //
  // Init
  //

  //
  // Private
  //
  function parseILBM(f, canv) {
    var size;
    // read BMHD
    my.findIndex(f, "BMHD");
    if (f.idx > 4) {
      f.bmhd = {};
      my.log("BMHD chunk size: "+ my.readLongU(f));

      // https://wiki.amigaos.net/wiki/ILBM_IFF_Interleaved_Bitmap
      f.bmhd.w = my.readWordU(f);
      f.bmhd.h = my.readWordU(f);
      f.bmhd.x = my.readWordU(f); // not U
      f.bmhd.y = my.readWordU(f); // not U
      f.bmhd.nPlanes = my.readByteU(f);
      f.bmhd.masking = my.readByteU(f); // 0=none, 1=HasMask, 2=HasTransparentColor, 3=Lasso
      f.bmhd.compression = my.readByteU(f); // 0=none, 1=ByteRun1
      f.bmhd.pad1 = my.readByteU(f);
      f.bmhd.transparentColor = my.readWordU(f);
      f.bmhd.xAspect = my.readByteU(f);
      f.bmhd.yAspect = my.readByteU(f);
      f.bmhd.pageWidth = my.readWordU(f); // not U
      f.bmhd.pageHeight = my.readWordU(f); // not U

      my.log("w: "+ f.bmhd.w);
      my.log("h: "+ f.bmhd.h);
      my.log("x: "+ f.bmhd.x);
      my.log("y: "+ f.bmhd.y);
      my.log("nPlanes: "+ f.bmhd.nPlanes);
      my.log("masking: "+ f.bmhd.masking);
      my.log("compression: "+ f.bmhd.compression);
      my.log("transparentColor: "+ f.bmhd.transparentColor);
      my.log("xAspect: "+ f.bmhd.xAspect);
      my.log("yAspect: "+ f.bmhd.yAspect);
      my.log("pageWidth: "+ f.bmhd.pageWidth);
      my.log("pageHeight: "+ f.bmhd.pageHeight);

      if (f.bmhd.compression) {
        f.data = unpack_ByteRun1(f.data);
      }
    }

    // read CMAP
    my.findIndex(f, "CMAP");
    if (f.idx > 4) {
      f.cmap = [];
      size = my.readLongU(f);
      my.log("CMAP chunk size: "+ size);
      for (let i = 0; i < size; i+=3) {
        //cmap.push( (f.u8[idx+i]<<16) + (f.u8[idx+i+1]<<8) + (f.u8[idx+i+2]) );
        f.cmap.push( [my.readByteU(f), my.readByteU(f), my.readByteU(f), 255] );
      }
      f.cmap_bits = 0;
      while(f.cmap.length > (1 << f.cmap_bits)) {
        f.cmap_bits++;
      }
      var scaled = isCMAPScaled(f);
      if (!scaled) scaleCMAP(f);
      f.cmap_overlay = new Array(f.cmap.length);

      //my.log(cmap);
      // check if we have the right amount of cols for #bitplanes
      my.log("2^"+f.bmhd.nPlanes+"="+Math.pow(2, f.bmhd.nPlanes) +" ?= "+ f.cmap.length);
      if (Math.pow(2, f.bmhd.nPlanes) !== f.cmap.length) {
        my.log("num colors in cmap do not match bitplanes");
      }
    }

    // CAMG
    my.findIndex(f, "CAMG");
    if (f.idx > 4) {
      my.log("CAMG chunk size: "+ my.readLongU(f));
      f.mode = {};
      f.mode.value = my.readLongU(f);
      f.mode.hires = (f.mode.value & 0x8000);
      f.mode.ham = (f.mode.value & 0x800);
      f.mode.ehb = (f.mode.value & 0x80);
      f.mode.lace = (f.mode.value & 0x4);

      if (f.mode.ehb && f.cmap_bits == f.bmhd.nPlanes) {
        my.log("EHB detected");
        f.cmap_bits--;
        f.cmap.length = f.cmap.length >> 1;
        f.cmap_overlay.length = f.cmap.length;
      }
      if (f.mode.ham && f.cmap_bits > f.bmhd.nPlanes - 2) {
        var delta = (f.cmap_bits - f.bmhd.nPlanes + 2);
        my.log("HAM delta: "+ delta);
        f.cmap_bits -= delta;
        f.cmap.length = f.cmap.length >> delta;
        f.cmap_overlay.length = f.cmap.length;
      }
    }

    // CRNG (notstd. but common use and multiple)
    my.findIndex(f, "CRNG");
    if (f.idx !== 3) f.crng = [];
    while (f.idx !== 3) {
      size = my.readLongU(f);
      my.log("CRNG chunk size: "+ size);
      var tmp = [];
      for (let i = 0; i < size; i++) {
        tmp.push( my.readByteU(f) );
      }
      f.crng.push( tmp );

      var t = f.str.substr(f.idx).indexOf("CRNG") + 4;
      if (t > 3) {
        f.idx += t;
      } else {
        f.idx = t;
      }
    }

    // DPI

    // PCHG

    // finally draw
    f.bmhd.pixBuf = bitPlaneToPixBuffer(f);
    //showILBM(pixBuf, w*xAspect, h*yAspect, document.getElementById("ILBMcanvas"));
    showILBM(f, canv);

  }
  function unpack_ByteRun1(uint8) {
    var int8 = new Int8Array(uint8);
    var ret = []; //decompressedChunkData
    var idx = 0;

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
	    } else {
        my.log("Error while decompressing");
      }
    }

    my.log("Unpack "+ uint8.length +"->"+ ret.length);
    my.log("Pack rate: "+ ((1-uint8.length/ret.length)*100).toFixed(1) +"%");

    return ret;
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
    return result;
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
          return true;
        }
      }
    }
    return false;
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
    my.log("CMAP scaled");
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
    var render_canvas = document.createElement("canvas");
    render_canvas.width = f.bmhd.w;
    render_canvas.height = f.bmhd.h;
    var render_ctx = render_canvas.getContext("2d");
    var target = render_ctx.createImageData(f.bmhd.w, f.bmhd.h);
    var idx = 0;
    var color = [0, 0, 0, 255];//iff.black_color;
    while (idx < f.bmhd.pixBuf.length) {
      var value = f.bmhd.pixBuf[idx];
      color = resolvePixels(f, value, color);
      for (let c = 0; c < 4; c++) {
        target.data[idx * 4 + c] = color[c];
      }
      idx++;
    }
    render_ctx.putImageData(target, 0, 0);

    /* Now render the image into the effective display target, with effective sizes */
    var ctx = canv.getContext("2d");
    ctx.drawImage(render_canvas, 0, 0, f.bmhd.w, f.bmhd.h, 0, 0, f.bmhd.eff_w, f.bmhd.eff_h);
    console.log(f);
  }
  function resolveHAMPixel(iff, value, previous_color) {
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
    return color_copy;
  }
  function resolveEHBPixel(f, value) {
    /**
    * Resolves a EHB encoded value into the correct color.
    * This assumes the color-table has been properly culled.
    */
    var base_color = f.cmap[(value % f.cmap.length)];
    return [base_color[0] >> 1, base_color[1] >> 1, base_color[2] >> 1, 255];
  }
  function resolveRGB24Pixel(value) {
    /**
    * Resolves a RGB24 encoded value into a correct color.
    */
    var red = (value & 0xff0000) >> 16;
    var green = (value & 0xff00) >> 8;
    var blue = value & 0xff;
    return [red, green, blue, 255];
  }
  function resolvePixels(f, value, previous_color) {
    /**
    * Convert the value for a given pixel into the appropriate rgba value.
    * The resolution logic depends on a lot of factors.
    */
    if (value == undefined) {
      value = f.bmhd.transparentColor;
    }
    if (f.bmhd.masking == 2 && value == f.bmhd.transparentColor) {
      // This breaks some images.
      //return [0, 0, 0, 255];
    }
    if (typeof f.cmap === "undefined") {
      /* No color map, must be absolute 24 bits RGB */
      if (f.bmhd.nPlanes == 24) {
        return resolveRGB24Pixel(value);
      }
    }
    if (value < f.cmap.length) {
      return f.cmap[value];
    }
    /* ham mode */
    if (f.mode.ham) {
      return resolveHAMPixel(f, value, previous_color);
    }
    /* ehb mode */
    if (f.mode.ehb) {
      return resolveEHBPixel(f, value);
    }
    console.log("oops no color resolve found");
    return [0, 0, 0, 0];
  }
  function resolveOverlayPixels(f, value) {
    /**
    * Resolve pixels during animation time.
    */
    var index;
    if (value >= f.cmap_overlay_length) {
      if (!f.mode.ehb) {
        return undefined;
      }
      var entry = f.cmap_overlay[value % f.cmap_length];
      if (entry == undefined) {
        return undefined;
      }
      index = entry + f.cmap_overlay_length;
    } else {
      index = f.cmap_overlay[value];
    }
    if (index == undefined) {
      return undefined;
    }
    return resolvePixels(f, index, [0, 0, 0, 255]);
  }
  function lineStart(f, line) {
    /**
    * Function called before each line start.
    * Copper like color-table rewrites are handled here.
    */
    var change_list = f.color_change_lists[line];
    if (change_list == undefined) {
      return;
    }
    for (var i = 0; i < change_list.length; i++) {
      var change = change_list[i];
      f.cmap[change.register] = change.color;
    }
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
    return ret;
  }

  //
  // Public
  //
  my.parseILBM = parseILBM;

  //
  // Exit
  //
  return my;
}(IFF || {}));
