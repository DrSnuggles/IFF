/*  IFF 8SVX by DrSnuggles
    License : WTFPL 2.0, Beerware Revision 42
 */

"use strict";

IFF = (function (my) {
  //
  // Init
  //

  //
  // Private
  //
  function parseILBM(str, sbuf8, idx, data) {
    // read BMHD
    if (str.substr(idx, 4) !== "BMHD") {
      my.log("no BMHD chunk found");
    } else {
      idx += 4;
      var size = (sbuf8[idx++]<<24) + (sbuf8[idx++]<<16) + (sbuf8[idx++]<<8) + (sbuf8[idx++]);
      my.log("BMHD chunk size: "+ size);

      // https://wiki.amigaos.net/wiki/ILBM_IFF_Interleaved_Bitmap
      var w = (sbuf8[idx++]<<8) + (sbuf8[idx++]);
      var h = (sbuf8[idx++]<<8) + (sbuf8[idx++]);
      var x = (sbuf8[idx++]<<8) + (sbuf8[idx++]);
      var y = (sbuf8[idx++]<<8) + (sbuf8[idx++]);
      var nPlanes = (sbuf8[idx++]);
      var masking = (sbuf8[idx++]);
      var compression = (sbuf8[idx++]);
      var pad1 = (sbuf8[idx++]);
      var transparentColor = (sbuf8[idx++]<<8) + (sbuf8[idx++]);
      var xAspect = (sbuf8[idx++]);
      var yAspect = (sbuf8[idx++]);
      var pageWidth = (sbuf8[idx++]<<8) + (sbuf8[idx++]);
      var pageHeight = (sbuf8[idx++]<<8) + (sbuf8[idx++]);

      my.log("w: "+ w);
      my.log("h: "+ h);
      my.log("x: "+ x);
      my.log("y: "+ y);
      my.log("nPlanes: "+ nPlanes);
      my.log("masking: "+ masking);
      my.log("compression: "+ compression);
      my.log("transparentColor: "+ transparentColor);
      my.log("xAspect: "+ xAspect);
      my.log("yAspect: "+ yAspect);
      my.log("pageWidth: "+ pageWidth);
      my.log("pageHeight: "+ pageHeight);

      if (compression) {
        data = unpack_ByteRun1(data);
      }

      // look for CMAP
      idx = str.indexOf("CMAP") + 4;
      var cmap = [];
      if (idx < 4) {
        my.log("no CMAP chunk found")
      } else {
        size = (sbuf8[idx++]<<24) + (sbuf8[idx++]<<16) + (sbuf8[idx++]<<8) + (sbuf8[idx++]);
        my.log("CMAP chunk size: "+ size);
        for (let i = 0; i < size; i+=3) {
          //cmap.push( (sbuf8[idx+i]<<16) + (sbuf8[idx+i+1]<<8) + (sbuf8[idx+i+2]) );
          cmap.push( [(sbuf8[idx++]), (sbuf8[idx+++i]), (sbuf8[idx+++i]), 255] );
        }
      }
      //my.log(cmap);
      // check if we have the right amount of cols for #bitplanes
      my.log("2^"+nPlanes+"="+Math.pow(2, nPlanes) +" ?= "+ cmap.length);
      if (Math.pow(2, nPlanes) !== cmap.length) {
        my.log("num colors in cmap do not match bitplanes");
      }

      var pixBuf = bitPlaneToPixBuffer(data, w, h, nPlanes, masking);
      //my.log(pixBuf);
      //showILBM(pixBuf, w*xAspect, h*yAspect, document.getElementById("ILBMcanvas"));
      showILBM(pixBuf, w, h, document.getElementById("ILBMcanvas"));

    }
  }
  function unpack_ByteRun1(uint8) {
    var int8 = new Int8Array(uint8);
    var length = uint8.length;
    var ret = [];

    var input_offset = 0;
    var output_offset = 0;
    while(input_offset < length - 1) {
      var control = int8[input_offset];
      input_offset++;
      if (control > 0) {
        for (var r = 0; r < control + 1; r++) {
          if (input_offset >= length) {
            return ret;
          }
          ret[output_offset] = uint8[input_offset];
          output_offset++;
          input_offset++;
        }
      } else {
        var range = -control + 1;
        var value = uint8[input_offset];
        input_offset++;
        for (var r = 0; r < range; r++) {
          ret[output_offset] = value;
          output_offset++;
        }
      }
    }
    return ret;
  }
  function showILBM(dat, w, h, bitplanes, canv) {
    canv = document.getElementById("ILBMcanvas");
    my.log(canv);
    canv.width = w;
    canv.height = h;

    var ctx = canv.getContext("2d");

  }
  function bitPlaneToPixBuffer(bit_buffer, width, height, planes, masking) {
    var row_bytes = ((width + 15) >> 4) << 1;
    var ret = new Array(width*height);
    if (masking == 1) {
      planes += 1;
    }
    for (var y = 0; y < height; y++) {
      for (var p = 0; p < planes; p++) {
        var plane_mask = 1 << p;
        for (var i = 0; i < row_bytes; i++) {
          var bit_offset = (y * planes * row_bytes) + (p * row_bytes) + i;
          var bit_value = bit_buffer[bit_offset];
          for (var b = 0; b < 8; b++) {
            var pixel_mask = 1 << (7 - b);
            if (bit_value & pixel_mask) {
              var x = (i * 8) + b;
              ret[(y * width) + x] |= plane_mask;
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
