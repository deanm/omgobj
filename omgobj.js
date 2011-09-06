var fs = require('fs');

// An async line processor based on a readable stream.
function forAsyncEachLine(stream, line_callback, eof_callback) {
  var leftovers = '';

  stream.on('data', function(data) {
    var prev = 0;
    for (var i = 0, il = data.length; i < il; ++i) {
      if (data[i] == 10) {
        if (i === prev && leftovers.length === 0) {
          ++prev;
        } else {
          line_callback(leftovers + data.toString('ascii', prev, i));
          leftovers = '';
          prev = i + 1;
        }
      }
    }
    if (prev !== i) {
      leftovers = data.toString('ascii', prev, i);
    }
  });

  stream.on('close', function() {
    if (leftovers.length !== 0) {
      // console.log('No trailing newline...');
      line_callback(leftovers);
    }
    eof_callback();
  });
}

function splitFaceIndices(str) {
  var pieces = str.split('/');
  return({v: parseInt(pieces[0]),
          vt: parseInt(pieces[1]),
          vn: parseInt(pieces[2])});
}

function loadTriangles(filename, done_callback, opts) {
  var stream = fs.createReadStream(filename);
  var opts = opts === undefined ? { } : opts;

  var load_normals = opts.normals === false ? false : true;
  var load_uvs = opts.uvs === false ? false : true;

  var data = [ ];
  // OBJ indexes from 1, instead of adjusting, just fill the first element.
  var v = [ null, ];  // Verts.
  var vn = load_normals ? [ null, ] : null;  // Normals.
  var vt = load_uvs ? [ null, ] : null;  // Texture coordinates.
  
  forAsyncEachLine(stream, function(line) {
    var line = line.trim();
    if (line.length === 0 || line[0] === "#")
      return;

    var pieces = line.split(/\s+/);
    switch (pieces[0]) {
      case 'v':
        v.push({x: parseFloat(pieces[1]),
                y: parseFloat(pieces[2]),
                z: parseFloat(pieces[3])});
        break;
      case 'vn':
        if (load_normals === true) {
          vn.push({x: parseFloat(pieces[1]),
                   y: parseFloat(pieces[2]),
                   z: parseFloat(pieces[3])});
        }
        break;
      case 'vt':
        if (load_uvs === true) {
          vt.push({x: parseFloat(pieces[1]),
                   y: parseFloat(pieces[2])});
        }
        break;
      case 'f':
        var inds1 = splitFaceIndices(pieces[1]);
        var indsi1 = splitFaceIndices(pieces[2]);
        // We triangulate all faces to handle polygons.  This keeps the vertes
        // ordering, always creating a triangle from the first vertex together
        // with the next and previous vertex (indsi and indsi1).
        for (var i = 3, il = pieces.length; i < il; ++i) {
          var indsi = splitFaceIndices(pieces[i]);
          data.push(v[inds1.v].x, v[inds1.v].y, v[inds1.v].z);
          if (load_normals === true)
            data.push(vn[inds1.vn].x, vn[inds1.vn].y, vn[inds1.vn].z);
          if (load_uvs === true)
            data.push(vt[inds1.vt].x, vt[inds1.vt].y, vt[inds1.vt].z);
          data.push(v[indsi1.v].x, v[indsi1.v].y, v[indsi1.v].z);
          if (load_normals === true)
            data.push(vn[indsi1.vn].x, vn[indsi1.vn].y, vn[indsi1.vn].z);
          if (load_uvs === true)
            data.push(vt[indsi1.vt].x, vt[indsi1.vt].y, vt[indsi1.vt].z);
          data.push(v[indsi.v].x, v[indsi.v].y, v[indsi.v].z);
          if (load_normals === true)
            data.push(vn[indsi.vn].x, vn[indsi.vn].y, vn[indsi.vn].z);
          if (load_uvs === true)
            data.push(vt[indsi.vt].x, vt[indsi.vt].y, vt[indsi.vt].z);
          indsi1 = indsi;
        }
        break;
      default:
        // console.log('Unknown command: ' + pieces[0]);
        break;
    }
  }, function() {
    var num_components = 3 + (load_normals === true ? 3 : 0) +
                             (load_uvs === true ? 2 : 0);

    done_callback({geom: new Float32Array(data),
                   num: data.length / num_components,
                   stride: num_components * 4});
  });
}

exports.loadTriangles = loadTriangles;
